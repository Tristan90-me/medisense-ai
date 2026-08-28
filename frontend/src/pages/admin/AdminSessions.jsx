import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ArrowLeft, Shield, AlertTriangle,
  ChevronLeft, ChevronRight, Filter,
} from 'lucide-react';
import api from '../../api/axios';
import './Admin.css';

const severityColor = {
  Low: { bg: '#f0fdf4', text: '#16a34a' },
  Moderate: { bg: '#fffbeb', text: '#d97706' },
  High: { bg: '#fef2f2', text: '#dc2626' },
  Critical: { bg: '#f5f3ff', text: '#7c3aed' },
};

export default function AdminSessions() {
  const navigate = useNavigate();
  const [sessions, setSessions] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pages, setPages] = useState(1);
  const [filters, setFilters] = useState({ severity: '', emergency: '', status: '' });
  const [loading, setLoading] = useState(true);
  const [showFilters, setShowFilters] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = { page, limit: 20, ...filters };
      Object.keys(params).forEach(k => !params[k] && delete params[k]);
      const res = await api.get('/admin/sessions', { params });
      setSessions(res.data.sessions);
      setTotal(res.data.total);
      setPages(res.data.pages);
    } catch {
      navigate('/dashboard');
    } finally {
      setLoading(false);
    }
  }, [page, filters]);

  useEffect(() => { load(); }, [load]);

  const setFilter = (key, val) => {
    setFilters(prev => ({ ...prev, [key]: val }));
    setPage(1);
  };

  return (
    <div className="admin-root">
      {/* Header */}
      <div className="admin-header">
        <button className="admin-back" onClick={() => navigate('/admin')}>
          <ArrowLeft size={18} />
        </button>
        <div className="admin-header-center">
          <div className="admin-header-icon"><Shield size={16} /></div>
          <div>
            <p className="admin-title">Session Monitor</p>
            <p className="admin-sub">{total} session{total !== 1 ? 's' : ''}</p>
          </div>
        </div>
        <div className="admin-nav-btns">
          <button className="admin-nav-btn" onClick={() => navigate('/admin')}>Overview</button>
          <button className="admin-nav-btn" onClick={() => navigate('/admin/users')}>Users</button>
          <button className="admin-nav-btn active">Sessions</button>
        </div>
      </div>

      <div className="admin-body">
        {/* Filter bar */}
        <div className="admin-filter-bar">
          <button
            className="admin-filter-toggle"
            onClick={() => setShowFilters(p => !p)}
          >
            <Filter size={14} /> Filters
            {Object.values(filters).some(Boolean) && <span className="admin-filter-dot" />}
          </button>

          {showFilters && (
            <div className="admin-filters">
              <select
                className="admin-select"
                value={filters.severity}
                onChange={e => setFilter('severity', e.target.value)}
              >
                <option value="">All severities</option>
                {['Low', 'Moderate', 'High', 'Critical'].map(s => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </select>

              <select
                className="admin-select"
                value={filters.status}
                onChange={e => setFilter('status', e.target.value)}
              >
                <option value="">All statuses</option>
                {['active', 'completed', 'abandoned'].map(s => (
                  <option key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</option>
                ))}
              </select>

              <label className="admin-emergency-filter">
                <input
                  type="checkbox"
                  checked={filters.emergency === 'true'}
                  onChange={e => setFilter('emergency', e.target.checked ? 'true' : '')}
                />
                Emergencies only
              </label>

              <button
                className="admin-clear-filter"
                onClick={() => setFilters({ severity: '', emergency: '', status: '' })}
              >
                Clear
              </button>
            </div>
          )}
        </div>

        {/* Table */}
        <div className="admin-card" style={{ padding: 0, overflow: 'hidden' }}>
          {loading ? (
            <div className="admin-loading" style={{ minHeight: 200 }}>
              <div className="admin-spinner" />
            </div>
          ) : (
            <table className="admin-table">
              <thead>
                <tr>
                  <th>User</th>
                  <th>Mode</th>
                  <th>Status</th>
                  <th>Severity</th>
                  <th>Emergency</th>
                  <th>Date</th>
                </tr>
              </thead>
              <tbody>
                {sessions.map((s) => {
                  const sev = severityColor[s.severityLevel];
                  return (
                    <tr key={s._id}>
                      <td>
                        <div>
                          <p className="admin-user-name">{s.user?.name || 'Unknown'}</p>
                          <p className="admin-user-email">{s.user?.email || ''}</p>
                        </div>
                      </td>
                      <td style={{ fontSize: 12, color: '#64748b' }}>
                        {s.mode === 'full' ? 'Full Assessment' : 'Quick Check'}
                      </td>
                      <td>
                        <span className={`admin-status-badge ${s.status}`}>
                          {s.status.charAt(0).toUpperCase() + s.status.slice(1)}
                        </span>
                      </td>
                      <td>
                        {s.severityLevel ? (
                          <span
                            className="admin-sev-badge"
                            style={{ background: sev?.bg, color: sev?.text }}
                          >
                            {s.severityLevel}
                            {s.severityScore ? ` (${s.severityScore}/10)` : ''}
                          </span>
                        ) : (
                          <span style={{ fontSize: 11, color: '#cbd5e1' }}>—</span>
                        )}
                      </td>
                      <td>
                        {s.emergencyDetected && (
                          <AlertTriangle size={15} color="#ef4444" />
                        )}
                      </td>
                      <td style={{ fontSize: 12, color: '#94a3b8' }}>
                        {new Date(s.createdAt).toLocaleDateString('en-GB', {
                          day: 'numeric', month: 'short', year: 'numeric',
                        })}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>

        {/* Pagination */}
        {pages > 1 && (
          <div className="admin-pagination">
            <button
              className="admin-page-btn"
              onClick={() => setPage(p => p - 1)}
              disabled={page === 1}
            >
              <ChevronLeft size={15} />
            </button>
            <span className="admin-page-info">Page {page} of {pages}</span>
            <button
              className="admin-page-btn"
              onClick={() => setPage(p => p + 1)}
              disabled={page === pages}
            >
              <ChevronRight size={15} />
            </button>
          </div>
        )}
      </div>
    </div>
  );
}