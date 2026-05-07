# Deploy del SMS Gateway en Render

Guía completa para deployar el sistema multi-tenant en Render desde cero (sirve también para una compu nueva).

El stack: **1 API + 1 Worker en Render**, **Postgres en Supabase**, **Redis en Upstash**. Todos los clientes comparten esa infra y cada uno tiene su saldo de tokens prepagos aislado.

> **Por qué este split**: Render corre la app, pero la base y el cache van afuera (Supabase y Upstash tienen tier free generoso y se administran solos). El `render.yaml` ya no provisiona Postgres ni Redis — vos los traés.

---

> **Sobre el modelo de deploy**: la otra compu / otra persona NO necesita conectar su cuenta de GitHub a Render. El repo `github.com/nawesan12/sms-gateway` es público — Render permite deployar repos públicos sin OAuth pegando solo la URL.

## Paso 0 — En la compu donde está el código (owner)

Push de los cambios al repo. Cualquier push tuyo a `main` dispara auto-deploy en el Render del otro.

```bash
git add .
git commit -m "feat: tokens prepagos + multi-tenant + access link"
git push origin main
```

---

## Paso 1 — Generar secrets criptográficos

No hace falta clonar el repo (Render lo va a clonar solo). Solo generar las claves:

```bash
# JWT RS256 keys
openssl genrsa -out /tmp/private.pem 2048
openssl rsa -in /tmp/private.pem -pubout -out /tmp/public.pem
echo "JWT_PRIVATE_KEY_B64=$(base64 -i /tmp/private.pem | tr -d '\n')"
echo "JWT_PUBLIC_KEY_B64=$(base64 -i /tmp/public.pem | tr -d '\n')"

# Master encryption key (32 bytes para AES-256-GCM)
echo "MASTER_ENCRYPTION_KEY_B64=$(openssl rand -base64 32)"

# Bootstrap token (lo usa el operador en x-bootstrap-token)
echo "ADMIN_BOOTSTRAP_TOKEN=$(openssl rand -base64 32 | tr -d '/+=' | head -c 40)"

# Borrar los pem temporales
rm /tmp/private.pem /tmp/public.pem
```

**Guardar los 4 valores en un password manager.** Se pegan en Render más adelante.

> En Windows sin `openssl`: usar Git Bash, WSL, o `docker run --rm alpine sh -c "apk add openssl && openssl rand -base64 32"`.

---

## Paso 2 — Crear Postgres en Supabase

1. Ir a https://supabase.com → **New project**.
2. Nombre cualquiera, region más cercana al usuario (p. ej. `South America (São Paulo)`), elegir un password fuerte para el DB user.
3. Esperar ~2 min hasta que termine de provisionar.
4. **Project Settings → Database → Connection string → URI** (no el "pooler", la URI directa).
5. Copiar la string. Va a verse así:
   ```
   postgresql://postgres:<TU_PASSWORD>:@db.<ref>.supabase.co:5432/postgres
   ```
6. Agregarle `?sslmode=require` al final:
   ```
   postgresql://postgres:<TU_PASSWORD>@db.<ref>.supabase.co:5432/postgres?sslmode=require
   ```

Ese string completo es la `DATABASE_URL` que pegás en Render. Guardalo.

---

## Paso 3 — Crear Redis en Upstash

1. Ir a https://upstash.com → **Create Database** → tipo **Redis**.
2. Region cercana, **TLS/SSL: Enabled** (default).
3. Una vez creado, en el dashboard de la DB → **Connect → Node** → copiar la **TLS connection string** (empieza con `rediss://`):
   ```
   rediss://default:<TOKEN>@<host>.upstash.io:6379
   ```

Ese string completo es la `REDIS_URL`. Guardalo.

---

## Paso 4 — Crear el Blueprint en Render (sin OAuth de GitHub)

