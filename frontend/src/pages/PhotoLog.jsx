import { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ArrowLeft, Camera, Plus, Trash2, AlertTriangle, ImageOff, Upload,
  Zap, ClipboardList, ArrowRight, LayoutGrid, LineChart, ArrowLeftRight,
} from 'lucide-react';
import toast from 'react-hot-toast';
import {
  listPhotos, uploadPhoto, deletePhoto, getPhotoImageUrl,
} from '../api/photoLog.api';
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
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';

const SELF_VALUE = 'self';
const OTHER_MALE_VALUE = 'other_male';
const OTHER_FEMALE_VALUE = 'other_female';

// Radix Select disallows an empty-string item value (it's reserved for the
// placeholder/unselected state internally), so "not specified" and "custom"
// need real sentinel values — mapped back to '' / free text at submit time.
const NONE_REGION_VALUE = '__none__';
const CUSTOM_REGION_VALUE = '__custom__';

const BODY_REGIONS = [
  { value: 'head', label: 'Head & Neck' },
  { value: 'chest', label: 'Chest' },
  { value: 'abdomen', label: 'Abdomen' },
  { value: 'leftArm', label: 'Left Arm' },
  { value: 'rightArm', label: 'Right Arm' },
  { value: 'leftLeg', label: 'Left Leg' },
  { value: 'rightLeg', label: 'Right Leg' },
  { value: 'back', label: 'Back' },
];

// Falls back to the raw value for a custom (non-preset) region string.
const bodyRegionLabel = (value) => (value ? BODY_REGIONS.find((r) => r.value === value)?.label || value : null);

const formatDate = (d) => new Date(d).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });

// Loads its own blob-URL image (see api/photoLog.api.js's getPhotoImageUrl
// note on why a bare <img src> can't hit the authenticated endpoint
// directly), revoking it on unmount or whenever the photo id changes so
// re-renders in a list don't leak object URLs.
function PhotoThumbnail({ photo, onClick }) {
  const [url, setUrl] = useState(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let ignore = false;
    let objectUrl = null;
    setUrl(null);
    setFailed(false);
    getPhotoImageUrl(photo._id)
      .then((u) => {
        if (ignore) return URL.revokeObjectURL(u);
        objectUrl = u;
        setUrl(u);
      })
      .catch(() => { if (!ignore) setFailed(true); });
    return () => {
      ignore = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [photo._id]);

  return (
    <button
      type="button"
      onClick={onClick}
      className="group relative aspect-square w-full overflow-hidden rounded-2xl border border-border/70 bg-muted text-left"
    >
      {url && (
        <motion.img
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.25 }}
          src={url}
          alt={photo.caption || 'Symptom photo'}
          className="h-full w-full object-cover transition-transform group-hover:scale-105"
        />
      )}
      {!url && !failed && <Skeleton className="h-full w-full rounded-none" />}
      {failed && (
        <div className="flex h-full w-full items-center justify-center text-muted-foreground">
          <ImageOff size={20} />
        </div>
      )}
      {photo.aiAnalysis?.flaggedForReview && (
        <span className="absolute right-1.5 top-1.5 flex h-5 w-5 animate-pulse items-center justify-center rounded-full bg-severity-moderate-bg text-severity-moderate-fg shadow-sm">
          <AlertTriangle size={12} />
        </span>
      )}
    </button>
  );
}

// Full-size image for the detail dialog — fetched independently of the
// thumbnail's own object URL so each has its own lifecycle, revoked when the
// dialog closes or the photo changes.
function PhotoFullImage({ photoId }) {
  const [url, setUrl] = useState(null);

  useEffect(() => {
    let ignore = false;
    let objectUrl = null;
    setUrl(null);
    getPhotoImageUrl(photoId)
      .then((u) => {
        if (ignore) return URL.revokeObjectURL(u);
        objectUrl = u;
        setUrl(u);
      })
      .catch(() => {});
    return () => {
      ignore = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [photoId]);

  if (!url) return <Skeleton className="aspect-square w-full rounded-xl" />;
  return (
    <motion.img
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.3 }}
      src={url}
      alt="Symptom photo, full size"
      className="w-full rounded-xl object-contain"
    />
  );
}

const confidenceLabel = { low: 'Low confidence', moderate: 'Moderate confidence', high: 'High confidence' };

