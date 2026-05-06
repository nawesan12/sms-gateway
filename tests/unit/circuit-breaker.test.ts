import { describe, it, expect } from 'vitest';
import { CircuitState, type Device } from '@prisma/client';
import { DeviceCircuitBreaker } from '@/modules/sms/circuit-breaker.js';

const fakeEnv = {
  CIRCUIT_FAILURE_THRESHOLD: 3,
  CIRCUIT_RESET_TIMEOUT_MS: 1000,
} as never;

const fakeLogger = { warn() {}, info() {}, error() {}, debug() {} } as never;

function makeDevice(overrides: Partial<Device> = {}): Device {
  return {
    id: 'dev-1',
    name: 't',
    textbeeDeviceId: 'tb',
    apiKeyEncrypted: 'x',
    priority: 100,
    status: 'ACTIVE' as never,
    batteryLevel: null,
    lastHeartbeat: null,
    failureCount: 0,
    circuitState: CircuitState.CLOSED,
    circuitOpenedAt: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  } as Device;
}

describe('DeviceCircuitBreaker.isAvailable', () => {
  const cb = new DeviceCircuitBreaker({} as never, fakeEnv, fakeLogger);

  it('disponible si CLOSED', () => {
    expect(cb.isAvailable(makeDevice())).toBe(true);
  });

  it('no disponible si OPEN reciente', () => {
    const d = makeDevice({ circuitState: CircuitState.OPEN, circuitOpenedAt: new Date() });
    expect(cb.isAvailable(d)).toBe(false);
  });

  it('disponible si OPEN pero ya paso el reset', () => {
    const d = makeDevice({
      circuitState: CircuitState.OPEN,
      circuitOpenedAt: new Date(Date.now() - 5_000),
    });
    expect(cb.isAvailable(d)).toBe(true);
  });

  it('disponible si HALF_OPEN', () => {
    const d = makeDevice({ circuitState: CircuitState.HALF_OPEN });
    expect(cb.isAvailable(d)).toBe(true);
  });
});
