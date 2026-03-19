/**
 * SystemNoticeBadge — Compact badge indicator for announcement counts.
 * Displays a pulsing dot + count for active announcements.
 * Uses semantic design tokens.
 *
 * Usage:
 *   <SystemNoticeBadge />                    → all announcements
 *   <SystemNoticeBadge severity="critical" /> → only critical
 *   <SystemNoticeBadge variant="dot" />       → dot-only (no count)
 */

import { useMemo } from 'react';
import { useAnnouncements } from '@/hooks/core/use-announcements';
import { cn } from '@/lib/utils';
import type { Severity } from '@/domains/announcements/announcement-hub';

interface SystemNoticeBadgeProps {
  /** Filter by severity */
  severity?: Severity;
  /** "full" shows count, "dot" shows only a pulsing dot */
  variant?: 'full' | 'dot';
  /** Additional classes */
  className?: string;
}

const SEVERITY_COLORS: Record<Severity, string> = {
  info: 'bg-info text-info-foreground',
  warning: 'bg-warning text-warning-foreground',
  critical: 'bg-destructive text-destructive-foreground',
};

export function SystemNoticeBadge({
  severity,
  variant = 'full',
  className,
}: SystemNoticeBadgeProps) {
  const { announcements } = useAnnouncements();

  const filtered = useMemo(() => {
    if (!severity) return announcements;
    return announcements.filter(a => a.severity === severity);
  }, [announcements, severity]);

  if (filtered.length === 0) return null;

  // Resolve color: use the highest severity present
  const highestSeverity = severity ?? (
    filtered.some(a => a.severity === 'critical') ? 'critical' :
    filtered.some(a => a.severity === 'warning') ? 'warning' : 'info'
  );
  const colorClass = SEVERITY_COLORS[highestSeverity];

  if (variant === 'dot') {
    return (
      <span className={cn(
        'relative flex h-2.5 w-2.5',
        className,
      )}>
        <span className={cn(
          'absolute inline-flex h-full w-full rounded-full opacity-75 animate-ping',
          colorClass,
        )} />
        <span className={cn(
          'relative inline-flex h-2.5 w-2.5 rounded-full',
          colorClass,
        )} />
      </span>
    );
  }

  return (
    <span className={cn(
      'inline-flex items-center justify-center h-5 min-w-[20px] px-1.5 rounded-full text-[10px] font-bold',
      colorClass,
      highestSeverity === 'critical' && 'animate-pulse',
      className,
    )}>
      {filtered.length}
    </span>
  );
}
