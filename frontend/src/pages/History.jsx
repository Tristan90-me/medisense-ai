import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ArrowLeft, Activity, ChevronRight,
  Clock, CheckCircle, AlertCircle, Search, X,
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import api from '../api/axios';
import { cn } from '@/lib/utils';
import { Skeleton } from '@/components/ui/skeleton';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

const SEVERITY_CLASSES = {
  Low: { bg: 'bg-severity-low-bg', fg: 'text-severity-low-fg', dot: 'bg-severity-low' },
  Moderate: { bg: 'bg-severity-moderate-bg', fg: 'text-severity-moderate-fg', dot: 'bg-severity-moderate' },
  High: { bg: 'bg-severity-high-bg', fg: 'text-severity-high-fg', dot: 'bg-severity-high' },
  Critical: { bg: 'bg-severity-critical-bg', fg: 'text-severity-critical-fg', dot: 'bg-severity-critical' },
};

const modeLabel = { quick: 'Quick Check', full: 'Full Assessment' };

const FILTERS = ['all', 'active', 'completed'];
const SEVERITY_FILTERS = ['all', 'Low', 'Moderate', 'High', 'Critical'];
const SEVERITY_ORDER = { Critical: 4, High: 3, Moderate: 2, Low: 1 };
const RANGE_DAYS = { all: null, '7': 7, '30': 30, '90': 90 };
const RANGE_LABELS = { all: 'All time', '7': 'Last 7 days', '30': 'Last 30 days', '90': 'Last 90 days' };
const SORTS = {
  newest: { label: 'Newest first', cmp: (a, b) => new Date(b.createdAt) - new Date(a.createdAt) },
  oldest: { label: 'Oldest first', cmp: (a, b) => new Date(a.createdAt) - new Date(b.createdAt) },
  'severity-high': {
    label: 'Severity: high to low',
    cmp: (a, b) => (SEVERITY_ORDER[b.severityLevel] || 0) - (SEVERITY_ORDER[a.severityLevel] || 0),
  },
  'severity-low': {
    label: 'Severity: low to high',
    cmp: (a, b) => (SEVERITY_ORDER[a.severityLevel] || 0) - (SEVERITY_ORDER[b.severityLevel] || 0),
  },
};

export default function History() {
  const navigate = useNavigate();
  const [sessions, setSessions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all');
  const [severityFilter, setSeverityFilter] = useState('all');
  const [range, setRange] = useState('all');
  const [sort, setSort] = useState('newest');
  const [search, setSearch] = useState('');
  // Captured once at mount — a stable "now" for the age filter below avoids
  // calling Date.now() directly in the render body on every re-render.
  const [now] = useState(() => Date.now());

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

  const cutoffDays = RANGE_DAYS[range];
  const searchQuery = search.trim().toLowerCase();

  const filtered = sessions
    .filter((s) => filter === 'all' || s.status === filter)
    .filter((s) => severityFilter === 'all' || s.severityLevel === severityFilter)
    .filter((s) => cutoffDays == null || now - new Date(s.createdAt).getTime() <= cutoffDays * 86400000)
    .filter((s) => {
      if (!searchQuery) return true;
      const modeText = (modeLabel[s.mode] || s.mode || '').toLowerCase();
      const symptomText = (s.symptoms || []).map((sym) => sym.name.toLowerCase()).join(' ');
      return modeText.includes(searchQuery) || symptomText.includes(searchQuery);
    })
    .sort(SORTS[sort].cmp);

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
          aria-label="Go back"
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
              {filtered.length === sessions.length
                ? `${sessions.length} session${sessions.length !== 1 ? 's' : ''} total`
                : `${filtered.length} of ${sessions.length} sessions`}
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

      {/* Search + filters */}
      <div className="flex flex-col gap-2.5 border-b border-border bg-card px-4 py-3">
        <div className="relative">
          <Search size={14} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by symptom or assessment type..."
            className="pl-8 pr-8"
            aria-label="Search sessions"
          />
          {search && (
            <button
              onClick={() => setSearch('')}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              aria-label="Clear search"
            >
              <X size={14} />
            </button>
          )}
        </div>

        <div className="flex flex-wrap gap-1.5">
          {SEVERITY_FILTERS.map((s) => (
            <button
              key={s}
              onClick={() => setSeverityFilter(s)}
              className={cn(
                'rounded-full border px-3 py-1 text-[11px] font-medium transition-colors',
                severityFilter === s
                  ? 'border-primary bg-primary text-primary-foreground'
                  : 'border-border bg-background text-muted-foreground hover:bg-accent'
              )}
            >
              {s === 'all' ? 'Any severity' : s}
            </button>
          ))}
        </div>

        <div className="flex gap-2">
          <Select value={range} onValueChange={setRange}>
            <SelectTrigger className="h-8 flex-1 text-xs" aria-label="Filter by time range">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {Object.keys(RANGE_DAYS).map((key) => (
                <SelectItem key={key} value={key}>{RANGE_LABELS[key]}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={sort} onValueChange={setSort}>
            <SelectTrigger className="h-8 flex-1 text-xs" aria-label="Sort sessions">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {Object.entries(SORTS).map(([key, { label }]) => (
                <SelectItem key={key} value={key}>{label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
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

        {!loading && filtered.length === 0 && sessions.length === 0 && (
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

        {!loading && filtered.length === 0 && sessions.length > 0 && (
          <div className="flex flex-col items-center justify-center gap-2 px-4 py-12 text-center">
            <p className="text-4xl">🔍</p>
            <p className="text-base font-semibold text-foreground">No matching sessions</p>
            <p className="max-w-[280px] text-sm leading-relaxed text-muted-foreground">
              Try a different search term, or widen your filters.
            </p>
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
