/**
 * Renderiza plantillas estilo `Hola {{name}}, tu cita {{date}}`.
 * - Variables ausentes en `vars` se reemplazan por '' (no rompe).
 * - Soporta letras, números, _, - en nombres de variable.
 * - No interpreta nada más (no condicionales, no escapes).
 */
const TOKEN = /\{\{\s*([a-zA-Z0-9_\-]+)\s*\}\}/g;

export function renderTemplate(template: string, vars: Record<string, string | number | null | undefined>): string {
  return template.replace(TOKEN, (_match, name: string) => {
    const v = vars[name];
    if (v === undefined || v === null) return '';
    return String(v);
  });
}

export function listTemplateVariables(template: string): string[] {
  const found = new Set<string>();
  for (const m of template.matchAll(TOKEN)) {
    found.add(m[1]!);
  }
  return [...found];
}
