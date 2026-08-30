import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '@/lib/utils';

const regions = {
  head: { label: 'Head & Neck', d: 'M 100 20 C 75 20 58 38 58 60 C 58 85 75 102 100 105 C 125 102 142 85 142 60 C 142 38 125 20 100 20 Z M 80 105 C 80 118 90 125 100 125 C 110 125 120 118 120 105 Z' },
  chest: { label: 'Chest', d: 'M 65 128 L 135 128 L 148 200 L 52 200 Z' },
  abdomen: { label: 'Abdomen', d: 'M 52 202 L 148 202 L 142 265 L 58 265 Z' },
  leftArm: { label: 'Left Arm', d: 'M 148 130 L 168 128 L 188 230 L 162 232 Z' },
  rightArm: { label: 'Right Arm', d: 'M 52 130 L 32 128 L 12 230 L 38 232 Z' },
  leftLeg: { label: 'Left Leg', d: 'M 100 267 L 140 267 L 145 390 L 105 390 Z' },
  rightLeg: { label: 'Right Leg', d: 'M 100 267 L 60 267 L 55 390 L 95 390 Z' },
  back: { label: 'Back', d: null, isBack: true },
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
      <div className="w-40">
        <svg
          viewBox="0 0 200 420"
          xmlns="http://www.w3.org/2000/svg"
          className="h-auto w-full"
        >
          {/* Body outline */}
          <ellipse cx="100" cy="62" rx="42" ry="43" fill="none" stroke="#cbd5e1" strokeWidth="1.5" />
          <line x1="80" y1="104" x2="65" y2="128" stroke="#cbd5e1" strokeWidth="1.5" />
          <line x1="120" y1="104" x2="135" y2="128" stroke="#cbd5e1" strokeWidth="1.5" />
          <rect x="52" y="128" width="96" height="140" rx="8" fill="none" stroke="#cbd5e1" strokeWidth="1.5" />
          <line x1="52" y1="128" x2="12" y2="232" stroke="#cbd5e1" strokeWidth="1.5" />
          <line x1="148" y1="128" x2="188" y2="232" stroke="#cbd5e1" strokeWidth="1.5" />
          <line x1="52" y1="268" x2="55" y2="390" stroke="#cbd5e1" strokeWidth="1.5" />
          <line x1="148" y1="268" x2="145" y2="390" stroke="#cbd5e1" strokeWidth="1.5" />
          <line x1="80" y1="268" x2="78" y2="390" stroke="#cbd5e1" strokeWidth="1.5" />
          <line x1="120" y1="268" x2="122" y2="390" stroke="#cbd5e1" strokeWidth="1.5" />

          <AnimatePresence mode="wait" initial={false}>
            <motion.g
              key={side}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.18, ease: [0.16, 1, 0.3, 1] }}
            >
              {/* Clickable regions */}
              {Object.entries(regions).map(([key, region]) => {
                if (region.isBack) return null;
                if (side === 'back' && key !== 'back') return null;

                const isSelected = selected === key;
                return (
                  <path
                    key={key}
                    d={region.d}
                    fill={isSelected ? 'rgba(59,130,246,0.25)' : 'rgba(148,163,184,0.1)'}
                    stroke={isSelected ? '#3b82f6' : 'transparent'}
                    strokeWidth="2"
                    className="cursor-pointer transition-colors duration-200 hover:fill-primary/15 focus:outline-none focus-visible:stroke-primary focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary focus-visible:outline-offset-2"
                    role="button"
                    tabIndex={0}
                    aria-label={region.label}
                    aria-pressed={isSelected}
                    onClick={() => onSelect(key)}
                    onKeyDown={(e) => handleRegionKeyDown(e, key, onSelect)}
                  />
                );
              })}

              {/* Back view */}
              {side === 'back' && (
                <path
                  d="M 65 128 L 135 128 L 148 265 L 52 265 Z"
                  fill={selected === 'back' ? 'rgba(59,130,246,0.25)' : 'rgba(148,163,184,0.1)'}
                  stroke={selected === 'back' ? '#3b82f6' : 'transparent'}
                  strokeWidth="2"
                  className="cursor-pointer transition-colors duration-200 hover:fill-primary/15 focus:outline-none focus-visible:stroke-primary focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary focus-visible:outline-offset-2"
                  role="button"
                  tabIndex={0}
                  aria-label={regions.back.label}
                  aria-pressed={selected === 'back'}
                  onClick={() => onSelect('back')}
                  onKeyDown={(e) => handleRegionKeyDown(e, 'back', onSelect)}
                />
              )}

              {/* Region labels */}
              {side === 'front' && (
                <>
                  <text aria-hidden="true" x="100" y="65" textAnchor="middle" fontSize="8" fill={selected === 'head' ? '#3b82f6' : '#94a3b8'} className="cursor-pointer select-none font-sans" onClick={() => onSelect('head')}>Head</text>
                  <text aria-hidden="true" x="100" y="162" textAnchor="middle" fontSize="8" fill={selected === 'chest' ? '#3b82f6' : '#94a3b8'} className="cursor-pointer select-none font-sans" onClick={() => onSelect('chest')}>Chest</text>
                  <text aria-hidden="true" x="100" y="232" textAnchor="middle" fontSize="8" fill={selected === 'abdomen' ? '#3b82f6' : '#94a3b8'} className="cursor-pointer select-none font-sans" onClick={() => onSelect('abdomen')}>Abdomen</text>
                  <text aria-hidden="true" x="170" y="182" textAnchor="middle" fontSize="7" fill={selected === 'leftArm' ? '#3b82f6' : '#94a3b8'} className="cursor-pointer select-none font-sans" onClick={() => onSelect('leftArm')}>Arm</text>
                  <text aria-hidden="true" x="30" y="182" textAnchor="middle" fontSize="7" fill={selected === 'rightArm' ? '#3b82f6' : '#94a3b8'} className="cursor-pointer select-none font-sans" onClick={() => onSelect('rightArm')}>Arm</text>
                  <text aria-hidden="true" x="122" y="330" textAnchor="middle" fontSize="7" fill={selected === 'leftLeg' ? '#3b82f6' : '#94a3b8'} className="cursor-pointer select-none font-sans" onClick={() => onSelect('leftLeg')}>Leg</text>
                  <text aria-hidden="true" x="78" y="330" textAnchor="middle" fontSize="7" fill={selected === 'rightLeg' ? '#3b82f6' : '#94a3b8'} className="cursor-pointer select-none font-sans" onClick={() => onSelect('rightLeg')}>Leg</text>
                </>
              )}
              {side === 'back' && (
                <text aria-hidden="true" x="100" y="196" textAnchor="middle" fontSize="8" fill={selected === 'back' ? '#3b82f6' : '#94a3b8'} className="cursor-pointer select-none font-sans" onClick={() => onSelect('back')}>Back</text>
              )}
            </motion.g>
          </AnimatePresence>
        </svg>
      </div>

      <p className="min-h-[18px] text-center text-xs text-muted-foreground">
        {selected ? `Selected: ${regions[selected]?.label || 'Back'}` : 'Tap a body region'}
      </p>
    </div>
  );
}

export { regions };
