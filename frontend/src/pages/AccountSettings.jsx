import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import {
  ArrowLeft, Settings, Trash2, Laptop, ShieldAlert,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { useAuth } from '../context/AuthContext';
import {
  getAccount, updateAccount, changePassword, listTrustedDevices,
  revokeTrustedDevice, deleteAccount,
} from '../api/account.api';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import {
  Table, TableHeader, TableBody, TableRow, TableHead, TableCell,
} from '@/components/ui/table';
import {
  AlertDialog, AlertDialogContent, AlertDialogHeader, AlertDialogTitle,
  AlertDialogDescription, AlertDialogFooter, AlertDialogAction, AlertDialogCancel,
} from '@/components/ui/alert-dialog';
import {
  Form, FormField, FormItem, FormLabel, FormControl, FormMessage,
} from '@/components/ui/form';

const profileSchema = z.object({
  name: z.string().trim().min(1, 'Name is required').max(100),
  email: z.string().trim().email('Invalid email'),
});

const passwordSchema = z.object({
  currentPassword: z.string().min(1, 'Current password is required'),
  newPassword: z.string().min(6, 'New password must be at least 6 characters'),
  confirmNewPassword: z.string().min(1, 'Please confirm your new password'),
}).refine((data) => data.newPassword === data.confirmNewPassword, {
  message: 'Passwords do not match',
  path: ['confirmNewPassword'],
});

const formatDateTime = (d) => new Date(d).toLocaleString('en-GB', {
  day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit',
});

export default function AccountSettings() {
  const navigate = useNavigate();
  const { logout } = useAuth();

  const [loading, setLoading] = useState(true);
  const [savingProfile, setSavingProfile] = useState(false);
  const [savingPassword, setSavingPassword] = useState(false);

  const [devices, setDevices] = useState([]);
  const [devicesLoading, setDevicesLoading] = useState(true);

  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deletePassword, setDeletePassword] = useState('');
  const [deleting, setDeleting] = useState(false);

  const profileForm = useForm({
    resolver: zodResolver(profileSchema),
    defaultValues: { name: '', email: '' },
  });

  const passwordForm = useForm({
    resolver: zodResolver(passwordSchema),
    defaultValues: { currentPassword: '', newPassword: '', confirmNewPassword: '' },
  });

  const loadAccount = useCallback(async () => {
    try {
      const user = await getAccount();
      profileForm.reset({ name: user.name, email: user.email });
    } catch {
      toast.error('Failed to load account details');
    } finally {
      setLoading(false);
    }
  }, [profileForm]);

  const loadDevices = useCallback(async () => {
    try {
      const data = await listTrustedDevices();
      setDevices(data);
    } catch {
      toast.error('Failed to load trusted devices');
    } finally {
      setDevicesLoading(false);
    }
  }, []);

  useEffect(() => { loadAccount(); loadDevices(); }, [loadAccount, loadDevices]);

  const onSaveProfile = async (values) => {
    setSavingProfile(true);
    try {
      await updateAccount(values);
      toast.success('Profile updated');
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to update profile');
    } finally {
      setSavingProfile(false);
    }
  };

  const onChangePassword = async (values) => {
    setSavingPassword(true);
    try {
      await changePassword({
        currentPassword: values.currentPassword,
        newPassword: values.newPassword,
      });
      toast.success('Password changed. Trusted devices have been signed out.');
      passwordForm.reset({ currentPassword: '', newPassword: '', confirmNewPassword: '' });
      loadDevices();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to change password');
    } finally {
      setSavingPassword(false);
    }
  };

  const onRevokeDevice = async (id) => {
    try {
      await revokeTrustedDevice(id);
      toast.success('Device revoked');
      setDevices((prev) => prev.filter((d) => d.id !== id));
    } catch {
      toast.error('Failed to revoke device');
    }
  };

  const onConfirmDelete = async () => {
    if (!deletePassword) {
      toast.error('Enter your password to confirm');
      return;
    }
    setDeleting(true);
    try {
      await deleteAccount(deletePassword);
      toast.success('Account deleted');
      setDeleteDialogOpen(false);
      logout();
      navigate('/');
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to delete account');
      setDeleting(false);
      return;
    }
    setDeleting(false);
  };

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <div className="flex items-center gap-3 border-b border-border bg-card px-4 py-3">
        <button
          onClick={() => navigate('/dashboard')}
          className="flex rounded-lg p-1 text-muted-foreground transition-colors hover:bg-accent"
        >
          <ArrowLeft size={18} />
        </button>
        <div className="flex items-center gap-2.5">
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-muted text-foreground">
            <Settings size={16} />
          </div>
          <div>
            <p className="font-heading text-sm font-semibold text-foreground">Account Settings</p>
            <p className="text-[11px] text-muted-foreground">Profile, security & devices</p>
          </div>
        </div>
      </div>

      <div className="mx-auto w-full max-w-[640px] flex-1 px-4 py-4">
        {loading ? (
          <div className="flex flex-col gap-2.5">
            <Skeleton className="h-10 rounded-xl" />
            <Skeleton className="h-[220px] rounded-2xl" />
          </div>
        ) : (
          <Tabs defaultValue="profile">
            <TabsList className="w-full">
              <TabsTrigger value="profile">Profile</TabsTrigger>
              <TabsTrigger value="security">Security</TabsTrigger>
              <TabsTrigger value="devices">Devices</TabsTrigger>
            </TabsList>

            {/* ── Profile ─────────────────────────────────────────── */}
            <TabsContent value="profile" className="mt-4">
              <Card className="rounded-2xl border-border/70 shadow-sm">
                <CardContent className="p-5">
                  <Form {...profileForm}>
                    <div className="flex flex-col gap-4">
                      <FormField
                        control={profileForm.control}
                        name="name"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Name</FormLabel>
                            <FormControl><Input placeholder="Your name" {...field} /></FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={profileForm.control}
                        name="email"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Email</FormLabel>
                            <FormControl><Input type="email" placeholder="you@example.com" {...field} /></FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <Button
                        onClick={profileForm.handleSubmit(onSaveProfile)}
                        disabled={savingProfile}
                        className="mt-1 self-start"
                      >
                        {savingProfile ? 'Saving...' : 'Save changes'}
                      </Button>
                    </div>
                  </Form>
                </CardContent>
              </Card>
            </TabsContent>

            {/* ── Security ────────────────────────────────────────── */}
            <TabsContent value="security" className="mt-4">
              <div className="flex flex-col gap-4">
                <Card className="rounded-2xl border-border/70 shadow-sm">
                  <CardContent className="p-5">
                    <p className="mb-4 text-sm font-semibold text-foreground">Change password</p>
                    <Form {...passwordForm}>
                      <div className="flex flex-col gap-4">
                        <FormField
                          control={passwordForm.control}
                          name="currentPassword"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Current password</FormLabel>
                              <FormControl><Input type="password" {...field} /></FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                        <FormField
                          control={passwordForm.control}
                          name="newPassword"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>New password</FormLabel>
                              <FormControl><Input type="password" {...field} /></FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                        <FormField
                          control={passwordForm.control}
                          name="confirmNewPassword"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Confirm new password</FormLabel>
                              <FormControl><Input type="password" {...field} /></FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                        <Button
                          onClick={passwordForm.handleSubmit(onChangePassword)}
                          disabled={savingPassword}
                          className="mt-1 self-start"
                        >
                          {savingPassword ? 'Saving...' : 'Change password'}
                        </Button>
                      </div>
                    </Form>
                  </CardContent>
                </Card>

                <Card className="rounded-2xl border-destructive/30 shadow-sm">
                  <CardContent className="flex flex-col gap-3 p-5">
                    <div className="flex items-center gap-2">
                      <ShieldAlert size={16} className="text-destructive" />
                      <p className="text-sm font-semibold text-foreground">Delete account</p>
                    </div>
                    <p className="text-xs leading-relaxed text-muted-foreground">
                      Permanently deletes your account and all associated health profiles, sessions, and family members. This cannot be undone.
                    </p>
                    <Button
                      variant="outline"
                      className="mt-1 self-start gap-1.5 border-destructive/40 text-destructive hover:bg-destructive/10 hover:text-destructive"
                      onClick={() => { setDeletePassword(''); setDeleteDialogOpen(true); }}
                    >
                      <Trash2 size={15} /> Delete my account
                    </Button>
                  </CardContent>
                </Card>
              </div>
            </TabsContent>

            {/* ── Devices ─────────────────────────────────────────── */}
            <TabsContent value="devices" className="mt-4">
              <Card className="rounded-2xl border-border/70 shadow-sm">
                <CardContent className="p-5">
                  <p className="mb-4 text-sm font-semibold text-foreground">Trusted devices</p>
                  {devicesLoading && (
                    <div className="flex flex-col gap-2">
                      {Array.from({ length: 2 }).map((_, i) => (
                        <Skeleton key={i} className="h-10 rounded-lg" />
                      ))}
                    </div>
                  )}
                  {!devicesLoading && devices.length === 0 && (
                    <div className="flex flex-col items-center gap-2 py-10 text-center">
                      <Laptop size={28} className="text-muted-foreground" />
                      <p className="text-sm text-muted-foreground">No trusted devices remembered right now.</p>
                    </div>
                  )}
                  {!devicesLoading && devices.length > 0 && (
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Created</TableHead>
                          <TableHead>Expires</TableHead>
                          <TableHead className="text-right">Action</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {devices.map((d) => (
                          <TableRow key={d.id}>
                            <TableCell>{formatDateTime(d.createdAt)}</TableCell>
                            <TableCell>{formatDateTime(d.expiresAt)}</TableCell>
                            <TableCell className="text-right">
                              <Button
                                size="sm"
                                variant="ghost"
                                className="text-destructive hover:bg-destructive/10 hover:text-destructive"
                                onClick={() => onRevokeDevice(d.id)}
                              >
                                Revoke
                              </Button>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  )}
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        )}
      </div>

      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete your account?</AlertDialogTitle>
            <AlertDialogDescription>
              This permanently deletes your account, health profiles, sessions, and family members. Enter your password to confirm.
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
              onClick={(e) => {
                e.preventDefault();
                onConfirmDelete();
              }}
              disabled={deleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleting ? 'Deleting...' : 'Delete account'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
