# Deploy del SMS Gateway en Render (plan FREE)

Guía completa para deployar el sistema multi-tenant en Render desde cero, todo en plan gratis. Apta para enseñar / demos.

El stack: **1 Web Service en Render (API + workers + UI en el mismo proceso)**, **Postgres en Supabase free**. Sin Redis: la cola corre en Postgres y los rate-limits en memoria. Costo total: **$0/mes**.

> **Por qué un solo service**: el plan free de Render NO incluye Background Workers, así que los workers BullMQ corren dentro del mismo proceso del web service. Esto significa que mientras el service esté despierto, los SMS se procesan; mientras esté dormido, los jobs quedan en cola hasta que el service vuelve a la vida.

> **Por qué se sirve el frontend desde el mismo service**: el bundle Vite (`web/dist/`) está pre-buildeado y commiteado al repo. Render solo compila el backend → no hay OOM, no hay segundo `npm ci`, el deploy es ~2 min más rápido y no acopla la compilación del frontend a la disponibilidad de la DB.

---

## Limitaciones del plan free que tenés que aceptar

| Limitación | Impacto |
|---|---|
| El service se duerme tras ~15 min sin tráfico | Primer request post-sleep tarda ~30 s. Workers tampoco procesan mientras duerme. |
| 750 horas/mes de uptime | Alcanza para 1 service 24/7. |
| 512 MB RAM, 0.1 CPU | Suficiente para tráfico bajo (alcanza porque Render solo compila el backend). |
| Sin static IP | TextBee no puede whitelistear la IP del service. |
| Disco efímero | Nada se persiste en disco entre deploys/restarts. |
| Logs limitados (pocos días) | Para debugging serio, mandar Pino a Logtail/Axiom. |

---

## Paso 0 — Clonar el repo (solo si vas a deployar a TU Render)

Si solo vas a deployar lo que ya está en el repo (sin tocar código), el frontend ya viene **pre-buildeado en `web/dist/` y commiteado**. No tenés que correr `npm install` ni nada local: solo necesitás la URL del repo para pegarla en Render más adelante.

```bash
# (opcional) clonar para mirar el código
git clone <URL-DEL-REPO>
cd sms-gateway
```

Si **modificaste algo en `web/src/`**, antes de pushear:

```bash
npm --prefix web ci
npm --prefix web run build  # regenera web/dist/

git add .
git commit -m "deploy: render free"
git push origin main
```

---

## Paso 1 — Crear Postgres en Supabase

1. Ir a https://supabase.com → **New project**.
2. Region cercana al usuario (p. ej. `South America (São Paulo)`), password fuerte.
3. Esperar ~2 min hasta que termine de provisionar.
4. **Project Settings → Database → Connection string → Connection pooling** (Transaction mode, puerto **6543**). Va a verse así:
   ```
   postgresql://postgres.<ref>:<pwd>@aws-0-<region>.pooler.supabase.com:6543/postgres?pgbouncer=true&connection_limit=1&sslmode=require
   ```

> ⚠️ **Crítico**: usar el **pooler** (puerto 6543), NO la URL "Direct connection". La directa es IPv6-only y Render no resuelve IPv6 desde sus services → los queries fallan con `ENETUNREACH`. El pooler funciona también para `prisma db push` con el flag `?pgbouncer=true`.

Guardá la URL — esa es tu `DATABASE_URL`.

---

## Paso 2 — Crear el Web Service en Render

> El repo es público — Render permite deployar repos públicos sin OAuth de GitHub. **No usamos Blueprint ni Docker**: el servicio se configura a mano en el dashboard.

1. Crear cuenta en https://render.com con email/Google. **No conectar GitHub.**
2. **New → Web Service**.
3. Click en **"Public Git Repository"**.
4. Pegar la URL del repo y **Connect**.
5. Configurar:
   - **Name**: `sms-gateway` (genera URL `https://sms-gateway-XXXX.onrender.com`)
   - **Region**: Oregon (o la más cercana al tráfico esperado)
   - **Branch**: `main`
   - **Runtime**: `Node`
   - **Build Command**:
     ```
     npm ci --include=dev && npx prisma generate && npm run build
     ```
   - **Start Command**:
     ```
     node dist/index.js
     ```
     > El sync del schema (`prisma db push`) corre dentro del proceso Node al boot — no hace falta meterlo acá.
   - **Plan**: `Free`
   - **Health Check Path**: `/health`
   - **Auto-Deploy**: `Yes`
