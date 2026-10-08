import { Link } from 'react-router-dom';
import clsx from 'clsx';
import { ArrowUpRight, Radar, ScanLine } from 'lucide-react';
import { useShield } from '../lib/shield';
import type { ActivityEvent, Claim } from '../lib/types';
import { formatGen } from '../lib/types';
import { StatusBadge } from './StatusBadge';

export function Kpi({ label, value, sub, accent }: { label: string; value: React.ReactNode; sub?: string; accent?: string }) {
  return (
    <div className="panel px-3.5 py-3">
      <p className="meta">{label}</p>
      <p className={clsx('text-[20px] font-extrabold font-mono mt-1.5 tracking-tight', accent)}>{value}</p>
      {sub && <p className="text-[11px] text-mute mt-0.5 truncate">{sub}</p>}
    </div>
  );
}

/* ---------- Registry health gauge (bond coverage) ---------- */

const POSTURE_TONE: Record<string, { text: string; ring: string }> = {
  NOMINAL: { text: 'text-ok', ring: 'stroke-ok' },
  SETTLED: { text: 'text-accent', ring: 'stroke-accent' },
  DISPUTED: { text: 'text-high', ring: 'stroke-high' },
};

export function BondGauge() {
  const s = useShield();
  const tone = POSTURE_TONE[s.posture] ?? POSTURE_TONE.NOMINAL;
  const totalBond = s.totalBond;
  const totalExposure = s.agents.reduce((n, a) => n + a.liabilities.critical, 0n);
  const pctRaw = totalExposure > 0n ? Number((totalBond * 100n) / totalExposure) : 0;
  const R = 52;
  const C = 2 * Math.PI * R;

  return (
    <div className="panel p-4 flex flex-col items-center text-center">
      <p className="meta self-start">Bond coverage</p>
      <div className="relative my-2">
        <svg width="140" height="140" viewBox="0 0 140 140" className="-rotate-90">
          <circle cx="70" cy="70" r={R} fill="none" stroke="#232935" strokeWidth="10" />
          <circle
            cx="70" cy="70" r={R} fill="none" strokeWidth="10" strokeLinecap="round"
            strokeDasharray={`${Math.min(pctRaw, 100) * C / 100} ${C}`}
            className={clsx(tone.ring, 'transition-all duration-700')}
          />
        </svg>
        <div className="absolute inset-0 grid place-items-center px-6">
          <div className="leading-tight">
            <p className={clsx('text-[19px] font-extrabold tracking-tight', tone.text)}>{pctRaw > 999 ? '>999' : pctRaw}%</p>
            <p className="text-[10px] text-mute font-mono whitespace-nowrap">of critical tiers</p>
          </div>
        </div>
      </div>
      <p className="text-[12px] text-sub leading-relaxed">{s.headlineDetail}</p>
      <div className="mt-3 w-full flex items-center justify-between text-[11px] text-mute border-t border-edge pt-3">
        <span>Bonded</span>
        <span className="font-mono font-bold text-sub">{formatGen(totalBond)} GEN</span>
      </div>
    </div>
  );
}

/* ---------- Pipeline: FILE → AUDIT → CONSENSUS → SETTLE → DISPUTE ---------- */

const PIPELINE = [
  { key: 'FILE', note: 'file_claim · deterministic' },
  { key: 'AUDIT', note: 'audit_claim · LLM prompt' },
  { key: 'CONSENSUS', note: 'prompt_comparative' },
  { key: 'SETTLE', note: 'tier payout · auto-pay' },
  { key: 'DISPUTE', note: 'owner arbitration' },
];

