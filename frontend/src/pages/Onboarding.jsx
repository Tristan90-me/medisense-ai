import { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { AnimatePresence, motion } from 'framer-motion';
import { Activity, ChevronRight, ChevronLeft } from 'lucide-react';
import api from '../api/axios';
import toast from 'react-hot-toast';
import { cn } from '@/lib/utils';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Form, FormField, FormItem, FormLabel, FormControl, FormMessage,
} from '@/components/ui/form';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';

const steps = ['Basic info', 'Body metrics', 'Medical history', 'Lifestyle'];

// Light-touch validation: this is a health profile where most fields are
// optional, so we only guard against obviously malformed input rather than
// blocking users from moving forward or submitting.
const numericString = z
  .string()
  .optional()
  .refine((v) => !v || !Number.isNaN(Number(v)), { message: 'Must be a number' });

const onboardingSchema = z.object({
  dateOfBirth: z.string().optional(),
  sex: z.string().optional(),
  weight: numericString,
  weightUnit: z.enum(['kg', 'lbs']),
  height: numericString,
  heightUnit: z.enum(['cm', 'ft']),
  bloodType: z.string(),
  preExistingConditions: z.string().optional(),
  allergies: z.string().optional(),
  currentMedications: z.string().optional(),
  familyHistory: z.string().optional(),
  smokingStatus: z.enum(['never', 'former', 'current']),
  alcoholUse: z.enum(['none', 'occasional', 'moderate', 'heavy']),
});

// Fields validated before advancing past each step.
const stepFields = [
  ['dateOfBirth', 'sex', 'bloodType'],
  ['weight', 'weightUnit', 'height', 'heightUnit'],
  ['preExistingConditions', 'allergies', 'currentMedications', 'familyHistory'],
  ['smokingStatus', 'alcoholUse'],
];

const medicalHistoryFields = [
  ['preExistingConditions', 'Pre-existing conditions', 'e.g. Diabetes, Asthma'],
  ['allergies', 'Allergies', 'e.g. Penicillin, Peanuts'],
  ['currentMedications', 'Current medications', 'e.g. Metformin, Lisinopril'],
  ['familyHistory', 'Family history', 'e.g. Heart disease, Cancer'],
];

const stepVariants = {
  enter: (direction) => ({ opacity: 0, x: direction > 0 ? 24 : -24 }),
  center: { opacity: 1, x: 0 },
  exit: (direction) => ({ opacity: 0, x: direction > 0 ? -24 : 24 }),
};

