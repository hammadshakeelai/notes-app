# ADR-0012: One study chat per subject: lectures first, then the web

- **Status:** Accepted
- **Date:** 2026-09-18

## Context

The student wants a chatbot with free web search to learn more.

## Decision

One chat per subject. It answers from that subject's transcripts and notes first, with lecture and timestamp, then from the web: Tavily (1,000 a month), Google Search grounding on Gemini 2.5 models (1,500 a day, within those models' limits) and Wikipedia. Sources are labelled "From your lectures" or "From the web". It runs on Flash-Lite, with Gemma 4 as fallback.

## Consequences

Gemini 3 models have no free search grounding, so grounded search uses Gemini 2.5 models.

## Alternatives considered

Two separate chats: offered, not chosen.
