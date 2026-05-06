import { describe, it, expect } from 'vitest';
import { maskApiKey, maskPhone } from '@/lib/mask.js';

describe('maskPhone', () => {
  it('mantiene prefijo y ultimos 2 digitos', () => {
    expect(maskPhone('+5491150000001')).toBe('+5491*******01');
  });
  it('maneja phone corto', () => {
    expect(maskPhone('123')).toBe('***');
  });
});

describe('maskApiKey', () => {
  it('oculta el medio', () => {
    expect(maskApiKey('abcdefghijkl')).toBe('abcd…ijkl');
  });
  it('oculta corto', () => {
    expect(maskApiKey('abcd')).toBe('****');
  });
});
