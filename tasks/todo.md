# Fases — PIN (tablero de avance)

Actualizado 7 oct 2026. HEAD remoto sigue en `d0fba52`; trabajo Fase 4–7 local **sin commit** hasta que Antonio lo pida.

## Política de prueba

- **Nosotros:** solo local — `npm run test:pin`, `pytest` (OneSignal/QStash mockeados). Sin Whatnot live, sin push real, sin emulador Android.
- **Cliente:** prueba real con `tasks/client-checklist.md` cuando haya URL o build.
- No hace falta skill/MCP de Android ni browser para esta etapa.

## Cerrado (código listo)

| Fase | Qué | Evidencia local |
| --- | --- | --- |
| 0–3 | Núcleo + pivote + API + `/join` | En `main` `d0fba52` |
| 4 | Panel Notify + PinClient | `npm run test:pin` |
| 5 | Auto go-live tras reconcile (1× por ledger) | `PinAutoGoLive.test.js` |
| 7a | E2E API local | `pytest tests/test_e2e_flow.py` PASS |

## Abierto

### Fase 6 — Publicar (login de Antonio)

Scaffold listo: `render.yaml`, `backend/.env.example`, `frontend/.env.example`.

- [ ] Aplicar migraciones `0001`–`0008` en Supabase
- [ ] Deploy API en Render → `/health`
- [ ] Deploy web en Vercel + orígenes OneSignal
- [ ] Crear canal + API key + handle `/join/<handle>` para el cliente

### Fase 7b — Handoff

- [x] Checklist del cliente (`tasks/client-checklist.md`)
- [x] README actualizado (sin SMS/Twilio)
- [ ] Commit de Fase 4–7a cuando Antonio lo pida
- [ ] Cliente ejecuta checklist

## Aparrado

Dashboard web creador, Midnight real, apps nativas, QR overlay, replay de jobs.
