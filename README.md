## ChatbotDev — AI Patient Assistant (Web)

![Next.js](https://img.shields.io/badge/Next.js-14-black?logo=nextdotjs)
![TypeScript](https://img.shields.io/badge/TypeScript-5-3178C6?logo=typescript&logoColor=white)
![Tailwind](https://img.shields.io/badge/TailwindCSS-3-38B2AC?logo=tailwindcss&logoColor=white)
![Supabase](https://img.shields.io/badge/Supabase-DB%20%7C%20Auth-3FCF8E?logo=supabase&logoColor=white)
![RAG](https://img.shields.io/badge/RAG-Documents-blueviolet)
![ElevenLabs](https://img.shields.io/badge/Voice-ElevenLabs-orange)
![Vercel](https://img.shields.io/badge/Deploy-Vercel-black?logo=vercel)

### What this is
This project addresses an important challenge that elderly individuals face in the digital healthcare field. It focuses on developing a comprehensive personal health management application for users, by integrating AI-powered assistance to improve healthcare tracking, companionship, and cognitive engagement

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


## Media

#### Landing Page
<img width="1181" height="891" alt="image" src="https://github.com/user-attachments/assets/39fe8882-cee4-4af0-bcc1-ba5a7978030d" />

#### Doctors Dashboard to manage patients
<img width="1290" height="881" alt="image" src="https://github.com/user-attachments/assets/4af625ec-a1dc-4fc8-8777-4e66e47ef37e" />

#### Patient Management
<img width="1169" height="481" alt="Screenshot 2025-08-28 at 11 04 06" src="https://github.com/user-attachments/assets/e02c3601-1fcb-4a5f-bdc3-9ed603a81b61" />

#### Patient's Dashboard
<img width="1018" height="934" alt="image" src="https://github.com/user-attachments/assets/d9eb5439-5041-454d-8938-90c56c9d9c26" />

#### Chatbot that accesses all patients data
<img width="1500" height="853" alt="Screenshot 2025-08-28 at 11 07 56" src="https://github.com/user-attachments/assets/eed3c6f8-5dfc-49d3-8fe5-53ce0fe21542" />




## Companion Mobile App
Looking for the mobile experience? See the companion app here: [elderly-project/MobileApp](https://github.com/elderly-project/MobileApp).
_The mobile app for the elderly people to use is available at [https://github.com/elderly-project/MobileApp](https://github.com/elderly-project/MobileApp)._ 

## Contact
- If you’d like a quick tour or technical deep‑dive, feel free to reach out.


