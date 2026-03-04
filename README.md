# Claude Tokenizer

Anthropic doesn't expose Claude's tokenizer. You can count tokens via the API, but you can't see *where the splits actually are*. This tool fixes that.

![Claude Tokenizer Screenshot](web/public/screenshot.png)

## The problem

- Claude's tokenizer is proprietary — no public library, no downloadable vocab file
- The API only gives you a token count, not the actual token boundaries
- When you're trying to reduce token usage, you're flying blind without seeing the splits
- The official JS tokenizer package is only accurate for pre-Claude 3 models

## How it works

Uses an incremental `max_tokens` trick to extract exact token boundaries:

1. Ask Claude to repeat your text with `max_tokens: 1` → get the first token
2. Same prompt with `max_tokens: 2` → get tokens 1+2, diff to find token 2
3. Keep incrementing until the full text is reproduced
4. `temperature: 0` ensures deterministic output across calls

This avoids the **prefill re-tokenization problem** — if you try to use assistant prefill to continue generation, the API re-tokenizes your prefill text, which shifts token boundaries and corrupts the continuation.

## What's in here

- **CLI** (`index.ts`) — pipe text in, get token boundaries out
- **Web app** (`web/`) — Next.js app with streaming results, bring your own API key

## Setup

```bash
# CLI
npm install
echo "ANTHROPIC_API_KEY=sk-ant-..." > .env
npm run tokenize -- "your text here"

# Web app
cd web
npm install
ln -s ../.env .env.local  # or set ANTHROPIC_API_KEY in .env.local
npm run dev
```

## Caveats

- One API call per token — slow and costs money, this is a debugging tool not a production service
- The model doesn't always perfectly reproduce long or complex text
- Token boundaries are as accurate as Claude's `temperature: 0` determinism (which is very good but not guaranteed across API versions)
