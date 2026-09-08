import { useState, useEffect, useCallback } from 'react';
import {
  AlertTriangle, ShieldAlert, CheckCircle2,
  ChevronLeft, ChevronRight, Filter,
} from 'lucide-react';
import { motion } from 'framer-motion';
import toast from 'react-hot-toast';
import adminApi from '../../api/adminApi';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Table, TableHeader, TableBody, TableHead, TableCell,
} from '@/components/ui/table';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog';

const ROW_CLASS = 'border-b transition-colors hover:bg-muted/50 last:border-0';

const SEVERITY_BADGE = {
  Low: 'bg-severity-low-bg text-severity-low-fg',
  Moderate: 'bg-severity-moderate-bg text-severity-moderate-fg',
  High: 'bg-severity-high-bg text-severity-high-fg',
  Critical: 'bg-severity-critical-bg text-severity-critical-fg',
};

// Why a session got flagged — either the LLM itself called [EMERGENCY], or
// the independent rule-based triage layer disagreed with the LLM's own
// severity call (see backend/utils/triage.js).
const flagReason = (s) => {
  if (s.emergencyDetected && s.severityMismatch) return 'Emergency + triage mismatch';
  if (s.emergencyDetected) return 'Emergency detected';
  if (s.severityMismatch) return 'Triage mismatch';
  return 'Flagged';
};

