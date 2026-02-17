import freeEmailDomains from 'free-email-domains';
import mailchecker from 'mailchecker';
import { z } from 'zod';

const freeEmailSet = new Set<string>(freeEmailDomains);

export function isWorkEmail(email: string): boolean {
  const domain = email.split('@')[1]?.toLowerCase();
  if (!domain) return false;
  if (!mailchecker.isValid(email)) return false;
  if (freeEmailSet.has(domain)) return false;
  return true;
}

export const workEmailSchema = z
  .string()
  .email()
  .refine(isWorkEmail, { message: 'Please use your work email' });
