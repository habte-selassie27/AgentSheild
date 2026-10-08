import clsx from 'clsx';

type AnyStatus = string;

const P = {
  ok: { fg: 'text-ok', bg: 'bg-ok/12', bd: 'border-ok/40', dot: 'bg-ok' },
  warn: { fg: 'text-warn', bg: 'bg-warn/12', bd: 'border-warn/40', dot: 'bg-warn' },
  crit: { fg: 'text-crit', bg: 'bg-crit/12', bd: 'border-crit/40', dot: 'bg-crit' },
  high: { fg: 'text-high', bg: 'bg-high/12', bd: 'border-high/40', dot: 'bg-high' },
  info: { fg: 'text-info', bg: 'bg-info/12', bd: 'border-info/40', dot: 'bg-info' },
  accent: { fg: 'text-accent', bg: 'bg-accent/12', bd: 'border-accent/40', dot: 'bg-accent' },
  mute: { fg: 'text-mute', bg: 'bg-mute/12', bd: 'border-mute/40', dot: 'bg-mute' },
  sub: { fg: 'text-sub', bg: 'bg-sub/10', bd: 'border-sub/30', dot: 'bg-sub' },
};

const MAP: Record<string, (typeof P)[keyof typeof P]> = {
  // claim / decision status
  pending: P.info,
  valid: P.ok,
  paid: P.accent,
  invalid: P.mute,
  duplicate: P.sub,
  disputed: P.high,
  // agent lifecycle
  active: P.ok,
  paused: P.warn,
  delisted: P.mute,
  // claim severities (contract: info < low < medium < high < critical)
  info: P.sub,
  low: P.info,
  medium: P.warn,
  high: P.high,
  critical: P.crit,
  // activity severity (displayed uppercase)
  CRITICAL: P.crit,
  HIGH: P.high,
  MEDIUM: P.warn,
  LOW: P.info,
  INFO: P.sub,
  // posture / system
  NOMINAL: P.ok,
  SETTLED: P.accent,
  DISPUTED: P.high,
  OFFLINE: P.mute,
  OPERATIONAL: P.ok,
  AUDITS_PENDING: P.info,
  DISPUTE_OPEN: P.high,
  // booleans
  upheld: P.ok,
  overturned: P.mute,
  unpaid: P.warn,
};

const fallback = P.sub;

export function StatusBadge({ status, size = 'md', pulse }: { status: AnyStatus; size?: 'sm' | 'md'; pulse?: boolean }) {
  const m = MAP[status] ?? fallback;
  return (
    <span
      className={clsx(
        'chip whitespace-nowrap uppercase',
        m.fg, m.bg, m.bd,
        size === 'sm' && 'px-1.5 py-0 text-[9px]'
      )}
    >
      <span className={clsx('h-1.5 w-1.5 rounded-full', m.dot, pulse && status === 'critical' && 'dot-crit')} />
      {String(status).replace(/_/g, ' ')}
    </span>
  );
}
