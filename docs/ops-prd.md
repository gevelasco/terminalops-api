# Ops PRD — TerminalOps API

Checklist operativa para salir a producción cerrada.

## 1. Secrets y entorno

Nunca commitees `.env`. En el host/Railway define:

| Variable | Producción |
|----------|------------|
| `NODE_ENV` | `production` |
| `ORIGIN` | URL real del FE, p.ej. `https://app.tudominio.com` (varias: separadas por coma) |
| `JWT_SECRET` / `JWT_REFRESH_SECRET` | ≥32 chars, distintos, **no** los del `.env.example` |
| `DB_*` | credenciales del Postgres gestionado |
| `DB_SSL` | `true` en hosts cloud |
| `ALERT_WEBHOOK_URL` | (opcional) Slack/Discord incoming webhook para 5xx |
| `ENABLE_SWAGGER` | omitir / `false` (Swagger off en production) |

El boot **falla** si en `production` faltan secrets o `ORIGIN` es `*` / localhost.

## 2. HTTPS

La API no termina TLS ella misma: va detrás del proxy (Railway / Cloudflare / Nginx).

- `trust proxy` activado (rate limit e IPs reales).
- `helmet` envía cabeceras seguras (HSTS lo añade el proxy si termina HTTPS).
- El FE debe llamar solo `https://…`.

## 3. Rate limit (auth)

| Ruta | Límite / minuto |
|------|-----------------|
| `POST /auth/login` | 10 |
| `POST /auth/sign-up` | 5 |
| `POST /auth/refresh` | 30 |
| Resto | 120 |

## 4. Logs y alertas 5xx

Cada request autenticado deja log JSON con `userId`, `companyId`, `requestId`, `status`, `durationMs`.

Los **5xx**:
1. Se loguean como `http_5xx`
2. Si hay `ALERT_WEBHOOK_URL`, se POSTea un aviso (throttle 15s)

Respuesta al cliente en production: mensaje genérico + `requestId` (sin stack).

## 5. Backup / restore Postgres

```bash
# Backup → ./backups/terminalops-*.sql.gz
npm run db:backup

# Probar restore en DB temporal (no toca la principal)
npm run db:backup:verify

# Restore real (destructivo)
CONFIRM_RESTORE=yes npm run db:restore -- backups/terminalops-latest.sql.gz
```

**Ritual mínimo antes/después de PRD:** correr `db:backup:verify` al menos una vez contra el Postgres real (o un clon) y guardar el backup offsite (S3/Drive).

## 6. Smoke checklist deploy

1. `ORIGIN` = dominio FE HTTPS  
2. `DB_SSL=true` si aplica  
3. JWT nuevos  
4. `npm run db:backup` + `npm run db:backup:verify`  
5. Health `GET /` → 200  
6. Login funciona; 11º login rápido en 1 min → 429  
7. Forzar error 500 en staging y confirmar webhook/log  
