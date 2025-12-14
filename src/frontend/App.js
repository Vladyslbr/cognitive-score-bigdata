import React, { useState, useEffect } from 'react';
import {
  LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer
} from 'recharts';
import {
  AlertTriangle, CheckCircle, Smartphone, LayoutDashboard, Heart, Activity, Watch
} from 'lucide-react';

import "./index.css"

const API_URL = process.env.REACT_APP_API_URL || "http://localhost:8000";

// --- WORKER COMPONENT ---
const WorkerMobileView = () => {
  const [userId, setUserId] = useState('ed1b8099-4373-49ef-9ec9-4cdb57248727');
  const [wearableStatus, setWearableStatus] = useState({ heart_rate: 0, steps: 0 });
  const [lastStatus, setLastStatus] = useState({ score: 0, status: 'N/A' });

  // Load form data from localStorage or use defaults
  const [formData, setFormData] = useState(() => {
    const saved = localStorage.getItem('workerFormData');
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch (e) {
        return {
          sleep_duration: 7.5,
          stress_level: 5,
          screen_time: 4.0,
          exercise_frequency: 'Moderate',
          caffeine_intake: 100,
          reaction_time: 250,
          memory_test_score: 85
        };
      }
    }
    return {
      sleep_duration: 7.5,
      stress_level: 5,
      screen_time: 4.0,
      exercise_frequency: 'Moderate',
      caffeine_intake: 100,
      reaction_time: 250,
      memory_test_score: 85
    };
  });
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);

  // Poll for wearable data (simulating live sync)
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

  // Fetch last status from dashboard stats
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

  const handleSubmit = async () => {
    setLoading(true);
    try {
      // Save form data to localStorage
      localStorage.setItem('workerFormData', JSON.stringify(formData));

      const res = await fetch(`${API_URL}/api/predict`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user_id: userId, ...formData })
      });
      const data = await res.json();
      setResult(data);
    } catch (err) { alert("Error connecting to server"); }
    setLoading(false);
  };

  // Calculate slider progress for styling
  const sleepProgress = ((formData.sleep_duration / 24) * 100);
  const stressProgress = ((formData.stress_level / 10) * 100);

  return (
    <div style={{ minHeight: '100vh', backgroundColor: 'var(--color-gray-50)', fontFamily: 'var(--font-sans)' }}>
      {/* Black Header with Avatar */}
      <div style={{
        backgroundColor: 'var(--color-primary-black)',
        padding: '24px',
        display: 'flex',
        alignItems: 'center',
        gap: '16px'
      }}>
        <img
          src="https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=100&h=100&fit=crop&crop=face"
          alt="Worker avatar"
          style={{
            width: '56px',
            height: '56px',
            borderRadius: '50%',
            objectFit: 'cover',
            border: '2px solid white'
          }}
        />
        <span style={{
          backgroundColor: 'var(--color-white)',
          color: 'var(--color-gray-800)',
          padding: '8px 16px',
          borderRadius: '8px',
          fontSize: '13px',
          fontWeight: '500'
        }}>
          Readiness Check
        </span>
      </div>

      <div style={{ padding: '24px' }}>
        {!result ? (
          <div>
            {/* Score Cards */}
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

            {/* Form Container with Purple Border */}
            <div style={{
              backgroundColor: 'var(--color-white)',
              borderRadius: '24px',
              border: '2px solid var(--color-purple-200)',
              padding: '32px 24px'
            }}>
              <p style={{
                fontSize: '16px',
                color: 'var(--color-gray-800)',
                textAlign: 'center',
                marginBottom: '24px',
                marginTop: 0
              }}>
                Please fill out the form to request a readiness assessment
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

              {/* Submit Button */}
              <div style={{ display: 'flex', justifyContent: 'center' }}>
                <button
                  onClick={handleSubmit}
                  disabled={loading}
                  className="figma-btn-primary"
                  style={{ minWidth: '120px' }}
                >
                  {loading ? "..." : "Submit"}
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
            margin: '0 auto'
          }}>
            <h2 style={{
              fontSize: '18px',
              fontWeight: '700',
              color: 'var(--color-gray-900)',
              margin: '0 0 24px 0'
            }}>
              You are {result.score >= 50 ? 'READY' : 'NOT ready'}
            </h2>

            <div style={{
              backgroundColor: 'var(--color-gray-50)',
              borderRadius: '12px',
              padding: '20px',
              marginBottom: '24px'
            }}>
              <div style={{ fontSize: '12px', fontWeight: '500', color: 'var(--color-gray-600)', marginBottom: '8px' }}>
                Risk Level
              </div>
              <div style={{
                fontSize: '24px',
                fontWeight: '700',
                color: result.score >= 50 ? 'var(--color-success)' : 'var(--color-danger)'
              }}>
                {result.score >= 50 ? 'Normal' : 'Critical'}
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'center' }}>
              <button
                onClick={() => setResult(null)}
                className="figma-btn-primary"
              >
                Return to dashboard
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

// --- ENTERPRISE COMPONENT ---
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
