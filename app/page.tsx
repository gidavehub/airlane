'use client';

import { useState, useEffect, useRef } from 'react';
// We are removing framer-motion and particles, so we don't need those imports.
// We'll keep the components, as their internal logic is fine.
import { AgentDisplay } from '../components/AgentDisplay';
import { NexusBar } from '../components/NexusBar';

// ===================================================================================
// TYPE DEFINITIONS (Unchanged)
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

export type ListeningStatus = 'idle' | 'recording' | 'transcribing';

// ===================================================================================
// THE MAIN PAGE COMPONENT
// ===================================================================================
export default function HederaAIPage() {
  // --- All state management and logic remains the same ---
  const [activeResponse, setActiveResponse] = useState<AgentResponse | null>({
    id: 'initial_loading',
    status: 'PROCESSING',
    speech: 'Waking up the AI...',
    ui: { type: 'LOADING' },
    action: null,
    context: { history: [], collected_info: {}, goal: null }
  });

  const [context, setContext] = useState<ConversationContext | null>(null);
  const [inputValue, setInputValue] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [listeningStatus, setListeningStatus] = useState<ListeningStatus>('idle');
  const [generatedCode, setGeneratedCode] = useState<GeneratedCode | null>(null);

  useEffect(() => {
    handleAgentCommunication('');
  }, []);

  const handleAgentCommunication = async (prompt: string, currentContext: ConversationContext | null = context) => {
    setIsLoading(true);
    setInputValue('');
    const isEditMode = !!generatedCode;
    let apiRequestBody;
    if (!isEditMode && prompt) {
      setActiveResponse({
        id: `loading-${Date.now()}`, status: 'PROCESSING', speech: null,
        ui: { type: 'LOADING' }, action: null, context: context || { history: [], collected_info: {}, goal: 'onboard_user' }
      });
    }
    if (isEditMode) {
      const editContext = { ...currentContext!, goal: 'edit_code' };
      apiRequestBody = { prompt, context: editContext, generatedCode };
    } else {
      apiRequestBody = { prompt, context: currentContext };
    }
    try {
      const response = await fetch('/api/airlane', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(apiRequestBody),
      });
      if (!response.ok) {
        throw new Error(`API Error ${response.status}`);
      }
      const data: AgentResponse = await response.json();
      setActiveResponse(data);
      setContext(data.context);
      if (data.action?.type === 'GENERATION_COMPLETE') {
        setGeneratedCode(data.action.payload);
      }
    } catch (error) {
      console.error("Failed to communicate with agent:", error);
      setActiveResponse({
        id: 'error_state', status: 'ERROR', speech: "An error occurred.",
        ui: null, action: null, context: context || { history: [], collected_info: {}, goal: null }
      });
    } finally {
      setIsLoading(false);
    }
  };

  const createPreviewDocument = () => {
    if (!generatedCode) return '';
    return `<!DOCTYPE html><html><head><style>${generatedCode.css}</style></head><body>${generatedCode.html}<script>${generatedCode.js}</script></body></html>`;
  };

  const handleVoiceInteraction = () => {
    // Voice logic can stay, it doesn't affect layout
    console.log("Mic clicked");
  };

  // --- RENDER ---
  return (
    <>
      <SimplifiedPageStyles />
      <main className="main-container">
        {/*
          The layout-container now holds both the conversation and the preview panels.
          Its display style will change from 'flex' (centered) to 'grid' for the workspace view.
        */}
        <div className={`layout-container ${generatedCode ? 'workspace-view' : 'conversation-view'}`}>
          <div className="conversation-panel">
            {activeResponse && (
              <AgentDisplay
                key={activeResponse.id}
                response={activeResponse}
                onSubmit={handleAgentCommunication}
              />
            )}
          </div>

          {generatedCode && (
            <div className="preview-panel">
              <div className="preview-header">
                <h2>Live Preview</h2>
              </div>
              <div className="preview-content">
                <iframe
                  srcDoc={createPreviewDocument()}
                  title="Preview"
                  className="preview-iframe"
                  sandbox="allow-scripts allow-same-origin"
                />
              </div>
            </div>
          )}
        </div>

        {/* NexusBar is now a direct child of the main flex container, ensuring it's always at the bottom */}
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
// SIMPLIFIED STYLES - FOCUSED ON LAYOUT AND DEBUGGING
// ===================================================================================
const SimplifiedPageStyles = () => (
  <style>{`
    /* Basic Reset */
    * {
      box-sizing: border-box;
      margin: 0;
      padding: 0;
    }
    html, body {
      height: 100%;
      font-family: sans-serif;
      background-color: #f0f2f5; /* Simple background */
    }

    /* 1. THE MAIN CONTAINER: The foundation of the layout. */
    .main-container {
      display: flex;
      flex-direction: column; /* Stacks children vertically: content on top, input bar at bottom */
      height: 100vh; /* Takes up the full viewport height */
      width: 100%;
      overflow: hidden; /* Prevents scrollbars on the main container */
    }

    /* 2. THE CONTENT AREA: This will grow to fill available space. */
    .layout-container {
      flex-grow: 1; /* CRITICAL: This makes the container take all available space */
      display: flex; /* Using flex to center its children */
      padding: 1rem;
      overflow-y: auto; /* Allow scrolling if content is too tall */

      /* DEBUG: A light color to see its boundaries */
      background-color: rgba(200, 255, 200, 0.2);
    }

    /* 3. INPUT BAR CONTAINER: Sits at the bottom with a fixed height. */
    .nexus-bar-container {
      padding: 1rem;
      flex-shrink: 0; /* Prevents this container from shrinking */

      /* DEBUG: A light color to see its boundaries */
      background-color: rgba(200, 200, 255, 0.3);
    }


    /* --- STYLES FOR THE TWO VIEWS --- */

    /* A) CONVERSATION VIEW (Initial State) */
    .layout-container.conversation-view {
      align-items: center; /* Vertically center */
      justify-content: center; /* Horizontally center */
    }
    .conversation-view .conversation-panel {
      width: 100%;
      max-width: 42rem; /* AgentDisplay won't be too wide */
      border: 1px solid #ccc; /* DEBUG: See the panel */
      background-color: #ffffff;
      padding: 1rem;
      border-radius: 12px;
    }

    /* B) WORKSPACE VIEW (After Code Generation) */
    .layout-container.workspace-view {
      display: grid; /* Use grid for a simple two-column layout */
      grid-template-columns: 40% 1fr; /* First column is 40%, second takes the rest */
      gap: 1rem;
      align-items: stretch; /* Make children fill the height */
    }
    .workspace-view .conversation-panel {
      border: 1px solid #ccc; /* DEBUG: See the panel */
      background-color: #ffffff;
      padding: 1rem;
      border-radius: 12px;
    }
    .preview-panel {
      display: flex;
      flex-direction: column;
      border: 1px solid #ccc; /* DEBUG: See the panel */
      background-color: #ffffff;
      border-radius: 12px;
      overflow: hidden; /* Important for iframe border-radius */
    }
    .preview-header {
      padding: 1rem;
      border-bottom: 1px solid #ddd;
    }
    .preview-content {
      flex-grow: 1;
    }
    .preview-iframe {
      width: 100%;
      height: 100%;
      border: none;
    }
  `}</style>
);