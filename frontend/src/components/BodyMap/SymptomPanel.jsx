import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { X, ArrowRight, Check } from 'lucide-react';
import { regions } from './BodyMap';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

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

// Short, purely descriptive one-liners — informational only, not diagnostic claims.
const symptomDescriptions = {
  'Headache': 'A dull, throbbing, or sharp sensation in the head.',
  'Migraine': 'An intense, often one-sided headache, sometimes with light sensitivity.',
  'Dizziness': 'A spinning or unsteady, light-headed feeling.',
  'Blurred vision': 'Difficulty seeing things clearly or in focus.',
  'Ear pain': 'Discomfort or aching felt in or around the ear.',
  'Sore throat': 'Pain, scratchiness, or irritation when swallowing.',
  'Neck stiffness': 'Reduced or painful range of motion in the neck.',
  'Runny nose': 'Excess mucus draining from the nose.',
  'Facial pain': 'Discomfort felt across the face or sinuses.',
  'Jaw pain': 'Aching or tenderness around the jaw joint.',
  'Ringing in ears': 'A persistent ringing, buzzing, or hissing sound.',
  'Memory issues': 'Trouble recalling recent events or information.',
  'Chest pain': 'Discomfort, tightness, or aching in the chest.',
  'Shortness of breath': 'Difficulty breathing or feeling breathless.',
  'Heart palpitations': 'A noticeable fluttering or pounding heartbeat.',
  'Tightness in chest': 'A squeezing or constricted feeling in the chest.',
  'Cough': 'A repeated, forceful expulsion of air from the lungs.',
  'Wheezing': 'A whistling sound when breathing.',
  'Rapid heartbeat': 'A heart rate that feels faster than usual.',
  'Pain when breathing': 'Discomfort that occurs while inhaling or exhaling.',
  'Chest pressure': 'A heavy or pressing sensation in the chest.',
  'Breast tenderness': 'Soreness or sensitivity in breast tissue.',
  'Stomach pain': 'Discomfort or cramping felt in the stomach area.',
  'Nausea': 'An uneasy, queasy feeling with an urge to vomit.',
  'Vomiting': 'Forcefully bringing up stomach contents.',
  'Bloating': 'A full, tight, or swollen feeling in the abdomen.',
  'Diarrhea': 'Loose or watery, more frequent bowel movements.',
  'Constipation': 'Infrequent or difficult bowel movements.',
  'Heartburn': 'A burning sensation rising from the stomach to the chest.',
  'Loss of appetite': 'Reduced desire or interest in eating.',
  'Abdominal cramps': 'Sharp, tightening pains in the abdomen.',
  'Indigestion': 'Discomfort or a burning feeling after eating.',
  'Blood in stool': 'Visible blood present in a bowel movement.',
  'Arm pain': 'Aching or discomfort along the arm.',
  'Weakness': 'Reduced strength or difficulty moving normally.',
  'Numbness': 'A loss of feeling or sensation in the area.',
  'Tingling': 'A prickling or "pins and needles" sensation.',
  'Swelling': 'Visible puffiness or enlargement of the area.',
  'Joint pain': 'Aching, stiffness, or discomfort around a joint.',
  'Limited range of motion': 'Difficulty moving the joint or limb fully.',
  'Muscle cramps': 'Sudden, involuntary muscle tightening.',
  'Elbow pain': 'Discomfort localized around the elbow.',
  'Wrist pain': 'Discomfort localized around the wrist.',
  'Leg pain': 'Aching or discomfort along the leg.',
  'Knee pain': 'Discomfort localized around the knee.',
  'Hip pain': 'Discomfort localized around the hip.',
  'Foot pain': 'Discomfort localized in the foot.',
  'Ankle swelling': 'Visible puffiness around the ankle.',
  'Difficulty walking': 'Trouble moving or walking normally.',
  'Lower back pain': 'Discomfort felt in the lower back.',
  'Upper back pain': 'Discomfort felt in the upper back.',
  'Stiffness': 'Reduced flexibility or ease of movement.',
  'Muscle spasms': 'Sudden, involuntary muscle contractions.',
  'Pain radiating to legs': 'Discomfort that spreads from the back into the legs.',
  'Shoulder blade pain': 'Discomfort felt around the shoulder blade.',
  'Pain when bending': 'Discomfort that occurs while bending forward or sideways.',
  'Sciatica': 'A shooting sensation felt along the sciatic nerve path.',
  'Spine tenderness': 'Sensitivity or soreness along the spine.',
};

