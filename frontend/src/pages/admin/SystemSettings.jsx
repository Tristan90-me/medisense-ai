import { useState, useEffect, useCallback } from 'react';
import { SlidersHorizontal, PlayCircle, Save, Plus, X, AlertTriangle } from 'lucide-react';
import { motion } from 'framer-motion';
import toast from 'react-hot-toast';
import adminApi from '../../api/adminApi';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';

// Deliberately a different route/page than /admin/settings (which manages
// admin invites) — this page controls app-wide AI behavior instead.
export default function SystemSettings() {
  const [loading, setLoading] = useState(true);

  // AI System Prompt section
  const [prompt, setPrompt] = useState('');
  const [savedPromptExists, setSavedPromptExists] = useState(false);
  const [testing, setTesting] = useState(false);
  const [previewText, setPreviewText] = useState('');
  const [hasTestedThisEdit, setHasTestedThisEdit] = useState(false);
  const [savingPrompt, setSavingPrompt] = useState(false);
  const [confirmSavePrompt, setConfirmSavePrompt] = useState(false);

  // Emergency Keywords section
  const [keywords, setKeywords] = useState([]);
  const [newKeyword, setNewKeyword] = useState('');
  const [savingKeywords, setSavingKeywords] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await adminApi.get('/admin/settings');
      const settings = res.data.settings || [];
      const promptSetting = settings.find((s) => s.key === 'systemPrompt');
      const keywordsSetting = settings.find((s) => s.key === 'emergencyKeywords');
      if (promptSetting?.value) {
        setPrompt(promptSetting.value);
        setSavedPromptExists(true);
      }
      setKeywords(keywordsSetting?.value || []);
    } catch {
      toast.error('Failed to load system settings');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  // Any edit to the prompt invalidates the "tested this edit" gate — an
  // admin can't save a prompt that was tested in a different form.
  const handlePromptChange = (e) => {
    setPrompt(e.target.value);
    setHasTestedThisEdit(false);
  };

  const handleTest = async () => {
    if (!prompt.trim()) return toast.error('Enter a prompt to test first');
    setTesting(true);
    setPreviewText('');
    try {
      const res = await adminApi.post('/admin/settings/preview-prompt', { prompt });
      setPreviewText(res.data.preview);
      setHasTestedThisEdit(true);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to preview prompt');
    } finally {
      setTesting(false);
    }
  };

  const confirmAndSavePrompt = async () => {
    setSavingPrompt(true);
    try {
      await adminApi.put('/admin/settings/systemPrompt', { value: prompt });
      toast.success('System prompt saved');
      setSavedPromptExists(true);
    } catch {
      toast.error('Failed to save system prompt');
    } finally {
      setSavingPrompt(false);
      setConfirmSavePrompt(false);
    }
  };

  const addKeyword = () => {
    const trimmed = newKeyword.trim();
    if (!trimmed) return;
    if (keywords.includes(trimmed)) {
      setNewKeyword('');
      return;
    }
    setKeywords((prev) => [...prev, trimmed]);
    setNewKeyword('');
  };

  const removeKeyword = (kw) => {
    setKeywords((prev) => prev.filter((k) => k !== kw));
  };

  const saveKeywords = async () => {
    setSavingKeywords(true);
    try {
      await adminApi.put('/admin/settings/emergencyKeywords', { value: keywords });
      toast.success('Emergency keywords saved');
    } catch {
      toast.error('Failed to save emergency keywords');
    } finally {
      setSavingKeywords(false);
    }
  };

  return (
    <div className="mx-auto flex max-w-[960px] flex-col gap-6 px-4 py-6">
      <div>
        <h1 className="font-heading text-xl font-bold text-foreground">System Settings</h1>
        <p className="text-sm text-muted-foreground">App-wide AI behavior — system prompt and emergency-detection keywords</p>
      </div>

      {loading ? (
        <>
          <Skeleton className="h-[280px] rounded-[14px]" />
          <Skeleton className="h-[160px] rounded-[14px]" />
        </>
      ) : (
        <>
          {/* AI System Prompt */}
          <Card className="rounded-[14px] border-border/70 shadow-none">
            <CardContent className="flex flex-col gap-4 p-5">
              <div className="flex items-center gap-2">
                <div className="flex h-8 w-8 items-center justify-center rounded-[10px] bg-primary/10 text-primary">
                  <SlidersHorizontal size={16} />
                </div>
                <div>
                  <p className="text-sm font-bold text-foreground">AI System Prompt</p>
                  {!savedPromptExists && (
                    <p className="text-[11px] text-muted-foreground">No custom prompt saved — the built-in default is currently in use.</p>
                  )}
                </div>
              </div>

              <Textarea
                rows={10}
                placeholder="Leave blank to keep using the built-in default MediSense AI system prompt..."
                value={prompt}
                onChange={handlePromptChange}
                className="font-mono text-xs"
              />

              <div className="flex flex-wrap items-center gap-2.5">
                <Button
                  type="button"
                  variant="outline"
                  className="rounded-full"
                  onClick={handleTest}
                  disabled={testing || !prompt.trim()}
                >
                  <PlayCircle size={15} />
                  {testing ? 'Testing...' : 'Test this prompt'}
                </Button>
                <Button
                  type="button"
                  className="rounded-full"
                  onClick={() => setConfirmSavePrompt(true)}
                  disabled={!hasTestedThisEdit || savingPrompt}
                  title={!hasTestedThisEdit ? 'Test the prompt at least once before saving' : undefined}
                >
                  <Save size={15} /> Save
                </Button>
                {!hasTestedThisEdit && (
                  <span className="text-[11px] text-muted-foreground">Test this prompt before saving is enabled.</span>
                )}
              </div>

              {previewText && (
                <div className="rounded-[10px] border border-border/70 bg-muted/30 p-3.5">
                  <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                    Preview response — "I have a mild headache, what should I do?"
                  </p>
                  <p className="whitespace-pre-wrap text-[13px] leading-relaxed text-foreground">{previewText}</p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Emergency Keywords */}
          <Card className="rounded-[14px] border-border/70 shadow-none">
            <CardContent className="flex flex-col gap-4 p-5">
              <div className="flex items-center gap-2">
                <div className="flex h-8 w-8 items-center justify-center rounded-[10px] bg-severity-high-bg text-severity-high-fg">
                  <AlertTriangle size={16} />
                </div>
                <div>
                  <p className="text-sm font-bold text-foreground">Emergency Keywords</p>
                  <p className="text-[11px] text-muted-foreground">Custom phrases that trigger the Critical rule-based safety net alongside the built-in rules.</p>
                </div>
              </div>

              <div className="flex flex-wrap gap-2">
                {keywords.length === 0 ? (
                  <p className="text-xs text-muted-foreground">No custom keywords yet.</p>
                ) : (
                  keywords.map((kw) => (
                    <motion.div
                      key={kw}
                      initial={{ opacity: 0, scale: 0.9 }}
                      animate={{ opacity: 1, scale: 1 }}
                    >
                      <Badge className="gap-1 bg-primary/10 text-primary">
                        {kw}
                        <button
                          type="button"
                          onClick={() => removeKeyword(kw)}
                          className="ml-0.5 rounded-full hover:text-destructive"
                          aria-label={`Remove ${kw}`}
                        >
                          <X size={12} />
                        </button>
                      </Badge>
                    </motion.div>
                  ))
                )}
              </div>

              <div className="flex items-end gap-2.5">
                <div className="flex-1 space-y-2">
                  <Label htmlFor="new-keyword">Add a keyword phrase</Label>
                  <Input
                    id="new-keyword"
                    placeholder="e.g. funny taste in mouth"
                    value={newKeyword}
                    onChange={(e) => setNewKeyword(e.target.value)}
                    onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addKeyword(); } }}
                  />
                </div>
                <Button type="button" variant="outline" className="rounded-full" onClick={addKeyword}>
                  <Plus size={15} /> Add
                </Button>
              </div>

              <div>
                <Button type="button" className="rounded-full" onClick={saveKeywords} disabled={savingKeywords}>
                  <Save size={15} /> {savingKeywords ? 'Saving...' : 'Save'}
                </Button>
              </div>
            </CardContent>
          </Card>
        </>
      )}

      {/* Save-prompt confirmation — gated behind at least one successful test */}
      <AlertDialog open={confirmSavePrompt} onOpenChange={(open) => !open && setConfirmSavePrompt(false)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Save this system prompt?</AlertDialogTitle>
            <AlertDialogDescription>
              This directly controls the AI's emergency-detection wording and behavior for every user, effective
              immediately. Make sure the test preview above looks correct before continuing.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={confirmAndSavePrompt} disabled={savingPrompt}>
              {savingPrompt ? 'Saving...' : 'Save prompt'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