export default function PhotoLog() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const scopedDependentId = searchParams.get('dependent') || null;

  const [photos, setPhotos] = useState([]);
  const [dependents, setDependents] = useState([]);
  const [loading, setLoading] = useState(true);

  const [uploadOpen, setUploadOpen] = useState(false);
  const [file, setFile] = useState(null);
  const [previewUrl, setPreviewUrl] = useState(null);
  const [caption, setCaption] = useState('');
  const [bodyRegionSelect, setBodyRegionSelect] = useState(NONE_REGION_VALUE);
  const [customBodyRegion, setCustomBodyRegion] = useState('');
  const [dependentChoice, setDependentChoice] = useState(SELF_VALUE);
  const [saving, setSaving] = useState(false);
  const cameraInputRef = useRef(null);
  const galleryInputRef = useRef(null);

  const [detailPhoto, setDetailPhoto] = useState(null);
  const [deleting, setDeleting] = useState(null);
  const [loadError, setLoadError] = useState(false);
  const [view, setView] = useState('all'); // 'all' | 'progress'
  const [compareGroup, setCompareGroup] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    setLoadError(false);
    try {
      const [photoList, deps] = await Promise.all([
        listPhotos(scopedDependentId),
        listDependents(),
      ]);
      setPhotos(photoList);
      setDependents(deps);
    } catch {
      setLoadError(true);
    } finally {
      setLoading(false);
    }
  }, [scopedDependentId]);

  useEffect(() => { load(); }, [load]);

  // Local (not-yet-uploaded) preview — a plain object URL over the raw File,
  // independent of the API's blob-fetch helper. Revoked on selection change
  // and when the dialog closes.
  useEffect(() => {
    if (!file) { setPreviewUrl(null); return undefined; }
    const url = URL.createObjectURL(file);
    setPreviewUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);

  const resetUploadForm = () => {
    setFile(null);
    setCaption('');
    setBodyRegionSelect(NONE_REGION_VALUE);
    setCustomBodyRegion('');
    setDependentChoice(scopedDependentId || SELF_VALUE);
    if (cameraInputRef.current) cameraInputRef.current.value = '';
    if (galleryInputRef.current) galleryInputRef.current.value = '';
  };

  const openUpload = () => {
    resetUploadForm();
    setUploadOpen(true);
  };

  const closeUpload = (open) => {
    setUploadOpen(open);
    if (!open) resetUploadForm();
  };

  const onFileChange = (e) => {
    const selected = e.target.files?.[0] || null;
    setFile(selected);
  };

  const onSubmit = async () => {
    if (!file) {
      toast.error('Choose a photo first');
      return;
    }
    setSaving(true);
    try {
      const formData = new FormData();
      formData.append('photo', file);
      if (caption.trim()) formData.append('caption', caption.trim());

      const effectiveBodyRegion = bodyRegionSelect === NONE_REGION_VALUE
        ? ''
        : bodyRegionSelect === CUSTOM_REGION_VALUE
          ? customBodyRegion.trim()
          : bodyRegionSelect;
      if (effectiveBodyRegion) formData.append('bodyRegion', effectiveBodyRegion);

      if (dependentChoice === OTHER_MALE_VALUE) formData.append('subjectSex', 'male');
      else if (dependentChoice === OTHER_FEMALE_VALUE) formData.append('subjectSex', 'female');
      else if (dependentChoice !== SELF_VALUE) formData.append('dependent', dependentChoice);

      await uploadPhoto(formData);
      toast.success('Photo logged');
      setUploadOpen(false);
      resetUploadForm();
      load();
    } catch {
      toast.error('Failed to upload photo');
    } finally {
      setSaving(false);
    }
  };

  const confirmDelete = async () => {
    try {
      await deletePhoto(deleting._id);
      toast.success('Photo removed');
      if (detailPhoto?._id === deleting._id) setDetailPhoto(null);
      setDeleting(null);
      load();
    } catch {
      toast.error('Failed to remove photo');
    }
  };

  const dependentNameById = new Map(dependents.map((d) => [d._id, d.name]));

  const subjectLabel = (photo) => {
    if (photo.dependent) return dependentNameById.get(photo.dependent) || 'Dependent';
    if (photo.subjectSex) return `Other (${photo.subjectSex === 'male' ? 'Male' : 'Female'})`;
    return null;
  };

  // Groups photos by (body region, subject) so "progress over time" never
  // mixes, say, the account owner's chest photos with a dependent's — only
  // groups with 2+ photos are shown, since a single photo has nothing to
  // compare against. Photos logged with no body region can't be grouped at
  // all (there's no "same spot over time" to anchor them to).
  const progressGroups = photos
    .filter((p) => p.bodyRegion)
    .reduce((groups, p) => {
      const subjectKey = p.dependent || p.subjectSex || 'self';
      const key = `${p.bodyRegion}|${subjectKey}`;
      let group = groups.find((g) => g.key === key);
      if (!group) {
        group = { key, bodyRegion: p.bodyRegion, subjectLabel: subjectLabel(p) || 'Myself', items: [] };
        groups.push(group);
      }
      group.items.push(p);
      return groups;
    }, [])
    .filter((g) => g.items.length >= 2)
    .map((g) => ({
      ...g,
      items: g.items.slice().sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt)),
    }))
    .sort((a, b) => {
      const aLast = a.items[a.items.length - 1].createdAt;
      const bLast = b.items[b.items.length - 1].createdAt;
      return new Date(bLast) - new Date(aLast);
    });

  const startAssessment = (photo, mode) => {
    const parts = [];
    const region = bodyRegionLabel(photo.bodyRegion);
    if (region) parts.push(`Body region: ${region}`);
    if (photo.caption) parts.push(`Note: ${photo.caption}`);
    if (photo.aiAnalysis?.description) parts.push(`Visual analysis noted: ${photo.aiAnalysis.description}`);
    if (photo.aiAnalysis?.findings?.length) parts.push(`Observed: ${photo.aiAnalysis.findings.join(', ')}`);
    const context = `I logged a photo of a symptom and would like help understanding it.${parts.length ? ' ' + parts.join('. ') + '.' : ''}`;

    const params = new URLSearchParams();
    params.set('mode', mode);
    params.set('symptoms', context);
    params.set('photoId', photo._id);
    if (photo.dependent) params.set('dependent', photo.dependent);
    navigate(`/session?${params.toString()}`);
  };

  const totalCount = photos.length;
  const isEmpty = !loading && !loadError && totalCount === 0;

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
              <Camera size={16} />
            </div>
            <div>
              <p className="font-heading text-sm font-semibold text-foreground">Photo Log</p>
              <p className="text-[11px] text-muted-foreground">
                {totalCount} photo{totalCount !== 1 ? 's' : ''}
              </p>
            </div>
          </div>
        </div>
        <motion.div whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.96 }}>
          <Button size="sm" onClick={openUpload} className="gap-1.5">
            <Plus size={16} /> Add
          </Button>
        </motion.div>
      </div>

      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.25 }}
        className="mx-auto flex w-full max-w-[640px] flex-1 flex-col gap-4 px-4 py-4"
      >
        {loading && (
          <div className="grid grid-cols-2 gap-3">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="aspect-square rounded-2xl" />
            ))}
          </div>
        )}

        {!loading && loadError && (
          <ErrorState
            title="We couldn't load your photo log"
            message="Your information is safe."
            onRetry={load}
          />
        )}

        {isEmpty && (
          <div className="flex flex-col items-center justify-center gap-3 px-4 py-16 text-center">
            <motion.p
              animate={{ y: [0, -6, 0] }}
              transition={{ duration: 2.5, repeat: Infinity, ease: 'easeInOut' }}
              className="text-4xl"
            >
              📷
            </motion.p>
            <p className="text-base font-semibold text-foreground">No photos logged yet</p>
            <p className="max-w-[300px] text-sm leading-relaxed text-muted-foreground">
              Log a photo of a symptom — like a rash, wound, or swelling — to track how it changes over time.
            </p>
            <Button onClick={openUpload} className="mt-2 gap-1.5">
              <Plus size={16} /> Log a photo
            </Button>
          </div>
        )}

        {!loading && !loadError && !isEmpty && (
          <div className="flex gap-1.5">
            <button
              onClick={() => setView('all')}
              className={cn(
                'flex items-center gap-1.5 rounded-full border px-3.5 py-1.5 text-xs font-medium transition-colors',
                view === 'all'
                  ? 'border-primary bg-primary text-primary-foreground'
                  : 'border-border bg-background text-foreground hover:bg-accent'
              )}
            >
              <LayoutGrid size={13} /> All photos
            </button>
            <button
              onClick={() => setView('progress')}
              className={cn(
                'flex items-center gap-1.5 rounded-full border px-3.5 py-1.5 text-xs font-medium transition-colors',
                view === 'progress'
                  ? 'border-primary bg-primary text-primary-foreground'
                  : 'border-border bg-background text-foreground hover:bg-accent'
              )}
            >
              <LineChart size={13} /> Symptom Progress
            </button>
          </div>
        )}

        {!loading && !loadError && !isEmpty && view === 'all' && (
          <AnimatePresence mode="popLayout">
            <motion.div layout className="grid grid-cols-2 gap-3">
              {photos.map((p, i) => {
                const label = subjectLabel(p);
                return (
                  <motion.div
                    key={p._id}
                    layout
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.97 }}
                    whileHover={{ y: -3 }}
                    whileTap={{ scale: 0.97 }}
                    transition={{ duration: 0.25, delay: i * 0.03, ease: [0.16, 1, 0.3, 1] }}
                  >
                    <PhotoThumbnail photo={p} onClick={() => setDetailPhoto(p)} />
                    <div className="mt-1.5 px-0.5">
                      <p className="truncate text-xs font-medium text-foreground">
                        {p.caption || bodyRegionLabel(p.bodyRegion) || 'Photo'}
                      </p>
                      <p className="truncate text-[10px] text-muted-foreground">
                        {formatDate(p.createdAt)}
                        {label && ` · ${label}`}
                      </p>
                    </div>
                  </motion.div>
                );
              })}
            </motion.div>
          </AnimatePresence>
        )}

        {!loading && !loadError && !isEmpty && view === 'progress' && (
          progressGroups.length === 0 ? (
            <div className="flex flex-col items-center justify-center gap-2 px-4 py-14 text-center">
              <LineChart size={26} className="text-muted-foreground/50" />
              <p className="text-sm font-semibold text-foreground">Not enough photos to show progress yet</p>
              <p className="max-w-[280px] text-xs leading-relaxed text-muted-foreground">
                Log 2 or more photos of the same body region to see them lined up over time.
              </p>
            </div>
          ) : (
            <div className="flex flex-col gap-4">
              {progressGroups.map((group) => (
                <Card key={group.key} className="rounded-2xl py-4 shadow-sm">
                  <CardContent className="px-4">
                    <div className="mb-3 flex items-center justify-between gap-2">
                      <div>
                        <p className="text-sm font-bold text-foreground">{bodyRegionLabel(group.bodyRegion)}</p>
                        <p className="text-[11px] text-muted-foreground">
                          {group.subjectLabel} · {group.items.length} photos
                        </p>
                      </div>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setCompareGroup(group)}
                        className="shrink-0 gap-1.5"
                      >
                        <ArrowLeftRight size={13} /> Compare
                      </Button>
                    </div>
                    <div className="flex gap-3 overflow-x-auto pb-1">
                      {group.items.map((p) => (
                        <div key={p._id} className="flex w-20 shrink-0 flex-col items-center gap-1">
                          <div className="aspect-square w-20 overflow-hidden rounded-xl border border-border/70">
                            <PhotoThumbnail photo={p} onClick={() => setDetailPhoto(p)} />
                          </div>
                          <span className="text-[10px] text-muted-foreground">
                            {new Date(p.createdAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}
                          </span>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )
        )}
      </motion.div>

      {/* Upload dialog */}
      <Dialog open={uploadOpen} onOpenChange={closeUpload}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Log a photo</DialogTitle>
          </DialogHeader>
          <div className="flex flex-col gap-4">
            <div className="flex flex-col gap-2">
              {/* Two inputs: `capture` forces the camera, so the gallery/files
                  picker needs its own input without it. */}
              <input
                ref={cameraInputRef}
                type="file"
                accept="image/jpeg,image/png,image/webp"
                capture="environment"
                onChange={onFileChange}
                className="hidden"
              />
              <input
                ref={galleryInputRef}
                type="file"
                accept="image/jpeg,image/png,image/webp"
                onChange={onFileChange}
                className="hidden"
              />
              <div className="flex flex-wrap items-center gap-2.5">
                <motion.div whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.95 }}>
                  <Button type="button" size="sm" variant="secondary" onClick={() => cameraInputRef.current?.click()} className="gap-1.5">
                    <Camera size={14} /> Take photo
                  </Button>
                </motion.div>
                <motion.div whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.95 }}>
                  <Button type="button" size="sm" variant="secondary" onClick={() => galleryInputRef.current?.click()} className="gap-1.5">
                    <Upload size={14} /> Choose from gallery
                  </Button>
                </motion.div>
                <span className="w-full truncate text-xs text-muted-foreground">
                  {file ? file.name : 'No file chosen'}
                </span>
              </div>
              <AnimatePresence>
                {previewUrl && (
                  <motion.img
                    key={previewUrl}
                    initial={{ opacity: 0, scale: 0.97 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.25 }}
                    src={previewUrl}
                    alt="Selected preview"
                    className="max-h-[200px] w-full rounded-xl object-contain"
                  />
                )}
              </AnimatePresence>
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-medium text-foreground">For</label>
              <Select value={dependentChoice} onValueChange={setDependentChoice}>
                <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value={SELF_VALUE}>Myself</SelectItem>
                  <SelectItem value={OTHER_MALE_VALUE}>Another (Male)</SelectItem>
                  <SelectItem value={OTHER_FEMALE_VALUE}>Another (Female)</SelectItem>
                  {dependents.map((d) => (
                    <SelectItem key={d._id} value={d._id}>{d.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-medium text-foreground">Body region (optional)</label>
              <Select value={bodyRegionSelect} onValueChange={setBodyRegionSelect}>
                <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value={NONE_REGION_VALUE}>Not specified</SelectItem>
                  {BODY_REGIONS.map((r) => (
                    <SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>
                  ))}
                  <SelectItem value={CUSTOM_REGION_VALUE}>Other...</SelectItem>
                </SelectContent>
              </Select>
              <AnimatePresence>
                {bodyRegionSelect === CUSTOM_REGION_VALUE && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    exit={{ opacity: 0, height: 0 }}
                    transition={{ duration: 0.2 }}
                  >
                    <Input
                      autoFocus
                      value={customBodyRegion}
                      onChange={(e) => setCustomBodyRegion(e.target.value)}
                      placeholder="e.g. Left earlobe"
                      maxLength={60}
                    />
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-medium text-foreground">Caption (optional)</label>
              <Textarea
                value={caption}
                onChange={(e) => setCaption(e.target.value)}
                placeholder="e.g. Rash appeared this morning"
                maxLength={300}
              />
            </div>

            <p className="rounded-lg bg-muted px-3 py-2 text-[11px] leading-relaxed text-muted-foreground">
              This analysis is descriptive only and not a medical diagnosis.
            </p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => closeUpload(false)}>Cancel</Button>
            <Button onClick={onSubmit} disabled={saving || !file}>
              {saving ? 'Uploading...' : 'Log photo'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Detail dialog */}
      <Dialog open={!!detailPhoto} onOpenChange={(open) => !open && setDetailPhoto(null)}>
        <DialogContent className="max-h-[85vh] overflow-y-auto">
          {detailPhoto && (
            <>
              <DialogHeader>
                <DialogTitle>{detailPhoto.caption || bodyRegionLabel(detailPhoto.bodyRegion) || 'Photo'}</DialogTitle>
              </DialogHeader>
              <div className="flex flex-col gap-3.5">
                <PhotoFullImage photoId={detailPhoto._id} />

                <div className="flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
                  <span>{formatDate(detailPhoto.createdAt)}</span>
                  {detailPhoto.bodyRegion && (
                    <>
                      <span>·</span>
                      <span>{bodyRegionLabel(detailPhoto.bodyRegion)}</span>
                    </>
                  )}
                  {subjectLabel(detailPhoto) && (
                    <>
                      <span>·</span>
                      <span>{subjectLabel(detailPhoto)}</span>
                    </>
                  )}
                </div>

                <div className="rounded-xl border border-border/70 bg-muted/50 p-3.5">
                  <div className="mb-2 flex items-center justify-between gap-2">
                    <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                      AI Visual Analysis
                    </p>
                    {detailPhoto.aiAnalysis?.flaggedForReview && (
                      <Badge className="gap-1 animate-pulse bg-severity-moderate-bg text-severity-moderate-fg">
                        <AlertTriangle size={11} /> Flagged for review
                      </Badge>
                    )}
                  </div>
                  {detailPhoto.aiAnalysis?.description ? (
                    <div className="flex flex-col gap-2">
                      <p className="text-sm text-foreground">{detailPhoto.aiAnalysis.description}</p>
                      {detailPhoto.aiAnalysis.findings?.length > 0 && (
                        <ul className="list-disc space-y-1 pl-4 text-xs text-muted-foreground">
                          {detailPhoto.aiAnalysis.findings.map((f, i) => <li key={i}>{f}</li>)}
                        </ul>
                      )}
                      {detailPhoto.aiAnalysis.confidence && (
                        <p className="text-[11px] text-muted-foreground">
                          {confidenceLabel[detailPhoto.aiAnalysis.confidence]}
                        </p>
                      )}
                      <p className="text-[11px] italic text-muted-foreground">
                        This analysis is descriptive only and not a medical diagnosis.
                      </p>
                    </div>
                  ) : (
                    <p className="text-sm text-muted-foreground">Analysis unavailable for this photo.</p>
                  )}
                </div>

                <motion.div
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.3, delay: 0.1 }}
                  className="rounded-xl border border-primary/25 bg-primary/5 p-3.5"
                >
                  <p className="mb-2.5 text-xs font-semibold uppercase tracking-wide text-primary">
                    Get a full assessment
                  </p>
                  <p className="mb-3 text-xs leading-relaxed text-muted-foreground">
                    Answer a few questions about this and get an AI-assisted assessment, recorded as a session.
                  </p>
                  <div className="flex gap-2">
                    <motion.div className="flex-1" whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.97 }}>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => startAssessment(detailPhoto, 'quick')}
                        className="w-full gap-1.5"
                      >
                        <Zap size={14} /> Quick Check
                      </Button>
                    </motion.div>
                    <motion.div className="flex-1" whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.97 }}>
                      <Button
                        size="sm"
                        onClick={() => startAssessment(detailPhoto, 'full')}
                        className="w-full gap-1.5"
                      >
                        <ClipboardList size={14} /> Full Assessment
                      </Button>
                    </motion.div>
                  </div>
                  {detailPhoto.linkedSessionId && (
                    <button
                      onClick={() => navigate(`/history/${detailPhoto.linkedSessionId}`)}
                      className="mt-2.5 flex items-center gap-1 text-xs font-medium text-primary hover:underline"
                    >
                      View linked check-in <ArrowRight size={12} />
                    </button>
                  )}
                </motion.div>
              </div>
              <DialogFooter>
                <Button
                  variant="outline"
                  onClick={() => setDeleting(detailPhoto)}
                  className="gap-1.5 text-destructive hover:bg-destructive/10 hover:text-destructive"
                >
                  <Trash2 size={15} /> Remove
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* Compare dialog — oldest vs newest photo in a progress group. No AI
          judgment is made about what changed; this just lines the two images
          up so the person can look for themselves. */}
      <Dialog open={!!compareGroup} onOpenChange={(open) => !open && setCompareGroup(null)}>
        <DialogContent className="max-h-[85vh] overflow-y-auto">
          {compareGroup && (
            <>
              <DialogHeader>
                <DialogTitle>Visual comparison — {bodyRegionLabel(compareGroup.bodyRegion)}</DialogTitle>
              </DialogHeader>
              <div className="grid grid-cols-2 gap-3">
                {[compareGroup.items[0], compareGroup.items[compareGroup.items.length - 1]].map((p, i) => (
                  <div key={p._id} className="flex flex-col gap-1.5">
                    <PhotoFullImage photoId={p._id} />
                    <p className="text-center text-xs font-medium text-foreground">
                      {i === 0 ? 'Earliest' : 'Most recent'}
                    </p>
                    <p className="text-center text-[11px] text-muted-foreground">{formatDate(p.createdAt)}</p>
                  </div>
                ))}
              </div>
              <p className="rounded-lg bg-muted px-3 py-2 text-[11px] leading-relaxed text-muted-foreground">
                A side-by-side comparison only — MediSense AI does not judge what changed between these photos.
              </p>
            </>
          )}
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deleting} onOpenChange={(open) => !open && setDeleting(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove this photo?</AlertDialogTitle>
            <AlertDialogDescription>
              This permanently removes the photo and its analysis. This cannot be undone.
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
