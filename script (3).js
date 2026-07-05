// script.js — huntAI Neural System frontend logic

const chatEl = document.getElementById('chat');
const inputEl = document.getElementById('msg');

/**
 * Appends a message bubble to the chat window.
 * @param {string} text - message content
 * @param {'ai'|'user'} sender - who sent it, controls styling
 */
function renderMessage(text, sender = 'ai') {
  const msg = document.createElement('div');
  msg.className = `message ${sender}`;
  msg.textContent = text;
  chatEl.appendChild(msg);
  chatEl.scrollTop = chatEl.scrollHeight;
}

/**
 * Shows an error bubble in the chat window so failures are visible to the user.
 * @param {string} text
 */
function displayErrorState(text) {
  const msg = document.createElement('div');
  msg.className = 'message ai';
  msg.style.borderLeftColor = '#ff4444';
  msg.style.color = '#ff8888';
  msg.textContent = `⚠️ ${text}`;
  chatEl.appendChild(msg);
  chatEl.scrollTop = chatEl.scrollHeight;
}

/**
 * Sends the current input value to the backend and renders the reply.
 * Mirrors the fetch/error-handling logic supplied in responce.ok.
 * @param {string} userPrompt
 */
async function sendQuery(userPrompt) {
  try {
    const response = await fetch('/api/chat', {
      method: 'POST',
      body: JSON.stringify({ prompt: userPrompt }),
      headers: { 'Content-Type': 'application/json' }
    });

    // If the server returns a 4xx or 5xx status, catch it early
    if (!response.ok) {
      const errorPayload = await response.json().catch(() => ({}));
      throw new Error(errorPayload.details || `HTTP error! status: ${response.status}`);
    }

    const data = await response.json();
    renderMessage(data.text, 'ai');

  } catch (err) {
    console.error("Frontend Exception Captured:", err);
    displayErrorState("Connection broken. Verify API keys or internet status.");
  }
}

/**
 * Handles the chat form submission: renders the user's message immediately,
 * clears the input, then kicks off the backend request.
 * @param {Event} [event]
 */
function send(event) {
  if (event) event.preventDefault();

  const value = inputEl.value.trim();
  if (!value) return;

  renderMessage(value, 'user');
  inputEl.value = '';
  inputEl.focus();

  sendQuery(value);
}
