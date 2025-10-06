'use client';

import { motion, AnimatePresence } from 'framer-motion';
import { useState, FormEvent, useCallback, useMemo, useRef } from 'react';
import type { Engine } from 'tsparticles-engine';
import Particles from 'react-tsparticles';
import { loadSlim } from 'tsparticles-slim';
import { IParticlesProps } from 'react-tsparticles';

// ===================================================================================
// TYPE DEFINITIONS (from page.tsx)
// ===================================================================================
interface AgentResponse {
  id: string;
  status: 'AWAITING_INPUT' | 'PROCESSING' | 'COMPLETE' | 'ERROR';
  speech: string | null;
  ui: any | null;
}

// ===================================================================================
// PARTICLE ENGINE: A singleton to manage the magic dust
// ===================================================================================
class ParticleContainer {
  static instance: ParticleContainer;
  engine: Engine | undefined;
  constructor() { if (ParticleContainer.instance) return ParticleContainer.instance; ParticleContainer.instance = this; }
  async init(engine: Engine) { if (this.engine) return; this.engine = engine; await loadSlim(engine); }
}
const particleContainer = new ParticleContainer();


// ===================================================================================
// START: CO-LOCATED UI PRIMITIVES (The Agent's "Vocabulary")
// Each primitive is a self-contained component, styled for our ethereal theme.
// ===================================================================================

const TextInput = ({ title, placeholder, emoji, buttonText = "Submit", onSubmit }: { title: string, placeholder: string, emoji?: string, buttonText?: string, onSubmit: (value: string) => void }) => {
    const [localValue, setLocalValue] = useState('');
    const handleSubmit = (e: FormEvent) => {
      e.preventDefault();
      if (localValue.trim()) onSubmit(localValue);
    };
    return (
      <div className="primitive-container">
        <h4 className="primitive-title">{emoji} {title}</h4>
        <form onSubmit={handleSubmit} className="primitive-form">
          <input
            type="text" value={localValue} onChange={(e) => setLocalValue(e.target.value)}
            placeholder={placeholder} className="primitive-input" autoFocus
          />
          <button type="submit" className="primitive-submit-button" disabled={!localValue.trim()}>
            {buttonText}
          </button>
        </form>
      </div>
    );
};

const TextAreaInput = ({ title, placeholder, emoji, buttonText = "Submit", onSubmit }: { title: string, placeholder: string, emoji?: string, buttonText?: string, onSubmit: (value: string) => void }) => {
    const [localValue, setLocalValue] = useState('');
    const handleSubmit = (e: FormEvent) => { e.preventDefault(); if (localValue.trim()) onSubmit(localValue); };
    return (
        <div className="primitive-container">
            <h4 className="primitive-title">{emoji} {title}</h4>
            <form onSubmit={handleSubmit} className="primitive-form-vertical">
                <textarea
                    value={localValue} onChange={(e) => setLocalValue(e.target.value)}
                    placeholder={placeholder} className="primitive-textarea" rows={4} autoFocus
                />
                <button type="submit" className="primitive-submit-button full-width" disabled={!localValue.trim()}>
                    {buttonText}
                </button>
            </form>
        </div>
    );
};

const ButtonGroup = ({ buttons, onSubmit }: { buttons: { text: string, payload: string }[], onSubmit: (value: string) => void }) => (
    <div className="button-group-container">
        {(buttons || []).map((button, index) => (
            <button key={index} onClick={() => onSubmit(button.payload)} className="button-group-btn">
                {button.text}
            </button>
        ))}
    </div>
);

const MultiSelect = ({ title, options, buttonText = "Confirm Selection", onSubmit }: { title: string, options: { text: string, payload: string }[], buttonText?: string, onSubmit: (value: any) => void }) => {
    const [selected, setSelected] = useState<string[]>([]);
    const toggleSelection = (payload: string) => {
        setSelected(prev => prev.includes(payload) ? prev.filter(p => p !== payload) : [...prev, payload]);
    };
    return (
        <div className="primitive-container">
            <h4 className="primitive-title">{title}</h4>
            <div className="multi-select-grid">
                {(options || []).map(option => (
                    <button
                        key={option.payload} onClick={() => toggleSelection(option.payload)}
                        className={`multi-select-option ${selected.includes(option.payload) ? 'selected' : ''}`}
                    >
                        {option.text}
                    </button>
                ))}
            </div>
            <button onClick={() => onSubmit(selected)} className="primitive-submit-button full-width" disabled={selected.length === 0}>
                {buttonText}
            </button>
        </div>
    );
};

