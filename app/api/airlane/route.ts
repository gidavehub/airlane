import { NextResponse } from 'next/server';
import { OnboardingAgent } from '../../../services/agents/OnboardingAgent';
import { CodeGenerationAgent } from '../../../services/agents/CodeGenerationAgent';
import { EditingAgent } from '../../../services/agents/EditingAgent'; // --- MODIFICATION: Import the new agent ---

// --- Type Definitions ---
interface ConversationContext {
  history: [string, string][]; 
  collected_info: { [key: string]: any }; 
  goal: string | null;
}
// --- MODIFICATION: Add GeneratedCode to types ---
interface GeneratedCode {
  html: string; css: string; js: string;
}

export async function POST(request: Request) {
  try {
    // --- MODIFICATION: Destructure generatedCode from the body ---
    const body = await request.json();
    const { prompt, context, generatedCode } = body as { prompt: string; context: ConversationContext | null, generatedCode?: GeneratedCode };

    let response;
    const currentGoal = context?.goal;

    // ===================================================================================
    // --- The Main Agent Router ---
    // ===================================================================================
    switch (currentGoal) {
      // --- MODIFICATION: Add the new 'edit_code' case ---
      case 'edit_code':
        if (!generatedCode) {
          throw new Error("Cannot edit code when 'generatedCode' is not provided.");
        }
        console.log('[API Router] Goal is "edit_code". Delegating to EditingAgent.');
        const editingAgent = new EditingAgent();
        response = await editingAgent.execute(prompt, context!, generatedCode);
        break;

      case 'generate_landing_page':
        console.log('[API Router] Goal is "generate_landing_page". Delegating to CodeGenerationAgent.');
        const codeAgent = new CodeGenerationAgent();
        response = await codeAgent.execute(context!);
        break;
      
      case 'onboard_user':
      default:
        console.log(`[API Router] Goal is "${currentGoal || 'onboard_user'}". Delegating to OnboardingAgent.`);
        const onboardingAgent = new OnboardingAgent();
        response = await onboardingAgent.execute(prompt, context);
        break;
    }

    return NextResponse.json(response);

  } catch (error: any) {
    console.error('[Airlane API Router Error]', error);
    return NextResponse.json(
      { error: 'An internal server error occurred in the agent router.' },
      { status: 500 }
    );
  }
}