import React, { useState, useEffect } from 'react';
import { collection, getDocs, query, where, orderBy, Timestamp } from 'firebase/firestore';
import { db } from '../../firebase';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, LineChart, Line } from 'recharts';
import { Phone, Clock, AlertTriangle, CheckCircle, XCircle, Calendar, Activity } from 'lucide-react';
import './AgentOverview.css'; // You'll need to create this CSS file

const AgentOverview = () => {
  const [agentStats, setAgentStats] = useState({
    totalCalls: 0,
    completedCalls: 0,
    failedCalls: 0,
    averageCallDuration: 0,
    systemErrors: 0,
    callSuccessRate: 0,
  });
  const [callsByDay, setCallsByDay] = useState([]);
  const [callDurations, setCallDurations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [dateFilter, setDateFilter] = useState('month'); // 'week', 'month', 'year'

  useEffect(() => {
    const fetchAgentData = async () => {
      try {
        setLoading(true);
        
        // Get current date information for filtering
        const now = new Date();
        let startDate;
        
        if (dateFilter === 'week') {
          // Start of current week (Sunday)
          const day = now.getDay();
          startDate = new Date(now);
          startDate.setDate(now.getDate() - day);
          startDate.setHours(0, 0, 0, 0);
        } else if (dateFilter === 'month') {
          // Start of current month
          startDate = new Date(now.getFullYear(), now.getMonth(), 1);
        } else if (dateFilter === 'year') {
          // Start of current year
          startDate = new Date(now.getFullYear(), 0, 1);
        }
        
        const startTimestamp = Timestamp.fromDate(startDate);
        
        // Fetch calls from Firestore
        const leadsRef = collection(db, 'leads');
        const q = query(
          leadsRef,
          where('createdAt', '>=', startTimestamp),
          orderBy('createdAt', 'desc')
        );
        
        const querySnapshot = await getDocs(q);
        const callsData = [];
        
        let totalDuration = 0;
        let completedCount = 0;
        let failedCount = 0;
        let systemErrorCount = 0;
        
        // Process the data
        querySnapshot.forEach((doc) => {
          const data = { id: doc.id, ...doc.data() };
          callsData.push(data);
          
          // Count call status
          if (data.callStatus === 'completed') {
            completedCount++;
            if (data.callDuration) {
              totalDuration += data.callDuration;
            }
          } else if (data.callStatus === 'failed') {
            failedCount++;
          } else if (data.callStatus === 'error') {
            systemErrorCount++;
          }
        });
        
        // Calculate average call duration
        const averageDuration = completedCount > 0 ? Math.round(totalDuration / completedCount) : 0;
        
        // Calculate call success rate
        const totalCallAttempts = completedCount + failedCount + systemErrorCount;
        const successRate = totalCallAttempts > 0 ? Math.round((completedCount / totalCallAttempts) * 100) : 0;
        
        // Update state with calculated statistics
        setAgentStats({
          totalCalls: callsData.length,
          completedCalls: completedCount,
          failedCalls: failedCount,
          averageCallDuration: averageDuration,
          systemErrors: systemErrorCount,
          callSuccessRate: successRate,
        });
        
        // Process data for charts
        processChartData(callsData);
        
        setLoading(false);
      } catch (error) {
        console.error('Error fetching agent data:', error);
        setLoading(false);
      }
    };
    
    // Process the data for charts
    const processChartData = (calls) => {
      // Process calls by day
      const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
      const callsByDayCount = Array(7).fill(0);
      const completedByDay = Array(7).fill(0);
      const failedByDay = Array(7).fill(0);
      
      calls.forEach(call => {
        if (call.callTimestamp) {
          const date = call.callTimestamp.seconds ? 
            new Date(call.callTimestamp.seconds * 1000) : 
            new Date(call.callTimestamp);
          
          const dayIndex = date.getDay();
          callsByDayCount[dayIndex]++;
          
          if (call.callStatus === 'completed') {
            completedByDay[dayIndex]++;
          } else if (call.callStatus === 'failed' || call.callStatus === 'error') {
            failedByDay[dayIndex]++;
          }
        }
      });
      
      const callsByDayData = days.map((day, index) => ({
        day,
        total: callsByDayCount[index],
        completed: completedByDay[index],
        failed: failedByDay[index],
      }));
      
      setCallsByDay(callsByDayData);
      
      // Process call durations for the line chart
      const durationData = [];
      const sortedCalls = [...calls].sort((a, b) => {
        const dateA = a.callTimestamp?.seconds ? new Date(a.callTimestamp.seconds * 1000) : new Date(a.callTimestamp);
        const dateB = b.callTimestamp?.seconds ? new Date(b.callTimestamp.seconds * 1000) : new Date(b.callTimestamp);
        return dateA - dateB;
      });
      
      sortedCalls.forEach((call, index) => {
        if (call.callStatus === 'completed' && call.callDuration) {
          const date = call.callTimestamp?.seconds ? 
            new Date(call.callTimestamp.seconds * 1000) : 
            new Date(call.callTimestamp);
          
          durationData.push({
            id: index,
            date: date.toLocaleDateString(),
            duration: Math.round(call.callDuration / 60), // Convert seconds to minutes
          });
        }
      });
      
      setCallDurations(durationData);
    };
    
    fetchAgentData();
  }, [dateFilter]);
  
  // Function to format seconds into minutes:seconds
  const formatDuration = (seconds) => {
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes}:${String(remainingSeconds).padStart(2, '0')}`;
  };
  
  return (
    <div className="agent-overview">
      <div className="dashboard-header">
        <h1>AI Agent Overview</h1>
        
        <div className="date-filter">
          <button 
            className={dateFilter === 'week' ? 'active' : ''} 
            onClick={() => setDateFilter('week')}
          >
            This Week
          </button>
          <button 
            className={dateFilter === 'month' ? 'active' : ''} 
            onClick={() => setDateFilter('month')}
          >
            This Month
          </button>
          <button 
            className={dateFilter === 'year' ? 'active' : ''} 
            onClick={() => setDateFilter('year')}
          >
            This Year
          </button>
        </div>
      </div>
      
      {loading ? (
        <div className="loading-spinner">
          <p>Loading...</p>
        </div>
      ) : (
        <>
          <div className="stat-cards">
            <div className="stat-card">
              <div className="stat-icon">
                <Phone size={24} />
              </div>
              <div className="stat-content">
                <h3>Total Calls</h3>
                <p>{agentStats.totalCalls}</p>
              </div>
            </div>
            
            <div className="stat-card">
              <div className="stat-icon success">
                <CheckCircle size={24} />
              </div>
              <div className="stat-content">
                <h3>Completed Calls</h3>
                <p>{agentStats.completedCalls}</p>
              </div>
            </div>
            
            <div className="stat-card">
              <div className="stat-icon error">
                <XCircle size={24} />
              </div>
              <div className="stat-content">
                <h3>Failed Calls</h3>
                <p>{agentStats.failedCalls}</p>
              </div>
            </div>
            
            <div className="stat-card">
              <div className="stat-icon">
                <Clock size={24} />
              </div>
              <div className="stat-content">
                <h3>Avg. Call Duration</h3>
                <p>{formatDuration(agentStats.averageCallDuration)}</p>
              </div>
            </div>
            
            <div className="stat-card">
              <div className="stat-icon error">
                <AlertTriangle size={24} />
              </div>
              <div className="stat-content">
                <h3>System Errors</h3>
                <p>{agentStats.systemErrors}</p>
              </div>
            </div>
            
            <div className="stat-card">
              <div className="stat-icon">
                <Activity size={24} />
              </div>
              <div className="stat-content">
                <h3>Success Rate</h3>
                <p>{agentStats.callSuccessRate}%</p>
              </div>
            </div>
          </div>
          
          <div className="dashboard-charts">
            <div className="chart-container">
              <h3>Number of Calls by Day of Week</h3>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={callsByDay}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="day" />
                  <YAxis />
                  <Tooltip />
                  <Legend />
                  <Bar dataKey="completed" name="Completed" fill="#10b981" />
                  <Bar dataKey="failed" name="Failed" fill="#ef4444" />
                </BarChart>
              </ResponsiveContainer>
            </div>
            
            <div className="chart-container">
              <h3>Average Call Length By Day</h3>
              <ResponsiveContainer width="100%" height={300}>
                <LineChart data={callDurations}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="date" />
                  <YAxis label={{ value: 'Minutes', angle: -90, position: 'insideLeft' }} />
                  <Tooltip />
                  <Legend />
                  <Line type="monotone" dataKey="duration" name="Call Duration (min)" stroke="#3b82f6" />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>
        </>
      )}
    </div>
  );
};

export default AgentOverview;