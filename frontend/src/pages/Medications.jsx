import { useState, useEffect, useCallback, useMemo } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ArrowLeft, Pill, Plus, Pencil, Trash2,
} from 'lucide-react';
import toast from 'react-hot-toast';
import {
  listMedications, createMedication, updateMedication, deleteMedication,
} from '../api/medications.api';
import { listDependents } from '../api/dependents.api';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
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

const SELF_VALUE = 'self';

const TIME_REGEX = /^([01]\d|2[0-3]):([0-5]\d)$/;

const medicationSchema = z.object({
  name: z.string().trim().min(1, 'Name is required').max(200),
  dosage: z.string().optional(),
  frequency: z.string().optional(),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
  reminderTimes: z.string().optional().refine((v) => {
    if (!v) return true;
    return v.split(',').map((t) => t.trim()).filter(Boolean).every((t) => TIME_REGEX.test(t));
  }, { message: 'Use comma-separated 24h times, e.g. 08:00, 20:00' }),
  dependent: z.string(),
});

const parseReminderTimes = (value) => (value || '')
  .split(',')
  .map((t) => t.trim())
  .filter(Boolean);

export default function Medications() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const scopedDependentId = searchParams.get('dependent') || null;

  const [medications, setMedications] = useState([]);
  const [dependents, setDependents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [deleting, setDeleting] = useState(null);
  const [saving, setSaving] = useState(false);

  const form = useForm({
    resolver: zodResolver(medicationSchema),
    defaultValues: {
      name: '', dosage: '', frequency: '', startDate: '', endDate: '', reminderTimes: '', dependent: SELF_VALUE,
    },
  });

  const load = useCallback(async () => {
    try {
      const [meds, deps] = await Promise.all([listMedications(), listDependents()]);
      setMedications(meds);
      setDependents(deps);
    } catch {
      toast.error('Failed to load medications');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const dependentNameById = useMemo(() => {
    const map = new Map();
    dependents.forEach((d) => map.set(d._id, d.name));
    return map;
  }, [dependents]);

  // Groups the flat, unfiltered list into a "Myself" section plus one
  // section per dependent, optionally narrowed to a single person when
  // arriving via /medications?dependent=<id> (a Dependents.jsx convenience link).
  const groups = useMemo(() => {
    const bySelf = medications.filter((m) => !m.dependent);
    const byDependent = new Map();
    medications.forEach((m) => {
      if (!m.dependent) return;
      const key = typeof m.dependent === 'string' ? m.dependent : m.dependent?.toString();
      if (!byDependent.has(key)) byDependent.set(key, []);
      byDependent.get(key).push(m);
    });

    const result = [];
    if (!scopedDependentId) result.push({ id: null, label: 'Myself', items: bySelf });
    dependents.forEach((d) => {
      if (scopedDependentId && d._id !== scopedDependentId) return;
      result.push({ id: d._id, label: d.name, items: byDependent.get(d._id) || [] });
    });
    if (scopedDependentId && dependentNameById.size === 0) {
      // dependents haven't loaded yet, or the id doesn't resolve — fall back
      // to showing nothing rather than crashing.
      return result;
    }
    return result;
  }, [medications, dependents, scopedDependentId, dependentNameById]);

  const openAdd = () => {
    setEditing(null);
    form.reset({
      name: '',
      dosage: '',
      frequency: '',
      startDate: '',
      endDate: '',
      reminderTimes: '',
      dependent: scopedDependentId || SELF_VALUE,
    });
    setDialogOpen(true);
  };

  const openEdit = (medication) => {
    setEditing(medication);
    form.reset({
      name: medication.name,
      dosage: medication.dosage || '',
      frequency: medication.frequency || '',
      startDate: medication.startDate ? medication.startDate.slice(0, 10) : '',
      endDate: medication.endDate ? medication.endDate.slice(0, 10) : '',
      reminderTimes: (medication.reminderTimes || []).join(', '),
      dependent: medication.dependent || SELF_VALUE,
    });
    setDialogOpen(true);
  };

  const onSubmit = async (values) => {
    setSaving(true);
    try {
      const payload = {
        name: values.name,
        dosage: values.dosage || undefined,
        frequency: values.frequency || undefined,
        startDate: values.startDate || undefined,
        endDate: values.endDate || undefined,
        reminderTimes: parseReminderTimes(values.reminderTimes),
        dependent: values.dependent === SELF_VALUE ? null : values.dependent,
      };
      if (editing) {
        await updateMedication(editing._id, payload);
        toast.success('Updated');
      } else {
        await createMedication(payload);
        toast.success('Medication added');
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
      await deleteMedication(deleting._id);
      toast.success('Removed');
      setDeleting(null);
      load();
    } catch {
      toast.error('Failed to remove');
    }
  };

  const toggleActive = async (medication, active) => {
    setMedications((prev) => prev.map((m) => (m._id === medication._id ? { ...m, active } : m)));
    try {
      await updateMedication(medication._id, { active });
    } catch {
      toast.error('Failed to update');
      setMedications((prev) => prev.map((m) => (m._id === medication._id ? { ...m, active: !active } : m)));
    }
  };

  const totalCount = medications.length;
  const isEmpty = !loading && totalCount === 0;

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
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10 text-primary">
              <Pill size={16} />
            </div>
            <div>
              <p className="font-heading text-sm font-semibold text-foreground">Medication Tracker</p>
              <p className="text-[11px] text-muted-foreground">
                {totalCount} medication{totalCount !== 1 ? 's' : ''}
              </p>
            </div>
          </div>
        </div>
        <Button size="sm" onClick={openAdd} className="gap-1.5">
          <Plus size={16} /> Add
        </Button>
      </div>

      <div className="mx-auto flex w-full max-w-[640px] flex-1 flex-col gap-5 px-4 py-4">
        {loading && (
          <div className="flex flex-col gap-2.5">
            {Array.from({ length: 3 }).map((_, i) => (
              <Skeleton key={i} className="h-[92px] rounded-2xl" />
            ))}
          </div>
        )}

        {isEmpty && (
          <div className="flex flex-col items-center justify-center gap-3 px-4 py-16 text-center">
            <p className="text-4xl">💊</p>
            <p className="text-base font-semibold text-foreground">No medications tracked yet</p>
            <p className="max-w-[300px] text-sm leading-relaxed text-muted-foreground">
              Add a medication for yourself or a family member to keep dosage, frequency, and reminders in one place.
            </p>
            <Button onClick={openAdd} className="mt-2 gap-1.5">
              <Plus size={16} /> Add a medication
            </Button>
          </div>
        )}

        {!loading && !isEmpty && groups.map((group) => (
          <div key={group.id || 'self'} className="flex flex-col gap-2.5">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
              {group.label}
            </p>
            {group.items.length === 0 && (
              <p className="text-xs text-muted-foreground">No medications for {group.label}.</p>
            )}
            <AnimatePresence mode="popLayout">
              {group.items.map((m, i) => (
                <motion.div
                  key={m._id}
                  layout
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.97 }}
                  transition={{ duration: 0.25, delay: i * 0.03, ease: [0.16, 1, 0.3, 1] }}
                >
                  <Card className="rounded-2xl border-border/70 py-0 shadow-sm">
                    <CardContent className="flex items-center justify-between gap-3 px-[18px] py-4">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-semibold text-foreground">{m.name}</p>
                        <p className="truncate text-xs text-muted-foreground">
                          {[m.dosage, m.frequency].filter(Boolean).join(' · ') || 'No dosage/frequency set'}
                        </p>
                      </div>
                      <div className="flex shrink-0 items-center gap-1">
                        <Switch
                          checked={!!m.active}
                          onCheckedChange={(checked) => toggleActive(m, checked)}
                          aria-label={`Toggle ${m.name} active`}
                        />
                        <button
                          onClick={() => openEdit(m)}
                          className="rounded-lg p-1.5 text-muted-foreground transition-colors hover:bg-accent"
                          aria-label={`Edit ${m.name}`}
                        >
                          <Pencil size={15} />
                        </button>
                        <button
                          onClick={() => setDeleting(m)}
                          className="rounded-lg p-1.5 text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive"
                          aria-label={`Remove ${m.name}`}
                        >
                          <Trash2 size={15} />
                        </button>
                      </div>
                    </CardContent>
                  </Card>
                </motion.div>
              ))}
            </AnimatePresence>
          </div>
        ))}
      </div>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editing ? 'Edit medication' : 'Add a medication'}</DialogTitle>
          </DialogHeader>
          <Form {...form}>
            <div className="flex flex-col gap-4">
              <FormField
                control={form.control}
                name="dependent"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>For</FormLabel>
                    <Select value={field.value} onValueChange={field.onChange}>
                      <FormControl>
                        <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value={SELF_VALUE}>Myself</SelectItem>
                        {dependents.map((d) => (
                          <SelectItem key={d._id} value={d._id}>{d.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Name</FormLabel>
                    <FormControl><Input placeholder="e.g. Ibuprofen" {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="dosage"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Dosage</FormLabel>
                    <FormControl><Input placeholder="e.g. 200mg" {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="frequency"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Frequency</FormLabel>
                    <FormControl><Input placeholder="e.g. Twice daily" {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <div className="grid grid-cols-2 gap-3">
                <FormField
                  control={form.control}
                  name="startDate"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Start date</FormLabel>
                      <FormControl><Input type="date" {...field} /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="endDate"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>End date</FormLabel>
                      <FormControl><Input type="date" {...field} /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
              <FormField
                control={form.control}
                name="reminderTimes"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Reminder times</FormLabel>
                    <FormControl><Input placeholder="e.g. 08:00, 20:00" {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
          </Form>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
            <Button onClick={form.handleSubmit(onSubmit)} disabled={saving}>
              {saving ? 'Saving...' : editing ? 'Save changes' : 'Add medication'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deleting} onOpenChange={(open) => !open && setDeleting(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove {deleting?.name}?</AlertDialogTitle>
            <AlertDialogDescription>
              This permanently removes this medication record. This cannot be undone.
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
