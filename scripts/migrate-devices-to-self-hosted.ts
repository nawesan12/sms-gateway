// CLI interactivo para re-vincular cada Device de la DB con las credenciales
// nuevas (textbeeDeviceId + apiKey) emitidas por el gateway upstream propio.
//
// Para cada device existente, prompts:
//   - newTextbeeDeviceId (vacío para skip)
//   - newApiKey (vacío para skip)
//
// La nueva apiKey se cifra con MASTER_ENCRYPTION_KEY_B64. Resetea
// circuitState/failureCount/status para arrancar limpio.
//
// Uso:
//   tsx scripts/migrate-devices-to-self-hosted.ts
import 'dotenv/config';
import { createInterface } from 'node:readline/promises';
import { stdin as input, stdout as output } from 'node:process';
import { PrismaClient } from '@prisma/client';
import { DeviceCrypto } from '../src/modules/devices/crypto.js';

async function main(): Promise<void> {
  const masterKey = process.env.MASTER_ENCRYPTION_KEY_B64;
  if (!masterKey) {
    console.error('MASTER_ENCRYPTION_KEY_B64 no está seteada en el entorno');
    process.exit(1);
  }

  const prisma = new PrismaClient();
  const crypto = new DeviceCrypto(masterKey);
  const rl = createInterface({ input, output });

  try {
    const devices = await prisma.device.findMany({ orderBy: { priority: 'asc' } });
    if (devices.length === 0) {
      console.log('No hay devices en la DB.');
      return;
    }

    console.log(`\nEncontré ${devices.length} device(s). Vamos uno por uno.\n`);

    for (const d of devices) {
      console.log(`-----------------------------------------------------------`);
      console.log(`Device:   ${d.name}  (id=${d.id})`);
      console.log(`Actual:   textbeeDeviceId=${d.textbeeDeviceId}  status=${d.status}`);

      const newId = (await rl.question('  → newTextbeeDeviceId (enter = skip): ')).trim();
      if (!newId) {
        console.log('  → skip\n');
        continue;
      }

      const newKey = (await rl.question('  → newApiKey (enter = skip): ')).trim();
      if (!newKey) {
        console.log('  → skip (faltó apiKey)\n');
        continue;
      }

      const apiKeyEncrypted = crypto.encrypt(newKey);
      await prisma.device.update({
        where: { id: d.id },
        data: {
          textbeeDeviceId: newId,
          apiKeyEncrypted,
          status: 'ACTIVE',
          circuitState: 'CLOSED',
          failureCount: 0,
          circuitOpenedAt: null,
        },
      });

      console.log(`  ✓ migrado: ${d.textbeeDeviceId} → ${newId}\n`);
    }

    console.log('Listo.');
  } finally {
    rl.close();
    await prisma.$disconnect();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
