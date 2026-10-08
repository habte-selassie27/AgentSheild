import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import clsx from 'clsx';
import { ArrowLeft, Coins, Play, Scale, Wallet } from 'lucide-react';
import { PageHeader } from '../components/Shell';
import { StatusBadge } from '../components/StatusBadge';
import { AuditResult } from '../components/Cards';
import { AuditModal } from '../components/AuditModal';
import { useShield } from '../lib/shield';
import { formatGen } from '../lib/types';

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

  return (
    <>
      <Link to="/claims" className="inline-flex items-center gap-1.5 text-[12px] text-sub hover:text-ink mb-3">
        <ArrowLeft size={13} /> All claims
      </Link>

      <PageHeader
        title={`CL-${String(claim.id).padStart(3, '0')} · ${claim.title}`}
        sub={`Claim by ${claim.claimant} against agent #${claim.agentId} ${claim.agentName}. Severity claimed ${claim.severityClaimed}${claim.severityAi ? ` · AI severity ${claim.severityAi}` : ' · awaiting AI audit'}.`}
        actions={
          pendingAudit ? (
            <button onClick={run} className="btn-primary" disabled={s.auditing || !s.account}>
              <Play size={13} /> {s.auditing ? 'Auditing…' : 'Run audit_claim()'}
            </button>
          ) : claim.status === 'valid' ? (
            <>
              <button onClick={() => s.claimPayout(claim.id)} className="btn-primary" disabled={underfunded || !s.account} title={underfunded ? 'Bond underfunded — top up first' : 'claim_payout()'}>
                <Wallet size={13} /> claim_payout()
              </button>
              <button
                onClick={() => s.raiseDispute(claim.id, 'Claimant disputes the audited decision — severity and evidence contested.')}
                className="btn-ghost"
                disabled={!s.account}
              >
                <Scale size={13} /> raise_dispute()
              </button>
            </>
          ) : claim.status === 'paid' ? (
            <button
              onClick={() => s.raiseDispute(claim.id, 'Claimant disputes the settled payout — arbitration requested.')}
              className="btn-ghost"
              disabled={!s.account}
            >
              <Scale size={13} /> raise_dispute()
            </button>
          ) : claim.status === 'disputed' ? (
            <button
              onClick={() => s.requeueDisputed(claim.id)}
              className="btn-ghost"
              disabled={!s.account}
              title="Owner or operator: back to pending for a fresh consensus round"
            >
              <Play size={13} /> requeue_disputed()
            </button>
          ) : null
        }
      />

      <div className="flex flex-wrap items-center gap-2 mb-4">
        <StatusBadge status={claim.status} pulse={claim.status === 'disputed'} />
        <StatusBadge status={claim.severityClaimed} />
        {claim.severityAi && <><span className="text-mute text-[12px]">→</span><StatusBadge status={claim.severityAi} /></>}
        {claim.duplicateOf > 0 && <span className="font-mono text-[11.5px] text-mute">duplicate_of = #{claim.duplicateOf}</span>}
        <span className="ml-auto font-mono text-[11.5px] text-sub">{formatGen(claim.payout)} GEN tier payout</span>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-3">
        {/* left: record + math */}
        <div className="lg:col-span-7 space-y-3">
          <div className="panel p-4">
            <p className="meta">Claim record</p>
            <p className="text-[13.5px] text-sub leading-relaxed mt-2">{claim.description}</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mt-3.5">
              <div className="rounded-lg border border-edge bg-elevated px-3 py-2">
                <p className="meta">Evidence</p>
                <p className="text-[12.5px] mt-0.5 leading-snug whitespace-pre-wrap">{claim.evidence}</p>
              </div>
              <div className="rounded-lg border border-edge bg-elevated px-3 py-2">
                <p className="meta">Impact</p>
                <p className="text-[12.5px] mt-0.5 leading-snug whitespace-pre-wrap">{claim.impact}</p>
              </div>
            </div>
            <div className="mt-3 rounded-lg border border-edge bg-elevated px-3 py-2">
              <p className="meta">Claimant</p>
              <p className="text-[12px] mt-0.5 font-mono break-all">{claim.claimant}</p>
            </div>
            <div className="flex flex-wrap items-center gap-2 mt-3 border-t border-edge pt-3">
              <Link to="/agents" className="text-[11.5px] font-bold text-accent hover:underline">Agent registry →</Link>
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
              <div className="flex justify-between"><dt className="text-mute">Protocol fee</dt><dd className="font-mono text-mute">applied on-chain at payout</dd></div>
              <div className="flex justify-between border-t border-edge pt-2">
                <dt className="text-mute">Bond after payout</dt>
                <dd className={clsx('font-mono font-bold', underfunded ? 'text-warn' : 'text-sub')}>
                  {agent ? formatGen(agent.bond) : '—'} GEN
                </dd>
              </div>
            </dl>
            {underfunded && claim.status === 'valid' && (
              <p className="text-[11.5px] text-warn mt-2.5">Bond below tier payout — claim_payout() stays closed until the operator tops up.</p>
            )}
            <p className="text-[10.5px] text-mute mt-2.5">
              The contract applies its fee (≤10%) from the tier payout; the gross tier amount is shown above.
            </p>
          </div>

          {/* derived status */}
          <div className="panel p-4">
            <p className="meta mb-2">On-chain status</p>
            <ul className="space-y-2 text-[12.5px]">
              <li className="flex justify-between"><span className="text-mute">Intake</span><span className="font-mono text-sub">file_claim() · {claim.severityClaimed} claimed</span></li>
              <li className="flex justify-between"><span className="text-mute">Audit</span><span className="font-mono text-sub">{claim.severityAi ? `decided · ${claim.status}` : 'awaiting audit_claim()'}</span></li>
              <li className="flex justify-between"><span className="text-mute">Settlement</span><span className="font-mono text-sub">
                {claim.status === 'paid' ? 'auto-paid from bond' : claim.status === 'valid' ? 'claimable' : claim.status === 'disputed' ? 'frozen for arbitration' : claim.status === 'pending' ? 'not reached' : 'no payout'}
              </span></li>
            </ul>
          </div>
        </div>

        {/* right: audit consensus, status, dispute */}
        <div className="lg:col-span-5 space-y-3">
          <AuditResult claim={claim} />

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
              <div className="flex justify-between"><dt className="text-mute">Claimant</dt><dd className="font-mono font-bold truncate max-w-[180px]">{claim.claimant.slice(0, 10)}…</dd></div>
            </dl>
            {pendingAudit && (
              <button onClick={run} className="btn-primary w-full justify-center mt-3" disabled={s.auditing || !s.account}>
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
                <div className="flex justify-between"><span className="text-mute">Frozen tiers</span><span className="font-mono font-bold">crit {formatGen(dispute.frozenTiers.critical)} GEN</span></div>
              </div>
              <div className="flex gap-2 mt-3">
                <button onClick={() => s.resolveDispute(dispute.id, 'valid', claim.severityClaimed)} disabled={!s.account} className="btn-accent flex-1 justify-center !py-1.5 !text-[11.5px] disabled:opacity-40">
                  Uphold claim
                </button>
                <button onClick={() => s.resolveDispute(dispute.id, 'invalid', 'info')} disabled={!s.account} className="btn-ghost flex-1 justify-center !py-1.5 !text-[11.5px] disabled:opacity-40">
                  Overturn
                </button>
              </div>
              <p className="text-[10.5px] text-mute mt-2">Owner-only in the contract — arbitration pays from the frozen table.</p>
            </div>
          )}
        </div>
      </div>

      <AuditModal open={auditOpen} onClose={() => setAuditOpen(false)} />
    </>
  );
}
