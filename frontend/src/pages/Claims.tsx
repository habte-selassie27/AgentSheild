import { useEffect, useMemo, useState } from 'react';
import clsx from 'clsx';
import { FilePlus2, X } from 'lucide-react';
import { PageHeader } from '../components/Shell';
import { ClaimCard } from '../components/Cards';
import { useShield } from '../lib/shield';
import type { ClaimStatus, Severity } from '../lib/types';

const STATUS_FILTERS: Array<ClaimStatus | 'ALL'> = ['ALL', 'pending', 'valid', 'paid', 'invalid', 'duplicate', 'disputed'];
const SEVERITIES: Severity[] = ['info', 'low', 'medium', 'high', 'critical'];

function FileClaimModal({ open, onClose }: { open: boolean; onClose(): void }) {
  const s = useShield();
  const [agentId, setAgentId] = useState(s.agents[0]?.id ?? 1);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [evidence, setEvidence] = useState('');
  const [impact, setImpact] = useState('');
  const [severity, setSeverity] = useState<Severity>('high');

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open) return null;

  const submit = () => {
    if (!title.trim()) return;
    s.fileClaim({
      agentId, title: title.trim(),
      description: description.trim() || 'Filed from the console; full narrative recorded on-chain.',
      evidence: evidence.trim() || 'claimant-submitted evidence attached to tx',
      impact: impact.trim() || 'impact statement pending audit',
      severity,
    });
    setTitle(''); setDescription(''); setEvidence(''); setImpact('');
    onClose();
  };

  const input = 'w-full rounded-lg border border-edge bg-elevated px-3 py-2 text-[12.5px] placeholder:text-mute focus:border-accent/60 outline-none';

  return (
    <div className="fixed inset-0 z-50 grid place-items-center px-4" role="dialog" aria-modal="true" aria-label="File claim">
      <div className="absolute inset-0 bg-void/80 backdrop-blur-sm" onClick={onClose} />
      <div className="relative panel-elev w-full max-w-[520px] p-5 anim-rise max-h-[90vh] overflow-y-auto">
        <div className="flex items-start gap-3 mb-4">
          <span className="grid h-10 w-10 place-items-center rounded-lg border border-accent/40 bg-accent/10">
            <FilePlus2 size={18} className="text-accent" />
          </span>
          <div>
            <h2 className="text-[17px] font-extrabold tracking-tight">file_claim()</h2>
            <p className="text-[12.5px] text-sub mt-0.5">Deterministic intake — no LLM, lands on-chain immediately.</p>
          </div>
          <button onClick={onClose} className="ml-auto rounded-md p-1.5 text-mute hover:text-ink hover:bg-elevated" aria-label="Close">
            <X size={16} />
          </button>
        </div>

        <div className="space-y-3">
          <div>
            <label className="meta block mb-1.5">Agent</label>
            <select value={agentId} onChange={(e) => setAgentId(Number(e.target.value))} className={input}>
              {s.agents.map((a) => (
                <option key={a.id} value={a.id}>#{a.id} {a.name} — bond {a.bond / 10n ** 18n} GEN</option>
              ))}
            </select>
          </div>
          <div>
            <label className="meta block mb-1.5">Title</label>
            <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="What went wrong" className={input} />
          </div>
          <div>
            <label className="meta block mb-1.5">Severity (claimed)</label>
            <div className="flex gap-1.5 flex-wrap">
              {SEVERITIES.map((sv) => (
                <button
                  key={sv}
                  onClick={() => setSeverity(sv)}
                  className={clsx(
                    'rounded-lg border px-2.5 py-1.5 text-[11.5px] font-bold capitalize transition-colors',
                    severity === sv ? 'border-accent/50 bg-accent/10 text-accent' : 'border-edge bg-panel text-sub hover:text-ink'
                  )}
                >
                  {sv}
                </button>
              ))}
            </div>
          </div>
          <div>
            <label className="meta block mb-1.5">Description</label>
            <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={2} className={input} placeholder="Narrative of the incident" />
          </div>
          <div>
            <label className="meta block mb-1.5">Evidence</label>
            <textarea value={evidence} onChange={(e) => setEvidence(e.target.value)} rows={2} className={input} placeholder="Logs, tx hashes, screenshots" />
          </div>
          <div>
            <label className="meta block mb-1.5">Impact</label>
            <input value={impact} onChange={(e) => setImpact(e.target.value)} placeholder="Loss / damage caused" className={input} />
          </div>
        </div>

        <div className="mt-4 flex items-center gap-2 border-t border-edge pt-3.5">
          <p className="text-[11px] text-mute font-mono">returns cid · payout ≤ agent tier</p>
          <button onClick={submit} disabled={!title.trim()} className="btn-primary ml-auto disabled:opacity-40">
            File claim
          </button>
        </div>
      </div>
    </div>
  );
}

export function Claims() {
  const s = useShield();
  const [status, setStatus] = useState<ClaimStatus | 'ALL'>('ALL');
  const [sev, setSev] = useState<Severity | 'ALL'>('ALL');
  const [filing, setFiling] = useState(false);

  const rows = useMemo(
    () => s.claims.filter((c) => (status === 'ALL' || c.status === status) && (sev === 'ALL' || c.severityClaimed === sev)),
    [s.claims, status, sev]
  );

  const chip = (active: boolean) =>
    clsx(
      'rounded-lg border px-2.5 py-1.5 text-[11.5px] font-bold transition-colors capitalize',
      active ? 'border-accent/50 bg-accent/10 text-accent' : 'border-edge bg-panel text-sub hover:text-ink'
    );

  return (
    <>
      <PageHeader
        title="Claims"
        sub="Every incident claim against a registered agent: claimed vs AI-audited severity, decision and payout. Select a claim to inspect evidence, the audit round and settlement."
        actions={
          <>
            <span className="font-mono text-[11.5px] text-mute self-center">{rows.length} / {s.claims.length} shown</span>
            <button onClick={() => setFiling(true)} className="btn-primary"><FilePlus2 size={13} /> File claim</button>
          </>
        }
      />

      <div className="panel p-3.5 mb-3 space-y-2.5">
        <div className="flex items-center gap-1.5 flex-wrap">
          <span className="meta w-[64px]">Status</span>
          {STATUS_FILTERS.map((f) => (
            <button key={f} onClick={() => setStatus(f)} className={chip(status === f)}>
              {f === 'ALL' ? 'All' : f}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-1.5 flex-wrap">
          <span className="meta w-[64px]">Severity</span>
          <button onClick={() => setSev('ALL')} className={chip(sev === 'ALL')}>All</button>
          {SEVERITIES.map((f) => (
            <button key={f} onClick={() => setSev(f)} className={chip(sev === f)}>{f}</button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {rows.map((c) => <ClaimCard key={c.id} claim={c} />)}
      </div>
      {rows.length === 0 && (
        <div className="panel px-4 py-12 text-center text-[13px] text-mute">No claims match these filters.</div>
      )}

      <FileClaimModal open={filing} onClose={() => setFiling(false)} />
    </>
  );
}
