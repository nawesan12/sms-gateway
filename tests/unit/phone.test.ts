import { describe, it, expect } from 'vitest';
import { validateAndNormalizePhone } from '@/lib/phone.js';

describe('validateAndNormalizePhone', () => {
  it('valida y normaliza un AR mobile en formato local', () => {
    const r = validateAndNormalizePhone('1150000001', 'AR');
    expect(r.valid).toBe(true);
    if (r.valid) expect(r.e164.startsWith('+54')).toBe(true);
  });

  it('valida un AR en E.164', () => {
    const r = validateAndNormalizePhone('+5491150000001', 'AR');
    expect(r.valid).toBe(true);
    if (r.valid) expect(r.e164).toBe('+5491150000001');
  });

  it('rechaza vacio', () => {
    expect(validateAndNormalizePhone('', 'AR').valid).toBe(false);
  });

  it('rechaza basura', () => {
    expect(validateAndNormalizePhone('abc-xyz', 'AR').valid).toBe(false);
  });

  it('rechaza demasiado corto', () => {
    expect(validateAndNormalizePhone('123', 'AR').valid).toBe(false);
  });
});
