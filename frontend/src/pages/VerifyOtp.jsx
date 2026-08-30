import { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Activity, Shield } from 'lucide-react';
import { motion } from 'framer-motion';
import { useAuth } from '../context/AuthContext';
import api from '../api/axios';
import toast from 'react-hot-toast';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { cn } from '@/lib/utils';

const REMEMBER_OPTIONS = [
  { label: 'Ask every time', val: null },
  { label: '7 days', val: 7 },
  { label: '14 days', val: 14 },
];

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
      await api.post('/auth/resend-otp', { email: pendingEmail });
      toast.success('A new code has been sent to your email.');
      setResendTimer(60);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Could not resend code');
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-primary/5 via-background to-severity-low-bg px-4 py-8">
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
        className="w-full max-w-[420px]"
      >
        <Card className="rounded-2xl border-border/70 shadow-lg">
          <CardContent className="p-8">
            <div className="mb-6 flex items-center gap-2">
              <div className="flex h-9 w-9 items-center justify-center rounded-[10px] bg-primary text-primary-foreground">
                <Activity size={20} />
              </div>
              <span className="font-heading text-lg font-bold text-foreground">MediSense AI</span>
            </div>

            <div className="mb-6 text-center">
              <div className="mx-auto mb-4 flex h-[52px] w-[52px] items-center justify-center rounded-full bg-primary/10">
                <Shield size={26} className="text-primary" />
              </div>
              <h1 className="mb-1 font-heading text-xl font-bold text-foreground">Check your email</h1>
              <p className="text-sm text-muted-foreground">
                We sent a 6-digit code to <strong className="text-foreground">{pendingEmail}</strong>.<br />It expires in 10 minutes.
              </p>
            </div>

            <form onSubmit={handleSubmit}>
              <div className="mb-6 flex justify-center gap-2" onPaste={handlePaste}>
                {digits.map((d, i) => (
                  <input
                    key={i}
                    ref={el => inputRefs.current[i] = el}
                    type="text"
                    inputMode="numeric"
                    maxLength={1}
                    value={d}
                    onChange={e => handleDigit(i, e.target.value)}
                    onKeyDown={e => handleKeyDown(i, e)}
                    className={cn(
                      'h-[54px] w-[46px] rounded-[10px] border text-center text-xl font-bold outline-none transition-all',
                      d ? 'border-primary bg-primary/10 text-foreground' : 'border-input bg-muted/40 text-foreground'
                    )}
                  />
                ))}
              </div>

              <div className="mb-5 rounded-xl border border-border bg-muted/30 p-4">
                <p className="mb-2.5 text-[13px] font-semibold text-foreground">Keep me logged in</p>
                <div className="flex gap-2">
                  {REMEMBER_OPTIONS.map(opt => (
                    <button
                      key={String(opt.val)}
                      type="button"
                      onClick={() => setRememberDays(opt.val)}
                      className={cn(
                        'flex-1 rounded-lg border px-2 py-1.5 text-xs font-medium transition-all',
                        rememberDays === opt.val
                          ? 'border-primary bg-primary/10 text-primary'
                          : 'border-input bg-card text-muted-foreground'
                      )}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
                <p className="mt-2 text-[11px] text-muted-foreground">
                  {rememberDays
                    ? `This device will be trusted for ${rememberDays} days.`
                    : 'You will be asked for a code every time you log in.'}
                </p>
              </div>

              <Button type="submit" disabled={loading || digits.join('').length < 6} className="w-full rounded-full">
                {loading ? 'Verifying...' : 'Confirm login'}
              </Button>
            </form>

            <p className="mt-4 text-center text-[13px] text-muted-foreground">
              Didn't receive it?{' '}
              {resendTimer > 0
                ? <span>Resend in {resendTimer}s</span>
                : <button className="font-semibold text-primary hover:underline" onClick={handleResend}>Resend code</button>
              }
            </p>
            <p className="mt-2 text-center text-[13px] text-muted-foreground">
              <button className="text-primary hover:underline" onClick={() => navigate('/login')}>← Back to login</button>
            </p>
          </CardContent>
        </Card>
      </motion.div>
    </div>
  );
}
