import { describe, it, expect } from 'vitest';
import { generateNumericCode } from '@/lib/otp-code.js';

describe('generateNumericCode', () => {
  it('respeta la longitud', () => {
    for (let i = 0; i < 50; i++) {
      const code = generateNumericCode(6);
      expect(code).toMatch(/^\d{6}$/);
    }
  });

  it('rechaza largos invalidos', () => {
    expect(() => generateNumericCode(3)).toThrow();
    expect(() => generateNumericCode(11)).toThrow();
  });

  it('genera codigos distintos en alta probabilidad', () => {
    const set = new Set<string>();
    for (let i = 0; i < 100; i++) set.add(generateNumericCode(6));
    expect(set.size).toBeGreaterThan(80);
  });
});
