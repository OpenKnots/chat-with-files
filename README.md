## Chat with Docs or GitHub

This repo is a minimal, **educational starter** for building a chatbot that can **chat with a docs page URL** or a **codebase via a GitHub repo URL** using:

- **Next.js App Router** (UI + API route)
- **AI SDK** (`ai`, `@ai-sdk/react`, `@ai-sdk/openai`) for streaming UI messages + tool calls
- A **ToolLoopAgent** that can call tools to fetch docs pages or read code
- A small **tool UI renderer** that shows retrieval/summarization progress/output inside the chat

It’s intentionally small so you can fork it and create your own custom variant (different models, tools, schemas, UI, and routing).

---

## What you get

- **Chat UI** (Vercel-ish dark, mobile-first) with a fixed composer + suggestion pills (`app/page.tsx`, `components/chat-input.tsx`)
- **Tool UI** that renders tool progress/output inline as “cards” (`components/docs-view.tsx`)
- **Single API endpoint** that streams agent UI messages (`app/api/chat/route.ts`)
- **Agent definition** with tools and model selection (`agent/docs-agent.tsx`)
- **Documentation tool** that can fetch a docs page or read a GitHub repo into structured docs (`tool/docs-tool.ts`)

<!-- --- -->

<!-- ## UI preview

![Chat conversation](public/assets/chat-conversation.png) -->

---

## How it works (end-to-end)

### 1) UI sends chat messages

`app/page.tsx` uses `useChat()` from `@ai-sdk/react`. By default it POSTs to **`/api/chat`** with `{ messages }`, and receives a streaming response of UI message “parts” (text, step markers, tool calls).

### 2) API streams the agent’s UI response

`app/api/chat/route.ts` passes the incoming `messages` to `createAgentUIStreamResponse({ agent, uiMessages })`, which streams back UI-friendly message parts.

### 3) Agent chooses when to call tools

`agent/docs-agent.tsx` defines a `ToolLoopAgent` that uses an OpenAI model and a `tools` map:

- Tool name: `docs`
- Tool implementation: `docsTool`

The agent can emit normal text **and** invoke tools during its reasoning loop.

### 4) Tools stream progress + output

`tool/docs-tool.ts` defines a streaming tool via `tool({ inputSchema, execute })`:

- `inputSchema`: validates tool inputs with `zod`
- `execute`: is an async generator (`async *`) that can yield intermediate states

This tool yields `{ state: "loading" }` first, then `{ state: "ready", docs: { ... } }`.

### 5) UI renders tool calls in the chat

When the agent calls a tool, `useChat()` receives a message part like `tool-docs`. `app/page.tsx` routes those parts into `components/docs-view.tsx`, which renders:

- input streaming/available (the tool is about to run)
- output available (loading/ready)
- output error

---

## Prerequisites

- Node.js (modern LTS recommended)
- **Bun** (recommended) or npm/pnpm/yarn
- An OpenAI API key (or swap provider/model; see below)

---

## Setup

### 1) Install dependencies

Using Bun:

```bash
bun install
```

Using npm:

```bash
npm install
```

### 2) Configure environment variables

Create `.env.local`:

```bash
OPENAI_API_KEY=your_key_here
```

Notes:

- The OpenAI provider reads `OPENAI_API_KEY` from the environment.
- The included docs tool can fetch a docs URL or read a GitHub repo; keep inputs scoped to avoid slow responses.

### 3) Run the dev server

```bash
bun dev
```

Then open `http://localhost:3000`.

---

## Quick usage examples

Try prompts like:

- “Chat with https://example.com/docs and summarize the key sections.”
- “Load https://docs.myproduct.com and answer: how do I create a token?”
- “Chat with https://github.com/acme/my-repo and explain the `app/` folder.”

---

## Customization guide (build your own variant)

### Change the model

Edit `agent/docs-agent.tsx`:

- Swap `openai("gpt-4o")` to a different model string
- Or switch providers entirely (e.g. another AI SDK provider package)

Keep the rest of the architecture the same.

### Add a new tool (recommended learning path)

1. **Create a tool file** (e.g. `tool/api-docs-tool.ts`)

   - Define `tool({ description, inputSchema, execute })`
   - Use `zod` to validate inputs
   - Yield intermediate states if you want progressive UI updates

2. **Register the tool on the agent**

In `agent/docs-agent.tsx`, add it to `tools`:

- `tools: { docs: docsTool, apiDocs: apiDocsTool }`

3. **Render it in the UI**

In `app/page.tsx`, add a new `case "tool-api-docs": ...` and create a renderer component similar to `components/docs-view.tsx`.

### Extend the existing tool into a docs tool

`tool/docs-tool.ts` can be extended with documentation-focused capabilities that:

- Accepts a **URL or repo scope** (docs page URL, GitHub repo URL, or a subpath)
- Reads content and extracts **purpose, public APIs, and usage**
- Emits **structured output** (JSON) for sections like Overview, API, and Examples

### Customize the chat UI

Key files:

- `app/page.tsx`: chat shell (header/content/footer), message loop + routing message “parts”, builds dynamic suggestion prompts
- `components/chat-input.tsx`: composer (`textarea`), Enter-to-send, and optional suggestion pills
- `components/docs-view.tsx`: tool output display
- `app/globals.css`: global styling (Tailwind)

---

## Project structure

```text
app/
  api/chat/route.ts      # POST /api/chat → streams agent UI response
  globals.css            # global theme + markdown tweaks
  layout.tsx             # app shell + fonts
  page.tsx               # Chat UI using useChat()
agent/
  docs-agent.tsx         # ToolLoopAgent definition (model + tools)
tool/
  docs-tool.ts           # Streaming tool (zod schema + execute generator)
components/
  chat-input.tsx         # Chat input component
  docs-view.tsx          # Tool invocation renderer
public/
  assets/
    chat-conversation.png
  logo.png
```

---

## Scripts

```bash
bun dev     # run locally
bun build   # production build
bun start   # run production server
bun lint    # lint
```

---

## Deployment notes

This is a standard Next.js App Router project. On Vercel (or similar), ensure:

- `OPENAI_API_KEY` is set in your deployment environment
- Your chosen model/provider is supported in the runtime you deploy to

---

## Troubleshooting

### Chat input is disabled / can’t send messages

- **Cause**: `useChat()` disables input unless `status === "ready"`.
- **Fix**:
  - Make sure the dev server is running (`bun dev`) and the page loads without errors.
  - If it becomes stuck after an error, refresh the page to reset state.

### 401/403 or “Unauthorized” from the model provider

- **Cause**: Missing or invalid `OPENAI_API_KEY`.
- **Fix**:
  - Add `OPENAI_API_KEY=...` to `.env.local`.
  - **Restart** the dev server after changing env vars.
  - If deployed, set the env var in your hosting provider’s environment settings.

### The assistant responds, but tools fail (error shown in red)

- **Cause**: The tool threw an error (fetch/read failure, bad input, provider response not OK).
- **Fix**:
  - Try a smaller scope like a single docs page or a subfolder in the repo.
  - Ensure the URL you requested exists and is reachable.
  - For GitHub, ensure the repo URL is public or your tooling supports auth.
  - Check the server console for the full error message.

### Large repo responses are slow or time out

- **Cause**: The tool is processing too many files/pages at once.
- **Fix**:
  - Scope requests to a folder/file or a single docs page.
  - Add caching or precomputed summaries for large repos or docs sites.

### Tool output looks like a JSON string

- **Cause**: The tool currently returns a JSON string and the view renders it directly.
- **Fix**:
  - Return a structured object from the tool and render a richer UI in `components/chat-view.tsx`.

---

## License

MIT