const ColorPicker = ({ title, buttonText = "Set Colors", onSubmit }: { title: string, buttonText?: string, onSubmit: (value: any) => void }) => {
    const palette = ["#FF6B6B", "#4ECDC4", "#45B7D1", "#F7B801", "#5F4B8B", "#FAD02C", "#2E4057", "#00A896", "#F0F3F4", "#333333"];
    const [selectedColors, setSelectedColors] = useState<string[]>([]);
    const toggleColor = (color: string) => {
        setSelectedColors(prev => prev.includes(color) ? prev.filter(c => c !== color) : [...prev, color].slice(0, 3));
    };
    return (
        <div className="primitive-container">
            <h4 className="primitive-title">{title}</h4>
            <p className="primitive-subtitle">Pick up to three colors that match your brand's vibe.</p>
            <div className="color-picker-grid">
                {palette.map(color => (
                    <motion.div key={color} whileHover={{ scale: 1.1 }} whileTap={{ scale: 0.9 }} onClick={() => toggleColor(color)} className="color-swatch-wrapper">
                        <div className="color-swatch" style={{ backgroundColor: color }}>
                            {selectedColors.includes(color) &&
                                <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} className="color-swatch-check">✓</motion.div>
                            }
                        </div>
                    </motion.div>
                ))}
            </div>
             <button onClick={() => onSubmit(selectedColors)} className="primitive-submit-button full-width" disabled={selectedColors.length === 0}>
                {buttonText}
            </button>
        </div>
    );
};

const KeyValueDisplay = ({ items, title }: { title: string, items: { key: string, value: string }[] }) => (
    <div className="key-value-display">
        <h3 className="key-value-title">{title}</h3>
        <dl className="key-value-dl">
            {(items || []).map((item, index) => (
                <motion.div key={item.key} className="key-value-item" initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.3, delay: index * 0.1 }}>
                    <dt className="key-value-dt">{item.key}</dt>
                    <dd className="key-value-dd">{item.value}</dd>
                </motion.div>
            ))}
        </dl>
    </div>
);

const LoadingIndicator = ({ text = "Thinking..." }: { text?: string }) => (
    <div className="loading-indicator-container">
        <motion.div className="dots-container" variants={{ start: { transition: { staggerChildren: 0.1 } }, end: { transition: { staggerChildren: 0.1 } } }} initial="start" animate="end">
            <motion.span className="dot dot-1" variants={{ start: { y: '0%' }, end: { y: '100%' } }} transition={{ duration: 0.4, repeat: Infinity, repeatType: 'reverse', ease: 'easeInOut' }} />
            <motion.span className="dot dot-2" variants={{ start: { y: '0%' }, end: { y: '100%' } }} transition={{ duration: 0.4, repeat: Infinity, repeatType: 'reverse', ease: 'easeInOut', delay: 0.1 }} />
            <motion.span className="dot dot-3" variants={{ start: { y: '0%' }, end: { y: '100%' } }} transition={{ duration: 0.4, repeat: Infinity, repeatType: 'reverse', ease: 'easeInOut', delay: 0.2 }} />
        </motion.div>
        {text && <p className="loading-text">{text}</p>}
    </div>
);


// ===================================================================================
// THE RENDERER ENGINE: It translates the agent's thoughts into visuals
// ===================================================================================
const RenderUINode = ({ uiData, onSubmit }: { uiData: any; onSubmit: (value: any) => void; }) => {
  if (!uiData || !uiData.type) return null;
  const props = uiData.props || {};

  switch (uiData.type) {
    case 'TEXT_INPUT': return <TextInput {...props} onSubmit={onSubmit} />;
    case 'TEXT_AREA_INPUT': return <TextAreaInput {...props} onSubmit={onSubmit} />;
    case 'BUTTON_GROUP': return <ButtonGroup {...props} onSubmit={onSubmit} />;
    case 'MULTI_SELECT': return <MultiSelect {...props} onSubmit={onSubmit} />;
    case 'COLOR_PICKER': return <ColorPicker {...props} onSubmit={onSubmit} />;
    case 'KEY_VALUE_DISPLAY': return <KeyValueDisplay {...props} />;
    case 'LOADING': return <LoadingIndicator {...props} />;
    default:
      return <div className="unknown-component">Error: Unknown UI type "{uiData.type}"</div>;
  }
};


