import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ArrowLeft, Activity, ChevronRight,
  Clock, CheckCircle, AlertCircle,
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import api from '../api/axios';
import { cn } from '@/lib/utils';
import { Skeleton } from '@/components/ui/skeleton';

const SEVERITY_CLASSES = {
  Low: { bg: 'bg-severity-low-bg', fg: 'text-severity-low-fg', dot: 'bg-severity-low' },
  Moderate: { bg: 'bg-severity-moderate-bg', fg: 'text-severity-moderate-fg', dot: 'bg-severity-moderate' },
  High: { bg: 'bg-severity-high-bg', fg: 'text-severity-high-fg', dot: 'bg-severity-high' },
  Critical: { bg: 'bg-severity-critical-bg', fg: 'text-severity-critical-fg', dot: 'bg-severity-critical' },
};

const modeLabel = { quick: 'Quick Check', full: 'Full Assessment' };

const FILTERS = ['all', 'active', 'completed'];

export default function History() {
  const navigate = useNavigate();
  const [sessions, setSessions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all');

  useEffect(() => {
    const fetch = async () => {
      try {
        const res = await api.get('/ai/sessions');
        setSessions(res.data.sessions);
      } catch {
        // fail silently
      } finally {
        setLoading(false);
      }
    };
    fetch();
  }, []);

  const filtered = sessions.filter((s) => {
    if (filter === 'all') return true;
    return s.status === filter;
  });

  const formatDate = (d) => {
    const date = new Date(d);
    return date.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
  };

  const formatTime = (d) => {
    return new Date(d).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
  };

  return (
    <div className="flex min-h-screen flex-col bg-background">
      {/* Header */}
      <div className="flex items-center gap-3 border-b border-border bg-card px-4 py-3">
        <button
          onClick={() => navigate('/dashboard')}
          className="flex rounded-lg p-1 text-muted-foreground transition-colors hover:bg-accent"
        >
          <ArrowLeft size={18} />
        </button>
        <div className="flex items-center gap-2.5">
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10 text-primary">
            <Activity size={16} />
          </div>
          <div>
            <p className="font-heading text-sm font-semibold text-foreground">Session History</p>
            <p className="text-[11px] text-muted-foreground">
              {sessions.length} session{sessions.length !== 1 ? 's' : ''} total
            </p>
          </div>
        </div>
      </div>

      {/* Filter tabs */}
      <div className="flex gap-2 border-b border-border bg-card px-4 py-3">
        {FILTERS.map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={cn(
              'relative rounded-full border px-4 py-1.5 text-xs font-medium transition-colors',
              filter === f
                ? 'border-primary bg-primary text-primary-foreground'
                : 'border-border bg-background text-muted-foreground hover:bg-accent'
            )}
          >
            {f.charAt(0).toUpperCase() + f.slice(1)}
          </button>
        ))}
      </div>

      {/* List */}
      <div className="mx-auto flex w-full max-w-[640px] flex-1 flex-col gap-2 px-4 py-3">
        {loading && (
          <div className="flex flex-col gap-2">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="flex items-center gap-3 rounded-2xl border border-border bg-card p-4">
                <Skeleton className="h-[38px] w-[38px] shrink-0 rounded-[10px]" />
                <div className="flex-1 space-y-2">
                  <Skeleton className="h-3.5 w-28" />
                  <Skeleton className="h-3 w-40" />
                </div>
              </div>
            ))}
          </div>
        )}

        {!loading && filtered.length === 0 && (
          <div className="flex flex-col items-center justify-center gap-3 px-4 py-12 text-center">
            <p className="text-4xl">🩺</p>
            <p className="text-base font-semibold text-foreground">No sessions yet</p>
            <p className="max-w-[280px] text-sm leading-relaxed text-muted-foreground">
              Start a Quick Check or Full Assessment to see your history here.
            </p>
            <button
              onClick={() => navigate('/session?mode=quick')}
              className="mt-2 rounded-full bg-primary px-[22px] py-2.5 text-[13px] font-medium text-primary-foreground transition-colors hover:bg-primary/90"
            >
              Start your first check
            </button>
          </div>
        )}

        <AnimatePresence mode="popLayout">
          {!loading && filtered.map((s, i) => {
            const sev = SEVERITY_CLASSES[s.severityLevel];
            return (
              <motion.button
                key={s._id}
                layout
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.97 }}
                transition={{ duration: 0.25, delay: i * 0.03, ease: [0.16, 1, 0.3, 1] }}
                onClick={() => navigate(`/history/${s._id}`)}
                className="flex w-full items-center justify-between rounded-2xl border border-border bg-card p-4 text-left shadow-sm transition-shadow hover:shadow-md"
              >
                {/* Left */}
                <div className="flex items-start gap-3">
                  <div
                    className={cn(
                      'flex h-[38px] w-[38px] shrink-0 items-center justify-center rounded-[10px]',
                      sev ? sev.bg : 'bg-muted'
                    )}
                  >
                    {s.status === 'completed' ? (
                      <CheckCircle size={16} className={sev ? sev.fg : 'text-muted-foreground'} />
                    ) : (
                      <Clock size={16} className="text-muted-foreground" />
                    )}
                  </div>
                  <div>
                    <p className="text-[13px] font-semibold text-foreground">{modeLabel[s.mode] || s.mode}</p>
                    <p className="mt-0.5 text-[11px] text-muted-foreground">
                      {formatDate(s.createdAt)} · {formatTime(s.createdAt)}
                    </p>
                    {s.symptoms?.length > 0 && (
                      <p className="mt-1 max-w-[220px] truncate text-[11px] text-muted-foreground">
                        {s.symptoms.slice(0, 3).map((sym) => sym.name).join(', ')}
                        {s.symptoms.length > 3 ? ` +${s.symptoms.length - 3} more` : ''}
                      </p>
                    )}
                  </div>
                </div>

                {/* Right */}
                <div className="flex shrink-0 items-center gap-2">
                  {s.severityLevel && (
                    <span
                      className={cn(
                        'flex items-center gap-1.5 rounded-full px-2.5 py-[3px] text-[11px] font-semibold',
                        sev.bg,
                        sev.fg
                      )}
                    >
                      <span className={cn('h-1.5 w-1.5 rounded-full', sev.dot)} />
                      {s.severityLevel}
                    </span>
                  )}
                  {s.emergencyDetected && <AlertCircle size={16} className="text-destructive" />}
                  <ChevronRight size={16} className="text-muted-foreground/50" />
                </div>
              </motion.button>
            );
          })}
        </AnimatePresence>
      </div>
    </div>
  );
}
