import { useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, Bot, Coins, FileText, Gavel, Shield, Scale, Waypoints, Wallet } from 'lucide-react';
import { Pipeline } from '../components/Cards';
import { AuditModal } from '../components/AuditModal';
import { NETWORK, useShield } from '../lib/shield';
import { formatGen } from '../lib/types';

const FEATURES = [
  {
    icon: Wallet, title: 'Bonds back every claim',
    text: 'Operators register agents with a conduct policy, per-severity liability tiers and a GEN bond. Valid claims pay out of that bond — capped by the published tiers.',
  },
  {
    icon: FileText, title: 'Intake is deterministic',
    text: 'file_claim() never touches an LLM. Anyone can file; the record lands on-chain immediately with evidence, impact and claimed severity.',
  },
  {
    icon: Gavel, title: 'AI audit with real consensus',
    text: 'audit_claim() is the only nondeterministic method. Every validator re-runs the same prompt; prompt_comparative accepts only identical decisions and identical rewards.',
  },
  {
    icon: Scale, title: 'Arbitration when disputed',
    text: 'A dispute freezes the liability table at raise time. The owner arbitrates from that snapshot — operators cannot retier mid-dispute.',
  },
];

const FLOW = [
  { icon: Bot, label: 'Register', note: 'policy + tiers' },
  { icon: Wallet, label: 'Bond', note: 'GEN at stake' },
  { icon: FileText, label: 'File claim', note: 'deterministic' },
  { icon: Gavel, label: 'Audit', note: 'LLM consensus' },
  { icon: Shield, label: 'Settle', note: 'auto-pay / dispute' },
];

