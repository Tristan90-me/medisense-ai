import { useAuth } from '../context/AuthContext';

export default function Dashboard() {
  const { user, logout } = useAuth();
  return (
    <div style={{ padding: '2rem' }}>
      <h1>Welcome, {user?.name} 👋</h1>
      <p style={{ color: '#64748b', marginTop: 8 }}>Dashboard coming in Phase 5.</p>
      <button onClick={logout} style={{ marginTop: '1rem', padding: '8px 16px', background: '#ef4444', color: '#fff', border: 'none', borderRadius: 8, cursor: 'pointer' }}>
        Logout
      </button>
    </div>
  );
}