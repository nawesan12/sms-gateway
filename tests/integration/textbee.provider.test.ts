import { describe, it, expect, afterEach } from 'vitest';
import nock from 'nock';
import { TextBeeProvider } from '@/modules/sms/providers/textbee.provider.js';

const env = {
  TEXTBEE_BASE_URL: 'https://api.textbee.dev/api/v1/gateway',
  TEXTBEE_TIMEOUT_MS: 5000,
  TEXTBEE_MAX_RETRIES: 1,
} as never;

const logger = { warn() {}, info() {}, error() {}, debug() {} } as never;

afterEach(() => {
  nock.cleanAll();
});

describe('TextBeeProvider.sendSMS', () => {
  it('envia con exito y devuelve providerMessageId', async () => {
    const scope = nock('https://api.textbee.dev')
      .post('/api/v1/gateway/devices/dev-1/send-sms', { recipients: ['+5491150000001'], message: 'hola' })
      .matchHeader('x-api-key', 'k')
      .reply(200, { data: { messageId: 'mid-123' } });

    const p = new TextBeeProvider(env, logger);
    const r = await p.sendSMS({
      textbeeDeviceId: 'dev-1',
      apiKey: 'k',
      recipients: ['+5491150000001'],
      message: 'hola',
    });
    expect(r.ok).toBe(true);
    expect(r.providerMessageId).toBe('mid-123');
    scope.done();
  });

  it('retorna error normalizado en 500', async () => {
    nock('https://api.textbee.dev')
      .post('/api/v1/gateway/devices/dev-1/send-sms')
      .twice() // axios-retry
      .reply(500, { message: 'boom' });

    const p = new TextBeeProvider(env, logger);
    const r = await p.sendSMS({
      textbeeDeviceId: 'dev-1',
      apiKey: 'k',
      recipients: ['+1'],
      message: 'm',
    });
    expect(r.ok).toBe(false);
    expect(r.errorCode).toBe('HTTP_500');
  });

  it('retorna error en 4xx sin retry', async () => {
    nock('https://api.textbee.dev')
      .post('/api/v1/gateway/devices/dev-1/send-sms')
      .reply(401, { error: 'unauthorized' });

    const p = new TextBeeProvider(env, logger);
    const r = await p.sendSMS({
      textbeeDeviceId: 'dev-1',
      apiKey: 'k',
      recipients: ['+1'],
      message: 'm',
    });
    expect(r.ok).toBe(false);
    expect(r.errorCode).toBe('HTTP_401');
  });
});