export function Pipeline({ compact }: { compact?: boolean }) {
  const s = useShield();
  const activeIdx =
    s.auditing ? Math.min(s.auditStep, 4)
    : s.posture === 'DISPUTED' ? 4
    : s.posture === 'SETTLED' ? 4
    : 1;

  return (
    <div className="panel p-4">
      <div className="flex items-center justify-between mb-3">
        <p className="meta">Claim lifecycle</p>
        <p className="text-[11px] font-mono text-mute">stage {activeIdx + 1}/5</p>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-5 gap-2">
        {PIPELINE.map((p, i) => {
          const done = i < activeIdx;
          const active = i === activeIdx;
          return (
            <div
              key={p.key}
              className={clsx(
                'relative rounded-lg border px-3 py-2.5 transition-colors',
                active && 'border-accent/60 bg-accent/10',
                done && 'border-ok/40 bg-ok/5',
                !active && !done && 'border-edge bg-elevated'
              )}
            >
              <div className="flex items-center gap-1.5">
                <span className={clsx('h-1.5 w-1.5 rounded-full', active ? 'bg-accent dot-safe' : done ? 'bg-ok' : 'bg-mute')} />
                <p className={clsx('text-[11px] font-extrabold tracking-[0.12em]', active ? 'text-accent' : done ? 'text-ok' : 'text-sub')}>{p.key}</p>
              </div>
              {!compact && <p className="text-[10.5px] text-mute mt-1 leading-snug">{p.note}</p>}
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* ---------- Claims by status (real distribution) ---------- */

const STATUS_ORDER = ['pending', 'valid', 'paid', 'invalid', 'duplicate', 'disputed'] as const;
const STATUS_TONE: Record<string, string> = {
  pending: 'bg-info', valid: 'bg-ok', paid: 'bg-accent', invalid: 'bg-mute', duplicate: 'bg-sub', disputed: 'bg-high',
};

export function ClaimsBreakdown() {
  const s = useShield();
  const counts = STATUS_ORDER.map((st) => ({ st, n: s.claims.filter((c) => c.status === st).length }));
  const total = s.claims.length;

  return (
    <div className="panel p-4">
      <div className="flex items-start justify-between mb-2">
        <div>
          <p className="meta">Claims by status</p>
          <p className="text-[24px] font-extrabold font-mono mt-1">{total}</p>
        </div>
        <p className="text-[11px] text-mute text-right max-w-[160px] leading-snug">
          live counts from <span className="font-mono">get_claim</span>
        </p>
      </div>
      <div className="flex h-2.5 rounded-full overflow-hidden bg-elevated mt-2">
        {counts.filter((c) => c.n > 0).map((c) => (
          <div key={c.st} style={{ width: `${(c.n / Math.max(total, 1)) * 100}%` }} className={STATUS_TONE[c.st]} title={`${c.st}: ${c.n}`} />
        ))}
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-x-4 gap-y-1.5 mt-3 text-[11.5px]">
        {counts.map((c) => (
          <span key={c.st} className="flex items-center gap-1.5">
            <span className={clsx('h-2 w-2 rounded-full', STATUS_TONE[c.st])} />
            <span className="capitalize text-sub">{c.st}</span>
            <span className="ml-auto font-mono text-mute">{c.n}</span>
          </span>
        ))}
      </div>
    </div>
  );
}

/* ---------- Activity feed (derived from live claims/disputes) ---------- */

const ACT_SEV_DOT: Record<ActivityEvent['severity'], string> = {
  CRITICAL: 'bg-crit', HIGH: 'bg-high', MEDIUM: 'bg-warn', LOW: 'bg-info', INFO: 'bg-mute',
};

export function ActivityFeed({ compact }: { compact?: boolean }) {
  const s = useShield();
  const items = compact ? s.activity.slice(0, 7) : s.activity;
  return (
    <div className="panel p-4">
      <div className="flex items-center justify-between mb-3">
        <p className="meta">Registry state</p>
        {!compact && <span className="text-[11px] font-mono text-mute">{s.activity.length} records</span>}
        {compact && <Link to="/activity" className="text-[11px] font-bold text-accent hover:underline">Full log →</Link>}
      </div>
      <ul className="space-y-2.5 max-h-[360px] overflow-y-auto pr-1">
        {items.map((e) => (
          <li key={e.id} className="flex gap-2.5 items-start">
            <span className={clsx('mt-1.5 h-1.5 w-1.5 rounded-full shrink-0', ACT_SEV_DOT[e.severity])} />
            <div className="min-w-0 flex-1">
              <p className="text-[12.5px] font-semibold leading-snug truncate">{e.title}</p>
              <p className="text-[11px] text-mute truncate">{e.detail}</p>
            </div>
            <span className="text-[9.5px] font-bold uppercase tracking-wider text-mute shrink-0 mt-0.5">{e.kind}</span>
          </li>
        ))}
        {!items.length && <li className="text-[12px] text-mute px-1 py-6 text-center">No claims on chain yet.</li>}
      </ul>
    </div>
  );
}

/* ---------- On-chain audit result (real fields only) ---------- */

const DECISION_TONE: Record<string, string> = { valid: 'bg-ok', invalid: 'bg-mute', duplicate: 'bg-info' };
const DECISION_TEXT: Record<string, string> = { valid: 'text-ok', invalid: 'text-mute', duplicate: 'text-info' };

export function AuditResult({ claim }: { claim: Claim }) {
  const decided = claim.status !== 'pending' && claim.severityAi !== null;
  return (
    <div className="panel p-4">
      <div className="flex items-center justify-between mb-3">
        <p className="meta">On-chain audit result</p>
        <StatusBadge status={claim.status} size="sm" />
      </div>

      {!decided ? (
        <p className="text-[13px] text-sub leading-relaxed">
          No audit round recorded for CL-{String(claim.id).padStart(3, '0')}. <code className="font-mono text-accent">audit_claim()</code>{' '}
          copies the agent and claim into validator memory, then validators re-run the same prompt under{' '}
          <code className="font-mono text-accent">prompt_comparative</code>.
        </p>
      ) : (
        <>
          <div className="flex flex-wrap gap-x-4 gap-y-1 text-[11px] mb-3">
            <span className="flex items-center gap-1.5">
              <span className={clsx('h-2 w-2 rounded-full', DECISION_TONE[claim.status] ?? 'bg-mute')} />
              <span className={clsx('font-bold uppercase', DECISION_TEXT[claim.status] ?? 'text-sub')}>{claim.status}</span>
            </span>
            <span className="text-mute">severity → <span className="font-mono text-sub">{claim.severityAi}</span></span>
            <span className="text-mute">payout <span className="font-mono text-sub">{formatGen(claim.payout)} GEN</span></span>
          </div>
          <ul className="space-y-2 text-[12px] border-t border-edge pt-2.5">
            <li className="flex justify-between gap-3">
              <span className="text-mute shrink-0">Claimed severity</span>
              <span className="font-mono text-sub">{claim.severityClaimed}</span>
            </li>
            <li className="flex justify-between gap-3">
              <span className="text-mute shrink-0">AI severity</span>
              <span className="font-mono text-sub">{claim.severityAi}</span>
            </li>
            {claim.duplicateOf > 0 && (
              <li className="flex justify-between gap-3">
                <span className="text-mute shrink-0">Duplicate of</span>
                <span className="font-mono text-sub">#{claim.duplicateOf}</span>
              </li>
            )}
            <li className="flex justify-between gap-3">
              <span className="text-mute shrink-0">Tier payout (bond)</span>
              <span className="font-mono text-sub">{formatGen(claim.payout)} GEN</span>
            </li>
          </ul>
          {claim.auditReason && (
            <p className="text-[11.5px] text-mute leading-snug mt-2.5 border-t border-edge pt-2.5">
              <span className="text-sub font-semibold">Reason (on-chain): </span>{claim.auditReason}
            </p>
          )}
        </>
      )}
    </div>
  );
}

/* ---------- Claim row card ---------- */

export function ClaimCard({ claim }: { claim: Claim }) {
  const sevTone =
    claim.severityClaimed === 'critical' ? 'border-l-crit'
    : claim.severityClaimed === 'high' ? 'border-l-high'
    : claim.severityClaimed === 'medium' ? 'border-l-warn'
    : 'border-l-info';
  return (
    <Link
      to={`/claims/${claim.id}`}
      className={clsx('panel block border-l-[3px] px-4 py-3.5 hover:border-accent/60 transition-colors group', sevTone)}
    >
      <div className="flex flex-wrap items-center gap-2">
        <span className="font-mono text-[11.5px] font-bold text-mute">CL-{String(claim.id).padStart(3, '0')}</span>
        <StatusBadge status={claim.severityClaimed} size="sm" />
        <StatusBadge status={claim.status} size="sm" />
        {claim.severityAi && claim.severityAi !== claim.severityClaimed && (
          <span className="text-[10px] text-mute font-mono">→ AI: {claim.severityAi}</span>
        )}
        <ArrowUpRight size={14} className="ml-auto text-mute group-hover:text-accent transition-colors" />
      </div>
      <p className="text-[14px] font-semibold mt-1.5 leading-snug">{claim.title}</p>
      <div className="flex flex-wrap gap-x-4 gap-y-1 mt-1.5 text-[11.5px] text-mute">
        <span className="font-mono">agent #{claim.agentId} {claim.agentName}</span>
        <span className="ml-auto font-mono">{formatGen(claim.payout)} GEN payout</span>
      </div>
    </Link>
  );
}

/* ---------- Largest bonds list ---------- */

export function TopBonds({ limit = 5 }: { limit?: number }) {
  const s = useShield();
  const top = [...s.agents].sort((a, b) => (a.bond < b.bond ? 1 : -1)).slice(0, limit);
  const maxBond = top[0]?.bond ?? 1n;
  return (
    <div className="panel p-4">
      <div className="flex items-center justify-between mb-3">
        <p className="meta">Largest bonds</p>
        <Link to="/agents" className="text-[11px] font-bold text-accent hover:underline">Registry →</Link>
      </div>
      <ul className="space-y-3">
        {top.map((a) => (
          <li key={a.id}>
            <div className="flex items-center gap-2 text-[12.5px]">
              <span className="font-semibold">{a.name}</span>
              <StatusBadge status={a.status} size="sm" />
              <span className="ml-auto font-mono font-bold text-[12px]">{formatGen(a.bond)} GEN</span>
            </div>
            <div className="mt-1.5 h-1.5 rounded-full bg-elevated overflow-hidden">
              <div
                className="h-full rounded-full bg-accent transition-all duration-500"
                style={{ width: `${maxBond > 0n ? Number((a.bond * 100n) / maxBond) : 0}%` }}
              />
            </div>
          </li>
        ))}
        {!top.length && <li className="text-[12px] text-mute text-center py-4">No agents registered on chain.</li>}
      </ul>
    </div>
  );
}

/* ---------- Registry scanner ---------- */

export function ScannerCard() {
  const s = useShield();
  const tone = s.posture === 'DISPUTED' ? '#FF8A5B' : '#2DD4BF';
  const pending = s.pending.length;
  return (
    <div className="panel p-4 flex items-center gap-4">
      <svg width="96" height="96" viewBox="0 0 100 100" className="shrink-0" aria-hidden>
        <circle cx="50" cy="50" r="46" fill="none" stroke="#232935" />
        <circle cx="50" cy="50" r="30" fill="none" stroke="#232935" />
        <circle cx="50" cy="50" r="14" fill="none" stroke="#232935" />
        <line x1="4" y1="50" x2="96" y2="50" stroke="#232935" />
        <line x1="50" y1="4" x2="50" y2="96" stroke="#232935" />
        <path d="M50 50 L50 4 A46 46 0 0 1 88 28 Z" fill={tone} opacity="0.16" className="radar-sweep" style={{ transformOrigin: '50px 50px' }} />
        <circle cx="70" cy="34" r="3" fill={tone} />
        <circle cx="36" cy="66" r="2.5" fill="#2DD4BF" opacity="0.8" />
        <circle cx="62" cy="70" r="2" fill="#2DD4BF" opacity="0.6" />
      </svg>
      <div className="min-w-0">
        <p className="meta flex items-center gap-1.5"><Radar size={12} /> Registry scanner</p>
        <p className="text-[13px] text-sub leading-relaxed mt-1.5">
          {s.agents.length} registered agents, {s.claims.length} claims on record, {pending} waiting for
          audit_claim(). Every write is deterministic except the audit itself.
        </p>
        <p className="text-[11px] font-mono text-mute mt-1.5 flex items-center gap-1">
          <ScanLine size={11} /> live reads · {s.lastCheckSec}s ago
        </p>
      </div>
    </div>
  );
}

export { STATUS_ORDER };