export function Landing() {
  const s = useShield();
  const [audit, setAudit] = useState(false);
  const pending = s.claims.filter((c) => c.status === 'pending');
  const next = pending[0];
  const totalBond = s.agents.reduce((n, a) => n + a.bond, 0n);
  const paidCount = s.claims.filter((c) => c.status === 'paid').length;

  return (
    <div className="min-h-screen bg-void text-ink">
      {/* nav */}
      <header className="border-b border-edge bg-void/80 backdrop-blur sticky top-0 z-30">
        <div className="max-w-[1180px] mx-auto px-5 h-[60px] flex items-center gap-3">
          <span className="grid h-8 w-8 place-items-center rounded-lg border border-accent/40 bg-accent/10 shadow-glow">
            <Shield size={16} className="text-accent" />
          </span>
          <span className="text-[13px] font-extrabold tracking-[0.18em]">AGENT<span className="text-sub">SHEILD</span></span>
          <span className="hidden sm:inline-flex chip border-warn/30 bg-warn/10 text-warn ml-2">GENLAYER STUDIONET</span>
          <nav className="ml-auto hidden md:flex items-center gap-5 text-[12.5px] text-sub">
            <a href="#how" className="hover:text-ink transition-colors">How it works</a>
            <a href="#capabilities" className="hover:text-ink transition-colors">Capabilities</a>
            <Link to="/overview" className="btn-primary !py-1.5">Open Console</Link>
          </nav>
          <Link to="/overview" className="md:hidden btn-primary !py-1.5">Console</Link>
        </div>
      </header>

      {/* hero */}
      <section className="relative overflow-hidden border-b border-edge">
        <div className="absolute inset-0 grid-bg pointer-events-none" />
        <div className="relative max-w-[1180px] mx-auto px-5 pt-16 pb-14 lg:pt-24 lg:pb-20 anim-rise">
          <div className="max-w-[780px]">
            <span className="chip border-accent/40 bg-accent/10 text-accent">AI-AUDITED AGENT LIABILITY</span>
            <h1 className="mt-5 text-[38px] leading-[1.05] sm:text-[54px] font-extrabold tracking-tight">
              When an AI agent misbehaves,<br />
              <span className="text-accent">its bond pays.</span>
            </h1>
            <p className="mt-5 text-[15.5px] leading-relaxed text-sub max-w-[640px]">
              AgentSheild is a bonded liability registry on <strong className="text-ink">GenLayer</strong>. Agents post a
              GEN bond against published liability tiers, anyone can file a claim, and validators reach LLM consensus on
              whether the agent actually misbehaved — then settlement pays out deterministically.
            </p>
            <div className="mt-7 flex flex-wrap gap-2.5">
              <Link to="/overview" className="btn-primary !py-2.5 !px-5 text-[13.5px]">
                Open registry console <ArrowRight size={15} />
              </Link>
              {next && (
                <button onClick={() => { setAudit(true); s.runAudit(next.id); }} className="btn-accent !py-2.5 !px-5 text-[13.5px]">
                  Run audit on CL-{String(next.id).padStart(3, '0')}
                </button>
              )}
            </div>
            <div className="mt-9 grid grid-cols-2 sm:grid-cols-4 gap-3 max-w-[640px]">
              {[
                { v: String(s.agents.length), l: 'agents registered' },
                { v: `${formatGen(totalBond)}`, l: 'GEN bonded' },
                { v: String(s.claims.length), l: 'claims on record' },
                { v: String(paidCount), l: 'claims paid out' },
              ].map((x) => (
                <div key={x.l} className="panel px-3 py-2.5">
                  <p className="text-[19px] font-extrabold font-mono">{x.v}</p>
                  <p className="text-[10.5px] text-mute leading-tight mt-0.5">{x.l}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* flow */}
      <section id="how" className="max-w-[1180px] mx-auto px-5 py-14">
        <p className="meta">The claim path</p>
        <h2 className="text-[26px] font-extrabold tracking-tight mt-2">From incident to on-chain payout</h2>
        <p className="text-[13.5px] text-sub mt-2 max-w-[640px]">
          Everything except <code className="font-mono text-accent">audit_claim()</code> is deterministic: intake, bond
          math, fee splits, status transitions and payouts never touch an LLM.
        </p>

        <div className="mt-7 grid grid-cols-1 sm:grid-cols-3 lg:grid-cols-5 gap-3">
          {FLOW.map((f, i) => (
            <div key={f.label} className="panel relative p-4">
              <span className="absolute top-3 right-3 font-mono text-[11px] text-mute">0{i + 1}</span>
              <span className="grid h-9 w-9 place-items-center rounded-lg border border-accent/40 bg-accent/10">
                <f.icon size={17} className="text-accent" />
              </span>
              <p className="text-[13.5px] font-bold mt-3">{f.label}</p>
              <p className="text-[11.5px] text-mute mt-0.5">{f.note}</p>
            </div>
          ))}
        </div>

        <div className="mt-4">
          <Pipeline />
        </div>
      </section>

      {/* capabilities */}
      <section id="capabilities" className="border-t border-edge bg-base/60">
        <div className="max-w-[1180px] mx-auto px-5 py-14">
          <p className="meta">Capabilities</p>
          <h2 className="text-[26px] font-extrabold tracking-tight mt-2">A liability primitive, not a thin LLM wrapper</h2>
          <div className="mt-7 grid sm:grid-cols-2 gap-3">
            {FEATURES.map((f) => (
              <div key={f.title} className="panel p-5">
                <span className="grid h-9 w-9 place-items-center rounded-lg border border-edge bg-elevated">
                  <f.icon size={17} className="text-accent" />
                </span>
                <h3 className="text-[15px] font-bold mt-3">{f.title}</h3>
                <p className="text-[13px] text-sub leading-relaxed mt-1.5">{f.text}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* claim teaser */}
      <section className="max-w-[1180px] mx-auto px-5 py-14">
        <div className="panel p-6 lg:p-8 flex flex-col lg:flex-row gap-6 items-start">
          <div className="min-w-0 flex-1">
            <span className="chip border-info/40 bg-info/10 text-info">
              {next ? `PENDING AUDIT · CL-${String(next.id).padStart(3, '0')}` : 'LIVE REGISTRY'}
            </span>
            <h3 className="text-[20px] font-extrabold tracking-tight mt-3">
              {next?.title ?? 'No claims awaiting audit right now'}
            </h3>
            <p className="text-[13.5px] text-sub leading-relaxed mt-2 max-w-[640px]">
              {next?.description ??
                'Every claim on the registry has reached a final decision. File a new claim to run another consensus round.'}
            </p>
            <div className="mt-4 flex flex-wrap gap-2.5">
              <Link to={next ? `/claims/${next.id}` : '/claims'} className="btn-primary">{next ? 'Inspect claim' : 'View claims'}</Link>
              <Link to="/audit" className="btn-ghost">See audit queue <Waypoints size={14} /></Link>
            </div>
          </div>
          <div className="w-full lg:w-[300px] shrink-0 space-y-2.5">
            {[
              { icon: FileText, k: 'Evidence', v: next?.evidence ? 'sealed on-chain' : 'sealed on-chain' },
              { icon: Gavel, k: 'Audit', v: 'validators · same prompt' },
              { icon: Coins, k: 'Liability tier', v: `${formatGen(next?.payout ?? 0n)} GEN max` },
              { icon: Shield, k: 'Enforcement', v: 'auto-pay from bond' },
            ].map((r) => (
              <div key={r.k} className="flex items-center gap-2.5 rounded-lg border border-edge bg-elevated px-3 py-2.5">
                <r.icon size={15} className="text-accent shrink-0" />
                <span className="text-[12px] text-mute">{r.k}</span>
                <span className="ml-auto text-[12px] font-semibold font-mono text-right">{r.v}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* footer */}
      <footer className="border-t border-edge">
        <div className="max-w-[1180px] mx-auto px-5 py-7 flex flex-wrap items-center gap-3 text-[12px] text-mute">
          <span className="flex items-center gap-2">
            <Shield size={13} className="text-accent" /> AgentSheild — built on GenLayer
          </span>
          <span className="font-mono">{NETWORK.contract.slice(0, 12)}… · {NETWORK.chain}</span>
          <span className="ml-auto">Settlement is on-chain. This console is read + trigger only.</span>
        </div>
      </footer>

      <AuditModal open={audit} onClose={() => setAudit(false)} />
    </div>
  );
}