1. Ir a https://render.com/ y crear cuenta (o loguearse) con email/Google. **No conectar GitHub.**
2. **New → Blueprint**.
3. Cuando pida el repo, en lugar de elegir uno de la lista, click en **"Public Git Repository"** abajo.
4. Pegar la URL: `https://github.com/nawesan12/sms-gateway`
5. **Connect** → Render lee el `render.yaml` y muestra los recursos a crear.
6. **Apply**. Render crea 2 services:
   - `sms-gateway-api` (Web, starter ~$7/mo)
   - `sms-gateway-worker` (Worker, starter ~$7/mo)

> El primer deploy va a **fallar** al arrancar porque faltan los secrets — es normal. El log va a decir `Invalid environment configuration: DATABASE_URL ...` etc. Eso confirma que llegó a leer las envs.

> **Auto-deploy**: cada vez que el owner hace `git push origin main`, Render detecta el commit y rebuildea automáticamente. No requiere webhooks ni OAuth.

---

## Paso 5 — Setear secrets en cada service

En el dashboard de Render, abrir **`sms-gateway-api` → Environment → Edit env vars** y completar las 7 variables marcadas como `sync: false`:

| Key | Valor |
|---|---|
| `DATABASE_URL` | (del paso 2 — Supabase con `?sslmode=require`) |
| `REDIS_URL` | (del paso 3 — Upstash, empieza con `rediss://`) |
| `JWT_PRIVATE_KEY_B64` | (del paso 1) |
| `JWT_PUBLIC_KEY_B64` | (del paso 1) |
| `MASTER_ENCRYPTION_KEY_B64` | (del paso 1) |
| `ADMIN_BOOTSTRAP_TOKEN` | (del paso 1) |
| `APP_BASE_URL` | `https://sms-gateway-api-XXXX.onrender.com` (el subdominio que asignó Render — lo ves arriba en el service) |

En el **Worker (`sms-gateway-worker`)** completar las 3:

| Key | Valor |
|---|---|
| `DATABASE_URL` | (mismo que en api) |
| `REDIS_URL` | (mismo que en api) |
| `MASTER_ENCRYPTION_KEY_B64` | (mismo que en api) |

**Save** en cada uno → Render redeploy automáticamente. Esta vez debería arrancar.

> El API corre `npx prisma migrate deploy` como **preDeploy command** antes de cada arranque, así que la primera vez crea todas las tablas en Supabase. No hace falta hacerlo a mano.

---

## Paso 6 — Verificar

```bash
# Health (debería devolver 200)
curl https://sms-gateway-api-XXXX.onrender.com/health

# Listado de clientes (200 con array vacío)
curl -H "x-bootstrap-token: TU_BOOTSTRAP_TOKEN" \
  https://sms-gateway-api-XXXX.onrender.com/v1/admin/users
```

Si `/health` da 200 pero `/v1/admin/users` da 500, abrí los logs del API y buscá el error de Prisma — lo más común es que la `DATABASE_URL` está sin `?sslmode=require`.

---

## Paso 7 — Seedear el admin operador (una sola vez)

En Render dashboard, abrir el service web → **Shell** (tab arriba a la derecha) → ejecutar:

```bash
npm run prisma:seed
```

Salida esperada: `✓ Created admin user +5491100000001`. Ya quedó.

---

## Paso 8 — Onboardear primer cliente

Desde tu compu local (con curl):

```bash
export BOOTSTRAP="TU_BOOTSTRAP_TOKEN"
export API="https://sms-gateway-api-XXXX.onrender.com"

# Crear cliente con 1000 tokens precargados
curl -X POST $API/v1/admin/auth/access-link \
  -H "x-bootstrap-token: $BOOTSTRAP" \
  -H "content-type: application/json" \
  -d '{"phoneE164":"+5491132xxxxxx","initialTokens":1000,"role":"ADMIN"}'

# Respuesta:
# {
#   "data": {
#     "link": "https://sms-gateway-api-XXXX.onrender.com/login?token=AbCd...",
#     "userId": "uuid-del-cliente",
#     "balance": 1000
#   }
# }
```

