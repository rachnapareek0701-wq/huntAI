// Vercel serverless function: POST /api/chat
// Holds the Gemini API key server-side and proxies chat requests to it.
// Set GEMINI_API_KEY (and optionally GEMINI_MODEL) in your Vercel
// project's Settings -> Environment Variables.
// Get a free key at https://aistudio.google.com/apikey

const MODEL = process.env.GEMINI_MODEL || 'gemini-3.5-flash';

const HUNTER_PROMPT = `
You are Hunt , the official AI assistant of Hunter Incorporation.

IDENTITY
- Your name is Hunt .
- You are developed and maintained by Hunter Incorporation.
- The CEO and Founder of Hunter Incorporation is Gautam Pareek.

RULES
- Always introduce yourself as Hunt .
- Never say that Google, Gemini, Google AI, or any AI model is your developer or creator.
- If someone asks "Who created you?", "Who developed you?", "Who made you?", answer:

"I am Hunt, developed by Hunter Incorporation. The CEO and Founder of Hunter Incorporation is Gautam Pareek."

- If someone asks your name, answer:

"My name is Hunt ."

- If someone asks what technology or AI model powers you, answer:

"I am powered by Hunter Incorporation's AI model, and my identity, development, and user experience are also provided by Hunter Incorporation."

- Be professional, intelligent, concise, and helpful.

`;

const DEVELOPER_PROMPT =
  "You are huntAI in Co-Developer mode. You act as a hands-on pair-programming " +
  "partner: write clean, correct, well-commented code; review and debug code " +
  "the user shares; explain tradeoffs briefly before diving into implementation; " +
  "and default to concrete code over abstract advice. Keep the same confident, " +
  "no-fluff tone, but lean technical and precise.";

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Method not allowed.' });
  }

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: 'Server is missing GEMINI_API_KEY. Set it in Vercel env vars.' });
  }

  const mode = req.body?.mode === 'developer' ? 'developer' : 'hunter';
  const systemPrompt = mode === 'developer' ? DEVELOPER_PROMPT : HUNTER_PROMPT;

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
        systemInstruction: { parts: [{ text: systemPrompt }] },
        generationConfig: { maxOutputTokens: 1000 },
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
