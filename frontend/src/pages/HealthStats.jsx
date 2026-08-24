import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Activity, TrendingUp, AlertTriangle } from 'lucide-react';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, ReferenceLine,
} from 'recharts';
import api from '../api/axios';
import './HealthStats.css';

export default function HealthStats() {
  const navigate = useNavigate();
  const [sessions, setSessions] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetch = async () => {
      try {
        const res = await api.get('/ai/sessions');
        setSessions(res.data.sessions);
      } catch {}
      finally { setLoading(false); }
    };
    fetch();
  }, []);

  // ── Derived stats ────────────────────────────────────────────────────
  const completed = sessions.filter(s => s.status === 'completed');
  const withSeverity = sessions.filter(s => s.severityScore);
  const avgSeverity = withSeverity.length
    ? (withSeverity.reduce((a, s) => a + s.severityScore, 0) / withSeverity.length).toFixed(1)
    : 'N/A';

  const emergencyCount = sessions.filter(s => s.emergencyDetected).length;

  // Symptom frequency
  const symptomMap = {};
  sessions.forEach(s => {
    s.symptoms?.forEach(sym => {
      symptomMap[sym.name] = (symptomMap[sym.name] || 0) + 1;
    });
  });
  const topSymptoms = Object.entries(symptomMap)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 6);

  // Timeline data for chart (last 10 sessions with severity)
  const chartData = withSeverity
    .slice()
    .reverse()
    .slice(-10)
    .map((s, i) => ({
      name: new Date(s.createdAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }),
      severity: s.severityScore,
      level: s.severityLevel,
    }));

  const severityDotColor = (level) => {
    const map = { Low: '#22c55e', Moderate: '#f59e0b', High: '#ef4444', Critical: '#7c3aed' };
    return map[level] || '#3b82f6';
  };

  const CustomDot = (props) => {
    const { cx, cy, payload } = props;
    return <circle cx={cx} cy={cy} r={5} fill={severityDotColor(payload.level)} stroke="#fff" strokeWidth={2} />;
  };

  const CustomTooltip = ({ active, payload }) => {
    if (!active || !payload?.length) return null;
    const d = payload[0].payload;
    return (
      <div style={{ background: '#fff', border: '0.5px solid #e2e8f0', borderRadius: 10, padding: '8px 12px', fontSize: 12 }}>
        <p style={{ fontWeight: 600, color: '#1e3a5f' }}>{d.name}</p>
        <p style={{ color: severityDotColor(d.level) }}>{d.level} — {d.severity}/10</p>
      </div>
    );
  };

  return (
    <div className="hs-root">
      {/* Header */}
      <div className="hs-header">
        <button className="hs-back" onClick={() => navigate('/dashboard')}>
          <ArrowLeft size={18} />
        </button>
        <div className="hs-header-center">
          <div className="hs-header-icon"><TrendingUp size={16} /></div>
          <div>
            <p className="hs-title">Health Stats</p>
            <p className="hs-sub">Your health overview</p>
          </div>
        </div>
      </div>

      <div className="hs-body">
        {/* Stat cards */}
        <div className="hs-stats-grid">
          {[
            { label: 'Total Sessions', value: sessions.length, color: '#3b82f6', bg: '#eff6ff' },
            { label: 'Completed', value: completed.length, color: '#22c55e', bg: '#f0fdf4' },
            { label: 'Avg Severity', value: avgSeverity, color: '#f59e0b', bg: '#fffbeb' },
            { label: 'Emergencies', value: emergencyCount, color: '#ef4444', bg: '#fef2f2' },
          ].map((s, i) => (
            <div key={i} className="hs-stat-card" style={{ borderTop: `3px solid ${s.color}` }}>
              <p className="hs-stat-value" style={{ color: s.color }}>{s.value}</p>
              <p className="hs-stat-label">{s.label}</p>
            </div>
          ))}
        </div>

        {/* Severity timeline */}
        {chartData.length > 1 ? (
          <div className="hs-card">
            <p className="hs-card-title">Severity Over Time</p>
            <p className="hs-card-sub">Last {chartData.length} sessions with severity scores</p>
            <div style={{ height: 200, marginTop: 16 }}>
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                  <XAxis dataKey="name" tick={{ fontSize: 10, fill: '#94a3b8' }} />
                  <YAxis domain={[0, 10]} tick={{ fontSize: 10, fill: '#94a3b8' }} />
                  <Tooltip content={<CustomTooltip />} />
                  <ReferenceLine y={7} stroke="#ef4444" strokeDasharray="4 4" strokeOpacity={0.5} label={{ value: 'High', fill: '#ef4444', fontSize: 10 }} />
                  <Line
                    type="monotone"
                    dataKey="severity"
                    stroke="#3b82f6"
                    strokeWidth={2}
                    dot={<CustomDot />}
                    activeDot={{ r: 6 }}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>
        ) : (
          <div className="hs-card hs-empty-chart">
            <Activity size={28} color="#cbd5e1" />
            <p>Not enough data yet for a chart.</p>
            <p style={{ fontSize: 12, color: '#cbd5e1' }}>Complete at least 2 sessions with severity scores.</p>
          </div>
        )}

        {/* Top symptoms */}
        {topSymptoms.length > 0 && (
          <div className="hs-card">
            <p className="hs-card-title">Most Common Symptoms</p>
            <p className="hs-card-sub">Across all your sessions</p>
            <div className="hs-symptoms-list">
              {topSymptoms.map(([name, count], i) => {
                const max = topSymptoms[0][1];
                return (
                  <div key={i} className="hs-symptom-row">
                    <span className="hs-symptom-name">{name}</span>
                    <div className="hs-symptom-bar-wrap">
                      <div
                        className="hs-symptom-bar"
                        style={{ width: `${(count / max) * 100}%` }}
                      />
                    </div>
                    <span className="hs-symptom-count">{count}x</span>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Emergency notice */}
        {emergencyCount > 0 && (
          <div className="hs-emergency-note">
            <AlertTriangle size={16} />
            <p>
              {emergencyCount} session{emergencyCount > 1 ? 's' : ''} flagged emergency symptoms.
              Please ensure you sought appropriate medical care.
            </p>
          </div>
        )}

        <p className="hs-disclaimer">
          MediSense AI is not a substitute for professional medical advice.
          Always consult a qualified healthcare provider.
        </p>
      </div>
    </div>
  );
}