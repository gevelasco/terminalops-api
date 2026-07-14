# TerminalOps API

API REST local para TerminalOps (NestJS + TypeORM + PostgreSQL), con la misma estructura general que [fintrack-api](https://github.com/).

## Requisitos

- Node.js 20+
- PostgreSQL 14+

## Configuración

```bash
cp .env.example .env
```

**Importante:** sin `.env`, `migration:run` falla con `client password must be a string` porque `DB_PASSWORD` queda vacío.

### Opción A — Postgres con Docker (recomendado, como fintrack-api)

Solo levanta la base; la API Nest sigue en tu máquina con `npm run start:dev` (no hace falta contenedor de la API en desarrollo).

```bash
npm run docker:up    # contenedor terminalops-postgres en Docker Desktop
npm run migration:run
npm run start:dev
```

En Docker Desktop verás el proyecto **`terminalops-api`** con el servicio **`terminalops-postgres`**.  
Por defecto el puerto es **5433** (`.env.example`) para no chocar con **fintrack-api**, que suele usar **5432**.

### Opción B — Postgres instalado en macOS

```bash
createdb terminalops-dev
# En .env usa DB_PORT=5432 si tu Postgres local escucha ahí
```

## Migraciones (crear tablas)

Igual que fintrack-api, las tablas se crean con TypeORM migrations en `src/migrations/` (esquema `terminalops`, DDL inicial en la primera migración).

```bash
npm install
npm run migration:run
```

## Desarrollo local

```bash
# Migraciones + servidor con hot reload
npm run start:local

# Solo API (sin migrar)
npm run start:dev
```

- API: http://localhost:4000  
- **Swagger UI:** http://localhost:4000/api  

## Scripts

| Script | Descripción |
|--------|-------------|
| `npm run start:dev` | API en modo watch |
| `npm run start:local` | `migration:run` + `start:dev` |
| `npm run docker:up` | Postgres local (`docker-compose.local.yml`) |
| `npm run docker:down` | Detiene Postgres local |
| `npm run migration:run` | Aplica migraciones pendientes |
| `npm run migration:revert` | Revierte la última migración |
| `npm run migration:generate` | Genera migración desde cambios en entidades |
| `npm run build` | Compila a `dist/` |
| `npm run start:prod` | API compilada (`dist/src/main.js`) |

## Producción (Docker)

```bash
docker compose -f docker-compose.yml --env-file .env up -d --build
```

El contenedor `api`:

1. Espera Postgres
2. Ejecuta migraciones (`dist/src/migrate.js`)
3. Arranca `node dist/src/main.js`

**TypeORM en producción**

- `autoLoadEntities: true` registra las entidades de cada `TypeOrmModule.forFeature()`.
- Al boot se valida que existan metadatos críticos (`AppUser`, `Company`); si faltan, el proceso **no abre el puerto** y el contenedor reinicia (evita servir tráfico con un `dist/` incompleto o desincronizado).
- Tras `npm run build` local, reinicia el proceso; no dejes un `node dist/src/main.js` viejo en segundo plano mientras `start:dev` recompila.

| Entorno | Arranque correcto |
|---------|-------------------|
| Desarrollo | `npm run start:dev` (watch reinicia solo) |
| Producción / QA | Docker `entrypoint.sh` o `npm run start:prod` |
| ❌ Evitar | `node dist/src/main.js` manual sin reiniciar tras cada build |


Cada empresa de logística es un registro en `companies`. Los datos operativos (`clients`, `operators`, `units`, `equipment`, `trips`, `expenses`) y los usuarios (`app_user`) llevan `company_id`. Las rutas de listado/creación van bajo:

`GET|POST /companies/:companyId/{clients|operators|units|equipment|trips|expenses|dashboard/...}`

El JWT incluye `companyId` y `companyName`; el guard valida que `:companyId` coincida con el del usuario.

## Autenticación

| Ruta | Descripción |
|------|-------------|
| `POST /auth/login` | Login (`email`, `password`) → access + refresh token |
| `POST /auth/refresh` | Renueva tokens |
| `POST /auth/sign-up` | Alta de empresa + usuario admin (dev) |

Tras `npm run migration:run`, la migración de seed crea:

- Empresa demo: **TerminalOps Demo** (`id: 1`)
- Correo: `gvelasco@terminalops.demo` / `Admin123` (`username` interno: `gvelasco`, `id: 1`, `companyId: 1`)
  En entornos con datos propios (p. ej. Grupo VSC), usa el correo del usuario.

Todos los IDs en la API y la base de datos son **numéricos** (`serial`), al estilo fintrack-api.

## Módulos principales

| Tag Swagger | Ruta base | Descripción |
|-------------|-----------|-------------|
| `health` | `GET /` | Estado del servicio |
| `auth` | `/auth` | Login y refresh |
| `companies` | `/companies/:companyId/...` | CRUD por tenant |
| `clients` | `/clients/:id` | Detalle/actualización (con JWT) |
| `operators` | `/operators/:id` | Detalle/actualización |
| `units` | `/units/:id` | Detalle/actualización |
| `equipment` | `/equipment/:id` | Detalle/actualización |
| `trips` | `/trips/:id` | Maniobras, incidentes, cancelación |
| `expenses` | `/expenses` | Gastos |
| `dashboard` | `/companies/:companyId/dashboard/...` | Alertas KPI |

Pendiente: S3/documentos, preferencias de usuario en API, despliegue servidor.

## Estructura del proyecto

```
terminalops-api/
├── config/migration.config.ts   # DataSource para CLI TypeORM
├── src/
│   ├── main.ts                  # Bootstrap + Swagger
│   ├── app.module.ts
│   ├── migrate.ts               # Runner de migraciones (prod)
│   ├── migrations/              # Migraciones TypeORM
│   ├── clients/entities/        # client.entity.ts, …
│   ├── operators/entities/
│   ├── units/entities/
│   ├── equipment/entities/
│   ├── trips/entities/
│   ├── expenses/entities/
│   ├── companies/entities/
│   └── users/entities/
└── .env.example
```

## Relación con el frontend

El esquema SQL vive en **`terminalops-api/src/migrations/`** (migraciones TypeORM). El frontend Angular no incluye DDL ni persistencia local de negocio.
