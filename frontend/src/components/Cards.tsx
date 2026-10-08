import { Link } from 'react-router-dom';
import clsx from 'clsx';
import { ArrowUpRight, Radar } from 'lucide-react';
import { useShield } from '../lib/shield';
import { CLAIM_TREND } from '../lib/mock';
import type { ActivityEvent, AuditRound, Claim, Severity } from '../lib/types';
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
  OFFLINE: { text: 'text-mute', ring: 'stroke-mute' },
};

export function BondGauge() {
  const s = useShield();
  const tone = POSTURE_TONE[s.posture] ?? POSTURE_TONE.OFFLINE;
  const totalBond = s.agents.reduce((n, a) => n + a.bond, 0n);
  const totalExposure = s.agents.reduce((n, a) => n + a.liabilities.critical, 0n);
  const pct = totalExposure > 0n ? Number((totalBond * 100n) / totalExposure) : 0;
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
            strokeDasharray={`${Math.min(pct, 100) * C / 100} ${C}`}
            className={clsx(tone.ring, 'transition-all duration-700')}
          />
        </svg>
        <div className="absolute inset-0 grid place-items-center px-6">
          <div className="leading-tight">
            <p className={clsx('text-[19px] font-extrabold tracking-tight', tone.text)}>{pct}%</p>
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
        <p className="text-[11px] font-mono text-mute">live · stage {activeIdx + 1}/5</p>
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
              {!compact && i < PIPELINE.length - 1 && (
                <svg className="hidden sm:block absolute -right-[7px] top-1/2 -translate-y-1/2 z-10" width="14" height="8" viewBox="0 0 14 8" aria-hidden>
                  <path d="M0 4h11M8 1l3 3-3 3" fill="none" stroke={active ? '#2DD4BF' : '#5F6877'} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className={active ? 'flow-line' : ''} />
                </svg>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* ---------- Claims trend (area sparkline) ---------- */

export function ClaimsTrend() {
  const data = CLAIM_TREND;
  const w = 560;
  const h = 130;
  const max = Math.max(...data, 1);
  const pts = data.map((v, i) => [(i / (data.length - 1)) * w, h - (v / max) * (h - 14) - 6] as const);
  const line = pts.map(([x, y], i) => `${i === 0 ? 'M' : 'L'}${x.toFixed(1)},${y.toFixed(1)}`).join(' ');
  const area = `${line} L${w},${h} L0,${h} Z`;
  const total = data.reduce((n, v) => n + v, 0);

  return (
    <div className="panel p-4">
      <div className="flex items-start justify-between mb-2">
        <div>
          <p className="meta">Claims filed · 24h</p>
          <p className="text-[24px] font-extrabold font-mono mt-1">{total}</p>
        </div>
        <div className="text-right">
          <p className="text-[11px] text-mute">peak hour</p>
          <p className="text-[13px] font-bold font-mono text-warn">{max} / h</p>
        </div>
      </div>
      <svg viewBox={`0 0 ${w} ${h}`} className="w-full h-[130px]" preserveAspectRatio="none" aria-label="Claims filed over the last 24 hours">
        <defs>
          <linearGradient id="cg" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#2DD4BF" stopOpacity="0.35" />
            <stop offset="100%" stopColor="#2DD4BF" stopOpacity="0" />
          </linearGradient>
        </defs>
        {[0.25, 0.5, 0.75].map((f) => (
          <line key={f} x1="0" y1={h * f} x2={w} y2={h * f} stroke="#232935" strokeWidth="1" />
        ))}
        <path d={area} fill="url(#cg)" />
        <path d={line} fill="none" stroke="#2DD4BF" strokeWidth="2" strokeLinejoin="round" />
        <circle cx={pts[pts.length - 1][0]} cy={pts[pts.length - 1][1]} r="3.5" fill="#2DD4BF" />
      </svg>
      <div className="flex justify-between text-[10px] font-mono text-mute mt-1">
        <span>-24h</span><span>-12h</span><span>now</span>
      </div>
    </div>
  );
}

/* ---------- Activity feed ---------- */

const SEV_DOT: Record<Severity, string> = {
  critical: 'bg-crit', high: 'bg-high', medium: 'bg-warn', low: 'bg-info', info: 'bg-mute',
};
const ACT_SEV_DOT: Record<ActivityEvent['severity'], string> = {
  CRITICAL: 'bg-crit', HIGH: 'bg-high', MEDIUM: 'bg-warn', LOW: 'bg-info', INFO: 'bg-mute',
};

export function ActivityFeed({ compact }: { compact?: boolean }) {
  const s = useShield();
  const items = compact ? s.activity.slice(0, 7) : s.activity;
  return (
    <div className="panel p-4">
      <div className="flex items-center justify-between mb-3">
        <p className="meta">Registry activity</p>
        {!compact && <span className="text-[11px] font-mono text-mute">{s.activity.length} events</span>}
        {compact && <Link to="/activity" className="text-[11px] font-bold text-accent hover:underline">Full log →</Link>}
      </div>
      <ul className="space-y-2.5 max-h-[360px] overflow-y-auto pr-1">
        {items.map((e) => (
          <li key={e.id} className="flex gap-2.5 items-start">
            <span className={clsx('mt-1.5 h-1.5 w-1.5 rounded-full shrink-0', ACT_SEV_DOT[e.severity])} />
            <div className="min-w-0 flex-1">
              <p className="text-[12.5px] font-semibold leading-snug truncate">{e.title}</p>
              <p className="text-[11px] text-mute truncate">
                <span className="font-mono">{e.time}</span> · {e.detail}
              </p>
            </div>
            <span className="text-[9.5px] font-bold uppercase tracking-wider text-mute shrink-0 mt-0.5">{e.kind}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

/* ---------- Validator consensus panel ---------- */

const DECISION_TONE: Record<string, string> = {
  valid: 'bg-ok', invalid: 'bg-mute', duplicate: 'bg-info',
};
const DECISION_TEXT: Record<string, string> = {
  valid: 'text-ok', invalid: 'text-mute', duplicate: 'text-info',
};

export function ValidatorConsensus({ audit }: { audit: AuditRound }) {
  const counts = audit.validators.reduce<Record<string, number>>((acc, v) => ({ ...acc, [v.decision]: (acc[v.decision] ?? 0) + 1 }), {});
  return (
    <div className="panel p-4">
      <div className="flex items-center justify-between mb-3">
        <p className="meta">Validator audit round</p>
        <span className="text-[11px] font-mono text-mute">{audit.validators.length} nodes</span>
      </div>
      <div className="flex h-2.5 rounded-full overflow-hidden bg-elevated mb-3">
        {Object.entries(counts).map(([k, n]) => (
          <div key={k} style={{ width: `${(n / audit.validators.length) * 100}%` }} className={clsx(DECISION_TONE[k], 'border-r border-void last:border-0')} title={`${k}: ${n}`} />
        ))}
      </div>
      <div className="flex flex-wrap gap-x-4 gap-y-1 text-[11px] mb-3">
        {Object.entries(counts).map(([k, n]) => (
          <span key={k} className="flex items-center gap-1.5">
            <span className={clsx('h-2 w-2 rounded-full', DECISION_TONE[k])} />
            <span className={clsx('font-bold uppercase', DECISION_TEXT[k])}>{k}</span>
            <span className="text-mute font-mono">{n}/{audit.validators.length}</span>
          </span>
        ))}
      </div>
      <p className="text-[11px] text-mute font-mono border-t border-edge pt-2.5 mb-2">principle: {audit.principle}</p>
      <ul className="space-y-2">
        {audit.validators.map((v) => (
          <li key={v.node} className="flex items-start gap-2 text-[12px]">
            <span className={clsx('chip shrink-0 uppercase', DECISION_TEXT[v.decision])}>{v.decision}</span>
            <div className="min-w-0">
              <p className="font-mono text-[11.5px] text-sub">
                {v.node} · {v.region} · {v.severity} · {formatGen(v.reward)} GEN · {v.latencyMs}ms
              </p>
              <p className="text-[11.5px] text-mute leading-snug">{v.reason}</p>
            </div>
          </li>
        ))}
      </ul>
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
        <span className="font-mono">{claim.agentName}</span>
        <span className="font-mono">{claim.submittedAt}</span>
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
      </ul>
    </div>
  );
}

/* ---------- Registry scanner (decorative) ---------- */

export function ScannerCard() {
  const s = useShield();
  const tone = s.posture === 'DISPUTED' ? '#FF8A5B' : s.posture === 'SETTLED' ? '#2DD4BF' : '#2DD4BF';
  const pending = s.claims.filter((c) => c.status === 'pending').length;
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
        <p className="text-[11px] font-mono text-mute mt-1.5">fee 5% · ≤ 10% cap · studionet</p>
      </div>
    </div>
  );
}

export { SEV_DOT };
