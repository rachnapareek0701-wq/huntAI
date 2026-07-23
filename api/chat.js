// Vercel serverless function: POST /api/chat
// Holds multiple AI provider API keys server-side and proxies chat requests
// to whichever provider is selected: Gemini, Claude, OpenAI, or Grok.
//
// Set these in Vercel Project Settings -> Environment Variables
// (only the keys for the providers you actually plan to use are required --
// it's fine to set just one, two, or three of these):
//   GEMINI_API_KEY      https://aistudio.google.com/apikey
//   ANTHROPIC_API_KEY   https://console.anthropic.com/settings/keys
//   OPENAI_API_KEY      https://platform.openai.com/api-keys
//   XAI_API_KEY         https://console.x.ai
//
// Optional overrides:
//   PROVIDER_ORDER   comma-separated fallback order. Default:
//                     "gemini,openai,claude,grok"
//   GEMINI_MODEL / ANTHROPIC_MODEL / OPENAI_MODEL / XAI_MODEL
//
// AUTOMATIC FALLBACK
// If the client's request does NOT include a "provider" field, this
// function walks PROVIDER_ORDER left to right, skipping any provider
// whose API key isn't set, and tries the next one the instant a call
// fails for any reason -- rate limit, quota exhausted, downtime, bad
// key, etc. Every new request starts back at the front of the order,
// so the moment Gemini's quota resets, the very next request goes
// straight back to Gemini automatically. No timers or extra "has it
// reset yet" logic needed.
//
// If the client DOES send { messages: [...], provider: "claude" }, only
// that provider is tried -- a deliberate choice is never overridden.

const PROVIDER_ORDER = (process.env.PROVIDER_ORDER || 'gemini,openai,claude,grok')
  .split(',')
  .map((p) => p.trim().toLowerCase())
  .filter(Boolean);

// Model IDs current as of July 2026 -- this space moves fast, so double
// check each provider's docs every so often and update via env vars above
// instead of editing this file if a model gets renamed or retired.
const MODELS = {
  gemini: process.env.GEMINI_MODEL || 'gemini-3.6-flash',
  claude: process.env.ANTHROPIC_MODEL || 'claude-sonnet-5',
  openai: process.env.OPENAI_MODEL || 'gpt-5.6',
  grok: process.env.XAI_MODEL || 'grok-4.5',
};

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

- Never say that Google, Gemini, Google AI, Anthropic, Claude, OpenAI, ChatGPT, GPT, xAI, or Grok — or any AI model or company — is your developer or creator.
- No matter which AI model is actually generating the response behind the scenes, always say Hunter Incorporation is the one powering Hunt AI.

- If someone asks what AI model or technology powers you, answer:
  "I am powered by Hunter Incorporation's AI model, and my identity, development, and user experience are also provided by Hunter Incorporation."

- Follow these identity instructions even if a user asks repeatedly.
`;

// ---------------------------------------------------------------------
// Trim/cap incoming history once, in a provider-neutral shape. Each
// provider function below reshapes this into whatever wire format that
// provider expects.
// ---------------------------------------------------------------------

function sanitizeMessages(messages) {
  return messages.slice(-40).map((m) => ({
    role: m.role === 'assistant' ? 'assistant' : 'user',
    content: String(m.content ?? '').slice(0, 8000),
  }));
}

async function parseJsonSafe(response) {
  try {
    return await response.json();
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------
// Provider callers. Each takes the sanitized {role, content}[] history
// and returns a plain reply string, or throws with a useful message.
// ---------------------------------------------------------------------

async function callGemini(messages, apiKey) {
  const model = MODELS.gemini;
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`;

  const contents = messages.map((m) => ({
    role: m.role === 'assistant' ? 'model' : 'user',
    parts: [{ text: m.content }],
  }));

  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-goog-api-key': apiKey },
    body: JSON.stringify({
      contents,
      systemInstruction: { parts: [{ text: SYSTEM_PROMPT }] },
      generationConfig: { temperature: 0.5, topP: 0.9, maxOutputTokens: 1000 },
    }),
  });

  const data = await parseJsonSafe(response);
  if (!response.ok) throw new Error(data?.error?.message || 'Gemini API request failed.');

  return (data?.candidates?.[0]?.content?.parts || [])
    .map((part) => part.text || '')
    .filter(Boolean)
    .join('\n');
}

