import {
  type Contract,
  CONTRACT_TYPE_LABELS,
  type ContractType,
  type RenewalType,
} from '@grabdy/contracts';

type DeadlineRow = Contract & { daysLeft: number | null };

interface TypeCount {
  type: ContractType;
  label: string;
  count: number;
}

interface RenewalCount {
  type: RenewalType;
  label: string;
  count: number;
}

interface CounterpartyRow {
  name: string;
  count: number;
  value: number;
}

export interface DashboardStats {
  portfolioValue: number;
  expiredCount: number;
  urgentCount: number;
  typeBreakdown: TypeCount[];
  renewalBreakdown: RenewalCount[];
  highValueExpiring: DeadlineRow[];
  topCounterparties: CounterpartyRow[];
}

const RENEWAL_LABELS: Record<RenewalType, string> = {
  auto: 'Auto-renewal',
  manual: 'Manual renewal',
  none: 'No renewal',
};

export function getGreeting(): string {
  const hour = new Date().getHours();
  if (hour < 12) return 'Good morning';
  if (hour < 18) return 'Good afternoon';
  return 'Good evening';
}

export function computeDashboardStats(deadlines: DeadlineRow[]): DashboardStats {
  let portfolioValue = 0;
  let expiredCount = 0;
  let urgentCount = 0;
  const typeCounts = new Map<ContractType, number>();
  const renewalCounts = new Map<RenewalType, number>();
  const counterpartyMap = new Map<string, { count: number; value: number }>();

  for (const d of deadlines) {
    if (d.totalValue !== null && d.totalValue !== undefined) {
      portfolioValue += d.totalValue;
    }
    if (d.daysLeft !== null && d.daysLeft < 0) {
      expiredCount++;
    }
    if (d.daysLeft !== null && d.daysLeft >= 0 && d.daysLeft <= 30) {
      urgentCount++;
    }
    if (d.contractType) {
      typeCounts.set(d.contractType, (typeCounts.get(d.contractType) ?? 0) + 1);
    }
    if (d.renewalType) {
      renewalCounts.set(d.renewalType, (renewalCounts.get(d.renewalType) ?? 0) + 1);
    }
    if (d.counterparty) {
      const existing = counterpartyMap.get(d.counterparty) ?? { count: 0, value: 0 };
      existing.count += 1;
      existing.value += d.totalValue ?? 0;
      counterpartyMap.set(d.counterparty, existing);
    }
  }

  const typeBreakdown: TypeCount[] = [...typeCounts.entries()]
    .map(([type, count]) => ({
      type,
      label: CONTRACT_TYPE_LABELS[type],
      count,
    }))
    .sort((a, b) => b.count - a.count);

  const renewalBreakdown: RenewalCount[] = [...renewalCounts.entries()]
    .map(([type, count]) => ({
      type,
      label: RENEWAL_LABELS[type],
      count,
    }))
    .sort((a, b) => b.count - a.count);

  const highValueExpiring = deadlines
    .filter(
      (d) =>
        d.daysLeft !== null &&
        d.daysLeft >= 0 &&
        d.daysLeft <= 90 &&
        d.totalValue !== null &&
        d.totalValue !== undefined &&
        d.totalValue > 0
    )
    .sort((a, b) => (b.totalValue ?? 0) - (a.totalValue ?? 0))
    .slice(0, 5);

  const topCounterparties: CounterpartyRow[] = [...counterpartyMap.entries()]
    .map(([name, data]) => ({ name, count: data.count, value: data.value }))
    .sort((a, b) => b.value - a.value || b.count - a.count)
    .slice(0, 5);

  return {
    portfolioValue,
    expiredCount,
    urgentCount,
    typeBreakdown,
    renewalBreakdown,
    highValueExpiring,
    topCounterparties,
  };
}

export function computeNoticeDaysLeft(noticeByDate: string): number {
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  const notice = new Date(noticeByDate);
  notice.setHours(0, 0, 0, 0);
  return Math.ceil((notice.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
}

export function formatDaysLeft(days: number): string {
  if (days > 365) return `${Math.floor(days / 365)}y`;
  return `${days}d`;
}

export function formatDate(dateStr: string | null | undefined): string {
  if (!dateStr) return '-';
  const date = new Date(dateStr);
  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

export function getNoticeBadgeColor(
  days: number,
  palette: { error: { main: string }; warning: { main: string }; text: { secondary: string } }
): string {
  if (days <= 14) return palette.error.main;
  if (days <= 30) return palette.warning.main;
  return palette.text.secondary;
}

export function getDaysLeftColor(
  daysLeft: number,
  palette: {
    error: { main: string };
    warning: { main: string };
    success: { main: string };
    text: { secondary: string };
  }
): string {
  if (daysLeft <= 30) return palette.error.main;
  if (daysLeft <= 60) return palette.warning.main;
  if (daysLeft <= 90) return palette.success.main;
  return palette.text.secondary;
}

export function formatCompactCurrency(n: number): string {
  if (n >= 1_000_000) {
    const val = n / 1_000_000;
    return `$${val % 1 === 0 ? val.toFixed(0) : val.toFixed(1)}M`;
  }
  if (n >= 1_000) {
    const val = Math.round(n / 1_000);
    return `$${val}K`;
  }
  return `$${n.toLocaleString()}`;
}
