import { GoogleGenerativeAI } from '@google/generative-ai';
import fs from 'fs/promises';
import path from 'path';

// ===================================================================================
// TYPE DEFINITIONS (Matching other files)
// ===================================================================================
interface AgentResponse {
  id: string; status: 'AWAITING_INPUT' | 'PROCESSING' | 'COMPLETE' | 'ERROR';
  speech: string | null; ui: any | null; action: { type: string; payload?: any } | null; context: ConversationContext;
}
interface ConversationContext {
  history: [string, string][]; collected_info: { [key: string]: any }; goal: string | null;
}

// ===================================================================================
// GEMINI INITIALIZATION (Using the more powerful model for code)
// ===================================================================================
console.log('[AGENT_INIT] Initializing Gemini client...');
if (!process.env.GEMINI_API_KEY) {
  console.error("[AGENT_INIT] CRITICAL: GEMINI_API_KEY is not set in environment variables. The application will not function.");
  throw new Error("CRITICAL: GEMINI_API_KEY is not set in environment variables.");
}
console.log('[AGENT_INIT] GEMINI_API_KEY found. Proceeding with initialization.');
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
const geminiModel = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });
console.log('[AGENT_INIT] Gemini client and model "gemini-1.5-flash" initialized successfully.');


// ===================================================================================
// BASELINE DATA LOADER & CACHING (For technical constraints)
// ===================================================================================
let baselineCssCache: Set<string> | null = null;
async function getBaselineCssProperties(): Promise<Set<string>> {
  console.log('[BaselineLoader] Request received for Baseline CSS properties.');
  if (baselineCssCache) {
    console.log(`[BaselineLoader] [CACHE HIT] Returning cached set of ${baselineCssCache.size} properties.`);
    return baselineCssCache;
  }

  console.log('[BaselineLoader] [CACHE MISS] No cached data found. Loading from file system.');
  try {
    const dataPath = path.resolve(process.cwd(), 'node_modules', 'web-features', 'data.json');
    console.log(`[BaselineLoader] Resolved path to web-features data: ${dataPath}`);

    console.log('[BaselineLoader] Reading file content...');
    const fileContent = await fs.readFile(dataPath, 'utf-8');
    console.log(`[BaselineLoader] Successfully read file. Content length: ${fileContent.length} characters.`);

    console.log('[BaselineLoader] Parsing JSON data...');
    const webFeaturesData = JSON.parse(fileContent);
    console.log('[BaselineLoader] JSON data parsed successfully.');

    const baselineProperties = new Set<string>();
    const featureIds = Object.keys(webFeaturesData);
    console.log(`[BaselineLoader] Iterating over ${featureIds.length} features to find baseline CSS properties...`);

    for (const featureId in webFeaturesData) {
      const feature = webFeaturesData[featureId];
      if (feature.status?.baseline && feature.css_properties) {
        feature.css_properties.forEach((prop: any) => baselineProperties.add(prop.name || prop));
      }
    }

    console.log(`[BaselineLoader] Finished processing. Found ${baselineProperties.size} unique Baseline-supported CSS properties.`);
    console.log('[BaselineLoader] Caching the results for future requests.');
    baselineCssCache = baselineProperties;
    return baselineProperties;
  } catch (error) {
    console.error("[BaselineLoader] FATAL: Failed to load and process web-features data. Code generation quality will be severely impacted.", error);
    // Returning an empty set is a graceful degradation strategy.
    console.warn("[BaselineLoader] Returning an empty Set<string> to prevent application crash.");
    return new Set();
  }
}

