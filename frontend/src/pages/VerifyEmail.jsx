import { useEffect, useState } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { Activity, CheckCircle, XCircle } from 'lucide-react';
import api from '../api/axios';

export default function VerifyEmail() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [status, setStatus] = useState('loading');
  const [message, setMessage] = useState('');

  useEffect(() => {
    const token = searchParams.get('token');
    if (!token) { setStatus('error'); setMessage('No verification token found.'); return; }
    api.get(`/auth/verify-email/${token}`)
      .then(res => { setStatus('success'); setMessage(res.data.message); })
      .catch(err => { setStatus('error'); setMessage(err.response?.data?.message || 'Verification failed.'); });
  }, []);

  return (
    <div className="auth-wrapper">
      <div className="auth-card" style={{ textAlign: 'center' }}>
        <div className="auth-logo" style={{ justifyContent: 'center' }}>
          <div className="auth-logo-icon"><Activity size={20} /></div>
          <span className="auth-logo-name">MediSense AI</span>
        </div>

        {status === 'loading' && (
          <>
            <p className="auth-subtitle">Verifying your email...</p>
            <div style={{ width: 40, height: 40, border: '3px solid #dbeafe', borderTopColor: '#3b82f6', borderRadius: '50%', animation: 'spin 0.8s linear infinite', margin: '1rem auto' }} />
          </>
        )}

        {status === 'success' && (
          <>
            <CheckCircle size={48} color="#22c55e" style={{ margin: '0 auto 1rem' }} />
            <h1 className="auth-title">Email verified!</h1>
            <p className="auth-subtitle">{message}</p>
            <button className="btn-blue" onClick={() => navigate('/login')}>Go to login</button>
          </>
        )}

        {status === 'error' && (
          <>
            <XCircle size={48} color="#ef4444" style={{ margin: '0 auto 1rem' }} />
            <h1 className="auth-title">Verification failed</h1>
            <p className="auth-subtitle">{message}</p>
            <button className="btn-blue" onClick={() => navigate('/register')}>Back to register</button>
          </>
        )}
      </div>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}