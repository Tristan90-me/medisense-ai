import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '@/lib/utils';

// Region geometry, front view. Head/neck and every limb segment are reused
// unchanged for the back view below — only the torso (chest/abdomen/pelvis
// vs. upper back/lower back/buttocks) actually differs between the two.
const FRONT_SHAPES = {
  head: 'M150,10 C120,10 96,34 96,62 C96,86 112,100 150,100 C188,100 204,86 204,62 C204,34 180,10 150,10 Z',
  neck: 'M130,100 L170,100 L176,118 L124,118 Z',
  chest: 'M88,118 L212,118 L196,260 L104,260 Z',
  abdomen: 'M104,260 L196,260 L202,300 L98,300 Z',
  pelvis: 'M98,300 L202,300 L200,340 L152,344 L148,344 L100,340 Z',
  leftUpperArm: 'M212,118 L226,258 L202,258 L200,150 Z',
  rightUpperArm: 'M88,118 L74,258 L98,258 L100,150 Z',
  leftForearmHand: 'M226,258 L224,380 L232,415 L200,415 L202,380 L202,258 Z',
  rightForearmHand: 'M74,258 L76,380 L68,415 L100,415 L98,380 L98,258 Z',
  leftThigh: 'M152,344 L200,340 L196,465 L156,465 Z',
  rightThigh: 'M148,344 L100,340 L104,465 L144,465 Z',
  leftLowerLeg: 'M156,465 L196,465 L188,560 L164,560 Z',
  rightLowerLeg: 'M144,465 L104,465 L112,560 L136,560 Z',
  leftFoot: 'M164,560 L188,560 L202,588 L160,588 Z',
  rightFoot: 'M136,560 L112,560 L98,588 L140,588 Z',
};

const BACK_SHAPES = {
  head: FRONT_SHAPES.head,
  neck: FRONT_SHAPES.neck,
  upperBack: 'M88,118 L212,118 L204,220 L96,220 Z',
  lowerBack: 'M96,220 L204,220 L202,300 L98,300 Z',
  buttocks: 'M98,300 L202,300 L200,340 L152,344 L148,344 L100,340 Z',
  leftUpperArm: FRONT_SHAPES.leftUpperArm,
  rightUpperArm: FRONT_SHAPES.rightUpperArm,
  leftForearmHand: FRONT_SHAPES.leftForearmHand,
  rightForearmHand: FRONT_SHAPES.rightForearmHand,
  leftThigh: FRONT_SHAPES.leftThigh,
  rightThigh: FRONT_SHAPES.rightThigh,
  leftLowerLeg: FRONT_SHAPES.leftLowerLeg,
  rightLowerLeg: FRONT_SHAPES.rightLowerLeg,
  leftFoot: FRONT_SHAPES.leftFoot,
  rightFoot: FRONT_SHAPES.rightFoot,
};

// Labels are independent of which view a region is tapped from — a headache
// is a headache whether you got there via the front or back diagram, so
// there's exactly one label (and one symptom list, see SymptomPanel.jsx)
// per region regardless of which of FRONT_SHAPES/BACK_SHAPES rendered it.
export const REGION_LABELS = {
  head: 'Head & Face',
  neck: 'Neck',
  chest: 'Chest',
  abdomen: 'Abdomen',
  pelvis: 'Pelvis & Groin',
  leftUpperArm: 'Left Upper Arm',
  rightUpperArm: 'Right Upper Arm',
  leftForearmHand: 'Left Forearm & Hand',
  rightForearmHand: 'Right Forearm & Hand',
  leftThigh: 'Left Thigh',
  rightThigh: 'Right Thigh',
  leftLowerLeg: 'Left Lower Leg',
  rightLowerLeg: 'Right Lower Leg',
  leftFoot: 'Left Foot',
  rightFoot: 'Right Foot',
  upperBack: 'Upper Back',
  lowerBack: 'Lower Back',
  buttocks: 'Buttocks',
};

// Accessibility note: these SVG regions are tappable hit-targets with no native semantics,
// so each one gets role="button" + tabIndex + aria-label + Enter/Space handling below to
// keep them reachable via keyboard and announced correctly by screen readers.
const handleRegionKeyDown = (e, key, onSelect) => {
  if (e.key === 'Enter' || e.key === ' ') {
    e.preventDefault();
    onSelect(key);
  }
};

export default function BodyMap({ selected, onSelect, side, onSideToggle }) {
  const shapes = side === 'back' ? BACK_SHAPES : FRONT_SHAPES;

  return (
    <div className="flex flex-col items-center gap-3">
      {/* Side toggle */}
      <div className="flex gap-[3px] rounded-full bg-muted p-[3px]">
        {['front', 'back'].map((s) => (
          <button
            key={s}
            type="button"
            className={cn(
              'rounded-full px-4.5 py-1.5 text-xs font-medium capitalize transition-all',
              side === s
                ? 'bg-card text-foreground shadow-sm'
                : 'bg-transparent text-muted-foreground hover:text-foreground'
            )}
            onClick={() => onSideToggle(s)}
          >
            {s}
          </button>
        ))}
      </div>

      {/* SVG Body */}
      <div className="w-full max-w-[260px]">
        <svg
          viewBox="0 0 300 600"
          xmlns="http://www.w3.org/2000/svg"
          className="h-auto w-full"
        >
          <AnimatePresence mode="wait" initial={false}>
            <motion.g
              key={side}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.18, ease: [0.16, 1, 0.3, 1] }}
            >
              {Object.entries(shapes).map(([key, d]) => {
                const isSelected = selected === key;
                return (
                  <path
                    key={key}
                    d={d}
                    fill={isSelected ? 'rgba(37,99,235,0.22)' : 'rgba(148,163,184,0.10)'}
                    stroke={isSelected ? '#2563eb' : '#cbd5e1'}
                    strokeWidth={isSelected ? 1.75 : 1.25}
                    className="cursor-pointer transition-colors duration-150 hover:fill-primary/15 focus:outline-none focus-visible:stroke-primary focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary focus-visible:outline-offset-2"
                    role="button"
                    tabIndex={0}
                    aria-label={REGION_LABELS[key]}
                    aria-pressed={isSelected}
                    onClick={() => onSelect(key)}
                    onKeyDown={(e) => handleRegionKeyDown(e, key, onSelect)}
                  />
                );
              })}
            </motion.g>
          </AnimatePresence>
        </svg>
      </div>

      <p className="min-h-[18px] text-center text-xs text-muted-foreground">
        {selected ? `Selected: ${REGION_LABELS[selected]}` : 'Tap a body region'}
      </p>
    </div>
  );
}
