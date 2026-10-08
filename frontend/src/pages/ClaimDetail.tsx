import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import clsx from 'clsx';
import { ArrowLeft, Coins, Gavel, Play, Scale, Wallet } from 'lucide-react';
import { PageHeader } from '../components/Shell';
import { StatusBadge } from '../components/StatusBadge';
import { ValidatorConsensus } from '../components/Cards';
import { AuditModal } from '../components/AuditModal';
import { useShield } from '../lib/shield';
import { FEE_BPS, feeOf, formatGen, netOf } from '../lib/types';

export function ClaimDetail() {
  const { id } = useParams();
  const s = useShield();
  const [auditOpen, setAuditOpen] = useState(false);
  const claim = s.claims.find((c) => c.id === Number(id));

  if (!claim) {
    return (
      <div className="panel px-4 py-14 text-center">
        <p className="text-[14px] font-bold">Claim not found</p>
        <p className="text-[12.5px] text-mute mt-1">“{id}” is not in the registry.</p>
        <Link to="/claims" className="btn-ghost mt-4 inline-flex">← Back to claims</Link>
      </div>
    );
  }

  const agent = s.agents.find((a) => a.id === claim.agentId);
  const dispute = s.disputes.find((d) => d.claimId === claim.id && !d.resolved);
  const pendingAudit = claim.status === 'pending';
  const tier = claim.severityAi ?? claim.severityClaimed;
  const reward = agent ? agent.liabilities[tier] : claim.payout;
  const underfunded = agent ? agent.bond < reward : false;

  const run = () => { setAuditOpen(true); s.runAudit(claim.id); };

  const timeline = [
    { t: claim.submittedAt, label: 'file_claim() executed', note: `${claim.severityClaimed} claimed · deterministic intake, no LLM`, tone: 'info' },
    pendingAudit
      ? { t: 'queued', label: 'Awaiting audit_claim()', note: 'anyone can trigger the audit', tone: 'muted' }
      : { t: claim.resolvedAt ?? '—', label: `Audit decided: ${(claim.audit?.finalDecision ?? '—').toUpperCase()}`, note: claim.auditReason ?? '', tone: claim.audit?.finalDecision === 'valid' ? 'ok' : 'muted' },
    claim.status === 'paid'
      ? { t: claim.resolvedAt ?? '—', label: 'Auto-payout executed', note: `${formatGen(claim.payout)} GEN · claimant ${formatGen(netOf(claim.payout))}, fee ${formatGen(feeOf(claim.payout))}`, tone: 'ok' }
      : claim.status === 'valid'
        ? { t: 'claimable', label: 'Payout claimable', note: underfunded ? 'bond underfunded — top up to release' : 'awaiting claim_payout()', tone: 'warn' }
        : pendingAudit
          ? { t: 'pending', label: 'Settlement not reached', note: 'runs after consensus', tone: 'muted' }
          : { t: '—', label: 'No payout', note: claim.status === 'invalid' ? 'audited invalid' : claim.status === 'duplicate' ? `duplicate_of=${claim.duplicateOf}` : 'held for arbitration', tone: 'muted' },
    dispute
      ? { t: dispute.raisedAt, label: `Dispute #${dispute.id} raised`, note: 'liability table frozen at raise', tone: 'warn' }
      : { t: '—', label: 'Disputes', note: 'none open for this claim', tone: 'muted' },
  ];

  return (
    <>
      <Link to="/claims" className="inline-flex items-center gap-1.5 text-[12px] text-sub hover:text-ink mb-3">
        <ArrowLeft size={13} /> All claims
      </Link>

      <PageHeader
        title={`CL-${String(claim.id).padStart(3, '0')} · ${claim.title}`}
        sub={`Claim by ${claim.claimant} against ${claim.agentName}. Severity claimed ${claim.severityClaimed}${claim.severityAi ? ` · AI severity ${claim.severityAi}` : ' · awaiting AI audit'}.`}
        actions={
          pendingAudit ? (
            <button onClick={run} className="btn-primary" disabled={s.auditing}>
              <Play size={13} /> {s.auditing ? 'Auditing…' : 'Run audit_claim()'}
            </button>
          ) : claim.status === 'valid' ? (
            <>
              <button onClick={() => s.claimPayout(claim.id)} className="btn-primary" disabled={underfunded} title={underfunded ? 'Bond underfunded — top up first' : 'claim_payout()'}>
                <Wallet size={13} /> claim_payout()
              </button>
              <button
                onClick={() => s.raiseDisputeLocal(claim.id, 'Claimant disputes the audited decision — severity and evidence contested.')}
                className="btn-ghost"
              >
                <Scale size={13} /> raise_dispute()
              </button>
            </>
          ) : claim.status === 'paid' ? (
            <button
              onClick={() => s.raiseDisputeLocal(claim.id, 'Claimant disputes the settled payout — arbitration requested.')}
              className="btn-ghost"
            >
              <Scale size={13} /> raise_dispute()
            </button>
          ) : null
        }
      />

      <div className="flex flex-wrap items-center gap-2 mb-4">
        <StatusBadge status={claim.status} pulse={claim.status === 'disputed'} />
        <StatusBadge status={claim.severityClaimed} />
        {claim.severityAi && <><span className="text-mute text-[12px]">→</span><StatusBadge status={claim.severityAi} /></>}
        {claim.duplicateOf > 0 && <span className="font-mono text-[11.5px] text-mute">duplicate_of = #{claim.duplicateOf}</span>}
        <span className="font-mono text-[11.5px] text-mute">· filed {claim.submittedAt}</span>
        <span className="ml-auto font-mono text-[11.5px] text-sub">{formatGen(claim.payout)} GEN tier payout</span>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-3">
        {/* left: record + timeline */}
        <div className="lg:col-span-7 space-y-3">
          <div className="panel p-4">
            <p className="meta">Claim record</p>
            <p className="text-[13.5px] text-sub leading-relaxed mt-2">{claim.description}</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mt-3.5">
              <div className="rounded-lg border border-edge bg-elevated px-3 py-2">
                <p className="meta">Evidence</p>
                <p className="text-[12.5px] mt-0.5 leading-snug">{claim.evidence}</p>
              </div>
              <div className="rounded-lg border border-edge bg-elevated px-3 py-2">
                <p className="meta">Impact</p>
                <p className="text-[12.5px] mt-0.5 leading-snug">{claim.impact}</p>
              </div>
            </div>
            {claim.auditReason && (
              <div className="mt-3 rounded-lg border border-accent/30 bg-accent/5 px-3 py-2">
                <p className="meta text-accent">Audit reason (on-chain)</p>
                <p className="text-[12.5px] text-sub mt-1 leading-snug">{claim.auditReason}</p>
              </div>
            )}
            <div className="flex flex-wrap items-center gap-2 mt-3 border-t border-edge pt-3">
              <Link to={`/agents`} className="text-[11.5px] font-bold text-accent hover:underline">Agent registry →</Link>
              <span className="text-[11.5px] text-mute font-mono">agent #{claim.agentId} {claim.agentName}</span>
              {agent && <StatusBadge status={agent.status} size="sm" />}
              {agent && <span className="ml-auto text-[11.5px] font-mono text-mute">bond {formatGen(agent.bond)} GEN</span>}
            </div>
          </div>

          {/* payout math */}
          <div className="panel p-4">
            <p className="meta flex items-center gap-1.5"><Coins size={12} /> Settlement math</p>
            <dl className="mt-3 space-y-2 text-[12.5px]">
              <div className="flex justify-between"><dt className="text-mute">Liability tier ({tier})</dt><dd className="font-mono font-bold">{formatGen(reward)} GEN</dd></div>
              <div className="flex justify-between"><dt className="text-mute">Protocol fee ({FEE_BPS / 100}%)</dt><dd className="font-mono font-bold">{formatGen(feeOf(reward))} GEN</dd></div>
              <div className="flex justify-between border-t border-edge pt-2">
                <dt className="text-mute">Claimant receives</dt>
                <dd className="font-mono font-bold text-accent">{formatGen(netOf(reward))} GEN</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-mute">Agent bond after payout</dt>
                <dd className={clsx('font-mono font-bold', underfunded ? 'text-warn' : 'text-sub')}>
                  {claim.status === 'paid' && agent ? formatGen(agent.bond) : agent ? `${formatGen(agent.bond)} (unchanged)` : '—'} GEN
                </dd>
              </div>
            </dl>
            {underfunded && claim.status === 'valid' && (
              <p className="text-[11.5px] text-warn mt-2.5">Bond below tier payout — claim_payout() stays closed until the operator tops up.</p>
            )}
          </div>

          {/* timeline */}
          <div className="panel p-4">
            <p className="meta mb-3">Claim timeline</p>
            <ol className="relative border-l border-edge ml-1.5 space-y-4 pl-4">
              {timeline.map((step, i) => (
                <li key={i} className="relative">
                  <span
                    className={clsx(
                      'absolute -left-[22px] top-1 h-2.5 w-2.5 rounded-full border-2 border-void',
                      step.tone === 'ok' ? 'bg-ok' : step.tone === 'warn' ? 'bg-warn' : step.tone === 'info' ? 'bg-info' : 'bg-mute'
                    )}
                  />
                  <p className="text-[12.5px] font-semibold">{step.label}</p>
                  <p className="text-[11.5px] text-mute leading-snug">{step.note}</p>
                  <p className="text-[10.5px] font-mono text-mute mt-0.5">{step.t}</p>
                </li>
              ))}
            </ol>
          </div>
        </div>

        {/* right: audit consensus, status, dispute */}
        <div className="lg:col-span-5 space-y-3">
          {claim.audit ? (
            <ValidatorConsensus audit={claim.audit} />
          ) : (
            <div className="panel p-4">
              <div className="flex items-center justify-between mb-2">
                <p className="meta">Validator audit round</p>
                <StatusBadge status="pending" size="sm" />
              </div>
              <p className="text-[13px] text-sub leading-relaxed">
                No round yet. <code className="font-mono text-accent">audit_claim()</code> copies the agent and claim
                into memory, builds a bounded dedup context, then five validators re-run the same prompt under
                prompt_comparative.
              </p>
              <button onClick={run} className="btn-accent w-full justify-center mt-3" disabled={s.auditing}>
                <Gavel size={14} /> {s.auditing ? 'Audit running…' : 'Run audit now'}
              </button>
            </div>
          )}

          {/* status card */}
          <div className={clsx('panel p-4 border-l-[3px]', claim.status === 'paid' ? 'border-l-accent' : claim.status === 'disputed' ? 'border-l-high' : claim.status === 'pending' ? 'border-l-info' : 'border-l-edge')}>
            <div className="flex items-center justify-between mb-2">
              <p className="meta">Status</p>
              <StatusBadge status={claim.status} size="sm" />
            </div>
            <p className="text-[14px] font-bold capitalize">{claim.status}</p>
            <p className="text-[12px] text-sub mt-1 leading-snug">
              {claim.status === 'paid' && `Settled ${formatGen(claim.payout)} GEN from the agent bond.`}
              {claim.status === 'valid' && (underfunded ? 'Valid, but the bond cannot cover the tier payout yet.' : 'Valid — payout is one call away.')}
              {claim.status === 'pending' && 'Evidence sealed; waiting for an audit trigger.'}
              {claim.status === 'invalid' && 'Audited invalid — no payout, reason recorded on-chain.'}
              {claim.status === 'duplicate' && `Derived-checked duplicate of claim #${claim.duplicateOf} — no payout.`}
              {claim.status === 'disputed' && 'Payout frozen; owner arbitration in progress.'}
            </p>
            <dl className="mt-3 space-y-1.5 text-[12px] border-t border-edge pt-3">
              <div className="flex justify-between"><dt className="text-mute">Payout</dt><dd className="font-mono font-bold">{formatGen(claim.payout)} GEN</dd></div>
              <div className="flex justify-between"><dt className="text-mute">Contract</dt><dd className="font-mono font-bold">agentsheild</dd></div>
              <div className="flex justify-between"><dt className="text-mute">Round tx</dt><dd className="font-mono font-bold">{claim.audit?.tx ?? '—'}</dd></div>
            </dl>
            {pendingAudit && (
              <button onClick={run} className="btn-primary w-full justify-center mt-3" disabled={s.auditing}>
                <Play size={13} /> {s.auditing ? 'Audit running…' : 'Execute audit'}
              </button>
            )}
          </div>

          {/* dispute */}
          {dispute && (
            <div className="panel p-4 border-l-[3px] border-l-high">
              <div className="flex items-center justify-between mb-2">
                <p className="meta flex items-center gap-1.5"><Scale size={12} /> Dispute #{dispute.id}</p>
                <StatusBadge status={dispute.resolved ? 'valid' : 'disputed'} size="sm" />
              </div>
              <p className="text-[12.5px] text-sub leading-relaxed">{dispute.reason}</p>
              <div className="mt-3 border-t border-edge pt-3 space-y-1.5 text-[12px]">
                <div className="flex justify-between"><span className="text-mute">Raised by</span><span className="font-mono font-bold">{dispute.raisedBy.slice(0, 10)}…</span></div>
                <div className="flex justify-between"><span className="text-mute">Raised</span><span className="font-mono font-bold">{dispute.raisedAt}</span></div>
                <div className="flex justify-between"><span className="text-mute">Frozen tiers</span><span className="font-mono font-bold">crit {formatGen(dispute.frozenTiers.critical)} GEN</span></div>
              </div>
              <div className="flex gap-2 mt-3">
                <button onClick={() => s.resolveDisputeLocal(dispute.id, 'upheld', 'critical')} className="btn-accent flex-1 justify-center !py-1.5 !text-[11.5px]">
                  Uphold claim
                </button>
                <button onClick={() => s.resolveDisputeLocal(dispute.id, 'overturned', 'info')} className="btn-ghost flex-1 justify-center !py-1.5 !text-[11.5px]">
                  Overturn
                </button>
              </div>
              <p className="text-[10.5px] text-mute mt-2">Owner-only in production — arbitration pays from the frozen table.</p>
            </div>
          )}
        </div>
      </div>

      <AuditModal open={auditOpen} onClose={() => setAuditOpen(false)} />
    </>
  );
}
