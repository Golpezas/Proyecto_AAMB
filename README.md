# Proyecto_AAMB — Ping Platform

Plataforma de notificaciones privacy-first para creadores de contenido. Los fans se suscriben de forma anónima (PIN o wallet) y reciben SMS/Push sin que el creador jamás vea su número telefónico.

## Stack

- **Backend:** FastAPI + Pydantic + Supabase (PostgreSQL con RLS)
- **Web3:** Privy (embedded wallets), PIN bcrypt
- **Cola:** Upstash Redis + QStash
- **SMS:** Twilio | **Push:** OneSignal
- **Frontend:** Next.js 14 + Tailwind + shadcn/ui
- **Deploy:** Vercel (frontend) + Render (backend)

## Documentación

- `CONTEXT.md` — Modelo de dominio y glosario
- `docs/adr/` — Decisiones de arquitectura (4 ADRs)
- `docs/superpowers/plans/` — Plan de implementación
- `tasks/` — Seguimiento de tareas y lecciones