export default function AdminFlaggedSessions() {
  const [sessions, setSessions] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pages, setPages] = useState(1);
  const [status, setStatus] = useState('pending');
  const [loading, setLoading] = useState(true);
  const [showFilters, setShowFilters] = useState(false);

  const [reviewing, setReviewing] = useState(null);
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = { page, limit: 20 };
      if (status !== 'all') params.status = status;
      const res = await adminApi.get('/admin/sessions/flagged', { params });
      setSessions(res.data.sessions);
      setTotal(res.data.total);
      setPages(res.data.pages);
    } catch {
      toast.error('Failed to load flagged sessions');
    } finally {
      setLoading(false);
    }
  }, [page, status]);

  useEffect(() => { load(); }, [load]);

  const openReview = (session) => {
    setReviewing(session);
    setNotes(session.reviewNotes || '');
  };

  const submitReview = async () => {
    setSaving(true);
    try {
      await adminApi.patch(`/admin/sessions/${reviewing._id}/review`, { reviewNotes: notes });
      toast.success('Session marked as reviewed');
      setReviewing(null);
      load();
    } catch {
      toast.error('Failed to save review');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <div className="mx-auto flex max-w-[960px] flex-col gap-4 px-4 py-5">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="font-heading text-lg font-bold text-foreground">Flagged Sessions</h1>
            <p className="text-xs text-muted-foreground">{total} session{total !== 1 ? 's' : ''}</p>
          </div>
          <button
            onClick={() => setShowFilters((p) => !p)}
            className="relative flex items-center gap-1.5 rounded-full border border-border/70 bg-card px-4 py-1.5 text-xs font-medium text-muted-foreground transition-colors hover:text-foreground"
          >
            <Filter size={14} /> Filter
          </button>
        </div>

        {showFilters && (
          <div className="flex items-center gap-2.5 rounded-xl border border-border/70 bg-card p-3">
            <Select value={status} onValueChange={(v) => { setStatus(v); setPage(1); }}>
              <SelectTrigger size="sm" className="w-[160px] text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="pending">Pending review</SelectItem>
                <SelectItem value="reviewed">Reviewed</SelectItem>
                <SelectItem value="all">All flagged</SelectItem>
              </SelectContent>
            </Select>
          </div>
        )}

        <Card className="gap-0 overflow-hidden rounded-[14px] border-border/70 py-0 shadow-none">
          <Table>
            <TableHeader>
              <tr className="border-b bg-muted/40">
                <TableHead className="h-auto py-2.5 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">User</TableHead>
                <TableHead className="h-auto py-2.5 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Reason</TableHead>
                <TableHead className="h-auto py-2.5 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Severity</TableHead>
                <TableHead className="h-auto py-2.5 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Status</TableHead>
                <TableHead className="h-auto py-2.5 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Date</TableHead>
                <TableHead className="h-auto py-2.5 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground" />
              </tr>
            </TableHeader>
            <TableBody>
              {loading ? (
                Array.from({ length: 6 }).map((_, i) => (
                  <tr key={i} className={ROW_CLASS}>
                    {Array.from({ length: 6 }).map((__, j) => (
                      <TableCell key={j} className="py-3"><Skeleton className="h-4 w-full max-w-24" /></TableCell>
                    ))}
                  </tr>
                ))
              ) : sessions.length === 0 ? (
                <tr>
                  <TableCell colSpan={6} className="py-12 text-center text-sm text-muted-foreground">
                    No flagged sessions {status === 'pending' ? 'pending review' : status === 'reviewed' ? 'reviewed yet' : ''}.
                  </TableCell>
                </tr>
              ) : (
                sessions.map((s, i) => (
                  <motion.tr
                    key={s._id}
                    className={ROW_CLASS}
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.25, delay: Math.min(i, 12) * 0.03, ease: [0.16, 1, 0.3, 1] }}
                  >
                    <TableCell>
                      <p className="text-[13px] font-medium text-foreground">{s.user?.name || 'Unknown'}</p>
                      <p className="text-[11px] text-muted-foreground">{s.user?.email || ''}</p>
                    </TableCell>
                    <TableCell>
                      <span className="flex items-center gap-1.5 text-xs text-foreground">
                        {s.emergencyDetected ? <AlertTriangle size={13} className="text-severity-high" /> : <ShieldAlert size={13} className="text-severity-critical" />}
                        {flagReason(s)}
                      </span>
                    </TableCell>
                    <TableCell>
                      {s.severityLevel ? (
                        <Badge className={SEVERITY_BADGE[s.severityLevel] || 'bg-muted text-muted-foreground'}>
                          {s.severityLevel}
                        </Badge>
                      ) : <span className="text-xs text-muted-foreground">—</span>}
                    </TableCell>
                    <TableCell>
                      {s.reviewedAt ? (
                        <Badge className="gap-1 bg-severity-low-bg text-severity-low-fg">
                          <CheckCircle2 size={11} /> Reviewed
                        </Badge>
                      ) : (
                        <Badge className="bg-severity-moderate-bg text-severity-moderate-fg">Pending</Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {new Date(s.createdAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
                    </TableCell>
                    <TableCell>
                      <Button size="sm" variant="outline" onClick={() => openReview(s)}>
                        {s.reviewedAt ? 'View' : 'Review'}
                      </Button>
                    </TableCell>
                  </motion.tr>
                ))
              )}
            </TableBody>
          </Table>
        </Card>

        {pages > 1 && (
          <div className="flex items-center justify-center gap-3">
            <Button size="icon-sm" variant="outline" onClick={() => setPage((p) => p - 1)} disabled={page === 1}>
              <ChevronLeft size={15} />
            </Button>
            <span className="text-sm text-muted-foreground">Page {page} of {pages}</span>
            <Button size="icon-sm" variant="outline" onClick={() => setPage((p) => p + 1)} disabled={page === pages}>
              <ChevronRight size={15} />
            </Button>
          </div>
        )}
      </div>

      <Dialog open={!!reviewing} onOpenChange={(open) => !open && setReviewing(null)}>
        <DialogContent>
          {reviewing && (
            <>
              <DialogHeader>
                <DialogTitle>Review flagged session</DialogTitle>
              </DialogHeader>
              <div className="flex flex-col gap-3.5">
                <div className="rounded-xl border border-border/70 bg-muted/50 p-3.5 text-sm">
                  <p className="font-medium text-foreground">{reviewing.user?.name || 'Unknown'}</p>
                  <p className="mb-2 text-xs text-muted-foreground">{reviewing.user?.email}</p>
                  <p className="text-xs text-muted-foreground">
                    {flagReason(reviewing)}
                    {reviewing.severityLevel && ` · LLM severity: ${reviewing.severityLevel}`}
                    {reviewing.ruleBasedTriage?.level && ` · Rule-based triage: ${reviewing.ruleBasedTriage.level}`}
                  </p>
                  {reviewing.ruleBasedTriage?.matchedRules?.length > 0 && (
                    <p className="mt-1.5 text-xs text-muted-foreground">
                      Matched rules: {reviewing.ruleBasedTriage.matchedRules.join(', ')}
                    </p>
                  )}
                  {reviewing.reviewedAt && (
                    <p className="mt-1.5 text-xs text-severity-low-fg">
                      Previously reviewed {new Date(reviewing.reviewedAt).toLocaleString()}
                    </p>
                  )}
                </div>
                <div className="flex flex-col gap-1.5">
                  <label className="text-sm font-medium text-foreground">Review notes</label>
                  <Textarea
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    placeholder="What did you check, and what was the outcome?"
                    maxLength={1000}
                  />
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setReviewing(null)}>Cancel</Button>
                <Button onClick={submitReview} disabled={saving}>
                  {saving ? 'Saving...' : 'Mark reviewed'}
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
