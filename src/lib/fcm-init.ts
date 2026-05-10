import admin from 'firebase-admin';
import type { Messaging } from 'firebase-admin/messaging';
import type { AppEnv } from '@/config/env.js';
import type { AppLogger } from '@/lib/logger-types.js';

// Inicializa firebase-admin para procesos que no son la app Fastify (workers).
// Reusa la app singleton si ya fue inicializada en este process.
export function initFcmFromEnv(env: AppEnv, logger: AppLogger): Messaging | null {
  if (!env.FIREBASE_SERVICE_ACCOUNT_JSON) {
    logger.warn('FIREBASE_SERVICE_ACCOUNT_JSON not set — FCM disabled in worker');
    return null;
  }

  let parsed: admin.ServiceAccount;
  try {
    parsed = JSON.parse(env.FIREBASE_SERVICE_ACCOUNT_JSON) as admin.ServiceAccount;
  } catch (err) {
    logger.error({ err }, 'invalid FIREBASE_SERVICE_ACCOUNT_JSON');
    return null;
  }

  const existing = admin.apps.length > 0 ? admin.apps[0] : null;
  const fbApp = existing ?? admin.initializeApp({ credential: admin.credential.cert(parsed) });
  return fbApp.messaging();
}
