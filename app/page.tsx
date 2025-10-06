'use client';

// FIX: Ensured all necessary React hooks are imported. This resolves the error.
import { useState, useEffect, useRef } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
// These imports assume your components are in a `components` directory.
import { AgentDisplay } from '../components/AgentDisplay'; 
import { NexusBar } from '../components/NexusBar'; 

// ===================================================================================
// TYPE DEFINITIONS: The language our app speaks
// ===================================================================================
interface AgentResponse {
  id: string;
  status: 'AWAITING_INPUT' | 'PROCESSING' | 'COMPLETE' | 'ERROR';
  speech: string | null;
  ui: any | null; 
  action: { type: string; payload?: any } | null;
  context: ConversationContext;
}

interface ConversationContext {
  history: [string, string][];
  collected_info: { [key: string]: any };
  goal: string | null;
}

interface GeneratedCode {
  html: string;
  css: string;
  js: string;
}

// This type is defined here and used by both this page and your NexusBar component.
export type ListeningStatus = 'idle' | 'recording' | 'transcribing';

// ===================================================================================
// THE MAIN PAGE: Our Stage for the Magic
// ===================================================================================
export default function HederaAIPage() {
  // --- STATE MANAGEMENT: The AI's Memory and Mood ---
  const [activeResponse, setActiveResponse] = useState<AgentResponse | null>(null);
  const [context, setContext] = useState<ConversationContext | null>(null); // FIX: Corrected typo 'useState'
  const [inputValue, setInputValue] = useState('');
  const [isLoading, setIsLoading] = useState(true); 
  const [listeningStatus, setListeningStatus] = useState<ListeningStatus>('idle');
  const [generatedCode, setGeneratedCode] = useState<GeneratedCode | null>(null);

  // --- INITIALIZATION ---
  useEffect(() => {
    handleAgentCommunication('');
  }, []);

  // --- CORE LOGIC: Communicating with the Agent's Brain (with your requested changes) ---
  const handleAgentCommunication = async (prompt: string, currentContext: ConversationContext | null = context) => {
    setIsLoading(true);
    setInputValue('');

    const isEditMode = !!generatedCode;
    let apiRequestBody;
    
    if (isEditMode) {
      const editContext = { ...currentContext!, goal: 'edit_code' };
      apiRequestBody = { prompt, context: editContext, generatedCode };
    } else {
      apiRequestBody = { prompt, context: currentContext };
      setActiveResponse({
          id: `loading-${Date.now()}`, status: 'PROCESSING', speech: null,
          ui: { type: 'LOADING' }, action: null, context: context || { history: [], collected_info: {}, goal: 'onboard_user' }
      });
    }

    try {
      const response = await fetch('/api/airlane', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(apiRequestBody),
      });

      if (!response.ok) throw new Error(`API Error: ${response.statusText}`);

      const data: AgentResponse = await response.json();
      setActiveResponse(data);
      setContext(data.context);

      if (data.action?.type === 'GENERATION_COMPLETE') {
        setGeneratedCode(data.action.payload);
      }

    } catch (error) {
      console.error("Failed to communicate with agent:", error);
      setActiveResponse({
        id: 'error_state', status: 'ERROR', speech: "My apologies, I've encountered a connection issue. Please try again.",
        ui: null, action: null, context: context || { history: [], collected_info: {}, goal: null }
      });
    } finally {
      setIsLoading(false);
    }
  };
  
  // --- UI HELPERS ---
  const createPreviewDocument = () => {
    if (!generatedCode) return '';
    return `<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"><title>Preview</title><style>${generatedCode.css}</style></head><body>${generatedCode.html}<script>${generatedCode.js}</script></body></html>`;
  };

  // --- VOICE INPUT LOGIC ---
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const handleVoiceInteraction = async () => {
    if (listeningStatus === 'recording') {
      if (mediaRecorderRef.current && mediaRecorderRef.current.state === "recording") {
        mediaRecorderRef.current.stop();
      }
    } else {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        mediaRecorderRef.current = new MediaRecorder(stream, { mimeType: 'audio/webm' });
        audioChunksRef.current = [];
        mediaRecorderRef.current.ondataavailable = (event) => { audioChunksRef.current.push(event.data); };
        mediaRecorderRef.current.onstop = async () => {
          setListeningStatus('transcribing');
          const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
          const formData = new FormData();
          formData.append('file', audioBlob, 'recording.webm');
          const response = await fetch('/api/transcribe', { method: 'POST', body: formData });
          const result = await response.json();
          setListeningStatus('idle');
          if (response.ok && result.text) {
            handleAgentCommunication(result.text);
          } else {
            console.error('Transcription failed:', result.error);
          }
        };
        mediaRecorderRef.current.start();
        setListeningStatus('recording');
      } catch (err) {
        console.error("Error accessing microphone:", err);
        setListeningStatus('idle');
      }
    }
  };
  
  return (
    <>
      <PageStyles />
      <main className="main-container">
        <MagicalBackground />
        <div className={`layout-container ${generatedCode ? 'workspace-view' : 'conversation-view'}`}>
            <motion.div layout className="conversation-panel">
                <AnimatePresence mode="wait">
                    {activeResponse && (
                        <AgentDisplay
                            key={activeResponse.id}
                            response={activeResponse}
                            onSubmit={handleAgentCommunication}
                        />
                    )}
                </AnimatePresence>
            </motion.div>
            <AnimatePresence>
            {generatedCode && (
                <motion.div 
                    className="preview-panel"
                    initial={{ opacity: 0, x: 50 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: 50 }}
                    transition={{ duration: 0.5, ease: 'easeInOut' }}
                >
                    <div className="preview-header"><h2>Live Preview</h2></div>
                    <div className="preview-content">
                         <iframe 
                            srcDoc={createPreviewDocument()} 
                            title="Preview" 
                            className="preview-iframe" 
                            sandbox="allow-scripts allow-same-origin"
                         />
                    </div>
                </motion.div>
            )}
            </AnimatePresence>
        </div>
        <div className="nexus-bar-container">
            <NexusBar
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              onSubmit={(e) => { e.preventDefault(); if (inputValue.trim()) handleAgentCommunication(inputValue); }}
              onMicClick={handleVoiceInteraction}
              isLoading={isLoading}
              listeningStatus={listeningStatus}
            />
        </div>
      </main>
    </>
  );
}

