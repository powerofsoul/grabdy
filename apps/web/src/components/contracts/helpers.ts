export function formatDetailDate(dateStr: string | null | undefined): string | null {
  if (!dateStr) return null;
  const date = new Date(dateStr);
  return date.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
}

export function formatRenewalType(type: string | null | undefined): string | null {
  if (!type || type === 'none') return 'None';
  if (type === 'auto') return 'Auto-renewal';
  if (type === 'manual') return 'Manual renewal';
  return type;
}

export function formatLiabilityCapType(type: string | null | undefined): string | null {
  if (!type) return null;
  if (type === 'fixed') return 'Fixed amount';
  if (type === 'percentage') return 'Percentage-based';
  if (type === 'unlimited') return 'Unlimited';
  if (type === 'none') return 'None';
  return type;
}

export function formatIndemnificationType(type: string | null | undefined): string | null {
  if (!type) return null;
  if (type === 'mutual') return 'Mutual';
  if (type === 'one_way_us') return 'One-way (we indemnify)';
  if (type === 'one_way_them') return 'One-way (they indemnify)';
  if (type === 'none') return 'None';
  return type;
}

export function formatIpOwnership(type: string | null | undefined): string | null {
  if (!type) return null;
  if (type === 'us') return 'We retain';
  if (type === 'them') return 'They retain';
  if (type === 'joint') return 'Joint ownership';
  if (type === 'not_applicable') return 'N/A';
  return type;
}

export function formatDisputeMechanism(type: string | null | undefined): string | null {
  if (!type) return null;
  if (type === 'arbitration') return 'Arbitration';
  if (type === 'litigation') return 'Litigation';
  if (type === 'mediation') return 'Mediation';
  return type;
}

export function formatCurrency(
  value: number | null | undefined,
  currency: string | null | undefined
): string | null {
  if (value == null) return null;
  const symbol = currency?.toUpperCase() === 'EUR' ? '\u20AC' : '$';
  return `${symbol}${value.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}${currency ? ` ${currency.toUpperCase()}` : ''}`;
}

export function formatBool(val: boolean | null | undefined): string | null {
  if (val === true) return 'Yes';
  if (val === false) return 'No';
  return null;
}

export function formatMonths(months: number | null | undefined): string | null {
  if (months == null) return null;
  if (months === 1) return '1 month';
  if (months < 12) return `${months} months`;
  const years = Math.floor(months / 12);
  const remaining = months % 12;
  if (remaining === 0) return years === 1 ? '1 year' : `${years} years`;
  return `${years}y ${remaining}m`;
}
