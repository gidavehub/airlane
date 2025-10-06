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
if (!process.env.GEMINI_API_KEY) {
  throw new Error("CRITICAL: GEMINI_API_KEY is not set in environment variables.");
}
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
const geminiModel = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });

// ===================================================================================
// BASELINE DATA LOADER & CACHING (For technical constraints)
// ===================================================================================
let baselineCssCache: Set<string> | null = null;
async function getBaselineCssProperties(): Promise<Set<string>> {
  if (baselineCssCache) return baselineCssCache;
  try {
    // This is the correct way to resolve a path from the project root in Next.js/Node
    const dataPath = path.resolve(process.cwd(), 'node_modules', 'web-features', 'data.json');
    const fileContent = await fs.readFile(dataPath, 'utf-8');
    const webFeaturesData = JSON.parse(fileContent);
    const baselineProperties = new Set<string>();
    for (const featureId in webFeaturesData) {
      const feature = webFeaturesData[featureId];
      if (feature.status?.baseline && feature.css_properties) {
        feature.css_properties.forEach((prop: any) => baselineProperties.add(prop.name || prop));
      }
    }
    console.log(`[CodeGenerationAgent] Loaded and cached ${baselineProperties.size} Baseline-supported CSS properties.`);
    baselineCssCache = baselineProperties;
    return baselineProperties;
  } catch (error) {
    console.error("Fatal: Failed to load web-features data. This will impact code generation quality.", error);
    return new Set(); // Return empty set to avoid crash
  }
}

// ===================================================================================
// THE CODE GENERATION AGENT
// ===================================================================================
export class CodeGenerationAgent {
  public async execute(context: ConversationContext): Promise<AgentResponse> {
    try {
      const brief = context.collected_info;
      const baselineProps = await getBaselineCssProperties();
      const systemPrompt = this.createSystemPrompt(brief, Array.from(baselineProps));

      console.log("[CodeGenerationAgent] Sending detailed brief to Gemini for code generation...");
      const result = await geminiModel.generateContent(systemPrompt);
      const responseText = result.response.text();
      const generatedCode = this.parseLlmResponse(responseText);

      if (!generatedCode.html || !generatedCode.css || !generatedCode.js) {
        throw new Error("LLM response was missing one or more required code keys (html, css, js).");
      }

      const finalSpeech = "Voila! I've designed and built a unique, modern landing page based on our conversation. Here is the live preview!";

      return {
        id: `response-codegen-${Date.now()}`,
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
        action: { // This is the critical action for the frontend
          type: 'GENERATION_COMPLETE',
          payload: {
            html: generatedCode.html,
            css: generatedCode.css,
            js: generatedCode.js,
          }
        },
        context: { ...context, goal: 'completed' },
      };
    } catch (error) {
        console.error("Error during AI code generation:", error);
        return {
            id: `error-codegen-${Date.now()}`,
            status: 'ERROR',
            speech: "I'm so sorry, my creative circuits got tangled while building your site. Would you like to try generating it again?",
            ui: { type: 'BUTTON_GROUP', props: { buttons: [{ text: "Retry Generation", payload: "retry_generation" }] } },
            action: null,
            context: { ...context, goal: 'onboard_user' } // Reset goal to allow retry
        };
    }
  }

  private createSystemPrompt(brief: any, baselineProps: string[]): string {
    const featuresList = brief.key_features ? brief.key_features.join(', ') : 'Not specified';
    const brandColors = brief.brand_colors ? brief.brand_colors.join(', ') : "Designer's choice";

    return `
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
  }

  private parseLlmResponse(responseText: string): { html: string; css: string; js: string; } {
      try {
          const cleanJson = responseText.replace(/^```json\n?/, '').replace(/```$/, '');
          return JSON.parse(cleanJson);
      } catch (error) {
          console.error("Failed to parse LLM JSON response for code generation:", responseText, error);
          throw new Error("Invalid JSON response from language model during code generation.");
      }
  }
}