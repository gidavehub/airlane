// This file centralizes the core data structures for agent communication.

/**
 * Defines the structure of a response sent from any agent to the UI.
 */
export interface AgentResponse {
  id: string;
  status: 'AWAITING_INPUT' | 'PROCESSING' | 'COMPLETE' | 'ERROR';
  speech: string | null;
  ui: any | null; // Can be any of the UI primitive objects
  action: { type: string; payload?: any } | null;
  context: ConversationContext;
}

/**
 * Represents the complete state of the conversation.
 * This is the "baton" passed between agent turns.
 */
export interface ConversationContext {
  history: [string, string][]; // [speaker, message] tuples
  collected_info: { [key: string]: any };
  goal: string | null;
  // This state is specific to the onboarding agent, making it optional
  onboarding_state?: 'GREETING' | 'CORE_INFO' | 'DEEP_DIVE' | 'BRANDING' | 'FINALIZING';
}