// ===================================================================================
// THE MAIN AGENT DISPLAY COMPONENT: The AI's physical form
// ===================================================================================
interface AgentDisplayProps {
  response: AgentResponse;
  onSubmit: (value: any) => void;
}

export const AgentDisplay = ({ response, onSubmit }: AgentDisplayProps) => {
  const particlesInit = useCallback(async (engine: Engine) => { await particleContainer.init(engine); }, []);
  
  const particleOptions: IParticlesProps['options'] = useMemo(() => ({
    fpsLimit: 120, particles: { number: { value: 40, density: { enable: true, value_area: 800 } }, color: { value: ["#6366f1", "#8b5cf6", "#ec4899", "#22d3ee"] }, shape: { type: "circle" }, opacity: { value: {min: 0.1, max: 0.4}, animation: { enable: true, speed: 0.5, sync: false } }, size: { value: { min: 1, max: 3 } }, move: { enable: true, speed: 1, direction: "none", random: true, straight: false, out_mode: "out" } }, interactivity: { events: { onHover: { enable: true, mode: "bubble" } }, modes: { bubble: { distance: 100, duration: 2, opacity: 1, size: 4 } } }, detectRetina: true,
  }), []);

  return (
    <>
      <AgentDisplayStyles />
      <div className="agent-display-backdrop">
        <Particles id="tsparticles" init={particlesInit} options={particleOptions} className="agent-display-particles" />
        <motion.div
          layout="position"
          initial={{ opacity: 0, scale: 0.9, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.9, y: 20 }}
          transition={{ type: 'spring', damping: 25, stiffness: 180, duration: 0.6 }}
          className="agent-display-modal"
        >
          <div className="agent-display-content">
            <AnimatePresence mode="wait">
              <motion.div
                key={response.id}
                initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                transition={{ duration: 0.4 }}
                className="agent-display-inner-content"
              >
                {response.speech && <p className="agent-speech">{response.speech}</p>}
                {response.ui && (
                  <div className="agent-ui-container">
                    <RenderUINode uiData={response.ui} onSubmit={onSubmit} />
                  </div>
                )}
              </motion.div>
            </AnimatePresence>
          </div>
        </motion.div>
      </div>
    </>
  );
};


