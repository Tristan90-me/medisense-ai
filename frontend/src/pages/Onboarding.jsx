import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Activity, ChevronRight, ChevronLeft } from 'lucide-react';
import api from '../api/axios';
import toast from 'react-hot-toast';

const steps = ['Basic info', 'Body metrics', 'Medical history', 'Lifestyle'];

export default function Onboarding() {
  const navigate = useNavigate();
  const [step, setStep] = useState(0);
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({
    dateOfBirth: '', sex: '', weight: '', weightUnit: 'kg',
    height: '', heightUnit: 'cm', bloodType: 'unknown',
    preExistingConditions: '', allergies: '', currentMedications: '',
    familyHistory: '', smokingStatus: 'never', alcoholUse: 'none',
  });

  const set = (key, val) => setForm((f) => ({ ...f, [key]: val }));

  const handleFinish = async () => {
    setLoading(true);
    try {
      const payload = {
        ...form,
        preExistingConditions: form.preExistingConditions.split(',').map(s => s.trim()).filter(Boolean),
        allergies: form.allergies.split(',').map(s => s.trim()).filter(Boolean),
        currentMedications: form.currentMedications.split(',').map(s => s.trim()).filter(Boolean),
        familyHistory: form.familyHistory.split(',').map(s => s.trim()).filter(Boolean),
      };
      await api.put('/profile', payload);
      toast.success('Profile saved!');
      navigate('/dashboard');
    } catch {
      toast.error('Failed to save profile');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-wrapper" style={{ alignItems: 'flex-start', paddingTop: '3rem' }}>
      <div className="auth-card" style={{ maxWidth: 520 }}>
        <div className="auth-logo">
          <div className="auth-logo-icon"><Activity size={20} /></div>
          <span className="auth-logo-name">MediSense AI</span>
        </div>

        <div style={{ display: 'flex', gap: 6, marginBottom: '1.5rem' }}>
          {steps.map((s, i) => (
            <div key={i} style={{ flex: 1 }}>
              <div style={{
                height: 4, borderRadius: 2,
                background: i <= step ? '#3b82f6' : '#e2e8f0',
                transition: 'background 0.3s'
              }} />
              <p style={{ fontSize: 10, color: i === step ? '#3b82f6' : '#94a3b8', marginTop: 4 }}>{s}</p>
            </div>
          ))}
        </div>

        {step === 0 && (
          <>
            <h2 className="auth-title">Basic information</h2>
            <p className="auth-subtitle">This helps us personalize your health insights</p>
            <div className="form-group">
              <label className="form-label">Date of birth</label>
              <input className="form-input" type="date" value={form.dateOfBirth} onChange={(e) => set('dateOfBirth', e.target.value)} />
            </div>
            <div className="form-group">
              <label className="form-label">Biological sex</label>
              <select className="form-input" value={form.sex} onChange={(e) => set('sex', e.target.value)}>
                <option value="">Select</option>
                <option value="male">Male</option>
                <option value="female">Female</option>
                <option value="other">Other</option>
                <option value="prefer_not_to_say">Prefer not to say</option>
              </select>
            </div>
            <div className="form-group">
              <label className="form-label">Blood type</label>
              <select className="form-input" value={form.bloodType} onChange={(e) => set('bloodType', e.target.value)}>
                {['unknown','A+','A-','B+','B-','AB+','AB-','O+','O-'].map(b => <option key={b} value={b}>{b}</option>)}
              </select>
            </div>
          </>
        )}

        {step === 1 && (
          <>
            <h2 className="auth-title">Body metrics</h2>
            <p className="auth-subtitle">Used for risk stratification and health scoring</p>
            <div className="form-group">
              <label className="form-label">Weight</label>
              <div style={{ display: 'flex', gap: 8 }}>
                <input className="form-input" type="number" placeholder="70" value={form.weight} onChange={(e) => set('weight', e.target.value)} />
                <select className="form-input" style={{ width: 80 }} value={form.weightUnit} onChange={(e) => set('weightUnit', e.target.value)}>
                  <option value="kg">kg</option>
                  <option value="lbs">lbs</option>
                </select>
              </div>
            </div>
            <div className="form-group">
              <label className="form-label">Height</label>
              <div style={{ display: 'flex', gap: 8 }}>
                <input className="form-input" type="number" placeholder="175" value={form.height} onChange={(e) => set('height', e.target.value)} />
                <select className="form-input" style={{ width: 80 }} value={form.heightUnit} onChange={(e) => set('heightUnit', e.target.value)}>
                  <option value="cm">cm</option>
                  <option value="ft">ft</option>
                </select>
              </div>
            </div>
          </>
        )}

        {step === 2 && (
          <>
            <h2 className="auth-title">Medical history</h2>
            <p className="auth-subtitle">Separate multiple entries with commas</p>
            {[
              ['preExistingConditions', 'Pre-existing conditions', 'e.g. Diabetes, Asthma'],
              ['allergies', 'Allergies', 'e.g. Penicillin, Peanuts'],
              ['currentMedications', 'Current medications', 'e.g. Metformin, Lisinopril'],
              ['familyHistory', 'Family history', 'e.g. Heart disease, Cancer'],
            ].map(([key, label, placeholder]) => (
              <div className="form-group" key={key}>
                <label className="form-label">{label}</label>
                <input className="form-input" placeholder={placeholder} value={form[key]} onChange={(e) => set(key, e.target.value)} />
              </div>
            ))}
          </>
        )}

        {step === 3 && (
          <>
            <h2 className="auth-title">Lifestyle</h2>
            <p className="auth-subtitle">Lifestyle factors that affect your health risk</p>
            <div className="form-group">
              <label className="form-label">Smoking status</label>
              <select className="form-input" value={form.smokingStatus} onChange={(e) => set('smokingStatus', e.target.value)}>
                <option value="never">Never smoked</option>
                <option value="former">Former smoker</option>
                <option value="current">Current smoker</option>
              </select>
            </div>
            <div className="form-group">
              <label className="form-label">Alcohol use</label>
              <select className="form-input" value={form.alcoholUse} onChange={(e) => set('alcoholUse', e.target.value)}>
                <option value="none">None</option>
                <option value="occasional">Occasional</option>
                <option value="moderate">Moderate</option>
                <option value="heavy">Heavy</option>
              </select>
            </div>
          </>
        )}

        <div style={{ display: 'flex', gap: 10, marginTop: '1.5rem' }}>
          {step > 0 && (
            <button className="btn-blue" style={{ background: '#f1f5f9', color: '#475569', flex: 1 }} onClick={() => setStep(s => s - 1)}>
              <ChevronLeft size={16} style={{ display: 'inline', marginRight: 4 }} /> Back
            </button>
          )}
          {step < steps.length - 1 ? (
            <button className="btn-blue" style={{ flex: 1 }} onClick={() => setStep(s => s + 1)}>
              Next <ChevronRight size={16} style={{ display: 'inline', marginLeft: 4 }} />
            </button>
          ) : (
            <button className="btn-blue" style={{ flex: 1 }} onClick={handleFinish} disabled={loading}>
              {loading ? 'Saving...' : 'Finish setup'}
            </button>
          )}
        </div>

        <p style={{ textAlign: 'center', fontSize: 12, color: '#94a3b8', marginTop: '1rem', cursor: 'pointer' }}
          onClick={() => navigate('/dashboard')}>
          Skip for now
        </p>
      </div>
    </div>
  );
}