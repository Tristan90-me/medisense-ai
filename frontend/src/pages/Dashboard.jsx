import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import {
  Activity, Map, Zap, ClipboardList,
  LogOut, History, TrendingUp, Shield,
} from 'lucide-react';

export default function Dashboard() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const primaryActions = [
    {
      icon: <Zap size={20} color="#3b82f6" />,
      title: 'Quick Check',
      desc: '3–5 questions · Fast symptom assessment',
      onClick: () => navigate('/session?mode=quick'),
      bg: '#eff6ff',
    },
    {
      icon: <ClipboardList size={20} color="#8b5cf6" />,
      title: 'Full Assessment',
      desc: '10–15 questions · Detailed health report',
      onClick: () => navigate('/session?mode=full'),
      bg: '#f5f3ff',
    },
    {
      icon: <Map size={20} color="#22c55e" />,
      title: 'Body Map',
      desc: 'Tap where it hurts to select symptoms',
      onClick: () => navigate('/body-map'),
      bg: '#f0fdf4',
    },
  ];

  const secondaryActions = [
    {
      icon: <History size={18} color="#f59e0b" />,
      title: 'Session History',
      desc: 'View all past sessions',
      onClick: () => navigate('/history'),
      bg: '#fffbeb',
    },
    {
      icon: <TrendingUp size={18} color="#6366f1" />,
      title: 'Health Stats',
      desc: 'Severity trends & symptom insights',
      onClick: () => navigate('/health-stats'),
      bg: '#eef2ff',
    },
    ...(user?.role === 'admin' ? [{
      icon: <Shield size={18} color="#0f2744" />,
      title: 'Admin Panel',
      desc: 'Manage users & monitor sessions',
      onClick: () => navigate('/admin'),
      bg: '#f1f5f9',
    }] : []),
  ];

  return (
    <div style={{ minHeight: '100vh', background: '#f8fafc', fontFamily: 'Inter, sans-serif' }}>
      {/* Header */}
      <div style={{ background: '#fff', borderBottom: '0.5px solid #e2e8f0', padding: '14px 20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{ width: 34, height: 34, background: '#3b82f6', borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Activity size={18} color="#fff" />
          </div>
          <div>
            <p style={{ fontSize: 15, fontWeight: 700, color: '#1e3a5f' }}>MediSense AI</p>
            <p style={{ fontSize: 11, color: '#94a3b8' }}>Health Dashboard</p>
          </div>
        </div>
        <button
          onClick={logout}
          style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#94a3b8', display: 'flex', alignItems: 'center', gap: 5, fontSize: 13 }}
        >
          <LogOut size={15} /> Logout
        </button>
      </div>

      <div style={{ maxWidth: 600, margin: '0 auto', padding: '24px 16px' }}>
        {/* Welcome */}
        <div style={{ marginBottom: 24 }}>
          <h1 style={{ fontSize: 22, fontWeight: 700, color: '#1e3a5f' }}>
            Hello, {user?.name?.split(' ')[0]} 👋
          </h1>
          <p style={{ fontSize: 14, color: '#64748b', marginTop: 4 }}>
            How are you feeling today?
          </p>
        </div>

        {/* Primary actions */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 20 }}>
          {primaryActions.map((a, i) => (
            <button
              key={i}
              onClick={a.onClick}
              style={{
                display: 'flex', alignItems: 'center', gap: 14,
                background: '#fff', border: '0.5px solid #e2e8f0',
                borderRadius: 14, padding: '16px 18px',
                cursor: 'pointer', textAlign: 'left', width: '100%',
                transition: 'box-shadow 0.2s',
              }}
              onMouseEnter={e => e.currentTarget.style.boxShadow = '0 4px 12px rgba(0,0,0,0.07)'}
              onMouseLeave={e => e.currentTarget.style.boxShadow = 'none'}
            >
              <div style={{ width: 44, height: 44, background: a.bg, borderRadius: 12, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                {a.icon}
              </div>
              <div>
                <p style={{ fontSize: 14, fontWeight: 600, color: '#1e3a5f', marginBottom: 3 }}>{a.title}</p>
                <p style={{ fontSize: 12, color: '#64748b' }}>{a.desc}</p>
              </div>
            </button>
          ))}
        </div>

        {/* Divider */}
        <p style={{ fontSize: 11, fontWeight: 600, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 10 }}>
          Your Health Data
        </p>

        {/* Secondary actions */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 32 }}>
          {secondaryActions.map((a, i) => (
            <button
              key={i}
              onClick={a.onClick}
              style={{
                display: 'flex', flexDirection: 'column', gap: 10,
                background: '#fff', border: '0.5px solid #e2e8f0',
                borderRadius: 14, padding: '14px',
                cursor: 'pointer', textAlign: 'left',
                transition: 'box-shadow 0.2s',
              }}
              onMouseEnter={e => e.currentTarget.style.boxShadow = '0 4px 12px rgba(0,0,0,0.07)'}
              onMouseLeave={e => e.currentTarget.style.boxShadow = 'none'}
            >
              <div style={{ width: 38, height: 38, background: a.bg, borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                {a.icon}
              </div>
              <div>
                <p style={{ fontSize: 13, fontWeight: 600, color: '#1e3a5f', marginBottom: 2 }}>{a.title}</p>
                <p style={{ fontSize: 11, color: '#94a3b8' }}>{a.desc}</p>
              </div>
            </button>
          ))}
        </div>

        <p style={{ fontSize: 11, color: '#cbd5e1', textAlign: 'center', lineHeight: 1.6 }}>
          MediSense AI is not a substitute for professional medical advice.
          Always consult a qualified healthcare provider.
        </p>
      </div>
    </div>
  );
}