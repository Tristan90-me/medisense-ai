import { useState, useRef, useEffect, useCallback } from 'react';

const useVoice = () => {
  const [isListening, setIsListening] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [voiceEnabled, setVoiceEnabled] = useState(() => {
    return localStorage.getItem('medisense-voice') !== 'false';
  });
  const [supported, setSupported] = useState(true);

  const recognitionRef = useRef(null);
  const synthRef = useRef(window.speechSynthesis);

  // ── Check browser support ──────────────────────────────────────────────
  useEffect(() => {
    const SpeechRecognition =
      window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      setSupported(false);
      return;
    }

    const recognition = new SpeechRecognition();
    recognition.continuous = false;
    recognition.interimResults = true;
    recognition.lang = 'en-US';

    recognition.onresult = (e) => {
      let interim = '';
      let final = '';
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const t = e.results[i][0].transcript;
        if (e.results[i].isFinal) final += t;
        else interim += t;
      }
      setTranscript(final || interim);
    };

    recognition.onend = () => setIsListening(false);
    recognition.onerror = () => setIsListening(false);

    recognitionRef.current = recognition;
  }, []);

  // ── Save voice preference ──────────────────────────────────────────────
  useEffect(() => {
    localStorage.setItem('medisense-voice', voiceEnabled);
  }, [voiceEnabled]);

  // ── Start listening ────────────────────────────────────────────────────
  const startListening = useCallback(() => {
    if (!supported || isListening || isSpeaking) return;
    setTranscript('');
    setIsListening(true);
    try {
      recognitionRef.current?.start();
    } catch {}
  }, [supported, isListening, isSpeaking]);

  // ── Stop listening ─────────────────────────────────────────────────────
  const stopListening = useCallback(() => {
    recognitionRef.current?.stop();
    setIsListening(false);
  }, []);

  // ── Clear transcript ───────────────────────────────────────────────────
  const clearTranscript = useCallback(() => setTranscript(''), []);

  // ── Speak text (TTS) ───────────────────────────────────────────────────
  const speak = useCallback(
    (text) => {
      if (!voiceEnabled || !text) return;

      // Strip metadata blocks before speaking
      const clean = text
        .replace(/\[EMERGENCY\]/g, '')
        .replace(/\[SEVERITY:\{.*?\}\]/gs, '')
        .replace(/\[SYMPTOMS:\{.*?\}\]/gs, '')
        .replace(/\[DIAGNOSIS:\{.*?\}\]/gs, '')
        .replace(/\[SUGGESTIONS:\[.*?\]\]/gs, '')
        .trim();

      if (!clean) return;

      synthRef.current?.cancel();

      const utterance = new SpeechSynthesisUtterance(clean);
      utterance.rate = 0.9;
      utterance.pitch = 1;
      utterance.volume = 1;

      // Prefer a clear English voice
      const voices = synthRef.current?.getVoices() || [];
      const preferred = voices.find(
        (v) =>
          v.lang.startsWith('en') &&
          (v.name.includes('Female') ||
            v.name.includes('Samantha') ||
            v.name.includes('Google UK') ||
            v.name.includes('Karen'))
      );
      if (preferred) utterance.voice = preferred;

      utterance.onstart = () => setIsSpeaking(true);
      utterance.onend = () => setIsSpeaking(false);
      utterance.onerror = () => setIsSpeaking(false);

      synthRef.current?.speak(utterance);
    },
    [voiceEnabled]
  );

  // ── Stop speaking ──────────────────────────────────────────────────────
  const stopSpeaking = useCallback(() => {
    synthRef.current?.cancel();
    setIsSpeaking(false);
  }, []);

  // ── Toggle voice on/off ────────────────────────────────────────────────
  const toggleVoice = useCallback(() => {
    setVoiceEnabled((prev) => {
      if (prev) synthRef.current?.cancel();
      return !prev;
    });
  }, []);

  return {
    isListening,
    transcript,
    isSpeaking,
    voiceEnabled,
    supported,
    startListening,
    stopListening,
    clearTranscript,
    speak,
    stopSpeaking,
    toggleVoice,
  };
};

export default useVoice;