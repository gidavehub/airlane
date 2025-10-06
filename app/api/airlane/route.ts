import { NextResponse } from 'next/server';
import { OnboardingAgent } from '../../../services/agents/OnboardingAgent';
import { CodeGenerationAgent } from '../../../services/agents/CodeGenerationAgent';
import { EditingAgent } from '../../../services/agents/EditingAgent';

// --- Type Definitions ---
interface ConversationContext {
  history: [string, string][]; 
  collected_info: { [key: string]: any }; 
  goal: string | null;
}
interface GeneratedCode {
  html: string; css: string; js: string;
}

export async function POST(request: Request) {
  // 1. Log the start of the request handling
  console.log('[API ROUTE] - INFO: POST request received at /api/agent.');

  try {
    // 2. Log the attempt to parse the request body
    console.log('[API ROUTE] - INFO: Parsing request body as JSON...');
    const body = await request.json();
    const { prompt, context, generatedCode } = body as { prompt: string; context: ConversationContext | null, generatedCode?: GeneratedCode };
    
    // 3. Log the parsed body for debugging. Be mindful of sensitive data in a real app.
    console.log(`[API ROUTE] - DEBUG: Request body parsed successfully.`);
    console.log(`[API ROUTE] - DEBUG: Prompt: "${prompt}"`);
    console.log(`[API ROUTE] - DEBUG: Context exists: ${!!context}`);
    console.log(`[API ROUTE] - DEBUG: Generated code exists: ${!!generatedCode}`);

    let response;
    const currentGoal = context?.goal;
    
    // 4. Log the goal that will be used for routing
    console.log(`[API ROUTE] - INFO: Determined current goal for routing: "${currentGoal}"`);


    // ===================================================================================
    // --- The Main Agent Router ---
    // ===================================================================================
    console.log('[API ROUTE] - INFO: Entering agent routing switch statement...');
    switch (currentGoal) {
      // --- Case for editing existing code ---
      case 'edit_code':
        console.log(`[API ROUTE] - ROUTING: Matched goal "edit_code".`);
        
        // 5a. Validate necessary data for this route
        console.log('[API ROUTE] - INFO: Validating that "generatedCode" is provided for editing...');
        if (!generatedCode) {
          console.error("[API ROUTE] - ERROR: 'generatedCode' is missing but required for 'edit_code' goal.");
          throw new Error("Cannot edit code when 'generatedCode' is not provided.");
        }
        console.log('[API ROUTE] - INFO: Validation successful. "generatedCode" is present.');
        
        // 5b. Instantiate and execute the corresponding agent
        console.log('[API ROUTE] - INFO: Instantiating EditingAgent...');
        const editingAgent = new EditingAgent();
        console.log('[API ROUTE] - INFO: Executing EditingAgent with prompt, context, and generated code...');
        response = await editingAgent.execute(prompt, context!, generatedCode);
        console.log('[API ROUTE] - INFO: EditingAgent execution finished.');
        break;

      // --- Case for generating a new landing page ---
      case 'generate_landing_page':
        console.log(`[API ROUTE] - ROUTING: Matched goal "generate_landing_page".`);

        // 6a. Instantiate and execute the corresponding agent
        console.log('[API ROUTE] - INFO: Instantiating CodeGenerationAgent...');
        const codeAgent = new CodeGenerationAgent();
        console.log('[API ROUTE] - INFO: Executing CodeGenerationAgent with context...');
        response = await codeAgent.execute(context!);
        console.log('[API ROUTE] - INFO: CodeGenerationAgent execution finished.');
        break;
      
      // --- Default case for user onboarding or when no goal is set ---
      case 'onboard_user':
      default:
        console.log(`[API ROUTE] - ROUTING: Matched goal "${currentGoal}" (or fell through to default).`);

        // 7a. Instantiate and execute the corresponding agent
        console.log('[API ROUTE] - INFO: Instantiating OnboardingAgent...');
        const onboardingAgent = new OnboardingAgent();
        console.log('[API ROUTE] - INFO: Executing OnboardingAgent with prompt and context...');
        response = await onboardingAgent.execute(prompt, context);
        console.log('[API ROUTE] - INFO: OnboardingAgent execution finished.');
        break;
    }

    // 8. Log the successful preparation of the response
    console.log('[API ROUTE] - INFO: Agent action completed successfully. Preparing to send response.');
    console.log(`[API ROUTE] - DEBUG: Final response payload: ${JSON.stringify(response, null, 2)}`);
    return NextResponse.json(response);

  } catch (error: any) {
    // 9. Log the error in detail if anything in the `try` block fails
    console.error('[API ROUTE] - FATAL: An error occurred in the agent router.', {
      errorMessage: error.message,
      errorStack: error.stack,
      errorCause: error.cause, // Modern Node.js versions might have this
    });
    
    // 10. Log that an error response is being sent
    console.log('[API ROUTE] - INFO: Preparing and sending 500 Internal Server Error response.');
    return NextResponse.json(
      { error: 'An internal server error occurred in the agent router.', details: error.message },
      { status: 500 }
    );
  }
}