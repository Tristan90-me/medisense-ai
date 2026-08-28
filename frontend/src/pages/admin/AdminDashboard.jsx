import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Users, Activity, AlertTriangle, TrendingUp,
  ArrowLeft, Shield, Calendar,
} from 'lucide-react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer,
} from 'recharts';
import api from '../../api/axios';
import './Admin.css';

export default function AdminDashboard() {
  const navigate = useNavigate();
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetch = async () => {
      try {
        const res = await api.get('/admin/stats');
        setStats(res.data);
      } catch {
        navigate('/dashboard');
      } finally {
        setLoading(false);
      }
    };
    fetch();
  }, []);

  if (loading) return (
    <div className="admin-loading">
      <div className="admin-spinner" />
      <p>Loading admin panel...</p>
    </div>
  );

  if (!stats) return null;

  const severityMap = {};
  stats.severityBreakdown?.forEach(s => { severityMap[s._id] = s.count; });

  const severityData = ['Low', 'Moderate', 'High', 'Critical'].map(level => ({
    name: level,
    count: severityMap[level] || 0,
  }));

  const severityColors = {
    Low: '#22c55e', Moderate: '#f59e0b',
    High: '#ef4444', Critical: '#7c3aed',
  };

  const CustomBar = (props) => {
    const { x, y, width, height, name } = props;
    return <rect x={x} y={y} width={width} height={height} fill={severityColors[name]} rx={4} />;
  };

  return (
    <div className="admin-root">
      {/* Header */}
      <div className="admin-header">
        <button className="admin-back" onClick={() => navigate('/dashboard')}>
          <ArrowLeft size={18} />
        </button>
        <div className="admin-header-center">
          <div className="admin-header-icon"><Shield size={16} /></div>
          <div>
            <p className="admin-title">Admin Panel</p>
            <p className="admin-sub">System overview</p>
          </div>
        </div>
        <div className="admin-nav-btns">
          <button className="admin-nav-btn active">Overview</button>
          <button className="admin-nav-btn" onClick={() => navigate('/admin/users')}>Users</button>
          <button className="admin-nav-btn" onClick={() => navigate('/admin/sessions')}>Sessions</button>
        </div>
      </div>

      <div className="admin-body">
        {/* Stat cards */}
        <div className="admin-stats-grid">
          {[
            { label: 'Total Users', value: stats.totalUsers, icon: <Users size={18} />, color: '#3b82f6', bg: '#eff6ff' },
            { label: 'Total Sessions', value: stats.totalSessions, icon: <Activity size={18} />, color: '#8b5cf6', bg: '#f5f3ff' },
            { label: 'Today\'s Sessions', value: stats.todaySessions, icon: <Calendar size={18} />, color: '#22c55e', bg: '#f0fdf4' },
            { label: 'Emergencies', value: stats.emergencySessions, icon: <AlertTriangle size={18} />, color: '#ef4444', bg: '#fef2f2' },
          ].map((s, i) => (
            <div key={i} className="admin-stat-card">
              <div className="admin-stat-icon" style={{ background: s.bg, color: s.color }}>
                {s.icon}
              </div>
              <div>
                <p className="admin-stat-value" style={{ color: s.color }}>{s.value}</p>
                <p className="admin-stat-label">{s.label}</p>
              </div>
            </div>
          ))}
        </div>

        {/* Sessions by day chart */}
        {stats.sessionsByDay?.length > 0 && (
          <div className="admin-card">
            <p className="admin-card-title">Sessions — Last 7 Days</p>
            <div style={{ height: 200, marginTop: 16 }}>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={stats.sessionsByDay}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                  <XAxis
                    dataKey="_id"
                    tick={{ fontSize: 10, fill: '#94a3b8' }}
                    tickFormatter={(v) => {
                      const d = new Date(v);
                      return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
                    }}
                  />
                  <YAxis tick={{ fontSize: 10, fill: '#94a3b8' }} allowDecimals={false} />
                  <Tooltip
                    formatter={(v) => [v, 'Sessions']}
                    labelFormatter={(l) => new Date(l).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' })}
                  />
                  <Bar dataKey="count" fill="#3b82f6" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}

        {/* Severity breakdown */}
        <div className="admin-card">
          <p className="admin-card-title">Severity Breakdown</p>
          <div style={{ height: 180, marginTop: 16 }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={severityData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                <XAxis dataKey="name" tick={{ fontSize: 11, fill: '#64748b' }} />
                <YAxis tick={{ fontSize: 10, fill: '#94a3b8' }} allowDecimals={false} />
                <Tooltip formatter={(v) => [v, 'Sessions']} />
                <Bar dataKey="count" shape={<CustomBar />} radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Quick links */}
        <div className="admin-quick-links">
          <button className="admin-quick-btn" onClick={() => navigate('/admin/users')}>
            <Users size={16} /> Manage Users
          </button>
          <button className="admin-quick-btn" onClick={() => navigate('/admin/sessions')}>
            <Activity size={16} /> Monitor Sessions
          </button>
        </div>
      </div>
    </div>
  );
}