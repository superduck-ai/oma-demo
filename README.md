# Claude Managed Agent Session Console

Local verification console for Claude Managed Agent sessions.

## Setup

Create `.env` from `.env.example`:

```bash
OMA_SERVER_URL=http://127.0.0.1:38080
API_KEY=...
```

`API_KEY` is only read on the TanStack Start server side. The browser stores only UI preferences in `localStorage`: last agent id, environment id, and active session id.

## Scripts

```bash
bun install
bun run dev
bun run typecheck
bun run test
bun run build
```

The local SQLite database is created at `.data/oma-demo.sqlite`.

## Default Debug IDs

```text
agent_PQ4fur0FFfQ55AQ5EZK4JJnY
env_jB6LGpGDdxXAEbnShOGztgsF
```

## Notes

The app uses TanStack Start server functions for the local API boundary. Those functions create the Anthropic SDK client with:

```ts
new Anthropic({
  baseURL: process.env.OMA_SERVER_URL,
  apiKey: process.env.API_KEY,
})
```

The UI supports local session indexing, persisted session events, pending tool confirmations, custom tool results, sync, and a raw debug drawer.
