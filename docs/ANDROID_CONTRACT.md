# Contrato con la app Android (CONGELADO)

La app Android del celu **ya fue entregada y no se puede actualizar**. Este documento describe el contrato exacto que el backend debe respetar para siempre. Cualquier cambio en los campos listados acá rompe la app sin remedio.

## 1. Payload FCM (backend → app)

El backend envía pushes FCM data-only. La app lee `data.smsData`, lo parsea como JSON, y dispara `SmsManager.sendTextMessage()` por cada recipiente.

### Estructura

```jsonc
{
  "data": {
    "smsData": "<JSON string — ver abajo>"
  },
  "android": {
    "priority": "high"
  }
  // sin TTL: FCM retiene el push hasta 4 semanas
}
```

### Contenido de `smsData` (string JSON)

```jsonc
{
  "recipients": ["+5491132111111"],    // E.164, siempre length=1 hoy
  "message": "Hola Juan...",            // string, 1..1600 chars
  "smsId": "<uuid>",                    // el ID del SmsMessage en la DB
  "smsBatchId": "<uuid>"                // == smsId (legacy, redundante)
}
```

Implementación: [`src/modules/sms/providers/fcm.provider.ts:43-58`](../src/modules/sms/providers/fcm.provider.ts).

### Invariantes (no tocar)

- El campo afuera **se llama `smsData`**, no `payload` ni `data` anidado.
- `smsData` **es un string JSON**, no un objeto. La app hace `JSON.parse(data.smsData)`.
- Las claves del objeto resultante son exactamente: `recipients`, `message`, `smsId`, `smsBatchId`.
- Agregar campos nuevos al objeto es OK (la app los ignora). **Renombrar o sacar campos NO.**
- `recipients` es siempre un array de strings E.164.
- `android.priority` es `"high"` para que FCM despierte el celu aunque esté en Doze Mode.

## 2. Endpoints app → backend

Prefijo `/v1/`. Auth: header `x-api-key` (plaintext, 32 bytes base64url) que el backend matchea por HMAC-SHA256 contra `Device.apiKeyHash`.

### 2.1 Registrar / refrescar FCM token

```
PATCH /v1/gateway/devices/:id
Headers: x-api-key: <apiKey-plaintext>
Content-Type: application/json
Body: { "fcmToken": "<string, 10..4096 chars>" }
Response 200: { "success": true }
```

La app pega acá cuando obtiene o refresca el token de Firebase. Hasta que esto no pase, el backend tiene `Device.fcmToken = NULL` y el router lo skipea — **no recibe ningún push**.

### 2.2 Heartbeat

```
POST /v1/gateway/devices/:id/heartbeat
Headers: x-api-key: <apiKey-plaintext>
Content-Type: application/json
Body: { "batteryLevel": 87 }    // int 0..100, opcional
Response 200: { "success": true }
```

Cada heartbeat actualiza `lastHeartbeat = NOW()` y pone el device en `ACTIVE`. Si el backend no recibe heartbeat en `DEVICE_OFFLINE_AFTER_SEC` (default 300s), el worker marca el device como `OFFLINE` — pero **igual se le manda FCM** porque high-priority despierta el celu desde Doze.

### 2.3 Reportar status de SMS

```
PATCH /v1/gateway/devices/:id/sms-status
Headers: x-api-key: <apiKey-plaintext>
Content-Type: application/json
Body: {
  "smsId": "<uuid>",                                    // el smsId del payload FCM
  "status": "sent" | "delivered" | "failed",
  "errorMessage": "<string, opcional, max 500 chars>"
}
Response 200: { "success": true }
```

Comportamiento del backend:

- `sent`: `SmsMessage.status: PENDING|RETRYING → SENT`, setea `sentAt` si no estaba.
- `delivered`: `SmsMessage.status → DELIVERED`, setea `deliveredAt` y `sentAt`.
- `failed`: `SmsMessage.status → FAILED`, guarda `errorCode='DEVICE_REPORTED_FAILURE'` y `errorMessage`.

**Si la app reporta un `smsId` que no existe (o ya expiró)**, el backend igual devuelve 200 OK y solo lo loguea como warning. La app no puede reaccionar a 404 (ya fue enviado el SMS), así que el silencio es deliberado.

## 3. Errores que la app puede ver

| Status | Caso | Body |
|---|---|---|
| 401 | `x-api-key` ausente o inválido | `{ "success": false, "error": "missing/invalid x-api-key" }` |
| 403 | `x-api-key` válido pero corresponde a otro `:id` | `{ "success": false, "error": "apiKey does not match deviceId" }` |
| 400 | Body no pasa validación (ej: `batteryLevel: 150`) | `{ "success": false, "error": { "code": "VALIDATION", ... } }` |
| 200 | OK (incluso si `smsId` desconocido en sms-status) | `{ "success": true }` |

## 4. Cosas que NO se pueden tocar del lado backend

- El nombre del campo **`smsData`** en el payload FCM.
- Las 4 claves dentro de `smsData` (`recipients`, `message`, `smsId`, `smsBatchId`).
- El formato **E.164** de los teléfonos en `recipients`.
- El header **`x-api-key`** (case-insensitive en HTTP pero la app lo manda así).
- El **prefijo `/v1/`** de las URLs.
- **`MASTER_ENCRYPTION_KEY_B64`** en producción. Rotarla invalida todos los `apiKeyHash` y la app queda sin auth.
- El **status 200 silencioso** del `sms-status` para `smsId` desconocido — si devolvemos 404, la app no sabe qué hacer.
- La validación mínima de `fcmToken` (10 chars). Subirla puede rechazar tokens válidos.

## 5. Cosas que SÍ se pueden cambiar sin romper la app

- Agregar nuevos campos a `smsData` (la app los ignora).
- Agregar endpoints nuevos en `/v1/gateway/...`.
- Cambiar la implementación interna (provider FCM, queue, etc.) mientras el wire-protocol se mantenga.
- Mensajes de error 4xx (la app generalmente no los procesa, salvo 401/403).

## 6. Cómo verificar

Tras cualquier cambio en el backend que toque dispatch o gateway:

```bash
# 1. Tests de contrato (deben pasar siempre):
npm run test -- tests/integration/android-contract.test.ts

# 2. Endpoint de debug:
curl -H "Authorization: Bearer <admin-token>" \
     https://<prod-url>/v1/debug/dispatch-check
# Verificar: fcm.configured=true y al menos 1 device con hasFcmToken=true.

# 3. Smoke test con el celu real:
#    Lanzar una campaña con 1 contacto → confirmar que el celu envía el SMS y
#    reporta status:sent vía PATCH /v1/gateway/devices/:id/sms-status.
```
