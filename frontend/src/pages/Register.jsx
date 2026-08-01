import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Activity, Mail } from 'lucide-react';
import api from '../api/axios';
import toast from 'react-hot-toast';

export default function Register() {
  const navigate = useNavigate();
  const [form, setForm] = useState({ name: '', email: '', password: '' });
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (form.password.length < 6) return toast.error('Password must be at least 6 characters');
    setLoading(true);
    try {
      await api.post('/auth/register', form);
      setDone(true);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Registration failed');
    } finally {
      setLoading(false);
    }
  };

  if (done) return (
    <div className="auth-wrapper">
      <div className="auth-card" style={{ textAlign: 'center' }}>
        <div style={{ width: 56, height: 56, background: '#eff6ff', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 1.25rem' }}>
          <Mail size={26} color="#3b82f6" />
        </div>
        <h1 className="auth-title">Check your inbox</h1>
        <p className="auth-subtitle" style={{ marginBottom: '1.5rem' }}>
          We sent a verification link to <strong>{form.email}</strong>. Click it to activate your account before logging in.
        </p>
        <p style={{ fontSize: 13, color: '#94a3b8' }}>
          Didn't get it?{' '}
          <span style={{ color: '#3b82f6', cursor: 'pointer', fontWeight: 600 }}
            onClick={async () => {
              try {
                await api.post('/auth/resend-verification', { email: form.email });
                toast.success('Verification email resent!');
              } catch { toast.error('Could not resend. Try again.'); }
            }}>
            Resend email
          </span>
        </p>
        <button className="btn-blue" style={{ marginTop: '1.5rem' }} onClick={() => navigate('/login')}>
          Go to login
        </button>
      </div>
    </div>
  );

  return (
    <div className="auth-wrapper">
      <div className="auth-card">
        <div className="auth-logo">
          <div className="auth-logo-icon"><Activity size={20} /></div>
          <span className="auth-logo-name">MediSense AI</span>
        </div>
        <h1 className="auth-title">Create your account</h1>
        <p className="auth-subtitle">Start your personalized health journey</p>
        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label className="form-label">Full name</label>
            <input className="form-input" type="text" placeholder="Jay Kofi"
              value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
          </div>
          <div className="form-group">
            <label className="form-label">Email</label>
            <input className="form-input" type="email" placeholder="you@example.com"
              value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} required />
          </div>
          <div className="form-group">
            <label className="form-label">Password</label>
            <input className="form-input" type="password" placeholder="Min. 6 characters"
              value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} required />
          </div>
          <button className="btn-blue" type="submit" disabled={loading}>
            {loading ? 'Creating account...' : 'Create account'}
          </button>
        </form>
        <p className="auth-switch">Already have an account? <Link to="/login">Sign in</Link></p>
      </div>
    </div>
  );
}