import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ArrowLeft, Calendar, Plus, MapPin, Stethoscope, X, Pencil,
} from 'lucide-react';
import toast from 'react-hot-toast';
import {
  listAppointments, createAppointment, updateAppointment, deleteAppointment,
} from '../api/appointments.api';
import { listDependents } from '../api/dependents.api';
import ErrorState from '../components/ErrorState';
import { cn } from '@/lib/utils';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
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

const appointmentSchema = z.object({
  doctorName: z.string().trim().min(1, 'Doctor or clinic name is required').max(200),
  specialty: z.string().optional(),
  dateTime: z.string().min(1, 'Date and time are required'),
  location: z.string().optional(),
  notes: z.string().optional(),
  dependent: z.string(),
});

// <input type="datetime-local"> wants "YYYY-MM-DDTHH:mm" in LOCAL time, with
// no timezone/seconds suffix — neither of which a raw ISO string from the
// API satisfies directly.
const toLocalInputValue = (iso) => {
  if (!iso) return '';
  const d = new Date(iso);
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
};

const formatDateTime = (iso) => new Date(iso).toLocaleString('en-GB', {
  weekday: 'short', day: 'numeric', month: 'short', year: 'numeric', hour: 'numeric', minute: '2-digit',
});

export default function Appointments() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const scopedDependentId = searchParams.get('dependent') || null;
  // Deep-linked from CareFinder.jsx's "Book appointment here" — pre-fills
  // the location field and opens the add dialog immediately.
  const prefillLocation = searchParams.get('location');

  const [appointments, setAppointments] = useState([]);
  const [dependents, setDependents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [filter, setFilter] = useState('upcoming'); // 'upcoming' | 'past'
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [cancelling, setCancelling] = useState(null);
  const [deleting, setDeleting] = useState(null);
  const [saving, setSaving] = useState(false);
  // Guards the one-time Care Finder prefill below — a ref, not state, since
  // flipping it should never itself trigger a re-render.
  const prefillHandledRef = useRef(false);
  // Captured once at mount — a stable "now" for the upcoming/past split
  // avoids calling Date.now() directly in the render body on every re-render.
  const [now] = useState(() => Date.now());

  const form = useForm({
    resolver: zodResolver(appointmentSchema),
    defaultValues: {
      doctorName: '', specialty: '', dateTime: '', location: '', notes: '', dependent: SELF_VALUE,
    },
  });

  const load = useCallback(async () => {
    setLoading(true);
    setLoadError(false);
    try {
      const [appts, deps] = await Promise.all([listAppointments(), listDependents()]);
      setAppointments(appts);
      setDependents(deps);
    } catch {
      setLoadError(true);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const openAdd = useCallback((initialLocation) => {
    setEditing(null);
    form.reset({
      doctorName: '', specialty: '', dateTime: '', location: initialLocation || '', notes: '', dependent: scopedDependentId || SELF_VALUE,
    });
    setDialogOpen(true);
  }, [form, scopedDependentId]);

  // Runs once per page load — opens the add dialog pre-filled with the
  // facility a user tapped "Book appointment here" for on Care Finder.
  useEffect(() => {
    if (prefillLocation && !prefillHandledRef.current) {
      prefillHandledRef.current = true;
      openAdd(prefillLocation);
    }
  }, [prefillLocation, openAdd]);

  const openEdit = (appointment) => {
    setEditing(appointment);
    form.reset({
      doctorName: appointment.doctorName,
      specialty: appointment.specialty || '',
      dateTime: toLocalInputValue(appointment.dateTime),
      location: appointment.location || '',
      notes: appointment.notes || '',
      dependent: appointment.dependent || SELF_VALUE,
    });
    setDialogOpen(true);
  };

  const onSubmit = async (values) => {
    setSaving(true);
    try {
      const payload = {
        doctorName: values.doctorName,
        specialty: values.specialty || undefined,
        dateTime: new Date(values.dateTime).toISOString(),
        location: values.location || undefined,
        notes: values.notes || undefined,
        dependent: values.dependent === SELF_VALUE ? null : values.dependent,
      };
      if (editing) {
        await updateAppointment(editing._id, payload);
        toast.success(editing.status === 'cancelled' ? 'Appointment rescheduled' : 'Updated');
      } else {
        await createAppointment(payload);
        toast.success('Appointment added');
      }
      setDialogOpen(false);
      load();
    } catch {
      toast.error('Something went wrong');
    } finally {
      setSaving(false);
    }
  };

  const confirmCancel = async () => {
    try {
      await updateAppointment(cancelling._id, { status: 'cancelled' });
      toast.success('Appointment cancelled');
      setCancelling(null);
      load();
    } catch {
      toast.error('Failed to cancel');
    }
  };

  const confirmDelete = async () => {
    try {
      await deleteAppointment(deleting._id);
      toast.success('Removed');
      setDeleting(null);
      load();
    } catch {
      toast.error('Failed to remove');
    }
  };

  const isUpcoming = useCallback(
    (a) => a.status === 'scheduled' && new Date(a.dateTime).getTime() >= now,
    [now],
  );

  const filtered = useMemo(() => {
    const list = appointments.filter((a) => (filter === 'upcoming' ? isUpcoming(a) : !isUpcoming(a)));
    return list.slice().sort((a, b) => {
      const diff = new Date(a.dateTime) - new Date(b.dateTime);
      return filter === 'upcoming' ? diff : -diff;
    });
  }, [appointments, filter, isUpcoming]);

  // Groups the filtered list into a "Myself" section plus one section per
  // dependent, optionally narrowed when arriving via ?dependent=<id>.
  const groups = useMemo(() => {
    const bySelf = filtered.filter((a) => !a.dependent);
    const byDependent = new Map();
    filtered.forEach((a) => {
      if (!a.dependent) return;
      const key = typeof a.dependent === 'string' ? a.dependent : a.dependent?.toString();
      if (!byDependent.has(key)) byDependent.set(key, []);
      byDependent.get(key).push(a);
    });

    const result = [];
    if (!scopedDependentId) result.push({ id: null, label: 'Myself', items: bySelf });
    dependents.forEach((d) => {
      if (scopedDependentId && d._id !== scopedDependentId) return;
      result.push({ id: d._id, label: d.name, items: byDependent.get(d._id) || [] });
    });
    return result.filter((g) => g.items.length > 0 || dependents.length === 0 || !scopedDependentId);
  }, [filtered, dependents, scopedDependentId]);

  const totalCount = appointments.length;
  const upcomingCount = appointments.filter(isUpcoming).length;
  const isEmpty = !loading && !loadError && totalCount === 0;
  const filteredIsEmpty = !loading && !loadError && !isEmpty && filtered.length === 0;

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
              <Calendar size={16} />
            </div>
            <div>
              <p className="font-heading text-sm font-semibold text-foreground">Appointments</p>
              <p className="text-[11px] text-muted-foreground">
                {upcomingCount} upcoming
              </p>
            </div>
          </div>
        </div>
        <Button size="sm" onClick={() => openAdd()} className="gap-1.5">
          <Plus size={16} /> Add
        </Button>
      </div>

      <div className="mx-auto flex w-full max-w-[640px] flex-1 flex-col gap-4 px-4 py-4">
        {!loading && !loadError && !isEmpty && (
          <div className="flex gap-1.5">
            <button
              onClick={() => setFilter('upcoming')}
              className={cn(
                'rounded-full border px-3.5 py-1.5 text-xs font-medium transition-colors',
                filter === 'upcoming'
                  ? 'border-primary bg-primary text-primary-foreground'
                  : 'border-border bg-background text-foreground hover:bg-accent'
              )}
            >
              Upcoming
            </button>
            <button
              onClick={() => setFilter('past')}
              className={cn(
                'rounded-full border px-3.5 py-1.5 text-xs font-medium transition-colors',
                filter === 'past'
                  ? 'border-primary bg-primary text-primary-foreground'
                  : 'border-border bg-background text-foreground hover:bg-accent'
              )}
            >
              Past &amp; cancelled
            </button>
          </div>
        )}

        {loading && (
          <div className="flex flex-col gap-2.5">
            {Array.from({ length: 3 }).map((_, i) => (
              <Skeleton key={i} className="h-[110px] rounded-2xl" />
            ))}
          </div>
        )}

        {!loading && loadError && (
          <ErrorState
            title="We couldn't load your appointments"
            message="Your information is safe."
            onRetry={load}
          />
        )}

        {isEmpty && (
          <div className="flex flex-col items-center justify-center gap-3 px-4 py-16 text-center">
            <p className="text-4xl">🗓️</p>
            <p className="text-base font-semibold text-foreground">No appointments tracked yet</p>
            <p className="max-w-[300px] text-sm leading-relaxed text-muted-foreground">
              Keep track of upcoming visits for yourself or a family member — doctor, date, and where to go.
            </p>
            <Button onClick={() => openAdd()} className="mt-2 gap-1.5">
              <Plus size={16} /> Add an appointment
            </Button>
          </div>
        )}

        {filteredIsEmpty && (
          <div className="flex flex-col items-center justify-center gap-2 px-4 py-14 text-center">
            <p className="text-sm font-semibold text-foreground">
              {filter === 'upcoming' ? 'No upcoming appointments' : 'No past or cancelled appointments'}
            </p>
            <p className="max-w-[280px] text-xs leading-relaxed text-muted-foreground">
              {filter === 'upcoming'
                ? 'Add one, or check the Past & cancelled tab for earlier visits.'
                : "Appointments move here once their date passes, or if you cancel them."}
            </p>
          </div>
        )}

        {!loading && !loadError && !filteredIsEmpty && groups.map((group) => (
          group.items.length > 0 && (
            <div key={group.id || 'self'} className="flex flex-col gap-2.5">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                {group.label}
              </p>
              <AnimatePresence mode="popLayout">
                {group.items.map((a, i) => (
                  <motion.div
                    key={a._id}
                    layout
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.97 }}
                    transition={{ duration: 0.25, delay: i * 0.03, ease: [0.16, 1, 0.3, 1] }}
                  >
                    <Card className="rounded-2xl border-border/70 shadow-sm">
                      <CardContent className="flex flex-col gap-2 px-[18px] py-4">
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <p className="truncate text-sm font-semibold text-foreground">{a.doctorName}</p>
                            {a.specialty && (
                              <p className="flex items-center gap-1 truncate text-xs text-muted-foreground">
                                <Stethoscope size={11} className="shrink-0" /> {a.specialty}
                              </p>
                            )}
                          </div>
                          {a.status === 'cancelled' && (
                            <Badge variant="outline" className="shrink-0 border-destructive/40 text-destructive">Cancelled</Badge>
                          )}
                        </div>

                        <p className="flex items-center gap-1.5 text-xs text-foreground">
                          <Calendar size={12} className="shrink-0 text-primary" /> {formatDateTime(a.dateTime)}
                        </p>
                        {a.location && (
                          <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
                            <MapPin size={12} className="shrink-0" /> {a.location}
                          </p>
                        )}
                        {a.notes && (
                          <p className="text-xs leading-relaxed text-muted-foreground">{a.notes}</p>
                        )}

                        {filter === 'upcoming' ? (
                          <div className="flex items-center gap-1.5 pt-1">
                            <Button size="sm" variant="outline" onClick={() => openEdit(a)} className="gap-1.5 rounded-full">
                              <Pencil size={12} /> Reschedule
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => setCancelling(a)}
                              className="gap-1.5 rounded-full text-destructive hover:bg-destructive/10 hover:text-destructive"
                            >
                              <X size={12} /> Cancel
                            </Button>
                          </div>
                        ) : (
                          <div className="flex items-center gap-1.5 pt-1">
                            {a.status === 'cancelled' && (
                              <Button size="sm" variant="outline" onClick={() => openEdit(a)} className="gap-1.5 rounded-full">
                                <Pencil size={12} /> Reschedule
                              </Button>
                            )}
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => setDeleting(a)}
                              className="ml-auto gap-1.5 rounded-full text-destructive hover:bg-destructive/10 hover:text-destructive"
                            >
                              Remove
                            </Button>
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  </motion.div>
                ))}
              </AnimatePresence>
            </div>
          )
        ))}
      </div>

      {/* Add/Edit dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editing ? 'Reschedule appointment' : 'Add an appointment'}</DialogTitle>
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
                name="doctorName"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Doctor or clinic</FormLabel>
                    <FormControl><Input placeholder="e.g. Dr. Mensah" {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="specialty"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Specialty (optional)</FormLabel>
                    <FormControl><Input placeholder="e.g. General Physician" {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="dateTime"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Date &amp; time</FormLabel>
                    <FormControl><Input type="datetime-local" {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="location"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Location (optional)</FormLabel>
                    <FormControl><Input placeholder="e.g. University Hospital" {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="notes"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Notes (optional)</FormLabel>
                    <FormControl><Textarea placeholder="e.g. Bring previous test results" {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
          </Form>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
            <Button onClick={form.handleSubmit(onSubmit)} disabled={saving}>
              {saving ? 'Saving...' : editing ? 'Save changes' : 'Add appointment'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!cancelling} onOpenChange={(open) => !open && setCancelling(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Cancel this appointment?</AlertDialogTitle>
            <AlertDialogDescription>
              It will move to Past &amp; cancelled — you can still reschedule it later if needed.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Keep it</AlertDialogCancel>
            <AlertDialogAction onClick={confirmCancel} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Cancel appointment
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={!!deleting} onOpenChange={(open) => !open && setDeleting(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove this appointment?</AlertDialogTitle>
            <AlertDialogDescription>
              This permanently removes the record. This cannot be undone.
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
