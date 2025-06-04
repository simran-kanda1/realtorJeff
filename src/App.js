import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import Dashboard from './components/Dashboard/Dashboard';
import Sidebar from './components/Sidebar/Sidebar';
import LoginPage from './components/Login/Login';
import CallLogs from './components/CallLogs/CallLogs';
import AgentOverview from './components/AgentOverview/AgentOverview';
import Notifications from './components/Notifications/Notifications';
import Messages from './components/Messages/Messages';
import Leads from './components/Leads/Leads';
import './App.css';

// Protected route component
const ProtectedRoute = ({ children }) => {
  const isAuthenticated = localStorage.getItem('isAuthenticated') === 'true';
  
  if (!isAuthenticated) {
    return <Navigate to="/login" />;
  }
  
  return children;
};

function App() {
  return (
    <Router>
      <Routes>
        {/* Public route */}
        <Route path="/" element={<LoginPage />} />
        <Route path="/login" element={<LoginPage />} />
        
        <Route path="/dashboard" element={
          <ProtectedRoute>
            <div className="app-container">
              <Sidebar />
              <div className="content-container">
                <Dashboard />
              </div>
            </div>
          </ProtectedRoute>
        } />
        
        <Route path="/calls" element={
          <ProtectedRoute>
            <div className="app-container">
              <Sidebar />
              <div className="content-container">
                <CallLogs />
              </div>
            </div>
          </ProtectedRoute>
        } />

        <Route path="/leads" element={
          <ProtectedRoute>
            <div className="app-container">
              <Sidebar />
              <div className="content-container">
                <Leads />
              </div>
            </div>
          </ProtectedRoute>
        } />
        
        <Route path="/agent-overview" element={
          <ProtectedRoute>
            <div className="app-container">
              <Sidebar />
              <div className="content-container">
                <AgentOverview />
              </div>
            </div>
          </ProtectedRoute>
        } />

        <Route path="/messages" element={
          <ProtectedRoute>
            <div className="app-container">
              <Sidebar />
              <div className="content-container">
                <Messages />
              </div>
            </div>
          </ProtectedRoute>
        } />
        
        <Route path="/notifications" element={
          <ProtectedRoute>
            <div className="app-container">
              <Sidebar />
              <div className="content-container">
                <Notifications />
              </div>
            </div>
          </ProtectedRoute>
        } />
        
        {/* Redirect to login for any unmatched routes */}
        <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>
    </Router>
  );
}

export default App;