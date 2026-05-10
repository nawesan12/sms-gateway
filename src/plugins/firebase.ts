import fp from 'fastify-plugin';
import admin from 'firebase-admin';

// Inicializa firebase-admin como singleton. Si FIREBASE_SERVICE_ACCOUNT_JSON
// no está seteado, decora app.fcm = null y los envíos van a fallar con
// NO_FCM_CONFIG (esperado en dev local sin Firebase).
export default fp(
  async (app) => {
    const raw = app.env.FIREBASE_SERVICE_ACCOUNT_JSON;
    if (!raw) {
      app.log.warn('FIREBASE_SERVICE_ACCOUNT_JSON not set — FCM disabled');
      app.decorate('fcm', null);
      return;
    }

    let parsed: admin.ServiceAccount;
    try {
      parsed = JSON.parse(raw) as admin.ServiceAccount;
    } catch (err) {
      app.log.error({ err }, 'invalid FIREBASE_SERVICE_ACCOUNT_JSON');
      throw new Error('FIREBASE_SERVICE_ACCOUNT_JSON is not valid JSON');
    }

    const existing = admin.apps.length > 0 ? admin.apps[0] : null;
    const fbApp =
      existing ??
      admin.initializeApp({
        credential: admin.credential.cert(parsed),
      });

    app.decorate('fcm', fbApp.messaging());
    app.log.info({ projectId: parsed.projectId }, 'firebase-admin initialized');
  },
  { name: 'firebase', dependencies: ['env'] },
);
