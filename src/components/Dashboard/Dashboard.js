import React, { useState, useEffect } from 'react';
import { collection, getDocs, query, where, orderBy, limit, Timestamp } from 'firebase/firestore';
import { db } from '../../firebase';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, PieChart, Pie, Cell, LineChart, Line } from 'recharts';
import { 
  Phone, 
  Clock, 
  CheckCircle, 
  XCircle, 
  Calendar, 
  User, 
  Mail, 
  MessageSquare, 
  PhoneIncoming, 
  PhoneOutgoing,
  Home, 
  ChevronLeft, 
  ChevronRight,
  AlertCircle,
  Activity,
  Users,
  TrendingUp,
  Eye,
  PlayCircle
} from 'lucide-react';
import CallModal from '../CallModal/CallModal';
import { useNavigate } from 'react-router-dom';
import './Dashboard.css';

const Dashboard = () => {
  const navigate = useNavigate();
  const [leads, setLeads] = useState([]);
  const [incomingCalls, setIncomingCalls] = useState([]);
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({
    activeLeads: 0,
    dormantLeads: 0,
    totalCalls: 0,
    totalMessages: 0,
    responseRate: 0,
    avgResponseTime: 0,
    scheduledCalls: 0,
    newLeadsToday: 0
  });
  const [selectedLeadId, setSelectedLeadId] = useState(null);
  const [showCallModal, setShowCallModal] = useState(false);
  const [dateFilter, setDateFilter] = useState('month');
  const [selectedDate, setSelectedDate] = useState(new Date());

  // Function to format Firebase timestamp for display
  const formatTimestamp = (timestamp) => {
    if (!timestamp) return 'N/A';
    if (timestamp && typeof timestamp === 'object' && timestamp.seconds) {
      return new Date(timestamp.seconds * 1000).toLocaleString();
    }
    return String(timestamp);
  };

  // Function to get time ago format
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

  // Function to get lead status based on workflow
  const getLeadStatus = (lead) => {
    if (!lead) return 'new';
    const now = new Date();
    const createdAt = lead.createdAt?.seconds ? new Date(lead.createdAt.seconds * 1000) : new Date(lead.createdAt);
    const daysSinceCreated = Math.floor((now - createdAt) / (1000 * 60 * 60 * 24));
    
    // Check for explicit status first
    if (lead.status) {
      if (lead.status === 'dormant' || daysSinceCreated >= 7) return 'dormant';
      if (lead.status === 'responded' || lead.status === 'responded_sms') return 'responded';
      if (lead.status === 'contacted' || lead.status === 'no_answer') return 'contacted';
      if (lead.status === 'scheduled') return 'scheduled';
    }
    
    // Fallback to calculated status
    if (daysSinceCreated >= 7) return 'dormant';
    if (lead.lastResponseTime || lead.responded) return 'responded';
    if (lead.callAttempts > 0 || lead.callCompleted) return 'contacted';
    return 'new';
  };

  // Function to get status color
  const getStatusColor = (status) => {
    switch (status) {
      case 'new': return '#3b82f6';
      case 'contacted': return '#f59e0b';
      case 'responded': return '#10b981';
      case 'scheduled': return '#8b5cf6';
      case 'dormant': return '#ef4444';
      default: return '#64748b';
    }
  };

  // Period navigation functions
  const goToPreviousPeriod = () => {
    const newDate = new Date(selectedDate);
    if (dateFilter === 'week') {
      newDate.setDate(newDate.getDate() - 7);
    } else if (dateFilter === 'month') {
      newDate.setMonth(newDate.getMonth() - 1);
    } else if (dateFilter === 'year') {
      newDate.setFullYear(newDate.getFullYear() - 1);
    }
    setSelectedDate(newDate);
  };

  const goToNextPeriod = () => {
    const newDate = new Date(selectedDate);
    const today = new Date();
    
    if (dateFilter === 'week') {
      newDate.setDate(newDate.getDate() + 7);
      if (newDate > today) return;
    } else if (dateFilter === 'month') {
      newDate.setMonth(newDate.getMonth() + 1);
      if (newDate.getFullYear() > today.getFullYear() || 
          (newDate.getFullYear() === today.getFullYear() && newDate.getMonth() > today.getMonth())) return;
    } else if (dateFilter === 'year') {
      newDate.setFullYear(newDate.getFullYear() + 1);
      if (newDate.getFullYear() > today.getFullYear()) return;
    }
    setSelectedDate(newDate);
  };

  const getPeriodDisplayText = () => {
    const months = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
    
    if (dateFilter === 'week') {
      const startOfWeek = new Date(selectedDate);
      const day = startOfWeek.getDay();
      startOfWeek.setDate(selectedDate.getDate() - day);
      const endOfWeek = new Date(startOfWeek);
      endOfWeek.setDate(startOfWeek.getDate() + 6);
      return `${startOfWeek.getDate()} ${months[startOfWeek.getMonth()]} - ${endOfWeek.getDate()} ${months[endOfWeek.getMonth()]} ${endOfWeek.getFullYear()}`;
    } else if (dateFilter === 'month') {
      return `${months[selectedDate.getMonth()]} ${selectedDate.getFullYear()}`;
    } else if (dateFilter === 'year') {
      return selectedDate.getFullYear().toString();
    }
    return '';
  };

  // Function to open call modal for a specific lead
  const openCallModal = (leadId) => {
    setSelectedLeadId(leadId);
    setShowCallModal(true);
  };

  // Function to close call modal
  const closeCallModal = () => {
    setShowCallModal(false);
    setSelectedLeadId(null);
  };

  // Function to handle modal updates (refresh data)
  const handleModalUpdate = () => {
    // Refresh the dashboard data when modal updates
    fetchData();
  };

  // Function to find lead by phone number (for incoming calls)
  const findLeadByPhone = (phone) => {
    if (!phone) return null;
    const cleanPhone = phone.replace(/\D/g, ''); // Remove all non-digits
    return leads.find(lead => {
      const leadPhone = lead.phone?.replace(/\D/g, '');
      return leadPhone === cleanPhone;
    });
  };

  useEffect(() => {
    fetchData();
  }, [dateFilter, selectedDate]);

  const fetchData = async () => {
    try {
      setLoading(true);
      
      // Get date range for filtering
      let startDate, endDate;
      
      if (dateFilter === 'week') {
        const day = selectedDate.getDay();
        startDate = new Date(selectedDate);
        startDate.setDate(selectedDate.getDate() - day);
        startDate.setHours(0, 0, 0, 0);
        endDate = new Date(startDate);
        endDate.setDate(startDate.getDate() + 7);
        endDate.setHours(0, 0, 0, 0);
      } else if (dateFilter === 'month') {
        startDate = new Date(selectedDate.getFullYear(), selectedDate.getMonth(), 1);
        endDate = new Date(selectedDate.getFullYear(), selectedDate.getMonth() + 1, 0);
        endDate.setHours(23, 59, 59, 999);
      } else if (dateFilter === 'year') {
        startDate = new Date(selectedDate.getFullYear(), 0, 1);
        endDate = new Date(selectedDate.getFullYear(), 11, 31);
        endDate.setHours(23, 59, 59, 999);
      }
      
      const startTimestamp = Timestamp.fromDate(startDate);
      const endTimestamp = Timestamp.fromDate(endDate);
      
      // Fetch leads
      const leadsRef = collection(db, 'leads');
      const leadsQuery = query(
        leadsRef,
        where('createdAt', '>=', startTimestamp),
        where('createdAt', '<=', endTimestamp),
        orderBy('createdAt', 'desc')
      );
      const leadsSnapshot = await getDocs(leadsQuery);
      const leadsData = leadsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      
      // Fetch incoming calls
      const callsRef = collection(db, 'incoming_calls');
      const callsQuery = query(
        callsRef,
        where('timestamp', '>=', startTimestamp),
        where('timestamp', '<=', endTimestamp),
        orderBy('timestamp', 'desc')
      );
      const callsSnapshot = await getDocs(callsQuery);
      const callsData = callsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      
      // Fetch messages
      const messagesRef = collection(db, 'messages');
      const messagesQuery = query(
        messagesRef,
        where('timestamp', '>=', startTimestamp),
        where('timestamp', '<=', endTimestamp),
        orderBy('timestamp', 'desc')
      );
      const messagesSnapshot = await getDocs(messagesQuery);
      const messagesData = messagesSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      
      // Calculate statistics
      const now = new Date();
      const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      
      let activeLeads = 0;
      let dormantLeads = 0;
      let scheduledCalls = 0;
      let newLeadsToday = 0;
      let totalResponses = 0;
      
      leadsData.forEach(lead => {
        const status = getLeadStatus(lead);
        const createdAt = lead.createdAt?.seconds ? new Date(lead.createdAt.seconds * 1000) : new Date();
        
        if (status === 'dormant') {
          dormantLeads++;
        } else {
          activeLeads++;
        }
        
        if (createdAt >= today) {
          newLeadsToday++;
        }
        
        if (lead.nextCallTime) {
          scheduledCalls++;
        }
        
        if (lead.status === 'responded_sms' || lead.lastResponseTime || lead.responded) {
          totalResponses++;
        }
      });
      
      const responseRate = leadsData.length > 0 ? Math.round((totalResponses / leadsData.length) * 100) : 0;
      
      setLeads(leadsData);
      setIncomingCalls(callsData);
      setMessages(messagesData);
      setStats({
        activeLeads,
        dormantLeads,
        totalCalls: callsData.length,
        totalMessages: messagesData.length,
        responseRate,
        avgResponseTime: 24, // This would need proper calculation
        scheduledCalls,
        newLeadsToday
      });
      
      setLoading(false);
    } catch (error) {
      console.error('Error fetching data:', error);
      setLoading(false);
    }
  };
  
  // Lead status distribution data
  const leadStatusData = [
    { name: 'Active', value: stats.activeLeads, color: '#10b981' },
    { name: 'Dormant', value: stats.dormantLeads, color: '#ef4444' }
  ];
  
  // Get activity chart data
  const getActivityChartData = () => {
    if (dateFilter === 'week') {
      const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
      const callsByDay = Array(7).fill(0);
      const messagesByDay = Array(7).fill(0);
      
      incomingCalls.forEach(call => {
        if (call.timestamp?.seconds) {
          const callDate = new Date(call.timestamp.seconds * 1000);
          callsByDay[callDate.getDay()]++;
        }
      });
      
      messages.forEach(message => {
        if (message.timestamp?.seconds) {
          const messageDate = new Date(message.timestamp.seconds * 1000);
          messagesByDay[messageDate.getDay()]++;
        }
      });
      
      return days.map((day, index) => ({
        label: day,
        calls: callsByDay[index],
        messages: messagesByDay[index]
      }));
    }
    // Add month and year logic as needed
    return [];
  };

  return (
    <div className="dashboard">
      <div className="dashboard-header">
        <h1>AI Voice Agent Management Dashboard</h1>
        
        <div className="date-filter">
          <button 
            className={dateFilter === 'week' ? 'active' : ''} 
            onClick={() => {
              setDateFilter('week');
              setSelectedDate(new Date());
            }}
          >
            Week
          </button>
          <button 
            className={dateFilter === 'month' ? 'active' : ''} 
            onClick={() => {
              setDateFilter('month');
              setSelectedDate(new Date());
            }}
          >
            Month
          </button>
          <button 
            className={dateFilter === 'year' ? 'active' : ''} 
            onClick={() => {
              setDateFilter('year');
              setSelectedDate(new Date());
            }}
          >
            Year
          </button>
        </div>
      </div>
      
      <div className="period-navigation">
        <button onClick={goToPreviousPeriod}>
          <ChevronLeft size={18} />
          Previous
        </button>
        <span className="current-period">{getPeriodDisplayText()}</span>
        <button onClick={goToNextPeriod}>
          Next
          <ChevronRight size={18} />
        </button>
      </div>
      
      {loading ? (
        <div className="loading-spinner">
          <p>Loading dashboard...</p>
        </div>
      ) : (
        <>
          {/* Key Metrics Cards */}
          <div className="stat-cards">
            <div className="stat-card active-leads">
              <div className="stat-icon">
                <Users size={24} />
              </div>
              <div className="stat-content">
                <h3>Active Leads</h3>
                <p>{stats.activeLeads}</p>
                <span className="stat-subtitle">Being nurtured</span>
              </div>
            </div>
            
            <div className="stat-card new-leads">
              <div className="stat-icon">
                <TrendingUp size={24} />
              </div>
              <div className="stat-content">
                <h3>New Today</h3>
                <p>{stats.newLeadsToday}</p>
                <span className="stat-subtitle">Fresh leads</span>
              </div>
            </div>
            
            <div className="stat-card scheduled-calls">
              <div className="stat-icon">
                <Calendar size={24} />
              </div>
              <div className="stat-content">
                <h3>Scheduled Calls</h3>
                <p>{stats.scheduledCalls}</p>
                <span className="stat-subtitle">Upcoming</span>
              </div>
            </div>
            
            <div className="stat-card response-rate">
              <div className="stat-icon">
                <Activity size={24} />
              </div>
              <div className="stat-content">
                <h3>Response Rate</h3>
                <p>{stats.responseRate}%</p>
                <span className="stat-subtitle">Lead engagement</span>
              </div>
            </div>
          </div>

          {/* Charts Section */}
          <div className="dashboard-charts">
            <div className="chart-container">
              <h3>Lead Status Distribution</h3>
              <ResponsiveContainer width="100%" height={250}>
                <PieChart>
                  <Pie
                    data={leadStatusData}
                    cx="50%"
                    cy="50%"
                    labelLine={false}
                    outerRadius={80}
                    fill="#8884d8"
                    dataKey="value"
                    label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
                  >
                    {leadStatusData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            </div>
            
            <div className="chart-container">
              <h3>Daily Activity</h3>
              <ResponsiveContainer width="100%" height={250}>
                <BarChart data={getActivityChartData()}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="label" />
                  <YAxis />
                  <Tooltip />
                  <Legend />
                  <Bar dataKey="calls" name="Calls" fill="#3b82f6" />
                  <Bar dataKey="messages" name="Messages" fill="#10b981" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Action Items Section */}
          <div className="action-items">
            <h3>Today's Action Items</h3>
            <div className="action-grid">
              <div className="action-card urgent">
                <AlertCircle size={20} />
                <div>
                  <strong>Scheduled Calls</strong>
                  <p>{stats.scheduledCalls} calls due today</p>
                </div>
                <button onClick={() => navigate('/calls')}>View</button>
              </div>
              
              <div className="action-card info">
                <MessageSquare size={20} />
                <div>
                  <strong>New Messages</strong>
                  <p>{messages.filter(m => !m.processed).length} unread messages</p>
                </div>
                <button onClick={() => navigate('/messages')}>View</button>
              </div>
              
              <div className="action-card warning">
                <PhoneIncoming size={20} />
                <div>
                  <strong>Missed Calls</strong>
                  <p>{incomingCalls.filter(c => !c.processed).length} need follow-up</p>
                </div>
                <button onClick={() => navigate('/incoming-calls')}>View</button>
              </div>
            </div>
          </div>
          
          {/* Recent Activity Tables */}
          <div className="activity-sections">
            {/* Recent Leads */}
            <div className="activity-section">
              <div className="section-header">
                <h3>Recent Leads</h3>
                <button className="view-all-btn" onClick={() => navigate('/leads')}>View All</button>
              </div>
              
              <div className="activity-table-container">
                <table className="activity-table">
                  <thead>
                    <tr>
                      <th>Name</th>
                      <th>Contact</th>
                      <th>Status</th>
                      <th>Last Activity</th>
                      <th>Next Action</th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {leads.slice(0, 5).map((lead) => (
                      <tr key={lead.id}>
                        <td>
                          <div className="name-cell">
                            <div className="avatar">{lead.fullName?.charAt(0) || lead.firstName?.charAt(0) || '?'}</div>
                            <span>{lead.fullName || `${lead.firstName || ''} ${lead.lastName || ''}`.trim() || 'Unknown'}</span>
                          </div>
                        </td>
                        <td>
                          <div className="contact-info">
                            <div>{lead.phone}</div>
                            <div className="email">{lead.email}</div>
                          </div>
                        </td>
                        <td>
                          <span 
                            className="status-badge"
                            style={{ backgroundColor: getStatusColor(getLeadStatus(lead)) }}
                          >
                            {getLeadStatus(lead).charAt(0).toUpperCase() + getLeadStatus(lead).slice(1)}
                          </span>
                        </td>
                        <td>{getTimeAgo(lead.lastCallTime || lead.lastResponseTime || lead.updatedAt || lead.createdAt)}</td>
                        <td>
                          {lead.nextCallTime ? (
                            <span className="next-action">Call scheduled</span>
                          ) : (
                            <span className="next-action">Follow up</span>
                          )}
                        </td>
                        <td>
                          <button
                            className="action-btn view-btn"
                            onClick={() => openCallModal(lead.id)}
                            title="View lead details"
                          >
                            <Eye size={16} />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Recent Incoming Calls */}
            <div className="activity-section">
              <div className="section-header">
                <h3>Recent Incoming Calls</h3>
                <button className="view-all-btn" onClick={() => navigate('/calls')}>View All</button>
              </div>
              
              <div className="activity-table-container">
                <table className="activity-table">
                  <thead>
                    <tr>
                      <th>Caller</th>
                      <th>Phone Number</th>
                      <th>Call Status</th>
                      <th>Time</th>
                      <th>Lead Match</th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {incomingCalls.slice(0, 5).map((call) => {
                      const associatedLead = findLeadByPhone(call.from);
                      return (
                        <tr key={call.id}>
                          <td>
                            <div className="name-cell">
                              <div className="avatar">
                                <PhoneIncoming size={16} />
                              </div>
                              <span>
                                {associatedLead ? 
                                  (associatedLead.fullName || associatedLead.firstName || 'Unknown Lead') : 
                                  'Unknown Caller'
                                }
                              </span>
                            </div>
                          </td>
                          <td>
                            <div className="contact-info">
                              <div>{call.from}</div>
                              <div className="email">→ {call.to}</div>
                            </div>
                          </td>
                          <td>
                            <span 
                              className={`status-badge ${call.callStatus?.toLowerCase() || 'unknown'}`}
                              style={{ 
                                backgroundColor: call.callStatus === 'completed' ? '#10b981' : 
                                                call.callStatus === 'ringing' ? '#ef4444' : 
                                                call.callStatus === 'no-answer' ? '#ef4444' : '#64748b'
                              }}
                            >
                              {call.callStatus === 'ringing' ? 'Missed Call' : 
                               call.callStatus === 'completed' ? 'Answered' :
                               call.callStatus === 'no-answer' ? 'No Answer' :
                               call.callStatus || 'Unknown'}
                            </span>
                          </td>
                          <td>{getTimeAgo(call.timestamp)}</td>
                          <td>
                            {associatedLead ? (
                              <span className="lead-match">
                                {associatedLead.fullName || associatedLead.firstName || 'Matched Lead'}
                              </span>
                            ) : (
                              <span className="no-lead-match">No Match</span>
                            )}
                          </td>
                          <td>
                            {associatedLead ? (
                              <button
                                className="action-btn view-btn"
                                onClick={() => openCallModal(associatedLead.id)}
                                title="View lead details"
                              >
                                <Eye size={16} />
                              </button>
                            ) : (
                              <button
                                className="action-btn disabled"
                                disabled
                                title="No associated lead"
                              >
                                <Eye size={16} />
                              </button>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Recent Messages */}
            <div className="activity-section">
              <div className="section-header">
                <h3>Recent Messages</h3>
                <button className="view-all-btn" onClick={() => navigate('/messages')}>View All</button>
              </div>
              
              <div className="activity-table-container">
                <table className="activity-table">
                  <thead>
                    <tr>
                      <th>Contact</th>
                      <th>Lead</th>
                      <th>Message</th>
                      <th>Direction</th>
                      <th>Time</th>
                      <th>Status</th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {messages.slice(0, 5).map((message) => {
                      const phoneNumber = message.to || message.from;
                      const associatedLead = findLeadByPhone(phoneNumber);
                      return (
                        <tr key={message.id}>
                          <td>{phoneNumber}</td>
                          <td>
                            {associatedLead ? (
                              <span>{associatedLead.fullName || associatedLead.firstName || 'Unknown'}</span>
                            ) : (
                              <span className="no-lead-info">Unknown Lead</span>
                            )}
                          </td>
                          <td className="message-preview">
                            {message.body?.substring(0, 50)}{message.body?.length > 50 ? '...' : ''}
                          </td>
                          <td>
                            <span className={`direction-badge ${message.direction}`}>
                              {message.direction === 'outgoing' ? <PhoneOutgoing size={14} /> : <PhoneIncoming size={14} />}
                              {message.direction}
                            </span>
                          </td>
                          <td>{getTimeAgo(message.timestamp)}</td>
                          <td>
                            <span className={`status-badge ${message.status || 'delivered'}`}>
                              {message.status || 'delivered'}
                            </span>
                          </td>
                          <td>
                            {associatedLead && (
                              <button
                                className="action-btn view-btn"
                                onClick={() => openCallModal(associatedLead.id)}
                                title="View lead details"
                              >
                                <Eye size={16} />
                              </button>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
          
          {/* Call Modal */}
          {showCallModal && selectedLeadId && (
            <CallModal 
              leadId={selectedLeadId} 
              onClose={closeCallModal} 
              onUpdate={handleModalUpdate}
            />
          )}
        </>
      )}
    </div>
  );
};

export default Dashboard;