Le mandás el `link` al cliente. Cuando lo abre, queda logueado en el panel automáticamente.

---

## Paso 9 — Operación día a día

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

# Historial de movimientos del cliente
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

Después del primer cliente hay que registrar al menos un device Android (TextBee) o no salen los SMS:

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

- **El subdominio de Render es fijo** una vez creado (`sms-gateway-api-XXXX.onrender.com`). Si después agregás un dominio custom (ej. `gateway.tudominio.com`), actualizá `APP_BASE_URL` en el dashboard y redeploy. Si no, los links de acceso seguirán apuntando al subdominio viejo.
- **Supabase free** tier: 500 MB de Postgres, pause automático tras 7 días inactivo. Para producción real, upgrade a Pro ($25/mo) o pasarlo a Neon/Railway.
- **Upstash free** tier: 10k commands/día, 256 MB. BullMQ usa pocos commands por SMS, alcanza tranquilo para arrancar; cuando crezca el volumen mirar el dashboard de Upstash y subir de plan si hace falta.
- **`WORKER_MAX_RETRIES=3`** significa que un SMS reintenta hasta 4 veces antes de irse a DLQ y refundear el token. Si el TextBee tarda mucho, ajustá `TEXTBEE_TIMEOUT_MS` en el dashboard.
- **Operador vs cliente**:
  - El **operador** (vos) usa `x-bootstrap-token` y solo puede gestionar (crear access links, top-ups, ver listados). NO puede mandar SMS — es por diseño, para evitar débitos sin owner identificado.
  - El **cliente** usa su access token (`Authorization: Bearer ...` o el header equivalente vía localStorage del frontend) y puede mandar SMS, lanzar campañas y consultar SU saldo. Cada SMS le debita 1 token de SU balance.
- **Costo estimado**: ~$14/mes en Render (API + Worker en starter), $0 en Supabase free, $0 en Upstash free. Total ≈ $14/mo para arrancar. Cuando escale, lo primero que hay que upgradeear es Supabase.

---

## Troubleshooting

**El deploy falla al arrancar con `Invalid environment configuration`**
→ Falta alguna env del paso 5. El log dice exactamente cuál (`DATABASE_URL`, `REDIS_URL`, etc.). Revisar en el Environment tab del service que está fallando — ojo que api y worker se setean por separado.

**El log dice `Can't reach database server` o `P1001`**
→ La `DATABASE_URL` está mal. Casos típicos: falta `?sslmode=require`, password con caracteres especiales sin URL-encode, o copiaste la URL del **pooler** (puerto 6543) en vez de la directa (5432) — para `prisma migrate deploy` usá la directa.

**El log dice `MaxRetriesPerRequestError` o el worker no procesa jobs**
→ La `REDIS_URL` está mal o el TLS no se aceptó. Verificá que empiece con `rediss://` (dos `s`) y que el token esté completo. Upstash a veces te da una URL "non-TLS" en `:6379` y otra TLS — usar la TLS.

**`/health` da 200 pero `/v1/admin/users` da 500**
→ El `preDeployCommand` (migraciones) falló silenciosamente. Abrir los logs del último deploy del API y buscar `prisma migrate deploy` para ver el error real.

**`POST /v1/sms/send` da 402 INSUFFICIENT_TOKENS**
→ El cliente se quedó sin saldo. Recargar con el endpoint de top-up.

**`POST /v1/sms/send` da 503 DEVICE_OFFLINE**
→ No hay devices Android registrados o todos están con circuit-breaker abierto. Registrar uno o revisar el estado de los existentes en `GET /v1/admin/devices`.

**Cliente perdió su link de acceso**
→ Regenerar con `POST /v1/admin/auth/access-link` (sin `initialTokens` para no recargar de más). El link viejo queda invalidado, el saldo se mantiene.
