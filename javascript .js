import { GoogleGenAI } from '@google/genai';

// Forces Vercel to use the Edge runtime, allowing faster streaming and bypassing timeouts
export const runtime = 'edge'; 

// Make sure GEMINI_API_KEY is defined in your Vercel Project Settings
const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

export async function POST(req) {
  try {
    const { messages } = await req.json();
    const lastMessage = messages[messages.length - 1].content;

    // Using gemini-1.5-flash for faster response cycles
    const responseStream = await ai.models.generateContentStream({
      model: 'gemini-1.5-flash',
      contents: lastMessage,
    });

    // Create a readable stream to pipe directly to the frontend
    const stream = new ReadableStream({
      async start(controller) {
        for await (const chunk of responseStream) {
          controller.enqueue(new TextEncoder().encode(chunk.text));
        }
        controller.close();
      },
    });

    return new Response(stream, {
      headers: { 'Content-Type': 'text/plain; charset=utf-8' },
    });

  } catch (error) {
    console.error("Gemini API Error Context:", error);
    
    // Instead of throwing a generic breakdown, return a clear 500 error payload
    return new Response(
      JSON.stringify({ error: "Failed to fetch response", details: error.message }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
}
