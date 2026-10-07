# Proyecto_AAMB — PIN (Private Instant Notification)

Plataforma de avisos privacy-first para creadores. Los fans se anotan con una wallet (Privy), reciben push (OneSignal) y el creador nunca ve teléfono ni email.

En este repo el creador diario es un streamer de breaks en Whatnot. Su herramienta operativa es **BreakSuite6** (`BF6/`). PIN no reemplaza el break: solo avisa a la audiencia.

## Stack

- **Backend:** FastAPI + SQLAlchemy async + Supabase (PostgreSQL)
- **Identidad fan:** wallet firmada EIP-191 (Privy embedded)
- **Cola:** Upstash QStash
- **Push:** OneSignal (web; FCM/APNs vía OneSignal)
- **Notario:** Midnight stub async (fuera del camino del aviso)
- **Frontend fan:** Next.js + Privy + OneSignal Web SDK
- **Cliente creador:** BreakSuite6 (Electron) con panel Notify + API key `X-Channel-Key`
- **Deploy (pendiente):** Render (API) + Vercel (web)

## Documentación

- `CONTEXT.md` — dominio y glosario
- `docs/adr/` — decisiones (ver sobre todo ADR 0006)
- `docs/superpowers/plans/2026-10-06-ping-platform-pivot.md` — plan Tasks 18–31
- `tasks/todo.md` — tablero de fases

## Tests locales (nosotros)

Sin Whatnot live ni push real. OneSignal y QStash se mockean.

```bash
# Backend
cd backend
python -m pytest -v
python -m pytest tests/test_e2e_flow.py -v

# BreakSuite6 — PIN only
cd BF6/app
npm run test:pin
```

## Prueba del cliente

Cuando exista URL pública (Fase 6), el cliente:

1. Abre BreakSuite6 → **Notify** → pega URL del API, channel id y `pin_sk_…`
2. Comparte `/join/<handle>` en su perfil/chat de Whatnot
3. Un fan entra, acepta push
4. Desde Notify manda un ping; al hacer Prepare Show (con auto go-live on) debería salir el aviso de en vivo

Checklist vivo: `tasks/client-checklist.md`

## Run local (dev)

```bash
# API
cd backend
cp .env.example .env   # completar
pip install -e ".[dev]"
uvicorn app.main:create_app --factory --reload

# Fan web
cd frontend
cp .env.example .env.local
npm install && npm run dev

# BreakSuite6
cd BF6/app
npm start
```
