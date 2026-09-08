import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ArrowLeft, Phone, Mail, Plus, Pencil, Trash2,
} from 'lucide-react';
import toast from 'react-hot-toast';
import {
  listEmergencyContacts, createEmergencyContact, updateEmergencyContact, deleteEmergencyContact,
} from '../api/emergencyContacts.api';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog';
import {
  AlertDialog, AlertDialogContent, AlertDialogHeader, AlertDialogTitle,
  AlertDialogDescription, AlertDialogFooter, AlertDialogAction, AlertDialogCancel,
} from '@/components/ui/alert-dialog';
import {
  Form, FormField, FormItem, FormLabel, FormControl, FormMessage,
} from '@/components/ui/form';

const contactSchema = z.object({
  name: z.string().trim().min(1, 'Name is required').max(100),
  relationship: z.string().trim().optional(),
  phone: z.string().trim().min(5, 'Phone must be at least 5 characters').max(20),
  email: z.string().trim().email('Invalid email').optional().or(z.literal('')),
});

export default function EmergencyContacts() {
  const navigate = useNavigate();
  const [contacts, setContacts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [deleting, setDeleting] = useState(null);
  const [saving, setSaving] = useState(false);

  const form = useForm({
    resolver: zodResolver(contactSchema),
    defaultValues: {
      name: '', relationship: '', phone: '', email: '',
    },
  });

  const load = useCallback(async () => {
    try {
      const data = await listEmergencyContacts();
      setContacts(data);
    } catch {
      toast.error('Failed to load emergency contacts');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const openAdd = () => {
    setEditing(null);
    form.reset({
      name: '', relationship: '', phone: '', email: '',
    });
    setDialogOpen(true);
  };

  const openEdit = (contact) => {
    setEditing(contact);
    form.reset({
      name: contact.name,
      relationship: contact.relationship || '',
      phone: contact.phone,
      email: contact.email || '',
    });
    setDialogOpen(true);
  };

  const onSubmit = async (values) => {
    setSaving(true);
    try {
      const payload = {
        ...values,
        relationship: values.relationship || undefined,
        email: values.email || undefined,
      };
      if (editing) {
        await updateEmergencyContact(editing._id, payload);
        toast.success('Updated');
      } else {
        await createEmergencyContact(payload);
        toast.success('Emergency contact added');
      }
      setDialogOpen(false);
      load();
    } catch {
      toast.error('Something went wrong');
    } finally {
      setSaving(false);
    }
  };

  const confirmDelete = async () => {
    try {
      await deleteEmergencyContact(deleting._id);
      toast.success('Removed');
      setDeleting(null);
      load();
    } catch {
      toast.error('Failed to remove');
    }
  };

  const togglePrimary = async (contact, checked) => {
    // Optimistic update so the checkbox feels immediate; reconciled by the
    // background refetch below.
    setContacts((prev) => prev.map((c) => (c._id === contact._id ? { ...c, isPrimary: checked } : c)));
    try {
      await updateEmergencyContact(contact._id, { isPrimary: checked });
    } catch {
      toast.error('Failed to update');
      load();
    }
  };

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <div className="flex items-center justify-between gap-3 border-b border-border bg-card px-4 py-3">
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate('/dashboard')}
            className="flex rounded-lg p-1 text-muted-foreground transition-colors hover:bg-accent"
            aria-label="Go back"
          >
            <ArrowLeft size={18} />
          </button>
          <div className="flex items-center gap-2.5">
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-severity-critical-bg text-severity-critical-fg">
              <Phone size={16} />
            </div>
            <div>
              <p className="font-heading text-sm font-semibold text-foreground">Emergency Contacts</p>
              <p className="text-[11px] text-muted-foreground">
                {contacts.length} contact{contacts.length !== 1 ? 's' : ''}
              </p>
            </div>
          </div>
        </div>
        <Button size="sm" onClick={openAdd} className="gap-1.5">
          <Plus size={16} /> Add
        </Button>
      </div>

      <div className="mx-auto flex w-full max-w-[640px] flex-1 flex-col gap-2.5 px-4 py-4">
        {loading && (
          <div className="flex flex-col gap-2.5">
            {Array.from({ length: 3 }).map((_, i) => (
              <Skeleton key={i} className="h-[104px] rounded-2xl" />
            ))}
          </div>
        )}

        {!loading && contacts.length === 0 && (
          <div className="flex flex-col items-center justify-center gap-3 px-4 py-16 text-center">
            <p className="text-4xl">🚑</p>
            <p className="text-base font-semibold text-foreground">No emergency contacts yet</p>
            <p className="max-w-[300px] text-sm leading-relaxed text-muted-foreground">
              Add someone we can point you to quickly if a session flags an emergency.
            </p>
            <Button onClick={openAdd} className="mt-2 gap-1.5">
              <Plus size={16} /> Add your first emergency contact
            </Button>
          </div>
        )}

        <AnimatePresence mode="popLayout">
          {!loading && contacts.map((c, i) => (
            <motion.div
              key={c._id}
              layout
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.97 }}
              transition={{ duration: 0.25, delay: i * 0.03, ease: [0.16, 1, 0.3, 1] }}
            >
              <Card className="rounded-2xl border-border/70 py-0 shadow-sm">
                <CardContent className="flex flex-col gap-3 px-[18px] py-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-sm font-semibold text-foreground">{c.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {c.relationship || 'Emergency contact'}
                      </p>
                    </div>
                    <div className="flex shrink-0 gap-1">
                      <button
                        onClick={() => openEdit(c)}
                        className="rounded-lg p-1.5 text-muted-foreground transition-colors hover:bg-accent"
                        aria-label={`Edit ${c.name}`}
                      >
                        <Pencil size={15} />
                      </button>
                      <button
                        onClick={() => setDeleting(c)}
                        className="rounded-lg p-1.5 text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive"
                        aria-label={`Remove ${c.name}`}
                      >
                        <Trash2 size={15} />
                      </button>
                    </div>
                  </div>
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex gap-2">
                      <a
                        href={`tel:${c.phone}`}
                        className="flex items-center justify-center gap-1.5 rounded-full border border-border bg-background px-3 py-2 text-xs font-medium text-foreground transition-colors hover:bg-accent"
                      >
                        <Phone size={14} /> Call
                      </a>
                      {c.email && (
                        <a
                          href={`mailto:${c.email}`}
                          className="flex items-center justify-center gap-1.5 rounded-full border border-border bg-background px-3 py-2 text-xs font-medium text-foreground transition-colors hover:bg-accent"
                        >
                          <Mail size={14} /> Email
                        </a>
                      )}
                    </div>
                    <label className="flex shrink-0 items-center gap-2 text-xs text-muted-foreground">
                      <Checkbox
                        checked={c.isPrimary}
                        onCheckedChange={(checked) => togglePrimary(c, !!checked)}
                      />
                      Primary
                    </label>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editing ? 'Edit emergency contact' : 'Add an emergency contact'}</DialogTitle>
          </DialogHeader>
          <Form {...form}>
            <div className="flex flex-col gap-4">
              <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Name</FormLabel>
                    <FormControl><Input placeholder="e.g. Alex" {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="relationship"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Relationship</FormLabel>
                    <FormControl><Input placeholder="e.g. Spouse, neighbor" {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="phone"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Phone</FormLabel>
                    <FormControl><Input type="tel" placeholder="e.g. +1 555 123 4567" {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="email"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Email (optional)</FormLabel>
                    <FormControl><Input type="email" placeholder="e.g. alex@example.com" {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
          </Form>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
            <Button onClick={form.handleSubmit(onSubmit)} disabled={saving}>
              {saving ? 'Saving...' : editing ? 'Save changes' : 'Add contact'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deleting} onOpenChange={(open) => !open && setDeleting(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove {deleting?.name}?</AlertDialogTitle>
            <AlertDialogDescription>
              This removes them from your emergency contacts. This can't be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Remove
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
