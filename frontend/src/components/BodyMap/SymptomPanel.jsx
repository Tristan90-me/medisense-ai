import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { X, ArrowRight } from 'lucide-react';
import { regions } from './BodyMap';

const symptomsByRegion = {
  head: [
    'Headache', 'Migraine', 'Dizziness', 'Blurred vision',
    'Ear pain', 'Sore throat', 'Neck stiffness', 'Runny nose',
    'Facial pain', 'Jaw pain', 'Ringing in ears', 'Memory issues',
  ],
  chest: [
    'Chest pain', 'Shortness of breath', 'Heart palpitations',
    'Tightness in chest', 'Cough', 'Wheezing', 'Rapid heartbeat',
    'Pain when breathing', 'Chest pressure', 'Breast tenderness',
  ],
  abdomen: [
    'Stomach pain', 'Nausea', 'Vomiting', 'Bloating',
    'Diarrhea', 'Constipation', 'Heartburn', 'Loss of appetite',
    'Abdominal cramps', 'Indigestion', 'Blood in stool',
  ],
  leftArm: [
    'Arm pain', 'Weakness', 'Numbness', 'Tingling',
    'Swelling', 'Joint pain', 'Limited range of motion',
    'Muscle cramps', 'Elbow pain', 'Wrist pain',
  ],
  rightArm: [
    'Arm pain', 'Weakness', 'Numbness', 'Tingling',
    'Swelling', 'Joint pain', 'Limited range of motion',
    'Muscle cramps', 'Elbow pain', 'Wrist pain',
  ],
  leftLeg: [
    'Leg pain', 'Knee pain', 'Swelling', 'Numbness',
    'Muscle cramps', 'Weakness', 'Hip pain', 'Foot pain',
    'Ankle swelling', 'Difficulty walking',
  ],
  rightLeg: [
    'Leg pain', 'Knee pain', 'Swelling', 'Numbness',
    'Muscle cramps', 'Weakness', 'Hip pain', 'Foot pain',
    'Ankle swelling', 'Difficulty walking',
  ],
  back: [
    'Lower back pain', 'Upper back pain', 'Stiffness',
    'Muscle spasms', 'Pain radiating to legs', 'Shoulder blade pain',
    'Pain when bending', 'Sciatica', 'Spine tenderness',
  ],
};

export default function SymptomPanel({ region, onClose }) {
  const navigate = useNavigate();
  const [selected, setSelected] = useState([]);

  const symptoms = symptomsByRegion[region] || [];
  const regionLabel = regions[region]?.label || 'Back';

  const toggle = (s) => {
    setSelected((prev) =>
      prev.includes(s) ? prev.filter((x) => x !== s) : [...prev, s]
    );
  };

  const handleStartChat = () => {
    if (selected.length === 0) return;
    const symptomText = `I have the following symptoms in my ${regionLabel.toLowerCase()}: ${selected.join(', ')}.`;
    navigate(`/session?mode=quick&symptoms=${encodeURIComponent(symptomText)}`);
  };

  return (
    <div className="sp-root">
      {/* Header */}
      <div className="sp-header">
        <div>
          <p className="sp-title">{regionLabel}</p>
          <p className="sp-sub">Select all that apply</p>
        </div>
        <button className="sp-close" onClick={onClose}>
          <X size={16} />
        </button>
      </div>

      {/* Symptom list */}
      <div className="sp-list">
        {symptoms.map((s) => (
          <button
            key={s}
            className={`sp-item ${selected.includes(s) ? 'selected' : ''}`}
            onClick={() => toggle(s)}
          >
            <span className="sp-check">{selected.includes(s) ? '✓' : ''}</span>
            {s}
          </button>
        ))}
      </div>

      {/* Footer */}
      <div className="sp-footer">
        {selected.length > 0 && (
          <p className="sp-count">{selected.length} symptom{selected.length > 1 ? 's' : ''} selected</p>
        )}
        <button
          className="sp-start-btn"
          onClick={handleStartChat}
          disabled={selected.length === 0}
        >
          Start AI Check <ArrowRight size={15} />
        </button>
      </div>
    </div>
  );
}