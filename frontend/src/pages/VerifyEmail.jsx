import { useEffect, useState } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { Activity, CheckCircle, XCircle, Loader2 } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import api from '../api/axios';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';

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
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-primary/5 via-background to-severity-low-bg px-4 py-8">
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
        className="w-full max-w-[420px]"
      >
        <Card className="rounded-2xl border-border/70 text-center shadow-lg">
          <CardContent className="p-8">
            <div className="mb-6 flex items-center justify-center gap-2">
              <div className="flex h-9 w-9 items-center justify-center rounded-[10px] bg-primary text-primary-foreground">
                <Activity size={20} />
              </div>
              <span className="font-heading text-lg font-bold text-foreground">MediSense AI</span>
            </div>

            <AnimatePresence mode="wait">
              {status === 'loading' && (
                <motion.div key="loading" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                  <p className="mb-4 text-sm text-muted-foreground">Verifying your email...</p>
                  <Loader2 size={36} className="mx-auto animate-spin text-primary" />
                </motion.div>
              )}

              {status === 'success' && (
                <motion.div
                  key="success"
                  initial={{ opacity: 0, scale: 0.8 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ type: 'spring', stiffness: 260, damping: 18 }}
                >
                  <CheckCircle size={48} className="mx-auto mb-4 text-severity-low" />
                  <h1 className="mb-1 font-heading text-xl font-bold text-foreground">Email verified!</h1>
                  <p className="mb-6 text-sm text-muted-foreground">{message}</p>
                  <Button className="w-full rounded-full" onClick={() => navigate('/login')}>Go to login</Button>
                </motion.div>
              )}

              {status === 'error' && (
                <motion.div
                  key="error"
                  initial={{ opacity: 0, scale: 0.8 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ type: 'spring', stiffness: 260, damping: 18 }}
                >
                  <XCircle size={48} className="mx-auto mb-4 text-severity-high" />
                  <h1 className="mb-1 font-heading text-xl font-bold text-foreground">Verification failed</h1>
                  <p className="mb-6 text-sm text-muted-foreground">{message}</p>
                  <Button className="w-full rounded-full" onClick={() => navigate('/register')}>Back to register</Button>
                </motion.div>
              )}
            </AnimatePresence>
          </CardContent>
        </Card>
      </motion.div>
    </div>
  );
}
