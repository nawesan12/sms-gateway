import { randomInt } from 'node:crypto';

export function generateNumericCode(length: number): string {
  if (length < 4 || length > 10) {
    throw new Error(`OTP length out of range: ${length}`);
  }
  const min = 10 ** (length - 1);
  const max = 10 ** length;
  return String(randomInt(min, max));
}
