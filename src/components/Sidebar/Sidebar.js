import React from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { LayoutDashboard, Phone, AlertTriangle, FilesIcon, Activity, Settings, LogOut, Home, MessageCircle } from 'lucide-react';
import './Sidebar.css';

const Sidebar = () => {

  const navigate = useNavigate();
  
  const handleLogout = () => {
    // Clear authentication state
    localStorage.removeItem('isAuthenticated');
    // Navigate to login page
    navigate('/');
  };

  return (
    <div className="sidebar">
      <div className="sidebar-header">
        <Home size={20} />
        <h2>Jeff Thibodeau</h2>
      </div>
      <nav className="sidebar-nav">
        <NavLink to="/dashboard" className={({ isActive }) => isActive ? 'nav-item active' : 'nav-item'}>
          <LayoutDashboard size={20} />
          <span>Dashboard</span>
        </NavLink>
        <NavLink to="/calls" className={({ isActive }) => isActive ? 'nav-item active' : 'nav-item'}>
          <Phone size={20} />
          <span>Call Logs</span>
        </NavLink>
        <NavLink to="/leads" className={({ isActive }) => isActive ? 'nav-item active' : 'nav-item'}>
          <FilesIcon size={20} />
          <span>Leads Logs</span>
        </NavLink>
        <NavLink to="/messages" className={({ isActive }) => isActive ? 'nav-item active' : 'nav-item'}>
          <MessageCircle size={20} />
          <span>Messages</span>
        </NavLink>
      </nav>
      <div className="sidebar-footer">
        <NavLink to="/notifications" className="nav-item">
          <AlertTriangle size={20} />
          <span>Notifications</span>
        </NavLink>
        <button className="nav-item logout" onClick={handleLogout}>
          <LogOut size={20} />
          <span>Logout</span>
        </button>
      </div>
    </div>
  );
};

export default Sidebar;