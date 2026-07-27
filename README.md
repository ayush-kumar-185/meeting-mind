# MeetingMind
*Otter transcribes your meetings. MeetingMind makes sure everything that was said actually gets done.*

MeetingMind is an AI meeting intelligence platform. Rather than serving as just a transcription tool, it takes a raw transcript as input and focuses squarely on the post-meeting accountability layer: structured extraction, attribution, and follow-through.

## Demo
`[Demo GIF here]`

`[Live link here]`

## Features
- **AI Extraction**: Paste a transcript, and Gemini extracts a structured summary, key decisions, unresolved issues, and per-person action items (with priority and inferred deadlines). We also extract softer verbal commitments. Null and empty-array fallbacks are explicitly handled when data isn't present to prevent hallucinated content.
- **Accountability Tools**: Push real issues to Jira (via Atlassian OAuth 2.0), trigger per-attendee follow-up emails filtered to show only their own items (via Resend), and schedule 24-hour advance reminders using BullMQ.
- **Team Workspaces**: Support for multiple workspaces including an invite system with pending-to-active acceptance flows. Built-in role-based permissions (admin/member) and owner-only workspace deletion ensuring full cascading cleanup.
- **Cross-Meeting Intelligence**: Runs on-demand pattern detection that flags recurring blockers and unresolved topics across a team's entire meeting history using Gemini-based semantic comparison (rather than simple keyword matching).


## Tech Stack
- **Frontend**: React, Vite, Tailwind CSS v4, shadcn/ui (Base UI primitives), Sonner (Toasts)
- **Backend**: Node.js, Express, MongoDB Atlas (Mongoose), BullMQ + Upstash Redis
- **Auth**: Google OAuth (Passport.js) + JWT
- **AI**: Google Gemini API (`gemini-2.5-flash`)
- **Integrations**: Jira Cloud REST API v3 (Atlassian OAuth 2.0 / 3LO)
- **Email**: Resend
- **Validation**: Zod

## Architecture & Async Extraction
MeetingMind features an asynchronous extraction pipeline to handle long-running AI tasks:
1. A transcript is submitted and immediately saved with a `processing` status.
2. A BullMQ job is enqueued and picked up by a background worker.
3. The worker invokes the Gemini API with strict JSON-schema validation and retry-hardened logic.
4. The structured results are persisted in MongoDB.
5. The frontend polls for status until it reflects as `ready`.

This design decouples the user experience from API latency and ensures reliability for large payloads.

## Known Limitations
- **Attribution & Entity Resolution**: Attendees are matched by name string-matching rather than true entity resolution. Duplicate names require manual disambiguation (e.g., using the optional `title` tag) rather than being resolved automatically from context alone.
- **Integrations**: Currently, only Jira is supported for ticket pushing. Linear and Notion are natural next steps but were deferred to ensure deep integration with Atlassian first.
- **ROI Scoring**: The cost estimate is illustrative (using a flat-rate assumption) and not a precise financial or payroll-backed model.
- **Ingestion**: Transcripts are pasted manually. Live transcription or automated ingestion via Zoom/Google Calendar webhooks are out-of-scope to protect engineering time for the core extraction engine.
- **Atlassian OAuth**: The Atlassian app is in "development" distribution, restricting authorization to the app owner unless additional users are added as testers.

## Setup & Running Locally

1. Clone the repository and navigate into it.
2. Install dependencies for both the frontend and backend:
   ```bash
   cd frontend
   npm install
   cd ../backend
   npm install
   ```
3. Create `.env` files in both directories. You will need the following environment variables:
   
   **Backend:**
   - `MONGO_URI`
   - `REDIS_URL`
   - `JWT_SECRET`
   - `GOOGLE_CLIENT_ID`
   - `GOOGLE_CLIENT_SECRET`
   - `GEMINI_API_KEY`
   - `RESEND_API_KEY`
   - `JIRA_CLIENT_ID`
   - `JIRA_CLIENT_SECRET`
   
   **Frontend:**
   - `VITE_API_URL`
4. Start the development servers:
   ```bash
   # In the backend/ directory
   npm run dev

   # In the frontend/ directory
   npm run dev
   ```