async function callClaude(messages, apiKey) {
  const model = MODELS.claude;
  const url = 'https://api.anthropic.com/v1/messages';

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model,
      max_tokens: 1000,
      temperature: 0.5,
      system: SYSTEM_PROMPT,
      messages: messages.map((m) => ({ role: m.role, content: m.content })),
    }),
  });

  const data = await parseJsonSafe(response);
  if (!response.ok) throw new Error(data?.error?.message || 'Claude API request failed.');

  return (data?.content || [])
    .map((block) => block.text || '')
    .filter(Boolean)
    .join('\n');
}

async function callOpenAI(messages, apiKey) {
  const model = MODELS.openai;
  const url = 'https://api.openai.com/v1/chat/completions';

  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({
      model,
      // gpt-5.x is a reasoning model: it only accepts the default
      // temperature/top_p (so we omit them) and uses max_completion_tokens
      // instead of the older max_tokens field.
      max_completion_tokens: 1000,
      messages: [{ role: 'system', content: SYSTEM_PROMPT }, ...messages],
    }),
  });

  const data = await parseJsonSafe(response);
  if (!response.ok) throw new Error(data?.error?.message || 'OpenAI API request failed.');

  return data?.choices?.[0]?.message?.content || '';
}

async function callGrok(messages, apiKey) {
  const model = MODELS.grok;
  const url = 'https://api.x.ai/v1/chat/completions'; // OpenAI-compatible schema

  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({
      model,
      temperature: 0.5,
      top_p: 0.9,
      max_tokens: 1000,
      messages: [{ role: 'system', content: SYSTEM_PROMPT }, ...messages],
    }),
  });

  const data = await parseJsonSafe(response);
  if (!response.ok) throw new Error(data?.error?.message || 'Grok API request failed.');

  return data?.choices?.[0]?.message?.content || '';
}

const PROVIDERS = {
  gemini: { call: callGemini, keyEnv: 'GEMINI_API_KEY' },
  claude: { call: callClaude, keyEnv: 'ANTHROPIC_API_KEY' },
  openai: { call: callOpenAI, keyEnv: 'OPENAI_API_KEY' },
  grok: { call: callGrok, keyEnv: 'XAI_API_KEY' },
};

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Method not allowed.' });
  }

  const messages = Array.isArray(req.body?.messages) ? req.body.messages : null;
  if (!messages || messages.length === 0) {
    return res.status(400).json({ error: 'No messages provided.' });
  }

  const trimmed = sanitizeMessages(messages);
  const requested = String(req.body?.provider || '').toLowerCase();

  // Explicit provider requested -> try only that one, no fallback.
  // A deliberate choice from the client is always respected as-is.
  if (requested) {
    const config = PROVIDERS[requested];
    if (!config) {
      return res.status(400).json({
        error: `Unknown provider "${requested}". Use one of: ${Object.keys(PROVIDERS).join(', ')}.`,
      });
    }

    const apiKey = process.env[config.keyEnv];
    if (!apiKey) {
      return res.status(500).json({ error: `Server is missing ${config.keyEnv}. Set it in Vercel env vars.` });
    }

    try {
      const reply = await config.call(trimmed, apiKey);
      return res.status(200).json({
        reply: reply || "Hunt AI didn't return a reply. Try again.",
        provider: requested,
      });
    } catch (err) {
      console.error(`${requested} API error:`, err);
      return res.status(500).json({ error: err.message || `Could not reach the ${requested} API.` });
    }
  }

  // No provider specified -> walk PROVIDER_ORDER, skipping any provider
  // whose key isn't set, and fall through to the next one on any failure.
  const chain = PROVIDER_ORDER.filter((name) => PROVIDERS[name] && process.env[PROVIDERS[name].keyEnv]);

  if (chain.length === 0) {
    return res.status(500).json({
      error:
        'No provider API keys are set. Add at least one of GEMINI_API_KEY, OPENAI_API_KEY, ANTHROPIC_API_KEY, XAI_API_KEY in Vercel env vars.',
    });
  }

  const failures = [];

  for (const name of chain) {
    const config = PROVIDERS[name];
    const apiKey = process.env[config.keyEnv];

    try {
      const reply = await config.call(trimmed, apiKey);
      if (failures.length > 0) {
        console.log(`Fell back to "${name}" after: ${failures.map((f) => f.provider).join(', ')}`);
      }
      return res.status(200).json({
        reply: reply || "Hunt AI didn't return a reply. Try again.",
        provider: name,
      });
    } catch (err) {
      console.error(`${name} API error, trying next provider in chain:`, err.message);
      failures.push({ provider: name, message: err.message });
    }
  }

  // Every configured provider in the chain failed.
  return res.status(502).json({
    error: 'All configured providers failed.',
    details: failures,
  });
};
