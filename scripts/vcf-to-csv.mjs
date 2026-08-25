#!/usr/bin/env node
/**
 * Convierte un export de vCard (.vcf) al CSV que espera POST /v1/contacts/import.
 *
 * Salida: header `phone,name`.
 *
 * NO normaliza ni valida los números a propósito: de eso se encarga el backend con
 * validateAndNormalizePhone() (src/lib/phone.ts), que inserta el 9 móvil argentino y
 * rechaza lo no-AR con razón `non_ar`. Duplicar esa lógica acá sólo abre la puerta a
 * que las dos versiones se desincronicen.
 *
 * Uso:
 *   node scripts/vcf-to-csv.mjs contactos.vcf > contactos.csv
 *   node scripts/vcf-to-csv.mjs contactos.vcf salida.csv
 */
import { readFileSync, writeFileSync } from 'node:fs';

const [, , inputPath, outputPath] = process.argv;

if (!inputPath) {
  console.error('uso: node scripts/vcf-to-csv.mjs <archivo.vcf> [salida.csv]');
  process.exit(1);
}

/**
 * Deshace el folding de líneas. Dos mecanismos conviven en estos exports:
 * - QUOTED-PRINTABLE soft line break: la línea termina en `=` y sigue en la próxima.
 * - Folding vCard clásico: la línea siguiente arranca con espacio o tab.
 */
function unfold(raw) {
  const lines = raw.split(/\r\n|\r|\n/);
  const out = [];
  for (const line of lines) {
    const prev = out[out.length - 1];
    if (prev !== undefined && prev.endsWith('=')) {
      out[out.length - 1] = prev.slice(0, -1) + line;
      continue;
    }
    if (prev !== undefined && /^[ \t]/.test(line)) {
      out[out.length - 1] = prev + line.slice(1);
      continue;
    }
    out.push(line);
  }
  return out;
}

/** Decodifica quoted-printable a bytes y los interpreta como UTF-8. */
function decodeQuotedPrintable(value) {
  const bytes = [];
  for (let i = 0; i < value.length; i++) {
    if (value[i] === '=' && i + 2 < value.length) {
      const hex = value.slice(i + 1, i + 3);
      if (/^[0-9A-Fa-f]{2}$/.test(hex)) {
        bytes.push(parseInt(hex, 16));
        i += 2;
        continue;
      }
    }
    bytes.push(value.charCodeAt(i) & 0xff);
  }
  return Buffer.from(bytes).toString('utf8');
}

/** Parte `FN;CHARSET=UTF-8;ENCODING=QUOTED-PRINTABLE:valor` en sus tres partes. */
function parseLine(line) {
  const colon = line.indexOf(':');
  if (colon === -1) return null;
  const head = line.slice(0, colon);
  let value = line.slice(colon + 1);
  const [name, ...params] = head.split(';');
  const upperParams = params.map((p) => p.toUpperCase());
  if (upperParams.some((p) => p === 'ENCODING=QUOTED-PRINTABLE')) {
    value = decodeQuotedPrintable(value);
  }
  return { name: name.toUpperCase(), params: upperParams, value };
}

function csvEscape(field) {
  return /[",\r\n]/.test(field) ? '"' + field.replace(/"/g, '""') + '"' : field;
}

const lines = unfold(readFileSync(inputPath, 'utf8'));

const rows = [];
const seen = new Set();
const stats = { cards: 0, tels: 0, skippedAnterior: 0, duplicates: 0, noPhone: 0 };

let card = null;

for (const line of lines) {
  const trimmed = line.trim();

  if (trimmed.toUpperCase() === 'BEGIN:VCARD') {
    card = { fn: '', org: '', n: '', tels: [] };
    continue;
  }

  if (trimmed.toUpperCase() === 'END:VCARD') {
    if (card === null) continue;
    stats.cards++;

    // El backend sólo usa `phone`; `name` es cosmético para las variables {{name}}.
    const name = (card.fn || card.n || card.org || '').trim();

    if (card.tels.length === 0) stats.noPhone++;

    for (const tel of card.tels) {
      const key = tel.replace(/[^\d+]/g, '');
      if (key.length === 0) continue;
      if (seen.has(key)) {
        stats.duplicates++;
        continue;
      }
      seen.add(key);
      rows.push([tel, name]);
    }
    card = null;
    continue;
  }

  if (card === null) continue;

  const parsed = parseLine(trimmed);
  if (parsed === null) continue;

  switch (parsed.name) {
    case 'FN':
      if (!card.fn) card.fn = parsed.value;
      break;
    case 'ORG':
      if (!card.org) card.org = parsed.value;
      break;
    case 'N': {
      // N = Family;Given;Middle;Prefix;Suffix — reconstruido como "Given Family".
      if (card.n) break;
      const [family = '', given = ''] = parsed.value.split(';');
      card.n = [given, family].filter(Boolean).join(' ').trim();
      break;
    }
    case 'TEL': {
      stats.tels++;
      // X-Anterior marca números viejos que el export arrastra: no son contactables.
      if (parsed.params.some((p) => p.startsWith('X-ANTERIOR'))) {
        stats.skippedAnterior++;
        break;
      }
      const value = parsed.value.trim();
      if (value) card.tels.push(value);
      break;
    }
    default:
      break;
  }
}

const csv = ['phone,name', ...rows.map(([p, n]) => `${csvEscape(p)},${csvEscape(n)}`)].join('\n') + '\n';

if (outputPath) {
  writeFileSync(outputPath, csv, 'utf8');
} else {
  process.stdout.write(csv);
}

console.error(
  [
    `tarjetas:        ${stats.cards}`,
    `TEL encontrados: ${stats.tels}`,
    `X-Anterior:      ${stats.skippedAnterior} (descartados)`,
    `duplicados:      ${stats.duplicates} (descartados)`,
    `sin teléfono:    ${stats.noPhone}`,
    `filas escritas:  ${rows.length}`,
    `sin nombre:      ${rows.filter(([, n]) => !n).length}`,
  ].join('\n'),
);
