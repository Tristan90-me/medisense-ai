import { useState, useRef, useEffect, useCallback } from 'react';

const useVoice = () => {
  const [isListening, setIsListening] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [voiceEnabled, setVoiceEnabled] = useState(() => {
    return localStorage.getItem('medisense-voice') !== 'false';
  });
  const [supported, setSupported] = useState(true);
  const [volume, setVolume] = useState(0); // 0-1 for waveform

  const recognitionRef = useRef(null);
  const synthRef = useRef(window.speechSynthesis);
  const silenceTimerRef = useRef(null);
  const analyserRef = useRef(null);
  const animFrameRef = useRef(null);
  const streamRef = useRef(null);

  // ── Check support & setup recognition ────────────────────────────────
  useEffect(() => {
    const SpeechRecognition =
      window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      setSupported(false);
      return;
    }

    const recognition = new SpeechRecognition();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = 'en-US';
    recognition.maxAlternatives = 1;

    recognition.onresult = (e) => {
      let interim = '';
      let final = '';
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const t = e.results[i][0].transcript;
        if (e.results[i].isFinal) final += t;
        else interim += t;
      }
      const text = final || interim;
      setTranscript(text);

      // Reset silence timer on speech
      clearTimeout(silenceTimerRef.current);
      silenceTimerRef.current = setTimeout(() => {
        if (recognitionRef.current) {
          try { recognitionRef.current.stop(); } catch {}
        }
      }, 3000); // Stop after 3s of silence
    };

    recognition.onend = () => {
      setIsListening(false);
      stopVolumeMonitor();
      clearTimeout(silenceTimerRef.current);
    };

    recognition.onerror = (e) => {
      if (e.error !== 'no-speech' && e.error !== 'aborted') {
        console.warn('Speech recognition error:', e.error);
      }
      setIsListening(false);
      stopVolumeMonitor();
    };

    recognitionRef.current = recognition;

    return () => {
      clearTimeout(silenceTimerRef.current);
      cancelAnimationFrame(animFrameRef.current);
    };
  }, []);

  // ── Voice preference persistence ──────────────────────────────────────
  useEffect(() => {
    localStorage.setItem('medisense-voice', voiceEnabled);
  }, [voiceEnabled]);

  // ── Volume monitor (for waveform) ─────────────────────────────────────
  const startVolumeMonitor = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      const ctx = new AudioContext();
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 256;
      const source = ctx.createMediaStreamSource(stream);
      source.connect(analyser);
      analyserRef.current = analyser;

      const tick = () => {
        const data = new Uint8Array(analyser.frequencyBinCount);
        analyser.getByteFrequencyData(data);
        const avg = data.reduce((a, b) => a + b, 0) / data.length;
        setVolume(Math.min(avg / 128, 1));
        animFrameRef.current = requestAnimationFrame(tick);
      };
      tick();
    } catch {
      // Microphone permission denied — voice still works without waveform
    }
  };

  const stopVolumeMonitor = () => {
    cancelAnimationFrame(animFrameRef.current);
    streamRef.current?.getTracks().forEach(t => t.stop());
    setVolume(0);
  };

  // ── Start listening ────────────────────────────────────────────────────
  const startListening = useCallback(() => {
    if (!supported || isListening || isSpeaking) return;
    setTranscript('');
    setIsListening(true);
    try {
      recognitionRef.current?.start();
      startVolumeMonitor();
    } catch {}
  }, [supported, isListening, isSpeaking]);

  // ── Stop listening ─────────────────────────────────────────────────────
  const stopListening = useCallback(() => {
    clearTimeout(silenceTimerRef.current);
    try { recognitionRef.current?.stop(); } catch {}
    setIsListening(false);
    stopVolumeMonitor();
  }, []);

  // ── Clear transcript ───────────────────────────────────────────────────
  const clearTranscript = useCallback(() => setTranscript(''), []);

  // ── Get best voice ─────────────────────────────────────────────────────
  const getBestVoice = useCallback(() => {
    const voices = synthRef.current?.getVoices() || [];
    // Priority list — best quality voices first
    const preferred = [
      'Google UK English Female',
      'Google US English',
      'Samantha',
      'Karen',
      'Moira',
      'Tessa',
    ];
    for (const name of preferred) {
      const match = voices.find(v => v.name.includes(name));
      if (match) return match;
    }
    // Fallback: any English female
    return voices.find(v => v.lang.startsWith('en') && v.name.toLowerCase().includes('female'))
      || voices.find(v => v.lang.startsWith('en'))
      || null;
  }, []);

  // ── Speak text (TTS) ───────────────────────────────────────────────────
  const speak = useCallback((text) => {
    if (!voiceEnabled || !text) return;

    // Strip all metadata blocks
    const clean = text
      .replace(/\[EMERGENCY\]/g, '')
      .replace(/\[SEVERITY:\{[\s\S]*?\}\]/g, '')
      .replace(/\[SYMPTOMS:\{[\s\S]*?\}\]/g, '')
      .replace(/\[DIAGNOSIS:\{[\s\S]*?\}\]/g, '')
      .replace(/\[SUGGESTIONS:\[[\s\S]*?\]\]/g, '')
      .replace(/\*\*/g, '')
      .trim();

    if (!clean) return;

    synthRef.current?.cancel();

    // Voices may not be loaded yet — wait if needed
    const trySpeak = () => {
      const utterance = new SpeechSynthesisUtterance(clean);
      utterance.rate = 0.92;
      utterance.pitch = 1.05;
      utterance.volume = 1;

      const voice = getBestVoice();
      if (voice) utterance.voice = voice;

      utterance.onstart = () => setIsSpeaking(true);
      utterance.onend = () => setIsSpeaking(false);
      utterance.onerror = () => setIsSpeaking(false);

      synthRef.current?.speak(utterance);
    };

    const voices = synthRef.current?.getVoices() || [];
    if (voices.length === 0) {
      // Voices not loaded yet
      synthRef.current.onvoiceschanged = () => {
        trySpeak();
        synthRef.current.onvoiceschanged = null;
      };
    } else {
      trySpeak();
    }
  }, [voiceEnabled, getBestVoice]);

  // ── Stop speaking ──────────────────────────────────────────────────────
  const stopSpeaking = useCallback(() => {
    synthRef.current?.cancel();
    setIsSpeaking(false);
  }, []);

  // ── Toggle voice ───────────────────────────────────────────────────────
  const toggleVoice = useCallback(() => {
    setVoiceEnabled((prev) => {
      if (prev) {
        synthRef.current?.cancel();
        setIsSpeaking(false);
      }
      return !prev;
    });
  }, []);

  return {
    isListening,
    transcript,
    isSpeaking,
    voiceEnabled,
    supported,
    volume,       // 0-1 — use for waveform animation
    startListening,
    stopListening,
    clearTranscript,
    speak,
    stopSpeaking,
    toggleVoice,
  };
};

export default useVoice;