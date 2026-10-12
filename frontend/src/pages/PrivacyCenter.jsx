import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ArrowLeft, Lock, HeartPulse, ShieldCheck, Laptop, ChevronRight,
  Download, Trash2, Loader2, Settings,
} from 'lucide-react';
import toast from 'react-hot-toast';
import api from '../api/axios';
import { listTrustedDevices, deleteHealthHistory, downloadMyData } from '../api/account.api';
import { listDependents } from '../api/dependents.api';
import { listMedications } from '../api/medications.api';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import {
  AlertDialog, AlertDialogContent, AlertDialogHeader, AlertDialogTitle,
  AlertDialogDescription, AlertDialogFooter, AlertDialogAction, AlertDialogCancel,
} from '@/components/ui/alert-dialog';

export default function PrivacyCenter() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [counts, setCounts] = useState({ sessions: 0, dependents: 0, medications: 0, devices: 0 });

  const [exporting, setExporting] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deletePassword, setDeletePassword] = useState('');
  const [deleting, setDeleting] = useState(false);

  const load = useCallback(async () => {
    try {
      const [sessionsRes, dependents, medications, devices] = await Promise.all([
        api.get('/ai/sessions'),
        listDependents(),
        listMedications(),
        listTrustedDevices(),
      ]);
      setCounts({
        sessions: sessionsRes.data.sessions.length,
        dependents: dependents.length,
        medications: medications.length,
        devices: devices.length,
      });
    } catch {
      toast.error('Failed to load privacy overview');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleDownload = async () => {
    setExporting(true);
    try {
      await downloadMyData();
    } catch {
      toast.error('Failed to export your data');
    } finally {
      setExporting(false);
    }
  };

  const handleConfirmDeleteHistory = async () => {
    if (!deletePassword) {
      toast.error('Enter your password to confirm');
      return;
    }
    setDeleting(true);
    try {
      await deleteHealthHistory(deletePassword);
      toast.success('Health history deleted');
      setDeleteDialogOpen(false);
      load();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to delete health history');
    } finally {
      setDeleting(false);
    }
  };

  const healthDataLinks = [
    { label: 'Your health profile', desc: 'Age, conditions, allergies, medications', to: '/onboarding' },
    { label: 'Assessment history', desc: `${counts.sessions} session${counts.sessions !== 1 ? 's' : ''}`, to: '/history' },
    { label: 'Family members', desc: `${counts.dependents} dependent${counts.dependents !== 1 ? 's' : ''}`, to: '/dependents' },
    { label: 'Active medications', desc: `${counts.medications} tracked`, to: '/medications' },
  ];

  return (
    <div className="min-h-screen bg-background">
      <div className="flex items-center gap-3 border-b border-border bg-card px-4 py-3">
        <button
          onClick={() => navigate('/account-settings')}
          className="flex rounded-lg p-1 text-muted-foreground transition-colors hover:bg-accent"
          aria-label="Go back"
        >
          <ArrowLeft size={18} />
        </button>
        <div className="flex items-center gap-2.5">
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10 text-primary">
            <Lock size={16} />
          </div>
          <div>
            <p className="font-heading text-sm font-semibold text-foreground">Privacy Center</p>
            <p className="text-[11px] text-muted-foreground">Privacy & security</p>
          </div>
        </div>
      </div>

      <div className="mx-auto flex w-full max-w-[640px] flex-col gap-4 px-4 py-4">
        {loading ? (
          <div className="flex flex-col gap-3">
            <Skeleton className="h-[120px] rounded-2xl" />
            <Skeleton className="h-[220px] rounded-2xl" />
            <Skeleton className="h-[180px] rounded-2xl" />
          </div>
        ) : (
          <>
            {/* Account security */}
            <Card className="rounded-2xl border-border/70 shadow-sm">
              <CardContent className="flex flex-col gap-3 p-5">
                <p className="flex items-center gap-1.5 text-sm font-semibold text-foreground">
                  <ShieldCheck size={15} className="text-severity-low-fg" /> Account Security
                </p>
                <div className="flex items-center justify-between text-[13px]">
                  <span className="text-muted-foreground">Password</span>
                  <span className="font-medium text-foreground">Protected</span>
                </div>
                <div className="flex items-center justify-between text-[13px]">
                  <span className="flex items-center gap-1.5 text-muted-foreground"><Laptop size={13} /> Trusted devices</span>
                  <span className="font-medium text-foreground">{counts.devices} remembered</span>
                </div>
                <Button variant="outline" size="sm" onClick={() => navigate('/account-settings')} className="mt-1 gap-1.5 self-start rounded-full">
                  <Settings size={13} /> Manage in Account Settings
                </Button>
              </CardContent>
            </Card>

            {/* Health data */}
            <Card className="rounded-2xl border-border/70 shadow-sm">
              <CardContent className="flex flex-col gap-1 p-5">
                <p className="mb-2 flex items-center gap-1.5 text-sm font-semibold text-foreground">
                  <HeartPulse size={15} className="text-severity-high-fg" /> Health Data
                </p>
                {healthDataLinks.map((l) => (
                  <button
                    key={l.to}
                    onClick={() => navigate(l.to)}
                    className="flex items-center justify-between gap-3 rounded-xl px-2 py-2.5 text-left transition-colors hover:bg-accent"
                  >
                    <div>
                      <p className="text-[13px] font-medium text-foreground">{l.label}</p>
                      <p className="text-[11px] text-muted-foreground">{l.desc}</p>
                    </div>
                    <ChevronRight size={15} className="shrink-0 text-muted-foreground/60" />
                  </button>
                ))}
              </CardContent>
            </Card>

            {/* Data controls */}
            <Card className="rounded-2xl border-border/70 shadow-sm">
              <CardContent className="flex flex-col gap-3 p-5">
                <p className="text-sm font-semibold text-foreground">Data controls</p>

                <div className="flex flex-col gap-1">
                  <Button variant="outline" onClick={handleDownload} disabled={exporting} className="justify-start gap-2 self-start rounded-full">
                    {exporting ? <Loader2 size={15} className="animate-spin" /> : <Download size={15} />}
                    {exporting ? 'Preparing...' : 'Download my data'}
                  </Button>
                  <p className="px-1 text-[11px] text-muted-foreground">
                    A JSON file with your profile, sessions, medications, and family members.
                  </p>
                </div>

                <div className="flex flex-col gap-1">
                  <Button
                    variant="outline"
                    onClick={() => { setDeletePassword(''); setDeleteDialogOpen(true); }}
                    className="justify-start gap-2 self-start rounded-full border-destructive/40 text-destructive hover:bg-destructive/10 hover:text-destructive"
                  >
                    <Trash2 size={15} /> Delete health history
                  </Button>
                  <p className="px-1 text-[11px] text-muted-foreground">
                    Permanently deletes sessions, medications, photos, and your health score — keeps your account and profile.
                  </p>
                </div>

                <div className="flex flex-col gap-1">
                  <Button
                    variant="outline"
                    onClick={() => navigate('/account-settings')}
                    className="justify-start gap-2 self-start rounded-full border-destructive/40 text-destructive hover:bg-destructive/10 hover:text-destructive"
                  >
                    <Trash2 size={15} /> Delete account
                  </Button>
                  <p className="px-1 text-[11px] text-muted-foreground">Available in Account Settings &gt; Security.</p>
                </div>
              </CardContent>
            </Card>
          </>
        )}
      </div>

      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete your health history?</AlertDialogTitle>
            <AlertDialogDescription>
              This permanently deletes your sessions, medications, photos, and health score — for you and any family
              members. Your account and health profile stay. Enter your password to confirm.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <Input
            type="password"
            placeholder="Password"
            value={deletePassword}
            onChange={(e) => setDeletePassword(e.target.value)}
          />
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => { e.preventDefault(); handleConfirmDeleteHistory(); }}
              disabled={deleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleting ? 'Deleting...' : 'Delete health history'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
