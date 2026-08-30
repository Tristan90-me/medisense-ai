import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Shield } from 'lucide-react';
import { motion } from 'framer-motion';
import { useAdminAuth } from '../../context/AdminAuthContext';
import adminApi from '../../api/adminApi';
import toast from 'react-hot-toast';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

export default function AdminLogin() {
  const { setPendingEmail } = useAdminAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({ email: '', password: '' });
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const res = await adminApi.post('/admin/auth/login', {
        email: form.email,
        password: form.password,
      });
      if (res.data.step === 'otp') {
        setPendingEmail(form.email);
        navigate('/admin/verify-otp');
      }
    } catch (err) {
      toast.error(err.response?.data?.message || 'Login failed');
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
            <p className="text-[13px] text-ink-foreground/50">Back-office access only</p>
          </div>
        </div>

        <Card className="rounded-2xl border-border/70 shadow-lg">
          <CardContent className="p-8">
            <h1 className="mb-1 font-heading text-xl font-bold text-foreground">Admin sign-in</h1>
            <p className="mb-6 text-sm text-muted-foreground">Enter your credentials to continue</p>

            <form onSubmit={handleSubmit} className="space-y-5">
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="admin@example.com"
                  className="h-11"
                  value={form.email}
                  onChange={(e) => setForm({ ...form, email: e.target.value })}
                  required
                />
              </div>
              <div className="space-y-2">
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
          </CardContent>
        </Card>
      </motion.div>
    </div>
  );
}
