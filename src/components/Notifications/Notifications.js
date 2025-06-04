import React, { useState, useEffect } from 'react';
import { collection, getDocs, query, where, orderBy, Timestamp, updateDoc, doc } from 'firebase/firestore';
import { db } from '../../firebase';
import { AlertTriangle, AlertCircle, Clock, CheckCircle, XCircle, BellOff, Bell } from 'lucide-react';
import './Notifications.css';

const Notifications = () => {
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all'); // 'all', 'unread', 'critical', 'follow-up'

  useEffect(() => {
    const fetchNotifications = async () => {
      try {
        setLoading(true);
        
        //generate notifications based on the leads data
        const leadsRef = collection(db, 'leads');
        const q = query(
          leadsRef,
          orderBy('createdAt', 'desc')
        );
        
        const querySnapshot = await getDocs(q);
        const notificationsData = [];
        
        // Generate notifications from lead data
        querySnapshot.forEach((doc) => {
          const lead = { id: doc.id, ...doc.data() };
          
          // Add notification for failed calls
          if (lead.callStatus === 'failed') {
            notificationsData.push({
              id: `failed-${lead.id}`,
              type: 'error',
              title: 'Call Failed',
              message: `Call to ${lead.name || lead.phone || 'Unknown'} failed to connect.`,
              timestamp: lead.callTimestamp || lead.createdAt,
              read: false,
              leadId: lead.id,
              requiresAction: true,
              priority: 'high'
            });
          }
          
          // Add notification for qualified leads that need follow-up
          if (lead.qualified && !lead.followedUp) {
            notificationsData.push({
              id: `followup-${lead.id}`,
              type: 'follow-up',
              title: 'Qualified Lead Needs Follow-up',
              message: `${lead.name || 'A qualified lead'} is ready for follow-up.`,
              timestamp: lead.callTimestamp || lead.createdAt,
              read: false,
              leadId: lead.id,
              requiresAction: true,
              priority: 'medium'
            });
          }
          
          // Add notification for system errors
          if (lead.callStatus === 'error') {
            notificationsData.push({
              id: `error-${lead.id}`,
              type: 'critical',
              title: 'System Error',
              message: `System error occurred while processing call to ${lead.name || lead.phone || 'Unknown'}.`,
              timestamp: lead.callTimestamp || lead.createdAt,
              read: false,
              leadId: lead.id,
              requiresAction: true,
              priority: 'critical'
            });
          }
          
          // Add notification for incomplete qualification
          if (lead.callStatus === 'completed' && !lead.qualified && !lead.disqualificationReason) {
            notificationsData.push({
              id: `incomplete-${lead.id}`,
              type: 'warning',
              title: 'Incomplete Qualification',
              message: `Lead ${lead.name || lead.phone || 'Unknown'} was not qualified but no reason was provided.`,
              timestamp: lead.callTimestamp || lead.createdAt,
              read: false,
              leadId: lead.id,
              requiresAction: true,
              priority: 'low'
            });
          }
        });
        
        // Sort notifications by timestamp (newest first)
        notificationsData.sort((a, b) => {
          const timeA = a.timestamp?.seconds ? a.timestamp.seconds : new Date(a.timestamp).getTime() / 1000;
          const timeB = b.timestamp?.seconds ? b.timestamp.seconds : new Date(b.timestamp).getTime() / 1000;
          return timeB - timeA;
        });
        
        setNotifications(notificationsData);
        setLoading(false);
      } catch (error) {
        console.error('Error fetching notifications:', error);
        setLoading(false);
      }
    };
    
    fetchNotifications();
  }, []);
  
  // Function to format Firebase timestamp for display
  const formatTimestamp = (timestamp) => {
    if (!timestamp) return 'N/A';
    
    let date;
    // Check if it's a Firebase timestamp
    if (timestamp && typeof timestamp === 'object' && timestamp.seconds) {
      // Convert to JavaScript Date
      date = new Date(timestamp.seconds * 1000);
    } else {
      date = new Date(timestamp);
    }
    
    // Calculate time difference
    const now = new Date();
    const diffMs = now - date;
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMins / 60);
    const diffDays = Math.floor(diffHours / 24);
    
    if (diffMins < 1) {
      return 'Just now';
    } else if (diffMins < 60) {
      return `${diffMins} minute${diffMins > 1 ? 's' : ''} ago`;
    } else if (diffHours < 24) {
      return `${diffHours} hour${diffHours > 1 ? 's' : ''} ago`;
    } else if (diffDays < 7) {
      return `${diffDays} day${diffDays > 1 ? 's' : ''} ago`;
    } else {
      return date.toLocaleDateString();
    }
  };
  
  // Function to mark notification as read
  const markAsRead = (notificationId) => {
    setNotifications(prevNotifications => 
      prevNotifications.map(notification => 
        notification.id === notificationId 
          ? { ...notification, read: true } 
          : notification
      )
    );
    
    // In a real app, you would update the Firestore document
    // updateDoc(doc(db, 'notifications', notificationId), { read: true });
  };
  
  // Function to get the icon for each notification type
  const getNotificationIcon = (type, priority) => {
    switch (type) {
      case 'error':
        return <XCircle size={20} className="icon-error" />;
      case 'critical':
        return <AlertCircle size={20} className="icon-critical" />;
      case 'warning':
        return <AlertTriangle size={20} className="icon-warning" />;
      case 'follow-up':
        return <Clock size={20} className="icon-followup" />;
      default:
        return <Bell size={20} className="icon-info" />;
    }
  };
  
  // Filter notifications based on selected filter
  const getFilteredNotifications = () => {
    switch (filter) {
      case 'unread':
        return notifications.filter(notification => !notification.read);
      case 'critical':
        return notifications.filter(notification => notification.priority === 'critical' || notification.priority === 'high');
      case 'follow-up':
        return notifications.filter(notification => notification.type === 'follow-up');
      default:
        return notifications;
    }
  };
  
  const filteredNotifications = getFilteredNotifications();
  const unreadCount = notifications.filter(notification => !notification.read).length;
  const criticalCount = notifications.filter(notification => notification.priority === 'critical' || notification.priority === 'high').length;
  
  return (
    <div className="notifications">
      <div className="notifications-header">
        <h1>Notifications</h1>
        <div className="notification-counts">
          <span className="unread-count">{unreadCount} unread</span>
          {criticalCount > 0 && (
            <span className="critical-count">{criticalCount} critical</span>
          )}
        </div>
      </div>
      
      <div className="notification-filters">
        <button 
          className={filter === 'all' ? 'active' : ''} 
          onClick={() => setFilter('all')}
        >
          All
        </button>
        <button 
          className={filter === 'unread' ? 'active' : ''} 
          onClick={() => setFilter('unread')}
        >
          Unread
        </button>
        <button 
          className={filter === 'critical' ? 'active' : ''} 
          onClick={() => setFilter('critical')}
        >
          Critical
        </button>
        <button 
          className={filter === 'follow-up' ? 'active' : ''} 
          onClick={() => setFilter('follow-up')}
        >
          Follow-ups
        </button>
      </div>
      
      {loading ? (
        <div className="loading-spinner">
          <p>Loading notifications...</p>
        </div>
      ) : (
        <div className="notifications-list">
          {filteredNotifications.length > 0 ? (
            filteredNotifications.map(notification => (
              <div 
                key={notification.id}
                className={`notification-item ${notification.read ? 'read' : 'unread'} priority-${notification.priority}`}
                onClick={() => markAsRead(notification.id)}
              >
                <div className="notification-icon">
                  {notification.read ? (
                    <BellOff size={20} className="icon-read" />
                  ) : (
                    getNotificationIcon(notification.type, notification.priority)
                  )}
                </div>
                <div className="notification-content">
                  <h3 className="notification-title">{notification.title}</h3>
                  <p className="notification-message">{notification.message}</p>
                  <div className="notification-meta">
                    <span className="notification-time">{formatTimestamp(notification.timestamp)}</span>
                    {notification.requiresAction && (
                      <span className="notification-action-required">Action Required</span>
                    )}
                  </div>
                </div>
                {!notification.read && (
                  <div className="notification-unread-indicator"></div>
                )}
              </div>
            ))
          ) : (
            <div className="empty-notifications">
              <Bell size={48} />
              <p>No notifications match your filter.</p>
              {filter !== 'all' && (
                <button className="view-all-btn" onClick={() => setFilter('all')}>
                  View all notifications
                </button>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default Notifications;