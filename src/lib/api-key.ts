import { createHmac, randomBytes } from 'node:crypto';

// Genera una apiKey en plaintext (32 bytes random → 43 chars base64url).
// Solo se ve una vez en la response del create; después solo guardamos el hash.
export function generateApiKey(): string {
  return randomBytes(32).toString('base64url');
}

// Hash determinista HMAC-SHA256 con la master key para lookup O(1) por apiKey.
// Mismo input → mismo hash, así que se puede consultar `WHERE apiKeyHash = ?`.
export function hashApiKey(masterKeyB64: string, plain: string): string {
  const key = Buffer.from(masterKeyB64, 'base64');
  return createHmac('sha256', key).update(plain).digest('hex');
}
