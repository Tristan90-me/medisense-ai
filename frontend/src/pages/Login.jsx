import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import api from '../api/axios';
import toast from 'react-hot-toast';
import AuthShell from '../components/auth/AuthShell';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

const SIDE_POINTS = [
  'A ranked differential, not just one guess',
  'Personalized to your age, history, and conditions',
  'Emergency symptoms flagged immediately',
];

export default function Login() {
  const { setAuth, setDeviceToken, setPendingEmail, deviceToken } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({ email: '', password: '' });
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const res = await api.post('/auth/login', {
        email: form.email,
        password: form.password,
        deviceToken,
      });

      if (res.data.step === 'done') {
        setAuth(res.data.user, res.data.token);
        toast.success('Welcome back!');
        navigate('/dashboard');
      } else {
        setPendingEmail(form.email);
        navigate('/verify-otp');
      }
    } catch (err) {
      const msg = err.response?.data?.message || 'Login failed';
      const code = err.response?.data?.code;
      if (code === 'EMAIL_NOT_VERIFIED') {
        toast.error(msg);
        navigate('/check-email', { state: { email: form.email } });
      } else {
        toast.error(msg);
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthShell
      sideTitle="Understand your symptoms in minutes."
      sideSubtitle="Sign back in to pick up where you left off — your health profile, session history, and personalized assessments are all waiting."
      sidePoints={SIDE_POINTS}
    >
      <h1 className="mb-3 font-heading text-[28px] font-bold text-foreground">Welcome back</h1>
      <p className="mb-9 text-sm text-muted-foreground">Sign in to your health dashboard</p>

      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="space-y-2.5">
          <Label htmlFor="email">Email</Label>
          <Input
            id="email"
            type="email"
            placeholder="you@example.com"
            className="h-11"
            value={form.email}
            onChange={(e) => setForm({ ...form, email: e.target.value })}
            required
          />
        </div>
        <div className="space-y-2.5">
          <Label htmlFor="password">Password</Label>
          <Input
            id="password"
            type="password"
            placeholder="••••••••"
            className="h-11"
            value={form.password}
            onChange={(e) => setForm({ ...form, password: e.target.value })}
            required
          />
        </div>
        <Button type="submit" disabled={loading} className="h-11 w-full rounded-full">
          {loading ? 'Signing in...' : 'Sign in'}
        </Button>
      </form>

      <p className="mt-8 text-center text-sm text-muted-foreground">
        No account? <Link to="/register" className="font-semibold text-primary hover:underline">Create one</Link>
      </p>
    </AuthShell>
  );
}
