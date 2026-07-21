# huntAI

Chat UI unchanged from the original — the only change is that the browser
now calls `/api/chat` on your own domain instead of calling a model
provider directly from client-side JS.

This version runs on **Google's Gemini API**, which has a genuinely free
tier (unlike Anthropic's or OpenAI's APIs, which are pay-as-you-go).

## Structure

```
index.html      the chat UI (untouched, just points fetch() at /api/chat)
api/chat.js     Vercel serverless function that holds the API key and
                calls Gemini on the frontend's behalf
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
   - `GEMINI_API_KEY` — a free key from
     https://aistudio.google.com/apikey (sign in with a Google account,
     click "Create API key" — no card required for the free tier)
   - `GEMINI_MODEL` — optional, defaults to `gemini-2.0-flash`
4. Redeploy if you added the vars after the first deploy. That's it —
   your domain will serve the chat UI and `/api/chat` will answer
   requests with the key held server-side.

## Free tier limits

Google's free tier has rate limits (requests per minute/day) that reset
regularly — plenty for personal projects and testing, but worth knowing
about if you expect heavy traffic. Check current limits at
https://ai.google.dev/gemini-api/docs/rate-limits

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
