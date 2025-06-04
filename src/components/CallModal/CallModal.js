import React, { useState, useEffect } from 'react';
import { 
  doc, 
  updateDoc, 
  collection, 
  query, 
  where, 
  orderBy, 
  getDocs,
  addDoc,
  Timestamp,
  getDoc
} from 'firebase/firestore';
import { db } from '../../firebase';
import { 
  X, 
  Phone, 
  PhoneCall, 
  PhoneIncoming, 
  PhoneOutgoing, 
  MessageSquare, 
  Mail, 
  Calendar, 
  Clock, 
  User, 
  MapPin, 
  Home, 
  DollarSign,
  FileText,
  Play,
  Pause,
  Download,
  Edit3,
  Save,
  AlertCircle,
  CheckCircle,
  XCircle,
  Send,
  CalendarPlus,
  Activity,
  Volume2
} from 'lucide-react';
import './CallModal.css';

const CallModal = ({ leadId, onClose, onUpdate }) => {
  const [activeTab, setActiveTab] = useState('overview');
  const [isEditing, setIsEditing] = useState(false);
  const [editedNotes, setEditedNotes] = useState('');
  const [editedStatus, setEditedStatus] = useState('');
  const [isPlaying, setIsPlaying] = useState(false);
  const [loading, setLoading] = useState(false);
  const [leadData, setLeadData] = useState(null);
  const [callHistory, setCallHistory] = useState([]);
  const [messageHistory, setMessageHistory] = useState([]);
  const [newMessage, setNewMessage] = useState('');
  const [sendingMessage, setSendingMessage] = useState(false);

  // Fetch lead data and related records
  useEffect(() => {
    const fetchLeadData = async () => {
      if (!leadId) return;
      
      try {
        setLoading(true);
        
        // Fetch lead document by ID
        const leadRef = doc(db, 'leads', leadId);
        const leadSnapshot = await getDoc(leadRef);
        
        if (leadSnapshot.exists()) {
          const lead = { id: leadSnapshot.id, ...leadSnapshot.data() };
          setLeadData(lead);
          setEditedNotes(lead.notes || '');
          setEditedStatus(lead.status || 'new');

          if (lead.phone) {
            let allCalls = [];

            // Add call attempts based on callAttempts count
            if (lead.callAttempts && lead.callAttempts > 0) {
              for (let i = 1; i <= lead.callAttempts; i++) {
                const baseTime = lead.createdAt?.seconds ? 
                  new Date(lead.createdAt.seconds * 1000) : 
                  new Date(lead.createdAt);
                
                let callTime = new Date(baseTime);
                
                // Calculate call time based on attempt number
                if (i === 1) {
                  // First call - use original time or lastCallTime if available
                  callTime = lead.lastCallTime?.seconds ? 
                    new Date(lead.lastCallTime.seconds * 1000) : baseTime;
                } else if (i === 2) {
                  callTime.setDate(callTime.getDate() + 1);
                } else if (i === 3) {
                  callTime.setDate(callTime.getDate() + 3);
                } else if (i === 4) {
                  callTime.setDate(callTime.getDate() + 6);
                }
                
                allCalls.push({
                  id: `${lead.id}_attempt_${i}`,
                  direction: 'outgoing',
                  timestamp: { seconds: callTime.getTime() / 1000 },
                  duration: i === 1 ? (lead.callDuration || 0) : 0,
                  outcome: i === 1 && lead.transcript ? 'answered' : 
                          i === 1 && lead.recordingUrl ? 'voicemail' : 'no_answer',
                  recordingUrl: i === 1 ? lead.recordingUrl : null,
                  transcript: i === 1 ? lead.transcript : null,
                  summary: i === 1 ? lead.summary : null,
                  leadId: lead.id,
                  attemptNumber: i
                });
              }
            }
            
            // Fetch incoming calls (calls FROM the lead TO your system)
            try {
              const incomingCallsRef = collection(db, 'incoming_calls');
              const incomingCallsQuery = query(
                incomingCallsRef, 
                where('from', '==', lead.phone),
                orderBy('timestamp', 'desc')
              );
              const incomingCallsSnapshot = await getDocs(incomingCallsQuery);
              const incomingCalls = incomingCallsSnapshot.docs.map(doc => ({ 
                id: doc.id, 
                direction: 'incoming',
                ...doc.data() 
              }));
              
              allCalls = [...allCalls, ...incomingCalls];
            } catch (error) {
              console.log('Error fetching incoming calls:', error);
            }
            
            // Sort all calls by timestamp
            allCalls.sort((a, b) => {
              const aTime = a.timestamp?.seconds || 0;
              const bTime = b.timestamp?.seconds || 0;
              return bTime - aTime;
            });
            
            setCallHistory(allCalls);
            
            // Fetch message history - try multiple approaches
            const messagesRef = collection(db, 'messages');
            let messages = [];

            // Try by leadId first
            try {
              const messagesQuery = query(
                messagesRef,
                where('leadId', '==', leadId),
                orderBy('timestamp', 'desc')
              );
              const messagesSnapshot = await getDocs(messagesQuery);
              messages = messagesSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            } catch (error) {
              console.log('Error querying by leadId:', error);
            }

            // If no messages found by leadId, try by phone number
            if (messages.length === 0 && lead.phone) {
              try {
                // Try outgoing messages (to this phone)
                const outgoingQuery = query(
                  messagesRef,
                  where('to', '==', lead.phone),
                  orderBy('timestamp', 'desc')
                );
                const outgoingSnapshot = await getDocs(outgoingQuery);
                const outgoingMessages = outgoingSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
                
                // Try incoming messages (from this phone)
                const incomingQuery = query(
                  messagesRef,
                  where('from', '==', lead.phone),
                  orderBy('timestamp', 'desc')
                );
                const incomingSnapshot = await getDocs(incomingQuery);
                const incomingMessages = incomingSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
                
                // Combine and sort
                messages = [...outgoingMessages, ...incomingMessages].sort((a, b) => {
                  const aTime = a.timestamp?.seconds || 0;
                  const bTime = b.timestamp?.seconds || 0;
                  return bTime - aTime;
                });
              } catch (error) {
                console.log('Error querying by phone:', error);
              }
            }

            // If still no messages, try without orderBy (in case index doesn't exist)
            if (messages.length === 0 && lead.phone) {
              try {
                console.log('Trying message queries without orderBy...');
                
                // Try by leadId without orderBy
                const leadIdQuery = query(messagesRef, where('leadId', '==', leadId));
                const leadIdSnapshot = await getDocs(leadIdQuery);
                const leadIdMessages = leadIdSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
                
                // Try by phone without orderBy
                const phoneToQuery = query(messagesRef, where('to', '==', lead.phone));
                const phoneToSnapshot = await getDocs(phoneToQuery);
                const phoneToMessages = phoneToSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
                
                const phoneFromQuery = query(messagesRef, where('from', '==', lead.phone));
                const phoneFromSnapshot = await getDocs(phoneFromQuery);
                const phoneFromMessages = phoneFromSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
                
                // Combine all messages and remove duplicates
                const allMessages = [...leadIdMessages, ...phoneToMessages, ...phoneFromMessages];
                const uniqueMessages = allMessages.filter((message, index, self) => 
                  index === self.findIndex(m => m.id === message.id)
                );
                
                // Sort manually
                messages = uniqueMessages.sort((a, b) => {
                  const aTime = a.timestamp?.seconds || 0;
                  const bTime = b.timestamp?.seconds || 0;
                  return bTime - aTime;
                });
                
              } catch (error) {
                console.log('Error in fallback message queries:', error);
              }
            }

            console.log(`Found ${messages.length} messages for lead ${leadId}`, messages);
            setMessageHistory(messages);
          }
        }
        
      } catch (error) {
        console.error('Error fetching lead data:', error);
      } finally {
        setLoading(false);
      }
    };
    
    fetchLeadData();
  }, [leadId]);

  const formatDuration = (seconds) => {
    if (!seconds) return '0:00';
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const formatTimestamp = (timestamp) => {
    if (!timestamp) return 'N/A';
    const date = timestamp.seconds ? new Date(timestamp.seconds * 1000) : new Date(timestamp);
    return date.toLocaleString();
  };

  const getTimeAgo = (timestamp) => {
    if (!timestamp) return 'N/A';
    const date = timestamp.seconds ? new Date(timestamp.seconds * 1000) : new Date(timestamp);
    const now = new Date();
    const diffInHours = Math.floor((now - date) / (1000 * 60 * 60));
    const diffInDays = Math.floor(diffInHours / 24);
    
    if (diffInHours < 1) return 'Just now';
    if (diffInHours < 24) return `${diffInHours}h ago`;
    if (diffInDays < 7) return `${diffInDays}d ago`;
    return date.toLocaleDateString();
  };

  const getLeadStatus = (lead) => {
    if (!lead) return 'new';
    const now = new Date();
    const createdAt = lead.createdAt?.seconds ? new Date(lead.createdAt.seconds * 1000) : new Date(lead.createdAt);
    const daysSinceCreated = Math.floor((now - createdAt) / (1000 * 60 * 60 * 24));
    
    if (daysSinceCreated >= 7) return 'dormant';
    if (lead.lastResponseTime || lead.responded) return 'responded';
    if (lead.callAttempts > 0) return 'contacted';
    return 'new';
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'no_answer': return '#3b82f6';
      case 'answered': return '#f59e0b';
      case 'responded_sms': return '#f59e0b';
      case 'voicemail': return '#10b981';
      case 'callback_attempted': return '#8b5cf6';
      case 'dormant': return '#ef4444';
      default: return '#64748b';
    }
  };

  const getCallOutcome = (outcome) => {
    switch (outcome) {
      case 'answered': return { icon: CheckCircle, color: '#10b981', text: 'Answered' };
      case 'voicemail': return { icon: AlertCircle, color: '#f59e0b', text: 'Voicemail Left' };
      case 'no_answer': return { icon: XCircle, color: '#ef4444', text: 'No Answer' };
      case 'busy': return { icon: Phone, color: '#f59e0b', text: 'Busy' };
      case 'follow_up_scheduled': return { icon: Calendar, color: '#3b82f6', text: 'Follow-up Scheduled' };
      default: return { icon: Phone, color: '#64748b', text: 'Unknown' };
    }
  };

  const handleSaveNotes = async () => {
    if (!leadData) return;
    
    setLoading(true);
    try {
      const leadRef = doc(db, 'leads', leadData.id);
      await updateDoc(leadRef, {
        notes: editedNotes,
        status: editedStatus,
        updatedAt: Timestamp.now()
      });
      
      setLeadData(prev => ({
        ...prev,
        notes: editedNotes,
        status: editedStatus
      }));
      
      setIsEditing(false);
      onUpdate?.();
    } catch (error) {
      console.error('Error updating lead:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSendMessage = async () => {
    if (!newMessage.trim() || !leadData) return;
    
    setSendingMessage(true);
    try {
      // Add message to Firebase with leadId
      await addDoc(collection(db, 'messages'), {
        to: leadData.phone,
        from: 'system',
        body: newMessage,
        direction: 'outgoing',
        status: 'sent',
        timestamp: Timestamp.now(),
        leadId: leadData.id
      });
      
      // Update lead with last activity
      const leadRef = doc(db, 'leads', leadData.id);
      await updateDoc(leadRef, {
        lastActivity: Timestamp.now(),
        status: 'contacted'
      });
      
      setNewMessage('');
      
      // Refresh message history
      const messagesRef = collection(db, 'messages');
      const messagesQuery = query(
        messagesRef,
        where('leadId', '==', leadData.leadId),
        orderBy('timestamp', 'desc')
      );
      const messagesSnapshot = await getDocs(messagesQuery);
      const messages = messagesSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setMessageHistory(messages);
      
    } catch (error) {
      console.error('Error sending message:', error);
    } finally {
      setSendingMessage(false);
    }
  };

  const handleScheduleCall = async () => {
    if (!leadData) return;
    
    try {
      const nextCallTime = new Date();
      nextCallTime.setDate(nextCallTime.getDate() + 1);
      nextCallTime.setHours(10, 0, 0, 0);
      
      const leadRef = doc(db, 'leads', leadData.id);
      await updateDoc(leadRef, {
        nextCallTime: Timestamp.fromDate(nextCallTime),
        status: 'scheduled'
      });
      
      setLeadData(prev => ({
        ...prev,
        nextCallTime: Timestamp.fromDate(nextCallTime),
        status: 'scheduled'
      }));
      
    } catch (error) {
      console.error('Error scheduling call:', error);
    }
  };

  const handlePlayRecording = (recordingUrl) => {
    if (recordingUrl) {
      const audio = new Audio(recordingUrl);
      audio.play().catch(error => {
        console.error('Error playing recording:', error);
        alert('Unable to play recording. Please check the URL.');
      });
    }
  };

  const handleDownloadRecording = (recordingUrl) => {
    if (recordingUrl) {
      const link = document.createElement('a');
      link.href = recordingUrl;
      link.download = `recording-${Date.now()}.wav`;
      link.click();
    }
  };

  // Handle click outside modal
  const handleOverlayClick = (e) => {
    if (e.target === e.currentTarget) {
      onClose();
    }
  };

  if (loading && !leadData) {
    return (
      <div className="call-modal-overlay" onClick={handleOverlayClick}>
        <div className="call-modal loading-modal">
          <div className="loading-spinner">Loading lead data...</div>
        </div>
      </div>
    );
  }

  if (!leadData) {
    return (
      <div className="call-modal-overlay" onClick={handleOverlayClick}>
        <div className="call-modal error-modal">
          <div className="error-message">Lead not found</div>
          <button onClick={onClose}>Close</button>
        </div>
      </div>
    );
  }

  const currentStatus = getLeadStatus(leadData);

  return (
    <div className="call-modal-overlay" onClick={handleOverlayClick}>
      <div className="call-modal" onClick={(e) => e.stopPropagation()}>
        <div className="call-modal-header">
          <div className="call-modal-title">
            <div className="lead-avatar">
              {(leadData.fullName || leadData.firstName || leadData.name || 'U').charAt(0).toUpperCase()}
            </div>
            <div className="lead-info">
              <h2>{leadData.fullName || leadData.name || `${leadData.firstName || ''} ${leadData.lastName || ''}`.trim() || 'Unknown Lead'}</h2>
              <p className="lead-contact">{leadData.phone} • {leadData.email}</p>
              <div className="lead-badges">
                <span 
                  className="status-badge"
                  style={{ backgroundColor: getStatusColor(currentStatus) }}
                >
                  {currentStatus.charAt(0).toUpperCase() + currentStatus.slice(1)}
                </span>
                {leadData.formType && (
                  <span className="form-type-badge">
                    {leadData.formType}
                  </span>
                )}
              </div>
            </div>
          </div>
          <button className="close-btn" onClick={onClose}>
            <X size={24} />
          </button>
        </div>

        <div className="call-modal-tabs">
          <button 
            className={`tab-btn ${activeTab === 'overview' ? 'active' : ''}`}
            onClick={() => setActiveTab('overview')}
          >
            <User size={18} />
            Overview
          </button>
          <button 
            className={`tab-btn ${activeTab === 'calls' ? 'active' : ''}`}
            onClick={() => setActiveTab('calls')}
          >
            <Phone size={18} />
            Calls ({callHistory.length})
          </button>
          <button 
            className={`tab-btn ${activeTab === 'messages' ? 'active' : ''}`}
            onClick={() => setActiveTab('messages')}
          >
            <MessageSquare size={18} />
            Messages ({messageHistory.length})
          </button>
          <button 
            className={`tab-btn ${activeTab === 'timeline' ? 'active' : ''}`}
            onClick={() => setActiveTab('timeline')}
          >
            <Activity size={18} />
            Timeline
          </button>
        </div>

        <div className="call-modal-content">
          {activeTab === 'overview' && (
            <div className="overview-tab">
              <div className="overview-grid">
                <div className="overview-section">
                  <h3>Lead Information</h3>
                  <div className="info-grid">
                    <div className="info-item">
                      <User size={16} />
                      <span className="label">Name:</span>
                      <span className="value">{leadData.fullName || leadData.name || `${leadData.firstName || ''} ${leadData.lastName || ''}`.trim() || 'N/A'}</span>
                    </div>
                    <div className="info-item">
                      <Phone size={16} />
                      <span className="label">Phone:</span>
                      <span className="value">{leadData.phone || 'N/A'}</span>
                    </div>
                    <div className="info-item">
                      <Mail size={16} />
                      <span className="label">Email:</span>
                      <span className="value">{leadData.email || 'N/A'}</span>
                    </div>
                    <div className="info-item">
                      <FileText size={16} />
                      <span className="label">Form Type:</span>
                      <span className="value">{leadData.formType || 'N/A'}</span>
                    </div>
                    <div className="info-item">
                      <Clock size={16} />
                      <span className="label">Created:</span>
                      <span className="value">{formatTimestamp(leadData.createdAt)}</span>
                    </div>
                    <div className="info-item">
                      <Calendar size={16} />
                      <span className="label">Updated:</span>
                      <span className="value">{formatTimestamp(leadData.updatedAt)}</span>
                    </div>
                    <div className="info-item">
                      <Clock size={16} />
                      <span className="label">Call Attempts:</span>
                      <span className="value">{leadData.callAttempts || 0}</span>
                    </div>
                    <div className="info-item">
                      <Calendar size={16} />
                      <span className="label">Next Call:</span>
                      <span className="value">
                        {leadData.nextCallTime ? formatTimestamp(leadData.nextCallTime) : 'Not scheduled'}
                      </span>
                    </div>
                  </div>

                  {/* Recording and Transcript Section */}
                  {(leadData.recordingUrl || leadData.transcript) && (
                    <div className="recording-transcript-section">
                      <h4>Initial Call Details</h4>
                      {leadData.recordingUrl && (
                        <div className="recording-controls">
                          <button 
                            className="play-btn"
                            onClick={() => handlePlayRecording(leadData.recordingUrl)}
                          >
                            <Volume2 size={16} />
                            Play Recording
                          </button>
                          <button 
                            className="download-btn"
                            onClick={() => handleDownloadRecording(leadData.recordingUrl)}
                          >
                            <Download size={16} />
                            Download
                          </button>
                        </div>
                      )}
                      {leadData.transcript && (
                        <div className="transcript-section">
                          <h5>Transcript:</h5>
                          <div className="transcript-content">
                            {leadData.transcript}
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>

                <div className="overview-section">
                  <div className="section-header">
                    <h3>Notes & Status</h3>
                    {!isEditing ? (
                      <button className="edit-btn" onClick={() => setIsEditing(true)}>
                        <Edit3 size={16} />
                        Edit
                      </button>
                    ) : (
                      <div className="edit-actions">
                        <button className="save-btn" onClick={handleSaveNotes} disabled={loading}>
                          <Save size={16} />
                          Save
                        </button>
                        <button className="cancel-btn" onClick={() => setIsEditing(false)}>
                          Cancel
                        </button>
                      </div>
                    )}
                  </div>
                  
                  {isEditing ? (
                    <div className="edit-form">
                      <div className="form-group">
                        <label>Status:</label>
                        <select
                          value={editedStatus}
                          onChange={(e) => setEditedStatus(e.target.value)}
                        >
                          <option value="new">New</option>
                          <option value="contacted">Contacted</option>
                          <option value="responded">Responded</option>
                          <option value="scheduled">Scheduled</option>
                          <option value="dormant">Dormant</option>
                        </select>
                      </div>
                      <div className="form-group">
                        <label>Notes:</label>
                        <textarea
                          value={editedNotes}
                          onChange={(e) => setEditedNotes(e.target.value)}
                          placeholder="Add notes about this lead..."
                          rows={6}
                        />
                      </div>
                    </div>
                  ) : (
                    <div className="notes-display">
                      <p><strong>Current Status:</strong> {currentStatus}</p>
                      <div className="notes-content">
                        {leadData.notes || 'No notes available'}
                      </div>
                    </div>
                  )}
                </div>
              </div>

              <div className="action-buttons">
                <button className="action-btn primary" onClick={handleScheduleCall}>
                  <CalendarPlus size={18} />
                  Schedule Call
                </button>
                <button className="action-btn secondary" onClick={() => setActiveTab('messages')}>
                  <MessageSquare size={18} />
                  Send Message
                </button>
                <button className="action-btn secondary">
                  <Mail size={18} />
                  Send Email
                </button>
              </div>
            </div>
          )}

          {activeTab === 'calls' && (
            <div className="calls-tab">
              <div className="calls-summary">
                <h4>Call History ({callHistory.length} calls)</h4>
                <div className="call-stats">
                  <div className="stat">
                    <span>Total Calls:</span>
                    <strong>{callHistory.length}</strong>
                  </div>
                  <div className="stat">
                    <span>Answered:</span>
                    <strong>{callHistory.filter(c => c.outcome === 'answered').length}</strong>
                  </div>
                  <div className="stat">
                    <span>Voicemails:</span>
                    <strong>{callHistory.filter(c => c.outcome === 'voicemail').length}</strong>
                  </div>
                </div>
              </div>

              <div className="calls-list">
                {callHistory.length === 0 ? (
                  <div className="no-calls">
                    <Phone size={48} />
                    <p>No call history available</p>
                  </div>
                ) : (
                  callHistory.map(call => {
                    const OutcomeIcon = getCallOutcome(call.outcome || 'unknown').icon;
                    return (
                      <div key={call.id} className="call-item">
                        <div className="call-icon">
                          {call.direction === 'incoming' ? 
                            <PhoneIncoming size={20} className="incoming" /> : 
                            <PhoneOutgoing size={20} className="outgoing" />
                          }
                        </div>
                        <div className="call-content">
                          <div className="call-header">
                            <span className="call-type">
                              {call.direction === 'incoming' ? 'Incoming Call' : 
                               call.attemptNumber ? `Outgoing Call (Attempt #${call.attemptNumber})` : 
                               'Outgoing Call (Initial)'}
                            </span>
                            <span className="call-time">{getTimeAgo(call.timestamp)}</span>
                          </div>
                          <div className="call-details">
                            <span>Duration: {formatDuration(call.duration)}</span>
                            <span>•</span>
                            <span>{formatTimestamp(call.timestamp)}</span>
                          </div>
                          
                          {/* Recording Controls */}
                          {call.recordingUrl && (
                            <div className="call-recording">
                              <div className="recording-actions">
                                <button 
                                  className="play-btn small"
                                  onClick={() => handlePlayRecording(call.recordingUrl)}
                                >
                                  <Volume2 size={14} />
                                  Play
                                </button>
                                <button 
                                  className="download-btn small"
                                  onClick={() => handleDownloadRecording(call.recordingUrl)}
                                >
                                  <Download size={14} />
                                  Download
                                </button>
                              </div>
                            </div>
                          )}
                          
                          {call.transcript && (
                            <div className="call-transcript">
                              <strong>Transcript:</strong>
                              <p>{call.transcript}</p>
                            </div>
                          )}
                          {call.summary && (
                            <div className="call-summary">
                              <strong>Summary:</strong>
                              <p>{call.summary}</p>
                            </div>
                          )}
                        </div>
                        <div className="call-outcome">
                          <OutcomeIcon 
                            size={16} 
                            style={{ color: getCallOutcome(call.outcome || 'unknown').color }}
                          />
                          <span>{getCallOutcome(call.outcome || 'unknown').text}</span>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          )}

          {activeTab === 'messages' && (
            <div className="messages-tab">
              <div className="messages-header">
                <h4>Messages ({messageHistory.length})</h4>
              </div>
              
              <div className="messages-container">
                <div className="messages-list">
                  {messageHistory.length === 0 ? (
                    <div className="no-messages">
                      <MessageSquare size={48} />
                      <p>No message history available</p>
                    </div>
                  ) : (
                    messageHistory.map(message => (
                      <div 
                        key={message.id} 
                        className={`message-item ${message.direction}`}
                      >
                        <div className="message-content">
                          <div className="message-header">
                            <span className="message-direction">
                              {message.direction === 'incoming' ? 'From' : 'To'} {leadData.phone}
                            </span>
                            <span className="message-time">{getTimeAgo(message.timestamp)}</span>
                          </div>
                          <div className="message-body">
                            {message.body}
                          </div>
                          <div className="message-status">
                            Status: {message.status || 'delivered'}
                          </div>
                        </div>
                      </div>
                    ))
                  )}
                </div>
                
                <div className="message-composer">
                  <div className="composer-header">
                    <h5>Send Message to {leadData.phone}</h5>
                  </div>
                  <div className="composer-body">
                    <textarea
                      value={newMessage}
                      onChange={(e) => setNewMessage(e.target.value)}
                      placeholder="Type your message here..."
                      rows={3}
                    />
                    <button 
                      className="send-btn"
                      onClick={handleSendMessage}
                      disabled={!newMessage.trim() || sendingMessage}
                    >
                      <Send size={16} />
                      {sendingMessage ? 'Sending...' : 'Send'}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'timeline' && (
            <div className="timeline-tab">
              <h4>Activity Timeline</h4>
              <div className="timeline">
                {[
                  ...callHistory.map(call => ({
                    type: 'call',
                    timestamp: call.timestamp,
                    data: call
                  })),
                  ...messageHistory.map(message => ({
                    type: 'message',
                    timestamp: message.timestamp,
                    data: message
                  })),
                  {
                    type: 'created',
                    timestamp: leadData.createdAt,
                    data: { text: 'Lead created' }
                  }
                ]
                .sort((a, b) => {
                  const aTime = a.timestamp?.seconds || 0;
                  const bTime = b.timestamp?.seconds || 0;
                  return bTime - aTime;
                })
                .map((activity, index) => (
                  <div key={index} className="timeline-item">
                    <div className="timeline-marker">
                      {activity.type === 'call' && <Phone size={16} />}
                      {activity.type === 'message' && <MessageSquare size={16} />}
                      {activity.type === 'created' && <User size={16} />}
                    </div>
                    <div className="timeline-content">
                      <div className="timeline-header">
                        <span className="timeline-type">
                          {activity.type === 'call' && `${activity.data.direction} call`}
                          {activity.type === 'message' && `${activity.data.direction} message`}
                          {activity.type === 'created' && 'Lead created'}
                        </span>
                        <span className="timeline-time">
                          {getTimeAgo(activity.timestamp)}
                        </span>
                      </div>
                      <div className="timeline-details">
                        {activity.type === 'call' && (
                          <span>
                            Duration: {formatDuration(activity.data.duration)} • 
                            Outcome: {getCallOutcome(activity.data.outcome || 'unknown').text}
                          </span>
                        )}
                        {activity.type === 'message' && (
                          <span>{activity.data.body}</span>
                        )}
                        {activity.type === 'created' && (
                          <span>New lead entered the system</span>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default CallModal;