// ===================================================================================
// STYLES: The Incantation that gives the UI its beautiful form
// ===================================================================================
const AgentDisplayStyles = () => (
    <style>{`
      /* Main Backdrop & Modal */
      .agent-display-backdrop { position: absolute; top: 0; right: 0; bottom: 0; left: 0; display: flex; align-items: center; justify-content: center; z-index: 10; padding: 1rem; }
      .agent-display-particles { position: absolute; top: 0; right: 0; bottom: 0; left: 0; z-index: -10; }
      .agent-display-modal { position: relative; width: 100%; height: 100%; display: flex; overflow: hidden; border-radius: 1.5rem; background-color: rgba(255, 255, 255, 0.7); backdrop-filter: blur(24px); -webkit-backdrop-filter: blur(24px); border: 1px solid rgba(255, 255, 255, 0.6); box-shadow: 0 0 100px -20px rgba(99, 102, 241, 0.25), 0 25px 50px -12px rgba(0, 0, 0, 0.1); }
      .agent-display-content { width: 100%; padding: 2rem; display: flex; align-items: center; justify-content: center; }
      .agent-display-inner-content { display: flex; flex-direction: column; gap: 1.5rem; width: 100%; max-width: 36rem; }
      .agent-speech { text-align: center; font-size: 1.25rem; line-height: 1.75rem; color: #1e293b; text-wrap: balance; font-weight: 500; }
      .unknown-component { padding: 1rem; background-color: #fee2e2; border: 1px solid #fca5a5; border-radius: 0.5rem; text-align: center; color: #b91c1c; font-weight: 700; }
      
      /* --- PRIMITIVE STYLES --- */
      .primitive-container { display: flex; flex-direction: column; gap: 1rem; }
      .primitive-title { font-weight: 600; color: #1e293b; font-size: 1.125rem; text-align: center; }
      .primitive-subtitle { font-size: 0.9rem; color: #475569; text-align: center; margin-top: -0.75rem; }
      .primitive-form { display: flex; gap: 0.5rem; align-items: center; }
      .primitive-form-vertical { display: flex; flex-direction: column; gap: 0.75rem; }
      .primitive-input, .primitive-textarea { flex-grow: 1; background-color: rgba(241, 245, 249, 0.8); border: 1px solid #e2e8f0; color: #334155; border-radius: 0.5rem; padding: 0.75rem 1rem; transition: all 0.2s; box-shadow: 0 1px 2px 0 rgba(0, 0, 0, 0.05); font-size: 1rem; }
      .primitive-input:focus, .primitive-textarea:focus { outline: 2px solid transparent; outline-offset: 2px; border-color: #6366f1; box-shadow: 0 0 0 3px rgba(99, 102, 241, 0.3); }
      .primitive-textarea { resize: vertical; }
      .primitive-submit-button { padding: 0.75rem 1.25rem; background-image: linear-gradient(to right, #4f46e5, #7c3aed); color: white; border-radius: 0.5rem; font-weight: 600; transition: all 0.2s; border: none; cursor: pointer; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -2px rgba(0, 0, 0, 0.1); }
      .primitive-submit-button.full-width { width: 100%; }
      .primitive-submit-button:hover { filter: brightness(1.1); }
      .primitive-submit-button:active { transform: scale(0.98); }
      .primitive-submit-button:disabled { background-image: none; background-color: #d1d5db; cursor: not-allowed; box-shadow: none; }
      
      /* Button Group */
      .button-group-container { display: flex; flex-direction: column; gap: 0.75rem; }
      .button-group-btn { flex: 1; padding: 0.875rem 1rem; border: 1px solid #cbd5e1; background-color: rgba(255, 255, 255, 0.8); color: #334155; border-radius: 0.5rem; font-weight: 600; cursor: pointer; transition: all 0.2s; box-shadow: 0 1px 2px 0 rgba(0,0,0,0.05); }
      .button-group-btn:hover { border-color: #6366f1; color: #6366f1; background-color: rgba(238, 242, 255, 0.9); transform: translateY(-2px); }
      
      /* Multi Select */
      .multi-select-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(140px, 1fr)); gap: 0.75rem; margin-bottom: 1rem; }
      .multi-select-option { padding: 0.75rem; border: 2px solid #e2e8f0; background-color: #fff; border-radius: 0.5rem; cursor: pointer; transition: all 0.2s ease-in-out; font-weight: 500; }
      .multi-select-option.selected { border-color: #6366f1; background-color: #eef2ff; color: #4338ca; font-weight: 600; transform: scale(1.03); }
      
      /* Color Picker */
      .color-picker-grid { display: grid; grid-template-columns: repeat(5, 1fr); gap: 1rem; margin-bottom: 1rem; }
      .color-swatch-wrapper { cursor: pointer; }
      .color-swatch { width: 100%; padding-bottom: 100%; border-radius: 50%; position: relative; transition: transform 0.2s; border: 3px solid transparent; box-sizing: border-box; }
      .color-swatch-wrapper:hover .color-swatch { transform: scale(1.1); }
      .color-swatch-check { position: absolute; top: 0; left: 0; width: 100%; height: 100%; display: flex; align-items: center; justify-content: center; font-size: 1.5rem; color: white; text-shadow: 0 0 5px rgba(0,0,0,0.5); }
      
      /* Key Value Display & Loading */
      .key-value-display { background: rgba(248, 250, 252, 0.8); padding: 1.5rem; border-radius: 0.75rem; border: 1px solid #e2e8f0; }
      .key-value-title { font-size: 1.25rem; font-weight: 700; color: #4f46e5; margin-bottom: 1rem; text-align: center; }
      .key-value-dl { display: flex; flex-direction: column; gap: 0.75rem; }
      .key-value-item { display: grid; grid-template-columns: 1fr 2fr; gap: 1rem; align-items: center; padding-bottom: 0.75rem; border-bottom: 1px solid #e2e8f0; }
      .key-value-item:last-child { border-bottom: none; padding-bottom: 0; }
      .key-value-dt { color: #64748b; font-weight: 500; }
      .key-value-dd { color: #1e293b; font-weight: 500; word-break: break-word; }
      .loading-indicator-container { display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 1rem; padding: 2rem; }
      .dots-container { display: flex; gap: 0.5rem; }
      .dot { display: block; width: 0.75rem; height: 0.75rem; border-radius: 9999px; }
      .dot-1 { background-color: #60a5fa; } .dot-2 { background-color: #a78bfa; } .dot-3 { background-color: #f472b6; }
      .loading-text { font-size: 1.125rem; color: #64748b; }
    `}</style>
);