import { useState, useEffect, useCallback } from 'react';
import { UserPlus, Mail, Trash2, ShieldCheck } from 'lucide-react';
import { motion } from 'framer-motion';
import toast from 'react-hot-toast';
import adminApi from '../../api/adminApi';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
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

export default function AdminSettings() {
  const [inviteForm, setInviteForm] = useState({ name: '', email: '' });
  const [inviting, setInviting] = useState(false);

  const [invites, setInvites] = useState([]);
  const [invitesLoading, setInvitesLoading] = useState(true);
  const [revokeTarget, setRevokeTarget] = useState(null);
  const [revoking, setRevoking] = useState(false);

  const [admins, setAdmins] = useState([]);
  const [adminsLoading, setAdminsLoading] = useState(true);

  const loadInvites = useCallback(async () => {
    setInvitesLoading(true);
    try {
      const res = await adminApi.get('/admin/invites');
      setInvites(res.data.invites);
    } catch {
      toast.error('Failed to load pending invites');
    } finally {
      setInvitesLoading(false);
    }
  }, []);

  const loadAdmins = useCallback(async () => {
    setAdminsLoading(true);
    try {
      const res = await adminApi.get('/admin/users', { params: { limit: 100 } });
      setAdmins((res.data.users || []).filter((u) => u.role === 'admin'));
    } catch {
      // non-critical, silently skip
    } finally {
      setAdminsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadInvites();
    loadAdmins();
  }, [loadInvites, loadAdmins]);

  const handleInvite = async (e) => {
    e.preventDefault();
    if (!inviteForm.name.trim() || !inviteForm.email.trim()) {
      return toast.error('Name and email are required');
    }
    setInviting(true);
    try {
      const res = await adminApi.post('/admin/invites', inviteForm);
      toast.success(res.data.message || 'Invite sent');
      setInviteForm({ name: '', email: '' });
      loadInvites();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to send invite');
    } finally {
      setInviting(false);
    }
  };

  const confirmRevoke = async () => {
    if (!revokeTarget) return;
    const id = revokeTarget._id;
    setRevoking(true);
    try {
      await adminApi.delete(`/admin/invites/${id}`);
      toast.success('Invite revoked');
      setInvites((prev) => prev.filter((i) => i._id !== id));
    } catch {
      toast.error('Failed to revoke invite');
    } finally {
      setRevoking(false);
      setRevokeTarget(null);
    }
  };

  return (
    <div className="mx-auto flex max-w-[960px] flex-col gap-6 px-4 py-6">
      <div>
        <h1 className="font-heading text-xl font-bold text-foreground">Settings</h1>
        <p className="text-sm text-muted-foreground">Manage admin access and invitations</p>
      </div>

      {/* Invite admin */}
      <Card className="rounded-[14px] border-border/70 shadow-none">
        <CardContent className="p-5">
          <div className="mb-4 flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-[10px] bg-primary/10 text-primary">
              <UserPlus size={16} />
            </div>
            <p className="text-sm font-bold text-foreground">Invite admin</p>
          </div>
          <form onSubmit={handleInvite} className="flex flex-col gap-4 sm:flex-row sm:items-end">
            <div className="flex-1 space-y-2">
              <Label htmlFor="invite-name">Full name</Label>
              <Input
                id="invite-name"
                placeholder="Jane Doe"
                value={inviteForm.name}
                onChange={(e) => setInviteForm({ ...inviteForm, name: e.target.value })}
              />
            </div>
            <div className="flex-1 space-y-2">
              <Label htmlFor="invite-email">Email</Label>
              <Input
                id="invite-email"
                type="email"
                placeholder="jane@example.com"
                value={inviteForm.email}
                onChange={(e) => setInviteForm({ ...inviteForm, email: e.target.value })}
              />
            </div>
            <Button type="submit" disabled={inviting} className="rounded-full sm:w-auto">
              {inviting ? 'Sending...' : 'Send invite'}
            </Button>
          </form>
        </CardContent>
      </Card>

      {/* Pending invites */}
      <Card className="gap-0 overflow-hidden rounded-[14px] border-border/70 py-0 shadow-none">
        <div className="flex items-center gap-2 border-b border-border/70 px-5 py-3.5">
          <Mail size={15} className="text-muted-foreground" />
          <p className="text-sm font-bold text-foreground">Pending invites</p>
        </div>
        <Table>
          <TableHeader>
            <tr className="border-b bg-muted/40">
              <TableHead className="h-auto py-2.5 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Name</TableHead>
              <TableHead className="h-auto py-2.5 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Email</TableHead>
              <TableHead className="h-auto py-2.5 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Invited</TableHead>
              <TableHead className="h-auto py-2.5 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Expires</TableHead>
              <TableHead className="h-auto py-2.5" />
            </tr>
          </TableHeader>
          <TableBody>
            {invitesLoading ? (
              Array.from({ length: 3 }).map((_, i) => (
                <tr key={i} className={ROW_CLASS}>
                  {Array.from({ length: 5 }).map((__, j) => (
                    <TableCell key={j} className="py-3">
                      <Skeleton className="h-4 w-full max-w-24" />
                    </TableCell>
                  ))}
                </tr>
              ))
            ) : invites.length === 0 ? (
              <tr>
                <TableCell colSpan={5} className="py-8 text-center text-sm text-muted-foreground">
                  No pending invites
                </TableCell>
              </tr>
            ) : (
              invites.map((inv, i) => (
                <motion.tr
                  key={inv._id}
                  className={ROW_CLASS}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.25, delay: Math.min(i, 12) * 0.03, ease: [0.16, 1, 0.3, 1] }}
                >
                  <TableCell className="text-[13px] font-medium text-foreground">{inv.name}</TableCell>
                  <TableCell className="text-[13px] text-muted-foreground">{inv.email}</TableCell>
                  <TableCell className="text-xs text-muted-foreground">
                    {new Date(inv.createdAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground">
                    {new Date(inv.adminInviteExpires).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
                  </TableCell>
                  <TableCell>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="rounded-full bg-severity-high-bg text-severity-high-fg hover:bg-severity-high-bg/70"
                      onClick={() => setRevokeTarget(inv)}
                    >
                      <Trash2 size={13} /> Revoke
                    </Button>
                  </TableCell>
                </motion.tr>
              ))
            )}
          </TableBody>
        </Table>
      </Card>

      {/* Existing admins */}
      <Card className="gap-0 overflow-hidden rounded-[14px] border-border/70 py-0 shadow-none">
        <div className="flex items-center gap-2 border-b border-border/70 px-5 py-3.5">
          <ShieldCheck size={15} className="text-muted-foreground" />
          <p className="text-sm font-bold text-foreground">Admins</p>
        </div>
        <Table>
          <TableHeader>
            <tr className="border-b bg-muted/40">
              <TableHead className="h-auto py-2.5 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Name</TableHead>
              <TableHead className="h-auto py-2.5 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Email</TableHead>
              <TableHead className="h-auto py-2.5 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Joined</TableHead>
            </tr>
          </TableHeader>
          <TableBody>
            {adminsLoading ? (
              Array.from({ length: 2 }).map((_, i) => (
                <tr key={i} className={ROW_CLASS}>
                  {Array.from({ length: 3 }).map((__, j) => (
                    <TableCell key={j} className="py-3">
                      <Skeleton className="h-4 w-full max-w-24" />
                    </TableCell>
                  ))}
                </tr>
              ))
            ) : admins.length === 0 ? (
              <tr>
                <TableCell colSpan={3} className="py-8 text-center text-sm text-muted-foreground">
                  No admins found
                </TableCell>
              </tr>
            ) : (
              admins.map((a) => (
                <tr key={a._id} className={ROW_CLASS}>
                  <TableCell className="text-[13px] font-medium text-foreground">{a.name}</TableCell>
                  <TableCell className="text-[13px] text-muted-foreground">{a.email}</TableCell>
                  <TableCell className="text-xs text-muted-foreground">
                    {new Date(a.createdAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
                  </TableCell>
                </tr>
              ))
            )}
          </TableBody>
        </Table>
      </Card>

      {/* Revoke confirmation */}
      <AlertDialog open={!!revokeTarget} onOpenChange={(open) => !open && setRevokeTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Revoke this invite?</AlertDialogTitle>
            <AlertDialogDescription>
              {revokeTarget?.name} ({revokeTarget?.email}) will no longer be able to accept this invitation.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmRevoke}
              disabled={revoking}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {revoking ? 'Revoking...' : 'Revoke'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
