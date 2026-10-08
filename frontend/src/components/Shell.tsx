import { Link, NavLink, useLocation } from 'react-router-dom';
import {
  Activity as ActivityIcon, Bot, FileText, Gavel, Home, Lock, RefreshCw, Scale, ScrollText, Shield, ShieldAlert,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import clsx from 'clsx';
import { useShield } from '../lib/shield';

type NavItem = { group: string } | { to: string; label: string; icon: LucideIcon };

const nav: NavItem[] = [
  { group: 'REGISTRY' },
  { to: '/overview', label: 'Overview', icon: Home },
  { to: '/agents', label: 'Agents', icon: Bot },
  { to: '/claims', label: 'Claims', icon: FileText },
  { group: 'VERIFICATION' },
  { to: '/audit', label: 'Audit Queue', icon: Gavel },
  { to: '/disputes', label: 'Disputes', icon: Scale },
  { group: 'SYSTEM' },
  { to: '/activity', label: 'Activity', icon: ActivityIcon },
];

const SCENARIOS = [
  { id: 'queue', label: 'QUEUE', color: 'text-info', ring: 'border-info/40' },
  { id: 'settled', label: 'SETTLED', color: 'text-accent', ring: 'border-accent/40' },
  { id: 'disputed', label: 'DISPUTED', color: 'text-high', ring: 'border-high/50' },
] as const;

function ScenarioSwitcher({ className }: { className?: string }) {
  const s = useShield();
  return (
    <div className={clsx('items-center rounded-lg border border-edge bg-panel p-0.5', className)} role="group" aria-label="Demo scenario">
      {SCENARIOS.map((sc) => (
        <button
          key={sc.id}
          onClick={() => s.simulate(sc.id)}
          title={`Show ${sc.label.toLowerCase()} registry state`}
          className={clsx(
            'rounded-md px-2 py-1 text-[10px] font-bold tracking-wider transition-colors',
            s.scenario === sc.id ? clsx('border', sc.ring, sc.color, 'bg-elevated') : 'text-mute hover:text-sub'
          )}
        >
          {sc.label}
        </button>
      ))}
    </div>
  );
}

export function Shell({ children }: { children: React.ReactNode }) {
  const s = useShield();
  const loc = useLocation();
  const pending = s.claims.filter((c) => c.status === 'pending').length;
  const openDisputes = s.disputes.filter((d) => !d.resolved).length;
  const banner = s.status === 'DISPUTE_OPEN' || (s.status === 'AUDITS_PENDING' && pending > 0);

  return (
    <div className="min-h-screen bg-void text-ink lg:flex">
      {/* Sidebar */}
      <aside className="hidden lg:flex w-[240px] shrink-0 flex-col border-r border-edge bg-base/80 backdrop-blur sticky top-0 h-screen">
        <Link to="/" className="flex items-center gap-2.5 px-5 pt-5 pb-4">
          <span className="grid h-9 w-9 place-items-center rounded-[10px] border border-accent/40 bg-accent/10 shadow-glow">
            <Shield size={18} className="text-accent" />
          </span>
          <span className="leading-tight">
            <span className="block text-[12.5px] font-extrabold tracking-[0.16em]">AGENTSHEILD</span>
            <span className="block text-[11px] font-semibold tracking-[0.14em] text-sub">LIABILITY REGISTRY</span>
          </span>
        </Link>

        <nav className="flex-1 overflow-y-auto px-3 pb-3" aria-label="Primary">
          {nav.map((n, i) =>
            'group' in n ? (
              <p key={i} className="meta px-2 pt-4 pb-1.5">{n.group}</p>
            ) : (
              <NavLink
                key={n.to}
                to={n.to}
                className={({ isActive }) =>
                  clsx(
                    'group flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-[13px] font-medium transition-colors border-l-2',
                    isActive
                      ? 'bg-elevated text-ink border-accent'
                      : 'text-sub hover:text-ink hover:bg-panel border-transparent'
                  )
                }
              >
                <n.icon size={15} className="shrink-0 opacity-80" />
                {n.label}
                {n.to === '/claims' && pending > 0 && (
                  <span className="ml-auto chip border-info/40 bg-info/12 text-info !px-1 !py-0">{pending}</span>
                )}
                {n.to === '/audit' && pending > 0 && <span className="ml-auto h-1.5 w-1.5 rounded-full bg-info dot-safe" />}
                {n.to === '/disputes' && openDisputes > 0 && (
                  <span className="ml-auto h-1.5 w-1.5 rounded-full bg-high dot-crit" />
                )}
              </NavLink>
            )
          )}
        </nav>

        <div className="border-t border-edge p-4 space-y-3">
          <div className="flex items-center gap-2 text-[11px]">
            <span className={clsx('h-2 w-2 rounded-full', s.status === 'OFFLINE' ? 'bg-mute' : 'bg-ok dot-safe')} />
            <div>
              <p className="font-mono font-semibold text-[10px] tracking-wider">GENLAYER STUDIONET</p>
              <p className="text-mute">{s.status === 'OFFLINE' ? 'Disconnected' : 'Contract synced'}</p>
            </div>
          </div>
        </div>
      </aside>

      <div className="flex-1 min-w-0 flex flex-col min-h-screen">
        {/* Topbar */}
        <header className="sticky top-0 z-30 border-b border-edge bg-void/85 backdrop-blur">
          <div className="flex items-center gap-3 px-4 lg:px-8 h-[56px] max-w-[1440px] mx-auto w-full">
            <Link to="/" className="lg:hidden flex items-center gap-2">
              <Shield size={16} className="text-accent" />
              <span className="text-[12px] font-extrabold tracking-[0.16em]">SHEILD</span>
            </Link>
            <p className="hidden sm:block text-[13px] font-semibold text-sub">
              {loc.pathname.startsWith('/claims/') ? 'Claim detail' : (loc.pathname.replace('/', '') || 'overview')}
            </p>
            <span className="hidden md:inline-flex items-center gap-1.5 rounded-md border border-warn/30 bg-warn/10 px-2 py-0.5 text-[10px] font-bold text-warn">
              TESTNET
            </span>

            {/* Scenario switcher (desktop) */}
            <ScenarioSwitcher className="ml-auto hidden md:flex" />

            <span className="hidden xl:block font-mono text-[11px] text-mute">Updated {s.lastCheckSec}s ago</span>
            <button onClick={() => void s.refresh()} title="Refresh registry state" className="rounded-lg border border-edge bg-panel p-2 text-sub hover:text-ink transition-colors">
              <RefreshCw size={14} className={clsx(s.loading && 'animate-spin')} />
            </button>
            <label className="hidden sm:flex items-center gap-1.5 text-[11px] text-mute cursor-pointer">
              <input type="checkbox" checked={s.autoRefresh} onChange={(e) => s.setAutoRefresh(e.target.checked)} className="accent-[#2DD4BF]" /> Auto
            </label>
            {s.wallet ? (
              <button onClick={s.disconnectWallet} className="rounded-lg border border-edge bg-elevated px-3 py-1.5 font-mono text-[11px] hover:border-accent/50" title="Disconnect">
                {s.wallet}
              </button>
            ) : (
              <button onClick={s.connectWallet} className="rounded-lg bg-ink px-3 sm:px-3.5 py-1.5 text-[12px] font-bold text-void hover:bg-white transition-colors whitespace-nowrap">
                <span className="hidden sm:inline">Connect Wallet</span>
                <span className="sm:hidden">Connect</span>
              </button>
            )}
          </div>

          {banner && (
            <div className={clsx('border-t', s.status === 'DISPUTE_OPEN' ? 'border-high/40 bg-high/10' : 'border-info/40 bg-info/10')}>
              <div className="max-w-[1440px] mx-auto px-4 lg:px-8 py-2 flex items-center gap-3 text-[12px]">
                <ShieldAlert size={15} className={clsx('shrink-0', s.status === 'DISPUTE_OPEN' ? 'text-high' : 'text-info')} />
                <p>
                  <strong className={clsx(s.status === 'DISPUTE_OPEN' ? 'text-high' : 'text-info')}>
                    {s.status === 'DISPUTE_OPEN' ? 'DISPUTE OPEN —' : `${pending} CLAIM${pending === 1 ? '' : 'S'} PENDING —`}
                  </strong>{' '}
                  <span className="text-sub">{s.headlineDetail}</span>
                </p>
                <Link
                  to={s.status === 'DISPUTE_OPEN' ? '/disputes' : '/audit'}
                  className="ml-auto font-bold hover:underline shrink-0 text-ink"
                >
                  {s.status === 'DISPUTE_OPEN' ? 'Arbitrate →' : 'Run audit →'}
                </Link>
              </div>
            </div>
          )}

          {/* mobile: scenario switcher + nav */}
          <div className="lg:hidden flex items-center gap-2 px-3 pb-2">
            <ScenarioSwitcher className="flex md:hidden shrink-0" />
            <nav className="flex gap-1 overflow-x-auto min-w-0" aria-label="Mobile">
              {nav
                .filter((n): n is Extract<NavItem, { to: string }> => 'to' in n)
                .map((n) => (
                  <NavLink
                    key={n.to}
                    to={n.to}
                    className={({ isActive }) =>
                      clsx('whitespace-nowrap rounded-md px-2.5 py-1.5 text-[11px] font-semibold', isActive ? 'bg-elevated text-ink' : 'text-mute')
                    }
                  >
                    {n.label}
                  </NavLink>
                ))}
            </nav>
          </div>
        </header>

        <main className="flex-1 w-full max-w-[1440px] mx-auto px-4 lg:px-8 py-6 pb-16">{children}</main>

        <footer className="border-t border-edge">
          <div className="max-w-[1440px] mx-auto px-4 lg:px-8 py-3 flex flex-wrap gap-2 items-center text-[11px] text-mute">
            <span className="flex items-center gap-1.5">
              <Lock size={11} /> Settlement and arbitration execute on-chain. The frontend is an observability layer.
            </span>
            <span className="ml-auto font-mono flex items-center gap-1.5">
              <ScrollText size={11} /> GenLayer Studionet · agentsheild.registry · v0.1
            </span>
          </div>
        </footer>
      </div>
    </div>
  );
}

export function PageHeader({ title, sub, actions }: { title: string; sub: string; actions?: React.ReactNode }) {
  return (
    <div className="flex flex-wrap items-start gap-3 mb-5 anim-rise">
      <div>
        <h1 className="text-[26px] lg:text-[32px] font-extrabold tracking-tight">{title}</h1>
        <p className="text-sub text-[13px] mt-1 max-w-[680px]">{sub}</p>
      </div>
      <div className="ml-auto flex items-center gap-2">{actions}</div>
    </div>
  );
}
