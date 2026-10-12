import { useState } from 'react';
import { Share2, Copy, Check, Loader2, ShieldCheck } from 'lucide-react';
import toast from 'react-hot-toast';
import { createShareLink, revokeShareLink } from '../api/share.api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';

// Shared by SessionDetail.jsx (text+icon trigger) and SessionSummary.jsx
// (icon-only trigger, matching its existing Print/PDF header buttons) — one
// component so the create/copy/revoke flow only exists once.
export default function ShareDialog({ sessionId, iconOnly = false }) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [link, setLink] = useState(null);
  const [copied, setCopied] = useState(false);
  const [revoked, setRevoked] = useState(false);
  const [revoking, setRevoking] = useState(false);

  const handleOpen = async () => {
    setOpen(true);
    if (link || loading) return;
    setLoading(true);
    try {
      const data = await createShareLink(sessionId);
      setLink(data);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to create share link');
      setOpen(false);
    } finally {
      setLoading(false);
    }
  };

  const shareUrl = link ? `${window.location.origin}/shared/${link.token}` : '';

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error('Could not copy link');
    }
  };

  const handleRevoke = async () => {
    if (!link) return;
    setRevoking(true);
    try {
      await revokeShareLink(link.token);
      setRevoked(true);
    } catch {
      toast.error('Failed to revoke link');
    } finally {
      setRevoking(false);
    }
  };

  // Reset for next open — a revoked or just-copied link shouldn't linger in
  // state if the dialog is reopened later for a fresh share.
  const handleOpenChange = (isOpen) => {
    setOpen(isOpen);
    if (!isOpen) {
      setLink(null);
      setRevoked(false);
      setCopied(false);
    }
  };

  const expiresLabel = link ? new Date(link.expiresAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }) : '';

  return (
    <>
      {iconOnly ? (
        <button
          onClick={handleOpen}
          title="Share with a healthcare professional"
          className="flex rounded-lg border border-border bg-background p-1.5 text-muted-foreground transition-colors hover:bg-accent"
        >
          <Share2 size={15} />
        </button>
      ) : (
        <Button variant="outline" size="sm" onClick={handleOpen} className="gap-1.5 rounded-full">
          <Share2 size={14} /> Share
        </Button>
      )}

      <Dialog open={open} onOpenChange={handleOpenChange}>
        <DialogContent className="rounded-2xl sm:max-w-[420px]">
          <DialogHeader>
            <DialogTitle className="text-base font-bold text-foreground">Share with a healthcare professional</DialogTitle>
          </DialogHeader>

          {loading && (
            <div className="flex items-center justify-center gap-2 py-6 text-sm text-muted-foreground">
              <Loader2 size={16} className="animate-spin" /> Creating link...
            </div>
          )}

          {!loading && link && !revoked && (
            <div className="flex flex-col gap-3.5">
              <p className="flex items-start gap-1.5 text-[12px] leading-relaxed text-muted-foreground">
                <ShieldCheck size={14} className="mt-0.5 shrink-0 text-severity-low-fg" />
                This link shows only your severity, symptoms, possible explanations, and recommendations — never your full conversation.
              </p>
              <div className="flex gap-2">
                <Input value={shareUrl} readOnly className="text-xs" onFocus={(e) => e.target.select()} />
                <Button size="sm" onClick={handleCopy} className="shrink-0 gap-1.5 rounded-full">
                  {copied ? <Check size={14} /> : <Copy size={14} />} {copied ? 'Copied' : 'Copy'}
                </Button>
              </div>
              <p className="text-[11px] text-muted-foreground">Expires {expiresLabel} · anyone with this link can view it</p>
              <Button
                variant="outline"
                size="sm"
                onClick={handleRevoke}
                disabled={revoking}
                className="self-start rounded-full text-destructive hover:text-destructive"
              >
                {revoking ? 'Revoking...' : 'Revoke link'}
              </Button>
            </div>
          )}

          {!loading && revoked && (
            <p className="py-4 text-center text-sm text-muted-foreground">
              Link revoked — it no longer works.
            </p>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
