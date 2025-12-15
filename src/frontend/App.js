import React, { useState, useEffect } from 'react';
import {
  LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer
} from 'recharts';
import {
  AlertTriangle, CheckCircle, Smartphone, LayoutDashboard, Heart, Activity, Watch,
  User, PenTool, ArrowRight, Database // Added new icons from File 2
} from 'lucide-react';

import "./index.css"

const API_URL = process.env.REACT_APP_API_URL || "http://localhost:8000";

// --- WORKER COMPONENT ---
const WorkerMobileView = () => {
  // 1. Integrated State for User ID & Mode from File 2
  const [userId, setUserId] = useState('ed1b8099-4373-49ef-9ec9-4cdb57248727');
  const [tempUserId, setTempUserId] = useState('ed1b8099-4373-49ef-9ec9-4cdb57248727');
  const [isEditingUser, setIsEditingUser] = useState(false);
  const [mode, setMode] = useState('predict'); // 'predict' or 'train'
  const [notification, setNotification] = useState(null);

  const [wearableStatus, setWearableStatus] = useState({ heart_rate: 0, steps: 0 });
  const [lastStatus, setLastStatus] = useState({ score: 0, status: 'N/A' });

  // Load form data (Updated to include cognitive_score for training mode)
  const [formData, setFormData] = useState(() => {
    const saved = localStorage.getItem('workerFormData');
    const defaults = {
      sleep_duration: 7.5,
      stress_level: 5,
      screen_time: 4.0,
      exercise_frequency: 'Moderate',
      caffeine_intake: 100,
      reaction_time: 250,
      memory_test_score: 85,
      cognitive_score: 80 // Integrated from File 2
    };
    if (saved) {
      try {
        return { ...defaults, ...JSON.parse(saved) };
      } catch (e) {
        return defaults;
      }
    }
    return defaults;
  });

  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);

  // Poll for wearable data
  useEffect(() => {
    const fetchWearable = async () => {
      try {
        const res = await fetch(`${API_URL}/api/worker/${userId}/status`);
        const data = await res.json();
        setWearableStatus({ heart_rate: data.last_heart_rate, steps: data.last_steps });
      } catch (e) { console.log("Sync error"); }
    };
    fetchWearable();
    const interval = setInterval(fetchWearable, 5000);
    return () => clearInterval(interval);
  }, [userId]);

  // Fetch last status
  useEffect(() => {
    const fetchLastStatus = async () => {
      try {
        const res = await fetch(`${API_URL}/api/dashboard/stats`);
        const data = await res.json();
        if (data?.recent_checks?.length > 0) {
          const lastCheck = data.recent_checks[0];
          setLastStatus({ score: lastCheck.score || 0, status: lastCheck.status || 'N/A' });
        }
      } catch (e) { console.log("Status fetch error"); }
    };
    fetchLastStatus();
    const interval = setInterval(fetchLastStatus, 5000);
    return () => clearInterval(interval);
  }, []);

  // Integrated: Handle User ID Change
  const handleUserSubmit = () => {
    if (tempUserId.trim() !== "") {
      setUserId(tempUserId);
      setIsEditingUser(false);
      setNotification({ type: 'success', msg: `Switched user to: ${tempUserId}` });
      setTimeout(() => setNotification(null), 3000);
    }
  };

  // Integrated: Handle Submit (Handles both Predict and Train endpoints)
  const handleSubmit = async () => {
    setLoading(true);
    setNotification(null);
    setResult(null);

    const endpoint = mode === 'predict' ? '/api/predict' : '/api/submit_training_data';

    // Map snake_case state to Capitalized Keys for the Backend (from File 2 logic)
    const payload = {
      user_id: userId,
      sleep_duration: formData.sleep_duration,
      stress_level: formData.stress_level,
      
      // The Backend strictly requires these Capitalized keys (Aliases)
      Screen_Time: formData.screen_time,             
      Exercise_Frequency: formData.exercise_frequency,
      Caffeine_Intake: formData.caffeine_intake,
      Reaction_Time: formData.reaction_time,
      Memory_Test_Score: formData.memory_test_score,

      // Only include this if we are in training mode
      ...(mode === 'train' && { cognitive_score: formData.cognitive_score })
    };

    try {
      localStorage.setItem('workerFormData', JSON.stringify(formData));

      const res = await fetch(`${API_URL}${endpoint}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const data = await res.json();

      if (!res.ok) {
          const errorMessage = Array.isArray(data.detail) 
            ? `${data.detail[0].loc[1]}: ${data.detail[0].msg}` 
            : (data.detail || "Server Error");
          throw new Error(errorMessage);
      }

      if (mode === 'predict') {
        setResult(data); 
      } else {
        setNotification({
          type: 'success',
          msg: `Training data saved to S3: ${data.s3_path}`
        });
      }
    } catch (err) {
      setNotification({ type: 'error', msg: err.message || "Connection failed" });
    }
    setLoading(false);
  };

  // Calculate slider progress for styling
  const sleepProgress = ((formData.sleep_duration / 24) * 100);
  const stressProgress = ((formData.stress_level / 10) * 100);

  return (
    <div style={{ minHeight: '100vh', backgroundColor: 'var(--color-gray-50)', fontFamily: 'var(--font-sans)' }}>
      
      {/* Integrated Header from File 2 (Mode Switcher + User ID) */}
      <div style={{
        backgroundColor: 'var(--color-primary-black)',
        padding: '24px',
        borderBottomLeftRadius: '24px',
        borderBottomRightRadius: '24px',
        boxShadow: 'var(--shadow-md)',
        color: 'white'
      }}>
        {/* Top Row: Title + Mode Toggle */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
          <h1 style={{ fontSize: '20px', fontWeight: '700', margin: 0 }}>CPMS Worker</h1>
          
          {/* Mode Switcher */}
          <div style={{ 
            backgroundColor: 'rgba(255,255,255,0.1)', 
            borderRadius: '8px', 
            padding: '4px', 
            display: 'flex', 
            gap: '4px' 
          }}>
            <button 
              onClick={() => setMode('predict')}
              style={{
                backgroundColor: mode === 'predict' ? 'var(--color-white)' : 'transparent',
                color: mode === 'predict' ? 'var(--color-primary-black)' : 'var(--color-gray-400)',
                border: 'none', padding: '6px 12px', borderRadius: '6px', fontSize: '12px', fontWeight: '600', cursor: 'pointer', transition: 'all 0.2s'
              }}>
              Predict
            </button>
            <button 
              onClick={() => setMode('train')}
              style={{
                backgroundColor: mode === 'train' ? 'var(--color-purple-500)' : 'transparent',
                color: mode === 'train' ? 'white' : 'var(--color-gray-400)',
                border: 'none', padding: '6px 12px', borderRadius: '6px', fontSize: '12px', fontWeight: '600', cursor: 'pointer', transition: 'all 0.2s'
              }}>
              Train
            </button>
          </div>
        </div>

        {/* Bottom Row: User ID Input */}
        <div style={{ 
            backgroundColor: 'rgba(255,255,255,0.1)', 
            borderRadius: '12px', 
            padding: '12px', 
            display: 'flex', 
            alignItems: 'center',
            gap: '12px',
            border: isEditingUser ? '1px solid var(--color-purple-400)' : '1px solid transparent',
            transition: 'border 0.2s'
        }}>
            <User size={20} color="var(--color-gray-400)" />
            <div style={{ flex: 1 }}>
                <div style={{ fontSize: '10px', color: 'var(--color-gray-400)', textTransform: 'uppercase', fontWeight: 'bold', marginBottom: '4px' }}>
                  Worker ID
                </div>
                {isEditingUser ? (
                    <div style={{ display: 'flex', alignItems: 'center' }}>
                        <input 
                            autoFocus
                            value={tempUserId}
                            onChange={(e) => setTempUserId(e.target.value)}
                            onKeyDown={(e) => e.key === 'Enter' && handleUserSubmit()}
                            style={{ 
                                background: 'transparent', border: 'none', color: 'white', 
                                fontSize: '14px', fontFamily: 'monospace', width: '100%', outline: 'none' 
                            }}
                        />
                        <button onClick={handleUserSubmit} style={{ background: 'var(--color-purple-600)', border: 'none', borderRadius: '4px', padding: '4px', cursor: 'pointer', marginLeft: '8px' }}>
                            <ArrowRight size={14} color="white" />
                        </button>
                    </div>
                ) : (
                    <div 
                        onClick={() => setIsEditingUser(true)}
                        style={{ fontSize: '14px', color: 'white', fontFamily: 'monospace', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px' }}
                    >
                        {userId} <PenTool size={12} color="var(--color-gray-500)" />
                    </div>
                )}
            </div>
        </div>
      </div>

      {/* Integrated Notifications */}
      {notification && (
        <div style={{ 
            margin: '16px 24px 0', 
            padding: '16px', 
            borderRadius: '12px', 
            backgroundColor: notification.type === 'success' ? '#dcfce7' : '#fee2e2',
            color: notification.type === 'success' ? '#166534' : '#991b1b',
            fontSize: '14px', fontWeight: '600', textAlign: 'center',
            boxShadow: 'var(--shadow-sm)'
        }}>
            {notification.msg}
        </div>
      )}

      <div style={{ padding: '24px' }}>
        {!result ? (
          <div>
            {/* Score Cards (Hidden in Train Mode based on File 2 logic, or optional) */}
            {mode === 'predict' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginBottom: '24px' }}>
                <div style={{
                  backgroundColor: 'var(--color-white)',
                  borderRadius: '12px',
                  boxShadow: 'var(--shadow-sm)',
                  padding: '20px'
                }}>
                  <div style={{ fontSize: '14px', fontWeight: '600', color: 'var(--color-gray-800)', marginBottom: '8px' }}>
                    Work Readiness Score
                  </div>
                  <div style={{ fontSize: '32px', fontWeight: '700', color: lastStatus.score >= 50 ? 'var(--color-success)' : 'var(--color-danger)' }}>
                    {lastStatus.score}%
                  </div>
                </div>

                <div style={{
                  backgroundColor: 'var(--color-white)',
                  borderRadius: '12px',
                  boxShadow: 'var(--shadow-sm)',
                  padding: '20px'
                }}>
                  <div style={{ fontSize: '14px', fontWeight: '600', color: 'var(--color-gray-800)', marginBottom: '8px' }}>
                    Risk Level
                  </div>
                  <div style={{ fontSize: '28px', fontWeight: '700', color: lastStatus.status === 'Normal' ? 'var(--color-success)' : 'var(--color-danger)' }}>
                    {lastStatus.status}
                  </div>
                </div>
              </div>
            )}

            {/* Metric Cards - 2x2 Grid */}
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(2, 1fr)',
              gap: '12px',
              marginBottom: '24px'
            }}>
              <div style={{
                backgroundColor: 'var(--color-white)',
                borderRadius: '12px',
                boxShadow: 'var(--shadow-sm)',
                padding: '16px'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
                  <Watch size={16} style={{ color: 'var(--color-purple-600)' }} />
                  <span style={{ fontSize: '12px', fontWeight: '500', color: 'var(--color-gray-600)' }}>Sleep duration</span>
                </div>
                <div style={{ fontSize: '28px', fontWeight: '700', color: 'var(--color-gray-900)' }}>
                  {formData.sleep_duration}h
                </div>
              </div>

              <div style={{
                backgroundColor: 'var(--color-white)',
                borderRadius: '12px',
                boxShadow: 'var(--shadow-sm)',
                padding: '16px'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
                  <Activity size={16} style={{ color: 'var(--color-purple-600)' }} />
                  <span style={{ fontSize: '12px', fontWeight: '500', color: 'var(--color-gray-600)' }}>Stress level</span>
                </div>
                <div style={{ fontSize: '28px', fontWeight: '700', color: 'var(--color-gray-900)' }}>
                  {formData.stress_level}/10
                </div>
              </div>

              <div style={{
                backgroundColor: 'var(--color-white)',
                borderRadius: '12px',
                boxShadow: 'var(--shadow-sm)',
                padding: '16px'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
                  <Activity size={16} style={{ color: 'var(--color-purple-600)' }} />
                  <span style={{ fontSize: '12px', fontWeight: '500', color: 'var(--color-gray-600)' }}>Screen time</span>
                </div>
                <div style={{ fontSize: '28px', fontWeight: '700', color: 'var(--color-gray-900)' }}>
                  {formData.screen_time}h
                </div>
              </div>

              <div style={{
                backgroundColor: 'var(--color-white)',
                borderRadius: '12px',
                boxShadow: 'var(--shadow-sm)',
                padding: '16px'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
                  <Heart size={16} style={{ color: 'var(--color-purple-600)' }} />
                  <span style={{ fontSize: '12px', fontWeight: '500', color: 'var(--color-gray-600)' }}>Caffeine intake</span>
                </div>
                <div style={{ fontSize: '28px', fontWeight: '700', color: 'var(--color-gray-900)' }}>
                  {formData.caffeine_intake}ml
                </div>
              </div>
            </div>

            {/* Form Container with Mode-Specific styling */}
            <div style={{
              backgroundColor: 'var(--color-white)',
              borderRadius: '24px',
              border: mode === 'train' ? '2px solid var(--color-purple-500)' : '2px solid var(--color-purple-200)',
              padding: '32px 24px',
              position: 'relative',
              transition: 'border 0.3s'
            }}>
               {/* Mode Badge */}
               <div style={{ 
                  position: 'absolute', top: '-12px', left: '24px', 
                  backgroundColor: mode === 'train' ? 'var(--color-purple-500)' : 'var(--color-purple-200)', 
                  color: mode === 'train' ? 'white' : 'var(--color-purple-900)',
                  padding: '4px 12px', borderRadius: '12px', fontSize: '12px', fontWeight: 'bold', textTransform: 'uppercase',
                  transition: 'background-color 0.3s'
              }}>
                  {mode === 'train' ? 'Training Mode' : 'Readiness Form'}
              </div>

              <p style={{
                fontSize: '16px',
                color: 'var(--color-gray-800)',
                textAlign: 'center',
                marginBottom: '24px',
                marginTop: 0
              }}>
                {mode === 'train' ? "Enter ground truth data to train the model." : "Please fill out the form to request a readiness assessment"}
              </p>

              {/* Sleep Duration Slider */}
              <div style={{ marginBottom: '24px' }}>
                <label style={{ fontSize: '14px', fontWeight: '600', color: 'var(--color-gray-800)', display: 'block', marginBottom: '12px' }}>
                  Sleep duration (h):
                </label>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', color: 'var(--color-gray-500)', marginBottom: '8px' }}>
                  {[0, 4, 8, 12, 16, 20, 24].map(n => <span key={n}>{n}</span>)}
                </div>
                <input
                  type="range"
                  min="0"
                  max="24"
                  step="0.5"
                  className="figma-slider"
                  style={{ '--progress': `${sleepProgress}%` }}
                  value={formData.sleep_duration}
                  onChange={e => setFormData({ ...formData, sleep_duration: parseFloat(e.target.value) })}
                />
              </div>

              {/* Stress Level Slider */}
              <div style={{ marginBottom: '24px' }}>
                <label style={{ fontSize: '14px', fontWeight: '600', color: 'var(--color-gray-800)', display: 'block', marginBottom: '12px' }}>
                  Stress level:
                </label>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', color: 'var(--color-gray-500)', marginBottom: '8px' }}>
                  {[0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map(n => <span key={n}>{n}</span>)}
                </div>
                <input
                  type="range"
                  min="0"
                  max="10"
                  className="figma-slider"
                  style={{ '--progress': `${stressProgress}%` }}
                  value={formData.stress_level}
                  onChange={e => setFormData({ ...formData, stress_level: parseInt(e.target.value) })}
                />
              </div>

              {/* Caffeine Intake */}
              <div style={{ marginBottom: '24px' }}>
                <label style={{ fontSize: '14px', fontWeight: '600', color: 'var(--color-gray-800)', display: 'block', marginBottom: '12px' }}>
                  Caffeine intake (ml):
                </label>
                <input
                  type="text"
                  className="figma-input"
                  placeholder="..."
                  value={formData.caffeine_intake || ''}
                  onChange={e => setFormData({ ...formData, caffeine_intake: parseInt(e.target.value) || 0 })}
                />
              </div>

              {/* Screen Time */}
              <div style={{ marginBottom: '24px' }}>
                <label style={{ fontSize: '14px', fontWeight: '600', color: 'var(--color-gray-800)', display: 'block', marginBottom: '12px' }}>
                  Screen time:
                </label>
                <input
                  type="text"
                  className="figma-input"
                  placeholder="..."
                  value={formData.screen_time || ''}
                  onChange={e => setFormData({ ...formData, screen_time: parseFloat(e.target.value) || 0 })}
                />
              </div>

              {/* Exercise Frequency */}
              <div style={{ marginBottom: '24px' }}>
                <label style={{ fontSize: '14px', fontWeight: '600', color: 'var(--color-gray-800)', display: 'block', marginBottom: '12px' }}>
                  Exercise frequency:
                </label>
                <select
                  className="figma-select"
                  value={formData.exercise_frequency}
                  onChange={e => setFormData({ ...formData, exercise_frequency: e.target.value })}>
                  <option value="">...</option>
                  <option>None</option>
                  <option>Light</option>
                  <option>Moderate</option>
                  <option>Heavy</option>
                </select>
              </div>

              {/* Reaction Time */}
              <div style={{ marginBottom: '24px' }}>
                <label style={{ fontSize: '14px', fontWeight: '600', color: 'var(--color-gray-800)', display: 'block', marginBottom: '12px' }}>
                  Reaction time (ms):
                </label>
                <input
                  type="text"
                  className="figma-input"
                  placeholder="..."
                  value={formData.reaction_time || ''}
                  onChange={e => setFormData({ ...formData, reaction_time: parseFloat(e.target.value) || 0 })}
                />
              </div>

              {/* Cognitive Test Score */}
              <div style={{ marginBottom: '32px' }}>
                <label style={{ fontSize: '14px', fontWeight: '600', color: 'var(--color-gray-800)', display: 'block', marginBottom: '12px' }}>
                  Cognitive test score:
                </label>
                <input
                  type="text"
                  className="figma-input"
                  placeholder="..."
                  value={formData.memory_test_score || ''}
                  onChange={e => setFormData({ ...formData, memory_test_score: parseInt(e.target.value) || 0 })}
                />
              </div>

              {/* Integrated: Training Mode Exclusive Field */}
              {mode === 'train' && (
                  <div style={{ 
                      marginBottom: '32px', padding: '16px', 
                      backgroundColor: 'rgba(147, 51, 234, 0.1)', borderRadius: '12px', 
                      border: '1px dashed var(--color-purple-500)' 
                  }}>
                    <label style={{ fontSize: '14px', fontWeight: '700', color: 'var(--color-purple-700)', display: 'flex', alignItems:'center', gap:'8px', marginBottom: '12px' }}>
                      <Database size={16}/> Observed Score (Ground Truth)
                    </label>
                    <input
                      type="number"
                      className="figma-input"
                      placeholder="e.g. 80"
                      style={{ borderColor: 'var(--color-purple-400)', fontWeight: 'bold', color: 'var(--color-purple-900)' }}
                      value={formData.cognitive_score || ''}
                      onChange={e => setFormData({ ...formData, cognitive_score: parseInt(e.target.value) || 0 })}
                    />
                    <div style={{fontSize:'12px', color:'var(--color-purple-600)', marginTop:'8px'}}>
                        Enter the actual measured score to train the model.
                    </div>
                  </div>
              )}

              {/* Submit Button */}
              <div style={{ display: 'flex', justifyContent: 'center' }}>
                <button
                  onClick={handleSubmit}
                  disabled={loading}
                  className="figma-btn-primary"
                  style={{ 
                    minWidth: '120px', 
                    width: '100%',
                    backgroundColor: mode === 'train' ? 'var(--color-purple-600)' : 'var(--color-primary-black)' 
                  }}
                >
                   {loading ? "Processing..." : (mode === 'train' ? "Save Training Data" : "Calculate Readiness")}
                </button>
              </div>
            </div>
          </div>
        ) : (
          /* Result View */
          <div style={{
            backgroundColor: 'var(--color-white)',
            borderRadius: '16px',
            boxShadow: 'var(--shadow-md)',
            padding: '32px',
            maxWidth: '300px',
            margin: '0 auto',
            textAlign: 'center'
          }}>
            <h2 style={{
              fontSize: '18px',
              fontWeight: '700',
              color: 'var(--color-gray-900)',
              margin: '0 0 24px 0'
            }}>
              You are {(result.cognitive_score || result.score) >= 50 ? 'READY' : 'NOT ready'}
            </h2>

            <div style={{
              backgroundColor: 'var(--color-gray-50)',
              borderRadius: '12px',
              padding: '24px',
              marginBottom: '24px'
            }}>
              <div style={{ fontSize: '12px', fontWeight: '500', color: 'var(--color-gray-600)', marginBottom: '8px', textTransform: 'uppercase' }}>
                Cognitive Score
              </div>
              
              {/* 1. Show the Numeric Score */}
              <div style={{
                fontSize: '48px',
                fontWeight: '900',
                lineHeight: '1',
                marginBottom: '8px',
                color: (result.cognitive_score || result.score) >= 50 ? 'var(--color-success)' : 'var(--color-danger)'
              }}>
                {Math.round(result.cognitive_score || result.score)}
              </div>

              {/* 2. Show the Status Text */}
              <div style={{
                fontSize: '16px',
                fontWeight: '600',
                color: 'var(--color-gray-500)'
              }}>
                {(result.cognitive_score || result.score) >= 50 ? 'Normal Status' : 'Critical Status'}
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'center' }}>
              <button
                onClick={() => setResult(null)}
                className="figma-btn-primary"
              >
                Return to form
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

// --- ENTERPRISE COMPONENT (Unchanged from File 1) ---
const EnterpriseDashboard = () => {
  const [stats, setStats] = useState({ recent_checks: [], critical_alerts: 0, avg_score: 0 });

  useEffect(() => {
    fetch(`${API_URL}/api/dashboard/stats`)
      .then(res => res.json())
      .then(data => setStats({
        recent_checks: data?.recent_checks || [],
        critical_alerts: data?.critical_alerts || 0,
        avg_score: data?.avg_score || 0
      }))
      .catch(() => { }); // Ignore fetch errors
    const interval = setInterval(() => {
      fetch(`${API_URL}/api/dashboard/stats`)
        .then(res => res.json())
        .then(data => setStats({
          recent_checks: data?.recent_checks || [],
          critical_alerts: data?.critical_alerts || 0,
          avg_score: data?.avg_score || 0
        }))
        .catch(() => { }); // Ignore fetch errors
    }, 5000);
    return () => clearInterval(interval);
  }, []);

  // Calculate KPI values from recent_checks data
  const totalWorkers = new Set((stats.recent_checks || []).map(check => check.user_id)).size;
  const workersReady = (stats.recent_checks || []).filter(check => check.status === 'Normal').length;
  const workersAtRisk = totalWorkers - workersReady;
  const criticalAlertsToday = Math.round(workersAtRisk * 2.5);

  return (
    <div style={{ minHeight: '100vh', backgroundColor: 'var(--color-gray-50)', fontFamily: 'var(--font-sans)' }}>
      {/* Black Header */}
      <header style={{
        backgroundColor: 'var(--color-primary-black)',
        padding: '32px 48px',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center'
      }}>
        <h1 style={{
          color: 'var(--color-white)',
          fontSize: '32px',
          fontWeight: '700',
          margin: 0
        }}>
          Analyst dashboard
        </h1>
        <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="var(--color-purple-400)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M22 17H2a3 3 0 0 0 3-3V9a7 7 0 0 1 14 0v5a3 3 0 0 0 3 3zm-8.27 4a2 2 0 0 1-3.46 0" />
        </svg>
      </header>

      <div style={{ padding: '32px 48px' }}>
        {/* KPI Cards - 4 in a row */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(4, 1fr)',
          gap: '24px',
          marginBottom: '48px'
        }}>
          {/* Total Workers */}
          <div style={{
            backgroundColor: 'var(--color-white)',
            borderRadius: '12px',
            boxShadow: 'var(--shadow-sm)',
            padding: '24px'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
              <Activity size={20} style={{ color: 'var(--color-purple-600)' }} />
              <span style={{ fontSize: '12px', fontWeight: '500', color: 'var(--color-gray-600)' }}>Total Workers</span>
            </div>
            <div style={{ fontSize: '48px', fontWeight: '700', color: 'var(--color-gray-900)' }}>
              {totalWorkers}
            </div>
          </div>

          {/* Workers Ready Today */}
          <div style={{
            backgroundColor: 'var(--color-white)',
            borderRadius: '12px',
            boxShadow: 'var(--shadow-sm)',
            padding: '24px'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
              <CheckCircle size={20} style={{ color: 'var(--color-purple-600)' }} />
              <span style={{ fontSize: '12px', fontWeight: '500', color: 'var(--color-gray-600)' }}>Workers Ready Today</span>
            </div>
            <div style={{ fontSize: '48px', fontWeight: '700', color: 'var(--color-gray-900)' }}>
              {workersReady}
            </div>
          </div>

          {/* Workers at Risk Today */}
          <div style={{
            backgroundColor: 'var(--color-white)',
            borderRadius: '12px',
            boxShadow: 'var(--shadow-sm)',
            padding: '24px'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
              <AlertTriangle size={20} style={{ color: 'var(--color-purple-600)' }} />
              <span style={{ fontSize: '12px', fontWeight: '500', color: 'var(--color-gray-600)' }}>Workers at Risk Today</span>
            </div>
            <div style={{ fontSize: '48px', fontWeight: '700', color: 'var(--color-gray-900)' }}>
              {workersAtRisk}
            </div>
          </div>

          {/* Critical Alerts For Past Month */}
          <div style={{
            backgroundColor: 'var(--color-white)',
            borderRadius: '12px',
            boxShadow: 'var(--shadow-sm)',
            padding: '24px'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
              <AlertTriangle size={20} style={{ color: 'var(--color-purple-600)' }} />
              <span style={{ fontSize: '12px', fontWeight: '500', color: 'var(--color-gray-600)' }}>Critical Alerts For Past Month</span>
            </div>
            <div style={{ fontSize: '48px', fontWeight: '700', color: 'var(--color-gray-900)' }}>
              {criticalAlertsToday}
            </div>
          </div>
        </div>

        {/* Workers Health Status Table */}
        <div style={{ marginBottom: '48px' }}>
          <h2 style={{
            fontSize: '24px',
            fontWeight: '700',
            color: 'var(--color-gray-900)',
            marginBottom: '24px'
          }}>
            Workers Health Status Table
          </h2>

          <div style={{
            backgroundColor: 'var(--color-white)',
            borderRadius: '12px',
            overflow: 'hidden',
            boxShadow: 'var(--shadow-sm)'
          }}>
            {/* Purple accent bar */}
            <div style={{
              backgroundColor: 'var(--color-purple-500)',
              height: '4px'
            }} />

            {/* Table header */}
            <div style={{
              padding: '16px 24px',
              textAlign: 'center',
              fontSize: '14px',
              fontWeight: '500',
              color: 'var(--color-gray-700)',
              borderBottom: '1px solid var(--color-gray-200)'
            }}>
              Workers Health Status Table
            </div>

            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ backgroundColor: 'var(--color-gray-100)' }}>
                  <th style={{ padding: '12px 24px', textAlign: 'center', fontSize: '12px', fontWeight: '500', color: 'var(--color-gray-500)' }}>A</th>
                  <th style={{ padding: '12px 24px', textAlign: 'center', fontSize: '12px', fontWeight: '500', color: 'var(--color-gray-500)' }}>B</th>
                  <th style={{ padding: '12px 24px', textAlign: 'center', fontSize: '12px', fontWeight: '500', color: 'var(--color-gray-500)' }}>C</th>
                  <th style={{ padding: '12px 24px', textAlign: 'center', fontSize: '12px', fontWeight: '500', color: 'var(--color-gray-500)' }}>D</th>
                </tr>
                <tr>
                  <th style={{ padding: '12px 24px', textAlign: 'left', fontSize: '14px', fontWeight: '600', color: 'var(--color-gray-900)', borderBottom: '1px solid var(--color-gray-200)' }}>Worker</th>
                  <th style={{ padding: '12px 24px', textAlign: 'left', fontSize: '14px', fontWeight: '600', color: 'var(--color-gray-900)', borderBottom: '1px solid var(--color-gray-200)' }}>Last Update</th>
                  <th style={{ padding: '12px 24px', textAlign: 'left', fontSize: '14px', fontWeight: '600', color: 'var(--color-gray-900)', borderBottom: '1px solid var(--color-gray-200)' }}>Cognitive Score</th>
                  <th style={{ padding: '12px 24px', textAlign: 'left', fontSize: '14px', fontWeight: '600', color: 'var(--color-gray-900)', borderBottom: '1px solid var(--color-gray-200)' }}>Risk Level</th>
                </tr>
              </thead>
              <tbody>
                {(stats.recent_checks || []).length > 0 ? (
                  (stats.recent_checks || []).slice(0, 10).map((row, i) => (
                    <tr key={i} style={{ borderBottom: '1px solid var(--color-gray-100)' }}>
                      <td style={{ padding: '12px 24px', fontSize: '14px', color: 'var(--color-gray-700)', minWidth: '280px' }}>{row.user_id || 'Name'}</td>
                      <td style={{ padding: '12px 24px', fontSize: '14px', color: 'var(--color-gray-700)' }}>{row.timestamp ? new Date(row.timestamp).toISOString().replace('T', ' ').substring(0, 19) : '2024-08-01 1:14:59'}</td>
                      <td style={{ padding: '12px 24px', fontSize: '14px', color: 'var(--color-gray-700)' }}>{row.score || 39}</td>
                      <td style={{ padding: '12px 24px', fontSize: '14px', color: 'var(--color-gray-700)' }}>{row.status || 'Low'}</td>
                    </tr>
                  ))
                ) : (
                  <tr style={{ borderBottom: '1px solid var(--color-gray-100)' }}>
                    <td style={{ padding: '12px 24px', fontSize: '14px', color: 'var(--color-gray-700)' }}>Name</td>
                    <td style={{ padding: '12px 24px', fontSize: '14px', color: 'var(--color-gray-700)' }}>2024-08-01 1:14:59</td>
                    <td style={{ padding: '12px 24px', fontSize: '14px', color: 'var(--color-gray-700)' }}>39</td>
                    <td style={{ padding: '12px 24px', fontSize: '14px', color: 'var(--color-gray-700)' }}>Low</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Charts Section */}
        <div>
          <h2 style={{
            fontSize: '24px',
            fontWeight: '700',
            color: 'var(--color-gray-900)',
            marginBottom: '24px'
          }}>
            Charts Section
          </h2>

          <div style={{
            backgroundColor: 'var(--color-gray-200)',
            borderRadius: '12px',
            padding: '32px',
            display: 'grid',
            gridTemplateColumns: 'repeat(2, 1fr)',
            gap: '32px'
          }}>
            {/* Line Chart */}
            <div style={{ height: '350px' }}>
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={(stats.recent_checks || []).slice(0, 20).reverse()} margin={{ top: 20, right: 30, left: 60, bottom: 30 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e5e7eb" />
                  <XAxis
                    dataKey="timestamp"
                    tick={{ fontSize: 12, fill: '#6b7280' }}
                    axisLine={{ stroke: '#d1d5db' }}
                    tickFormatter={(value, index) => index + 1}
                    label={{ value: 'Days', position: 'insideBottom', offset: -5, fill: '#6b7280' }}
                  />
                  <YAxis
                    tick={{ fontSize: 12, fill: '#6b7280' }}
                    axisLine={{ stroke: '#d1d5db' }}
                    domain={[0, 'auto']}
                    ticks={[0, 20, 40, 60, 80, 100]}
                    tickFormatter={(value) => {
                      const labels = ['very low', 'low', 'moderate', 'high', 'very high', 'sky high'];
                      return labels[Math.floor(value / 20)] || '';
                    }}
                    label={{ value: 'Stress Level', angle: -90, position: 'insideLeft', fill: '#6b7280' }}
                  />
                  <Tooltip />
                  <Line type="monotone" dataKey="score" stroke="#3b82f6" strokeWidth={2} dot={true} name="Stress Level" />
                </LineChart>
              </ResponsiveContainer>
            </div>

            {/* Bar Chart */}
            <div style={{ height: '350px' }}>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={(stats.recent_checks || []).slice(0, 9)} margin={{ top: 20, right: 30, left: 120, bottom: 30 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e5e7eb" />
                  <XAxis
                    dataKey="timestamp"
                    tick={{ fontSize: 12, fill: '#6b7280' }}
                    axisLine={{ stroke: '#d1d5db' }}
                    tickFormatter={(value, index) => index + 1}
                    label={{ value: 'Days', position: 'insideBottom', offset: -5, fill: '#6b7280' }}
                  />
                  <YAxis
                    tick={{ fontSize: 12, fill: '#6b7280' }}
                    axisLine={{ stroke: '#d1d5db' }}
                    domain={[0, 'auto']}
                    ticks={[0, 20, 40, 60, 80, 100]}
                    tickFormatter={(value) => {
                      const labels = ['very low', 'low', 'moderate', 'high', 'very high', 'sky high'];
                      return labels[Math.floor(value / 20)] || '';
                    }}
                    label={{ value: 'Stress Level', angle: -90, position: 'insideLeft', fill: '#6b7280' }}
                  />
                  <Tooltip />
                  <Bar dataKey="score" fill="#3b82f6" radius={[2, 2, 0, 0]} name="Stress Level" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

const App = () => {
  const [view, setView] = useState('home');
  if (view === 'worker') return <WorkerMobileView />;
  if (view === 'enterprise') return <EnterpriseDashboard />;

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      minHeight: '100vh',
      backgroundColor: 'var(--color-primary-black)',
      color: 'var(--color-white)',
      fontFamily: 'var(--font-sans)'
    }}>
      <div style={{ textAlign: 'center', marginBottom: '48px' }}>
        <h1 style={{
          fontSize: '64px',
          fontWeight: '900',
          marginBottom: '16px',
          letterSpacing: '-0.02em',
          margin: 0
        }}>
          CPMS
        </h1>
        <p style={{
          fontSize: '20px',
          color: 'var(--color-gray-400)',
          margin: 0
        }}>
          Cognitive Performance Monitoring System
        </p>
      </div>

      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(2, 1fr)',
        gap: '32px',
        maxWidth: '900px',
        padding: '0 32px'
      }}>
        <button
          onClick={() => setView('worker')}
          style={{
            padding: '40px',
            backgroundColor: 'rgba(255, 255, 255, 0.05)',
            borderRadius: '24px',
            border: '1px solid rgba(255, 255, 255, 0.1)',
            cursor: 'pointer',
            transition: 'all 0.2s',
            color: 'var(--color-white)'
          }}
          onMouseOver={(e) => {
            e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.1)';
            e.currentTarget.style.transform = 'scale(1.02)';
          }}
          onMouseOut={(e) => {
            e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.05)';
            e.currentTarget.style.transform = 'scale(1)';
          }}
        >
          <Smartphone size={48} style={{ marginBottom: '24px', color: 'var(--color-purple-400)' }} />
          <span style={{ display: 'block', fontSize: '24px', fontWeight: '700', textAlign: 'center' }}>Worker App</span>
          <span style={{ display: 'block', fontSize: '14px', color: 'var(--color-gray-400)', textAlign: 'center', marginTop: '8px' }}>Submit readiness check</span>
        </button>

        <button
          onClick={() => setView('enterprise')}
          style={{
            padding: '40px',
            backgroundColor: 'rgba(255, 255, 255, 0.05)',
            borderRadius: '24px',
            border: '1px solid rgba(255, 255, 255, 0.1)',
            cursor: 'pointer',
            transition: 'all 0.2s',
            color: 'var(--color-white)'
          }}
          onMouseOver={(e) => {
            e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.1)';
            e.currentTarget.style.transform = 'scale(1.02)';
          }}
          onMouseOut={(e) => {
            e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.05)';
            e.currentTarget.style.transform = 'scale(1)';
          }}
        >
          <LayoutDashboard size={48} style={{ marginBottom: '24px', color: 'var(--color-success)' }} />
          <span style={{ display: 'block', fontSize: '24px', fontWeight: '700', textAlign: 'center' }}>Enterprise View</span>
          <span style={{ display: 'block', fontSize: '14px', color: 'var(--color-gray-400)', textAlign: 'center', marginTop: '8px' }}>Live dashboard & analytics</span>
        </button>
      </div>
    </div>
  );
};

export default App;