import { GoogleGenerativeAI } from '@google/generative-ai';

// ===================================================================================
// TYPE DEFINITIONS (Consistent across the application)
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

// ===================================================================================
// GEMINI INITIALIZATION (Using the powerful model for code intelligence)
// ===================================================================================
if (!process.env.GEMINI_API_KEY) {
  throw new Error("CRITICAL: GEMINI_API_KEY is not set in environment variables.");
}
console.log("[GEMINI_INIT] Initializing GoogleGenerativeAI client...");
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
const geminiModel = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
console.log("[GEMINI_INIT] Gemini model 'gemini-1.5-flash' loaded successfully.");


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
    // Generate a unique ID for this execution run for traceable logging
    const executionId = `edit-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
    console.log(`[EditingAgent][${executionId}] --- EXECUTION START ---`);
    console.log(`[EditingAgent][${executionId}] Received user prompt: "${prompt}"`);
    console.log(`[EditingAgent][${executionId}] Received context with history length: ${context.history.length}`);
    console.log(`[EditingAgent][${executionId}] Received current code with lengths: HTML=${currentCode.html.length}, CSS=${currentCode.css.length}, JS=${currentCode.js.length}`);

    try {
      // Step 1: Create the detailed system prompt for the LLM
      console.log(`[EditingAgent][${executionId}] Step 1: Creating system prompt for LLM.`);
      const systemPrompt = this.createSystemPrompt(prompt, currentCode, executionId);

      // Step 2: Send the request to the Gemini API
      console.log(`[EditingAgent][${executionId}] Step 2: Sending request to Gemini model...`);
      const result = await geminiModel.generateContent(systemPrompt);
      const responseText = result.response.text();
      console.log(`[EditingAgent][${executionId}] Received raw response from Gemini. Total length: ${responseText.length}`);
      // For deep debugging, you can uncomment the following line to see the full raw output:
      // console.log(`[EditingAgent][${executionId}] Gemini Raw Response Text:\n---\n${responseText}\n---`);

      // Step 3: Parse the (potentially messy) LLM response into a structured object
      console.log(`[EditingAgent][${executionId}] Step 3: Parsing LLM response text into a code object.`);
      const modifiedCode = this.parseLlmResponse(responseText, executionId);
      console.log(`[EditingAgent][${executionId}] Successfully parsed LLM response into structured object.`);

      // Step 4: Validate the structure of the parsed response
      console.log(`[EditingAgent][${executionId}] Step 4: Validating parsed code object structure.`);
      if (!modifiedCode || typeof modifiedCode.html !== 'string' || typeof modifiedCode.css !== 'string' || typeof modifiedCode.js !== 'string') {
        console.error(`[EditingAgent][${executionId}] VALIDATION FAILED: LLM response was missing one or more required code keys (html, css, js) or they were not strings.`);
        console.error(`[EditingAgent][${executionId}] Parsed Object for Debugging:`, modifiedCode);
        throw new Error("LLM response was missing one or more required code keys (html, css, js) or had incorrect types.");
      }
      console.log(`[EditingAgent][${executionId}] Validation PASSED. New code lengths: HTML=${modifiedCode.html.length}, CSS=${modifiedCode.css.length}, JS=${modifiedCode.js.length}`);

      // Step 5: Construct the final successful agent response
      console.log(`[EditingAgent][${executionId}] Step 5: Constructing success response object.`);
      const confirmationSpeech = `Okay, I've applied that change. Take a look at the updated preview! What's next?`;
      
      const newHistory: [string, string][] = [...context.history, ['user', prompt], ['agent', confirmationSpeech]];
      const updatedContext: ConversationContext = { 
          ...context, 
          history: newHistory,
          goal: 'edit_code' // Keep the goal as 'edit_code' for subsequent requests
      };

      const response: AgentResponse = {
        id: `response-${executionId}`, // Use executionId for full traceability
        status: 'COMPLETE',
        speech: confirmationSpeech,
        ui: null,
        action: {
          type: 'GENERATION_COMPLETE',
          payload: {
            html: modifiedCode.html,
            css: modifiedCode.css,
            js: modifiedCode.js,
          }
        },
        context: updatedContext,
      };

      console.log(`[EditingAgent][${executionId}] Successfully constructed AgentResponse. Status: COMPLETE.`);
      console.log(`[EditingAgent][${executionId}] --- EXECUTION END (SUCCESS) ---`);
      return response;

    } catch (error) {
        // Step 6 (Error Path): Catch any errors, log them, and create a user-friendly error response
        console.error(`[EditingAgent][${executionId}] --- EXECUTION END (ERROR) ---`);
        const errorMessage = error instanceof Error ? error.message : String(error);
        console.error(`[EditingAgent][${executionId}] An error occurred during the editing process:`, errorMessage);
        console.error(error); // Log the full error object for stack trace visibility

        const userFacingErrorSpeech = "I seem to have run into a snag trying to make that edit. Could you try rephrasing your request?";

        const errorResponse: AgentResponse = {
            id: `error-${executionId}`, // Use executionId for traceability
            status: 'AWAITING_INPUT', // Set status to allow user to retry
            speech: userFacingErrorSpeech,
            ui: null,
            action: null,
            context: {
              ...context,
              // Add the failed interaction to history so the context is not lost
              history: [...context.history, ['user', prompt], ['agent', userFacingErrorSpeech]]
            },
        };
        console.log(`[EditingAgent][${executionId}] Constructed user-facing error response.`);
        return errorResponse;
    }
  }

  private createSystemPrompt(userRequest: string, currentCode: GeneratedCode, executionId: string): string {
    console.log(`[EditingAgent][${executionId}][createSystemPrompt] Assembling prompt components.`);
    const prompt = `
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
    console.log(`[EditingAgent][${executionId}][createSystemPrompt] System prompt created. Total length: ${prompt.length} characters.`);
    return prompt;
  }

  private parseLlmResponse(responseText: string, executionId: string): GeneratedCode {
      console.log(`[EditingAgent][${executionId}][parseLlmResponse] Attempting to parse raw response text.`);
      try {
          // Be robust: find the first '{' and the last '}' to isolate the JSON object,
          // ignoring any potential conversational text or markdown backticks from the LLM.
          const jsonStart = responseText.indexOf('{');
          const jsonEnd = responseText.lastIndexOf('}');

          if (jsonStart === -1 || jsonEnd === -1) {
              console.error(`[EditingAgent][${executionId}][parseLlmResponse] PARSE FAILED: Could not find a valid JSON block (missing '{' or '}').`);
              throw new Error("Response did not contain a recognizable JSON object.");
          }

          const cleanJson = responseText.substring(jsonStart, jsonEnd + 1);
          console.log(`[EditingAgent][${executionId}][parseLlmResponse] Extracted potential JSON string. Length: ${cleanJson.length}. Attempting JSON.parse...`);

          const parsedObject = JSON.parse(cleanJson);
          console.log(`[EditingAgent][${executionId}][parseLlmResponse] Successfully parsed JSON string into an object.`);
          return parsedObject;

      } catch (error) {
          console.error(`[EditingAgent][${executionId}][parseLlmResponse] FATAL PARSE ERROR: Failed to parse LLM JSON response.`);
          console.error(`[EditingAgent][${executionId}][parseLlmResponse] Original Response Text that caused error:\n---\n${responseText}\n---`);
          console.error(`[EditingAgent][${executionId}][parseLlmResponse] The specific parsing error was:`, error);
          // Re-throw the error to be caught by the main execute block, ensuring a proper user-facing error is returned.
          throw new Error("Invalid JSON response from language model during code editing.");
      }
  }
}