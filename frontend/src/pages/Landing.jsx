import { Link } from 'react-router-dom';
import { useEffect, useRef, useState } from 'react';
import { Activity, Brain, ShieldCheck, TrendingUp, Zap, Clock, Users, Star, ArrowRight, CheckCircle } from 'lucide-react';
import './Landing.css';

// Animated conversation demo data
const DEMO_CONVERSATION = [
  { role: 'ai',   text: "Hi! I'm MediSense. What symptoms are you experiencing?" },
  { role: 'user', text: "I've had a splitting headache for two days and feel nauseous." },
  { role: 'ai',   text: "Is the pain on one side of your head or both sides?" },
  { role: 'user', text: "Mostly on the right side, and light makes it worse." },
  { role: 'ai',   text: "Those symptoms suggest a possible migraine. I have a few more questions to refine this — how's your sleep been?" },
];

/* NEW */
function ConversationDemo() {
  const [visible, setVisible] = useState(0);
  const [typing, setTyping] = useState(false);
  const messagesRef = useRef(null);

  useEffect(() => {
    const total = DEMO_CONVERSATION.length;
    if (visible >= total) {
      const restart = setTimeout(() => setVisible(0), 2200);
      return () => clearTimeout(restart);
    }
    setTyping(true);
    const delay = DEMO_CONVERSATION[visible].role === 'ai' ? 1200 : 900;
    const t = setTimeout(() => {
      setTyping(false);
      setTimeout(() => setVisible(v => v + 1), 200);
    }, delay);
    return () => clearTimeout(t);
  }, [visible]);

  useEffect(() => {
    if (messagesRef.current) {
      messagesRef.current.scrollTop = messagesRef.current.scrollHeight;
    }
  }, [visible, typing]);

  return (
    <div className="lp-demo-card">
      <div className="lp-demo-header">
        <div className="lp-demo-dot green" /><div className="lp-demo-dot yellow" /><div className="lp-demo-dot red" />
        <span className="lp-demo-title">MediSense Assistant</span>
        <span className="lp-demo-online">● Live</span>
      </div>
      <div className="lp-demo-messages" ref={messagesRef}>
        {DEMO_CONVERSATION.slice(0, visible).map((msg, i) => (
          <div key={i} className={`lp-demo-msg ${msg.role}`}>
            {msg.role === 'ai' && <div className="lp-demo-avatar"><Activity size={10} /></div>}
            <div className="lp-demo-bubble">{msg.text}</div>
          </div>
        ))}
        {typing && visible < DEMO_CONVERSATION.length && (
          <div className={`lp-demo-msg ${DEMO_CONVERSATION[visible].role}`}>
            {DEMO_CONVERSATION[visible].role === 'ai' && <div className="lp-demo-avatar"><Activity size={10} /></div>}
            <div className="lp-demo-bubble lp-demo-typing">
              <span /><span /><span />
            </div>
          </div>
        )}
      </div>
      <div className="lp-demo-footer">
        <div className="lp-demo-input-mock">Describe your symptoms…</div>
        <div className="lp-demo-send-mock"><ArrowRight size={13} /></div>
      </div>
    </div>
  );
}

