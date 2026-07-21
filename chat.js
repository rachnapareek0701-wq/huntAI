// Vercel serverless function: POST /api/chat
// Holds the Anthropic API key server-side and proxies chat requests to it.
// Set ANTHROPIC_API_KEY (and optionally ANTHROPIC_MODEL) in your Vercel
// project's Settings -> Environment Variables.

const MODEL = process.env.ANTHROPIC_MODEL || 'claude-sonnet-4-6';

const SYSTEM_PROMPT =
  "You are huntAI, a sharp, focused AI assistant. You help people track down " +
  "answers, debug problems, and cut through noise. Keep a confident, precise, " +
  "no-fluff tone without being curt.";

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Method not allowed.' });
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: 'Server is missing ANTHROPIC_API_KEY. Set it in Vercel env vars.' });
  }

  const messages = Array.isArray(req.body?.messages) ? req.body.messages : null;
  if (!messages || messages.length === 0) {
    return res.status(400).json({ error: 'No messages provided.' });
  }

  // Keep the payload to role/content only, and cap history length so a
  // single client can't send an unbounded conversation.
  const trimmed = messages.slice(-40).map((m) => ({
    role: m.role === 'assistant' ? 'assistant' : 'user',
    content: String(m.content ?? '').slice(0, 8000),
  }));

  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: MODEL,
        max_tokens: 1000,
        system: SYSTEM_PROMPT,
        messages: trimmed,
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      const message = data?.error?.message || 'Anthropic API request failed.';
      return res.status(response.status).json({ error: message });
    }

    const reply = (data.content || [])
      .map((block) => block.text || '')
      .filter(Boolean)
      .join('\n');

    return res.status(200).json({ reply: reply || "huntAI didn't return a reply. Try again." });
  } catch (err) {
    console.error('Anthropic API error:', err);
    return res.status(500).json({ error: 'Could not reach the Anthropic API.' });
  }
};
