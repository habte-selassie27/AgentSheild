import { useState } from 'react';
import { Link } from 'react-router-dom';
import clsx from 'clsx';
import { Gavel, Play, Waypoints } from 'lucide-react';
import { PageHeader } from '../components/Shell';
import { StatusBadge } from '../components/StatusBadge';
import { ValidatorConsensus } from '../components/Cards';
import { AuditModal } from '../components/AuditModal';
import { useShield } from '../lib/shield';
import { formatGen } from '../lib/types';

export function Audit() {
  const s = useShield();
  const pending = s.claims.filter((c) => c.status === 'pending');
  const audited = s.claims.filter((c) => c.audit);
  const defaultId = pending[0]?.id ?? audited[0]?.id ?? 0;
  const [selectedId, setSelectedId] = useState(defaultId);
  const [auditOpen, setAuditOpen] = useState(false);

  const claim = s.claims.find((c) => c.id === selectedId) ?? pending[0] ?? audited[0] ?? null;
  const rounds = audited.length;

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
          <button onClick={() => pending[0] && run(pending[0].id)} className="btn-primary" disabled={!pending.length || s.auditing}>
            <Play size={13} /> {s.auditing ? 'Auditing…' : pending.length ? `Run next audit (${pending.length})` : 'Queue clear'}
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
              {pending.map((c) => (
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
                    <p className="text-[11px] text-mute truncate">{c.agentName} · filed {c.submittedAt}</p>
                    <span
                      onClick={(e) => { e.stopPropagation(); run(c.id); }}
                      role="button"
                      className="btn-accent !py-1 !px-2 !text-[11px] mt-2 inline-flex"
                    >
                      <Play size={11} /> Run audit
                    </span>
                  </button>
                </li>
              ))}
              {!pending.length && (
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
              <span className="font-mono text-[11px] text-mute">{rounds} on record</span>
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
                    <span className="ml-auto shrink-0"><StatusBadge status={c.audit?.finalDecision ?? 'pending'} size="sm" /></span>
                  </button>
                </li>
              ))}
              {!audited.length && <li className="px-2 py-6 text-center text-[12.5px] text-mute">No rounds yet — run the queue.</li>}
            </ul>
          </div>
        </div>

        {/* consensus + explainer */}
        <div className="lg:col-span-7 space-y-3">
          {claim?.audit ? (
            <ValidatorConsensus audit={claim.audit} />
          ) : claim ? (
            <div className="panel p-5 text-center">
              <span className="grid h-11 w-11 place-items-center rounded-lg border border-accent/40 bg-accent/10 mx-auto">
                <Gavel size={20} className="text-accent" />
              </span>
              <p className="text-[15px] font-extrabold mt-3">No audit round for CL-{String(claim.id).padStart(3, '0')}</p>
              <p className="text-[12.5px] text-sub mt-1 max-w-[420px] mx-auto leading-relaxed">
                Trigger <code className="font-mono text-accent">audit_claim()</code> to copy the agent and claim into
                memory, build the dedup context, and run five validators on the same prompt.
              </p>
              <button onClick={() => run(claim.id)} className="btn-accent mt-4" disabled={s.auditing}>
                <Play size={14} /> {s.auditing ? 'Audit running…' : 'Run audit now'}
              </button>
            </div>
          ) : null}

          <div className="panel p-4">
            <p className="meta">How an audit round works</p>
            <ol className="mt-3 space-y-3">
              {[
                ['Deterministic intake already done', 'file_claim() sealed evidence, impact and claimed severity on-chain without any LLM involvement.'],
                ['audit_claim() copies to memory', 'The agent manifest, claim record and bounded dedup context (recent claims, settle ledger, first_invalid_index) are snapshotted for every validator.'],
                ['Five validators, one prompt', 'Each validator re-runs the identical prompt against the identical snapshot — no validator sees another’s output before committing.'],
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
