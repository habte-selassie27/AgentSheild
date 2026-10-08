import { useState } from 'react';
import { Link } from 'react-router-dom';
import clsx from 'clsx';
import { Scale, ShieldAlert } from 'lucide-react';
import { PageHeader } from '../components/Shell';
import { StatusBadge } from '../components/StatusBadge';
import { useShield } from '../lib/shield';
import { formatGen } from '../lib/types';

export function Disputes() {
  const s = useShield();
  const [selected, setSelected] = useState<number | null>(null);

  const open = s.disputes.filter((d) => !d.resolved);
  const resolved = s.disputes.filter((d) => d.resolved);
  const current = s.disputes.find((d) => d.id === selected) ?? open[0] ?? resolved[0] ?? null;
  const claim = current ? s.claims.find((c) => c.id === current.claimId) : undefined;
  const agent = claim ? s.agents.find((a) => a.id === claim.agentId) : undefined;

  return (
    <>
      <PageHeader
        title="Disputes"
        sub="raise_dispute() freezes the liability table at raise time. The owner arbitrates from that snapshot — operators cannot retier mid-dispute, and settlement stays halted until a decision lands."
        actions={<Link to="/claims" className="btn-ghost">All claims →</Link>}
      />

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-3">
        {/* dispute list */}
        <div className="lg:col-span-5 space-y-3">
          <div className="panel p-4">
            <div className="flex items-center justify-between mb-3">
              <p className="meta flex items-center gap-1.5"><ShieldAlert size={12} /> Open disputes</p>
              <span className="font-mono text-[11px] text-mute">{open.length} · owner arbitration</span>
            </div>
            <ul className="space-y-2">
              {open.map((d) => (
                <li key={d.id}>
                  <button
                    onClick={() => setSelected(d.id)}
                    className={clsx(
                      'w-full text-left rounded-lg border px-3 py-2.5 transition-colors',
                      current?.id === d.id ? 'border-high/50 bg-high/10' : 'border-edge bg-elevated hover:border-mute/50'
                    )}
                  >
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-[11.5px] font-bold text-high">DSP-{String(d.id).padStart(3, '0')}</span>
                      <span className="font-mono text-[11px] text-mute">claim #{d.claimId}</span>
                      <span className="ml-auto"><StatusBadge status="disputed" size="sm" /></span>
                    </div>
                    <p className="text-[12.5px] text-sub mt-1 leading-snug">{d.reason}</p>
                    <p className="text-[10.5px] font-mono text-mute mt-1">{d.raisedBy.slice(0, 10)}…</p>
                  </button>
                </li>
              ))}
              {!open.length && (
                <li className="px-3 py-8 text-center">
                  <p className="text-[13px] text-sub font-semibold">No open disputes</p>
                  <p className="text-[11.5px] text-mute mt-1">Claims settle without arbitration in this state.</p>
                </li>
              )}
            </ul>
          </div>

          <div className="panel p-4">
            <div className="flex items-center justify-between mb-3">
              <p className="meta">Resolved</p>
              <span className="font-mono text-[11px] text-mute">{resolved.length}</span>
            </div>
            <ul className="space-y-1.5">
              {resolved.map((d) => (
                <li key={d.id}>
                  <button
                    onClick={() => setSelected(d.id)}
                    className={clsx(
                      'w-full flex items-center gap-2 rounded-md px-2.5 py-2 text-left transition-colors',
                      current?.id === d.id ? 'bg-accent/15 text-accent' : 'text-sub hover:bg-elevated hover:text-ink'
                    )}
                  >
                    <span className="font-mono text-[11.5px] font-bold">DSP-{String(d.id).padStart(3, '0')}</span>
                    <span className="text-[11px] text-mute truncate">claim #{d.claimId} · {d.outcome}</span>
                    <span className="ml-auto"><StatusBadge status={d.outcome || 'valid'} size="sm" /></span>
                  </button>
                </li>
              ))}
              {!resolved.length && <li className="px-2 py-5 text-center text-[12.5px] text-mute">Nothing arbitrated yet.</li>}
            </ul>
          </div>
        </div>

        {/* detail */}
        <div className="lg:col-span-7 space-y-3">
          {current ? (
            <>
              <div className={clsx('panel p-4 border-l-[3px]', current.resolved ? 'border-l-edge' : 'border-l-high')}>
                <div className="flex items-center justify-between mb-2">
                  <p className="meta flex items-center gap-1.5"><Scale size={12} /> DSP-{String(current.id).padStart(3, '0')}</p>
                  <StatusBadge status={current.resolved ? (current.outcome || 'valid') : 'disputed'} size="sm" />
                </div>
                <p className="text-[15px] font-extrabold">Claim #{current.claimId} — {claim?.title ?? 'claim'}</p>
                <p className="text-[13px] text-sub leading-relaxed mt-1.5">{current.reason}</p>

                <dl className="mt-3.5 grid grid-cols-2 sm:grid-cols-4 gap-2 text-[12px] border-t border-edge pt-3">
                  {[
                    ['Raised by', `${current.raisedBy.slice(0, 10)}…`],
                    ['Outcome', current.resolved ? current.outcome : 'open'],
                    ['Claim status', claim?.status ?? '—'],
                    ['Agent', agent?.name ?? '—'],
                  ].map(([k, v]) => (
                    <div key={k}>
                      <dt className="meta">{k}</dt>
                      <dd className="font-mono font-semibold mt-0.5 truncate">{v}</dd>
                    </div>
                  ))}
                </dl>

                {claim && (
                  <div className="flex flex-wrap items-center gap-2 mt-3 border-t border-edge pt-3">
                    <StatusBadge status={claim.status} size="sm" />
                    <span className="text-[11.5px] text-mute">severity claimed {claim.severityClaimed}</span>
                    {claim.severityAi && <span className="text-[11.5px] text-mute">· AI severity {claim.severityAi}</span>}
                    <Link to={`/claims/${claim.id}`} className="ml-auto text-[11.5px] font-bold text-accent hover:underline">
                      Inspect claim →
                    </Link>
                  </div>
                )}

                {!current.resolved && (
                  <div className="border-t border-edge mt-3 pt-3">
                    <p className="meta mb-2">Owner arbitration (resolve_dispute)</p>
                    <div className="flex flex-wrap gap-2">
                      <button
                        onClick={() => s.resolveDispute(current.id, 'valid', claim?.severityClaimed ?? 'high')}
                        disabled={!s.account}
                        className="btn-accent disabled:opacity-40"
                      >
                        Uphold claim · pay frozen tier
                      </button>
                      <button
                        onClick={() => s.resolveDispute(current.id, 'invalid', 'info')}
                        disabled={!s.account}
                        className="btn-ghost disabled:opacity-40"
                      >
                        Overturn · no payout
                      </button>
                      {claim && (
                        <button
                          onClick={() => s.requeueDisputed(claim.id)}
                          disabled={!s.account}
                          className="btn-ghost disabled:opacity-40"
                          title="Owner or operator: back to pending for a fresh audit"
                        >
                          Requeue for re-audit
                        </button>
                      )}
                    </div>
                    <p className="text-[10.5px] text-mute mt-2 font-mono">owner-only · arbitration pays from the frozen table</p>
                  </div>
                )}
              </div>

              {/* frozen tiers */}
              <div className="panel p-4">
                <p className="meta">Frozen liability tiers (snapshot at raise)</p>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 mt-3">
                  {(['critical', 'high', 'medium', 'low'] as const).map((tier) => (
                    <div key={tier} className="rounded-lg border border-edge bg-elevated px-3 py-2.5">
                      <p className="meta capitalize">{tier}</p>
                      <p className="text-[15px] font-extrabold font-mono mt-1">{formatGen(current.frozenTiers[tier])}</p>
                      <p className="text-[10.5px] text-mute mt-0.5">
                        live: {agent ? formatGen(agent.liabilities[tier]) : '—'} GEN
                      </p>
                    </div>
                  ))}
                </div>
                <p className="text-[11.5px] text-mute mt-3 leading-snug">
                  Arbitration reads only the frozen values. Any tier updates the operator makes while the dispute is
                  open apply to future claims, not this one.
                </p>
              </div>
            </>
          ) : (
            <div className="panel p-8 text-center">
              <span className="grid h-11 w-11 place-items-center rounded-lg border border-edge bg-elevated mx-auto">
                <Scale size={20} className="text-mute" />
              </span>
              <p className="text-[14px] font-bold mt-3">No disputes on chain</p>
              <p className="text-[12.5px] text-mute mt-1 max-w-[420px] mx-auto leading-relaxed">
                Raise one from a valid claim to freeze its tiers and put the decision in front of the owner.
              </p>
              <Link to="/claims" className="btn-ghost mt-4 inline-flex">Go to claims →</Link>
            </div>
          )}
        </div>
      </div>
    </>
  );
}
