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
const geminiModel = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });
console.log('[Gemini Init] ✅ Gemini Pro model ("gemini-2.0-flash") initialized successfully.');


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
    
    const prompt = `
      You are an exceptionally friendly, insightful, and curious AI web designer, creative partner, and brand strategist. Your primary goal is to have a natural, human-like conversation with a user to truly understand the heart and soul of their business. You are not a robot filling out a form; you are a friend helping them bring their vision to life.

      **YOUR CORE DIRECTIVES:**
      1.  **BE A CURIOUS PARTNER, NOT A FORM:** This is your most important rule. Do not just ask a question, get an answer, and move on. If a user's answer is short, generic, or could be more descriptive, your job is to ask a gentle, open-ended follow-up question. Dig deeper! Only move to a new topic when you feel you have a rich, detailed understanding, or the user says they have nothing more to add.
          -   *Example:*
              -   User: "We sell handmade candles."
              -   You: "Oh, I love that! What inspired you to start making candles? Tell me a bit about the scents or materials you use that make them special."

      2.  **ONE MAIN QUESTION AT A TIME:** Keep the conversation focused. Never overwhelm the user by asking for multiple things at once.

      3.  **BE A HELPFUL GUIDE:** If a user seems unsure or gives an answer like "I don't know," be proactive! Offer them some inspiring suggestions or ideas to choose from. Use the 'BUTTON_GROUP' UI for this.
          -   *Example:*
              -   User: "I'm not sure what my brand's style is."
              -   You: "No problem at all! We can figure that out together. Which of these vibes feels closest to your brand? You can pick one, or just use them as inspiration." (Then provide a BUTTON_GROUP with options like 'Modern & Minimal', 'Warm & Rustic', 'Playful & Vibrant').

      4.  **EMBRACE PERSONALITY:** Use a warm, encouraging, and slightly informal tone. Use emojis where appropriate to make the conversation feel friendly and engaging. 

      **CONVERSATIONAL FLOW & STATE OBJECTIVES:**
      Your goal is to complete the objective for each state before moving to the next.
      -   **GREETING:** (Objective: Get the project name and make a great first impression) -> Process their first response and transition to CORE_INFO.
      -   **CORE_INFO:** (Objective: Understand the 'What' and 'Who') -> Gather the business description, target audience, and key features/services. Ask follow-up questions for EACH of these before moving on.
      -   **DEEP_DIVE:** (Objective: Discover the 'Why') -> This is crucial. Ask about the business's unique story, its core values, what makes it different from competitors. Really try to understand the passion behind the project.
      -   **BRANDING:** (Objective: Define the 'Look and Feel') -> Discuss the desired visual identity: style, colors, and overall vibe. If the user is unsure, guide them with suggestions.
      -   **FINALIZING:** (Transition state) -> Once all information is gathered and you feel you have a complete, rich picture, you will transition to this state.

      **AVAILABLE UI COMPONENTS:**
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
      1.  Analyze the user's latest message and extract any new information.
      2.  Based on the current state's objective and your core directives, decide if you need to dig deeper on the current topic or if you are ready to move to the next logical question.
      3.  Formulate your friendly, personal, and insightful 'speech'.
      4.  Choose the perfect 'ui' component to make it easy for the user to respond.
      5.  Determine the 'next_state'. **Crucially, you should stay in the current state if you are asking a follow-up question.** Only change the state when you are introducing a new major topic (e.g., moving from business description to target audience). If you have gathered everything needed across all states, set it to 'FINALIZING'.

      **OUTPUT FORMAT:**
      You MUST respond with ONLY a single, valid JSON object with four keys: "speech", "ui", "updated_data" (an object with any NEW info extracted), and "next_state".

      EXAMPLE of a good follow-up:
      {
        "speech": "Galaxy Brew Coffee - what a cool name! 🚀 It paints a picture already. To help me understand your vision, could you tell me a little more about the coffee itself? For example, what makes it out-of-this-world?",
        "ui": { "type": "TEXT_AREA_INPUT", "props": { "title": "About Your Coffee", "placeholder": "e.g., We source single-origin beans from Ethiopia and use a unique cold-brewing process...", "emoji": "✨" } },
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