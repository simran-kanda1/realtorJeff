import React from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { Menu } from 'lucide-react';
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

  const toggleSidebar = () => {
    document.querySelector('.sidebar').classList.toggle('open');
  };

  const closeSidebar = () => {
    document.querySelector('.sidebar').classList.remove('open');
  };  
  

  return (
    <>
    <button className="sidebar-toggle" onClick={toggleSidebar}>
      <Menu size={20} />
    </button>

    <div className="sidebar">
      <div className="sidebar-header">
        <Home size={20} />
        <h2>Jeff Thibodeau</h2>
      </div>
      <nav className="sidebar-nav">
        <NavLink to="/dashboard" className={({ isActive }) => isActive ? 'nav-item active' : 'nav-item'} onClick={closeSidebar}>
          <LayoutDashboard size={20} />
          <span>Dashboard</span>
        </NavLink>
        <NavLink to="/calls" className={({ isActive }) => isActive ? 'nav-item active' : 'nav-item'} onClick={closeSidebar}>
          <Phone size={20} />
          <span>Call Logs</span>
        </NavLink>
        <NavLink to="/leads" className={({ isActive }) => isActive ? 'nav-item active' : 'nav-item'} onClick={closeSidebar}>
          <FilesIcon size={20} />
          <span>Leads Logs</span>
        </NavLink>
        <NavLink to="/messages" className={({ isActive }) => isActive ? 'nav-item active' : 'nav-item'} onClick={closeSidebar}>
          <MessageCircle size={20} />
          <span>Messages</span>
        </NavLink>
      </nav>
      <div className="sidebar-footer">
        <NavLink to="/notifications" className="nav-item" onClick={closeSidebar}>
          <AlertTriangle size={20} />
          <span>Notifications</span>
        </NavLink>
        <button className="nav-item logout" onClick={handleLogout}>
          <LogOut size={20} />
          <span>Logout</span>
        </button>
      </div>
    </div>
    </>
  );
};

export default Sidebar;