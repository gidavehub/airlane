'use client';

import { motion } from 'framer-motion';
import { ListeningStatus } from '../app/page'; // Adjusted path if necessary

interface NexusBarProps {
  value: string;
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onSubmit: (e: React.FormEvent<HTMLFormElement>) => void;
  onMicClick: () => void;
  isLoading: boolean;
  listeningStatus: ListeningStatus;
}

// A simple SVG icon component for the microphone
const MicIcon = ({ isListening }: { isListening: boolean }) => (
  <svg
    width="24"
    height="24"
    viewBox="0 0 24 24"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    className={`mic-icon ${isListening ? 'listening' : ''}`}
  >
    <path
      d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"
      stroke="currentColor"
      strokeWidth="1.5"
    />
    <path
      d="M19 10v2a7 7 0 1 1-14 0v-2"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
    />
    <path d="M12 19v4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
  </svg>
);

export const NexusBar = ({
  value,
  onChange,
  onSubmit,
  onMicClick,
  isLoading,
  listeningStatus,
}: NexusBarProps) => {
  const isRecording = listeningStatus === 'recording';
  const isTranscribing = listeningStatus === 'transcribing';

  return (
    <>
      <NexusBarStyles />
      <div className="nexus-bar-wrapper">
        <motion.div
          layout
          className={`nexus-bar-container ${isLoading ? 'loading' : ''}`}
          initial={{ y: 40, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ type: 'spring', damping: 20, stiffness: 150, delay: 0.2 }}
        >
          <form onSubmit={onSubmit} className="nexus-form">
            <input
              type="text"
              value={isRecording ? "Listening..." : isTranscribing ? "Transcribing..." : value}
              onChange={onChange}
              placeholder="Ask me to design anything..."
              className="nexus-input"
              disabled={isLoading || isRecording || isTranscribing}
            />
            <button
              type="button"
              onClick={onMicClick}
              className={`mic-button ${isRecording ? 'recording' : ''}`}
              disabled={isLoading}
            >
              <MicIcon isListening={isRecording} />
            </button>
          </form>
          {isLoading && (
            <div className="loading-bar-container">
              <motion.div
                className="loading-bar"
                initial={{ x: "-100%" }}
                animate={{ x: "100%" }}
                transition={{ duration: 1.5, repeat: Infinity, ease: "linear" }}
              />
            </div>
          )}
        </motion.div>
      </div>
    </>
  );
};

const NexusBarStyles = () => (
  <style>{`
    .nexus-bar-wrapper {
      display: flex;
      justify-content: center;
      width: 100%;
    }
    .nexus-bar-container {
      position: relative;
      width: 100%;
      max-width: 48rem; /* 768px */
      background-color: rgba(255, 255, 255, 0.75);
      backdrop-filter: blur(16px);
      -webkit-backdrop-filter: blur(16px);
      border: 1px solid rgba(255, 255, 255, 0.6);
      border-radius: 9999px;
      box-shadow: 0 10px 30px -10px rgba(0, 0, 0, 0.1), 0 4px 6px -4px rgba(0, 0, 0, 0.1);
      overflow: hidden;
      transition: box-shadow 0.3s ease;
    }
    .nexus-bar-container:focus-within {
      box-shadow: 0 0 0 3px rgba(99, 102, 241, 0.4);
    }
    .nexus-form {
      display: flex;
      align-items: center;
      padding-left: 1.5rem; /* 24px */
    }
    .nexus-input {
      width: 100%;
      height: 3.5rem; /* 56px */
      border: none;
      outline: none;
      background-color: transparent;
      color: #1e293b;
      font-size: 1rem; /* 16px */
      font-weight: 500;
    }
    .nexus-input::placeholder {
      color: #94a3b8;
    }
    .nexus-input:disabled {
        cursor: not-allowed;
    }
    .mic-button {
      display: flex;
      align-items: center;
      justify-content: center;
      height: 3.5rem;
      width: 4.5rem; /* 72px */
      border: none;
      background-color: transparent;
      color: #64748b;
      cursor: pointer;
      transition: all 0.2s ease-in-out;
    }
    .mic-button:hover:not(:disabled) {
      color: #4f46e5;
    }
    .mic-button:disabled {
      color: #cbd5e1;
      cursor: not-allowed;
    }
    .mic-button.recording .mic-icon {
      color: #ef4444;
      animation: pulse-mic 1.5s infinite ease-in-out;
    }

    @keyframes pulse-mic {
      0%, 100% { transform: scale(1); }
      50% { transform: scale(1.1); }
    }
    
    .loading-bar-container {
      position: absolute;
      bottom: 0;
      left: 0;
      width: 100%;
      height: 2px;
      overflow: hidden;
    }
    .loading-bar {
      position: absolute;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      background-image: linear-gradient(to right, transparent, #8b5cf6, transparent);
    }
  `}</style>
);