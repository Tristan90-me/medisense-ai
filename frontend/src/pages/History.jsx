import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ArrowLeft, Activity, ChevronRight,
  Clock, CheckCircle, AlertCircle, Loader,
} from 'lucide-react';
import api from '../api/axios';
import './History.css';

const severityColor = {
  Low: { bg: '#f0fdf4', text: '#16a34a', dot: '#22c55e' },
  Moderate: { bg: '#fffbeb', text: '#d97706', dot: '#f59e0b' },
  High: { bg: '#fef2f2', text: '#dc2626', dot: '#ef4444' },
  Critical: { bg: '#f5f3ff', text: '#7c3aed', dot: '#8b5cf6' },
};

const modeLabel = { quick: 'Quick Check', full: 'Full Assessment' };

export default function History() {
  const navigate = useNavigate();
  const [sessions, setSessions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all');

  useEffect(() => {
    const fetch = async () => {
      try {
        const res = await api.get('/ai/sessions');
        setSessions(res.data.sessions);
      } catch {
        // fail silently
      } finally {
        setLoading(false);
      }
    };
    fetch();
  }, []);

  const filtered = sessions.filter((s) => {
    if (filter === 'all') return true;
    return s.status === filter;
  });

  const formatDate = (d) => {
    const date = new Date(d);
    return date.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
  };

  const formatTime = (d) => {
    return new Date(d).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
  };

  return (
    <div className="hist-root">
      {/* Header */}
      <div className="hist-header">
        <button className="hist-back" onClick={() => navigate('/dashboard')}>
          <ArrowLeft size={18} />
        </button>
        <div className="hist-header-center">
          <div className="hist-header-icon"><Activity size={16} /></div>
          <div>
            <p className="hist-title">Session History</p>
            <p className="hist-sub">{sessions.length} session{sessions.length !== 1 ? 's' : ''} total</p>
          </div>
        </div>
      </div>

      {/* Filter tabs */}
      <div className="hist-filters">
        {['all', 'active', 'completed'].map((f) => (
          <button
            key={f}
            className={`hist-filter-btn ${filter === f ? 'active' : ''}`}
            onClick={() => setFilter(f)}
          >
            {f.charAt(0).toUpperCase() + f.slice(1)}
          </button>
        ))}
      </div>

      {/* List */}
      <div className="hist-list">
        {loading && (
          <div className="hist-loading">
            <Loader size={24} className="hist-spinner" />
            <p>Loading sessions...</p>
          </div>
        )}

        {!loading && filtered.length === 0 && (
          <div className="hist-empty">
            <p className="hist-empty-icon">🩺</p>
            <p className="hist-empty-title">No sessions yet</p>
            <p className="hist-empty-sub">Start a Quick Check or Full Assessment to see your history here.</p>
            <button className="hist-start-btn" onClick={() => navigate('/session?mode=quick')}>
              Start your first check
            </button>
          </div>
        )}

        {!loading && filtered.map((s) => {
          const sev = severityColor[s.severityLevel];
          return (
            <button
              key={s._id}
              className="hist-item"
              onClick={() => navigate(`/history/${s._id}`)}
            >
              {/* Left */}
              <div className="hist-item-left">
                <div
                  className="hist-item-icon"
                  style={{ background: sev?.bg || '#f1f5f9' }}
                >
                  {s.status === 'completed'
                    ? <CheckCircle size={16} color={sev?.text || '#64748b'} />
                    : <Clock size={16} color="#64748b" />
                  }
                </div>
                <div>
                  <p className="hist-item-mode">{modeLabel[s.mode] || s.mode}</p>
                  <p className="hist-item-date">
                    {formatDate(s.createdAt)} · {formatTime(s.createdAt)}
                  </p>
                  {s.symptoms?.length > 0 && (
                    <p className="hist-item-symptoms">
                      {s.symptoms.slice(0, 3).map(sym => sym.name).join(', ')}
                      {s.symptoms.length > 3 ? ` +${s.symptoms.length - 3} more` : ''}
                    </p>
                  )}
                </div>
              </div>

              {/* Right */}
              <div className="hist-item-right">
                {s.severityLevel && (
                  <span
                    className="hist-sev-badge"
                    style={{ background: sev?.bg, color: sev?.text }}
                  >
                    <span className="hist-sev-dot" style={{ background: sev?.dot }} />
                    {s.severityLevel}
                  </span>
                )}
                {s.emergencyDetected && (
                  <AlertCircle size={16} color="#ef4444" />
                )}
                <ChevronRight size={16} color="#cbd5e1" />
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}