6. Click en **Advanced** y agregá:
   - `NODE_VERSION` = `22`
   - `NODE_ENV` = `production`

> Las env vars se agregan en el paso 3. El primer deploy va a fallar si las dejás vacías — es esperado.

---

## Paso 3 — Setear env vars en Render

En el dashboard del service → **Environment → Add environment variable**:

| Key | Valor |
|---|---|
| `DATABASE_URL` | URL del **pooler** de Supabase (puerto 6543, del paso 1) |
| `FIREBASE_SERVICE_ACCOUNT_JSON` | JSON entero del service account de Firebase (Project Settings → Service accounts → Generate new private key). **Sin esto los envíos fallan con `NO_FCM_CONFIG`.** |

> `APP_BASE_URL` no hace falta setearla: el código toma `RENDER_EXTERNAL_URL` automáticamente (Render lo inyecta con el subdominio público). Solo seteala a mano si usás un dominio custom.

> Las otras claves sensibles (`JWT_*_B64`, `MASTER_ENCRYPTION_KEY_B64`, `ADMIN_BOOTSTRAP_TOKEN`) tienen **defaults didácticos hardcodeados en `src/config/env.ts`** para que el deploy funcione ingresando solo lo de arriba. ⚠️ En un deploy real, sobreescribilas en el dashboard con valores propios.

> **No hay servicio de Redis.** La cola de jobs corre en Postgres (tabla `jobs`) y los rate-limits son en memoria. Si tu deploy histórico tiene una integración con Upstash, podés borrarla — el código actual no la usa.

**Save** → Render redeploya. El boot corre `prisma db push`, crea todas las tablas en Supabase y arranca el proceso. **En el primer arranque el admin operador se crea automáticamente** (teléfono `+5491100000001` por default, configurable con la env var `BOOTSTRAP_ADMIN_PHONE`).

---

## Paso 4 — Verificar

```bash
# Health (devuelve 200 sin tocar DB)
curl https://sms-gateway-XXXX.onrender.com/health

# Ready check (devuelve 200 si DB + FCM + al menos 1 device responden)
curl https://sms-gateway-XXXX.onrender.com/health/ready

# Dispatch check (admin): FCM configurado + devices con fcmToken + queue depth
curl -H "x-bootstrap-token: 9ef85a6cf8ef505bbe56d08d0a57d6aae14da1d1cfb20342" \
  https://sms-gateway-XXXX.onrender.com/v1/debug/dispatch-check

# Listado de clientes (200 con array vacío)
curl -H "x-bootstrap-token: 9ef85a6cf8ef505bbe56d08d0a57d6aae14da1d1cfb20342" \
  https://sms-gateway-XXXX.onrender.com/v1/admin/users
```

> El `ADMIN_BOOTSTRAP_TOKEN` del último curl es el hardcodeado en `render.yaml`. Si lo cambiaste, usá el tuyo.

Si `/health` da 200 pero `/v1/admin/users` da 500, abrí los logs del service y buscá el error de Prisma — lo más común es haber pegado la URL directa como `DATABASE_URL` en lugar del pooler.

---

## Paso 5 — Configurar keepalive (gratis, recomendado)

Para evitar que el service se duerma tras 15 min y los SMS encolados queden trabados, configurar un cron externo que pegue a `/health` cada 10 min.

**cron-job.org** (gratis, sin tope):
1. Crear cuenta en https://cron-job.org.
2. **Create cronjob**:
   - **Title**: `sms-gateway keepalive`
   - **URL**: `https://sms-gateway-XXXX.onrender.com/health`
   - **Schedule**: every 10 minutes
3. Save.

Alternativa: **UptimeRobot** (gratis hasta 50 monitors, check cada 5 min).

> ⚠️ Mantener despierto el service consume las 750 h/mes pero alcanza justo para 24/7 (24×30=720). No agregues un segundo service free al mismo cron porque te quedás sin horas.

---

## Paso 6 — Onboardear primer cliente con el CLI

El repo trae `scripts/gateway.sh`, un wrapper sobre los endpoints admin para que no tengas que pegar curls a mano.

