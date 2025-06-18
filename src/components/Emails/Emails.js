import React, { useState, useEffect } from 'react';
import { collection, query, orderBy, limit, onSnapshot, where, getDocs } from 'firebase/firestore';
import { db } from '../../firebase'; // Adjust path as needed
import './Emails.css';

const Emails = () => {
  const [emails, setEmails] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [filter, setFilter] = useState('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedEmail, setSelectedEmail] = useState(null);
  const [stats, setStats] = useState({
    total: 0,
    initialContact: 0,
    followUp: 0,
    general: 0
  });

  useEffect(() => {
    const fetchEmails = () => {
      try {
        let emailQuery = query(
          collection(db, 'email_logs'),
          orderBy('timestamp', 'desc'),
          limit(100)
        );

        // Apply filter if not 'all'
        if (filter !== 'all') {
          emailQuery = query(
            collection(db, 'email_logs'),
            where('emailType', '==', filter),
            orderBy('timestamp', 'desc'),
            limit(100)
          );
        }

        const unsubscribe = onSnapshot(emailQuery, (snapshot) => {
          const emailData = snapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data(),
            timestamp: doc.data().timestamp?.toDate(),
            sentAt: doc.data().sentAt
          }));

          // Filter by search term if provided
          const filteredEmails = searchTerm
            ? emailData.filter(email =>
                email.to?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                email.subject?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                email.formType?.toLowerCase().includes(searchTerm.toLowerCase())
              )
            : emailData;

          setEmails(filteredEmails);
          
          // Calculate stats
          const statsData = {
            total: emailData.length,
            initialContact: emailData.filter(e => e.emailType === 'initial_contact').length,
            followUp: emailData.filter(e => e.emailType === 'follow_up').length,
            general: emailData.filter(e => e.emailType === 'general').length
          };
          setStats(statsData);
          
          setLoading(false);
        }, (err) => {
          console.error('Error fetching emails:', err);
          setError('Failed to load emails');
          setLoading(false);
        });

        return unsubscribe;
      } catch (err) {
        console.error('Error setting up email listener:', err);
        setError('Failed to setup email listener');
        setLoading(false);
      }
    };

    const unsubscribe = fetchEmails();
    return () => {
      if (unsubscribe) unsubscribe();
    };
  }, [filter, searchTerm]);

  const formatDate = (date) => {
    if (!date) return 'N/A';
    if (typeof date === 'string') {
      return new Date(date).toLocaleString();
    }
    return date.toLocaleString();
  };

  const truncateText = (text, maxLength = 100) => {
    if (!text) return '';
    return text.length > maxLength ? text.substring(0, maxLength) + '...' : text;
  };

  const getEmailTypeClass = (type) => {
    switch (type) {
      case 'initial_contact':
        return 'email-type-initial';
      case 'follow_up':
        return 'email-type-followup';
      case 'general':
        return 'email-type-general';
      default:
        return 'email-type-default';
    }
  };

  const getFormTypeDisplay = (formType) => {
    if (!formType) return 'General Inquiry';
    
    const formTypeMap = {
      "155 Hunter Form": "155 Hunter Way",
      "146 Harley Form": "146 Harley Road",
      "5 Hawarden Form": "5 Hawarden Avenue",
      "36 Cheevers Form": "36 Cheevers Road",
      "14-219 Shellard Form": "219 Shellard Lane - Unit 14",
      "19 Rowanwood Form": "19 Rowanwood Avenue",
      "11 Colmar Form2": "11 Colmar Place - Unit 2",
      "home_list": "Home Listings Request",
      "market_report": "Market Report Request"
    };

    return formTypeMap[formType] || formType;
  };

  const openEmailModal = (email) => {
    setSelectedEmail(email);
  };

  const closeEmailModal = () => {
    setSelectedEmail(null);
  };

  if (loading) {
    return (
      <div className="emails-container">
        <div className="loading-spinner">
          <div className="spinner"></div>
          <p>Loading emails...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="emails-container">
        <div className="error-message">
          <h3>Error</h3>
          <p>{error}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="emails-container">
      <div className="emails-header">
        <h2>Email Logs</h2>
        <div className="emails-stats">
          <div className="stats-card">
            <span className="stat-number">{stats.total}</span>
            <span className="stat-label"> Total Emails</span>
          </div>
          <div className="stats-card">
            <span className="stat-number">{stats.initialContact}</span>
            <span className="stat-label"> Initial Contact</span>
          </div>
          <div className="stats-card">
            <span className="stat-number">{stats.followUp}</span>
            <span className="stat-label"> Follow Up</span>
          </div>
          <div className="stats-card">
            <span className="stat-number">{stats.general}</span>
            <span className="stat-label"> General</span>
          </div>
        </div>
      </div>

      <div className="emails-filters">
        <div className="filter-group">
          <label htmlFor="email-filter">Filter by Type:</label>
          <select
            id="email-filter"
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            className="filter-select"
          >
            <option value="all">All Emails</option>
            <option value="initial_contact">Initial Contact</option>
            <option value="follow_up">Follow Up</option>
            <option value="general">General</option>
          </select>
        </div>

        <div className="search-group">
          <label htmlFor="email-search">Search:</label>
          <input
            id="email-search"
            type="text"
            placeholder="Search by email, subject, or property..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="search-input"
          />
        </div>
      </div>

      <div className="emails-list">
        {emails.length === 0 ? (
          <div className="no-emails">
            <p>No emails found matching your criteria.</p>
          </div>
        ) : (
          emails.map((email) => (
            <div key={email.id} className="email-card" onClick={() => openEmailModal(email)}>
              <div className="email-header-info">
                <div className="email-recipient">
                  <strong>To:</strong> {email.to}
                </div>
                <div className="email-timestamp">
                  {formatDate(email.timestamp)}
                </div>
              </div>

              <div className="email-subject">
                <strong>{email.subject}</strong>
              </div>

              <div className="email-meta">
                <span className={`email-type ${getEmailTypeClass(email.emailType)}`}>
                  {email.emailType?.replace('_', ' ').toUpperCase() || 'GENERAL'}
                </span>
                {email.formType && (
                  <span className="form-type">
                    {getFormTypeDisplay(email.formType)}
                  </span>
                )}
                {email.leadId && (
                  <span className="lead-id">
                    Lead: {email.leadId.substring(0, 8)}...
                  </span>
                )}
              </div>

              <div className="email-preview">
                {truncateText(email.body?.replace(/<[^>]*>/g, '') || 'No content')}
              </div>

              <div className="email-status">
                <span className={`status-badge status-${email.status}`}>
                  {email.status?.toUpperCase() || 'UNKNOWN'}
                </span>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Email Modal */}
      {selectedEmail && (
        <div className="email-modal-overlay" onClick={closeEmailModal}>
          <div className="email-modal" onClick={(e) => e.stopPropagation()}>
            <div className="email-modal-header">
              <h3>Email Details</h3>
              <button className="close-modal" onClick={closeEmailModal}>×</button>
            </div>

            <div className="email-modal-content">
              <div className="email-field">
                <label>From:</label>
                <span>{selectedEmail.from}</span>
              </div>

              <div className="email-field">
                <label>To:</label>
                <span>{selectedEmail.to}</span>
              </div>

              <div className="email-field">
                <label>Subject:</label>
                <span>{selectedEmail.subject}</span>
              </div>

              <div className="email-field">
                <label>Type:</label>
                <span className={`email-type ${getEmailTypeClass(selectedEmail.emailType)}`}>
                  {selectedEmail.emailType?.replace('_', ' ').toUpperCase() || 'GENERAL'}
                </span>
              </div>

              {selectedEmail.formType && (
                <div className="email-field">
                  <label>Property/Form:</label>
                  <span>{getFormTypeDisplay(selectedEmail.formType)}</span>
                </div>
              )}

              {selectedEmail.leadId && (
                <div className="email-field">
                  <label>Lead ID:</label>
                  <span>{selectedEmail.leadId}</span>
                </div>
              )}

              <div className="email-field">
                <label>Sent At:</label>
                <span>{formatDate(selectedEmail.timestamp)}</span>
              </div>

              <div className="email-field">
                <label>Status:</label>
                <span className={`status-badge status-${selectedEmail.status}`}>
                  {selectedEmail.status?.toUpperCase() || 'UNKNOWN'}
                </span>
              </div>

              <div className="email-body-section">
                <label>Email Content:</label>
                <div 
                  className="email-body-content"
                  dangerouslySetInnerHTML={{ __html: selectedEmail.body || 'No content available' }}
                />
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Emails;