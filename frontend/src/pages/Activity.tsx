import { useMemo, useState } from 'react';
import clsx from 'clsx';
import { PageHeader } from '../components/Shell';
import { useShield } from '../lib/shield';
import type { ActivityEvent } from '../lib/types';

const KINDS: Array<ActivityEvent['kind'] | 'ALL'> = ['ALL', 'Claims', 'Consensus', 'Payout', 'Disputes'];

const SEV_DOT: Record<string, string> = {
  CRITICAL: 'bg-crit', HIGH: 'bg-high', MEDIUM: 'bg-warn', LOW: 'bg-info', INFO: 'bg-mute',
};
const SEV_TEXT: Record<string, string> = {
  CRITICAL: 'text-crit', HIGH: 'text-high', MEDIUM: 'text-warn', LOW: 'text-info', INFO: 'text-mute',
};

export function Activity() {
  const s = useShield();
  const [kind, setKind] = useState<ActivityEvent['kind'] | 'ALL'>('ALL');
  const [q, setQ] = useState('');

  const rows = useMemo(() => {
    const term = q.trim().toLowerCase();
    return s.activity.filter(
      (e) =>
        (kind === 'ALL' || e.kind === kind) &&
        (!term || e.title.toLowerCase().includes(term) || e.detail.toLowerCase().includes(term))
    );
  }, [s.activity, kind, q]);

  const counts = useMemo(() => {
    const m: Record<string, number> = {};
    for (const e of s.activity) m[e.severity] = (m[e.severity] ?? 0) + 1;
    return m;
  }, [s.activity]);

  return (
    <>
      <PageHeader
        title="Activity"
        sub="A readable projection of current on-chain state — one record per claim and dispute, derived from the contract's live storage (it exposes no historical event log)."
        actions={
          <div className="relative">
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Filter events…"
              className="w-[210px] rounded-lg border border-edge bg-panel px-3 py-2 text-[12.5px] placeholder:text-mute focus:border-accent/60 outline-none"
            />
          </div>
        }
      />

      <div className="flex flex-wrap items-center gap-1.5 mb-3">
        {KINDS.map((k) => (
          <button
            key={k}
            onClick={() => setKind(k)}
            className={clsx(
              'rounded-lg border px-2.5 py-1.5 text-[11.5px] font-bold transition-colors',
              kind === k ? 'border-accent/50 bg-accent/10 text-accent' : 'border-edge bg-panel text-sub hover:text-ink'
            )}
          >
            {k === 'ALL' ? 'All' : k}
          </button>
        ))}
        <div className="ml-auto flex items-center gap-3 text-[11.5px]">
          {(['CRITICAL', 'HIGH', 'MEDIUM', 'INFO'] as const).map((sev) => (
            <span key={sev} className="flex items-center gap-1.5">
              <span className={clsx('h-1.5 w-1.5 rounded-full', SEV_DOT[sev])} />
              <span className={clsx('font-bold', SEV_TEXT[sev])}>{sev}</span>
              <span className="font-mono text-mute">{counts[sev] ?? 0}</span>
            </span>
          ))}
        </div>
      </div>

      <div className="panel overflow-hidden">
        <ul>
          {rows.map((e) => (
            <li key={e.id} className="flex items-start gap-3 px-4 py-3 border-b border-edge last:border-0 hover:bg-elevated/50 transition-colors">
              <span className={clsx('mt-1.5 h-2 w-2 rounded-full shrink-0', SEV_DOT[e.severity])} />
              <div className="min-w-0 flex-1">
                <p className="text-[13px] font-semibold leading-snug">{e.title}</p>
                <p className="text-[11.5px] text-mute mt-0.5">{e.detail}</p>
              </div>
              <span className="chip border-edge bg-elevated text-mute shrink-0">{e.kind}</span>
              <span className={clsx('chip shrink-0', 'border-current/30', SEV_TEXT[e.severity], 'bg-transparent')}>
                {e.severity}
              </span>
            </li>
          ))}
          {rows.length === 0 && (
            <li className="px-4 py-12 text-center text-[13px] text-mute">No events match this filter.</li>
          )}
        </ul>
      </div>

      <p className="text-[11.5px] text-mute mt-3 font-mono">
        {rows.length} of {s.activity.length} records · derived from live claim &amp; dispute storage
      </p>
    </>
  );
}