**Setup (una sola vez):**
```bash
cp scripts/gateway.env.example scripts/gateway.env
# Editá scripts/gateway.env y completá API_URL con tu subdominio de Render.
# El BOOTSTRAP_TOKEN ya viene del render.yaml hardcodeado.
```

> `scripts/gateway.env` está gitignoreado, no se commitea.

**Crear un cliente con 1000 tokens precargados:**
```bash
./scripts/gateway.sh client create +5491132111111 1000
```

Salida:
```json
{
  "phoneE164": "+5491132111111",
  "userId": "uuid-del-cliente",
  "balance": 1000,
  "link": "https://sms-gateway-XXXX.onrender.com/login?token=AbCd..."
}
```

Mandale el `link` al cliente. Cuando lo abre, queda logueado en el panel.

**Crear varios clientes de una sola vez:**
```bash
./scripts/gateway.sh client create +5491132111111 1000
./scripts/gateway.sh client create +5491132222222 500
./scripts/gateway.sh client create +5491132333333 2000
```

---

## Paso 8 — Operación día a día con el CLI

```bash
# Listado de todos los clientes con saldos
./scripts/gateway.sh client list

# Saldo de un cliente puntual
./scripts/gateway.sh client balance <userId>

# Recargar tokens (top-up)
./scripts/gateway.sh client topup <userId> 500 "pago abril"

# Historial de transacciones
./scripts/gateway.sh client tx <userId>          # primera página
./scripts/gateway.sh client tx <userId> 2 100    # página 2, 100 por página

# Regenerar link (invalida el anterior, mantiene el saldo)
./scripts/gateway.sh client regen +5491132111111

# Health check rápido
./scripts/gateway.sh health
```

> **Sin `jq`?** El script lo necesita para parsear las respuestas. Instalalo con `brew install jq` (macOS) o `apt install jq` (Linux).

### Equivalentes en `curl` (por si querés enseñar el endpoint crudo)

<details>
<summary>Ver curls equivalentes</summary>

```bash
export BOOTSTRAP="9ef85a6cf8ef505bbe56d08d0a57d6aae14da1d1cfb20342"
export API="https://sms-gateway-XXXX.onrender.com"

# Crear/regenerar cliente
curl -X POST $API/v1/admin/auth/access-link \
  -H "x-bootstrap-token: $BOOTSTRAP" \
  -H "content-type: application/json" \
  -d '{"phoneE164":"+5491132111111","initialTokens":1000,"role":"ADMIN"}'

# Listado
curl -H "x-bootstrap-token: $BOOTSTRAP" $API/v1/admin/users

# Top-up
curl -X POST $API/v1/admin/users/$USER_ID/tokens/top-up \
  -H "x-bootstrap-token: $BOOTSTRAP" \
  -H "content-type: application/json" \
  -d '{"amount":500,"reason":"pago abril"}'

# Historial
curl -H "x-bootstrap-token: $BOOTSTRAP" \
  "$API/v1/admin/users/$USER_ID/tokens/transactions?page=1&pageSize=50"
```
</details>

---

## Registrar Android devices (TextBee)

Antes de mandar SMS hay que registrar al menos un device:

```bash
curl -X POST $API/v1/admin/devices \
  -H "x-bootstrap-token: $BOOTSTRAP" \
  -H "content-type: application/json" \
  -d '{
    "name": "Galaxy A12 — Mar del Plata",
    "textbeeDeviceId": "<id-en-textbee>",
    "apiKey": "<api-key-de-textbee>",
    "priority": 100
  }'
```

---

## Notas importantes

