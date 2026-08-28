import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ArrowLeft, Shield, Search, ChevronLeft,
  ChevronRight, CheckCircle, XCircle, User,
} from 'lucide-react';
import api from '../../api/axios';
import './Admin.css';

export default function AdminUsers() {
  const navigate = useNavigate();
  const [users, setUsers] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pages, setPages] = useState(1);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [toggling, setToggling] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get('/admin/users', { params: { page, limit: 20, search } });
      setUsers(res.data.users);
      setTotal(res.data.total);
      setPages(res.data.pages);
    } catch {
      navigate('/dashboard');
    } finally {
      setLoading(false);
    }
  }, [page, search]);

  useEffect(() => { load(); }, [load]);

  const handleSearch = (e) => {
    setSearch(e.target.value);
    setPage(1);
  };

  const handleToggle = async (userId, currentStatus) => {
    if (!window.confirm(`${currentStatus ? 'Deactivate' : 'Activate'} this user?`)) return;
    setToggling(userId);
    try {
      await api.patch(`/admin/users/${userId}/toggle`);
      setUsers(prev => prev.map(u =>
        u._id === userId ? { ...u, isActive: !u.isActive } : u
      ));
    } catch {
      alert('Failed to update user status');
    } finally {
      setToggling(null);
    }
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
            <p className="admin-title">User Management</p>
            <p className="admin-sub">{total} user{total !== 1 ? 's' : ''} total</p>
          </div>
        </div>
        <div className="admin-nav-btns">
          <button className="admin-nav-btn" onClick={() => navigate('/admin')}>Overview</button>
          <button className="admin-nav-btn active">Users</button>
          <button className="admin-nav-btn" onClick={() => navigate('/admin/sessions')}>Sessions</button>
        </div>
      </div>

      <div className="admin-body">
        {/* Search */}
        <div className="admin-search-wrap">
          <Search size={15} className="admin-search-icon" />
          <input
            className="admin-search"
            placeholder="Search by name or email..."
            value={search}
            onChange={handleSearch}
          />
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
                  <th>Role</th>
                  <th>Sessions</th>
                  <th>Verified</th>
                  <th>Joined</th>
                  <th>Status</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {users.map((u) => (
                  <tr key={u._id}>
                    <td>
                      <div className="admin-user-cell">
                        <div className="admin-user-avatar">
                          <User size={14} />
                        </div>
                        <div>
                          <p className="admin-user-name">{u.name}</p>
                          <p className="admin-user-email">{u.email}</p>
                        </div>
                      </div>
                    </td>
                    <td>
                      <span className={`admin-role-badge ${u.role}`}>{u.role}</span>
                    </td>
                    <td style={{ fontSize: 13, color: '#64748b' }}>{u.sessionCount}</td>
                    <td>
                      {u.isEmailVerified
                        ? <CheckCircle size={15} color="#22c55e" />
                        : <XCircle size={15} color="#ef4444" />
                      }
                    </td>
                    <td style={{ fontSize: 12, color: '#94a3b8' }}>
                      {new Date(u.createdAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
                    </td>
                    <td>
                      <span className={`admin-status-badge ${u.isActive ? 'active' : 'inactive'}`}>
                        {u.isActive ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                    <td>
                      {u.role !== 'admin' && (
                        <button
                          className={`admin-toggle-btn ${u.isActive ? 'deactivate' : 'activate'}`}
                          onClick={() => handleToggle(u._id, u.isActive)}
                          disabled={toggling === u._id}
                        >
                          {toggling === u._id ? '...' : u.isActive ? 'Deactivate' : 'Activate'}
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
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