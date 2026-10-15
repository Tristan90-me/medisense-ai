import { Link } from 'react-router-dom';
import { Fragment, useEffect, useRef, useState } from 'react';
import {
  Activity, Brain, ShieldCheck, TrendingUp, Zap, Clock, Users, Star,
  ArrowRight, CheckCircle, Lock, HeartPulse, ChevronDown,
  User, ClipboardList, ShieldAlert, Cpu, History,
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const DEMO_CONVERSATION = [
  { role: 'ai', text: "Hi! I'm MediSense. What symptoms are you experiencing?" },
  { role: 'user', text: "I've had a splitting headache for two days and feel nauseous." },
  { role: 'ai', text: 'Is the pain on one side of your head or both sides?' },
  { role: 'user', text: 'Mostly on the right side, and light makes it worse.' },
  { role: 'ai', text: "Those symptoms suggest a possible migraine. I have a few more questions to refine this — how's your sleep been?" },
];

// ─── Scroll reveal helpers (Framer Motion whileInView, not GSAP ScrollTrigger) ──
// IntersectionObserver-based, so there's no cached-pixel-position to go stale
// when web fonts or layout shift the page after mount — unlike the previous
// GSAP ScrollTrigger implementation, which intermittently left whole sections
// stuck at opacity:0 because their trigger positions were computed before the
// page's final layout had settled.
const Reveal = ({ children, className, delay = 0 }) => (
  <motion.div
    initial={{ opacity: 0, y: 28 }}
    whileInView={{ opacity: 1, y: 0 }}
    viewport={{ once: true, amount: 0.3 }}
    transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1], delay }}
    className={className}
  >
    {children}
  </motion.div>
);

const staggerParent = { hidden: {}, show: { transition: { staggerChildren: 0.1 } } };
const staggerItem = { hidden: { opacity: 0, y: 24 }, show: { opacity: 1, y: 0, transition: { duration: 0.5, ease: 'easeOut' } } };

const RevealGroup = ({ children, className }) => (
  <motion.div initial="hidden" whileInView="show" viewport={{ once: true, amount: 0.2 }} variants={staggerParent} className={className}>
    {children}
  </motion.div>
);
const RevealItem = ({ children, className }) => (
  <motion.div variants={staggerItem} className={className}>{children}</motion.div>
);

