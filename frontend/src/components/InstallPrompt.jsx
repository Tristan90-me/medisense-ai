import { useState, useEffect } from 'react';
import { Download, X } from 'lucide-react';

export default function InstallPrompt() {
  const [prompt, setPrompt] = useState(null);
  const [show, setShow] = useState(false);

  useEffect(() => {
    const handler = (e) => {
      e.preventDefault();
      setPrompt(e);
      // Only show if not dismissed before
      const dismissed = localStorage.getItem('medisense-install-dismissed');
      if (!dismissed) setShow(true);
    };
    window.addEventListener('beforeinstallprompt', handler);
    return () => window.removeEventListener('beforeinstallprompt', handler);
  }, []);

  const handleInstall = async () => {
    if (!prompt) return;
    prompt.prompt();
    const { outcome } = await prompt.userChoice;
    if (outcome === 'accepted') setShow(false);
  };

  const handleDismiss = () => {
    setShow(false);
    localStorage.setItem('medisense-install-dismissed', 'true');
  };

  if (!show) return null;

  return (
    <div style={{
      position: 'fixed', bottom: 90, left: 16, right: 16,
      background: '#0f2744', borderRadius: 16,
      padding: '14px 16px', zIndex: 998,
      display: 'flex', alignItems: 'center', gap: 12,
      boxShadow: '0 8px 30px rgba(0,0,0,0.2)',
      maxWidth: 400, margin: '0 auto',
    }}>
      <div style={{ width: 40, height: 40, background: '#3b82f6', borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
        <Download size={18} color="#fff" />
      </div>
      <div style={{ flex: 1 }}>
        <p style={{ fontSize: 13, fontWeight: 600, color: '#fff', marginBottom: 2 }}>
          Install MediSense AI
        </p>
        <p style={{ fontSize: 11, color: 'rgba(255,255,255,0.6)' }}>
          Add to home screen for quick access
        </p>
      </div>
      <button
        onClick={handleInstall}
        style={{ background: '#3b82f6', border: 'none', borderRadius: 20, padding: '7px 14px', color: '#fff', fontSize: 12, fontWeight: 600, cursor: 'pointer', flexShrink: 0 }}
      >
        Install
      </button>
      <button
        onClick={handleDismiss}
        style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,0.5)', cursor: 'pointer', display: 'flex', padding: 4 }}
      >
        <X size={16} />
      </button>
    </div>
  );
}