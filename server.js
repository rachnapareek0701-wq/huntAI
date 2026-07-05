// server.js — huntAI backend
// Handles POST /api/chat, forwards the prompt to the Anthropic API,
// and returns { text } in the shape script.js expects.

require('dotenv').config();
const express = require('express');
const cors = require('cors');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

// Serve the frontend (index.html, script.js, styles) from /public
app.use(express.static('public'));

const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;
const MODEL = process.env.ANTHROPIC_MODEL || 'claude-sonnet-4-6';

app.post('/api/chat', async (req, res) => {
  const { prompt } = req.body || {};

  if (!prompt || typeof prompt !== 'string') {
    return res.status(400).json({ details: 'Missing "prompt" in request body.' });
  }

  if (!ANTHROPIC_API_KEY) {
    return res.status(500).json({ details: 'Server misconfigured: ANTHROPIC_API_KEY is not set.' });
  }

  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: MODEL,
        max_tokens: 1024,
        messages: [{ role: 'user', content: prompt }]
      })
    });

    if (!response.ok) {
      const errorBody = await response.json().catch(() => ({}));
      const message = errorBody?.error?.message || `Anthropic API error (status ${response.status})`;
      return res.status(response.status).json({ details: message });
    }

    const data = await response.json();
    const text = data.content
      ?.filter((block) => block.type === 'text')
      .map((block) => block.text)
      .join('\n') || '(No text response received.)';

    res.json({ text });

  } catch (err) {
    console.error('Backend Exception:', err);
    res.status(500).json({ details: 'Unexpected server error while contacting the AI API.' });
  }
});

app.listen(PORT, () => {
  console.log(`huntAI backend running at http://localhost:${PORT}`);
});
