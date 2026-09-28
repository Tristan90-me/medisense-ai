import { useState, useEffect, useCallback } from 'react';
import { Megaphone, Send, Trash2 } from 'lucide-react';
import { motion } from 'framer-motion';
import toast from 'react-hot-toast';
import {
  adminListAnnouncements, createAnnouncement, deleteAnnouncement, adminGetCriticalPreview, adminSearchUsers,
} from '../../api/announcements.api';
import announcementTemplates from '../../data/announcementTemplates';
import { cn } from '@/lib/utils';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';

const formatDate = (dateStr) => new Date(dateStr).toLocaleString('en-GB', {
  day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit',
});

const AUDIENCE_OPTIONS = [
  { value: 'all', label: 'All users' },
  { value: 'critical', label: 'Critical-condition users' },
  { value: 'user', label: 'Specific user' },
];

const audienceLabel = (a) => {
  if (a.audience === 'critical') return `Critical · ${a.recipientCount ?? 0} recipient${a.recipientCount === 1 ? '' : 's'}`;
  if (a.audience === 'user') return `To: ${a.targetUserSnapshot?.name || 'a user'}`;
  return 'All users';
};

const audienceBadgeVariant = (a) => {
  if (a.audience === 'critical') return 'destructive';
  if (a.audience === 'user') return 'secondary';
  return 'outline';
};

// Display-only — a template's `audience` is a suggestion shown in the
// dropdown, not something applied automatically (see chooseTemplate below).
const audienceHintLabel = (value) => AUDIENCE_OPTIONS.find((o) => o.value === value)?.label || value;

