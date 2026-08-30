import { useState } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { Shield, CheckCircle2 } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import adminApi from '../../api/adminApi';
import toast from 'react-hot-toast';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

export default function AcceptAdminInvite() {
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token');
  const navigate = useNavigate();
  const [form, setForm] = useState({ password: '', confirmPassword: '' });
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (form.password.length < 6) return toast.error('Password must be at least 6 characters');
    if (form.password !== form.confirmPassword) return toast.error('Passwords do not match');
    if (!token) return toast.error('Missing invite token');

    setLoading(true);
    try {
      await adminApi.post('/admin/auth/accept-invite', { token, password: form.password });
      setDone(true);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Could not accept invite');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-ink px-4 py-8">
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
        className="w-full max-w-[400px]"
      >
        <div className="mb-8 flex flex-col items-center gap-3 text-center">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-ink-foreground/10 text-ink-foreground">
            <Shield size={22} />
          </div>
          <div>
            <p className="font-heading text-lg font-bold text-ink-foreground">MediSense Admin</p>
            <p className="text-[13px] text-ink-foreground/50">Accept your invitation</p>
          </div>
        </div>

        <Card className="rounded-2xl border-border/70 shadow-lg">
          <CardContent className="p-8">
            <AnimatePresence mode="wait">
              {done ? (
                <motion.div key="done" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.25 }}>
                  <div className="mb-6 flex h-14 w-14 items-center justify-center rounded-full bg-severity-low-bg">
                    <CheckCircle2 size={26} className="text-severity-low-fg" />
                  </div>
                  <h1 className="mb-2 font-heading text-xl font-bold text-foreground">You're all set</h1>
                  <p className="mb-7 text-sm leading-relaxed text-muted-foreground">
                    Your password has been set. You can now sign in to the admin panel.
                  </p>
                  <Button className="w-full rounded-full" onClick={() => navigate('/admin/login')}>
                    Go to admin sign-in
                  </Button>
                </motion.div>
              ) : (
                <motion.div key="form" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.25 }}>
                  <h1 className="mb-1 font-heading text-xl font-bold text-foreground">Set your password</h1>
                  <p className="mb-6 text-sm text-muted-foreground">Choose a password to activate your admin account</p>

                  <form onSubmit={handleSubmit} className="space-y-5">
                    <div className="space-y-2">
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
                    <div className="space-y-2">
                      <Label htmlFor="confirmPassword">Confirm password</Label>
                      <Input
                        id="confirmPassword"
                        type="password"
                        placeholder="Re-enter password"
                        className="h-11"
                        value={form.confirmPassword}
                        onChange={(e) => setForm({ ...form, confirmPassword: e.target.value })}
                        required
                      />
                    </div>
                    <Button type="submit" disabled={loading} className="h-11 w-full rounded-full">
                      {loading ? 'Setting password...' : 'Activate account'}
                    </Button>
                  </form>
                </motion.div>
              )}
            </AnimatePresence>
          </CardContent>
        </Card>
      </motion.div>
    </div>
  );
}
