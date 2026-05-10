import { hkdfSync } from 'node:crypto';

// Deriva un secret determinista de 32 bytes a partir de la master key
// (ya almacenada en MASTER_ENCRYPTION_KEY_B64). Mismo input → mismo output.
// Útil para evitar tener que pegar otra env var en Render; el secret se
// regenera en runtime cada vez que arranca el proceso.
export function deriveSecret(masterKeyB64: string, label: string): string {
  const key = Buffer.from(masterKeyB64, 'base64');
  if (key.length !== 32) {
    throw new Error('Master key must decode to 32 bytes');
  }
  const out = hkdfSync('sha256', key, Buffer.alloc(0), Buffer.from(label, 'utf8'), 32);
  return Buffer.from(out).toString('hex');
}
