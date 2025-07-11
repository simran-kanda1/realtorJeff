import React, { useState, useEffect } from 'react';
import { 
  collection, 
  query, 
  orderBy, 
  getDocs,
  where,
  Timestamp,
  doc,
  updateDoc
} from 'firebase/firestore';
import { db } from '../../firebase';
import { 
  Phone, 
  Mail, 
  MessageSquare, 
  Calendar, 
  Clock, 
  User, 
  Search,
  Filter,
  Eye,
  Edit3,
  PhoneCall,
  Send,
  MoreVertical,
  CheckCircle,
  XCircle,
  AlertCircle,
  RefreshCw,
  Download,
  Plus
} from 'lucide-react';
import CallModal from '../CallModal/CallModal';
import './Leads.css';

const Leads = () => {
  const [leads, setLeads] = useState([]);
  const [filteredLeads, setFilteredLeads] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [sortBy, setSortBy] = useState('createdAt');
  const [sortOrder, setSortOrder] = useState('desc');
  const [selectedLead, setSelectedLead] = useState(null);
  const [showCallModal, setShowCallModal] = useState(false);
  const [actionMenuOpen, setActionMenuOpen] = useState(null);

  // Fetch all leads
  useEffect(() => {
    fetchLeads();
  }, []);

  // Filter and sort leads
  useEffect(() => {
    let filtered = [...leads];

    // Apply search filter
    if (searchTerm) {
      filtered = filtered.filter(lead => 
        (lead.fullName && lead.fullName.toLowerCase().includes(searchTerm.toLowerCase())) ||
        (lead.firstName && lead.firstName.toLowerCase().includes(searchTerm.toLowerCase())) ||
        (lead.lastName && lead.lastName.toLowerCase().includes(searchTerm.toLowerCase())) ||
        (lead.name && lead.name.toLowerCase().includes(searchTerm.toLowerCase())) ||
        (lead.phone && lead.phone.includes(searchTerm)) ||
        (lead.email && lead.email.toLowerCase().includes(searchTerm.toLowerCase()))
      );
    }

    // Apply status filter
    if (statusFilter !== 'all') {
      filtered = filtered.filter(lead => getLeadStatus(lead) === statusFilter);
    }

    // Apply sorting
    filtered.sort((a, b) => {
      let aValue = a[sortBy];
      let bValue = b[sortBy];

      // Handle timestamp sorting
      if (sortBy === 'createdAt' || sortBy === 'updatedAt') {
        aValue = aValue?.seconds || 0;
        bValue = bValue?.seconds || 0;
      }

      // Handle string sorting
      if (typeof aValue === 'string') {
        aValue = aValue.toLowerCase();
        bValue = bValue?.toLowerCase() || '';
      }

      if (sortOrder === 'asc') {
        return aValue > bValue ? 1 : -1;
      } else {
        return aValue < bValue ? 1 : -1;
      }
    });

    setFilteredLeads(filtered);
  }, [leads, searchTerm, statusFilter, sortBy, sortOrder]);

  const fetchLeads = async () => {
    try {
      setLoading(true);
      
      const leadsRef = collection(db, 'leads');
      const leadsQuery = query(leadsRef, orderBy('createdAt', 'desc'));
      const snapshot = await getDocs(leadsQuery);
      
      const leadsData = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      
      setLeads(leadsData);
    } catch (error) {
      console.error('Error fetching leads:', error);
      // Fallback: try without orderBy in case index doesn't exist
      try {
        const leadsRef = collection(db, 'leads');
        const snapshot = await getDocs(leadsRef);
        const leadsData = snapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        }));
        setLeads(leadsData);
      } catch (fallbackError) {
        console.error('Fallback error fetching leads:', fallbackError);
      }
    } finally {
      setLoading(false);
    }
  };

  const getLeadStatus = (lead) => {
    if (!lead) return 'new';
    const now = new Date();
    const createdAt = lead.createdAt?.seconds ? new Date(lead.createdAt.seconds * 1000) : new Date(lead.createdAt);
    const daysSinceCreated = Math.floor((now - createdAt) / (1000 * 60 * 60 * 24));

    return lead.displayStatus || 'dormant';
  };

  const getDaysIntoOutreach = (lead) => {
    if (!lead?.initialContactTime) return 0;
    const start = new Date(lead.initialContactTime.seconds * 1000);
    const now = new Date();
    return Math.floor((now - start) / (1000 * 60 * 60 * 24));
  };
  
  const hasContactBeenMade = (lead) => {
    if (getLeadStatus(lead) === 'answered'){
      return 'Yes'
    }
    if (getLeadStatus(lead) === 'responded_sms'){
      return 'Yes'
    }
    return 'No';
  };
  
  const getLastOutreachStep = (lead) => {
    return lead.lastOutreachType || "initial";
  };
  

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

  const getStatusIcon = (status) => {
    switch (status) {
      case 'new': return User;
      case 'contacted': return PhoneCall;
      case 'responded': return CheckCircle;
      case 'scheduled': return Calendar;
      case 'dormant': return XCircle;
      default: return AlertCircle;
    }
  };

  const formatTimestamp = (timestamp) => {
    if (!timestamp) return 'N/A';
    const date = timestamp.seconds ? new Date(timestamp.seconds * 1000) : new Date(timestamp);
    return date.toLocaleDateString() + ' ' + date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
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

  const getLeadName = (lead) => {
    return lead.fullName || lead.name || `${lead.firstName || ''} ${lead.lastName || ''}`.trim() || 'Unknown Lead';
  };

  const handleLeadClick = (lead) => {
    setSelectedLead(lead);
    document.body.classList.add('modal-open');
    setShowCallModal(true);
  };  

  const handleCallModalClose = () => {
    document.body.classList.remove('modal-open');
    setShowCallModal(false);
    setSelectedLead(null);
    // Refresh leads after modal closes
    fetchLeads();
  };

  const handleQuickAction = async (action, lead) => {
    setActionMenuOpen(null);
    
    switch (action) {
      case 'call':
        setSelectedLead(lead);
        setShowCallModal(true);
        break;
      case 'message':
        setSelectedLead(lead);
        setShowCallModal(true);
        break;
      case 'schedule':
        await handleScheduleCall(lead);
        break;
      case 'mark_contacted':
        await updateLeadStatus(lead.id, 'contacted');
        break;
    }
  };

  const handleScheduleCall = async (lead) => {
    try {
      const nextCallTime = new Date();
      nextCallTime.setDate(nextCallTime.getDate() + 1);
      nextCallTime.setHours(10, 0, 0, 0);
      
      const leadRef = doc(db, 'leads', lead.id);
      await updateDoc(leadRef, {
        nextCallTime: Timestamp.fromDate(nextCallTime),
        status: 'scheduled'
      });
      
      fetchLeads();
    } catch (error) {
      console.error('Error scheduling call:', error);
    }
  };

  const updateLeadStatus = async (leadId, status) => {
    try {
      const leadRef = doc(db, 'leads', leadId);
      await updateDoc(leadRef, {
        status: status,
        updatedAt: Timestamp.now()
      });
      
      fetchLeads();
    } catch (error) {
      console.error('Error updating lead status:', error);
    }
  };

  const exportLeads = () => {
    const csvContent = [
      ['Name', 'Phone', 'Email', 'Status', 'Form Type', 'Call Attempts', 'Created', 'Last Activity'].join(','),
      ...filteredLeads.map(lead => [
        getLeadName(lead),
        lead.phone || '',
        lead.email || '',
        getLeadStatus(lead),
        lead.formType || '',
        lead.callAttempts || 0,
        formatTimestamp(lead.createdAt),
        formatTimestamp(lead.updatedAt || lead.lastActivity)
      ].join(','))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `leads-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    window.URL.revokeObjectURL(url);
  };

  if (loading) {
    return (
      <div className="leads-container">
        <div className="loading-spinner">
          <RefreshCw className="spin" size={24} />
          Loading leads...
        </div>
      </div>
    );
  }

  return (
    <div className="leads-container">
      <div className="leads-header">
        <div className="header-left">
          <h1>Leads</h1>
          <span className="leads-count">{filteredLeads.length} of {leads.length} leads</span>
        </div>
        <div className="header-actions">
          <button className="action-btn secondary" onClick={exportLeads}>
            <Download size={18} />
            Export
          </button>
          <button className="action-btn secondary" onClick={fetchLeads}>
            <RefreshCw size={18} />
            Refresh
          </button>
          <button className="action-btn primary">
            <Plus size={18} />
            Add Lead
          </button>
        </div>
      </div>

      <div className="leads-filters">
        <div className="search-bar">
          <Search size={20} />
          <input
            type="text"
            placeholder="Search leads by name, phone, or email..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
        
        <div className="filters">
          <select 
            value={statusFilter} 
            onChange={(e) => setStatusFilter(e.target.value)}
            className="filter-select"
          >
            <option value="all">All Statuses</option>
            <option value="new">New</option>
            <option value="contacted">Contacted</option>
            <option value="responded">Responded</option>
            <option value="scheduled">Scheduled</option>
            <option value="dormant">Dormant</option>
          </select>

          <select 
            value={sortBy} 
            onChange={(e) => setSortBy(e.target.value)}
            className="filter-select"
          >
            <option value="createdAt">Created Date</option>
            <option value="updatedAt">Last Updated</option>
            <option value="fullName">Name</option>
            <option value="callAttempts">Call Attempts</option>
          </select>

          <button 
            className="sort-order-btn"
            onClick={() => setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')}
          >
            {sortOrder === 'asc' ? '↑' : '↓'}
          </button>
        </div>
      </div>

      <div className="leads-table-container">
        <table className="leads-table">
          <thead>
            <tr>
              <th>Lead</th>
              <th>Contact</th>
              <th>Status</th>
              <th>Days In Outreach</th>
              <th>Contact Made?</th>
              <th>Last Step</th>
              <th>Form Type</th>
              <th>Calls</th>
              <th>Created</th>
              <th>Last Activity</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {filteredLeads.map(lead => {
              const status = getLeadStatus(lead);
              const StatusIcon = getStatusIcon(status);
              
              return (
                <tr key={lead.id} className="lead-row" onClick={() => handleLeadClick(lead)}>
                  <td className="lead-info">
                    <div className="lead-avatar">
                      {getLeadName(lead).charAt(0).toUpperCase()}
                    </div>
                    <div className="lead-details">
                      <div className="lead-name">{getLeadName(lead)}</div>
                      <div className="lead-id">ID: {lead.id.slice(-8)}</div>
                    </div>
                  </td>
                  
                  <td className="contact">
                    <div className="contact-item">
                      <Phone size={14} />
                      {lead.phone || 'N/A'}
                    </div>
                    <div className="contact-item">
                      <Mail size={14} />
                      {lead.email || 'N/A'}
                    </div>
                  </td>
                  
                  <td className="status-cell">
                    <div 
                      className="status-badge"
                      style={{ backgroundColor: getStatusColor(status) }}
                    >
                      <StatusIcon size={14} />
                      {status.charAt(0).toUpperCase() + status.slice(1)}
                    </div>
                  </td>

                  <td>{getDaysIntoOutreach(lead)}</td>
                  <td>{hasContactBeenMade(lead)}</td>
                  <td>{getLastOutreachStep(lead)}</td>

                  
                  <td className="form-type">
                    {lead.formType || 'N/A'}
                  </td>
                  
                  <td className="call-attempts">
                    <div className="attempts-badge">
                      {lead.callAttempts || 0}
                    </div>
                  </td>
                  
                  <td className="created-date">
                    <div className="date-info">
                      <div className="date">{formatTimestamp(lead.createdAt).split(' ')[0]}</div>
                      <div className="time-ago">{getTimeAgo(lead.createdAt)}</div>
                    </div>
                  </td>
                  
                  <td className="last-activity">
                    <div className="date-info">
                      <div className="date">
                        {formatTimestamp(lead.updatedAt || lead.lastActivity).split(' ')[0]}
                      </div>
                      <div className="time-ago">
                        {getTimeAgo(lead.updatedAt || lead.lastActivity)}
                      </div>
                    </div>
                  </td>
                  
                  <td className="actions-cell" onClick={(e) => e.stopPropagation()}>
                    <div className="actions-menu">
                      <button 
                        className="actions-trigger"
                        onClick={() => setActionMenuOpen(actionMenuOpen === lead.id ? null : lead.id)}
                      >
                        <MoreVertical size={16} />
                      </button>
                      
                      {actionMenuOpen === lead.id && (
                        <div className="actions-dropdown">
                          <button onClick={() => handleQuickAction('call', lead)}>
                            <PhoneCall size={14} />
                            Call
                          </button>
                          <button onClick={() => handleQuickAction('message', lead)}>
                            <MessageSquare size={14} />
                            Message
                          </button>
                          <button onClick={() => handleQuickAction('schedule', lead)}>
                            <Calendar size={14} />
                            Schedule
                          </button>
                          <button onClick={() => handleQuickAction('mark_contacted', lead)}>
                            <CheckCircle size={14} />
                            Mark Contacted
                          </button>
                        </div>
                      )}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>

        {filteredLeads.length === 0 && !loading && (
          <div className="no-leads">
            <User size={48} />
            <h3>No leads found</h3>
            <p>
              {searchTerm || statusFilter !== 'all' 
                ? 'Try adjusting your search or filters' 
                : 'Start by adding your first lead'
              }
            </p>
          </div>
        )}
      </div>

      {/* Call Modal */}
      {showCallModal && selectedLead && (
        <CallModal
          leadId={selectedLead.id}
          onClose={handleCallModalClose}
          onUpdate={fetchLeads}
        />
      )}
    </div>
  );
};

export default Leads;