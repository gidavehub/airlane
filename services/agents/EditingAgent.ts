import { GoogleGenerativeAI } from '@google/generative-ai';

// ===================================================================================
// TYPE DEFINITIONS (Consistent across the application)
// ===================================================================================
interface AgentResponse {
  id: string; status: 'AWAITING_INPUT' | 'PROCESSING' | 'COMPLETE' | 'ERROR';
  speech: string | null; ui: any | null; action: { type: string; payload?: any } | null; context: ConversationContext;
}
interface ConversationContext {
  history: [string, string][]; collected_info: { [key: string]: any }; goal: string | null;
}
interface GeneratedCode {
  html: string; css: string; js: string;
}

// ===================================================================================
// GEMINI INITIALIZATION (Using the powerful model for code intelligence)
// ===================================================================================
if (!process.env.GEMINI_API_KEY) {
  throw new Error("CRITICAL: GEMINI_API_KEY is not set in environment variables.");
}
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
const geminiModel = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });

// ===================================================================================
// THE EDITING AGENT
// ===================================================================================
export class EditingAgent {
  /**
   * Executes a code modification task.
   * @param prompt The user's edit request.
   * @param context The current conversation context.
   * @param currentCode The existing code to be modified.
   */
  public async execute(prompt: string, context: ConversationContext, currentCode: GeneratedCode): Promise<AgentResponse> {
    try {
      const systemPrompt = this.createSystemPrompt(prompt, currentCode);

      console.log("[EditingAgent] Sending edit request to Gemini...");
      const result = await geminiModel.generateContent(systemPrompt);
      const responseText = result.response.text();
      const modifiedCode = this.parseLlmResponse(responseText);

      // Validate the response structure
      if (!modifiedCode.html || !modifiedCode.css || !modifiedCode.js) {
        throw new Error("LLM response was missing one or more required code keys (html, css, js).");
      }

      const confirmationSpeech = `Okay, I've applied that change. Take a look at the updated preview! What's next?`;
      
      return {
        id: `response-edit-${Date.now()}`,
        status: 'COMPLETE', // Or AWAITING_INPUT to keep the conversation flowing
        speech: confirmationSpeech,
        ui: null, // Keep the UI clean in the conversation panel during editing
        action: {
          type: 'GENERATION_COMPLETE', // We reuse this action type to trigger the iframe refresh on the frontend
          payload: {
            html: modifiedCode.html,
            css: modifiedCode.css,
            js: modifiedCode.js,
          }
        },
        context: { 
            ...context, 
            history: [...context.history, ['user', prompt], ['agent', confirmationSpeech]],
            goal: 'edit_code' // Keep the goal as 'edit_code' for subsequent requests
        },
      };

    } catch (error) {
        console.error("Error during AI code editing:", error);
        return {
            id: `error-edit-${Date.now()}`,
            status: 'AWAITING_INPUT', // Allow user to try again
            speech: "I seem to have run into a snag trying to make that edit. Could you try rephrasing your request?",
            ui: null,
            action: null,
            context: context,
        };
    }
  }

  private createSystemPrompt(userRequest: string, currentCode: GeneratedCode): string {
    return `
      You are an expert senior web developer acting as a code assistant. Your task is to intelligently modify an existing landing page based on a user's plain-text request.

      **YOUR PRIMARY DIRECTIVE:**
      Make the smallest, most targeted change possible to the provided code to satisfy the user's request. Do NOT rewrite the entire codebase from scratch. Preserve the existing structure, styles, and logic unless specifically asked to change them.

      **THE USER'S REQUEST:**
      "${userRequest}"

      **THE CURRENT CODEBASE:**

      **HTML:**
      \`\`\`html
      ${currentCode.html}
      \`\`\`

      **CSS:**
      \`\`\`css
      ${currentCode.css}
      \`\`\`

      **JAVASCRIPT:**
      \`\`\`javascript
      ${currentCode.js}
      \`\`\`

      **YOUR TASK:**
      1.  Analyze the user's request and the provided code.
      2.  Determine the necessary modifications to the HTML, CSS, and/or JavaScript.
      3.  Apply these changes surgically. For example, if the user wants to change a button color, find the correct CSS rule and change the color property; do not rewrite the whole CSS file.
      4.  Return the COMPLETE, updated code for all three files (html, css, js), even if you only changed one. This is mandatory.

      **OUTPUT FORMAT:**
      You MUST respond with ONLY a single, valid JSON object. Do not include any text, explanation, or markdown formatting before or after the JSON block. The JSON object must have three string keys: "html", "css", and "js".
    `;
  }

  private parseLlmResponse(responseText: string): GeneratedCode {
      try {
          const cleanJson = responseText.replace(/^```json\n?/, '').replace(/```$/, '');
          return JSON.parse(cleanJson);
      } catch (error) {
          console.error("Failed to parse LLM JSON response for code editing:", responseText, error);
          throw new Error("Invalid JSON response from language model during code editing.");
      }
  }
}