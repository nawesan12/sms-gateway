# SMS Gateway — Bulk SMS sobre TextBee + Android

Plataforma de envío de SMS (mensajes libres + campañas masivas) usando un **teléfono Android físico** como gateway via [TextBee](https://textbee.dev). Costo por SMS muy inferior a Twilio/Telnyx para LATAM.

> **Stack**: Node.js 22 · TypeScript · Fastify 5 · Prisma + PostgreSQL · BullMQ + Redis · React 18 + Vite + Tailwind · Docker.

## Componentes

```
┌──────────┐   HTTP    ┌──────────┐  enqueue  ┌─────────┐  HTTP    ┌──────────┐  SMS  ┌──────────┐
│  Web     │ ───────► │   API    │ ────────► │  Redis  │ ──┐      │ TextBee  │ ────► │ Android  │
│  Vite    │ ◄─────── │ Fastify  │           │ BullMQ  │   │      │  Cloud   │       │ + SIM AR │
└──────────┘   token   └────┬─────┘           └─────────┘   ▼      └──────────┘       └──────────┘
                            │                          ┌────────┐
                            │ Prisma                   │ Worker │  device router · circuit breaker · failover
                            ▼                          └────────┘
                       ┌────────────┐
                       │ Postgres   │  contacts · contact_lists · campaigns · campaign_deliveries · sms_messages · devices · audit_logs
                       └────────────┘
```

## Quickstart (local con Docker)

```bash
# 1) Generar secrets
openssl genrsa -out /tmp/p.pem 2048
openssl rsa -in /tmp/p.pem -pubout -out /tmp/pub.pem
echo "JWT_PRIVATE_KEY_B64=$(base64 -i /tmp/p.pem | tr -d '\n')"
echo "JWT_PUBLIC_KEY_B64=$(base64 -i /tmp/pub.pem | tr -d '\n')"
echo "MASTER_ENCRYPTION_KEY_B64=$(openssl rand -base64 32)"

# 2) .env
cp .env.example .env
$EDITOR .env  # pegar secrets de arriba + ADMIN_BOOTSTRAP_TOKEN

# 3) Levantar todo
docker compose up -d --build
docker compose exec api npx prisma db push
```

- API: <http://localhost:3000>
- Swagger: <http://localhost:3000/docs>
- Métricas: <http://localhost:3000/metrics>
- **Panel web: <http://localhost:5173>** (login con el `ADMIN_BOOTSTRAP_TOKEN`)

## Quickstart sin Docker

Postgres y Redis levantados aparte.

```bash
npm install
npx prisma generate
npx prisma db push
npm run dev:api      # API
npm run dev:worker   # Worker en otra terminal

cd web && npm install && npm run dev   # panel en :5173
```

## Flujos del panel

1. **Login** — pegás el bootstrap token.
2. **Dispositivos** — registrás el Android: `Nombre`, `TextBee Device ID`, `API key`.
3. **Contactos** — alta manual o **Importar CSV** (`phone[,name][,email]`).
4. **Listas** — agrupás contactos para campañas.
5. **Enviar SMS** — mensaje libre a un destinatario puntual (input manual o picker de contacto).
6. **Campañas** — redactás mensaje libre (variables `{{name}}` y `{{phone}}`), elegís lista, lanzás. Progreso en tiempo real.

## Endpoints principales

| Método | Path                                  | Descripción                                  |
|--------|---------------------------------------|----------------------------------------------|
| POST   | `/v1/sms/send`                        | Enviar SMS individual (texto libre)           |
| GET    | `/v1/sms/:id`                         | Estado de un SMS                              |
| GET    | `/v1/contacts`                        | Listar/buscar contactos                       |
| POST   | `/v1/contacts`                        | Crear contacto                                |
| POST   | `/v1/contacts/import`                 | Importar CSV (body `{ csv }`)                 |
| DELETE | `/v1/contacts/:id`                    | Borrar contacto                               |
| GET    | `/v1/contact-lists`                   | Listar listas con conteo                      |
| POST   | `/v1/contact-lists`                   | Crear lista                                   |
| GET    | `/v1/contact-lists/:id`               | Detalle lista                                 |
| GET    | `/v1/contact-lists/:id/members`       | Miembros (paginado)                           |
| POST   | `/v1/contact-lists/:id/members`       | Agregar contactos `{ contactIds }`            |
| DELETE | `/v1/contact-lists/:id/members/:cid`  | Quitar miembro                                |
| GET    | `/v1/campaigns`                       | Listar campañas                               |
| POST   | `/v1/campaigns`                       | Crear DRAFT                                   |
| GET    | `/v1/campaigns/:id`                   | Detalle + counts por estado                   |
| GET    | `/v1/campaigns/:id/deliveries`        | Lista de envíos                               |
| POST   | `/v1/campaigns/:id/launch`            | Lanzar (DRAFT → QUEUED → RUNNING → COMPLETED) |
| POST   | `/v1/campaigns/:id/cancel`            | Cancelar (skipea pendientes)                  |
| GET    | `/v1/devices`                         | Listar devices                                |
| POST   | `/v1/devices`                         | Registrar device (apiKey cifrada AES-256-GCM) |
| PATCH  | `/v1/devices/:id`                     | Actualizar status/priority                    |
| DELETE | `/v1/devices/:id`                     | Borrar device                                 |
| GET    | `/v1/admin/sms`                       | Histórico SMS (paginado, phone enmascarado)   |
| GET    | `/v1/admin/stats`                     | Métricas 24h                                  |
| GET    | `/health`, `/health/ready`            | Liveness / readiness                          |
| GET    | `/metrics`                            | Prometheus (IP allowlist)                     |

Todos los endpoints (excepto `/health*` y `/metrics`) requieren header `x-bootstrap-token: <ADMIN_BOOTSTRAP_TOKEN>`.

## Formato de respuesta

```json
{ "success": true, "data": { ... }, "error": null, "meta": { "requestId": "...", "timestamp": "..." } }
```

## Variables de plantilla (campañas)

- `{{name}}` → nombre del contacto (vacío si no tiene).
- `{{phone}}` → teléfono E.164.

## Códigos de error

`OTP_*` (legado), `RATE_LIMITED_IP`, `RATE_LIMITED_PHONE`, `COOLDOWN_ACTIVE`, `DEVICE_OFFLINE`, `SMS_PROVIDER_DOWN`, `INVALID_PHONE`, `BLACKLISTED`, `UNAUTHORIZED`, `FORBIDDEN`, `NOT_FOUND`, `VALIDATION`, `INTERNAL_ERROR`.

## Seguridad

- API keys de TextBee cifradas at-rest con AES-256-GCM (`MASTER_ENCRYPTION_KEY_B64`).
- Logs con redact de `phone`, `code`, `apiKey`, `authorization`.
- `maskPhone()` (`+5491*******51`) en logs y outputs admin.
- Rate-limit por IP a nivel API + cooldown por teléfono (módulo OTP, hoy desactivado en routes).
- Audit log persistente en `audit_logs`.

## Testing

```bash
docker compose -f docker-compose.test.yml up -d
DATABASE_URL='postgresql://test:test@localhost:55432/sms_gateway_test' npx prisma db push
DATABASE_URL='postgresql://test:test@localhost:55432/sms_gateway_test' npm test
```

## Documentación complementaria

- [Setup TextBee](./docs/TEXTBEE_SETUP.md)
- [Setup Android](./docs/ANDROID_SETUP.md)
- [Deployment](./docs/DEPLOYMENT.md)
- [Production checklist](./docs/PRODUCTION_CHECKLIST.md)
