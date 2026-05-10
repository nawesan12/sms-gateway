import { parsePhoneNumberFromString } from 'libphonenumber-js';
export function validateAndNormalizePhone(input, defaultRegion) {
    if (typeof input !== 'string' || input.trim().length === 0) {
        return { valid: false, reason: 'empty' };
    }
    const trimmed = input.trim();
    try {
        const parsed = parsePhoneNumberFromString(trimmed, defaultRegion);
        if (!parsed)
            return { valid: false, reason: 'unparseable' };
        if (!parsed.isValid())
            return { valid: false, reason: 'invalid' };
        return { valid: true, e164: parsed.number, country: parsed.country ?? defaultRegion };
    }
    catch {
        return { valid: false, reason: 'parse_error' };
    }
}
