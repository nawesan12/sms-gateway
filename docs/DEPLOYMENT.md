# Deployment — Docker Hub × Render

Manual paso-a-paso para:
1. Buildear la imagen Docker (incluye backend + UI).
2. Pushearla a **una o varias** cuentas de Docker Hub (multi-cliente).
3. Deployar el stack completo (API + Worker + Postgres + Redis) en Render.

> Pensado para hacerse desde una compu Windows (también funciona en macOS/Linux).

---

## 0 · Prerrequisitos

| Tool | Windows | macOS/Linux |
|---|---|---|
| **Docker Desktop** ≥ 24 | <https://docs.docker.com/desktop/install/windows-install/> | `brew install --cask docker` |
| **Git** | <https://git-scm.com/download/win> | preinstalado |
| **OpenSSL** | viene con Git Bash (en `C:\Program Files\Git\usr\bin\openssl.exe`) o `choco install openssl` | preinstalado |
| **jq** (solo para script Bash) | `choco install jq` o usá la versión PowerShell | `brew install jq` |
| Cuenta(s) **Docker Hub** | <https://hub.docker.com> | — |
| Cuenta **Render** | <https://render.com> | — |

Una vez instalado Docker Desktop en Windows, **iniciá la app** y aceptá WSL2 si te lo pide. Verificá:

```powershell
docker --version
docker buildx version
```

---

## 1 · Clonar el repo en la compu Windows

```powershell
git clone https://github.com/<tu-org>/sms-gateway.git
cd sms-gateway
```

---

## 2 · Generar los secrets (una sola vez)

Estos van a ir como env vars en Render. **No commitearlos.**

### PowerShell

```powershell
.\scripts\deploy\generate-secrets.ps1 | Out-File -Encoding utf8 secrets.env
notepad secrets.env
```

### Git Bash / macOS / Linux

```bash
./scripts/deploy/generate-secrets.sh > secrets.env
cat secrets.env
```

El archivo va a tener algo así:

```
JWT_PRIVATE_KEY_B64=LS0tLS1CRUdJTi...
JWT_PUBLIC_KEY_B64=LS0tLS1CRUdJTi...
MASTER_ENCRYPTION_KEY_B64=k3uV...
ADMIN_BOOTSTRAP_TOKEN=8f3a9c...
```

Guardalo en un password manager (1Password / Bitwarden). **No lo subas a git.**

---

## 3 · Configurar las cuentas Docker Hub

Copiá el ejemplo:

```powershell
# Windows
Copy-Item scripts\deploy\accounts.example.json scripts\deploy\accounts.json
```

```bash
# Bash
cp scripts/deploy/accounts.example.json scripts/deploy/accounts.json
```

Editalo y poné tus cuentas:

```json
{
  "image": "sms-gateway",
  "tag": "latest",
  "registries": [
    {
      "name": "main",
      "registry": "docker.io",
      "username": "miusuario",
      "passwordEnv": "DOCKER_PASSWORD_MAIN",
      "repo": "miusuario/sms-gateway"
    },
    {
      "name": "client-acme",
      "registry": "docker.io",
      "username": "acmehub",
      "passwordEnv": "DOCKER_PASSWORD_ACME",
      "repo": "acmehub/sms-gateway"
    }
  ]
}
```

> **Importante:** los repos tienen que existir en Docker Hub antes de pushear. Andá a <https://hub.docker.com/repositories> y creá uno por cuenta.

### 3.a · Crear Access Tokens (no usar la pass real)

En Docker Hub: **Account Settings → Security → New Access Token** (con permiso *Read, Write*).
Copiá el token — solo se ve una vez.

Esos tokens son los `passwords` que vas a exportar como env vars antes de correr el script.

---

## 4 · Buildear y pushear

### PowerShell (Windows nativo)

```powershell
$env:DOCKER_PASSWORD_MAIN = "dckr_pat_xxxxxxxxxxxx"
$env:DOCKER_PASSWORD_ACME = "dckr_pat_yyyyyyyyyyyy"

.\scripts\deploy\build-and-push.ps1
```

### Git Bash / macOS / Linux

```bash
export DOCKER_PASSWORD_MAIN="dckr_pat_xxxxxxxxxxxx"
export DOCKER_PASSWORD_ACME="dckr_pat_yyyyyyyyyyyy"

./scripts/deploy/build-and-push.sh
```

Qué hace:

1. Verifica config + creds.
2. `docker buildx build --platform linux/amd64` (compatible con Render).
3. Tagea la imagen con `:latest` y `:<git-sha>`.
4. Por cada cuenta del JSON: `docker login` → `docker tag` → `docker push` → `docker logout`.
5. Si una cuenta no tiene su variable de password seteada, la **saltea con un warning** (no aborta).

Tiempo: 4–6 min la primera vez (build), luego cache → 1–2 min.

Al terminar las imágenes ya están en:
- `docker.io/miusuario/sms-gateway:latest`
- `docker.io/acmehub/sms-gateway:latest`

---

## 5 · Deploy en Render

Hay 2 caminos. Elegí uno.

### 5.A · Blueprint automático (recomendado)

1. Subí el repo a GitHub.
2. En Render: **New +** → **Blueprint**.
3. Conectá el repo. Render lee `render.yaml` y propone:
   - Postgres `sms-gateway-db`
   - Redis (Key Value) `sms-gateway-redis`
   - Web service `sms-gateway-api` (Docker)
   - Worker `sms-gateway-worker` (Docker)
