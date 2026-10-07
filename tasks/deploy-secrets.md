# Cuentas y secretos — Fase 6 PIN

## Cuentas correctas (fijadas 7 oct)

| Servicio | Cuenta |
| --- | --- |
| GitHub | [Golpezas/Proyecto_AAMB](https://github.com/Golpezas/Proyecto_AAMB) |
| Render | **Gorbash** — `antonio.hernandezmm@gmail.com` |
| Vercel | [gorbashs-projects](https://vercel.com/gorbashs-projects) |
| Supabase | [org mbgnxrciovwtsfjzfuta](https://supabase.com/dashboard/org/mbgnxrciovwtsfjzfuta) |

**No usar** para PIN: Vercel `macseguridads-projects` / user `gmork2026`, ni tokens viejos de Render de otra cuenta.

## Estado de la CLI en esta máquina

| CLI | Ahora | Acción |
| --- | --- | --- |
| GitHub (`gh`) | OK como **Golpezas** (activo) | Ninguna |
| Vercel | Logueada como **gmork2026** → team Macseguridad | Hay que cambiar a **gorbashs-projects** (`vercel login` con la cuenta Gorbash / o `vercel switch`) |
| Render | Token **vencido** | `render login` con Gorbash |
| Supabase | CLI usable vía `npx supabase` | `npx supabase login` + link al proyecto de esa org |

## Secretos que todavía no están en el repo

Cuando las CLIs estén en las cuentas de arriba, pasame (chat o `.env` local no commiteado):

```env
DATABASE_URL=postgresql+asyncpg://...
SUPABASE_URL=https://xxxx.supabase.co
SUPABASE_KEY=...
SUPABASE_JWT_SECRET=...
UPSTASH_REDIS_URL=...
UPSTASH_QSTASH_TOKEN=...
ONESIGNAL_APP_ID=...
ONESIGNAL_REST_API_KEY=...
NEXT_PUBLIC_PRIVY_APP_ID=...
NEXT_PUBLIC_ONESIGNAL_APP_ID=...
```

Si el proyecto Supabase / apps de Privy·OneSignal·Upstash todavía no existen, crealos en esas cuentas (o decime y los creamos juntos cuando el login esté listo).
