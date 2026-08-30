import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Search, ChevronLeft,
  ChevronRight, CheckCircle, XCircle, User,
} from 'lucide-react';
import { motion } from 'framer-motion';
import toast from 'react-hot-toast';
import adminApi from '../../api/adminApi';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Table, TableHeader, TableBody, TableHead, TableCell,
} from '@/components/ui/table';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';

const ROW_CLASS = 'border-b transition-colors hover:bg-muted/50 last:border-0';

export default function AdminUsers() {
  const navigate = useNavigate();
  const [users, setUsers] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pages, setPages] = useState(1);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [toggling, setToggling] = useState(null);
  const [confirmUser, setConfirmUser] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await adminApi.get('/admin/users', { params: { page, limit: 20, search } });
      setUsers(res.data.users);
      setTotal(res.data.total);
      setPages(res.data.pages);
    } catch {
      navigate('/admin/login');
    } finally {
      setLoading(false);
    }
  }, [page, search]);

  useEffect(() => { load(); }, [load]);

  const handleSearch = (e) => {
    setSearch(e.target.value);
    setPage(1);
  };

  const confirmToggle = async () => {
    if (!confirmUser) return;
    const { _id: userId } = confirmUser;
    setConfirmUser(null);
    setToggling(userId);
    try {
      await adminApi.patch(`/admin/users/${userId}/toggle`);
      setUsers(prev => prev.map(u =>
        u._id === userId ? { ...u, isActive: !u.isActive } : u
      ));
    } catch {
      toast.error('Failed to update user status');
    } finally {
      setToggling(null);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <div className="mx-auto flex max-w-[960px] flex-col gap-4 px-4 py-5">
        {/* Search */}
        <div className="relative">
          <Search size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input
            className="rounded-[10px] pl-9"
            placeholder="Search by name or email..."
            value={search}
            onChange={handleSearch}
          />
        </div>

        {/* Table */}
        <Card className="gap-0 overflow-hidden rounded-[14px] border-border/70 py-0 shadow-none">
          <Table>
            <TableHeader>
              <tr className="border-b bg-muted/40">
                <TableHead className="h-auto py-2.5 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">User</TableHead>
                <TableHead className="h-auto py-2.5 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Role</TableHead>
                <TableHead className="h-auto py-2.5 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Sessions</TableHead>
                <TableHead className="h-auto py-2.5 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Verified</TableHead>
                <TableHead className="h-auto py-2.5 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Joined</TableHead>
                <TableHead className="h-auto py-2.5 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Status</TableHead>
                <TableHead className="h-auto py-2.5" />
              </tr>
            </TableHeader>
            <TableBody>
              {loading ? (
                Array.from({ length: 8 }).map((_, i) => (
                  <tr key={i} className={ROW_CLASS}>
                    {Array.from({ length: 7 }).map((__, j) => (
                      <TableCell key={j} className="py-3">
                        <Skeleton className="h-4 w-full max-w-24" />
                      </TableCell>
                    ))}
                  </tr>
                ))
              ) : (
                users.map((u, i) => (
                  <motion.tr
                    key={u._id}
                    className={ROW_CLASS}
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.25, delay: Math.min(i, 12) * 0.03, ease: [0.16, 1, 0.3, 1] }}
                  >
                    <TableCell>
                      <div className="flex items-center gap-2.5">
                        <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
                          <User size={14} />
                        </div>
                        <div>
                          <p className="text-[13px] font-medium text-foreground">{u.name}</p>
                          <p className="text-[11px] text-muted-foreground">{u.email}</p>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge className={u.role === 'admin'
                        ? 'bg-severity-moderate-bg text-severity-moderate-fg'
                        : 'bg-primary/10 text-primary'}>
                        {u.role}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-[13px] text-muted-foreground">{u.sessionCount}</TableCell>
                    <TableCell>
                      {u.isEmailVerified
                        ? <CheckCircle size={15} className="text-severity-low" />
                        : <XCircle size={15} className="text-severity-high" />
                      }
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {new Date(u.createdAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
                    </TableCell>
                    <TableCell>
                      <Badge className={u.isActive
                        ? 'bg-severity-low-bg text-severity-low-fg'
                        : 'bg-severity-high-bg text-severity-high-fg'}>
                        {u.isActive ? 'Active' : 'Inactive'}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {u.role !== 'admin' && (
                        <Button
                          size="sm"
                          variant="ghost"
                          className={`rounded-full ${u.isActive
                            ? 'bg-severity-high-bg text-severity-high-fg hover:bg-severity-high-bg/70'
                            : 'bg-severity-low-bg text-severity-low-fg hover:bg-severity-low-bg/70'}`}
                          onClick={() => setConfirmUser(u)}
                          disabled={toggling === u._id}
                        >
                          {toggling === u._id ? '...' : u.isActive ? 'Deactivate' : 'Activate'}
                        </Button>
                      )}
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

      {/* Deactivate/Activate confirmation */}
      <AlertDialog open={!!confirmUser} onOpenChange={(open) => !open && setConfirmUser(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{confirmUser?.isActive ? 'Deactivate' : 'Activate'} this user?</AlertDialogTitle>
            <AlertDialogDescription>
              {confirmUser?.isActive
                ? `${confirmUser?.name} will immediately lose access to their account.`
                : `${confirmUser?.name} will regain access to their account.`}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmToggle}
              className={confirmUser?.isActive ? 'bg-destructive text-destructive-foreground hover:bg-destructive/90' : ''}
            >
              {confirmUser?.isActive ? 'Deactivate' : 'Activate'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
