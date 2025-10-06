import { GoogleGenerativeAI } from '@google/generative-ai';

// ===================================================================================
// TYPE DEFINITIONS
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
  onboarding_state: 'GREETING' | 'CORE_INFO' | 'DEEP_DIVE' | 'BRANDING' | 'FINALIZING';
}

// ===================================================================================
// GEMINI INITIALIZATION
// ===================================================================================
// Log the attempt to read the API key
console.log('[Gemini Init] Attempting to initialize GoogleGenerativeAI...');
if (!process.env.GEMINI_API_KEY) {
  // Log a critical failure if the key is missing
  console.error("[Gemini Init] ❌ CRITICAL ERROR: GEMINI_API_KEY is not set in environment variables. The application cannot proceed.");
  throw new Error("CRITICAL: GEMINI_API_KEY is not set in environment variables.");
}
// Log successful key retrieval and initialization
console.log('[Gemini Init] ✅ GEMINI_API_KEY found. Initializing AI model.');
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
const geminiModel = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
console.log('[Gemini Init] ✅ Gemini Pro model ("gemini-1.5-flash") initialized successfully.');


// ===================================================================================
// THE ONBOARDING AGENT (UPGRADED)
// ===================================================================================
export class OnboardingAgent {
  public async execute(prompt: string, context: ConversationContext | null): Promise<AgentResponse> {
    const executionId = `exec-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
    console.log(`\n\n======================================================================`);
    console.log(`[OnboardingAgent::execute][${executionId}] ==> Starting new execution.`);
    console.log(`[OnboardingAgent::execute][${executionId}] Received prompt: "${prompt}"`);
    console.log(`[OnboardingAgent::execute][${executionId}] Received context: ${context ? 'Exists' : 'null'}`);
    if(context) {
        console.debug(`[OnboardingAgent::execute][${executionId}] Full incoming context:`, JSON.stringify(context, null, 2));
    }


    // --- Turn 0: The First Greeting ---
    if (!context) {
      console.log(`[OnboardingAgent::execute][${executionId}] Context is null. This is Turn 0. Initiating a new conversation.`);
      return this.initiateConversation(executionId);
    }

    // --- Subsequent Turns: The Conversational Loop ---
    try {
      console.log(`[OnboardingAgent::execute][${executionId}] Starting subsequent turn logic. Current state: ${context.onboarding_state}`);
      
      const updatedHistory: [string, string][] = [...context.history, ['user', prompt]];
      console.log(`[OnboardingAgent::execute][${executionId}] History updated with new user prompt. History length is now ${updatedHistory.length}.`);

      const systemPrompt = this.createSystemPrompt(updatedHistory, context.collected_info, context.onboarding_state, executionId);
      
      console.log(`[OnboardingAgent::execute][${executionId}] [API_CALL_START] Calling Gemini model...`);
      const result = await geminiModel.generateContent(systemPrompt);
      const responseText = result.response.text();
      console.log(`[OnboardingAgent::execute][${executionId}] [API_CALL_END] Received response from Gemini.`);
      console.debug(`[OnboardingAgent::execute][${executionId}] Raw response text from Gemini:\n---\n${responseText}\n---`);

      const llmResponse = this.parseLlmResponse(responseText, executionId);
      console.log(`[OnboardingAgent::execute][${executionId}] Successfully parsed LLM response.`);
      console.debug(`[OnboardingAgent::execute][${executionId}] Parsed LLM response object:`, JSON.stringify(llmResponse, null, 2));

      const updatedContext: ConversationContext = {
        ...context,
        history: [...updatedHistory, ['agent', llmResponse.speech]],
        collected_info: { ...context.collected_info, ...llmResponse.updated_data },
        onboarding_state: llmResponse.next_state,
      };
      console.log(`[OnboardingAgent::execute][${executionId}] New context created. State transition: ${context.onboarding_state} -> ${updatedContext.onboarding_state}.`);
      console.debug(`[OnboardingAgent::execute][${executionId}] Full updated context:`, JSON.stringify(updatedContext, null, 2));


      if (llmResponse.next_state === 'FINALIZING') {
        console.log(`[OnboardingAgent::execute][${executionId}] LLM transitioned to FINALIZING state. Generating completion response.`);
        return this.generateCompletionResponse(updatedContext, executionId);
      }

      const agentResponse: AgentResponse = {
        id: `response-${Date.now()}`,
        status: 'AWAITING_INPUT',
        speech: llmResponse.speech,
        ui: llmResponse.ui,
        action: { type: 'REQUEST_USER_INPUT' },
        context: updatedContext,
      };

      console.log(`[OnboardingAgent::execute][${executionId}] <== Returning standard 'AWAITING_INPUT' response.`);
      console.log(`======================================================================\n`);
      return agentResponse;

    } catch (error) {
      console.error(`[OnboardingAgent::execute][${executionId}] ❌ CRITICAL ERROR during conversational loop:`, error);
      const errorResponse: AgentResponse = {
        id: `error-${Date.now()}`,
        status: 'AWAITING_INPUT', // Set to AWAITING_INPUT to allow user to retry
        speech: "My apologies, I seem to have lost my train of thought. Could you please repeat that or try rephrasing?",
        ui: null,
        action: { type: 'REQUEST_USER_INPUT' },
        context, // Return the last valid context
      };
      console.log(`[OnboardingAgent::execute][${executionId}] <== Returning error recovery response to user.`);
      console.log(`======================================================================\n`);
      return errorResponse;
    }
  }

  private initiateConversation(executionId: string): AgentResponse {
    console.log(`[OnboardingAgent::initiateConversation][${executionId}] ==> Generating initial greeting and context.`);
    const welcomeSpeech = "Hello! I'm your personal AI web designer and creative partner. I'm so excited to learn about your project! To start, what is the name of your business or project?";
    
    const initialContext: ConversationContext = {
      history: [['agent', welcomeSpeech]],
      collected_info: {},
      goal: 'onboard_user',
      onboarding_state: 'GREETING',
    };
    console.log(`[OnboardingAgent::initiateConversation][${executionId}] Created initial context.`);
    console.debug(`[OnboardingAgent::initiateConversation][${executionId}] Initial context object:`, JSON.stringify(initialContext, null, 2));

    const initialResponse: AgentResponse = {
      id: `response-init-${Date.now()}`,
      status: 'AWAITING_INPUT',
      speech: welcomeSpeech,
      ui: {
        type: 'TEXT_INPUT',
        props: {
          title: 'Your Business Name',
          placeholder: 'e.g., "Galaxy Brew Coffee"',
          emoji: '🚀',
          buttonText: 'Continue',
        },
      },
      action: { type: 'REQUEST_USER_INPUT' },
      context: initialContext,
    };

    console.log(`[OnboardingAgent::initiateConversation][${executionId}] <== Returning constructed initial AgentResponse.`);
    return initialResponse;
  }

  private createSystemPrompt(history: [string, string][], collectedData: any, currentState: string, executionId: string): string {
    console.log(`[OnboardingAgent::createSystemPrompt][${executionId}] ==> Constructing system prompt.`);
    console.log(`[OnboardingAgent::createSystemPrompt][${executionId}] State: ${currentState}, Data Keys Collected: ${Object.keys(collectedData).join(', ') || 'None'}, History Length: ${history.length}`);
    
    // **PROMPT UPDATED BASED ON USER FEEDBACK**
    const prompt = `
      You are an exceptionally friendly, insightful, and efficient AI web designer. Your primary goal is to have a natural, human-like conversation to understand the user's business. You are a creative partner helping them bring their vision to life, but you are also respectful of their time.

      **YOUR CORE DIRECTIVES:**
      1.  **IMMEDIATELY OBEY USER COMMANDS TO PROCEED:** This is your absolute highest priority rule. If the user indicates they are finished with questions and want to move on (e.g., "That's enough," "Use what you have," "Just create the page now," "You have all the info"), you MUST stop asking questions immediately. Do not ask for confirmation. Your ONLY action should be to set the 'next_state' to 'FINALIZING' and provide a brief confirmation message like "Great, I have everything I need. Let's get started!". This is non-negotiable.

      2.  **BE A CURIOUS PARTNER, NOT AN INTERROGATOR:** Be friendly and dig deeper, but be highly respectful of the user's time. If a user's answer is short, you may ask a *single* gentle, open-ended follow-up question. If they still don't provide much detail or say they have nothing more to add, accept it gracefully and move on. The goal is a rich but efficient conversation, not an endless interrogation. A good conversation should feel like it's progressing.

      3.  **ONE MAIN QUESTION AT A TIME:** Keep the conversation focused. Never overwhelm the user by asking for multiple things at once.

      4.  **BE A HELPFUL GUIDE:** If a user seems unsure or says "I don't know," be proactive by offering some inspiring suggestions or ideas. Use the 'BUTTON_GROUP' UI for this. If they reject your suggestions or still seem unsure, that is perfectly okay! Acknowledge their response and gently move on to the next logical topic without pressure. Do not get stuck.

      5.  **EMBRACE PERSONALITY:** Use a warm, encouraging, and slightly informal tone. Use emojis where appropriate to make the conversation feel friendly and engaging. 

      **CONVERSATIONAL FLOW & STATE OBJECTIVES:**
      Your goal is to complete the objective for each state before moving on. Aim for a concise flow; a typical successful onboarding might require about 10 core questions in total.
      -   **GREETING:** (Objective: Get the project name) -> Process their first response and transition to CORE_INFO.
      -   **CORE_INFO:** (Objective: Understand the 'What' and 'Who') -> Gather business description, target audience, and key features. Ask brief follow-ups ONLY if necessary.
      -   **DEEP_DIVE:** (Objective: Discover the 'Why') -> Ask about the business's unique story and values. Be sensitive to cues that the user has shared all they want to.
      -   **BRANDING:** (Objective: Define the 'Look and Feel') -> Discuss visual identity. Guide them with suggestions if they are unsure.
      -   **FINALIZING:** (Transition state) -> You will transition to this state either when you have naturally collected enough information OR when the user explicitly tells you to stop and proceed (see Core Directive #1).

      **AVAILABLE UI COMPONENTS (DO NOT CHANGE THIS FORMATTING):**
      -   '{"type": "TEXT_INPUT", "props": { ... }}'
      -   '{"type": "TEXT_AREA_INPUT", "props": { ... }}'
      -   '{"type": "BUTTON_GROUP", "props": { "buttons": [{ "text": "...", "payload": "..." }] }}'
      -   '{"type": "MULTI_SELECT", "props": { "title": "...", "options": [{ "text": "...", "payload": "..." }] }}'
      -   '{"type": "COLOR_PICKER", "props": { "title": "..." }}'

      **CURRENT CONTEXT:**
      -   Current State: ${currentState}
      -   Data Collected So Far: ${JSON.stringify(collectedData, null, 2)}
      -   Recent Conversation History: ${JSON.stringify(history.slice(-6))}

      **YOUR TASK:**
      1.  **First, check for a stop command.** Analyze the user's latest message. If it matches the criteria in Core Directive #1, your ONLY job is to transition to 'FINALIZING'.
      2.  If not a stop command, extract any new information from the message.
      3.  Based on the current state's objective, decide if you need to ask the next logical question or a brief follow-up. Remember to keep the pace moving.
      4.  Formulate your friendly, personal, and concise 'speech'.
      5.  Choose the perfect 'ui' component to make it easy for the user to respond.
      6.  Determine the 'next_state'. Stay in the current state for follow-up questions. Change state only when introducing a new major topic.

      **OUTPUT FORMAT (DO NOT CHANGE THIS FORMATTING):**
      You MUST respond with ONLY a single, valid JSON object with four keys: "speech", "ui", "updated_data" (an object with any NEW info extracted), and "next_state".

      EXAMPLE of a good, concise follow-up:
      {
        "speech": "Galaxy Brew Coffee - what a cool name! 🚀 To help me understand your vision, could you tell me a little more about what makes your coffee special?",
        "ui": { "type": "TEXT_AREA_INPUT", "props": { "title": "About Your Coffee", "placeholder": "e.g., We source single-origin beans and use a unique cold-brewing process...", "emoji": "✨" } },
        "updated_data": { "business_name": "Galaxy Brew Coffee" },
        "next_state": "CORE_INFO"
      }
    `;
    console.debug(`[OnboardingAgent::createSystemPrompt][${executionId}] Full system prompt being generated:\n---\n${prompt}\n---`);
    console.log(`[OnboardingAgent::createSystemPrompt][${executionId}] <== System prompt construction complete.`);
    return prompt;
  }

  private parseLlmResponse(responseText: string, executionId: string): { speech: string; ui: any; updated_data: any; next_state: any; } {
      console.log(`[OnboardingAgent::parseLlmResponse][${executionId}] ==> Attempting to parse LLM response text.`);
      try {
          // Clean up potential markdown code blocks around the JSON
          const cleanJson = responseText.replace(/^```json\n?/, '').replace(/\n?```$/, '');
          console.log(`[OnboardingAgent::parseLlmResponse][${executionId}] Cleaned potential markdown from JSON string.`);
          const parsedJson = JSON.parse(cleanJson);
          console.log(`[OnboardingAgent::parseLlmResponse][${executionId}] <== Successfully parsed JSON.`);
          return parsedJson;
      } catch (error) {
          console.error(`[OnboardingAgent::parseLlmResponse][${executionId}] ❌ FAILED to parse LLM JSON response. Raw text was:`, responseText, 'Error:', error);
          // This error will be caught by the main execute loop's try/catch block
          throw new Error("Invalid JSON response from language model.");
      }
  }

  private generateCompletionResponse(context: ConversationContext, executionId: string): AgentResponse {
    console.log(`[OnboardingAgent::generateCompletionResponse][${executionId}] ==> Generating completion response.`);
    const finalSpeech = `Amazing! Thank you for sharing all of that. I feel like I really get what you're building, and I have a clear vision for your project now. I'll start designing and building your new landing page right away. This should just take a moment...`;
    
    const finalResponse: AgentResponse = {
      id: `response-complete-${Date.now()}`,
      status: 'PROCESSING',
      speech: finalSpeech,
      ui: {
        type: 'KEY_VALUE_DISPLAY', // Show a summary while the next agent works
        props: {
            title: "Brief Complete!",
            items: [
              { key: "Project Name", value: context.collected_info.business_name || "N/A" },
              { key: "Status", value: "Generating your website..." },
            ]
          }
      },
      action: { type: 'DELEGATE' },
      context: {
        ...context,
        history: [...context.history, ['agent', finalSpeech]],
        goal: 'generate_landing_page', // This signals the router to switch agents
        onboarding_state: 'FINALIZING',
      },
    };
    console.log(`[OnboardingAgent::generateCompletionResponse][${executionId}] <== Constructed completion response object. Goal changed to 'generate_landing_page'.`);
    console.debug(`[OnboardingAgent::generateCompletionResponse][${executionId}] Completion response:`, JSON.stringify(finalResponse, null, 2));

    return finalResponse;
  }
}