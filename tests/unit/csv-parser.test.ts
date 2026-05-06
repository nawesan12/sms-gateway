import { describe, it, expect } from 'vitest';
import { parseCsv } from '@/lib/csv-parser.js';

describe('parseCsv', () => {
  it('parsea CSV simple con header', () => {
    const rows = parseCsv('phone,name\n+5491,Pepe\n+5492,Maria');
    expect(rows).toEqual([
      { phone: '+5491', name: 'Pepe' },
      { phone: '+5492', name: 'Maria' },
    ]);
  });

  it('soporta CRLF', () => {
    const rows = parseCsv('phone,name\r\n+5491,Pepe\r\n');
    expect(rows).toEqual([{ phone: '+5491', name: 'Pepe' }]);
  });

  it('soporta comillas dobles con comas', () => {
    const rows = parseCsv('phone,name\n+5491,"Pepe, Jr."');
    expect(rows[0]!.name).toBe('Pepe, Jr.');
  });

  it('soporta comillas escapadas con ""', () => {
    const rows = parseCsv('phone,name\n+1,"He said ""hi"""');
    expect(rows[0]!.name).toBe('He said "hi"');
  });

  it('ignora lineas vacias', () => {
    const rows = parseCsv('phone\n+1\n\n+2\n');
    expect(rows.map((r) => r.phone)).toEqual(['+1', '+2']);
  });

  it('rechaza header vacio', () => {
    expect(() => parseCsv(',name\n+1,Pepe')).toThrow();
  });

  it('respeta maxRows', () => {
    const csv = 'phone\n' + Array.from({ length: 5 }, (_, i) => `+54${i}`).join('\n');
    expect(() => parseCsv(csv, { maxRows: 3 })).toThrow();
  });
});