- **El subdominio de Render es fijo** una vez creado (`sms-gateway-XXXX.onrender.com`). Si después agregás un dominio custom, actualizá `APP_BASE_URL` y redeploy.
- **Supabase free**: 500 MB de Postgres, pause automático tras 7 días inactivo. Si pausa, el primer query lo despierta (~10 s).
- **Cola en Postgres**: cada worker polea la tabla `jobs` cada 500ms con `FOR UPDATE SKIP LOCKED`. Vale para un único proceso Node y un único celu. Si en algún momento escalás a múltiples workers o múltiples celus, ese mismo SKIP LOCKED ya soporta concurrencia, pero conviene subir el `pollIntervalMs` o mover a una cola dedicada.
- **Claves hardcodeadas**: las `JWT_*_B64`, `MASTER_ENCRYPTION_KEY_B64` y `ADMIN_BOOTSTRAP_TOKEN` están en `render.yaml` por decisión consciente para fines didácticos. Cualquiera con acceso al repo puede firmar tokens y desencriptar lo encriptado en la DB. **No usar este repo así para datos reales de clientes.**
- **`prisma db push` vs `migrate deploy`**: el blueprint usa `db push --accept-data-loss` porque no hay migraciones versionadas. Si cambiás el `schema.prisma` y hay drop de columnas, los datos en esas columnas se pierden. Para producción real, generar migrations con `prisma migrate dev` localmente, commitearlas, y cambiar el `buildCommand` a `prisma migrate deploy`.
- **Operador vs cliente**:
  - El **operador** (vos) usa `x-bootstrap-token` y solo gestiona (access links, top-ups, listados). NO puede mandar SMS — por diseño.
  - El **cliente** usa su access token y puede mandar SMS, lanzar campañas y consultar SU saldo. Cada SMS le debita 1 token.
- **`WORKER_CONCURRENCY=2`** está bajo a propósito para no comerse los 512 MB. Con tráfico real subir gradualmente.

---

## Troubleshooting

**El deploy falla con `Invalid environment configuration: DATABASE_URL ...`**
→ Falta alguna env del paso 4. El log dice cuál.

**El log dice `Can't reach database server` o `P1001`**
→ Pegaste la URL directa de Supabase como `DATABASE_URL`. Tiene que ser el pooler (puerto 6543) con `?pgbouncer=true&connection_limit=1&sslmode=require`. La directa de Supabase es IPv6-only y Render no la resuelve.

**`prisma db push` falla con `prepared statement ...`**
→ Falta `?pgbouncer=true` en la `DATABASE_URL`. PgBouncer en transaction mode no soporta prepared statements; ese flag le dice a Prisma que no las use.

**Los workers no procesan jobs**
→ Mirá `/v1/debug/dispatch-check`. Si `fcm.configured: false`, falta `FIREBASE_SERVICE_ACCOUNT_JSON`. Si no hay devices con `hasFcmToken: true`, la app Android nunca registró su token (pegar `PATCH /v1/gateway/devices/:id` con `{ fcmToken }`).

**El service queda dormido y los SMS se atrasan**
→ Configurar el keepalive del paso 7. Mientras esté dormido, los jobs encolados no se procesan.

**`/health` da 200 pero todo lo demás da 500**
→ El `prisma db push` no se ejecutó o falló silenciosamente. Ver logs del último deploy y buscar el output del build.

**`POST /v1/sms/send` da 402 INSUFFICIENT_TOKENS**
→ El cliente se quedó sin saldo. Recargar con el endpoint de top-up.

**`POST /v1/sms/send` da 503 DEVICE_OFFLINE**
→ No hay devices Android registrados o todos están con circuit-breaker abierto.

**Cliente perdió su link de acceso**
→ Regenerar con `POST /v1/admin/auth/access-link` (sin `initialTokens` para no recargar). El link viejo queda invalidado, el saldo se mantiene.

**Build OOM (`JavaScript heap out of memory`)**
→ El plan free tiene 512 MB. Render solo compila el backend (el frontend va pre-buildeado en `web/dist/`), así que no debería pasar. Si pasa, asegurate que estás usando este flujo (no el viejo que buildeaba Vite en Render) y que `web/dist/` está commiteado.

**`npx prisma generate` baja Prisma 7 y rompe el schema (`url is no longer supported`)**
→ El proyecto usa Prisma 6. Si el `npm ci` del build no instaló `prisma` localmente (porque `NODE_ENV=production` lo omitió), `npx` baja la latest (v7) que es incompatible. Solución: el `buildCommand` de arriba usa `npm ci --include=dev` que fuerza la instalación de devDependencies aunque `NODE_ENV=production`.

**Frontend pre-buildeado quedó desactualizado**
→ Si tocaste algo en `web/src/` y no rebuildeaste localmente, los cambios no van al deploy. Correr `npm --prefix web run build` antes del commit.
