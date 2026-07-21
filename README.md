# huntAI

Chat UI unchanged from the original — the only change is that the browser
now calls `/api/chat` on your own domain instead of hitting Anthropic
directly from client-side JS (which only ever worked inside a Claude.ai
artifact, and would expose your API key everywhere else).

## Structure

```
index.html      the chat UI (untouched, just points fetch() at /api/chat)
api/chat.js     Vercel serverless function that holds the API key and
                calls Anthropic on the frontend's behalf
```

No dependencies to install — `api/chat.js` uses the `fetch` that's built
into Vercel's Node runtime.

## Deploy

1. Push this repo to GitHub.
2. On vercel.com, "Add New Project" → import the repo. Vercel auto-detects
   `index.html` as a static file and `api/chat.js` as a serverless
   function — no build config needed.
3. Before (or after) the first deploy, go to
   **Project Settings → Environment Variables** and add:
   - `ANTHROPIC_API_KEY` — your key from
     https://console.anthropic.com/settings/keys
   - `ANTHROPIC_MODEL` — optional, defaults to `claude-sonnet-4-6`
4. Redeploy if you added the vars after the first deploy. That's it —
   your domain will serve the chat UI and `/api/chat` will answer
   requests with the key held server-side.

## Local testing

Vercel's CLI can run the function locally:

```bash
npm i -g vercel
vercel dev
```

It'll prompt you to link the project and pick up `.env` (copy
`.env.example` to `.env` and fill in your key first).

## Notes

- Conversation history lives only in the browser tab (same as the
  original) and is resent with each request — nothing is stored
  server-side.
- The function trims each request to the last 40 messages and caps
  message length as a basic safeguard; adjust in `api/chat.js` if needed.