// ===================================================================================
// THE CODE GENERATION AGENT
// ===================================================================================
export class CodeGenerationAgent {
  public async execute(context: ConversationContext): Promise<AgentResponse> {
    const executionId = `codegen-${Date.now()}`;
    console.log(`[CodeGenerationAgent] >> EXECUTE START << ID: ${executionId}`);
    console.log(`[CodeGenerationAgent] [${executionId}] Received context with collected_info:`, JSON.stringify(context.collected_info, null, 2));

    try {
      const brief = context.collected_info;

      console.log(`[CodeGenerationAgent] [${executionId}] Step 1: Acquiring baseline CSS properties.`);
      const baselineProps = await getBaselineCssProperties();
      console.log(`[CodeGenerationAgent] [${executionId}] Successfully acquired ${baselineProps.size} baseline properties.`);

      console.log(`[CodeGenerationAgent] [${executionId}] Step 2: Creating the system prompt for the language model.`);
      const systemPrompt = this.createSystemPrompt(brief, Array.from(baselineProps));
      console.log(`[CodeGenerationAgent] [${executionId}] System prompt created. Total length: ${systemPrompt.length} characters.`);

      console.log(`[CodeGenerationAgent] [${executionId}] Step 3: Sending request to Gemini API. This may take a moment...`);
      const result = await geminiModel.generateContent(systemPrompt);
      const responseText = result.response.text();
      console.log(`[CodeGenerationAgent] [${executionId}] Received response from Gemini API. Raw text length: ${responseText.length} characters.`);

      console.log(`[CodeGenerationAgent] [${executionId}] Step 4: Parsing the LLM response text into a JSON object.`);
      const generatedCode = this.parseLlmResponse(responseText);
      console.log(`[CodeGenerationAgent] [${executionId}] Successfully parsed LLM response. Found keys:`, Object.keys(generatedCode).join(', '));

      console.log(`[CodeGenerationAgent] [${executionId}] Step 5: Validating the parsed code object.`);
      if (!generatedCode.html || !generatedCode.css || !generatedCode.js) {
        console.error(`[CodeGenerationAgent] [${executionId}] Validation FAILED. Parsed object is missing one or more required keys (html, css, js).`);
        throw new Error("LLM response was missing one or more required code keys (html, css, js).");
      }
      console.log(`[CodeGenerationAgent] [${executionId}] Validation SUCCEEDED. All required code keys are present.`);

      const finalSpeech = "Voila! I've designed and built a unique, modern landing page based on our conversation. Here is the live preview!";
      console.log(`[CodeGenerationAgent] [${executionId}] Prepared final success speech for the user.`);

      const successResponse: AgentResponse = {
        id: `response-${executionId}`,
        status: 'COMPLETE',
        speech: finalSpeech,
        ui: {
          type: 'KEY_VALUE_DISPLAY',
          props: {
            title: 'Generation Complete!',
            items: [
              { key: "Project", value: brief.business_name || "N/A" },
              { key: "Style", value: brief.style_preference || "N/A" },
              { key: "Status", value: "Live Preview Ready" },
            ]
          }
        },
        action: {
          type: 'GENERATION_COMPLETE',
          payload: {
            html: generatedCode.html,
            css: generatedCode.css,
            js: generatedCode.js,
          }
        },
        context: { ...context, goal: 'completed' },
      };

      console.log(`[CodeGenerationAgent] [${executionId}] Step 6: Assembling final successful AgentResponse object.`);
      console.log(`[CodeGenerationAgent] >> EXECUTE SUCCESS << ID: ${executionId}. Returning COMPLETE status.`);
      return successResponse;

    } catch (error) {
      console.error(`[CodeGenerationAgent] !! EXECUTE FAILED !! ID: ${executionId}. An error occurred during the code generation pipeline.`, error);

      const errorResponse: AgentResponse = {
        id: `error-${executionId}`,
        status: 'ERROR',
        speech: "I'm so sorry, my creative circuits got tangled while building your site. Would you like to try generating it again?",
        ui: { type: 'BUTTON_GROUP', props: { buttons: [{ text: "Retry Generation", payload: "retry_generation" }] } },
        action: null,
        context: { ...context, goal: 'onboard_user' } // Reset goal to allow retry
      };
      console.log(`[CodeGenerationAgent] [${executionId}] Assembled error response object to be sent to the user. Resetting goal to 'onboard_user'.`);
      return errorResponse;
    }
  }

