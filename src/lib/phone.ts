import { parsePhoneNumberFromString, type CountryCode } from 'libphonenumber-js';

export type PhoneValidation =
  | { valid: true; e164: string; country: string }
  | { valid: false; reason: string };

/**
 * Valida y normaliza un número de teléfono.
 *
 * Para Argentina (defaultRegion === 'AR') aplica un algoritmo determinístico
 * que SIEMPRE produce el formato móvil +549XXXXXXXXXX cuando es posible,
 * insertando el "9" móvil si falta. Los números no argentinos se rechazan
 * con razón `non_ar` (el sistema asume que todos los SMS van a móviles AR).
 *
 * Nunca lanza excepciones: ante cualquier input inválido devuelve { valid: false }.
 */
export function validateAndNormalizePhone(input: string, defaultRegion: string): PhoneValidation {
  if (typeof input !== 'string' || input.trim().length === 0) {
    return { valid: false, reason: 'empty' };
  }

  const cleaned = input.replace(/[^\d+]/g, '');
  if (cleaned.length === 0) return { valid: false, reason: 'empty' };

  if (defaultRegion === 'AR') {
    return normalizeArgentineMobile(cleaned);
  }

  try {
    const parsed = parsePhoneNumberFromString(cleaned, defaultRegion as CountryCode);
    if (!parsed) return { valid: false, reason: 'unparseable' };
    if (!parsed.isValid()) return { valid: false, reason: 'invalid' };
    return { valid: true, e164: parsed.number, country: parsed.country ?? defaultRegion };
  } catch {
    return { valid: false, reason: 'parse_error' };
  }
}

function normalizeArgentineMobile(cleaned: string): PhoneValidation {
  if (cleaned.startsWith('+') && !cleaned.startsWith('+54')) {
    return { valid: false, reason: 'non_ar' };
  }

  let digits = cleaned.startsWith('+') ? cleaned.slice(1) : cleaned;

  if (digits.startsWith('54')) digits = digits.slice(2);
  if (digits.startsWith('0')) digits = digits.slice(1);
  if (digits.startsWith('9')) digits = digits.slice(1);

  if (digits.length < 10 || digits.length > 11) {
    return { valid: false, reason: 'length' };
  }

  const e164 = '+549' + digits;

  try {
    const parsed = parsePhoneNumberFromString(e164, 'AR');
    if (!parsed || !parsed.isValid()) {
      return { valid: false, reason: 'invalid' };
    }
    return { valid: true, e164: parsed.number, country: 'AR' };
  } catch {
    return { valid: false, reason: 'parse_error' };
  }
}
