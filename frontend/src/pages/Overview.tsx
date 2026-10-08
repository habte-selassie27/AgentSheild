import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Gavel, Play, Waypoints } from 'lucide-react';
import clsx from 'clsx';
import { PageHeader } from '../components/Shell';
import { StatusBadge } from '../components/StatusBadge';
import {
  ActivityFeed, BondGauge, ClaimCard, ClaimsTrend, Kpi, Pipeline, ScannerCard, TopBonds, ValidatorConsensus,
} from '../components/Cards';
import { AuditModal } from '../components/AuditModal';
import { useShield } from '../lib/shield';
import { formatGen } from '../lib/types';

export function Overview() {
  const s = useShield();
  const [auditOpen, setAuditOpen] = useState(false);

  const pending = s.claims.filter((c) => c.status === 'pending');
  const paid = s.claims.filter((c) => c.status === 'paid');
  const openDisputes = s.disputes.filter((d) => !d.resolved);
  const totalBond = s.agents.reduce((n, a) => n + a.bond, 0n);
  const paidTotal = paid.reduce((n, c) => n + c.payout, 0n);
  const next = pending[0];
  const settled = s.claims.find((c) => c.audit) ?? null;

  const run = () => {
    if (!next) return;
    setAuditOpen(true);
    s.runAudit(next.id);
  };

  return (
    <>
      <PageHeader
        title="Registry Overview"
        sub="Bonds, claims and audits for every registered agent. Is the registry solvent and are claims moving?"
        actions={
          <>
            <button onClick={run} className="btn-primary" disabled={!next || s.auditing}>
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
          <span className="font-mono text-[11px] text-mute hidden sm:block">sync {s.lastCheckSec}s ago</span>
        </div>
      </div>

      {/* KPIs */}
      <div className="mt-3 grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-2.5">
        <Kpi label="Agents" value={String(s.agents.length)} sub={`${s.agents.filter((a) => a.status === 'active').length} active`} />
        <Kpi label="Bond staked" value={`${formatGen(totalBond)}`} sub="GEN across registry" accent="text-accent" />
        <Kpi label="Pending audits" value={String(pending.length)} sub="awaiting audit_claim()" accent={pending.length ? 'text-info' : 'text-ok'} />
        <Kpi label="Paid out" value={`${formatGen(paidTotal)}`} sub={`${paid.length} claims settled`} />
        <Kpi label="Open disputes" value={String(openDisputes.length)} sub="owner arbitration" accent={openDisputes.length ? 'text-high' : 'text-ok'} />
        <Kpi label="Fee" value="5%" sub="≤ 10% cap · owner" />
      </div>

      <div className="mt-3">
        <Pipeline />
      </div>

      <div className="mt-3 grid grid-cols-1 lg:grid-cols-12 gap-3">
        <div className="lg:col-span-8 space-y-3">
          <ClaimsTrend />
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
          <Link to="/claims" className="inline-block text-[12px] font-bold text-accent hover:underline">All claims →</Link>
        </div>
        <div className="lg:col-span-5">
          {settled?.audit ? <ValidatorConsensus audit={settled.audit} /> : (
            <div className="panel p-4">
              <p className="meta">Validator audit round</p>
              <p className="text-[13px] text-sub mt-2 leading-relaxed">
                No audit round in this state yet. Run one on a pending claim to see prompt_comparative consensus
                across five validators.
              </p>
              <button onClick={run} className="btn-accent mt-3" disabled={!next || s.auditing}>
                <Gavel size={14} /> Run audit
              </button>
            </div>
          )}
          <div className="mt-3 flex gap-2">
            <Link to="/audit" className="btn-ghost flex-1 justify-center"><Waypoints size={14} /> Audit queue</Link>
            <button onClick={run} className="btn-accent flex-1 justify-center" disabled={!next || s.auditing}>
              <Play size={14} /> {next ? `Audit CL-${String(next.id).padStart(3, '0')}` : 'Queue clear'}
            </button>
          </div>
        </div>
      </div>

      <AuditModal open={auditOpen} onClose={() => setAuditOpen(false)} />
    </>
  );
}
