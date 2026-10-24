# AI Companion

AI Companion is a React + Vite application with three writing and conversation tools:

- **Voice assistant** — a text chat with optional browser speech input and spoken responses.
- **Text generator** — create a first draft from a prompt.
- **AI document editor** — revise supplied writing while preserving the intended meaning.

The browser UI is served by Vite during development. Requests to Groq go through the small Node.js server in `server/`; provider credentials must stay on that server.

## Requirements

- Node.js 20 or newer
- npm
- A Groq API key for live AI responses: [Groq Console](https://console.groq.com/)

## Local development

1. Install dependencies:

   ```sh
   npm ci
   ```

2. Create a local environment file. In PowerShell:

   ```powershell
   Copy-Item .env.example .env
   ```

   Add your real key to `.env`:

   ```dotenv
   GROQ_API_KEY=your_real_key_here
   GROQ_MODEL=mistral-saba-24b
   PORT=3001
   ```

   Do not prefix the provider key with `VITE_`. Vite exposes variables with that prefix to browser code.

3. Start the API server in one terminal:

   ```sh
   npm run server
   ```

4. Start the Vite frontend in a second terminal:

   ```sh
   npm run dev
   ```

   Open the local URL printed by Vite. The development server proxies `/api` requests to the Node server on port 3001.

The API health check is available at `http://127.0.0.1:3001/api/health`.

## Production build

Build the frontend and start the Node server from the project directory:

```sh
npm ci
npm run build
npm start
```

The Node server serves files from `dist/` and handles the `/api` endpoints on the same origin. Set `HOST=0.0.0.0` when your deployment platform requires binding to an external interface. Keep `GROQ_API_KEY` in the hosting provider's server-side environment settings; never add it to frontend build variables.

## Available API routes

| Method | Route | Purpose |
| --- | --- | --- |
| GET | `/api/health` | Checks whether the API process is available and whether a key is configured |
| POST | `/api/chat` | Generates a chat reply from a validated conversation |
| POST | `/api/text` | Generates a draft from `{ "text": "..." }` |
| POST | `/api/document` | Revises text from `{ "text": "..." }` |

Requests are size-limited and input is validated. The server applies a small in-memory per-IP request limit; production deployments exposed to the public internet should add durable rate limiting and, where appropriate, user authentication.

## Quality checks

```sh
npm test
npm run lint
npm run build
```

## Security notes

- `.env` and other local environment files are ignored by Git; `.env.example` contains placeholders only.
- AI provider calls are made by the Node server. The browser never receives the Groq API key.
- Chat messages are rendered as text rather than inserted as HTML.
- Never commit API keys, credentials, private user data, or production environment files. If a key was previously exposed in a client bundle or repository, revoke it and issue a replacement.

## Current limitations

Conversation history is held in browser memory and is not persisted across reloads. Speech recognition and speech synthesis depend on browser support. There is no authentication or durable user/session storage yet.
