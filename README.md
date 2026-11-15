# Mine AI

Mine AI is a Gemini inspired AI chat and voice assistant. Chat messages use Groq; voice turns use Gemini for the response, with browser speech recognition and speech synthesis for the microphone and spoken reply.

Image analysis is available from the plus button in the composer and uses Groq's `qwen/qwen3.8-27b` vision model. Upload a PNG, JPG, or WebP image and include a question, or leave the prompt blank for a general description.

## Run locally

1. Install Node.js 18 or later.
2. Copy `.env.example` to `.env`.
3. Add your Groq and Google AI Studio API keys to `.env`:

   ```env
   GROQ_API_KEY=...
   GEMINI_API_KEY=...
   ```

4. Run `npm start` and open `http://localhost:3000`.

The keys are only read by the local server. Voice input requires a browser with the Web Speech API (Chrome and Edge support it); microphone permission may be required. Images are resized in the browser before being sent to Groq. Conversations are stored in the current browser's local storage.
