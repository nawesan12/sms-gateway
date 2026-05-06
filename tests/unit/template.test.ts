import { describe, it, expect } from 'vitest';
import { listTemplateVariables, renderTemplate } from '@/lib/template.js';

describe('renderTemplate', () => {
  it('reemplaza variables', () => {
    expect(renderTemplate('Hola {{name}}', { name: 'Pepe' })).toBe('Hola Pepe');
  });

  it('soporta espacios alrededor', () => {
    expect(renderTemplate('Hola {{ name }}', { name: 'Pepe' })).toBe('Hola Pepe');
  });

  it('vars ausentes → string vacio', () => {
    expect(renderTemplate('Hola {{name}}', {})).toBe('Hola ');
  });

  it('null/undefined → string vacio', () => {
    expect(renderTemplate('Hola {{n}}', { n: null })).toBe('Hola ');
    expect(renderTemplate('Hola {{n}}', { n: undefined })).toBe('Hola ');
  });

  it('coerce numbers a string', () => {
    expect(renderTemplate('Code {{code}}', { code: 1234 })).toBe('Code 1234');
  });

  it('multiples variables', () => {
    expect(renderTemplate('{{a}}-{{b}}', { a: 'x', b: 'y' })).toBe('x-y');
  });
});

describe('listTemplateVariables', () => {
  it('lista variables únicas', () => {
    expect(listTemplateVariables('Hola {{name}}, tel {{phone}} y {{name}}')).toEqual([
      'name',
      'phone',
    ]);
  });
});
