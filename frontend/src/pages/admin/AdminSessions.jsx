import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  AlertTriangle,
  ChevronLeft, ChevronRight, Filter,
} from 'lucide-react';
import { motion } from 'framer-motion';
import adminApi from '../../api/adminApi';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Table, TableHeader, TableBody, TableHead, TableCell,
} from '@/components/ui/table';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';

const ROW_CLASS = 'border-b transition-colors hover:bg-muted/50 last:border-0';

const SEVERITY_BADGE = {
  Low: 'bg-severity-low-bg text-severity-low-fg',
  Moderate: 'bg-severity-moderate-bg text-severity-moderate-fg',
  High: 'bg-severity-high-bg text-severity-high-fg',
  Critical: 'bg-severity-critical-bg text-severity-critical-fg',
};

const STATUS_BADGE = {
  active: 'bg-severity-low-bg text-severity-low-fg',
  completed: 'bg-severity-low-bg text-severity-low-fg',
  abandoned: 'bg-severity-high-bg text-severity-high-fg',
};

export default function AdminSessions() {
  const navigate = useNavigate();
  const [sessions, setSessions] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pages, setPages] = useState(1);
  const [filters, setFilters] = useState({ severity: '', emergency: '', status: '' });
  const [loading, setLoading] = useState(true);
  const [showFilters, setShowFilters] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = { page, limit: 20, ...filters };
      Object.keys(params).forEach(k => !params[k] && delete params[k]);
      const res = await adminApi.get('/admin/sessions', { params });
      setSessions(res.data.sessions);
      setTotal(res.data.total);
      setPages(res.data.pages);
    } catch {
      navigate('/admin/login');
    } finally {
      setLoading(false);
    }
  }, [page, filters]);

  useEffect(() => { load(); }, [load]);

  const setFilter = (key, val) => {
    setFilters(prev => ({ ...prev, [key]: val }));
    setPage(1);
  };

  return (
    <div className="min-h-screen bg-background">
      <div className="mx-auto flex max-w-[960px] flex-col gap-4 px-4 py-5">
        {/* Filter bar */}
        <div className="flex flex-col gap-2.5">
          <button
            onClick={() => setShowFilters(p => !p)}
            className="relative flex w-fit items-center gap-1.5 rounded-full border border-border/70 bg-card px-4 py-1.5 text-xs font-medium text-muted-foreground transition-colors hover:text-foreground"
          >
            <Filter size={14} /> Filters
            {Object.values(filters).some(Boolean) && (
              <span className="h-1.5 w-1.5 rounded-full bg-primary" />
            )}
          </button>

          {showFilters && (
            <div className="flex flex-wrap items-center gap-2.5 rounded-xl border border-border/70 bg-card p-3">
              <Select value={filters.severity || 'all'} onValueChange={(v) => setFilter('severity', v === 'all' ? '' : v)}>
                <SelectTrigger size="sm" className="text-xs">
                  <SelectValue placeholder="All severities" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All severities</SelectItem>
                  {['Low', 'Moderate', 'High', 'Critical'].map(s => (
                    <SelectItem key={s} value={s}>{s}</SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Select value={filters.status || 'all'} onValueChange={(v) => setFilter('status', v === 'all' ? '' : v)}>
                <SelectTrigger size="sm" className="text-xs">
                  <SelectValue placeholder="All statuses" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All statuses</SelectItem>
                  {['active', 'completed', 'abandoned'].map(s => (
                    <SelectItem key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <label className="flex cursor-pointer items-center gap-1.5 text-xs text-foreground">
                <input
                  type="checkbox"
                  className="h-3.5 w-3.5 accent-primary"
                  checked={filters.emergency === 'true'}
                  onChange={e => setFilter('emergency', e.target.checked ? 'true' : '')}
                />
                Emergencies only
              </label>

              <button
                onClick={() => setFilters({ severity: '', emergency: '', status: '' })}
                className="text-xs text-muted-foreground underline hover:text-foreground"
              >
                Clear
              </button>
            </div>
          )}
        </div>

        {/* Table */}
        <Card className="gap-0 overflow-hidden rounded-[14px] border-border/70 py-0 shadow-none">
          <Table>
            <TableHeader>
              <tr className="border-b bg-muted/40">
                <TableHead className="h-auto py-2.5 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">User</TableHead>
                <TableHead className="h-auto py-2.5 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Mode</TableHead>
                <TableHead className="h-auto py-2.5 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Status</TableHead>
                <TableHead className="h-auto py-2.5 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Severity</TableHead>
                <TableHead className="h-auto py-2.5 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Emergency</TableHead>
                <TableHead className="h-auto py-2.5 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Date</TableHead>
              </tr>
            </TableHeader>
            <TableBody>
              {loading ? (
                Array.from({ length: 8 }).map((_, i) => (
                  <tr key={i} className={ROW_CLASS}>
                    {Array.from({ length: 6 }).map((__, j) => (
                      <TableCell key={j} className="py-3">
                        <Skeleton className="h-4 w-full max-w-24" />
                      </TableCell>
                    ))}
                  </tr>
                ))
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
                    <TableCell className="text-xs text-muted-foreground">
                      {s.mode === 'full' ? 'Full Assessment' : 'Quick Check'}
                    </TableCell>
                    <TableCell>
                      <Badge className={STATUS_BADGE[s.status] || 'bg-muted text-muted-foreground'}>
                        {s.status.charAt(0).toUpperCase() + s.status.slice(1)}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {s.severityLevel ? (
                        <Badge className={SEVERITY_BADGE[s.severityLevel] || 'bg-muted text-muted-foreground'}>
                          {s.severityLevel}
                          {s.severityScore ? ` (${s.severityScore}/10)` : ''}
                        </Badge>
                      ) : (
                        <span className="text-xs text-muted-foreground">—</span>
                      )}
                    </TableCell>
                    <TableCell>
                      {s.emergencyDetected && (
                        <AlertTriangle size={15} className="text-severity-high" />
                      )}
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {new Date(s.createdAt).toLocaleDateString('en-GB', {
                        day: 'numeric', month: 'short', year: 'numeric',
                      })}
                    </TableCell>
                  </motion.tr>
                ))
              )}
            </TableBody>
          </Table>
        </Card>

        {/* Pagination */}
        {pages > 1 && (
          <div className="flex items-center justify-center gap-3">
            <Button
              size="icon-sm"
              variant="outline"
              onClick={() => setPage(p => p - 1)}
              disabled={page === 1}
            >
              <ChevronLeft size={15} />
            </Button>
            <span className="text-sm text-muted-foreground">Page {page} of {pages}</span>
            <Button
              size="icon-sm"
              variant="outline"
              onClick={() => setPage(p => p + 1)}
              disabled={page === pages}
            >
              <ChevronRight size={15} />
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
