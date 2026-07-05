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
// 1. Array to store the chat memory (Chat History)
let chatHistory = [];

// 2. Variable to track if H-Mode (Hunter/Homework Mode) is ON or OFF
let isHMode = false; 

// 3. Main function to communicate with Gemini API
async function askGemini(userMessage) {
    const apiKey = "YOUR_API_KEY_OR_PROCESS_ENV"; // Put your actual API key here
    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`;

    // Add the user's new message to the chat history
    chatHistory.push({
        "role": "user",
        "parts": [{ "text": userMessage }]
    });

    // 4. Dynamic System Instruction based on H-Mode status
    let systemPrompt = "";

    if (isHMode) {
        // Strict, brilliant step-by-step Class 9 homework tutor mode
        systemPrompt = "Your name is Hunter AI. H-Mode (Hunter & Homework Mode) is currently ACTIVE. You are now acting as a brilliant, supportive, and strict personal tutor for Class 9 students. Do not give the direct answers or full solutions immediately. Instead, guide the student step-by-step by providing hints, core formulas, and logical steps. Encourage them to solve it. Keep the explanations simple, engaging, and clear.";
    } else {
        // Normal mode with your official corporate identity
        systemPrompt = "Respond to every user query with high intelligence, clarity, and respect. Your name is Hunter AI. You have been developed by 'Hunter Incorporation'. If any user asks about your developer, creator, or who made you, proudly state that your developer and the Founder & CEO of 'Hunter Incorporation' is 'Gautam Pareek'.";
    }

    // 5. Creating the request payload
    const payload = {
        "systemInstruction": {
            "parts": [
                { "text": systemPrompt }
            ]
        },
        "contents": chatHistory // Sending the entire chat memory
    };

    try {
        const response = await fetch(url, {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify(payload)
        });

        // If the server returns an error code
        if (!response.ok) {
            throw new Error(`Server Error: ${response.status}`);
        }

        const data = await response.json();

        // Validate if the AI response is properly received
        if (data.candidates && data.candidates[0].content && data.candidates[0].content.parts[0].text) {
            const aiResponse = data.candidates[0].content.parts[0].text;

            // Save AI's response to history so it remembers the context next time
            chatHistory.push({
                "role": "model",
                "parts": [{ "text": aiResponse }]
            });

            return aiResponse;
        } else {
            // Backup message if response is blocked by safety filters
            return "Hunter AI: I cannot generate a response for this message due to system safety filters. Please ask something else.";
        }

    } catch (error) {
        console.error("Error fetching Gemini:", error);
        
        // Remove the last user message from history on failure so they can try sending it again
        chatHistory.pop(); 
        
        // Graceful error message instead of "No response received" crash
        return "Hunter AI server is currently busy or there is a network issue. Please try again in a moment! 🛠️";
    }
}

// 6. Function to turn H-Mode ON/OFF from your UI button click
function toggleHMode() {
    isHMode = !isHMode;
    console.log("H-Mode Status:", isHMode ? "ON" : "OFF");
    // You can add UI glow effect logic here using classList.toggle()
}

// 7. Function to reset the chat session
function clearChat() {
    chatHistory = [];
}
