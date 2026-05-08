# Deploy del SMS Gateway en Render (plan FREE)

Guía completa para deployar el sistema multi-tenant en Render desde cero, todo en plan gratis. Apta para enseñar / demos.

El stack: **1 service en Render (API + workers en el mismo proceso)**, **Postgres en Supabase free**, **Redis en Upstash free**. Costo total: **$0/mes**.

> **Por qué un solo service**: el plan free de Render NO incluye Background Workers, así que los workers BullMQ corren dentro del mismo proceso del web service. Esto significa que mientras el service esté despierto, los SMS se procesan; mientras esté dormido, los jobs quedan en cola hasta que el service vuelve a la vida.

---

## Limitaciones del plan free que tenés que aceptar

| Limitación | Impacto |
|---|---|
| El service se duerme tras ~15 min sin tráfico | Primer request post-sleep tarda ~30 s. Workers tampoco procesan mientras duerme. |
| 750 horas/mes de uptime | Alcanza para 1 service 24/7. |
| 512 MB RAM, 0.1 CPU | Suficiente para tráfico bajo. Si el build da OOM, partir el frontend a Static Site aparte. |
| Sin static IP | TextBee no puede whitelistear la IP del service. |
| Disco efímero | Nada se persiste en disco entre deploys/restarts. |
| Logs limitados (pocos días) | Para debugging serio, mandar Pino a Logtail/Axiom. |

---

## Paso 0 — Push del repo al `main` actual

El `render.yaml` y `package.json` ya están adaptados a free. Cualquier `git push` a `main` dispara auto-deploy.

```bash
git add .
git commit -m "deploy: render free"
git push origin main
```

---

## Paso 1 — Crear Postgres en Supabase

1. Ir a https://supabase.com → **New project**.
2. Region cercana al usuario (p. ej. `South America (São Paulo)`), password fuerte.
3. Esperar ~2 min hasta que termine de provisionar.
4. **Project Settings → Database → Connection string** y copiar **DOS** URLs:
   - **Connection pooling** (Transaction mode, puerto **6543**) → será `DATABASE_URL`. Render usa esta porque es IPv4 y no agota conexiones.
     ```
     postgresql://postgres.<ref>:<pwd>@aws-0-<region>.pooler.supabase.com:6543/postgres?pgbouncer=true&connection_limit=1&sslmode=require
     ```
   - **Direct connection** (puerto **5432**) → será `DIRECT_URL`. Solo la usa `prisma db push` durante el build.
     ```
     postgresql://postgres:<pwd>@db.<ref>.supabase.co:5432/postgres?sslmode=require
     ```

> ⚠️ **Crítico**: la URL directa de Supabase es IPv6-only y Render no resuelve IPv6 desde sus services. Por eso el runtime usa el pooler. Si ponés la directa como `DATABASE_URL`, los queries fallan con `ENETUNREACH`.

Guardá las dos URLs.

---

## Paso 2 — Crear Redis en Upstash

1. Ir a https://upstash.com → **Create Database** → tipo **Redis**.
2. Region cercana, **TLS/SSL: Enabled**.
3. En el dashboard de la DB → **Connect → Node** → copiar la **TLS connection string** (empieza con `rediss://`):
   ```
   rediss://default:<TOKEN>@<host>.upstash.io:6379
   ```

Esa es la `REDIS_URL`. Guardala.

---

## Paso 3 — Crear el Blueprint en Render

> El repo es público — Render permite deployar repos públicos sin OAuth de GitHub.

1. Crear cuenta en https://render.com con email/Google. **No conectar GitHub.**
2. **New → Blueprint**.
3. Click en **"Public Git Repository"**.
4. Pegar la URL del repo.
5. **Connect** → Render lee el `render.yaml`.
6. **Apply**. Render crea **1 service**: `sms-gateway` (web, **plan free**).

> El primer deploy va a **fallar** al arrancar porque faltan `DATABASE_URL`/`DIRECT_URL`/`REDIS_URL`/`APP_BASE_URL`. Es esperado.

---

## Paso 4 — Setear las 3 env vars en Render

En el dashboard del service → **Environment → Edit env vars** y completar:

| Key | Valor |
|---|---|
| `DATABASE_URL` | URL del **pooler** de Supabase (puerto 6543, del paso 1) |
| `DIRECT_URL` | URL **directa** de Supabase (puerto 5432, del paso 1) |
| `REDIS_URL` | URL de Upstash (`rediss://...`, del paso 2) |

> `APP_BASE_URL` no hace falta setearla: el código toma `RENDER_EXTERNAL_URL` automáticamente (Render lo inyecta con el subdominio público). Solo seteala a mano si usás un dominio custom.

