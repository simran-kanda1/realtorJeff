import React, { useState, useEffect, useRef } from 'react';
import { 
  collection, 
  query, 
  orderBy, 
  onSnapshot, 
  addDoc, 
  serverTimestamp,
  where,
  getDocs,
  doc,
  updateDoc
} from 'firebase/firestore';
import { db } from '../../firebase';
import { 
  Search, 
  Send, 
  MessageCircle, 
  Phone, 
  User, 
  Clock,
  ArrowLeft,
  Filter,
  MoreVertical,
  CheckCircle
} from 'lucide-react';
import CallModal from '../CallModal/CallModal'; 
import './Messages.css';

const Messages = () => {
  const [messages, setMessages] = useState([]);
  const [filteredMessages, setFilteredMessages] = useState([]);
  const [selectedConversation, setSelectedConversation] = useState(null);
  const [conversationMessages, setConversationMessages] = useState([]);
  const [newMessage, setNewMessage] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [filterStatus, setFilterStatus] = useState('all');
  const [leads, setLeads] = useState({});
  const [showCallModal, setShowCallModal] = useState(false);
  const [selectedLead, setSelectedLead] = useState(null);
  const messagesEndRef = useRef(null);

  // Fetch leads data - Updated to use document ID as key
  useEffect(() => {
    const fetchLeads = async () => {
      try {
        const leadsQuery = query(collection(db, 'leads'));
        const leadsSnapshot = await getDocs(leadsQuery);
        const leadsData = {};
        const leadsByPhone = {};
        
        leadsSnapshot.forEach((doc) => {
          const leadData = doc.data();
          const leadWithId = {
            id: doc.id,
            ...leadData
          };
          
          // Store by document ID (for leadId matching)
          leadsData[doc.id] = leadWithId;
          
          // Also store by phone for fallback matching
          if (leadData.phone) {
            leadsByPhone[leadData.phone] = leadWithId;
          }
        });
        
        // Store both mappings
        setLeads({ byId: leadsData, byPhone: leadsByPhone });
        console.log('Leads loaded:', { byId: leadsData, byPhone: leadsByPhone });
      } catch (error) {
        console.error('Error fetching leads:', error);
      }
    };

    fetchLeads();
  }, []);


  // SMS sending function
  const sendSMSMessage = async (messageData) => {
    try {
      console.log('Sending message data:', messageData);
      
      const response = await fetch('https://sendsms-sa7kwuncha-uc.a.run.app', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(messageData)
      });
      
      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`HTTP error ${response.status}: ${errorText}`);
      }
      
      return await response.json();
    } catch (error) {
      console.error('Error sending SMS:', error);
      throw error;
    }
  };

  // Store message function
  const storeMessage = async (messageData) => {
    try {
      const docRef = await addDoc(collection(db, 'messages'), {
        ...messageData,
        timestamp: serverTimestamp()
      });
      return docRef;
    } catch (error) {
      console.error('Error storing message:', error);
      throw error;
    }
  };

  // Mark conversation as read
  const markConversationAsRead = async (phoneNumber) => {
    try {
      const messagesQuery = query(
        collection(db, 'messages'),
        where('from', '==', phoneNumber),
        where('direction', '==', 'incoming'),
        where('status', '!=', 'read')
      );
      
      const snapshot = await getDocs(messagesQuery);
      const updatePromises = [];
      
      snapshot.forEach((docSnapshot) => {
        updatePromises.push(
          updateDoc(doc(db, 'messages', docSnapshot.id), {
            status: 'read'
          })
        );
      });
      
      await Promise.all(updatePromises);
  
      // Update local state immediately for better UX
      setFilteredMessages(prev => prev.map(conv => {
        if (conv.phoneNumber === phoneNumber) {
          return {
            ...conv,
            unreadCount: 0,
            hasUnrepliedIncoming: false
          };
        }
        return conv;
      }));
      
    } catch (error) {
      console.error('Error marking messages as read:', error);
    }
  };

  // Group messages by phone number to create conversations
  const groupMessagesByNumber = (messages) => {
    const conversations = {};
    
    // First, group all messages and get the latest status for each message
    const messageGroups = {};
    messages.forEach(message => {
      // Create a more specific key for grouping similar messages
      const roundedTime = Math.floor(new Date(message.timestamp).getTime() / 30000) * 30000; // 30 second window
      const groupKey = `${message.from}-${message.to}-${message.body}-${roundedTime}`;
      
      // Keep the message with the most advanced status (delivered > sent > pending)
      if (!messageGroups[groupKey] || 
          (message.status === 'delivered' && messageGroups[groupKey].status !== 'delivered') ||
          (message.status === 'sent' && messageGroups[groupKey].status === 'pending')) {
        messageGroups[groupKey] = message;
      }
    });
    
    const deduplicatedMessages = Object.values(messageGroups);
    
    deduplicatedMessages.forEach(message => {
      const phoneNumber = message.direction === 'incoming' ? message.from : message.to;
      
      if (!phoneNumber) return;
      
      if (!conversations[phoneNumber]) {
        conversations[phoneNumber] = {
          phoneNumber,
          messages: [],
          lastMessage: null,
          lastTimestamp: null,
          unreadCount: 0,
          hasUnrepliedIncoming: false, // New field to track unreplied messages
          leadId: message.leadId || null,
          lead: leads[phoneNumber] || null
        };
      }
      
      conversations[phoneNumber].messages.push(message);
      
      if (!conversations[phoneNumber].lastTimestamp || 
          message.timestamp > conversations[phoneNumber].lastTimestamp) {
        conversations[phoneNumber].lastMessage = message.body;
        conversations[phoneNumber].lastTimestamp = message.timestamp;
      }
      
      // Count unread incoming messages only
      if (message.direction === 'incoming' && message.status !== 'read') {
        conversations[phoneNumber].unreadCount++;
      }
    });
    
    // Check for unreplied incoming messages
    Object.values(conversations).forEach(conv => {
      const sortedMessages = conv.messages.sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
      const lastMessage = sortedMessages[sortedMessages.length - 1];
      
      // If last message is incoming and unread, mark as having unreplied incoming
      if (lastMessage && lastMessage.direction === 'incoming' && lastMessage.status !== 'read') {
        conv.hasUnrepliedIncoming = true;
      }
    });
    
    return Object.values(conversations).sort((a, b) => 
      new Date(b.lastTimestamp) - new Date(a.lastTimestamp)
    );
  };

  // Fetch all messages
  useEffect(() => {
    const messagesRef = collection(db, 'messages');
    const q = query(messagesRef, orderBy('timestamp', 'desc'));
    
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const messagesData = [];
      snapshot.forEach((doc) => {
        messagesData.push({
          id: doc.id,
          ...doc.data(),
          timestamp: doc.data().timestamp?.toDate?.() || new Date(doc.data().timestamp)
        });
      });
      
      setMessages(messagesData);
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  // Update conversations when messages or leads change
  useEffect(() => {
    const conversations = groupMessagesByNumber(messages);
    // Add lead data to conversations
    const conversationsWithLeads = conversations.map(conv => ({
      ...conv,
      lead: leads[conv.phoneNumber] || null
    }));
    setFilteredMessages(conversationsWithLeads);
  }, [messages, leads]);

  // Filter conversations based on search and status
  useEffect(() => {
    let filtered = groupMessagesByNumber(messages).map(conv => ({
      ...conv,
      lead: leads[conv.phoneNumber] || null
    }));
    
    if (searchTerm) {
      filtered = filtered.filter(conv => 
        conv.phoneNumber.includes(searchTerm) ||
        conv.lastMessage?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        conv.lead?.name?.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }
    
    if (filterStatus !== 'all') {
      filtered = filtered.filter(conv => {
        if (filterStatus === 'unread') return conv.unreadCount > 0;
        if (filterStatus === 'recent') return new Date() - new Date(conv.lastTimestamp) < 24 * 60 * 60 * 1000;
        return true;
      });
    }
    
    setFilteredMessages(filtered);
  }, [messages, searchTerm, filterStatus, leads]);

  // Load conversation messages when a conversation is selected
  useEffect(() => {
    if (selectedConversation) {
      // Deduplicate messages for the conversation view
      const allConversationMsgs = messages
        .filter(msg => {
          const phoneNumber = msg.direction === 'incoming' ? msg.from : msg.to;
          return phoneNumber === selectedConversation.phoneNumber;
        });
      
      // Group by content and timestamp (rounded) to remove duplicates
      const messageGroups = {};
      allConversationMsgs.forEach(message => {
        const roundedTime = Math.floor(new Date(message.timestamp).getTime() / 10000) * 10000;
        const groupKey = `${message.from}-${message.to}-${message.body}-${roundedTime}`;
        
        if (!messageGroups[groupKey] || message.status === 'delivered') {
          messageGroups[groupKey] = message;
        }
      });
      
      const deduplicatedMsgs = Object.values(messageGroups)
        .sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
      
      setConversationMessages(deduplicatedMsgs);
      scrollToBottom();
    }
  }, [selectedConversation, messages]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const handleSendMessage = async () => {
    if (!newMessage.trim() || !selectedConversation || sending) return;
    
    setSending(true);
    
    try {
      const smsResult = await sendSMSMessage({
        to: selectedConversation.phoneNumber,
        body: newMessage.trim(),
        leadId: selectedConversation.leadId
      });
      
      console.log("SMS sent successfully:", smsResult);
      
      await storeMessage({
        body: newMessage.trim(),
        direction: 'outgoing',
        to: selectedConversation.phoneNumber,
        from: '+12264006148',
        leadId: selectedConversation.leadId,
        status: 'sent',
        twilioSid: smsResult.sid || `manual_${Date.now()}`,
        messageType: 'manual'
      });
      
      setNewMessage('');
      scrollToBottom();
    } catch (error) {
      console.error('Error sending message:', error);
      alert(`Failed to send message: ${error.message}`);
    } finally {
      setSending(false);
    }
  };

  const handleKeyPress = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  const handleMarkAsRead = async (phoneNumber, e) => {
    e.stopPropagation();
    await markConversationAsRead(phoneNumber);
  };

  const handleMoreOptions = (conversation, e) => {
    e.stopPropagation();
    if (conversation.lead) {
      setSelectedLead(conversation.lead);
      setShowCallModal(true);
    } else {
      // If no lead data, you could show a message or create a basic lead object
      console.log('No lead data available for this conversation');
    }
  };

  const formatTime = (timestamp) => {
    if (!timestamp) return '';
    const date = new Date(timestamp);
    const now = new Date();
    const diffInHours = (now - date) / (1000 * 60 * 60);
    
    if (diffInHours < 24) {
      return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    } else if (diffInHours < 168) {
      return date.toLocaleDateString([], { weekday: 'short', hour: '2-digit', minute: '2-digit' });
    } else {
      return date.toLocaleDateString([], { month: 'short', day: 'numeric' });
    }
  };

  const formatPhoneNumber = (phone) => {
    if (!phone) return '';
    const cleaned = phone.replace(/\D/g, '');
    if (cleaned.length === 11 && cleaned.startsWith('1')) {
      const number = cleaned.slice(1);
      return `(${number.slice(0, 3)}) ${number.slice(3, 6)}-${number.slice(6)}`;
    }
    return phone;
  };

  // Calculate total unread messages for notifications
  const totalUnreadMessages = filteredMessages.reduce((total, conv) => {
    return total + (conv.hasUnrepliedIncoming ? conv.unreadCount : 0);
  }, 0);

  if (loading) {
    return (
      <div className="messages-container">
        <div className="loading-spinner">
          <MessageCircle size={24} />
          <span>Loading messages...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="messages-container">
      <div className="messages-header">
        <div className="header-content">
          <div className="header-title">
            <MessageCircle size={28} />
            <h1>Messages</h1>
            <span className="message-count">{filteredMessages.length} conversations</span>
            {totalUnreadMessages > 0 && (
                <div className="notifications-badge">
                    <span className="unread-count">{totalUnreadMessages}</span>
                    <span className="unread-text">need reply</span>
                </div>
                )}
          </div>
          
          <div className="header-controls">
            <div className="search-container">
              <Search size={20} />
              <input
                type="text"
                placeholder="Search by phone number, message, or name..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="search-input"
              />
            </div>
            
            <div className="filter-controls">
              <Filter size={20} />
              <select 
                value={filterStatus} 
                onChange={(e) => setFilterStatus(e.target.value)}
                className="filter-select"
              >
                <option value="all">All Messages</option>
                <option value="unread">Unread</option>
                <option value="recent">Recent (24h)</option>
              </select>
            </div>
          </div>
        </div>
      </div>

      <div className="messages-layout">
        {/* Conversations List */}
        <div className="conversations-panel">
          <div className="conversations-header">
            <h3>Conversations</h3>
            <span className="conversations-count">{filteredMessages.length}</span>
          </div>
          
          <div className="conversations-list">
            {filteredMessages.map((conversation) => (
              <div
                key={conversation.phoneNumber}
                className={`conversation-item ${selectedConversation?.phoneNumber === conversation.phoneNumber ? 'active' : ''}`}
                onClick={() => setSelectedConversation(conversation)}
              >
                <div className="conversation-avatar">
                  <User size={20} />
                  {conversation.hasUnrepliedIncoming && (
                    <div className="unread-indicator"></div>
                    )}
                </div>
                
                <div className="conversation-content">
                  <div className="conversation-header">
                    <span className="phone-number">
                      {conversation.lead?.name || formatPhoneNumber(conversation.phoneNumber)}
                    </span>
                    <div className="conversation-actions">
                      <span className="last-message-time">
                        {formatTime(conversation.lastTimestamp)}
                      </span>
                      {conversation.hasUnrepliedIncoming && (
                        <button
                            className="mark-read-btn"
                            onClick={(e) => handleMarkAsRead(conversation.phoneNumber, e)}
                            title="Mark as read"
                        >
                            <CheckCircle size={14} />
                        </button>
                        )}
                    </div>
                  </div>
                  
                  <div className="conversation-preview">
                    <span className="last-message">
                      {conversation.lastMessage || 'No messages'}
                    </span>
                    {conversation.hasUnrepliedIncoming && conversation.unreadCount > 0 && (
                        <span className="unread-badge">{conversation.unreadCount}</span>
                        )}
                  </div>
                  
                  {conversation.lead?.formType && (
                    <div className="form-type-badge">
                      {conversation.lead.formType}
                    </div>
                  )}
                </div>
              </div>
            ))}
            
            {filteredMessages.length === 0 && (
              <div className="empty-state">
                <MessageCircle size={48} />
                <p>No conversations found</p>
                <span>Messages will appear here when leads respond</span>
              </div>
            )}
          </div>
        </div>

        {/* Chat Panel */}
        <div className="chat-panel">
          {selectedConversation ? (
            <>
              <div className="chat-header">
                <button 
                  className="back-button"
                  onClick={() => setSelectedConversation(null)}
                >
                  <ArrowLeft size={20} />
                </button>
                
                <div className="chat-contact-info">
                  <div className="contact-avatar">
                    <User size={24} />
                  </div>
                  <div className="contact-details">
                    <h3>
                      {selectedConversation.lead?.name || formatPhoneNumber(selectedConversation.phoneNumber)}
                    </h3>
                    <span className="contact-status">
                      {conversationMessages.length} messages
                      {selectedConversation.lead?.formType && (
                        <span className="form-type"> • {selectedConversation.lead.formType}</span>
                      )}
                    </span>
                  </div>
                </div>
                
                <div className="chat-actions">
                  {selectedConversation.lead?.formType && (
                    <div className="form-type-display">
                      {selectedConversation.lead.formType}
                    </div>
                  )}
                  <button 
                    className="action-button" 
                    title="More options"
                    onClick={(e) => handleMoreOptions(selectedConversation, e)}
                  >
                    <MoreVertical size={20} />
                  </button>
                </div>
              </div>
              
              <div className="messages-list">
                {conversationMessages.map((message) => (
                  <div
                    key={message.id}
                    className={`message-bubble ${message.direction}`}
                  >
                    <div className="message-content">
                      <p>{message.body}</p>
                      <div className="message-meta">
                        <span className="message-time">
                          {formatTime(message.timestamp)}
                        </span>
                        {message.direction === 'outgoing' && (
                          <span className={`message-status ${message.status}`}>
                            {message.status === 'delivered' ? '✓✓' : '✓'}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
                <div ref={messagesEndRef} />
                
                {conversationMessages.length === 0 && (
                  <div className="no-messages">
                    <MessageCircle size={48} />
                    <p>No messages yet</p>
                    <span>Start the conversation below</span>
                  </div>
                )}
              </div>
              
              <div className="message-input-container">
                <div className="message-input-wrapper">
                  <textarea
                    value={newMessage}
                    onChange={(e) => setNewMessage(e.target.value)}
                    onKeyPress={handleKeyPress}
                    placeholder="Type your message..."
                    className="message-input"
                    rows="1"
                    disabled={sending}
                  />
                  <button
                    onClick={handleSendMessage}
                    className={`send-button ${!newMessage.trim() || sending ? 'disabled' : ''}`}
                    disabled={!newMessage.trim() || sending}
                  >
                    {sending ? <Clock size={20} /> : <Send size={20} />}
                  </button>
                </div>
              </div>
            </>
          ) : (
            <div className="no-conversation-selected">
              <MessageCircle size={64} />
              <h3>Select a conversation</h3>
              <p>Choose a conversation from the list to view and send messages</p>
            </div>
          )}
        </div>
      </div>

      {/* Call Modal */}
      {showCallModal && selectedLead && (
        <div className="modal-overlay" onClick={() => {
            setShowCallModal(false);
            setSelectedLead(null);
        }}>
            <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <CallModal
                lead={selectedLead}
                onClose={() => {
                setShowCallModal(false);
                setSelectedLead(null);
                }}
            />
            </div>
        </div>
        )}
    </div>
  );
};

export default Messages;