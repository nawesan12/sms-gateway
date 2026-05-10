// Imprime el secret HMAC derivado para usar en la suscripción de webhook
// del upstream (campo `signingSecret` al hacer POST /webhooks). Determinista:
// mismo MASTER_ENCRYPTION_KEY_B64 → mismo secret. Si rotás la master key,
// hay que re-suscribir el webhook con el nuevo secret.
//
// Uso:
//   tsx scripts/print-webhook-secret.ts
import 'dotenv/config';
import { deriveSecret } from '../src/lib/derive-secret.js';
import { UPSTREAM_WEBHOOK_SECRET_LABEL } from '../src/modules/webhooks/webhooks.routes.js';

const masterKey = process.env.MASTER_ENCRYPTION_KEY_B64;
if (!masterKey) {
  console.error('MASTER_ENCRYPTION_KEY_B64 no está seteada en el entorno');
  process.exit(1);
}

const secret = deriveSecret(masterKey, UPSTREAM_WEBHOOK_SECRET_LABEL);
console.log(secret);
