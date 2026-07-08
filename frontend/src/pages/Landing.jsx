import { Link } from 'react-router-dom';
import { Activity, Brain, ShieldCheck, ChartLine } from 'lucide-react';

export default function Landing() {
  return (
    <div style={{ minHeight: '100vh', background: 'linear-gradient(135deg, #eff6ff 0%, #f0fdf4 100%)' }}>
      <nav style={{ background: '#fff', padding: '0 2rem', height: 60, display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '0.5px solid #e2e8f0' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <div style={{ width: 32, height: 32, background: '#3b82f6', borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Activity size={18} color="#fff" />
          </div>
          <span style={{ fontSize: 16, fontWeight: 600, color: '#1e3a5f' }}>MediSense AI</span>
        </div>
        <div style={{ display: 'flex', gap: 12 }}>
          <Link to="/login"><button style={{ padding: '8px 18px', border: '0.5px solid #e2e8f0', borderRadius: 20, background: '#fff', cursor: 'pointer', fontSize: 13 }}>Sign in</button></Link>
          <Link to="/register"><button style={{ padding: '8px 18px', background: '#3b82f6', color: '#fff', border: 'none', borderRadius: 20, cursor: 'pointer', fontSize: 13 }}>Get started</button></Link>
        </div>
      </nav>
      <div style={{ textAlign: 'center', padding: '5rem 1rem 3rem' }}>
        <h1 style={{ fontSize: 36, fontWeight: 700, color: '#1e3a5f', lineHeight: 1.2, marginBottom: '1rem' }}>
          Your AI health assistant,<br />always available
        </h1>
        <p style={{ fontSize: 16, color: '#64748b', maxWidth: 480, margin: '0 auto 2rem', lineHeight: 1.7 }}>
          Describe your symptoms and get intelligent, personalized health insights powered by advanced AI.
        </p>
        <Link to="/register">
          <button style={{ padding: '12px 32px', background: '#3b82f6', color: '#fff', border: 'none', borderRadius: 24, fontSize: 15, fontWeight: 500, cursor: 'pointer' }}>
            Check your symptoms
          </button>
        </Link>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 16, maxWidth: 700, margin: '0 auto', padding: '0 1.5rem 4rem' }}>
        {[
          { icon: <Brain size={24} color="#3b82f6" />, title: 'AI-powered diagnosis', desc: 'Multi-turn conversation that thinks like a doctor' },
          { icon: <ShieldCheck size={24} color="#22c55e" />, title: 'Safe & private', desc: 'Your health data is encrypted and secure' },
          { icon: <ChartLine size={24} color="#8b5cf6" />, title: 'Track your health', desc: 'Monitor symptoms and trends over time' },
        ].map((c, i) => (
          <div key={i} style={{ background: '#fff', borderRadius: 12, padding: '1.25rem', border: '0.5px solid #e2e8f0', textAlign: 'center' }}>
            <div style={{ marginBottom: 10 }}>{c.icon}</div>
            <p style={{ fontWeight: 600, fontSize: 14, color: '#1e3a5f', marginBottom: 6 }}>{c.title}</p>
            <p style={{ fontSize: 12, color: '#64748b', lineHeight: 1.5 }}>{c.desc}</p>
          </div>
        ))}
      </div>
    </div>
  );
}