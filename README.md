## ChatbotDev — AI Patient Assistant (Web)

![Next.js](https://img.shields.io/badge/Next.js-14-black?logo=nextdotjs)
![TypeScript](https://img.shields.io/badge/TypeScript-5-3178C6?logo=typescript&logoColor=white)
![Tailwind](https://img.shields.io/badge/TailwindCSS-3-38B2AC?logo=tailwindcss&logoColor=white)
![Supabase](https://img.shields.io/badge/Supabase-DB%20%7C%20Auth-3FCF8E?logo=supabase&logoColor=white)
![RAG](https://img.shields.io/badge/RAG-Documents-blueviolet)
![ElevenLabs](https://img.shields.io/badge/Voice-ElevenLabs-orange)
![Vercel](https://img.shields.io/badge/Deploy-Vercel-black?logo=vercel)

### What this is
A production-grade Next.js app that showcases AI-first product engineering for healthcare: multimodal voice chat with an LLM, retrieval‑augmented generation over patient documents, and a secure patient portal with appointments, medications, and files.

### Why it’s interesting
- **AI‑centric UX**: Voice-first chat flow powered by ElevenLabs, with text fallback, tool usage, and streaming responses.
- **RAG over PHI**: Private document ingestion and retrieval with chunking, embeddings, and section‑aware context.
- **Healthcare workflows**: Patients, appointments, medications, and files—built as real product surfaces, not demos.
- **Production concerns**: Auth, RLS, rate limiting, structured logging, and edge functions for secure AI pipelines.

## Key features
- **Voice AI assistant** with ElevenLabs agents (`components/ElevenLabs*`, `lib/elevenlabs.ts`)
- **RAG pipeline** for document search and grounded answers (`supabase/functions/embed/`, `lib/workers/pipeline.ts`)
- **Patient portal**: patients, files, medications, appointments (`app/patients/*`, `tables.ts`)
- **Auth + RLS** via Supabase, safe per‑tenant data boundaries (`supabase/migrations/*`)
- **Edge functions** for chat, embedding, and background processing (`supabase/functions/*`)
- **Typed end‑to‑end** with TypeScript and generated DB types

## Architecture overview
- **Frontend**: Next.js App Router pages in `app/` with UI built from composable components in `components/ui/`.
- **AI layer**:
  - Voice: ElevenLabs React/API agents (`components/ElevenLabs*`, `app/api/elevenlabs/signed-url/route.ts`).
  - RAG: Supabase functions `embed/`, `process/`, and `chat/` orchestrate ingestion → chunking → embeddings → retrieval.
- **Data**: Supabase Postgres with row‑level security; migrations under `supabase/migrations/`.
- **Workers**: Document processing pipeline in `lib/workers/pipeline.ts` and `lib/hooks/use-pipeline.ts`.

## Tech stack
- **Next.js 14 (App Router), TypeScript, TailwindCSS**
- **Supabase** (Postgres, Auth, Storage, Edge Functions)
- **ElevenLabs** for realtime voice
- **Embeddings + RAG** with chunked sections and metadata for grounding

## Notable engineering highlights
- **Section‑aware RAG**: Document sections are normalized and reset migrations ensure deterministic structure for retrieval quality.
- **Signed media URLs**: Secure voice/media access via signed URLs (`app/api/elevenlabs/signed-url/route.ts`).
- **Composable UI**: Reusable `components/ui/*` built for fast product iteration.
- **Strict typing**: Shared types in `lib/types.d.ts` and database helpers in `supabase/_lib/*`.

## AI/ML surface area
- **Conversation orchestration** with tools (RAG, files, appointments) callable from the assistant.
- **Latency-aware UX**: Streaming responses and voice barge‑in patterns.
- **Grounding and provenance**: Answers cite retrieved sections; storage paths normalized by migrations for consistency.

## Repo structure (selected)
- `app/` — Next.js routes: `chat/`, `patients/[id]/*`, `dashboard/`, `files/`
- `components/` — UI and AI components: `ElevenLabsAgent.tsx`, `VoiceButton.tsx`
- `lib/` — AI clients, hooks, workers, utils
- `supabase/functions/` — `chat/`, `embed/`, `process/`, `update-patient-profile/`
- `supabase/migrations/` — database schema and RLS
- `tables.ts` — centralized table/column accessors

## Demos and media
- Short demo clip: add your link here
- Screenshots: place images under `assets/` and reference them below

```
assets/
  hero.png
  instructions.png
```

## Contact
- If you’d like a quick tour or technical deep‑dive, feel free to reach out. 