export default function Onboarding() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const dependentId = searchParams.get('dependent');
  const [step, setStep] = useState(0);
  const [direction, setDirection] = useState(1);
  const [loading, setLoading] = useState(false);

  const form = useForm({
    resolver: zodResolver(onboardingSchema),
    defaultValues: {
      dateOfBirth: '', sex: '', weight: '', weightUnit: 'kg',
      height: '', heightUnit: 'cm', bloodType: 'unknown',
      preExistingConditions: '', allergies: '', currentMedications: '',
      familyHistory: '', smokingStatus: 'never', alcoholUse: 'none',
    },
  });

  const goNext = async () => {
    const valid = await form.trigger(stepFields[step]);
    if (!valid) return;
    setDirection(1);
    setStep((s) => s + 1);
  };

  const goBack = () => {
    setDirection(-1);
    setStep((s) => s - 1);
  };

  const onSubmit = async (values) => {
    setLoading(true);
    try {
      const payload = {
        ...values,
        dependent: dependentId || undefined,
        preExistingConditions: values.preExistingConditions.split(',').map((s) => s.trim()).filter(Boolean),
        allergies: values.allergies.split(',').map((s) => s.trim()).filter(Boolean),
        currentMedications: values.currentMedications.split(',').map((s) => s.trim()).filter(Boolean),
        familyHistory: values.familyHistory.split(',').map((s) => s.trim()).filter(Boolean),
      };
      await api.put('/profile', payload);
      toast.success('Profile saved!');
      navigate(dependentId ? '/dependents' : '/dashboard');
    } catch {
      toast.error('Failed to save profile');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-start justify-center bg-gradient-to-br from-primary/5 via-background to-severity-low-bg px-4 py-12">
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
        className="w-full max-w-[520px]"
      >
        <Card className="rounded-2xl border-border/70 shadow-lg">
          <CardContent className="p-8">
            <div className="mb-6 flex items-center gap-2">
              <div className="flex h-9 w-9 items-center justify-center rounded-[10px] bg-primary text-primary-foreground">
                <Activity size={20} />
              </div>
              <span className="font-heading text-lg font-bold text-foreground">
                {dependentId ? 'Health Profile' : 'MediSense AI'}
              </span>
            </div>

            {/* Step progress */}
            <div className="mb-6 flex gap-1.5">
              {steps.map((s, i) => (
                <div key={s} className="flex-1">
                  <div className={cn('h-1 rounded-full transition-colors duration-300', i <= step ? 'bg-primary' : 'bg-muted')} />
                  <p className={cn('mt-1 text-[10px] transition-colors duration-300', i === step ? 'font-medium text-primary' : 'text-muted-foreground')}>
                    {s}
                  </p>
                </div>
              ))}
            </div>

            <Form {...form}>
              <AnimatePresence mode="wait" custom={direction}>
                <motion.div
                  key={step}
                  custom={direction}
                  variants={stepVariants}
                  initial="enter"
                  animate="center"
                  exit="exit"
                  transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
                >
                  {step === 0 && (
                    <>
                      <h2 className="mb-1 font-heading text-xl font-bold text-foreground">Basic information</h2>
                      <p className="mb-6 text-sm leading-relaxed text-muted-foreground">This helps us personalize your health insights</p>
                      <div className="space-y-4">
                        <FormField
                          control={form.control}
                          name="dateOfBirth"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Date of birth</FormLabel>
                              <FormControl>
                                <Input type="date" {...field} />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                        <FormField
                          control={form.control}
                          name="sex"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Biological sex</FormLabel>
                              <Select onValueChange={field.onChange} value={field.value}>
                                <FormControl>
                                  <SelectTrigger className="w-full">
                                    <SelectValue placeholder="Select" />
                                  </SelectTrigger>
                                </FormControl>
                                <SelectContent>
                                  <SelectItem value="male">Male</SelectItem>
                                  <SelectItem value="female">Female</SelectItem>
                                  <SelectItem value="other">Other</SelectItem>
                                  <SelectItem value="prefer_not_to_say">Prefer not to say</SelectItem>
                                </SelectContent>
                              </Select>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                        <FormField
                          control={form.control}
                          name="bloodType"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Blood type</FormLabel>
                              <Select onValueChange={field.onChange} value={field.value}>
                                <FormControl>
                                  <SelectTrigger className="w-full">
                                    <SelectValue />
                                  </SelectTrigger>
                                </FormControl>
                                <SelectContent>
                                  {['unknown', 'A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'].map((b) => (
                                    <SelectItem key={b} value={b}>{b}</SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                      </div>
                    </>
                  )}

                  {step === 1 && (
                    <>
                      <h2 className="mb-1 font-heading text-xl font-bold text-foreground">Body metrics</h2>
                      <p className="mb-6 text-sm leading-relaxed text-muted-foreground">Used for risk stratification and health scoring</p>
                      <div className="space-y-4">
                        <div className="flex items-start gap-2">
                          <FormField
                            control={form.control}
                            name="weight"
                            render={({ field }) => (
                              <FormItem className="flex-1">
                                <FormLabel>Weight</FormLabel>
                                <FormControl>
                                  <Input type="number" placeholder="70" {...field} />
                                </FormControl>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                          <FormField
                            control={form.control}
                            name="weightUnit"
                            render={({ field }) => (
                              <FormItem className="w-20 shrink-0">
                                <FormLabel className="invisible">Unit</FormLabel>
                                <Select onValueChange={field.onChange} value={field.value}>
                                  <FormControl>
                                    <SelectTrigger className="w-full">
                                      <SelectValue />
                                    </SelectTrigger>
                                  </FormControl>
                                  <SelectContent>
                                    <SelectItem value="kg">kg</SelectItem>
                                    <SelectItem value="lbs">lbs</SelectItem>
                                  </SelectContent>
                                </Select>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                        </div>
                        <div className="flex items-start gap-2">
                          <FormField
                            control={form.control}
                            name="height"
                            render={({ field }) => (
                              <FormItem className="flex-1">
                                <FormLabel>Height</FormLabel>
                                <FormControl>
                                  <Input type="number" placeholder="175" {...field} />
                                </FormControl>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                          <FormField
                            control={form.control}
                            name="heightUnit"
                            render={({ field }) => (
                              <FormItem className="w-20 shrink-0">
                                <FormLabel className="invisible">Unit</FormLabel>
                                <Select onValueChange={field.onChange} value={field.value}>
                                  <FormControl>
                                    <SelectTrigger className="w-full">
                                      <SelectValue />
                                    </SelectTrigger>
                                  </FormControl>
                                  <SelectContent>
                                    <SelectItem value="cm">cm</SelectItem>
                                    <SelectItem value="ft">ft</SelectItem>
                                  </SelectContent>
                                </Select>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                        </div>
                      </div>
                    </>
                  )}

                  {step === 2 && (
                    <>
                      <h2 className="mb-1 font-heading text-xl font-bold text-foreground">Medical history</h2>
                      <p className="mb-6 text-sm leading-relaxed text-muted-foreground">Separate multiple entries with commas</p>
                      <div className="space-y-4">
                        {medicalHistoryFields.map(([name, label, placeholder]) => (
                          <FormField
                            key={name}
                            control={form.control}
                            name={name}
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel>{label}</FormLabel>
                                <FormControl>
                                  <Input placeholder={placeholder} {...field} />
                                </FormControl>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                        ))}
                      </div>
                    </>
                  )}

                  {step === 3 && (
                    <>
                      <h2 className="mb-1 font-heading text-xl font-bold text-foreground">Lifestyle</h2>
                      <p className="mb-6 text-sm leading-relaxed text-muted-foreground">Lifestyle factors that affect your health risk</p>
                      <div className="space-y-4">
                        <FormField
                          control={form.control}
                          name="smokingStatus"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Smoking status</FormLabel>
                              <Select onValueChange={field.onChange} value={field.value}>
                                <FormControl>
                                  <SelectTrigger className="w-full">
                                    <SelectValue />
                                  </SelectTrigger>
                                </FormControl>
                                <SelectContent>
                                  <SelectItem value="never">Never smoked</SelectItem>
                                  <SelectItem value="former">Former smoker</SelectItem>
                                  <SelectItem value="current">Current smoker</SelectItem>
                                </SelectContent>
                              </Select>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                        <FormField
                          control={form.control}
                          name="alcoholUse"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Alcohol use</FormLabel>
                              <Select onValueChange={field.onChange} value={field.value}>
                                <FormControl>
                                  <SelectTrigger className="w-full">
                                    <SelectValue />
                                  </SelectTrigger>
                                </FormControl>
                                <SelectContent>
                                  <SelectItem value="none">None</SelectItem>
                                  <SelectItem value="occasional">Occasional</SelectItem>
                                  <SelectItem value="moderate">Moderate</SelectItem>
                                  <SelectItem value="heavy">Heavy</SelectItem>
                                </SelectContent>
                              </Select>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                      </div>
                    </>
                  )}
                </motion.div>
              </AnimatePresence>
            </Form>

            <div className="mt-6 flex gap-3">
              {step > 0 && (
                <Button type="button" variant="outline" className="flex-1 rounded-full" onClick={goBack}>
                  <ChevronLeft size={16} className="mr-1" /> Back
                </Button>
              )}
              {step < steps.length - 1 ? (
                <Button type="button" className="flex-1 rounded-full" onClick={goNext}>
                  Next <ChevronRight size={16} className="ml-1" />
                </Button>
              ) : (
                <Button type="button" className="flex-1 rounded-full" disabled={loading} onClick={form.handleSubmit(onSubmit)}>
                  {loading ? 'Saving...' : 'Finish setup'}
                </Button>
              )}
            </div>

            <p
              className="mt-4 cursor-pointer text-center text-xs text-muted-foreground transition-colors hover:text-foreground"
              onClick={() => navigate('/dashboard')}
            >
              Skip for now
            </p>
          </CardContent>
        </Card>
      </motion.div>
    </div>
  );
}
