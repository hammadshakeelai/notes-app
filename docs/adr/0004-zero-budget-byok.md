# ADR-0004: $0 budget: free tiers only, bring your own keys

- **Status:** Accepted
- **Date:** 2026-09-18

## Context

The student prefers $0. Their consumer subscriptions (Google AI Pro, Claude Pro, ChatGPT Plus) do not include API access. The repo is public.

## Decision

Use free tiers only: Gemini, Groq, Tavily, Wikipedia, Google Drive, GitHub Pages. Every user supplies their own keys, stored only on their device (Android Keystore, browser storage) or in a git-ignored `.env` for scripts. The template is `.env.example`. No keys ever go in the repo.

## Consequences

Quality and availability depend on free limits and overload (ADR-0007). Claude is not used by the app.

## Alternatives considered

Claude API for the AI part (~$2-15 a month): rejected on budget.