function ConversationDemo() {
  const [visible, setVisible] = useState(0);
  const [typing, setTyping] = useState(false);
  const messagesRef = useRef(null);

  // Drives the demo purely through React state — each message (and the
  // typing indicator) renders as the actual next item in the list, so it's
  // never a fixed DOM node sitting at the wrong scroll position. The
  // previous GSAP timeline animated a typing-indicator element that lived
  // permanently as the LAST child after all 5 (already-in-the-DOM-but-
  // invisible) bubbles — inside a fixed-height, overflow-hidden container
  // that made it clipped out of view for nearly the whole sequence.
  useEffect(() => {
    let cancelled = false;

    const run = async () => {
      while (!cancelled) {
        for (let i = 0; i < DEMO_CONVERSATION.length; i++) {
          if (cancelled) return;
          const isAi = DEMO_CONVERSATION[i].role === 'ai';
          if (isAi) {
            setTyping(true);
            await wait(900);
            if (cancelled) return;
            setTyping(false);
            await wait(150);
          }
          if (cancelled) return;
          setVisible(i + 1);
          await wait(isAi ? 700 : 1000);
        }
        if (cancelled) return;
        await wait(1500);
        if (cancelled) return;
        setVisible(0);
        setTyping(false);
        await wait(500);
      }
    };

    run();
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    if (messagesRef.current) {
      messagesRef.current.scrollTop = messagesRef.current.scrollHeight;
    }
  }, [visible, typing]);

  return (
    <div className="overflow-hidden rounded-[18px] border border-border bg-card shadow-lg">
      <div className="flex items-center gap-1.5 bg-ink px-4 py-3">
        <span className="h-2.5 w-2.5 rounded-full bg-severity-low" />
        <span className="h-2.5 w-2.5 rounded-full bg-severity-moderate" />
        <span className="h-2.5 w-2.5 rounded-full bg-severity-high" />
        <span className="ml-1 flex-1 text-xs font-medium text-ink-foreground/85">MediSense Assistant</span>
        <span className="text-[11px] text-severity-low">● Live</span>
      </div>
      <div ref={messagesRef} className="relative flex h-[260px] flex-col gap-3 overflow-hidden bg-muted/30 p-5">
        <AnimatePresence initial={false}>
          {DEMO_CONVERSATION.slice(0, visible).map((msg, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
              transition={{ duration: 0.3, ease: 'easeOut' }}
              className={`flex items-end gap-2 ${msg.role === 'user' ? 'flex-row-reverse' : ''}`}
            >
              {msg.role === 'ai' && (
                <div className="flex h-[22px] w-[22px] shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground">
                  <Activity size={10} />
                </div>
              )}
              <div
                className={`max-w-[78%] rounded-2xl px-3.5 py-2.5 text-[12.5px] leading-relaxed ${
                  msg.role === 'ai'
                    ? 'rounded-bl-sm border border-border bg-card text-foreground'
                    : 'rounded-br-sm bg-primary text-primary-foreground'
                }`}
              >
                {msg.text}
              </div>
            </motion.div>
          ))}
          {typing && (
            <motion.div
              key="typing"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="flex items-center gap-2"
            >
              <div className="flex h-[22px] w-[22px] shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground">
                <Activity size={10} />
              </div>
              <div className="flex items-center gap-1 rounded-2xl rounded-bl-sm border border-border bg-card px-3.5 py-3">
                {[0, 1, 2].map((i) => (
                  <span key={i} className="h-1.5 w-1.5 animate-bounce rounded-full bg-muted-foreground" style={{ animationDelay: `${i * 0.15}s` }} />
                ))}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
      <div className="flex items-center gap-2 border-t border-border bg-card px-4 py-3">
        <div className="flex-1 rounded-full bg-muted px-3.5 py-1.5 text-xs text-muted-foreground">Describe your symptoms…</div>
        <div className="flex h-[30px] w-[30px] shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground">
          <ArrowRight size={13} />
        </div>
      </div>
    </div>
  );
}

// Expanded from the original 3 generic steps to 5 — the 3-step version
// folded the app's actual headline differentiator (AI assessment + rule-based
// safety check + ML classifier — see the Architecture section's
// ARCHITECTURE_STEPS below) into one vague "AI asks follow-up questions"
// step, so a reader who never scrolled that far would never learn results
// are cross-checked three independent ways. Step 3 here exists specifically
// to surface that without going all the way to Architecture's full technical
// depth.
const STEPS = [
  {
    step: '1', icon: <Zap size={18} />, title: 'Describe your symptoms',
    desc: "Type or speak — tell MediSense what you're feeling, where, and for how long.",
    preview: { label: 'You type', text: '"A throbbing headache for two days, feels worse in light."' },
  },
  {
    step: '2', icon: <Brain size={18} />, title: 'AI asks follow-up questions',
    desc: 'The assistant probes deeper, factoring in your health profile and history.',
    preview: { label: 'MediSense asks', text: "\"Is the pain on one side? How's your sleep been?\"" },
  },
  {
    step: '3', icon: <ShieldCheck size={18} />, title: 'Checked three independent ways',
    desc: "Your AI assessment is cross-checked by a rule-based safety layer and a local ML classifier — never just one model's word.",
    signals: [
      { label: 'AI', sub: 'Assessment', classes: 'border-primary/20 bg-primary/5 text-primary' },
      { label: 'Rules', sub: 'Safety check', classes: 'border-secondary/20 bg-secondary/5 text-secondary' },
      { label: 'ML', sub: 'Classifier', classes: 'border-severity-low/20 bg-severity-low-bg text-severity-low-fg' },
    ],
  },
  {
    step: '4', icon: <TrendingUp size={18} />, title: 'Get your risk & recommendations',
    desc: 'A ranked list of possible conditions, a severity score, and concrete next steps.',
    preview: { kind: 'bar', label: 'Migraine', value: 72 },
  },
  {
    step: '5', icon: <History size={18} />, title: 'Saved to your health history',
    desc: 'Every assessment is tracked, so patterns and changes show up over time.',
    preview: { kind: 'check', text: '4 assessments tracked — trending steady' },
  },
];

const FEATURES = [
  { icon: <Brain size={22} />, bg: 'bg-primary/10', color: 'text-primary', title: 'Possible explanations', desc: 'Multiple possible conditions ranked by probability, not just one guess.' },
  { icon: <ShieldCheck size={22} />, bg: 'bg-severity-low-bg', color: 'text-severity-low-fg', title: 'Emergency detection', desc: 'Critical symptoms trigger an immediate alert to seek emergency care.' },
  { icon: <Users size={22} />, bg: 'bg-secondary/10', color: 'text-secondary', title: 'Personalized to you', desc: 'Age, sex, weight, conditions, and family history all shape your results.' },
  { icon: <TrendingUp size={22} />, bg: 'bg-severity-moderate-bg', color: 'text-severity-moderate-fg', title: 'Symptom tracking', desc: 'See how your health changes over time with visual timelines and trends.' },
  { icon: <Clock size={22} />, bg: 'bg-severity-high-bg', color: 'text-severity-high-fg', title: '24 / 7 availability', desc: 'No waiting rooms. No appointments. Check symptoms any time, anywhere.' },
  { icon: <Star size={22} />, bg: 'bg-primary/10', color: 'text-primary', title: 'Body map input', desc: 'Click where it hurts on an interactive body diagram for precise reporting.' },
];

const STATS = [
  { val: '22', label: 'Supported health conditions' },
  { val: '<2 min', label: 'Average time to a full assessment' },
  { val: '24/7', label: 'Available every day, every hour' },
  { val: '3', label: 'Independent diagnostic signals' },
];

// The actual engineering pipeline (aiController.js -> utils/triage.js ->
// ml/symptomClassifier.js), not a simplified marketing version of it — this
// section exists specifically to show the three independent signals really
// are independent, not three names for one model's output.
const ARCHITECTURE_STEPS = [
  { icon: <User size={18} />, title: 'You', desc: 'Describe your symptoms in plain language — through chat or the interactive body map.' },
  { icon: <ClipboardList size={18} />, title: 'Symptoms & Health Profile', desc: 'Extracted symptoms are combined with your age, sex, conditions, and history.' },
  { icon: <Brain size={18} />, title: 'AI Health Assessment', desc: 'The assistant asks guided follow-up questions and proposes possible explanations.' },
  { icon: <ShieldAlert size={18} />, title: 'Rule-Based Safety Check', desc: "An independent, keyword-based red-flag check — never derived from the AI's own output." },
  { icon: <Cpu size={18} />, title: 'ML Symptom Classification', desc: 'A locally-run Naive Bayes classifier offers a third, independent signal.' },
  { icon: <TrendingUp size={18} />, title: 'Risk Assessment', desc: 'All three signals combine into a severity score and care-urgency level.' },
  { icon: <CheckCircle size={18} />, title: 'Personalized Recommendations', desc: 'Concrete next steps, tailored to what you actually reported.' },
  { icon: <History size={18} />, title: 'Health History', desc: 'Every session is saved so patterns can be tracked over time.' },
];

// Real stack, not a marketing simplification — same names a technical
// reader (e.g. in a project defense) would expect to see confirmed.
const TECH_STACK = [
  'React', 'Node.js', 'MongoDB', 'Gemini', 'Bernoulli Naive Bayes ML', 'Leaflet', 'Recharts',
];

const TRUST_POINTS = [
  { icon: <ShieldCheck size={22} />, title: 'Never alarmist, never dismissive', desc: 'MediSense is trained to take every symptom seriously without overstating risk — calm, clear guidance either way.' },
  { icon: <HeartPulse size={22} />, title: 'Always says when it\'s unsure', desc: 'You\'ll see confidence language like "this could suggest" rather than false certainty — and a clear nudge to see a doctor when it matters.' },
  { icon: <Lock size={22} />, title: 'Your data stays yours', desc: 'Your health profile and conversations are private to your account — never sold, never used to train on without consent.' },
];

const FAQS = [
  { q: 'Is MediSense a replacement for a doctor?', a: "No. MediSense is a symptom-checking assistant, not a diagnostic authority — it always recommends professional care for anything beyond general guidance, and reminds you it's an AI at every step." },
  { q: 'What happens if I describe an emergency symptom?', a: 'MediSense is built to recognize red-flag symptoms — like chest pain, difficulty breathing, or signs of stroke — and immediately surfaces an emergency alert urging you to seek care right away.' },
  { q: 'Is my health information private?', a: "Yes. Your profile and session history are tied to your account and used only to personalize your own results — they're not shared or sold." },
  { q: 'Do I need to create an account?', a: 'Yes, a free account lets MediSense remember your health profile and session history so follow-up questions and assessments are actually personalized.' },
  { q: 'Is MediSense free to use?', a: 'Yes — creating an account and running symptom checks is free, no credit card required.' },
];

// Renders a step's "right-hand" content — a quoted example bubble, the
// three-signal cross-check badges (step 3), a ranked-probability bar, or the
// finale "tracked over time" chip. Text inside always stays left-aligned;
// the parent TimelineStep positions the whole block via flex justify-*.
function StepPreview({ s }) {
  if (s.signals) {
    return (
      <div className="flex items-center gap-1.5">
        {s.signals.map((sig, idx) => (
          <Fragment key={sig.label}>
            {idx > 0 && <span className="h-px w-2.5 shrink-0 bg-border" aria-hidden="true" />}
            <motion.div
              initial={{ opacity: 0, y: 8, scale: 0.9 }}
              whileInView={{ opacity: 1, y: 0, scale: 1 }}
              viewport={{ once: true }}
              transition={{ duration: 0.35, delay: 0.1 + idx * 0.13 }}
              className={`w-[84px] rounded-[10px] border px-2.5 py-2 text-center ${sig.classes}`}
            >
              <div className="text-[10.5px] font-bold">{sig.label}</div>
              <div className="mt-0.5 text-[9px] text-muted-foreground">{sig.sub}</div>
            </motion.div>
          </Fragment>
        ))}
      </div>
    );
  }

  if (s.preview?.kind === 'bar') {
    return (
      <div className="w-full max-w-[280px] rounded-2xl border border-border bg-card p-3.5 text-left">
        <p className="mb-2 text-[10.5px] font-bold uppercase tracking-wide text-muted-foreground">Ranked explanations</p>
        <div className="mb-1 flex items-center justify-between">
          <span className="text-xs font-semibold text-foreground">{s.preview.label}</span>
          <span className="text-xs font-bold text-primary">{s.preview.value}%</span>
        </div>
        <div className="h-[5px] overflow-hidden rounded-full bg-muted">
          <div
            className="h-full rounded-full bg-gradient-to-r from-primary to-secondary"
            style={{ width: `${s.preview.value}%` }}
          />
        </div>
      </div>
    );
  }

  if (s.preview?.kind === 'check') {
    return (
      <div className="relative w-full max-w-[280px] overflow-hidden rounded-2xl border border-primary/20 bg-primary/5 px-4 py-3">
        <div className="pointer-events-none absolute inset-0 animate-[shimmer-sweep_2.2s_ease-in-out_1.8s_1] bg-[linear-gradient(100deg,transparent_30%,rgba(255,255,255,0.6)_50%,transparent_70%)] bg-[length:200%_100%]" />
        <div className="relative flex items-center gap-2">
          <CheckCircle size={16} className="shrink-0 text-severity-low-fg" />
          <span className="text-[13px] font-medium text-foreground">{s.preview.text}</span>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full max-w-[280px] rounded-2xl border border-border bg-card p-3.5 text-left">
      <p className="mb-1 text-[10.5px] font-bold uppercase tracking-wide text-muted-foreground">{s.preview.label}</p>
      <p className="text-xs italic text-foreground">{s.preview.text}</p>
    </div>
  );
}

// One alternating row of the desktop "How it works" timeline (lg+ only —
// MobileSteps below covers everything under that). Even steps run
// content-left/preview-right, odd steps mirror it, matching the approved
// Concept B mockup.
function TimelineStep({ s, i }) {
  const contentLeft = i % 2 === 0;
  const text = (
    <div className={contentLeft ? 'text-right' : 'text-left'}>
      <div className="mb-1.5 text-[11px] font-semibold uppercase tracking-wide text-primary">Step {s.step}</div>
      <h3 className="mb-1 text-base font-bold text-foreground">{s.title}</h3>
      <p className="text-[13px] leading-relaxed text-muted-foreground">{s.desc}</p>
    </div>
  );
  const preview = (
    <div className={`flex ${contentLeft ? 'justify-start' : 'justify-end'}`}>
      <StepPreview s={s} />
    </div>
  );

  return (
    <div className="grid grid-cols-[1fr_48px_1fr] items-center gap-0 pb-9 last:pb-0">
      <div className={contentLeft ? 'pr-8' : 'flex justify-end pr-8'}>{contentLeft ? text : preview}</div>
      <div className="flex justify-center">
        <motion.div
          initial={{ opacity: 0, scale: 0.5, rotate: -35 }}
          whileInView={{ opacity: 1, scale: 1, rotate: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.45, ease: [0.34, 1.56, 0.64, 1], delay: 0.1 + i * 0.2 }}
          className="relative z-10 flex h-10 w-10 shrink-0 items-center justify-center rounded-full border-2 border-primary/20 bg-primary text-primary-foreground"
        >
          {s.icon}
        </motion.div>
      </div>
      <div className={contentLeft ? 'pl-8' : 'flex justify-start pl-8'}>{contentLeft ? preview : text}</div>
    </div>
  );
}

function FaqItem({ q, a, open, onToggle }) {
  return (
    <div className="border-b border-border">
      <button
        onClick={onToggle}
        className="flex w-full items-center justify-between gap-4 py-5 text-left"
        aria-expanded={open}
      >
        <span className="text-[15px] font-semibold text-foreground">{q}</span>
        <ChevronDown size={18} className={`shrink-0 text-muted-foreground transition-transform duration-200 ${open ? 'rotate-180' : ''}`} />
      </button>
      <motion.div
        initial={false}
        animate={{ height: open ? 'auto' : 0, opacity: open ? 1 : 0 }}
        transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
        className="overflow-hidden"
      >
        <p className="pb-5 pr-8 text-sm leading-relaxed text-muted-foreground">{a}</p>
      </motion.div>
    </div>
  );
}

export default function Landing() {
  const [openFaq, setOpenFaq] = useState(0);

  return (
    <div className="min-h-screen bg-background font-sans">
      {/* Nav */}
      <nav className="sticky top-0 z-[100] border-b border-border bg-background/90 backdrop-blur-md">
        <div className="mx-auto flex h-[68px] max-w-[1280px] items-center justify-between px-6">
          <div className="flex items-center gap-2.5">
            <div className="flex h-[34px] w-[34px] items-center justify-center rounded-[9px] bg-primary text-primary-foreground">
              <Activity size={18} />
            </div>
            <span className="font-heading text-base font-bold text-foreground">MediSense AI</span>
          </div>
          <div className="hidden gap-10 md:flex">
            <a href="#how" className="text-sm text-muted-foreground transition-colors hover:text-primary">How it works</a>
            <a href="#features" className="text-sm text-muted-foreground transition-colors hover:text-primary">Features</a>
            <a href="#faq" className="text-sm text-muted-foreground transition-colors hover:text-primary">FAQ</a>
          </div>
          <div className="flex items-center gap-3">
            <Link to="/login" className="rounded-full border border-border px-5 py-2 text-[13px] font-medium text-foreground transition-colors hover:border-primary hover:text-primary">Sign in</Link>
            <Link
              to="/register"
              className="inline-flex items-center gap-1.5 rounded-full bg-primary px-5 py-2 text-[13px] font-semibold text-primary-foreground transition-colors hover:bg-primary-hover active:scale-[0.98]"
            >
              Get started <ArrowRight size={14} />
            </Link>
          </div>
        </div>
      </nav>

      {/* Hero */}
      <section className="border-b border-border bg-gradient-to-br from-primary/5 via-background to-severity-low-bg px-6 pb-20 pt-24">
        <div className="mx-auto grid max-w-[1280px] items-center gap-16 lg:grid-cols-[1fr_400px]">
          <div>
            <div className="mb-6 inline-flex items-center gap-1.5 rounded-full bg-severity-low-bg px-3.5 py-1.5 text-xs font-semibold text-severity-low-fg">
              <span className="h-1.5 w-1.5 rounded-full bg-severity-low" />
              AI-powered health intelligence
            </div>
            <h1 className="mb-6 text-[clamp(32px,4vw,48px)] font-extrabold leading-[1.18] tracking-tight text-foreground">
              Describe how you feel.<br />
              <span className="text-primary">Understand why.</span>
            </h1>
            <p className="mb-9 max-w-[480px] text-base leading-relaxed text-muted-foreground">
              MediSense asks the right follow-up questions, weighs your health profile,
              and generates a structured, AI-assisted symptom assessment — available anytime.
            </p>
            <div className="mb-8 flex flex-wrap gap-4">
              <Link
                to="/register"
                className="inline-flex items-center gap-2 rounded-full bg-primary px-7 py-3.5 text-[15px] font-semibold text-primary-foreground transition-colors hover:bg-primary-hover"
              >
                Check your symptoms <ArrowRight size={16} />
              </Link>
              <a href="#how" className="rounded-full border border-border px-7 py-3.5 text-[15px] font-medium text-foreground transition-colors hover:border-primary hover:text-primary">Explore MediSense</a>
            </div>
            <div className="flex flex-wrap gap-x-6 gap-y-2.5">
              {['No appointment needed', 'Private & secure', 'Always available'].map((t, i) => (
                <div key={i} className="flex items-center gap-1.5 text-[12.5px] text-muted-foreground">
                  <CheckCircle size={13} className="shrink-0 text-severity-low" />
                  <span>{t}</span>
                </div>
              ))}
            </div>
          </div>
          <div className="hidden justify-center lg:flex">
            <ConversationDemo />
          </div>
        </div>
      </section>

      {/* How it works — a centered alternating timeline on lg+ (desktop
          column has room for the connected-path layout); below that, a
          simpler single-column list (same left-rail pattern the Architecture
          section already uses) since the 3-column alternating grid doesn't
          have the width to work on a phone or small tablet. */}
      <section className="border-b border-t border-border bg-muted/20 px-6 py-24" id="how">
        <div className="mx-auto max-w-[1280px]">
          <Reveal className="mb-14 text-center">
            <p className="mb-3 text-xs font-bold uppercase tracking-wider text-primary">How it works</p>
            <h2 className="mx-auto mb-4 max-w-[620px] text-[clamp(24px,3vw,36px)] font-extrabold tracking-tight text-foreground">
              From symptoms to clarity in minutes
            </h2>
            <p className="mx-auto max-w-[520px] text-[14.5px] leading-relaxed text-muted-foreground">
              Follow the thread from what you describe to a structured, cross-checked report.
            </p>
          </Reveal>

          {/* Desktop: alternating connected path */}
          <div className="relative mx-auto hidden max-w-[1040px] lg:block">
            <motion.div
              initial={{ scaleY: 0 }}
              whileInView={{ scaleY: 1 }}
              viewport={{ once: true, amount: 0.2 }}
              transition={{ duration: 1.3, ease: 'easeOut' }}
              style={{ transformOrigin: 'top' }}
              className="absolute inset-y-1 left-1/2 w-px -translate-x-1/2 bg-border"
              aria-hidden="true"
            />
            {STEPS.map((s, i) => (
              <TimelineStep key={s.step} s={s} i={i} />
            ))}
          </div>

          {/* Mobile / tablet: single-column list */}
          <RevealGroup className="relative flex flex-col gap-8 lg:hidden">
            <div className="absolute bottom-5 left-5 top-5 w-px bg-border" aria-hidden="true" />
            {STEPS.map((s) => (
              <RevealItem key={s.step} className="relative flex items-start gap-5">
                <div className="relative z-10 flex h-10 w-10 shrink-0 items-center justify-center rounded-full border-2 border-primary/20 bg-primary text-primary-foreground">
                  {s.icon}
                </div>
                <div className="flex-1 pt-1">
                  <div className="mb-1.5 text-[11px] font-semibold uppercase tracking-wide text-primary">Step {s.step}</div>
                  <h3 className="mb-1 text-[15px] font-bold text-foreground">{s.title}</h3>
                  <p className="mb-3 text-[13px] leading-relaxed text-muted-foreground">{s.desc}</p>
                  <StepPreview s={s} />
                </div>
              </RevealItem>
            ))}
          </RevealGroup>

          <Reveal className="mt-10 flex flex-col items-center gap-1 text-muted-foreground" delay={0.2}>
            <a href="#architecture" className="text-[11px] font-semibold tracking-wide">See the full engineering pipeline</a>
            <ChevronDown size={16} className="animate-bounce" aria-hidden="true" />
          </Reveal>
        </div>
      </section>

      {/* Features */}
      <section className="px-6 py-24" id="features">
        <div className="mx-auto max-w-[1280px]">
          <Reveal>
            <p className="mb-3 text-xs font-bold uppercase tracking-wider text-primary">Features</p>
            <h2 className="mb-14 max-w-[520px] text-[clamp(24px,3vw,36px)] font-extrabold tracking-tight text-foreground">
              Everything your health needs
            </h2>
          </Reveal>
          <RevealGroup className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {FEATURES.map((f, i) => (
              <RevealItem key={i} className="rounded-2xl border border-border p-7 transition-all hover:-translate-y-0.5 hover:shadow-md">
                <div className={`mb-5 flex h-11 w-11 items-center justify-center rounded-xl ${f.bg} ${f.color}`}>{f.icon}</div>
                <h3 className="mb-2 text-[15px] font-bold text-foreground">{f.title}</h3>
                <p className="text-[13px] leading-relaxed text-muted-foreground">{f.desc}</p>
              </RevealItem>
            ))}
          </RevealGroup>
        </div>
      </section>

      {/* Trust / Responsible AI */}
      <section className="border-y border-border bg-muted/20 px-6 py-24">
        <div className="mx-auto max-w-[1280px]">
          <Reveal>
            <p className="mb-3 text-xs font-bold uppercase tracking-wider text-primary">Built responsibly</p>
            <h2 className="mb-14 max-w-[560px] text-[clamp(24px,3vw,36px)] font-extrabold tracking-tight text-foreground">
              Health AI you can actually trust
            </h2>
          </Reveal>
          <RevealGroup className="grid gap-8 md:grid-cols-3">
            {TRUST_POINTS.map((t, i) => (
              <RevealItem key={i}>
                <div className="mb-5 flex h-11 w-11 items-center justify-center rounded-xl bg-primary/10 text-primary">{t.icon}</div>
                <h3 className="mb-2.5 text-base font-bold text-foreground">{t.title}</h3>
                <p className="text-[13.5px] leading-relaxed text-muted-foreground">{t.desc}</p>
              </RevealItem>
            ))}
          </RevealGroup>
        </div>
      </section>

      {/* Architecture — a more technical section than "How it works" above,
          showing the real signal pipeline rather than the user-facing flow. */}
      <section className="border-b border-border bg-background px-6 py-24" id="architecture">
        <div className="mx-auto max-w-[760px]">
          <Reveal className="mb-14 text-center">
            <p className="mb-3 text-xs font-bold uppercase tracking-wider text-primary">How MediSense works</p>
            <h2 className="text-[clamp(24px,3vw,36px)] font-extrabold tracking-tight text-foreground">
              Real engineering, not a chat wrapper
            </h2>
            <p className="mx-auto mt-4 max-w-[560px] text-[14px] leading-relaxed text-muted-foreground">
              Three independent signals — an AI assessment, a rule-based safety check, and a local ML
              classifier — combine into every result.
            </p>
          </Reveal>
          <RevealGroup className="relative flex flex-col gap-8">
            <div className="absolute top-5 bottom-5 left-5 w-px bg-border" aria-hidden="true" />
            {ARCHITECTURE_STEPS.map((s, i) => (
              <RevealItem key={i} className="relative flex items-start gap-5">
                <div className="relative z-10 flex h-10 w-10 shrink-0 items-center justify-center rounded-full border-2 border-primary/20 bg-card text-primary">
                  {s.icon}
                </div>
                <div className="pt-1.5">
                  <h3 className="mb-1 text-[15px] font-bold text-foreground">{s.title}</h3>
                  <p className="text-[13px] leading-relaxed text-muted-foreground">{s.desc}</p>
                </div>
              </RevealItem>
            ))}
          </RevealGroup>
          <Reveal className="mt-12 flex flex-col items-center gap-3 border-t border-border pt-10">
            <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Built with</p>
            <div className="flex flex-wrap justify-center gap-2">
              {TECH_STACK.map((t) => (
                <span
                  key={t}
                  className="rounded-full border border-border bg-card px-3 py-1 text-[12px] font-medium text-foreground"
                >
                  {t}
                </span>
              ))}
            </div>
          </Reveal>
        </div>
      </section>

      {/* Stats */}
      <section className="bg-ink px-6 py-16">
        <RevealGroup className="mx-auto grid max-w-[1280px] grid-cols-2 gap-10 lg:grid-cols-4">
          {STATS.map((s, i) => (
            <RevealItem key={i} className="text-center">
              <div className="mb-2 font-heading text-4xl font-extrabold tracking-tight text-ink-foreground">{s.val}</div>
              <div className="text-[13px] leading-relaxed text-ink-foreground/60">{s.label}</div>
            </RevealItem>
          ))}
        </RevealGroup>
      </section>

      {/* FAQ */}
      <section className="px-6 py-24" id="faq">
        <div className="mx-auto max-w-[760px]">
          <Reveal className="mb-12 text-center">
            <p className="mb-3 text-xs font-bold uppercase tracking-wider text-primary">FAQ</p>
            <h2 className="text-[clamp(24px,3vw,36px)] font-extrabold tracking-tight text-foreground">
              Questions people ask us
            </h2>
          </Reveal>
          <Reveal>
            {FAQS.map((f, i) => (
              <FaqItem key={i} q={f.q} a={f.a} open={openFaq === i} onToggle={() => setOpenFaq(openFaq === i ? -1 : i)} />
            ))}
          </Reveal>
        </div>
      </section>

      {/* CTA */}
      <section className="bg-gradient-to-br from-primary-hover to-primary px-6 py-24 text-center">
        <Reveal className="mx-auto max-w-[600px]">
          <h2 className="mb-5 text-[clamp(26px,3vw,38px)] font-extrabold tracking-tight text-primary-foreground">
            Take your health seriously — starting now
          </h2>
          <p className="mb-9 text-[15px] leading-relaxed text-primary-foreground/80">
            Create your free account and get your first symptom assessment in under two minutes.
          </p>
          <Link
            to="/register"
            className="inline-flex items-center gap-2 rounded-full bg-primary-foreground px-8 py-3.5 text-[15px] font-semibold text-primary transition-colors hover:bg-primary-foreground/90"
          >
            Start for free <ArrowRight size={16} />
          </Link>
          <p className="mt-5 text-xs text-primary-foreground/55">No credit card required · Always free to use</p>
        </Reveal>
      </section>

      {/* Footer */}
      <footer className="border-t border-white/10 bg-ink px-6 py-10">
        <div className="mx-auto flex max-w-[1280px] flex-col items-center gap-4 text-center">
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-white/10 text-ink-foreground">
              <Activity size={16} />
            </div>
            <span className="text-sm font-bold text-ink-foreground/90">MediSense AI</span>
          </div>
          <p className="max-w-[520px] text-xs leading-relaxed text-ink-foreground/60">
            MediSense AI is not a substitute for professional medical advice, diagnosis, or treatment.
            Always consult a qualified healthcare provider.
          </p>
          <p className="text-xs text-ink-foreground/55">© {new Date().getFullYear()} MediSense AI. Final year project.</p>
        </div>
      </footer>
    </div>
  );
}