4. Click **Apply**.
5. **Antes del primer deploy** completá los 4 secrets en cada servicio (API + Worker comparten via Env Group `sms-gateway-shared`):
   - Andá a `sms-gateway-api → Environment` y pegá los valores de `secrets.env`.
   - Idem para `sms-gateway-worker`.
6. Volvé a la pestaña *Deploys* y dispará un **Manual Deploy → Clear cache & deploy**.

> El primer deploy corre `prisma migrate deploy` automáticamente (lo hace el `CMD` del Dockerfile).

### 5.B · Servicios uno por uno (manual)

Si preferís no usar Blueprint:

1. **PostgreSQL** → New + → PostgreSQL → plan free → región `oregon`. Copiá la *Internal Connection String* (`postgresql://...`).
2. **Web Service** (API + workers en el mismo proceso):
   - Source: **Existing Image** → URL: `docker.io/<usuario>/sms-gateway:latest`
   - Plan: Starter ($7/mo)
   - Health check path: `/health`
   - Env vars (todas las de `render.yaml` + los secrets de `secrets.env`). **No hace falta Redis**: la cola corre en Postgres y los rate-limits en memoria.

---

## 6 · Primera vez: registrar el primer device + login

```bash
API=https://sms-gateway-api.onrender.com    # tu URL
TOKEN=<ADMIN_BOOTSTRAP_TOKEN>

# Registrar device
curl -X POST $API/v1/devices \
  -H "x-bootstrap-token: $TOKEN" \
  -H "content-type: application/json" \
  -d '{
    "name": "phone-prod-1",
    "textbeeDeviceId": "<TEXTBEE_DEVICE_ID>",
    "apiKey": "<TEXTBEE_API_KEY>",
    "priority": 100
  }'

# Verificar
curl -H "x-bootstrap-token: $TOKEN" $API/health/ready
```

El panel queda en `https://sms-gateway-api.onrender.com/` — login con el bootstrap token.

---

## 7 · Actualizaciones

### Frontend o backend cambió:

```powershell
.\scripts\deploy\build-and-push.ps1
```

En Render → cada servicio → **Manual Deploy → Deploy latest reference** (o si activaste *autoDeploy*, se despliega solo cuando cambia el tag).

### Schema Prisma cambió:

El `CMD` corre `prisma migrate deploy` en el arranque. Solo asegurate de **commitear los `prisma/migrations/`** antes de pushear la imagen. Si no usás migrations y querés `db push`, cambiá el `CMD` a:

```dockerfile
CMD ["sh", "-c", "npx prisma db push --skip-generate && node dist/index.js"]
```

---

## 8 · Multi-tenant (varios clientes con la misma imagen)

La imagen es genérica; cada cliente tiene su propio:
- Postgres (datos aislados)
- Redis (cola aislada)
- `MASTER_ENCRYPTION_KEY_B64` distinta (no se comparten api keys cifradas)
- `ADMIN_BOOTSTRAP_TOKEN` distinto
- Su set de devices TextBee

Para cada cliente:
1. Generá un nuevo `secrets.env` con `generate-secrets`.
2. Crea un nuevo Blueprint en Render con sus servicios.
3. Si el cliente tiene su propia cuenta Docker Hub, agregala a `accounts.json` y reusas el mismo `.\build-and-push.ps1`.

---

## 9 · Costos referenciales (Render)

| Servicio | Plan free | Plan productivo |
|---|---|---|
| Postgres | free 90 días | Starter $7/mo · 256MB · 1GB storage |
| Redis (Key Value) | free 30MB | Starter $10/mo · 250MB |
| Web (API) | free 512MB *spin-down* | Starter $7/mo siempre activo |
| Worker | — (no hay free) | Starter $7/mo |
| **Total prod mínimo** | | **≈ $31/mo** + lo que cobre TextBee/Pack SMS de la SIM |

> El **plan free se duerme** después de 15 min sin tráfico — perfecto para staging, NO para que un cliente reciba SMS al instante. Pasá a Starter en producción.

---

## 10 · Troubleshooting rápido

| Síntoma | Causa probable | Fix |
|---|---|---|
| `Error: Required` al arrancar API | falta `JWT_*` o `MASTER_*` env var | completá secrets en Render |
| `prisma migrate deploy` falla con `P1001` | DB no accesible | revisar `DATABASE_URL`, esperar a que Postgres esté `available` |
| `DEVICE_OFFLINE` al enviar | no hay devices `ACTIVE` | registrar device + verificar que la app TextBee del Android esté online |
| Health check `/health/ready` devuelve `degraded` | falta device activo | registrar device |
| Push a Docker Hub falla con `denied: requested access to the resource is denied` | repo no existe o token sin permisos write | crear repo en hub.docker.com + regenerar token con permiso write |
| Worker no procesa jobs | FCM no configurado o sin devices con `fcmToken` | `curl /v1/debug/dispatch-check` con bootstrap token; ver `fcm.configured` y `devices[].hasFcmToken` |

---

## 11 · Checklist pre-go-live

- [ ] Secrets generados y guardados en password manager.
- [ ] Imagen pusheada y tags `latest` + `<sha>` visibles en Docker Hub.
- [ ] Blueprint aplicado en Render. Todos los servicios `Live`.
- [ ] `ADMIN_BOOTSTRAP_TOKEN` rotado (no usar el de dev).
- [ ] Device de TextBee registrado y `health/ready` devuelve 200.
- [ ] Probado un envío individual real `POST /v1/sms/send`.
- [ ] Probada una campaña de 2-3 contactos.
- [ ] DNS custom apuntando al servicio (opcional): Render → Settings → Custom Domain.