Las otras claves (`JWT_*_B64`, `MASTER_ENCRYPTION_KEY_B64`, `ADMIN_BOOTSTRAP_TOKEN`) ya están **hardcodeadas en `render.yaml`** porque esto es para enseñar. ⚠️ En un deploy real cambialas por valores propios y movelas a `sync: false`.

**Save** → Render redeploya. Esta vez el `buildCommand` corre `prisma db push`, crea todas las tablas en Supabase y arranca el proceso. **En el primer arranque el admin operador se crea automáticamente** (teléfono `+5491100000001` por default, configurable con la env var `BOOTSTRAP_ADMIN_PHONE`).

---

## Paso 5 — Verificar

```bash
# Health (devuelve 200 sin tocar DB/Redis)
curl https://sms-gateway-XXXX.onrender.com/health

# Ready check (devuelve 200 si DB + Redis + al menos 1 device responden)
curl https://sms-gateway-XXXX.onrender.com/health/ready

# Listado de clientes (200 con array vacío)
curl -H "x-bootstrap-token: 9ef85a6cf8ef505bbe56d08d0a57d6aae14da1d1cfb20342" \
  https://sms-gateway-XXXX.onrender.com/v1/admin/users
```

> El `ADMIN_BOOTSTRAP_TOKEN` del último curl es el hardcodeado en `render.yaml`. Si lo cambiaste, usá el tuyo.

Si `/health` da 200 pero `/v1/admin/users` da 500, abrí los logs del service y buscá el error de Prisma — lo más común es haber pegado la URL directa como `DATABASE_URL` en lugar del pooler.

---

## Paso 6 — Configurar keepalive (gratis, recomendado)

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

## Paso 7 — Onboardear primer cliente

Desde tu compu local:

```bash
export BOOTSTRAP="9ef85a6cf8ef505bbe56d08d0a57d6aae14da1d1cfb20342"
export API="https://sms-gateway-XXXX.onrender.com"

# Crear cliente con 1000 tokens precargados
curl -X POST $API/v1/admin/auth/access-link \
  -H "x-bootstrap-token: $BOOTSTRAP" \
  -H "content-type: application/json" \
  -d '{"phoneE164":"+5491132xxxxxx","initialTokens":1000,"role":"ADMIN"}'

# Respuesta:
# {
#   "data": {
#     "link": "https://sms-gateway-XXXX.onrender.com/login?token=AbCd...",
#     "userId": "uuid-del-cliente",
#     "balance": 1000
#   }
# }
```

Mandale el `link` al cliente. Cuando lo abre, queda logueado en el panel.

---

## Paso 8 — Operación día a día

```bash
# Listado de clientes con saldos
curl -H "x-bootstrap-token: $BOOTSTRAP" $API/v1/admin/users

# Saldo de un cliente puntual
curl -H "x-bootstrap-token: $BOOTSTRAP" \
  $API/v1/admin/users/$USER_ID/tokens/balance

# Recargar tokens
curl -X POST $API/v1/admin/users/$USER_ID/tokens/top-up \
  -H "x-bootstrap-token: $BOOTSTRAP" \
  -H "content-type: application/json" \
  -d '{"amount":500,"reason":"pago abril"}'

# Historial de movimientos
curl -H "x-bootstrap-token: $BOOTSTRAP" \
  "$API/v1/admin/users/$USER_ID/tokens/transactions?page=1&pageSize=50"

# Revocar acceso (regenera token, el viejo deja de funcionar)
curl -X POST $API/v1/admin/auth/access-link \
  -H "x-bootstrap-token: $BOOTSTRAP" \
  -H "content-type: application/json" \
  -d '{"phoneE164":"+5491132xxxxxx"}'
```

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
- **Upstash free**: 10k commands/día, 256 MB. BullMQ con polling chequea Redis seguido — para una clase alcanza, para producción real subir de plan.
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
→ Pegaste la URL directa de Supabase como `DATABASE_URL`. Tiene que ser el pooler (puerto 6543). La directa va en `DIRECT_URL`.

**`prisma db push` falla con `connection refused` durante el build**
→ La `DIRECT_URL` está mal o el password tiene caracteres especiales sin URL-encode. Probar la URL directa con `psql` localmente para confirmar.

**El log dice `MaxRetriesPerRequestError` o los workers no procesan jobs**
→ La `REDIS_URL` está mal o el TLS no se aceptó. Tiene que empezar con `rediss://` (dos `s`).

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
→ El plan free tiene 512 MB. Soluciones: (1) partir el frontend a un Static Site aparte (también gratis); (2) cachear node_modules con artifacts en CI antes de subir a Render.