export default function AdminAnnouncements() {
  const [announcements, setAnnouncements] = useState([]);
  const [loading, setLoading] = useState(true);

  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [sending, setSending] = useState(false);
  const [templateId, setTemplateId] = useState('custom');

  const [audience, setAudience] = useState('all');
  const [confirmOpen, setConfirmOpen] = useState(false);

  const [criticalWindowDays, setCriticalWindowDays] = useState(30);
  const [criticalPreview, setCriticalPreview] = useState(null);
  const [criticalPreviewLoading, setCriticalPreviewLoading] = useState(false);

  const [userSearch, setUserSearch] = useState('');
  const [userResults, setUserResults] = useState([]);
  const [userSearchLoading, setUserSearchLoading] = useState(false);
  const [selectedUser, setSelectedUser] = useState(null);

  const [deleting, setDeleting] = useState(null);
  const [deletingBusy, setDeletingBusy] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await adminListAnnouncements();
      setAnnouncements(data);
    } catch {
      toast.error('Failed to load announcements');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  // Preview recipient count for a 'critical' send whenever the audience or
  // window changes, so the admin sees reach before confirming a bulk send.
  useEffect(() => {
    if (audience !== 'critical') { setCriticalPreview(null); return undefined; }
    let ignore = false;
    setCriticalPreviewLoading(true);
    const t = setTimeout(async () => {
      try {
        const data = await adminGetCriticalPreview(criticalWindowDays);
        if (!ignore) setCriticalPreview(data);
      } catch {
        if (!ignore) setCriticalPreview(null);
      } finally {
        if (!ignore) setCriticalPreviewLoading(false);
      }
    }, 400);
    return () => { ignore = true; clearTimeout(t); };
  }, [audience, criticalWindowDays]);

  // Debounced user search for the 'specific user' picker.
  useEffect(() => {
    if (audience !== 'user' || selectedUser || !userSearch.trim()) { setUserResults([]); return undefined; }
    let ignore = false;
    setUserSearchLoading(true);
    const t = setTimeout(async () => {
      try {
        const users = await adminSearchUsers(userSearch.trim());
        if (!ignore) setUserResults(users);
      } catch {
        if (!ignore) setUserResults([]);
      } finally {
        if (!ignore) setUserSearchLoading(false);
      }
    }, 300);
    return () => { ignore = true; clearTimeout(t); };
  }, [audience, userSearch, selectedUser]);

  const chooseAudience = (value) => {
    setAudience(value);
    setTemplateId('custom');
    if (value !== 'user') { setSelectedUser(null); setUserSearch(''); }
  };

  // Templates only prefill text — they never change "Send to". Each
  // template's `audience` is just a hint shown in the dropdown (e.g.
  // "suggested for Critical-condition users"); applying one never overrides
  // whichever audience the admin already picked, so e.g. the critical-
  // followup copy can be sent to a single specific user too.
  const chooseTemplate = (id) => {
    setTemplateId(id);
    if (id === 'custom') return;
    const tpl = announcementTemplates.find((t) => t.id === id);
    if (!tpl) return;
    setTitle(tpl.title);
    setBody(tpl.body);
  };

  const resetForm = () => {
    setTitle('');
    setBody('');
    setTemplateId('custom');
    setAudience('all');
    setSelectedUser(null);
    setUserSearch('');
    setCriticalPreview(null);
  };

  const doSend = async () => {
    setSending(true);
    try {
      const announcement = await createAnnouncement({
        title: title.trim(),
        body: body.trim(),
        audience,
        targetUserId: audience === 'user' ? selectedUser?._id : undefined,
        criticalWindowDays: audience === 'critical' ? criticalWindowDays : undefined,
      });
      setAnnouncements((prev) => [announcement, ...prev]);
      resetForm();
      toast.success('Announcement sent');
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to send announcement');
    } finally {
      setSending(false);
      setConfirmOpen(false);
    }
  };

  const handleSend = (e) => {
    e.preventDefault();
    if (!title.trim() || !body.trim()) return toast.error('Title and message are both required');
    if (audience === 'user' && !selectedUser) return toast.error('Choose a user to send to');
    if (audience === 'all' || audience === 'critical') {
      setConfirmOpen(true);
      return undefined;
    }
    return doSend();
  };

  const confirmDelete = async () => {
    if (!deleting) return;
    setDeletingBusy(true);
    try {
      await deleteAnnouncement(deleting._id);
      setAnnouncements((prev) => prev.filter((a) => a._id !== deleting._id));
      toast.success('Announcement removed');
    } catch {
      toast.error('Failed to remove announcement');
    } finally {
      setDeletingBusy(false);
      setDeleting(null);
    }
  };

  return (
    <div className="mx-auto flex max-w-[720px] flex-col gap-6 px-4 py-6">
      <div>
        <h1 className="font-heading text-xl font-bold text-foreground">Announcements</h1>
        <p className="text-sm text-muted-foreground">
          Send an in-app message to all users, users with a recent critical/emergency check-in, or one specific user — surfaced in their dashboard notification bell.
        </p>
      </div>

      {/* Create form */}
      <Card className="rounded-[14px] border-border/70 shadow-none">
        <CardContent className="p-5">
          <form onSubmit={handleSend} className="flex flex-col gap-4">
            <div className="flex items-center gap-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-[10px] bg-primary/10 text-primary">
                <Megaphone size={16} />
              </div>
              <p className="text-sm font-bold text-foreground">New announcement</p>
            </div>

            <div className="space-y-2">
              <Label className="text-xs">Send to</Label>
              <div className="flex gap-2">
                {AUDIENCE_OPTIONS.map((opt) => (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => chooseAudience(opt.value)}
                    className={cn(
                      'flex-1 rounded-[10px] border px-3 py-2 text-xs font-medium transition-colors',
                      audience === opt.value
                        ? 'border-primary bg-primary/10 text-primary'
                        : 'border-border/70 text-muted-foreground hover:bg-muted',
                    )}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>

            {audience === 'critical' && (
              <div className="space-y-2 rounded-[10px] border border-border/70 bg-muted/30 p-3">
                <div className="flex items-center justify-between gap-3">
                  <Label htmlFor="critical-window" className="text-xs">Window (days)</Label>
                  <Input
                    id="critical-window"
                    type="number"
                    min={1}
                    max={365}
                    value={criticalWindowDays}
                    onChange={(e) => setCriticalWindowDays(Math.max(1, Math.min(365, Number(e.target.value) || 1)))}
                    className="h-8 w-20 text-xs"
                  />
                </div>
                <p className="text-xs text-muted-foreground">
                  {criticalPreviewLoading
                    ? 'Checking recipients…'
                    : criticalPreview
                      ? `This will reach ${criticalPreview.count} user${criticalPreview.count === 1 ? '' : 's'} with an emergency/Critical-severity check-in in the last ${criticalWindowDays} days.`
                      : 'Users with an emergency or Critical-severity check-in in this window will be notified.'}
                </p>
                {criticalPreview?.sample?.length > 0 && (
                  <p className="truncate text-[11px] text-muted-foreground/80">
                    e.g. {criticalPreview.sample.slice(0, 3).map((u) => u.name).join(', ')}
                    {criticalPreview.count > 3 ? `, +${criticalPreview.count - 3} more` : ''}
                  </p>
                )}
              </div>
            )}

            {audience === 'user' && (
              <div className="space-y-2">
                <Label htmlFor="user-search" className="text-xs">Recipient</Label>
                {selectedUser ? (
                  <div className="flex items-center justify-between rounded-[10px] border border-border/70 bg-muted/30 px-3 py-2">
                    <div className="min-w-0">
                      <p className="truncate text-xs font-semibold text-foreground">{selectedUser.name}</p>
                      <p className="truncate text-[11px] text-muted-foreground">{selectedUser.email}</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => { setSelectedUser(null); setUserSearch(''); }}
                      className="shrink-0 text-xs text-muted-foreground hover:text-destructive"
                    >
                      Change
                    </button>
                  </div>
                ) : (
                  <>
                    <Input
                      id="user-search"
                      placeholder="Search by name or email…"
                      value={userSearch}
                      onChange={(e) => setUserSearch(e.target.value)}
                    />
                    {userSearchLoading && <p className="text-[11px] text-muted-foreground">Searching…</p>}
                    {userResults.length > 0 && (
                      <div className="flex flex-col overflow-hidden rounded-[10px] border border-border/70">
                        {userResults.map((u) => (
                          <button
                            key={u._id}
                            type="button"
                            onClick={() => { setSelectedUser(u); setUserResults([]); }}
                            className="flex flex-col items-start gap-0.5 border-b border-border/50 px-3 py-2 text-left last:border-b-0 hover:bg-muted"
                          >
                            <span className="text-xs font-medium text-foreground">{u.name}</span>
                            <span className="text-[11px] text-muted-foreground">{u.email}</span>
                          </button>
                        ))}
                      </div>
                    )}
                  </>
                )}
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="announcement-template" className="text-xs">Template</Label>
              <Select value={templateId} onValueChange={chooseTemplate}>
                <SelectTrigger id="announcement-template" className="w-full text-xs">
                  <SelectValue placeholder="Custom message" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="custom">Custom message</SelectItem>
                  {announcementTemplates.map((t) => (
                    <SelectItem key={t.id} value={t.id}>
                      {`${t.label} — suggested for ${audienceHintLabel(t.audience)}`}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="announcement-title">Title</Label>
              <Input
                id="announcement-title"
                placeholder="e.g. Scheduled maintenance tonight"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                maxLength={200}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="announcement-body">Message</Label>
              <Textarea
                id="announcement-body"
                rows={4}
                placeholder="What should users know?"
                value={body}
                onChange={(e) => setBody(e.target.value)}
                maxLength={2000}
              />
            </div>

            <div>
              <Button
                type="submit"
                className="rounded-full"
                disabled={sending || !title.trim() || !body.trim() || (audience === 'user' && !selectedUser)}
              >
                <Send size={15} /> {sending ? 'Sending...' : 'Send announcement'}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      {/* List */}
      <div className="flex flex-col gap-2.5">
        <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
          Sent announcements
        </p>

        {loading ? (
          <div className="flex flex-col gap-2.5">
            {Array.from({ length: 3 }).map((_, i) => (
              <Skeleton key={i} className="h-[92px] rounded-[14px]" />
            ))}
          </div>
        ) : announcements.length === 0 ? (
          <Card className="rounded-[14px] border-dashed border-border/70 shadow-none">
            <CardContent className="flex flex-col items-center gap-2 px-4 py-10 text-center">
              <Megaphone size={22} className="text-muted-foreground/50" />
              <p className="text-sm font-medium text-foreground">No announcements sent yet</p>
              <p className="text-xs text-muted-foreground">Use the form above to send your first one.</p>
            </CardContent>
          </Card>
        ) : (
          <div className="flex flex-col gap-2.5">
            {announcements.map((a, i) => (
              <motion.div
                key={a._id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.25, delay: i * 0.03, ease: [0.16, 1, 0.3, 1] }}
              >
                <Card className="rounded-[14px] border-border/70 py-0 shadow-none">
                  <CardContent className="flex items-start justify-between gap-3 p-4">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="text-sm font-semibold text-foreground">{a.title}</p>
                        <Badge variant={audienceBadgeVariant(a)}>{audienceLabel(a)}</Badge>
                      </div>
                      <p className="mt-1 whitespace-pre-wrap text-xs leading-relaxed text-muted-foreground">
                        {a.body}
                      </p>
                      <p className="mt-2 text-[10px] text-muted-foreground">{formatDate(a.sentAt)}</p>
                    </div>
                    <button
                      onClick={() => setDeleting(a)}
                      className="flex shrink-0 rounded-lg p-1.5 text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive"
                      aria-label={`Remove ${a.title}`}
                    >
                      <Trash2 size={15} />
                    </button>
                  </CardContent>
                </Card>
              </motion.div>
            ))}
          </div>
        )}
      </div>

      {/* Confirm a bulk send (all users / critical-condition users) */}
      <AlertDialog open={confirmOpen} onOpenChange={(open) => !open && setConfirmOpen(false)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {audience === 'all' ? 'Send to every user?' : 'Send to critical-condition users?'}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {audience === 'all'
                ? 'This notifies every MediSense AI user immediately. This cannot be undone.'
                : `This notifies ${criticalPreview?.count ?? 'the matching'} user${criticalPreview?.count === 1 ? '' : 's'} with a recent critical/emergency check-in. This cannot be undone.`}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={sending}>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={doSend} disabled={sending}>
              {sending ? 'Sending...' : 'Send'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={!!deleting} onOpenChange={(open) => !open && setDeleting(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove this announcement?</AlertDialogTitle>
            <AlertDialogDescription>
              This retracts it from every recipient's notification feed. This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmDelete}
              disabled={deletingBusy}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deletingBusy ? 'Removing...' : 'Remove'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