// Short, non-diagnostic framing for each region — sets expectations for the list below.
const regionDescriptions = {
  head: 'Covers head, face, and neck sensations — from headaches to sinus and ear discomfort.',
  chest: 'Covers sensations around the chest, breathing, and heartbeat.',
  abdomen: 'Covers stomach and digestive sensations.',
  leftArm: 'Covers sensations in the left arm, from shoulder to wrist.',
  rightArm: 'Covers sensations in the right arm, from shoulder to wrist.',
  leftLeg: 'Covers sensations in the left leg, from hip to foot.',
  rightLeg: 'Covers sensations in the right leg, from hip to foot.',
  back: 'Covers sensations across the upper and lower back.',
};

export default function SymptomPanel({ region, onClose }) {
  const navigate = useNavigate();
  const [selected, setSelected] = useState([]);

  const symptoms = symptomsByRegion[region] || [];
  const regionLabel = regions[region]?.label || 'Back';
  const regionDescription = regionDescriptions[region];

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
    <div className="flex h-full flex-col bg-card">
      {/* Header */}
      <div className="flex items-start justify-between border-b border-border px-4 py-4">
        <div>
          <p className="text-[15px] font-bold text-foreground">{regionLabel}</p>
          <p className="mt-0.5 text-xs text-muted-foreground">Select all that apply</p>
          {regionDescription && (
            <p className="mt-1.5 max-w-[420px] text-[11.5px] leading-relaxed text-muted-foreground">
              {regionDescription}
            </p>
          )}
        </div>
        <button
          className="flex rounded-lg bg-muted p-1.5 text-muted-foreground transition-colors hover:bg-border"
          onClick={onClose}
        >
          <X size={16} />
        </button>
      </div>

      {/* Symptom list */}
      <div className="flex flex-1 flex-col gap-1.5 overflow-y-auto p-3">
        {symptoms.map((s) => {
          const isSelected = selected.includes(s);
          const description = symptomDescriptions[s];
          return (
            <button
              key={s}
              type="button"
              className={cn(
                'flex items-start gap-2.5 rounded-[10px] border px-3 py-2.5 text-left text-[13px] transition-all',
                isSelected
                  ? 'border-primary bg-primary/10 text-primary'
                  : 'border-border bg-background text-foreground/80 hover:border-primary/40 hover:bg-primary/5'
              )}
              onClick={() => toggle(s)}
            >
              <span
                className={cn(
                  'mt-0.5 flex h-[18px] w-[18px] shrink-0 items-center justify-center rounded-[5px] border-[1.5px] text-primary',
                  isSelected ? 'border-primary bg-primary text-primary-foreground' : 'border-border bg-card'
                )}
              >
                {isSelected && <Check size={11} strokeWidth={3} />}
              </span>
              <span className="flex flex-col gap-0.5">
                <span className={cn(isSelected && 'font-medium')}>{s}</span>
                {description && (
                  <span className="text-[11px] leading-snug text-muted-foreground">
                    {description}
                  </span>
                )}
              </span>
            </button>
          );
        })}
      </div>

      {/* Footer */}
      <div className="flex items-center justify-between gap-2.5 border-t border-border px-4 py-3">
        {selected.length > 0 && (
          <p className="text-xs font-medium text-primary">
            {selected.length} symptom{selected.length > 1 ? 's' : ''} selected
          </p>
        )}
        <Button
          className="ml-auto rounded-full"
          onClick={handleStartChat}
          disabled={selected.length === 0}
        >
          Start AI Check <ArrowRight size={15} />
        </Button>
      </div>
    </div>
  );
}
