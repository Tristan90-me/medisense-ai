import { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Activity, Shield } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import api from '../api/axios';
import toast from 'react-hot-toast';

export default function VerifyOtp() {
  const { pendingEmail, setAuth, setDeviceToken } = useAuth();
  const navigate = useNavigate();
  const [digits, setDigits] = useState(['', '', '', '', '', '']);
  const [rememberDays, setRememberDays] = useState(null);
  const [loading, setLoading] = useState(false);
  const [resendTimer, setResendTimer] = useState(60);
  const inputRefs = useRef([]);

  useEffect(() => {
    if (!pendingEmail) { navigate('/login'); return; }
    inputRefs.current[0]?.focus();
    const interval = setInterval(() => setResendTimer(t => t > 0 ? t - 1 : 0), 1000);
    return () => clearInterval(interval);
  }, []);

  const handleDigit = (i, val) => {
    if (!/^\d?$/.test(val)) return;
    const next = [...digits];
    next[i] = val;
    setDigits(next);
    if (val && i < 5) inputRefs.current[i + 1]?.focus();
  };

  const handleKeyDown = (i, e) => {
    if (e.key === 'Backspace' && !digits[i] && i > 0) inputRefs.current[i - 1]?.focus();
  };

  const handlePaste = (e) => {
    const pasted = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6);
    if (pasted.length === 6) {
      setDigits(pasted.split(''));
      inputRefs.current[5]?.focus();
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const otp = digits.join('');
    if (otp.length < 6) return toast.error('Enter the full 6-digit code');
    setLoading(true);
    try {
      const res = await api.post('/auth/verify-otp', {
        email: pendingEmail,
        otp,
        rememberDays,
      });
      if (res.data.deviceToken) {
        setDeviceToken(res.data.deviceToken);
      }
      setAuth(res.data.user, res.data.token);
      toast.success('Welcome back!');
      navigate('/dashboard');
    } catch (err) {
      toast.error(err.response?.data?.message || 'Invalid code');
      setDigits(['', '', '', '', '', '']);
      inputRefs.current[0]?.focus();
    } finally {
      setLoading(false);
    }
  };

  const handleResend = async () => {
    if (resendTimer > 0) return;
    try {
      await api.post('/auth/login', { email: pendingEmail, password: '__resend__' });
    } catch {}
    toast.success('A new code has been sent to your email.');
    setResendTimer(60);
  };

  return (
    <div className="auth-wrapper">
      <div className="auth-card">
        <div className="auth-logo">
          <div className="auth-logo-icon"><Activity size={20} /></div>
          <span className="auth-logo-name">MediSense AI</span>
        </div>

        <div style={{ textAlign: 'center', marginBottom: '1.5rem' }}>
          <div style={{ width: 52, height: 52, background: '#eff6ff', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 1rem' }}>
            <Shield size={26} color="#3b82f6" />
          </div>
          <h1 className="auth-title">Check your email</h1>
          <p className="auth-subtitle">
            We sent a 6-digit code to <strong>{pendingEmail}</strong>.<br />It expires in 10 minutes.
          </p>
        </div>

        <form onSubmit={handleSubmit}>
          {/* OTP digit inputs */}
          <div style={{ display: 'flex', gap: 8, justifyContent: 'center', marginBottom: '1.5rem' }} onPaste={handlePaste}>
            {digits.map((d, i) => (
              <input
                key={i}
                ref={el => inputRefs.current[i] = el}
                type="text" inputMode="numeric" maxLength={1}
                value={d}
                onChange={e => handleDigit(i, e.target.value)}
                onKeyDown={e => handleKeyDown(i, e)}
                style={{
                  width: 46, height: 54, textAlign: 'center',
                  fontSize: 22, fontWeight: 700,
                  border: `1.5px solid ${d ? '#3b82f6' : '#e2e8f0'}`,
                  borderRadius: 10, background: d ? '#eff6ff' : '#f8fafc',
                  color: '#0f2744', outline: 'none', transition: 'all 0.15s',
                }}
              />
            ))}
          </div>

          {/* Remember me toggle */}
          <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 12, padding: '1rem', marginBottom: '1.25rem' }}>
            <p style={{ fontSize: 13, fontWeight: 600, color: '#0f2744', marginBottom: '0.6rem' }}>Keep me logged in</p>
            <div style={{ display: 'flex', gap: 8 }}>
              {[
                { label: 'Ask every time', val: null },
                { label: '7 days', val: 7 },
                { label: '14 days', val: 14 },
              ].map(opt => (
                <button key={String(opt.val)} type="button"
                  onClick={() => setRememberDays(opt.val)}
                  style={{
                    flex: 1, padding: '7px 4px', fontSize: 12, fontWeight: 500,
                    border: `1.5px solid ${rememberDays === opt.val ? '#3b82f6' : '#e2e8f0'}`,
                    borderRadius: 8, cursor: 'pointer',
                    background: rememberDays === opt.val ? '#eff6ff' : '#fff',
                    color: rememberDays === opt.val ? '#3b82f6' : '#64748b',
                    transition: 'all 0.15s',
                  }}>
                  {opt.label}
                </button>
              ))}
            </div>
            <p style={{ fontSize: 11, color: '#94a3b8', marginTop: '0.5rem' }}>
              {rememberDays
                ? `This device will be trusted for ${rememberDays} days.`
                : 'You will be asked for a code every time you log in.'}
            </p>
          </div>

          <button className="btn-blue" type="submit" disabled={loading || digits.join('').length < 6}>
            {loading ? 'Verifying...' : 'Confirm login'}
          </button>
        </form>

        <p style={{ textAlign: 'center', fontSize: 13, color: '#94a3b8', marginTop: '1rem' }}>
          Didn't receive it?{' '}
          {resendTimer > 0
            ? <span>Resend in {resendTimer}s</span>
            : <span style={{ color: '#3b82f6', cursor: 'pointer', fontWeight: 600 }} onClick={handleResend}>Resend code</span>
          }
        </p>
        <p style={{ textAlign: 'center', fontSize: 13, color: '#94a3b8', marginTop: '0.5rem' }}>
          <span style={{ color: '#3b82f6', cursor: 'pointer' }} onClick={() => navigate('/login')}>← Back to login</span>
        </p>
      </div>
    </div>
  );
}