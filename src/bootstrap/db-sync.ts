import { spawn } from 'node:child_process';
import type { FastifyBaseLogger } from 'fastify';

// Sincroniza el schema de Prisma con la DB ejecutando `prisma db push`.
// Idempotente: si el schema ya está aplicado, prisma loguea "Already in sync".
// Lo corremos desde el bootstrap del proceso (no en el startCommand del PaaS)
// para que sea independiente de cómo la persona configure el dashboard.
const SYNC_TIMEOUT_MS = 60_000;

export async function syncDatabaseSchema(logger: FastifyBaseLogger): Promise<void> {
  await new Promise<void>((resolve, reject) => {
    const child = spawn('npx', ['prisma', 'db', 'push', '--accept-data-loss', '--skip-generate'], {
      stdio: ['ignore', 'pipe', 'pipe'],
      env: process.env,
    });

    // `prisma db push` puede quedarse colgado indefinidamente contra un pooler
    // (espera un advisory lock que nunca consigue). Sin este corte el boot nunca
    // llega a app.listen() y el PaaS mata el proceso por falta de puerto abierto.
    const timer = setTimeout(() => {
      child.kill('SIGKILL');
      reject(new Error(`prisma db push timed out after ${SYNC_TIMEOUT_MS}ms`));
    }, SYNC_TIMEOUT_MS);

    let stdout = '';
    let stderr = '';
    child.stdout.on('data', (chunk: Buffer) => {
      stdout += chunk.toString();
    });
    child.stderr.on('data', (chunk: Buffer) => {
      stderr += chunk.toString();
    });

    child.on('error', (err) => {
      clearTimeout(timer);
      reject(err);
    });
    child.on('close', (code) => {
      clearTimeout(timer);
      if (code === 0) {
        logger.info({ output: stdout.trim().slice(-500) }, 'db schema synced');
        resolve();
      } else {
        reject(
          new Error(
            `prisma db push exited with code ${code}\nstdout: ${stdout}\nstderr: ${stderr}`,
          ),
        );
      }
    });
  });
}
