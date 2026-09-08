import { useState, useEffect, useCallback } from 'react';
import { ChevronLeft, ChevronRight, Filter } from 'lucide-react';
import { motion } from 'framer-motion';
import toast from 'react-hot-toast';
import adminApi from '../../api/adminApi';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Table, TableHeader, TableBody, TableHead, TableCell,
} from '@/components/ui/table';

const ROW_CLASS = 'border-b transition-colors hover:bg-muted/50 last:border-0';

const ACTION_BADGE = {
  'admin.invite': 'bg-primary/10 text-primary',
  'admin.invite.revoke': 'bg-severity-high-bg text-severity-high-fg',
  'user.toggle_status': 'bg-severity-moderate-bg text-severity-moderate-fg',
  'session.review': 'bg-severity-low-bg text-severity-low-fg',
  'export.users': 'bg-accent/10 text-accent',
  'export.sessions': 'bg-accent/10 text-accent',
  'settings.update': 'bg-secondary/10 text-secondary',
};

export default function AdminAuditLog() {
  const [logs, setLogs] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pages, setPages] = useState(1);
  const [actionFilter, setActionFilter] = useState('');
  const [loading, setLoading] = useState(true);
  const [showFilters, setShowFilters] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = { page, limit: 25 };
      if (actionFilter.trim()) params.action = actionFilter.trim();
      const res = await adminApi.get('/admin/audit-log', { params });
      setLogs(res.data.logs);
      setTotal(res.data.total);
      setPages(res.data.pages);
    } catch {
      toast.error('Failed to load audit log');
    } finally {
      setLoading(false);
    }
  }, [page, actionFilter]);

  useEffect(() => { load(); }, [load]);

  const applyFilter = (e) => {
    e.preventDefault();
    setPage(1);
    load();
  };

  return (
    <div className="min-h-screen bg-background">
      <div className="mx-auto flex max-w-[960px] flex-col gap-4 px-4 py-5">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="font-heading text-lg font-bold text-foreground">Audit Log</h1>
            <p className="text-xs text-muted-foreground">{total} entr{total !== 1 ? 'ies' : 'y'}</p>
          </div>
          <button
            onClick={() => setShowFilters((p) => !p)}
            className="relative flex items-center gap-1.5 rounded-full border border-border/70 bg-card px-4 py-1.5 text-xs font-medium text-muted-foreground transition-colors hover:text-foreground"
          >
            <Filter size={14} /> Filter
            {actionFilter && <span className="h-1.5 w-1.5 rounded-full bg-primary" />}
          </button>
        </div>

        {showFilters && (
          <form onSubmit={applyFilter} className="flex items-center gap-2.5 rounded-xl border border-border/70 bg-card p-3">
            <Input
              value={actionFilter}
              onChange={(e) => setActionFilter(e.target.value)}
              placeholder="Filter by action, e.g. admin.invite"
              className="h-8 max-w-[260px] text-xs"
            />
            <Button type="submit" size="sm" variant="outline">Apply</Button>
            {actionFilter && (
              <button
                type="button"
                onClick={() => { setActionFilter(''); setPage(1); }}
                className="text-xs text-muted-foreground underline hover:text-foreground"
              >
                Clear
              </button>
            )}
          </form>
        )}

        <Card className="gap-0 overflow-hidden rounded-[14px] border-border/70 py-0 shadow-none">
          <Table>
            <TableHeader>
              <tr className="border-b bg-muted/40">
                <TableHead className="h-auto py-2.5 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Actor</TableHead>
                <TableHead className="h-auto py-2.5 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Action</TableHead>
                <TableHead className="h-auto py-2.5 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Target</TableHead>
                <TableHead className="h-auto py-2.5 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Metadata</TableHead>
                <TableHead className="h-auto py-2.5 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">When</TableHead>
              </tr>
            </TableHeader>
            <TableBody>
              {loading ? (
                Array.from({ length: 8 }).map((_, i) => (
                  <tr key={i} className={ROW_CLASS}>
                    {Array.from({ length: 5 }).map((__, j) => (
                      <TableCell key={j} className="py-3"><Skeleton className="h-4 w-full max-w-28" /></TableCell>
                    ))}
                  </tr>
                ))
              ) : logs.length === 0 ? (
                <tr>
                  <TableCell colSpan={5} className="py-12 text-center text-sm text-muted-foreground">
                    No audit log entries{actionFilter ? ` matching "${actionFilter}"` : ''}.
                  </TableCell>
                </tr>
              ) : (
                logs.map((log, i) => (
                  <motion.tr
                    key={log._id}
                    className={ROW_CLASS}
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.25, delay: Math.min(i, 12) * 0.03, ease: [0.16, 1, 0.3, 1] }}
                  >
                    <TableCell>
                      <p className="text-[13px] font-medium text-foreground">{log.actor?.name || 'Unknown'}</p>
                      <p className="text-[11px] text-muted-foreground">{log.actor?.email || ''}</p>
                    </TableCell>
                    <TableCell>
                      <Badge className={ACTION_BADGE[log.action] || 'bg-muted text-muted-foreground'}>
                        {log.action}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {log.targetType || '—'}
                    </TableCell>
                    <TableCell className="max-w-[220px] truncate text-xs text-muted-foreground" title={JSON.stringify(log.metadata)}>
                      {log.metadata && Object.keys(log.metadata).length > 0 ? JSON.stringify(log.metadata) : '—'}
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {new Date(log.createdAt).toLocaleString('en-GB', {
                        day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit',
                      })}
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
    </div>
  );
}
