import { describe, it, expect } from 'vitest';
import { validateAndNormalizePhone } from '@/lib/phone.js';

describe('validateAndNormalizePhone — AR', () => {
  it.each([
    ['1150000001', '+5491150000001'],
    ['01150000001', '+5491150000001'],
    ['11 5000-0001', '+5491150000001'],
    ['(11) 5000-0001', '+5491150000001'],
    ['+5491150000001', '+5491150000001'],
    ['5491150000001', '+5491150000001'],
    ['+541150000001', '+5491150000001'],
    ['541150000001', '+5491150000001'],
    ['9 11 5000-0001', '+5491150000001'],
    ['+54 9 11 5000 0001', '+5491150000001'],
  ])('normaliza %s -> %s', (input, expected) => {
    const r = validateAndNormalizePhone(input, 'AR');
    expect(r.valid).toBe(true);
    if (r.valid) expect(r.e164).toBe(expected);
  });

  it.each([
    ['+15551234567', 'non_ar'],
    ['+5511999999999', 'non_ar'],
    ['', 'empty'],
    ['abc-xyz', 'empty'],
    ['123', 'length'],
  ])('rechaza %s con razon %s', (input, reason) => {
    const r = validateAndNormalizePhone(input, 'AR');
    expect(r.valid).toBe(false);
    if (!r.valid) expect(r.reason).toBe(reason);
  });
});
