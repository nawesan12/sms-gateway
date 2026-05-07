# Deploy del SMS Gateway en Render

Guía completa para deployar el sistema multi-tenant en Render desde cero (sirve también para una compu nueva).

El stack: 1 deploy = 1 API + 1 Worker + 1 Postgres + 1 Redis. Todos los clientes comparten esa infra y cada uno tiene su saldo de tokens prepagos aislado.

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

## Paso 1 — En la otra compu: generar secrets

No hace falta clonar el repo (Render lo va a clonar solo). Solo generar las claves criptográficas:

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

**Guardar los 4 valores en un password manager.** Se pegan en el dashboard de Render en el paso 3.

> En Windows sin `openssl` instalado: usar Git Bash, WSL, o el contenedor `docker run --rm alpine sh -c "apk add openssl && openssl rand -base64 32"`.

---

## Paso 2 — Crear el Blueprint en Render (sin OAuth de GitHub)

1. Ir a https://render.com/ y crear cuenta (o loguearse) con email/Google. **No conectar GitHub.**
2. **New → Blueprint**.
3. Cuando pida el repo, en lugar de elegir uno de la lista, hacer click en **"Public Git Repository"** abajo.
4. Pegar la URL: `https://github.com/nawesan12/sms-gateway`
5. **Connect** → Render lee el `render.yaml` y muestra los recursos a crear.
6. **Apply**. Render crea 4 recursos:
   - `sms-gateway-db` (Postgres free)
   - `sms-gateway-redis` (KeyValue free)
   - `sms-gateway-api` (Web service starter, ~$7/mo)
   - `sms-gateway-worker` (Worker starter, ~$7/mo)

> El primer deploy va a **fallar** al arrancar porque faltan los secrets — es normal.

> **Auto-deploy**: cada vez que el owner hace `git push origin main`, Render del otro detecta el nuevo commit (vía polling público de GitHub) y rebuildea automáticamente. No requiere webhooks ni OAuth.

---

## Paso 3 — Setear secrets en cada service

En el dashboard de Render, abrir **`sms-gateway-api` → Environment → Edit env vars** y completar las 5 variables marcadas con `sync: false`:

| Key | Valor |
|---|---|
| `JWT_PRIVATE_KEY_B64` | (del paso 1) |
| `JWT_PUBLIC_KEY_B64` | (del paso 1) |
| `MASTER_ENCRYPTION_KEY_B64` | (del paso 1) |
| `ADMIN_BOOTSTRAP_TOKEN` | (del paso 1) |
| `APP_BASE_URL` | `https://sms-gateway-api-XXXX.onrender.com` (el subdominio asignado por Render — lo ves arriba en el service) |

En el **Worker (`sms-gateway-worker`)** solo hace falta:

| Key | Valor |
|---|---|
| `MASTER_ENCRYPTION_KEY_B64` | (mismo valor que en api) |

**Save** → Render redeploy automáticamente. Esta vez debería arrancar.

---

## Paso 4 — Verificar

```bash
# Health (debería devolver 200)
curl https://sms-gateway-api-XXXX.onrender.com/health

# Listado de clientes (200 con array vacío)
curl -H "x-bootstrap-token: TU_BOOTSTRAP_TOKEN" \
  https://sms-gateway-api-XXXX.onrender.com/v1/admin/users
```

Si `/health` da 200 pero `/v1/admin/users` da 500, el Postgres todavía no migró. Esperar 1 min y reintentar — el Dockerfile corre `prisma migrate deploy` al arrancar y en el primer boot tarda un poco más.

---

## Paso 5 — Seedear el admin operador (una sola vez)

En Render dashboard, abrir el service web → **Shell** (tab arriba a la derecha) → ejecutar:

```bash
npm run prisma:seed
```

Salida esperada: `✓ Created admin user +5491100000001`. Ya quedó.

---

## Paso 6 — Onboardear primer cliente

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

## Paso 7 — Operación día a día

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
- **El Postgres free** de Render se elimina si el service queda inactivo 90 días. Para producción real conviene pasarlo a starter (~$7/mo).
- **`WORKER_MAX_RETRIES=3`** significa que un SMS reintenta hasta 4 veces antes de irse a DLQ y refundear el token. Si el TextBee tarda mucho, ajustá `TEXTBEE_TIMEOUT_MS` en el dashboard.
- **Operador vs cliente**:
  - El **operador** (vos) usa `x-bootstrap-token` y solo puede gestionar (crear access links, top-ups, ver listados). NO puede mandar SMS — es por diseño, para evitar débitos sin owner identificado.
  - El **cliente** usa su access token (`Authorization: Bearer ...` o el header equivalente vía localStorage del frontend) y puede mandar SMS, lanzar campañas y consultar SU saldo. Cada SMS le debita 1 token de SU balance.
- **Costo estimado para N clientes**: ~$14/mes (API + Worker en starter). Postgres y Redis quedan en free al principio. La capacidad la limita más el Postgres free (1 GB, ~7 días retention) que cualquier otra cosa.

---

## Troubleshooting

**El deploy falla al arrancar con `Invalid environment configuration`**
→ Falta alguno de los secrets del paso 3. Revisar en Environment tab que estén las 5 variables.

**`/health` da 200 pero `/v1/admin/users` da 500**
→ Postgres no migró todavía. Esperar 30-60 segundos. Si sigue fallando, abrir Logs del service web y buscar `prisma migrate deploy` para ver el error.

**`POST /v1/sms/send` da 402 INSUFFICIENT_TOKENS**
→ El cliente se quedó sin saldo. Recargar con el endpoint de top-up.

**`POST /v1/sms/send` da 503 DEVICE_OFFLINE**
→ No hay devices Android registrados o todos están con circuit-breaker abierto. Registrar uno o revisar el estado de los existentes en `GET /v1/admin/devices`.

**Cliente perdió su link de acceso**
→ Regenerar con `POST /v1/admin/auth/access-link` (sin `initialTokens` para no recargar de más). El link viejo queda invalidado, el saldo se mantiene.