// ===================================================================================
// STYLES: The Spellbook for our Magical UI
// ===================================================================================
const MagicalBackground = () => (
  <div className="magical-background-container">
    <div className="magical-background-shape-1"></div>
    <div className="magical-background-shape-2"></div>
  </div>
);

const PageStyles = () => (
  <style>{`
    @keyframes pulse-slow {
      0%, 100% { opacity: 0.6; transform: scale(1); }
      50% { opacity: 0.8; transform: scale(1.05); }
    }
    .main-container {
      display: flex; flex-direction: column; height: 100vh; width: 100%;
      color: #1e293b; overflow: hidden; position: relative;
    }
    .magical-background-container {
      position: absolute; top: 0; right: 0; bottom: 0; left: 0;
      z-index: -20; overflow: hidden; background-color: #f8fafc;
    }
    .magical-background-shape-1 {
      position: absolute; top: -20vh; left: -20vw; width: 70vw; height: 70vh;
      background-image: linear-gradient(to bottom right, #cffafe, #dbeafe);
      border-radius: 9999px; filter: blur(64px); opacity: 0.6;
      animation: pulse-slow 20s cubic-bezier(0.4, 0, 0.6, 1) infinite;
    }
    .magical-background-shape-2 {
      position: absolute; bottom: -20vh; right: -20vw; width: 70vw; height: 70vh;
      background-image: linear-gradient(to bottom right, #f3e8ff, #fbcfe8);
      border-radius: 9999px; filter: blur(64px); opacity: 0.5;
      animation: pulse-slow 20s cubic-bezier(0.4, 0, 0.6, 1) infinite; animation-delay: -7s;
    }
    .layout-container {
      flex-grow: 1; display: flex;
      padding: 1rem;
      padding-bottom: 8rem; /* Space for the NexusBar */
      transition: all 0.7s cubic-bezier(0.65, 0, 0.35, 1);
    }
    .layout-container.conversation-view {
      align-items: center; justify-content: center;
    }
    .conversation-view .conversation-panel {
      width: 100%;
      max-width: 42rem;
    }
    .layout-container.workspace-view {
      align-items: stretch; justify-content: flex-start; gap: 1rem;
    }
    .workspace-view .conversation-panel {
      width: 40%;
      min-width: 450px;
    }
    .conversation-panel {
      position: relative;
      display: flex; align-items: center; justify-content: center;
    }
    .preview-panel {
      flex-grow: 1; display: flex; flex-direction: column;
      background-color: rgba(255, 255, 255, 0.5);
      border-radius: 1.5rem;
      backdrop-filter: blur(12px);
      -webkit-backdrop-filter: blur(12px);
      border: 1px solid rgba(255, 255, 255, 0.6);
      box-shadow: 0 10px 30px -10px rgba(0, 0, 0, 0.1);
    }
    .preview-header {
      padding: 1rem 1.5rem; border-bottom: 1px solid #e2e8f0;
    }
    .preview-header h2 { font-size: 1.25rem; font-weight: 600; }
    .preview-content {
      flex-grow: 1; padding: 0.5rem;
    }
    .preview-iframe {
      width: 100%; height: 100%; border: none; background: white;
      border-radius: 1.25rem;
    }
    .nexus-bar-container {
      position: absolute; bottom: 0; left: 0; right: 0;
      padding: 1.5rem 1rem; z-index: 20;
    }
  `}</style>
);