  private createSystemPrompt(brief: any, baselineProps: string[]): string {
    console.log('[CodeGenerationAgent.createSystemPrompt] Starting to build the system prompt.');

    const featuresList = brief.key_features ? brief.key_features.join(', ') : 'Not specified';
    const brandColors = brief.brand_colors ? brief.brand_colors.join(', ') : "Designer's choice";

    console.log(`[CodeGenerationAgent.createSystemPrompt] Interpolating brief data: Name='${brief.business_name}', Style='${brief.style_preference}', Colors='${brandColors}'`);

    const promptString = `
      You are a world-class senior web developer and UI/UX designer with a passion for clean, modern, and highly performant websites. Your task is to generate a complete, single-page landing page (HTML, CSS, JS) based on a detailed client brief.

      **THE CLIENT BRIEF:**
      -   **Business Name:** ${brief.business_name || 'N/A'}
      -   **Core Business:** ${brief.business_description || 'N/A'}
      -   **Unique Story/Values:** ${brief.business_story || 'N/A'}
      -   **Target Audience:** ${brief.target_audience || 'N/A'}
      -   **Key Features to Highlight:** ${featuresList}
      -   **Desired Vibe/Style:** ${brief.style_preference || 'modern'}
      -   **Brand Colors:** ${brandColors}
      -   **Contact Info:** ${brief.contact_info || 'N/A'}

      **YOUR TECHNICAL REQUIREMENTS (MANDATORY):**
      1.  **BASELINE-FIRST CSS:** You have been given a list of CSS properties that are part of "Baseline" (universally supported). You MUST build the entire visual experience using properties from this list. This ensures maximum compatibility.
      2.  **MODERN & RESPONSIVE:** The design must be fully responsive using mobile-first principles. Use CSS Grid and Flexbox. The site must look exceptional on all screen sizes.
      3.  **NO FRAMEWORKS:** Do not use any external CSS frameworks (Bootstrap, Tailwind) or JS libraries (jQuery, React). Write clean, vanilla HTML, CSS, and JavaScript.
      4.  **AESTHETIC EXCELLENCE:** The design must be beautiful, clean, and professional, reflecting the client's desired style ("${brief.style_preference}"). Create a cohesive and attractive color palette, select elegant and readable web fonts (from Google Fonts), and ensure proper visual hierarchy and spacing.
      5.  **SUBTLE INTERACTIVITY:** Use vanilla JavaScript for tasteful micro-interactions. Examples: scroll-triggered fade-in animations, smooth scrolling, or simple form validation. Do not make it flashy.
      6.  **STRUCTURE:** The HTML should be semantic (<header>, <nav>, <main>, <section>, <footer>). Include sections for a hero banner, features, about, and a call-to-action.
      7.  **OUTPUT FORMAT:** You MUST respond with ONLY a single, valid JSON object. Do not include any text, explanation, or markdown formatting before or after the JSON block. The JSON object must have three string keys: "html", "css", and "js".

      **PERMITTED BASELINE CSS PROPERTIES (Prioritize these):**
      ${baselineProps.join(', ')}

      Now, based on the brief and all requirements, generate the code.
    `;
    console.log('[CodeGenerationAgent.createSystemPrompt] Prompt construction complete.');
    return promptString;
  }

  private parseLlmResponse(responseText: string): { html: string; css: string; js: string; } {
    console.log(`[CodeGenerationAgent.parseLlmResponse] Attempting to parse raw response text (length: ${responseText.length}).`);

    try {
      console.log('[CodeGenerationAgent.parseLlmResponse] Cleaning potential markdown JSON block fences (```json ... ```).');
      // A more robust regex to handle optional newlines and language identifiers
      const cleanJson = responseText.trim().replace(/^```(json)?\s*/, '').replace(/```$/, '');
      console.log(`[CodeGenerationAgent.parseLlmResponse] Text cleaned. New length: ${cleanJson.length}. Attempting JSON.parse().`);
      const parsedObject = JSON.parse(cleanJson);
      console.log('[CodeGenerationAgent.parseLlmResponse] JSON.parse() successful.');
      return parsedObject;
    } catch (error) {
      console.error("[CodeGenerationAgent.parseLlmResponse] CRITICAL: Failed to parse LLM JSON response. This is a common failure point.");
      // Log the actual text that failed to parse for easier debugging.
      console.error("[CodeGenerationAgent.parseLlmResponse] Failing response text:", responseText);
      console.error("[CodeGenerationAgent.parseLlmResponse] The caught error:", error);
      throw new Error("Invalid JSON response from language model during code generation.");
    }
  }
}