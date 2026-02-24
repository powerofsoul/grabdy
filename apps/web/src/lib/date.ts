import { formatDistanceToNow } from 'date-fns';

export function relativeDate(iso: string): string {
  return formatDistanceToNow(new Date(iso), { addSuffix: true });
}
