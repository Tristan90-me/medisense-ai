import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Mail } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import api from '../api/axios';
import toast from 'react-hot-toast';
import AuthShell from '../components/auth/AuthShell';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

const SIDE_POINTS = [
  'Free to use — no credit card required',
  'Your data stays private to your account',
  'Set up your health profile in under two minutes',
];

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

  return (
    <AuthShell
      sideTitle="Get a doctor-style read on your symptoms."
      sideSubtitle="Create your free account and MediSense will ask the right follow-up questions, weigh your health profile, and give you a ranked differential — available anytime."
      sidePoints={SIDE_POINTS}
    >
      <AnimatePresence mode="wait">
        {done ? (
          <motion.div key="done" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.25 }}>
            <motion.div
              initial={{ scale: 0.6, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ delay: 0.1, type: 'spring', stiffness: 260, damping: 18 }}
              className="mb-6 flex h-14 w-14 items-center justify-center rounded-full bg-primary/10"
            >
              <Mail size={26} className="text-primary" />
            </motion.div>
            <h1 className="mb-2 font-heading text-[28px] font-bold text-foreground">Check your inbox</h1>
            <p className="mb-8 text-sm leading-relaxed text-muted-foreground">
              We sent a verification link to <strong className="text-foreground">{form.email}</strong>. Click it to activate your account before logging in.
            </p>
            <p className="text-[13px] text-muted-foreground">
              Didn't get it?{' '}
              <button
                className="font-semibold text-primary hover:underline"
                onClick={async () => {
                  try {
                    await api.post('/auth/resend-verification', { email: form.email });
                    toast.success('Verification email resent!');
                  } catch {
                    toast.error('Could not resend. Try again.');
                  }
                }}
              >
                Resend email
              </button>
            </p>
            <Button className="mt-7 w-full rounded-full" onClick={() => navigate('/login')}>
              Go to login
            </Button>
          </motion.div>
        ) : (
          <motion.div key="form" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.25 }}>
            <h1 className="mb-3 font-heading text-[28px] font-bold text-foreground">Create your account</h1>
            <p className="mb-9 text-sm text-muted-foreground">Start your personalized health journey</p>

            <form onSubmit={handleSubmit} className="space-y-6">
              <div className="space-y-2.5">
                <Label htmlFor="name">Full name</Label>
                <Input
                  id="name"
                  placeholder="Jay Kofi"
                  className="h-11"
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  required
                />
              </div>
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
                  placeholder="Min. 6 characters"
                  className="h-11"
                  value={form.password}
                  onChange={(e) => setForm({ ...form, password: e.target.value })}
                  required
                />
              </div>
              <Button type="submit" disabled={loading} className="h-11 w-full rounded-full">
                {loading ? 'Creating account...' : 'Create account'}
              </Button>
            </form>

            <p className="mt-8 text-center text-sm text-muted-foreground">
              Already have an account? <Link to="/login" className="font-semibold text-primary hover:underline">Sign in</Link>
            </p>
          </motion.div>
        )}
      </AnimatePresence>
    </AuthShell>
  );
}
