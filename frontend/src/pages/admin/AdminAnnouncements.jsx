import { useState, useEffect, useCallback } from 'react';
import { Megaphone, Send, Trash2 } from 'lucide-react';
import { motion } from 'framer-motion';
import toast from 'react-hot-toast';
import { adminListAnnouncements, createAnnouncement, deleteAnnouncement } from '../../api/announcements.api';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Skeleton } from '@/components/ui/skeleton';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';

const formatDate = (dateStr) => new Date(dateStr).toLocaleString('en-GB', {
  day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit',
});

export default function AdminAnnouncements() {
  const [announcements, setAnnouncements] = useState([]);
  const [loading, setLoading] = useState(true);

  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [sending, setSending] = useState(false);

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

  const handleSend = async (e) => {
    e.preventDefault();
    if (!title.trim() || !body.trim()) return toast.error('Title and message are both required');
    setSending(true);
    try {
      const announcement = await createAnnouncement({ title: title.trim(), body: body.trim() });
      setAnnouncements((prev) => [announcement, ...prev]);
      setTitle('');
      setBody('');
      toast.success('Announcement sent');
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to send announcement');
    } finally {
      setSending(false);
    }
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
          Broadcast an in-app message to every MediSense AI user — surfaced in their dashboard notification bell.
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
              <Button type="submit" className="rounded-full" disabled={sending || !title.trim() || !body.trim()}>
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
              <p className="text-xs text-muted-foreground">Use the form above to broadcast your first one.</p>
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
                      <p className="text-sm font-semibold text-foreground">{a.title}</p>
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

      <AlertDialog open={!!deleting} onOpenChange={(open) => !open && setDeleting(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove this announcement?</AlertDialogTitle>
            <AlertDialogDescription>
              This retracts it from every user's notification feed. This cannot be undone.
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
