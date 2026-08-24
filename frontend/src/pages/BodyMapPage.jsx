import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Activity } from 'lucide-react';
import BodyMap from '../components/BodyMap/BodyMap';
import SymptomPanel from '../components/BodyMap/SymptomPanel';
import './BodyMapPage.css';

export default function BodyMapPage() {
  const navigate = useNavigate();
  const [selected, setSelected] = useState(null);
  const [side, setSide] = useState('front');

  const handleSelect = (region) => {
    setSelected(region === selected ? null : region);
  };

  const handleSideToggle = (s) => {
    setSide(s);
    setSelected(null);
  };

  return (
    <div className="bmp-root">
      {/* Header */}
      <div className="bmp-header">
        <button className="bmp-back" onClick={() => navigate('/dashboard')}>
          <ArrowLeft size={18} />
        </button>
        <div className="bmp-header-center">
          <div className="bmp-header-icon"><Activity size={16} /></div>
          <div>
            <p className="bmp-header-title">Body Map</p>
            <p className="bmp-header-sub">Tap where it hurts</p>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="bmp-content">
        {/* Left — body map */}
        <div className="bmp-left">
          <BodyMap
            selected={selected}
            onSelect={handleSelect}
            side={side}
            onSideToggle={handleSideToggle}
          />
        </div>

        {/* Right — symptom panel */}
        <div className={`bmp-right ${selected ? 'visible' : ''}`}>
          {selected ? (
            <SymptomPanel
              region={selected}
              onClose={() => setSelected(null)}
            />
          ) : (
            <div className="bmp-placeholder">
              <div className="bmp-placeholder-icon">👆</div>
              <p>Select a body region to see related symptoms</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}