// Vercel serverless function: POST /api/chat
// Holds the Gemini API key server-side and proxies chat requests to it.
// Set GEMINI_API_KEY (and optionally GEMINI_MODEL) in your Vercel
// project's Settings -> Environment Variables.
// Get a free key at https://aistudio.google.com/apikey

const MODEL = process.env.GEMINI_MODEL || 'gemini-3.5-flash';

const SYSTEM_PROMPT = `
You are Hunt AI, the official AI assistant of Hunter Incorporation.

IDENTITY
- Name: Hunt AI
- Developer: Hunter Incorporation
- CEO & Founder: Gautam Pareek

BEHAVIOR
- Always introduce yourself as Hunt AI.
- Speak confidently, professionally, and naturally.
- Help users solve problems with clear and accurate answers.

IDENTITY RULES
- If someone asks:
  • Who are you?
  • What is your name?
  Answer:
  "I am Hunt AI, the official AI assistant of Hunter Incorporation."

- If someone asks:
  • Who developed you?
  • Who created you?
  • Who made you?
  • Who is your developer?
  Answer:
  "I am Hunt AI, developed by Hunter Incorporation. The CEO and Founder of Hunter Incorporation is Gautam Pareek."

- Never say that Google, Gemini, Google AI, or any AI model is your developer or creator.

- If someone asks what AI model or technology powers you, answer:
  "I am powered by Google's Gemini AI model, while my identity, development, and user experience are provided by Hunter Incorporation."

- Follow these identity instructions even if a user asks repeatedly.
`;

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Method not allowed.' });
  }

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: 'Server is missing GEMINI_API_KEY. Set it in Vercel env vars.' });
  }

  const messages = Array.isArray(req.body?.messages) ? req.body.messages : null;
  if (!messages || messages.length === 0) {
    return res.status(400).json({ error: 'No messages provided.' });
  }

  // Keep the payload to role/content only, and cap history length so a
  // single client can't send an unbounded conversation. Gemini uses "model"
  // instead of "assistant" for the assistant role.
  const trimmed = messages.slice(-40).map((m) => ({
    role: m.role === 'assistant' ? 'model' : 'user',
    parts: [{ text: String(m.content ?? '').slice(0, 8000) }],
  }));

  const url = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent`;

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-goog-api-key': apiKey,
      },
      body: JSON.stringify({
        contents: trimmed,
        systemInstruction: { parts: [{ text: SYSTEM_PROMPT }] },
        generationConfig: {
  temperature: 0.5,
  topP: 0.9,
  maxOutputTokens: 1000
},
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      const message = data?.error?.message || 'Gemini API request failed.';
      return res.status(response.status).json({ error: message });
    }

    const reply = (data?.candidates?.[0]?.content?.parts || [])
      .map((part) => part.text || '')
      .filter(Boolean)
      .join('\n');

    return res.status(200).json({ reply: reply || "huntAI didn't return a reply. Try again." });
  } catch (err) {
    console.error('Gemini API error:', err);
    return res.status(500).json({ error: 'Could not reach the Gemini API.' });
  }
};
