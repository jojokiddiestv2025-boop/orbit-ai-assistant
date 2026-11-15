# Mine AI

Mine AI 1.0 is an AI chat and voice assistant created by Joshua Fred. Chat and image analysis use Groq-hosted models, including an OpenAI model; voice responses use Google Gemini. These APIs process requests at runtime. This app does not train models on API responses or user conversations. Voice input uses browser speech recognition and speech synthesis for spoken replies.

Image analysis is available from the plus button in the composer. Upload a PNG, JPG, or WebP image and include a question, or leave the prompt blank for a general description.

## Run locally

1. Install Node.js 20.19 or later.
2. Copy `.env.example` to `.env`.
3. Add your Groq and Google AI Studio API keys to `.env`:

   ```env
   GROQ_API_KEY=...
   GEMINI_API_KEY=...
   ```

4. Run `npm install`, then `npm run dev` and open the Vite URL shown in the terminal (usually `http://localhost:5173`).

The keys are read only by server-side code. Voice input requires a browser with the Web Speech API (Chrome and Edge support it); microphone permission may be required. Images are resized in the browser before being sent to Groq. Conversations are stored in the current browser's local storage.

## Deploy to Vercel

1. Import the [public GitHub repository](https://github.com/jojokiddiestv2025-boop/orbit-ai-assistant) in Vercel.
2. In the Vercel project settings, add `GROQ_API_KEY` and `GEMINI_API_KEY` under **Environment Variables** for Production (and Preview if wanted). The latter is the server-side credential used by Mine AI Voice.
3. Deploy. Vercel builds the React app with Vite into `dist/` and serves the `/api` handlers as Node.js Functions.
4. Redeploy after changing environment variables so the new values are applied.

For local Vercel emulation, install the Vercel CLI and run `vercel dev` from the project directory after setting the same environment variables.
