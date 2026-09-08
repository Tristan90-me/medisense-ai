import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ArrowLeft, Users, Plus, Pencil, Trash2, MessageSquarePlus, ClipboardList, Pill,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { listDependents, createDependent, updateDependent, deleteDependent } from '../api/dependents.api';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
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
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';

const RELATIONSHIPS = ['child', 'spouse', 'parent', 'sibling', 'other'];
const SEX_OPTIONS = ['male', 'female', 'other', 'prefer_not_to_say'];

const dependentSchema = z.object({
  name: z.string().trim().min(1, 'Name is required').max(100),
  relationship: z.enum(RELATIONSHIPS),
  dateOfBirth: z.string().optional(),
  sex: z.string().optional(),
});

const relationshipLabel = (r) => r.charAt(0).toUpperCase() + r.slice(1);

const computeAge = (dob) => {
  if (!dob) return null;
  const diff = Date.now() - new Date(dob).getTime();
  return Math.floor(diff / (365.25 * 24 * 60 * 60 * 1000));
};

export default function Dependents() {
  const navigate = useNavigate();
  const [dependents, setDependents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [deleting, setDeleting] = useState(null);
  const [saving, setSaving] = useState(false);

  const form = useForm({
    resolver: zodResolver(dependentSchema),
    defaultValues: { name: '', relationship: 'child', dateOfBirth: '', sex: '' },
  });

  const load = useCallback(async () => {
    try {
      const data = await listDependents();
      setDependents(data);
    } catch {
      toast.error('Failed to load family members');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const openAdd = () => {
    setEditing(null);
    form.reset({ name: '', relationship: 'child', dateOfBirth: '', sex: '' });
    setDialogOpen(true);
  };

  const openEdit = (dependent) => {
    setEditing(dependent);
    form.reset({
      name: dependent.name,
      relationship: dependent.relationship,
      dateOfBirth: dependent.dateOfBirth ? dependent.dateOfBirth.slice(0, 10) : '',
      sex: dependent.sex || '',
    });
    setDialogOpen(true);
  };

  const onSubmit = async (values) => {
    setSaving(true);
    try {
      const payload = { ...values, dateOfBirth: values.dateOfBirth || undefined, sex: values.sex || undefined };
      if (editing) {
        await updateDependent(editing._id, payload);
        toast.success('Updated');
      } else {
        await createDependent(payload);
        toast.success('Family member added');
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
      await deleteDependent(deleting._id);
      toast.success('Removed');
      setDeleting(null);
      load();
    } catch {
      toast.error('Failed to remove');
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
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-accent/10 text-accent-foreground">
              <Users size={16} />
            </div>
            <div>
              <p className="font-heading text-sm font-semibold text-foreground">Family &amp; Dependents</p>
              <p className="text-[11px] text-muted-foreground">
                {dependents.length} member{dependents.length !== 1 ? 's' : ''}
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
              <Skeleton key={i} className="h-[92px] rounded-2xl" />
            ))}
          </div>
        )}

        {!loading && dependents.length === 0 && (
          <div className="flex flex-col items-center justify-center gap-3 px-4 py-16 text-center">
            <p className="text-4xl">👨‍👩‍👧</p>
            <p className="text-base font-semibold text-foreground">No family members yet</p>
            <p className="max-w-[300px] text-sm leading-relaxed text-muted-foreground">
              Add a child or elderly relative to track their symptoms and health profile separately from your own.
            </p>
            <Button onClick={openAdd} className="mt-2 gap-1.5">
              <Plus size={16} /> Add a family member
            </Button>
          </div>
        )}

        <AnimatePresence mode="popLayout">
          {!loading && dependents.map((d, i) => {
            const age = computeAge(d.dateOfBirth);
            return (
              <motion.div
                key={d._id}
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
                        <p className="text-sm font-semibold text-foreground">{d.name}</p>
                        <p className="text-xs text-muted-foreground">
                          {relationshipLabel(d.relationship)}{age !== null ? ` · ${age} yrs` : ''}
                        </p>
                      </div>
                      <div className="flex shrink-0 gap-1">
                        <button
                          onClick={() => openEdit(d)}
                          className="rounded-lg p-1.5 text-muted-foreground transition-colors hover:bg-accent"
                          aria-label={`Edit ${d.name}`}
                        >
                          <Pencil size={15} />
                        </button>
                        <button
                          onClick={() => setDeleting(d)}
                          className="rounded-lg p-1.5 text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive"
                          aria-label={`Remove ${d.name}`}
                        >
                          <Trash2 size={15} />
                        </button>
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <button
                        onClick={() => navigate(`/session?mode=quick&dependent=${d._id}`)}
                        className="flex flex-1 items-center justify-center gap-1.5 rounded-full border border-border bg-background px-3 py-2 text-xs font-medium text-foreground transition-colors hover:bg-accent"
                      >
                        <MessageSquarePlus size={14} /> Start check-in
                      </button>
                      <button
                        onClick={() => navigate(`/onboarding?dependent=${d._id}`)}
                        className="flex flex-1 items-center justify-center gap-1.5 rounded-full border border-border bg-background px-3 py-2 text-xs font-medium text-foreground transition-colors hover:bg-accent"
                      >
                        <ClipboardList size={14} /> Health profile
                      </button>
                      <button
                        onClick={() => navigate(`/medications?dependent=${d._id}`)}
                        className="flex flex-1 items-center justify-center gap-1.5 rounded-full border border-border bg-background px-3 py-2 text-xs font-medium text-foreground transition-colors hover:bg-accent"
                      >
                        <Pill size={14} /> Medications
                      </button>
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            );
          })}
        </AnimatePresence>
      </div>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editing ? 'Edit family member' : 'Add a family member'}</DialogTitle>
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
                    <Select value={field.value} onValueChange={field.onChange}>
                      <FormControl>
                        <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {RELATIONSHIPS.map((r) => (
                          <SelectItem key={r} value={r}>{relationshipLabel(r)}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="dateOfBirth"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Date of birth</FormLabel>
                    <FormControl><Input type="date" {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="sex"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Sex</FormLabel>
                    <Select value={field.value} onValueChange={field.onChange}>
                      <FormControl>
                        <SelectTrigger className="w-full"><SelectValue placeholder="Select..." /></SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {SEX_OPTIONS.map((s) => (
                          <SelectItem key={s} value={s}>{s.replace(/_/g, ' ')}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
          </Form>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
            <Button onClick={form.handleSubmit(onSubmit)} disabled={saving}>
              {saving ? 'Saving...' : editing ? 'Save changes' : 'Add family member'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deleting} onOpenChange={(open) => !open && setDeleting(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove {deleting?.name}?</AlertDialogTitle>
            <AlertDialogDescription>
              This removes their profile. Past check-in sessions and medications for them are kept but will no longer be accessible from this page.
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
