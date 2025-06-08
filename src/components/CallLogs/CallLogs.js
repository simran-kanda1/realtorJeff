import React, { useState, useEffect } from 'react';
import { 
  collection, 
  query, 
  where, 
  orderBy, 
  getDocs,
  doc,
  getDoc,
  Timestamp 
} from 'firebase/firestore';
import { db } from '../../firebase';
import { 
  Phone, 
  PhoneCall, 
  PhoneIncoming, 
  PhoneOutgoing, 
  Clock, 
  User, 
  Calendar,
  Download,
  Volume2,
  Search,
  Filter,
  RefreshCw,
  CheckCircle,
  AlertCircle,
  XCircle,
  Eye,
  ChevronDown,
  ChevronUp
} from 'lucide-react';
import CallModal from '../CallModal/CallModal';
import './CallLogs.css';

const CallLogs = ({ onCallSelect, selectedLeadId }) => {
  const [callLogs, setCallLogs] = useState([]);
  const [filteredLogs, setFilteredLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterDirection, setFilterDirection] = useState('all');
  const [filterOutcome, setFilterOutcome] = useState('all');
  const [filterDateRange, setFilterDateRange] = useState('all');
  const [sortBy, setSortBy] = useState('timestamp');
  const [sortOrder, setSortOrder] = useState('desc');
  const [expandedCall, setExpandedCall] = useState(null);
  const [leadCache, setLeadCache] = useState({});

  // Fetch all call logs from multiple sources
  useEffect(() => {
    const fetchCallLogs = async () => {
      setLoading(true);
      try {
        let allCalls = [];
        
        // Fetch all leads to get their call attempts
        const leadsRef = collection(db, 'leads');
        const leadsSnapshot = await getDocs(leadsRef);
        const leads = leadsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        
        // Create lead cache for quick lookup
        const cache = {};
        leads.forEach(lead => {
          cache[lead.id] = lead;
          if (lead.phone) {
            cache[lead.phone] = lead;
          }
        });
        setLeadCache(cache);
        
        // Process each lead's call attempts
        for (const lead of leads) {
          if (lead.phone && lead.callAttempts && lead.callAttempts > 0) {
            for (let i = 1; i <= lead.callAttempts; i++) {
              const baseTime = lead.createdAt?.seconds ? 
                new Date(lead.createdAt.seconds * 1000) : 
                new Date(lead.createdAt);
              
              let callTime = new Date(baseTime);
              
              // Calculate call time based on attempt number
              if (i === 1) {
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
                leadId: lead.id,
                leadName: lead.fullName || lead.name || `${lead.firstName || ''} ${lead.lastName || ''}`.trim() || 'Unknown',
                phone: lead.phone,
                email: lead.email,
                direction: 'outgoing',
                timestamp: { seconds: callTime.getTime() / 1000 },
                duration: i === 1 ? (lead.callDuration || 0) : 0,
                outcome: i === 1 && lead.transcript ? 'answered' : 
                        i === 1 && lead.recordingUrl ? 'voicemail' : 'no_answer',
                recordingUrl: i === 1 ? lead.recordingUrl : null,
                transcript: i === 1 ? lead.transcript : null,
                summary: i === 1 ? lead.summary : null,
                attemptNumber: i,
                formType: lead.formType
              });
            }
          }
        }
        
        // Fetch incoming calls
        try {
          const incomingCallsRef = collection(db, 'incoming_calls');
          const incomingCallsQuery = query(incomingCallsRef, orderBy('timestamp', 'desc'));
          const incomingCallsSnapshot = await getDocs(incomingCallsQuery);
          
          incomingCallsSnapshot.docs.forEach(doc => {
            const callData = doc.data();
            const associatedLead = cache[callData.from];
            
            allCalls.push({
              id: doc.id,
              leadId: associatedLead?.id || null,
              leadName: associatedLead?.fullName || associatedLead?.name || 'Unknown Caller',
              phone: callData.from,
              email: associatedLead?.email || null,
              direction: 'incoming',
              timestamp: callData.timestamp,
              duration: callData.duration || 0,
              outcome: callData.outcome || 'answered',
              recordingUrl: callData.recordingUrl || null,
              transcript: callData.transcript || null,
              summary: callData.summary || null,
              formType: associatedLead?.formType || null,
              ...callData
            });
          });
        } catch (error) {
          console.log('Error fetching incoming calls:', error);
        }
        
        // Sort all calls by timestamp
        allCalls.sort((a, b) => {
          const aTime = a.timestamp?.seconds || 0;
          const bTime = b.timestamp?.seconds || 0;
          return bTime - aTime;
        });
        
        setCallLogs(allCalls);
        setFilteredLogs(allCalls);
        
      } catch (error) {
        console.error('Error fetching call logs:', error);
      } finally {
        setLoading(false);
      }
    };
    
    fetchCallLogs();
  }, []);

  // Apply filters and search
  useEffect(() => {
    let filtered = [...callLogs];
    
    // Search filter
    if (searchTerm) {
      filtered = filtered.filter(call => 
        call.leadName.toLowerCase().includes(searchTerm.toLowerCase()) ||
        call.phone.includes(searchTerm) ||
        (call.email && call.email.toLowerCase().includes(searchTerm.toLowerCase()))
      );
    }
    
    // Direction filter
    if (filterDirection !== 'all') {
      filtered = filtered.filter(call => call.direction === filterDirection);
    }
    
    // Outcome filter
    if (filterOutcome !== 'all') {
      filtered = filtered.filter(call => call.outcome === filterOutcome);
    }
    
    // Date range filter
    if (filterDateRange !== 'all') {
      const now = new Date();
      const filterDate = new Date();
      
      switch (filterDateRange) {
        case 'today':
          filterDate.setHours(0, 0, 0, 0);
          break;
        case 'week':
          filterDate.setDate(now.getDate() - 7);
          break;
        case 'month':
          filterDate.setMonth(now.getMonth() - 1);
          break;
        default:
          break;
      }
      
      if (filterDateRange !== 'all') {
        filtered = filtered.filter(call => {
          const callDate = call.timestamp?.seconds ? 
            new Date(call.timestamp.seconds * 1000) : 
            new Date(call.timestamp);
          return callDate >= filterDate;
        });
      }
    }
    
    // Sorting
    filtered.sort((a, b) => {
      let aValue, bValue;
      
      switch (sortBy) {
        case 'timestamp':
          aValue = a.timestamp?.seconds || 0;
          bValue = b.timestamp?.seconds || 0;
          break;
        case 'leadName':
          aValue = a.leadName.toLowerCase();
          bValue = b.leadName.toLowerCase();
          break;
        case 'duration':
          aValue = a.duration || 0;
          bValue = b.duration || 0;
          break;
        case 'outcome':
          aValue = a.outcome || '';
          bValue = b.outcome || '';
          break;
        default:
          aValue = a.timestamp?.seconds || 0;
          bValue = b.timestamp?.seconds || 0;
      }
      
      if (sortOrder === 'asc') {
        return aValue > bValue ? 1 : -1;
      } else {
        return aValue < bValue ? 1 : -1;
      }
    });
    
    setFilteredLogs(filtered);
  }, [callLogs, searchTerm, filterDirection, filterOutcome, filterDateRange, sortBy, sortOrder]);

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

  const getCallOutcome = (outcome) => {
    switch (outcome) {
      case 'answered': return { icon: CheckCircle, color: '#10b981', text: 'Answered' };
      case 'voicemail': return { icon: AlertCircle, color: '#f59e0b', text: 'Voicemail' };
      case 'no_answer': return { icon: XCircle, color: '#ef4444', text: 'No Answer' };
      case 'busy': return { icon: Phone, color: '#f59e0b', text: 'Busy' };
      default: return { icon: Phone, color: '#64748b', text: 'Unknown' };
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

  const handleSort = (field) => {
    if (sortBy === field) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortBy(field);
      setSortOrder('desc');
    }
  };

  const handleCallSelect = (call) => {
    if (call.leadId && onCallSelect) {
      onCallSelect(call.leadId);
    }
  };

  const toggleExpandCall = (callId) => {
    setExpandedCall(expandedCall === callId ? null : callId);
  };

  const refreshLogs = () => {
    window.location.reload();
  };

  if (loading) {
    return (
      <div className="call-logs-container">
        <div className="call-logs-loading">
          <RefreshCw className="spinning" size={24} />
          <p>Loading call logs...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="call-logs-container">
      <div className="call-logs-header">
        <div className="header-title">
          <PhoneCall size={24} />
          <h2>Call Logs</h2>
          <span className="call-count">({filteredLogs.length} calls)</span>
        </div>
        <button className="refresh-btn" onClick={refreshLogs}>
          <RefreshCw size={16} />
          Refresh
        </button>
      </div>

      <div className="call-logs-filters">
        <div className="filter-row">
          <div className="search-box">
            <Search size={16} />
            <input
              type="text"
              placeholder="Search by name, phone, or email..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
          
          <select 
            value={filterDirection} 
            onChange={(e) => setFilterDirection(e.target.value)}
          >
            <option value="all">All Directions</option>
            <option value="incoming">Incoming</option>
            <option value="outgoing">Outgoing</option>
          </select>
          
          <select 
            value={filterOutcome} 
            onChange={(e) => setFilterOutcome(e.target.value)}
          >
            <option value="all">All Outcomes</option>
            <option value="answered">Answered</option>
            <option value="voicemail">Voicemail</option>
            <option value="no_answer">No Answer</option>
            <option value="busy">Busy</option>
          </select>
          
          <select 
            value={filterDateRange} 
            onChange={(e) => setFilterDateRange(e.target.value)}
          >
            <option value="all">All Time</option>
            <option value="today">Today</option>
            <option value="week">Last Week</option>
            <option value="month">Last Month</option>
          </select>
        </div>
      </div>

      <div className="call-logs-table">
        <div className="table-header">
          <div className="header-cell sortable" onClick={() => handleSort('timestamp')}>
            <Clock size={16} />
            Date & Time
            {sortBy === 'timestamp' && (
              sortOrder === 'asc' ? <ChevronUp size={14} /> : <ChevronDown size={14} />
            )}
          </div>
          <div className="header-cell sortable" onClick={() => handleSort('leadName')}>
            <User size={16} />
            Lead
            {sortBy === 'leadName' && (
              sortOrder === 'asc' ? <ChevronUp size={14} /> : <ChevronDown size={14} />
            )}
          </div>
          <div className="header-cell">
            <Phone size={16} />
            Direction
          </div>
          <div className="header-cell sortable" onClick={() => handleSort('duration')}>
            <Clock size={16} />
            Duration
            {sortBy === 'duration' && (
              sortOrder === 'asc' ? <ChevronUp size={14} /> : <ChevronDown size={14} />
            )}
          </div>
          <div className="header-cell sortable" onClick={() => handleSort('outcome')}>
            <CheckCircle size={16} />
            Outcome
            {sortBy === 'outcome' && (
              sortOrder === 'asc' ? <ChevronUp size={14} /> : <ChevronDown size={14} />
            )}
          </div>
          <div className="header-cell">Actions</div>
        </div>

        <div className="table-body">
          {filteredLogs.length === 0 ? (
            <div className="no-calls">
              <Phone size={48} />
              <p>No call logs found</p>
              <small>Try adjusting your filters or search terms</small>
            </div>
          ) : (
            filteredLogs.map(call => {
              const OutcomeIcon = getCallOutcome(call.outcome || 'unknown').icon;
              const isExpanded = expandedCall === call.id;
              
              return (
                <div key={call.id} className={`table-row ${selectedLeadId === call.leadId ? 'selected' : ''}`}>
                  <div className="row-main">
                    <div className="cell">
                      <div className="timestamp-cell">
                        <span className="date">{formatTimestamp(call.timestamp)}</span>
                        <span className="time-ago">{getTimeAgo(call.timestamp)}</span>
                      </div>
                    </div>
                    
                    <div className="cell">
                      <div className="lead-cell">
                        <div className="lead-avatar">
                          {call.leadName.charAt(0).toUpperCase()}
                        </div>
                        <div className="lead-info">
                          <span className="lead-name">{call.leadName}</span>
                          <span className="lead-phone">{call.phone}</span>
                          {call.formType && (
                            <span className="form-type">{call.formType}</span>
                          )}
                        </div>
                      </div>
                    </div>
                    
                    <div className="cell">
                      <div className="direction-cell">
                        {call.direction === 'incoming' ? 
                          <PhoneIncoming size={16} className="incoming" /> : 
                          <PhoneOutgoing size={16} className="outgoing" />
                        }
                        <span>
                          {call.direction === 'incoming' ? 'Incoming' : 'Outgoing'}
                          {call.attemptNumber && ` (#${call.attemptNumber})`}
                        </span>
                      </div>
                    </div>
                    
                    <div className="cell">
                      <span className="duration">{formatDuration(call.duration)}</span>
                    </div>
                    
                    <div className="cell">
                      <div className="outcome-cell">
                        <OutcomeIcon 
                          size={16} 
                          style={{ color: getCallOutcome(call.outcome || 'unknown').color }}
                        />
                        <span>{getCallOutcome(call.outcome || 'unknown').text}</span>
                      </div>
                    </div>
                    
                    <div className="cell">
                      <div className="actions-cell">
                        {call.recordingUrl && (
                          <>
                            <button 
                              className="action-btn"
                              onClick={() => handlePlayRecording(call.recordingUrl)}
                              title="Play Recording"
                            >
                              <Volume2 size={14} />
                            </button>
                            <button 
                              className="action-btn"
                              onClick={() => handleDownloadRecording(call.recordingUrl)}
                              title="Download Recording"
                            >
                              <Download size={14} />
                            </button>
                          </>
                        )}
                        {call.leadId && (
                          <button 
                            className="action-btn"
                            onClick={() => handleCallSelect(call)}
                            title="View Lead Details"
                          >
                            <Eye size={14} />
                          </button>
                        )}
                        {(call.transcript || call.summary) && (
                          <button 
                            className="action-btn"
                            onClick={() => toggleExpandCall(call.id)}
                            title={isExpanded ? "Collapse Details" : "Expand Details"}
                          >
                            {isExpanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                  
                  {isExpanded && (call.transcript || call.summary) && (
                    <div className="row-expanded">
                      {call.summary && (
                        <div className="expanded-section">
                          <h5>Call Summary:</h5>
                          <p>{call.summary}</p>
                        </div>
                      )}
                      {call.transcript && (
                        <div className="expanded-section">
                          <h5>Transcript:</h5>
                          <div className="transcript-content">
                            {call.transcript}
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
};

export default CallLogs;