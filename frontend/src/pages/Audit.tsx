import { useState } from 'react';
import { Link } from 'react-router-dom';
import clsx from 'clsx';
import { Gavel, Play, Waypoints } from 'lucide-react';
import { PageHeader } from '../components/Shell';
import { StatusBadge } from '../components/StatusBadge';
import { AuditResult } from '../components/Cards';
import { AuditModal } from '../components/AuditModal';
import { useShield } from '../lib/shield';
import { formatGen } from '../lib/types';

export function Audit() {
  const s = useShield();
  const audited = s.claims.filter((c) => c.severityAi !== null);
  const defaultId = s.pending[0]?.id ?? audited[0]?.id ?? 0;
  const [selectedId, setSelectedId] = useState(defaultId);
  const [auditOpen, setAuditOpen] = useState(false);

  const claim = s.claims.find((c) => c.id === selectedId) ?? s.pending[0] ?? audited[0] ?? null;

  const run = (id: number) => {
    setSelectedId(id);
    setAuditOpen(true);
    s.runAudit(id);
  };

  return (
    <>
      <PageHeader
        title="Audit Queue"
        sub="audit_claim() is the only nondeterministic method. Anyone can trigger it; every validator re-runs the same prompt and prompt_comparative accepts only identical decisions and identical rewards."
        actions={
          <button onClick={() => s.pending[0] && run(s.pending[0].id)} className="btn-primary" disabled={!s.pending.length || s.auditing || !s.account}>
            <Play size={13} /> {s.auditing ? 'Auditing…' : s.pending.length ? `Run next audit (${s.pending.length})` : 'Queue clear'}
          </button>
        }
      />

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-3">
        {/* queue */}
        <div className="lg:col-span-5 space-y-3">
          <div className="panel p-4">
            <div className="flex items-center justify-between mb-3">
              <p className="meta flex items-center gap-1.5"><Gavel size={12} /> Pending audits</p>
              <span className="font-mono text-[11px] text-mute">get_pending_queue()</span>
            </div>
            <ul className="space-y-2">
              {s.pending.map((c) => (
                <li key={c.id}>
                  <button
                    onClick={() => setSelectedId(c.id)}
                    className={clsx(
                      'w-full text-left rounded-lg border px-3 py-2.5 transition-colors',
                      claim?.id === c.id ? 'border-accent/50 bg-accent/10' : 'border-edge bg-elevated hover:border-mute/50'
                    )}
                  >
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-[11.5px] font-bold text-accent">CL-{String(c.id).padStart(3, '0')}</span>
                      <StatusBadge status={c.severityClaimed} size="sm" />
                      <span className="ml-auto font-mono text-[11px] text-mute">{formatGen(c.payout)} GEN</span>
                    </div>
                    <p className="text-[12.5px] font-semibold mt-1 truncate">{c.title}</p>
                    <p className="text-[11px] text-mute truncate">{c.agentName}</p>
                    <span
                      onClick={(e) => { e.stopPropagation(); run(c.id); }}
                      role="button"
                      className={clsx('btn-accent !py-1 !px-2 !text-[11px] mt-2 inline-flex', !s.account && 'opacity-40 pointer-events-none')}
                    >
                      <Play size={11} /> Run audit
                    </span>
                  </button>
                </li>
              ))}
              {!s.pending.length && (
                <li className="px-3 py-8 text-center">
                  <p className="text-[13px] text-sub font-semibold">Queue clear</p>
                  <p className="text-[11.5px] text-mute mt-1">Every claim has a final decision.</p>
                </li>
              )}
            </ul>
          </div>

          {/* recent rounds */}
          <div className="panel p-4">
            <div className="flex items-center justify-between mb-3">
              <p className="meta flex items-center gap-1.5"><Waypoints size={12} /> Audit rounds</p>
              <span className="font-mono text-[11px] text-mute">{audited.length} on record</span>
            </div>
            <ul className="space-y-1.5">
              {audited.map((c) => (
                <li key={c.id}>
                  <button
                    onClick={() => setSelectedId(c.id)}
                    className={clsx(
                      'w-full flex items-center gap-2 rounded-md px-2.5 py-2 text-left transition-colors',
                      claim?.id === c.id ? 'bg-accent/15 text-accent' : 'text-sub hover:bg-elevated hover:text-ink'
                    )}
                  >
                    <span className="font-mono text-[11.5px] font-bold">CL-{String(c.id).padStart(3, '0')}</span>
                    <span className="text-[11px] truncate text-mute">{c.auditReason}</span>
                    <span className="ml-auto shrink-0"><StatusBadge status={c.status} size="sm" /></span>
                  </button>
                </li>
              ))}
              {!audited.length && <li className="px-2 py-6 text-center text-[12.5px] text-mute">No rounds yet — run the queue.</li>}
            </ul>
          </div>
        </div>

        {/* result + explainer */}
        <div className="lg:col-span-7 space-y-3">
          {claim ? (
            <AuditResult claim={claim} />
          ) : (
            <div className="panel p-5 text-center">
              <span className="grid h-11 w-11 place-items-center rounded-lg border border-edge bg-elevated mx-auto">
                <Gavel size={20} className="text-mute" />
              </span>
              <p className="text-[15px] font-extrabold mt-3">No claims on chain</p>
              <p className="text-[12.5px] text-sub mt-1">File a claim to start an audit round.</p>
            </div>
          )}

          {claim?.status === 'pending' && (
            <div className="panel p-4 text-center">
              <p className="text-[13px] text-sub leading-relaxed max-w-[460px] mx-auto">
                CL-{String(claim.id).padStart(3, '0')} has no round yet. Trigger{' '}
                <code className="font-mono text-accent">audit_claim()</code> to snapshot the agent and claim,
                build the dedup context, and run the validators on the same prompt.
              </p>
              <button onClick={() => run(claim.id)} className="btn-accent mt-3" disabled={s.auditing || !s.account}>
                <Play size={14} /> {s.auditing ? 'Audit running…' : 'Run audit now'}
              </button>
            </div>
          )}

          <div className="panel p-4">
            <p className="meta">How an audit round works</p>
            <ol className="mt-3 space-y-3">
              {[
                ['Deterministic intake already done', 'file_claim() sealed evidence, impact and claimed severity on-chain without any LLM involvement.'],
                ['audit_claim() copies to memory', 'The agent manifest, claim record and bounded dedup context (recent claims) are snapshotted for every validator.'],
                ['Validators, one prompt', 'Each validator re-runs the identical prompt against the identical snapshot — no validator sees another’s output before committing.'],
                ['prompt_comparative finalizes', 'Consensus requires identical decisions AND identical rewards; anything else records no round. Decisions: valid, invalid, or duplicate (derived check against prior claims).'],
                ['Settlement is mechanical', 'Valid + bond covers tier → auto-payout (claimant net, protocol fee ≤10%). Valid but underfunded → claimable after a top-up. Disputable by either side, which freezes the tier table.'],
              ].map(([t, d], i) => (
                <li key={t} className="flex gap-3">
                  <span className="grid h-6 w-6 shrink-0 place-items-center rounded-md border border-edge bg-elevated font-mono text-[10.5px] font-bold text-accent">
                    {i + 1}
                  </span>
                  <div>
                    <p className="text-[12.5px] font-semibold">{t}</p>
                    <p className="text-[11.5px] text-mute leading-snug">{d}</p>
                  </div>
                </li>
              ))}
            </ol>
            <div className="border-t border-edge mt-4 pt-3 flex flex-wrap gap-2">
              <Link to="/claims" className="btn-ghost !py-1.5 !text-[11.5px]">All claims →</Link>
              <Link to="/disputes" className="btn-ghost !py-1.5 !text-[11.5px]">Disputes →</Link>
            </div>
          </div>
        </div>
      </div>

      <AuditModal open={auditOpen} onClose={() => setAuditOpen(false)} />
    </>
  );
}
