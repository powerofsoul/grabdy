import { addDays, endOfYear, format } from 'date-fns';

type ExpiringRange = '' | '30' | '60' | '90' | 'year';

export function formatContractDate(dateStr: string | null | undefined): string {
  if (!dateStr) return '-';
  const date = new Date(dateStr);
  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

export function computeExpiringDates(range: ExpiringRange): {
  expiringAfter?: string;
  expiringBefore?: string;
} {
  if (!range) return {};
  const today = format(new Date(), 'yyyy-MM-dd');
  if (range === '30')
    return { expiringAfter: today, expiringBefore: format(addDays(new Date(), 30), 'yyyy-MM-dd') };
  if (range === '60')
    return { expiringAfter: today, expiringBefore: format(addDays(new Date(), 60), 'yyyy-MM-dd') };
  if (range === '90')
    return { expiringAfter: today, expiringBefore: format(addDays(new Date(), 90), 'yyyy-MM-dd') };
  if (range === 'year')
    return { expiringAfter: today, expiringBefore: format(endOfYear(new Date()), 'yyyy-MM-dd') };
  return {};
}
