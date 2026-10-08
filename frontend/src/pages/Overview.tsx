import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Gavel, Play, Waypoints } from 'lucide-react';
import clsx from 'clsx';
import { PageHeader } from '../components/Shell';
import { StatusBadge } from '../components/StatusBadge';
import {
  ActivityFeed, AuditResult, BondGauge, ClaimCard, ClaimsBreakdown, Kpi, Pipeline, ScannerCard, TopBonds,
} from '../components/Cards';
import { AuditModal } from '../components/AuditModal';
import { NETWORK, useShield } from '../lib/shield';
import { formatGen } from '../lib/types';

export function Overview() {
  const s = useShield();
  const [auditOpen, setAuditOpen] = useState(false);

  const paid = s.claims.filter((c) => c.status === 'paid');
  const paidTotal = paid.reduce((n, c) => n + c.payout, 0n);
  const next = s.pending[0];
  const audited = [...s.claims].filter((c) => c.severityAi !== null).sort((a, b) => b.id - a.id)[0] ?? null;

  const run = () => {
    if (!next) return;
    setAuditOpen(true);
    s.runAudit(next.id);
  };

  return (
    <>
      <PageHeader
        title="Registry Overview"
        sub="Live on-chain state: bonds, claims and audits for every registered agent. Is the registry solvent and are claims moving?"
        actions={
          <>
            <button onClick={run} className="btn-primary" disabled={!next || s.auditing || !s.account}>
              <Play size={13} /> {s.auditing ? 'Auditing…' : 'Run Audit'}
            </button>
            <Link to="/claims" className="btn-ghost">Claims →</Link>
          </>
        }
      />

      {/* headline banner */}
      <div
        className={clsx(
          'panel px-4 py-3.5 flex flex-wrap items-center gap-3 anim-rise border-l-[3px]',
          s.posture === 'DISPUTED' ? 'border-l-high' : s.posture === 'SETTLED' ? 'border-l-accent' : 'border-l-info'
        )}
      >
        <span
          className={clsx(
            'h-2.5 w-2.5 rounded-full',
            s.posture === 'DISPUTED' ? 'bg-high dot-crit' : s.posture === 'SETTLED' ? 'bg-accent dot-safe' : 'bg-info dot-safe'
          )}
        />
        <div className="min-w-0">
          <p className={clsx('text-[15px] font-extrabold tracking-wide', s.posture === 'DISPUTED' ? 'text-high' : s.posture === 'SETTLED' ? 'text-accent' : 'text-info')}>
            {s.headline}
          </p>
          <p className="text-[12.5px] text-sub mt-0.5">{s.headlineDetail}</p>
        </div>
        <div className="ml-auto flex items-center gap-2">
          <StatusBadge status={s.status} pulse={s.status === 'DISPUTE_OPEN'} />
          <span className="font-mono text-[11px] text-mute hidden sm:block">synced {s.lastCheckSec}s ago</span>
        </div>
      </div>

      {s.loading ? (
        <div className="mt-3 panel px-4 py-16 text-center text-[13px] text-mute">Reading the registry from {NETWORK.chain}…</div>
      ) : s.error ? (
        <div className="mt-3 panel px-4 py-16 text-center">
          <p className="text-[14px] font-bold text-warn">Could not read the contract</p>
          <p className="text-[12.5px] text-mute mt-1 max-w-[560px] mx-auto break-words">{s.error}</p>
        </div>
      ) : (
        <>
          {/* KPIs */}
          <div className="mt-3 grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-2.5">
            <Kpi label="Agents" value={String(s.agents.length)} sub={`${s.agents.filter((a) => a.status === 'active').length} active`} />
            <Kpi label="Bond staked" value={`${formatGen(s.totalBond)}`} sub="GEN across registry" accent="text-accent" />
            <Kpi label="Pending audits" value={String(s.pending.length)} sub="awaiting audit_claim()" accent={s.pending.length ? 'text-info' : 'text-ok'} />
            <Kpi label="Paid out" value={`${formatGen(paidTotal)}`} sub={`${paid.length} claims settled`} />
            <Kpi label="Open disputes" value={String(s.openDisputes.length)} sub="owner arbitration" accent={s.openDisputes.length ? 'text-high' : 'text-ok'} />
            <Kpi label="Claims" value={String(s.claims.length)} sub={`${s.claims.filter((c) => c.status === 'invalid').length} invalid · ${s.claims.filter((c) => c.status === 'duplicate').length} dup`} />
          </div>

          <div className="mt-3">
            <Pipeline />
          </div>

          <div className="mt-3 grid grid-cols-1 lg:grid-cols-12 gap-3">
            <div className="lg:col-span-8 space-y-3">
              <ClaimsBreakdown />
              <ScannerCard />
            </div>
            <div className="lg:col-span-4">
              <BondGauge />
            </div>
          </div>

          <div className="mt-3 grid grid-cols-1 lg:grid-cols-2 gap-3">
            <TopBonds />
            <ActivityFeed compact />
          </div>

          <div className="mt-3 grid grid-cols-1 lg:grid-cols-12 gap-3">
            <div className="lg:col-span-7 space-y-3">
              <p className="meta mt-1">Latest claims</p>
              {s.claims.slice(0, 2).map((c) => <ClaimCard key={c.id} claim={c} />)}
              {!s.claims.length && <div className="panel px-4 py-10 text-center text-[13px] text-mute">No claims on chain yet.</div>}
              <Link to="/claims" className="inline-block text-[12px] font-bold text-accent hover:underline">All claims →</Link>
            </div>
            <div className="lg:col-span-5">
              {audited ? <AuditResult claim={audited} /> : (
                <div className="panel p-4">
                  <p className="meta">On-chain audit result</p>
                  <p className="text-[13px] text-sub mt-2 leading-relaxed">
                    No audit round recorded yet. Run one on a pending claim to see the contract write a
                    decision, severity, tier payout and reason on chain.
                  </p>
                  <button onClick={run} className="btn-accent mt-3" disabled={!next || s.auditing || !s.account}>
                    <Gavel size={14} /> Run audit
                  </button>
                </div>
              )}
              <div className="mt-3 flex gap-2">
                <Link to="/audit" className="btn-ghost flex-1 justify-center"><Waypoints size={14} /> Audit queue</Link>
                <button onClick={run} className="btn-accent flex-1 justify-center" disabled={!next || s.auditing || !s.account}>
                  <Play size={14} /> {next ? `Audit CL-${String(next.id).padStart(3, '0')}` : 'Queue clear'}
                </button>
              </div>
              {!s.account && <p className="text-[11px] text-mute mt-2">Connect a wallet to send transactions.</p>}
            </div>
          </div>
        </>
      )}

      <AuditModal open={auditOpen} onClose={() => setAuditOpen(false)} />
    </>
  );
}
