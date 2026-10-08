import { useMemo, useState } from 'react';
import clsx from 'clsx';
import { ChevronDown, Search, Wallet } from 'lucide-react';
import { PageHeader } from '../components/Shell';
import { StatusBadge } from '../components/StatusBadge';
import { useShield } from '../lib/shield';
import { GEN, formatGen } from '../lib/types';
import type { AgentStatus } from '../lib/types';

const FILTERS: Array<{ id: AgentStatus | 'ALL'; label: string }> = [
  { id: 'ALL', label: 'All' },
  { id: 'active', label: 'Active' },
  { id: 'paused', label: 'Paused' },
  { id: 'delisted', label: 'Delisted' },
];

export function Agents() {
  const s = useShield();
  const [q, setQ] = useState('');
  const [filter, setFilter] = useState<AgentStatus | 'ALL'>('ALL');
  const [openId, setOpenId] = useState<number | null>(null);

  const rows = useMemo(() => {
    const term = q.trim().toLowerCase();
    return s.agents.filter((a) => {
      const okFilter = filter === 'ALL' || a.status === filter;
      const okQ = !term || a.name.toLowerCase().includes(term) || a.operator.toLowerCase().includes(term) || a.policy.toLowerCase().includes(term);
      return okFilter && okQ;
    });
  }, [s.agents, q, filter]);

  const totalBond = s.agents.reduce((n, a) => n + a.bond, 0n);

  return (
    <>
      <PageHeader
        title="Agent Registry"
        sub="Registered agents, their conduct policies, liability tiers and GEN bonds. Click a row to inspect the manifest; actions are staged registry writes."
        actions={
          <div className="relative">
            <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-mute" />
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search agents…"
              className="w-[210px] rounded-lg border border-edge bg-panel pl-8 pr-3 py-2 text-[12.5px] placeholder:text-mute focus:border-accent/60 outline-none"
            />
          </div>
        }
      />

      <div className="flex items-center gap-1.5 mb-3 flex-wrap">
        {FILTERS.map((f) => (
          <button
            key={f.id}
            onClick={() => setFilter(f.id)}
            className={clsx(
              'rounded-lg border px-3 py-1.5 text-[11.5px] font-bold transition-colors',
              filter === f.id ? 'border-accent/50 bg-accent/10 text-accent' : 'border-edge bg-panel text-sub hover:text-ink'
            )}
          >
            {f.label}
            <span className="ml-1.5 font-mono text-[10.5px] text-mute">
              {f.id === 'ALL' ? s.agents.length : s.agents.filter((a) => a.status === f.id).length}
            </span>
          </button>
        ))}
        <span className="ml-auto font-mono text-[11px] text-mute">{rows.length} shown · {formatGen(totalBond)} GEN bonded</span>
      </div>

      <div className="panel overflow-hidden">
        <div className="hidden md:grid grid-cols-[1.5fr_0.8fr_0.7fr_0.9fr_1.4fr_1fr_auto] gap-3 px-4 py-2.5 border-b border-edge meta">
          <span>Agent</span><span>Status</span><span>Bond</span><span>Critical tier</span><span>Policy</span><span>Operator</span><span />
        </div>
        <ul>
          {rows.map((a) => {
            const open = openId === a.id;
            const claims = s.claims.filter((c) => c.agentId === a.id);
            const paidCount = claims.filter((c) => c.status === 'paid').length;
            const underfunded = a.bond < a.liabilities.critical;
            return (
              <li key={a.id} className="border-b border-edge last:border-0">
                <button
                  onClick={() => setOpenId(open ? null : a.id)}
                  className={clsx(
                    'w-full grid grid-cols-1 md:grid-cols-[1.5fr_0.8fr_0.7fr_0.9fr_1.4fr_1fr_auto] gap-1.5 md:gap-3 px-4 py-3 text-left items-center hover:bg-elevated/60 transition-colors',
                    open && 'bg-elevated/60'
                  )}
                  aria-expanded={open}
                >
                  <span className="flex items-center gap-2.5 min-w-0">
                    <span className="grid h-7 w-7 shrink-0 place-items-center rounded-md border border-edge bg-elevated font-mono text-[10px] font-bold text-accent">
                      {a.id}
                    </span>
                    <span className="min-w-0">
                      <span className="block text-[13px] font-semibold truncate">{a.name}</span>
                      <span className="block text-[11px] text-mute truncate">registered {a.createdAt} · {claims.length} claims</span>
                    </span>
                  </span>
                  <span><StatusBadge status={a.status} size="sm" /></span>
                  <span className={clsx('font-mono font-bold text-[13px]', underfunded ? 'text-warn' : 'text-sub')}>
                    <span className="md:hidden meta mr-2 font-sans">bond</span>{formatGen(a.bond)}
                  </span>
                  <span className="font-mono text-[12.5px] text-sub">
                    <span className="md:hidden meta mr-2 font-sans">critical</span>{formatGen(a.liabilities.critical)}
                  </span>
                  <span className="text-[12px] text-mute truncate hidden md:block">{a.policy}</span>
                  <span className="font-mono text-[11.5px] text-mute truncate">{a.operator}</span>
                  <ChevronDown size={15} className={clsx('text-mute transition-transform hidden md:block', open && 'rotate-180 text-accent')} />
                </button>

                {open && (
                  <div className="px-4 pb-4 pt-1 bg-elevated/40 grid grid-cols-1 md:grid-cols-3 gap-3 anim-rise">
                    <div className="panel p-3 md:col-span-1">
                      <p className="meta">Conduct policy</p>
                      <p className="text-[12.5px] text-sub leading-relaxed mt-2">{a.policy}</p>
                      <p className="text-[11.5px] text-mute mt-2.5 leading-snug">{a.description}</p>
                    </div>

                    <div className="panel p-3">
                      <p className="meta">Liability tiers</p>
                      <dl className="mt-2 space-y-1.5 text-[12px]">
                        {(['critical', 'high', 'medium', 'low'] as const).map((tier) => (
                          <div key={tier} className="flex justify-between">
                            <dt className="text-mute capitalize">{tier}</dt>
                            <dd className="font-mono font-bold">{formatGen(a.liabilities[tier])} GEN</dd>
                          </div>
                        ))}
                        <div className="flex justify-between border-t border-edge pt-1.5">
                          <dt className="text-mute">Bond</dt>
                          <dd className={clsx('font-mono font-bold', underfunded ? 'text-warn' : 'text-accent')}>
                            {formatGen(a.bond)} GEN {underfunded && '· underfunded'}
                          </dd>
                        </div>
                      </dl>
                    </div>

                    <div className="panel p-3">
                      <p className="meta">Stats & actions</p>
                      <dl className="mt-2 space-y-1.5 text-[12px]">
                        <div className="flex justify-between"><dt className="text-mute">Claims</dt><dd className="font-mono font-bold">{claims.length}</dd></div>
                        <div className="flex justify-between"><dt className="text-mute">Paid</dt><dd className="font-mono font-bold">{paidCount}</dd></div>
                        <div className="flex justify-between"><dt className="text-mute">Status</dt><dd className="font-mono font-bold capitalize">{a.status}</dd></div>
                      </dl>
                      <div className="flex flex-wrap gap-2 mt-3">
                        <button onClick={() => s.bondAgent(a.id, GEN(5))} className="btn-accent !py-1.5 !px-2.5 !text-[11.5px]">
                          <Wallet size={12} /> Bond +5 GEN
                        </button>
                        <button onClick={() => s.cycleAgentStatus(a.id)} className="btn-ghost !py-1.5 !px-2.5 !text-[11.5px]">
                          {a.status === 'active' ? 'Pause' : a.status === 'paused' ? 'Delist' : 'Reactivate'}
                        </button>
                      </div>
                    </div>
                  </div>
                )}
              </li>
            );
          })}
          {rows.length === 0 && (
            <li className="px-4 py-10 text-center text-[13px] text-mute">No agents match “{q}”.</li>
          )}
        </ul>
      </div>
    </>
  );
}
