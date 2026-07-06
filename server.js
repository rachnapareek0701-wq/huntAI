const express = require('express');
const cors = require('cors');
require('dotenv').config();

const app = express();

// Enable Cross-Origin Resource Sharing (CORS) for frontend connection
app.use(cors());

// Enable parsing of JSON blocks in incoming requests
app.use(express.json());

// Main API Route to handle chat requests from the frontend
app.post('/api/chat', async (req, res) => {
  try {
    const { contents } = req.body;
    
    // Constructing the secure Google Gemini API endpoint using the environment variable
    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${process.env.GEMINI_API_KEY}`;
    
    // Forwarding the request from our server to the official Gemini API
    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: contents,
        systemInstruction: {
          parts: [{ text: "You are huntAI, a sharp, focused AI assistant. You help people track down answers, debug problems, and cut through noise. Keep a confident, precise, no-fluff tone without being curt." }]
        }
      })
    });

    const data = await response.json();
    
    // Sending the API response back to the client browser
    res.json(data);
  } catch (error) {
    console.error("Error processing request on backend:", error);
    res.status(500).json({ error: "Internal Server Error occurred" });
  }
});

// Setting up the server to run on the configured port
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`[huntAI Backend] Server running successfully on port ${PORT}`));
