import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import './Login.css';

const LoginPage = () => {
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [rememberMe, setRememberMe] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  // Hardcoded credentials
  const validCredentials = {
    email: 'alex@brantfordhomes.com',
    password: 'Simvana123'
  };

  const handleLogin = (e) => {
    e.preventDefault();
    setIsLoading(true);
    setError('');
    
    // Check against hardcoded credentials
    if (email === validCredentials.email && password === validCredentials.password) {
      setTimeout(() => {
        setIsLoading(false);
        // Store authentication state in localStorage
        localStorage.setItem('isAuthenticated', 'true');
        if (rememberMe) {
          localStorage.setItem('userEmail', email);
        }
        navigate('/dashboard');
      }, 1000);
    } else {
      setTimeout(() => {
        setIsLoading(false);
        setError('Invalid email or password');
      }, 1000);
    }
  };

  return (
    <div className="login-container">
      <div className="login-content">
        <div className="login-left">
          <div className="login-header">
            <div className="logo">
              <span className="logo-text">SIMVANA Voice</span>
              <span className="logo-accent">AI</span>
            </div>
            <h1>Welcome back</h1>
          </div>
          
          <form onSubmit={handleLogin} className="login-form">
            {error && <div className="error-message">{error}</div>}
            
            <div className="form-group">
              <label htmlFor="email">Email</label>
              <input
                type="email"
                id="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="youremail@example.com"
                required
              />
            </div>
            
            <div className="form-group">
              <label htmlFor="password">Password</label>
              <input
                type="password"
                id="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                required
              />
            </div>
            
            <div className="form-options">
              <div className="remember-me">
                <input
                  type="checkbox"
                  id="rememberMe"
                  checked={rememberMe}
                  onChange={() => setRememberMe(!rememberMe)}
                />
                <label htmlFor="rememberMe">Remember me</label>
              </div>
            </div>
            
            <button 
              type="submit" 
              className="login-button"
              disabled={isLoading}
            >
              {isLoading ? 'Logging in...' : 'Log in'}
            </button>
          </form>
        </div>
        
        <div className="login-right">
          <div className="login-illustration">
            <h2>Your gateway to effective customer service</h2>
            <div className="illustration-content">
              <div className="feature-item">
                <div className="feature-icon">📊</div>
                <div className="feature-text">Real-time analytics and insights</div>
              </div>
              <div className="feature-item">
                <div className="feature-icon">🔍</div>
                <div className="feature-text">AI-powered call analysis</div>
              </div>
              <div className="feature-item">
                <div className="feature-icon">📱</div>
                <div className="feature-text">Seamless integration with your workflow</div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default LoginPage;