export default function Landing() {
  return (
    <div className="lp-root">

      {/* ── Nav ── */}
      <nav className="lp-nav">
        <div className="lp-nav-inner">
          <div className="lp-brand">
            <div className="lp-brand-icon"><Activity size={18} /></div>
            <span className="lp-brand-name">MediSense AI</span>
          </div>
          <div className="lp-nav-links">
            <a href="#how">How it works</a>
            <a href="#features">Features</a>
            <a href="#stats">About</a>
          </div>
          <div className="lp-nav-actions">
            <Link to="/login"><button className="lp-btn-ghost">Sign in</button></Link>
            <Link to="/register"><button className="lp-btn-solid">Get started <ArrowRight size={14} /></button></Link>
          </div>
        </div>
      </nav>

      {/* ── Hero ── */}
      <section className="lp-hero">
        <div className="lp-hero-inner">
          <div className="lp-hero-left">
            <div className="lp-eyebrow">
              <span className="lp-eyebrow-dot" />
              AI-powered health intelligence
            </div>
            <h1 className="lp-hero-heading">
              Describe how you feel.<br />
              <span className="lp-hero-accent">Understand why.</span>
            </h1>
            <p className="lp-hero-body">
              MediSense asks the right follow-up questions, weighs your health profile,
              and gives you a ranked differential — the same way a doctor thinks, available anytime.
            </p>
            <div className="lp-hero-actions">
              <Link to="/register">
                <button className="lp-btn-solid lp-btn-lg">Check your symptoms <ArrowRight size={16} /></button>
              </Link>
              <Link to="/login">
                <button className="lp-btn-ghost lp-btn-lg">Sign in</button>
              </Link>
            </div>
            <div className="lp-trust-row">
              {['No appointment needed', 'Private & secure', 'Always available'].map((t, i) => (
                <div key={i} className="lp-trust-item">
                  <CheckCircle size={13} className="lp-trust-icon" />
                  <span>{t}</span>
                </div>
              ))}
            </div>
          </div>
          <div className="lp-hero-right">
            <ConversationDemo />
          </div>
        </div>
      </section>

      {/* ── How it works ── */}
      <section className="lp-section lp-how" id="how">
        <div className="lp-section-inner">
          <p className="lp-section-eyebrow">How it works</p>
          <h2 className="lp-section-heading">From symptoms to clarity in minutes</h2>
          <div className="lp-steps">
            {[
              { step: '1', icon: <Zap size={20} />, title: 'Describe your symptoms', desc: 'Type or speak — tell MediSense what you\'re feeling, where, and for how long.' },
              { step: '2', icon: <Brain size={20} />, title: 'AI asks follow-up questions', desc: 'The assistant probes deeper, factoring in your health profile and history.' },
              { step: '3', icon: <TrendingUp size={20} />, title: 'Get your health report', desc: 'Receive a ranked list of possible conditions with severity scores and next steps.' },
            ].map((s) => (
              <div key={s.step} className="lp-step">
                <div className="lp-step-icon">{s.icon}</div>
                <div className="lp-step-num">Step {s.step}</div>
                <h3 className="lp-step-title">{s.title}</h3>
                <p className="lp-step-desc">{s.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Features ── */}
      <section className="lp-section lp-features" id="features">
        <div className="lp-section-inner">
          <p className="lp-section-eyebrow">Features</p>
          <h2 className="lp-section-heading">Everything your health needs</h2>
          <div className="lp-features-grid">
            {[
              { icon: <Brain size={22} />, color: '#dbeafe', iconColor: '#3b82f6', title: 'Differential diagnosis', desc: 'Multiple possible conditions ranked by probability, not just one guess.' },
              { icon: <ShieldCheck size={22} />, color: '#dcfce7', iconColor: '#22c55e', title: 'Emergency detection', desc: 'Critical symptoms trigger an immediate alert to seek emergency care.' },
              { icon: <Users size={22} />, color: '#f3e8ff', iconColor: '#8b5cf6', title: 'Personalized to you', desc: 'Age, sex, weight, conditions, and family history all shape your results.' },
              { icon: <TrendingUp size={22} />, color: '#fef3c7', iconColor: '#f59e0b', title: 'Symptom tracking', desc: 'See how your health changes over time with visual timelines and trends.' },
              { icon: <Clock size={22} />, color: '#ffe4e6', iconColor: '#f43f5e', title: '24 / 7 availability', desc: 'No waiting rooms. No appointments. Check symptoms any time, anywhere.' },
              { icon: <Star size={22} />, color: '#dbeafe', iconColor: '#3b82f6', title: 'Body map input', desc: 'Click where it hurts on an interactive body diagram for precise reporting.' },
            ].map((f, i) => (
              <div key={i} className="lp-feature-card">
                <div className="lp-feature-icon" style={{ background: f.color, color: f.iconColor }}>{f.icon}</div>
                <h3 className="lp-feature-title">{f.title}</h3>
                <p className="lp-feature-desc">{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Stats bar ── */}
      <section className="lp-stats" id="stats">
        <div className="lp-stats-inner">
          {[
            { val: '95%', label: 'Symptom coverage across major conditions' },
            { val: '<2 min', label: 'Average time to a full assessment' },
            { val: '24/7', label: 'Available every day, every hour' },
            { val: '100%', label: 'Private — your data stays yours' },
          ].map((s, i) => (
            <div key={i} className="lp-stat">
              <div className="lp-stat-val">{s.val}</div>
              <div className="lp-stat-label">{s.label}</div>
            </div>
          ))}
        </div>
      </section>

      {/* ── CTA ── */}
      <section className="lp-cta">
        <div className="lp-cta-inner">
          <h2 className="lp-cta-heading">Take your health seriously — starting now</h2>
          <p className="lp-cta-body">Create your free account and get your first symptom assessment in under two minutes.</p>
          <Link to="/register">
            <button className="lp-btn-solid lp-btn-lg lp-btn-white">
              Start for free <ArrowRight size={16} />
            </button>
          </Link>
          <p className="lp-cta-note">No credit card required · Always free to use</p>
        </div>
      </section>

      {/* ── Footer ── */}
      <footer className="lp-footer">
        <div className="lp-footer-inner">
          <div className="lp-brand">
            <div className="lp-brand-icon"><Activity size={16} /></div>
            <span className="lp-brand-name" style={{ fontSize: 14 }}>MediSense AI</span>
          </div>
          <p className="lp-footer-note">
            MediSense AI is not a substitute for professional medical advice, diagnosis, or treatment.
            Always consult a qualified healthcare provider.
          </p>
          <p className="lp-footer-copy">© {new Date().getFullYear()} MediSense AI. Final year project.</p>
        </div>
      </footer>

    </div>
  );
}