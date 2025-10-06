// /app/api/transcribe/route.ts

import { AssemblyAI } from 'assemblyai';
import { NextResponse } from 'next/server';

// Initialize the AssemblyAI client.
// It will automatically look for the ASSEMBLYAI_API_KEY in your environment variables.
const client = new AssemblyAI({
  apiKey: process.env.ASSEMBLYAI_API_KEY,
});

export async function POST(request: Request) {
  // 1. Check if the API key is configured on the server.
  if (!process.env.ASSEMBLYAI_API_KEY) {
    console.error("CRITICAL: ASSEMBLYAI_API_KEY environment variable is not set.");
    return NextResponse.json(
      { error: "Server configuration error: Transcription service is not enabled." },
      { status: 500 }
    );
  }

  try {
    // 2. The request from the client will contain FormData with the audio file.
    const formData = await request.formData();
    const file = formData.get('file') as Blob | null;

    if (!file) {
      return NextResponse.json({ error: "No audio file provided in the request." }, { status: 400 });
    }

    // 3. The AssemblyAI SDK can directly handle the audio data from the Blob.
    // We send it for transcription.
    const transcript = await client.transcripts.transcribe({
      audio: file,
      // 'universal' is a powerful and flexible model.
      speech_model: "universal", 
    });

    // 4. Handle potential errors from the transcription service itself.
    if (transcript.status === 'error') {
      console.error("AssemblyAI transcription error:", transcript.error);
      return NextResponse.json({ error: transcript.error }, { status: 500 });
    }

    // 5. Success! Return the transcribed text to the client.
    return NextResponse.json({ text: transcript.text });

  } catch (error: any) {
    console.error("Error in transcription route:", error);
    return NextResponse.json(
      { error: 'Failed to process the audio file.', details: error.message },
      { status: 500 }
    );
  }
}