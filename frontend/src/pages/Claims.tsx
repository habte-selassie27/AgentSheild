import { useEffect, useMemo, useState } from 'react';
import clsx from 'clsx';
import { FilePlus2, X } from 'lucide-react';
import { PageHeader } from '../components/Shell';
import { ClaimCard } from '../components/Cards';
import { useShield } from '../lib/shield';
import type { ClaimStatus, Severity } from '../lib/types';

const STATUS_FILTERS: Array<ClaimStatus | 'ALL'> = ['ALL', 'pending', 'valid', 'paid', 'invalid', 'duplicate', 'disputed'];
const SEVERITIES: Severity[] = ['info', 'low', 'medium', 'high', 'critical'];

const MIN_TITLE = 8;
const MIN_DESC = 20;
const MIN_EVIDENCE = 10;
const URI_RE = /uri:\S+/i;
const SHA_RE = /sha256:[0-9a-fA-F]{64}/;

/** Contract requires uri: link + 64-hex sha256: digest in the evidence text. */
function evidenceAnchorsOk(evidence: string): boolean {
  return URI_RE.test(evidence) && SHA_RE.test(evidence);
}

const DRAFT_KEY = 'agentsheild.claimDraft.v1';

interface ClaimDraft {
  agentId?: number;
  title?: string;
  description?: string;
  evidence?: string;
  impact?: string;
  severity?: Severity;
}

/** Draft survives page reloads so a failed/abandoned filing isn't lost. */
function loadDraft(): ClaimDraft {
  try {
    return JSON.parse(localStorage.getItem(DRAFT_KEY) ?? '{}') as ClaimDraft;
  } catch {
    return {};
  }
}

function saveDraft(d: ClaimDraft): void {
  try {
    localStorage.setItem(DRAFT_KEY, JSON.stringify(d));
  } catch {
    /* private mode / quota — draft is best-effort */
  }
}

function clearDraft(): void {
  try {
    localStorage.removeItem(DRAFT_KEY);
  } catch {
    /* ignore */
  }
}

function FileClaimModal({ open, onClose }: { open: boolean; onClose(): void }) {
  const s = useShield();
  const activeAgents = useMemo(() => s.agents.filter((a) => a.status === 'active'), [s.agents]);
  const [draft] = useState<ClaimDraft>(loadDraft);
  const [agentId, setAgentId] = useState<number>(draft.agentId ?? activeAgents[0]?.id ?? 1);
  const [title, setTitle] = useState(draft.title ?? '');
  const [description, setDescription] = useState(draft.description ?? '');
  const [evidence, setEvidence] = useState(draft.evidence ?? '');
  const [impact, setImpact] = useState(draft.impact ?? '');
  const [severity, setSeverity] = useState<Severity>(draft.severity ?? 'high');
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  // Persist every keystroke so a reload (or a failed tx) keeps the draft.
  useEffect(() => {
    const empty = !title.trim() && !description.trim() && !evidence.trim() && !impact.trim();
    if (empty) clearDraft();
    else saveDraft({ agentId, title, description, evidence, impact, severity });
  }, [agentId, title, description, evidence, impact, severity]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  useEffect(() => {
    if (open && activeAgents.length && !activeAgents.some((a) => a.id === agentId)) {
      setAgentId(activeAgents[0].id);
    }
  }, [open, activeAgents, agentId]);

  if (!open) return null;

  const titleOk = title.trim().length >= MIN_TITLE;
  const descOk = description.trim().length >= MIN_DESC;
  const evidenceOk = evidence.trim().length >= MIN_EVIDENCE && evidenceAnchorsOk(evidence);
  const canSubmit = !!s.account && !!activeAgents.length && titleOk && descOk && evidenceOk;

  const submit = async () => {
    if (!canSubmit || submitting) return;
    setSubmitting(true);
    setSubmitError(null);
    const ok = await s.fileClaim({
      agentId,
      title: title.trim(),
      description: description.trim(),
      evidence: evidence.trim(),
      impact: impact.trim() || 'impact statement pending audit',
      severity,
    });
    setSubmitting(false);
    if (!ok) {
      setSubmitError('Transaction failed — see the notice strip at the top of the page for the reason. Your input is preserved.');
      return;
    }
    setTitle(''); setDescription(''); setEvidence(''); setImpact('');
    clearDraft();
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
            <p className="text-[12.5px] text-sub mt-0.5">Deterministic intake — no LLM. Signs a real transaction.</p>
          </div>
          <button onClick={onClose} className="ml-auto rounded-md p-1.5 text-mute hover:text-ink hover:bg-elevated" aria-label="Close">
            <X size={16} />
          </button>
        </div>

        {!s.account && (
          <p className="text-[11.5px] text-warn mb-3">Connect a wallet to file a claim on chain.</p>
        )}
        {!activeAgents.length && (
          <p className="text-[11.5px] text-warn mb-3">No active agent to file against.</p>
        )}

        <div className="space-y-3">
          <div>
            <label className="meta block mb-1.5">Agent</label>
            <select value={agentId} onChange={(e) => setAgentId(Number(e.target.value))} className={input} disabled={!activeAgents.length}>
              {activeAgents.map((a) => (
                <option key={a.id} value={a.id}>#{a.id} {a.name} — bond {a.bond / 10n ** 18n} GEN</option>
              ))}
            </select>
          </div>
          <div>
            <label className="meta block mb-1.5">Title <span className="text-mute">({title.trim().length}/{MIN_TITLE} min)</span></label>
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
            <label className="meta block mb-1.5">Description <span className="text-mute">({description.trim().length}/{MIN_DESC} min)</span></label>
            <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={3} className={input} placeholder="Narrative of the incident" />
          </div>
          <div>
            <label className="meta block mb-1.5">Evidence <span className="text-mute">({evidence.trim().length}/{MIN_EVIDENCE} min)</span></label>
            <textarea value={evidence} onChange={(e) => setEvidence(e.target.value)} rows={4} className={input} placeholder="Logs, tx hashes, screenshots — must include artifact anchors:" />
            <p className="text-[10.5px] font-mono text-mute mt-1">
              required anchors: <span className="text-sub">uri:&lt;artifact link&gt;</span> · <span className="text-sub">sha256:&lt;64 hex chars&gt;</span>
              {evidence.length > 0 && !evidenceAnchorsOk(evidence) && <span className="text-warn"> — missing or malformed</span>}
            </p>
          </div>
          <div>
            <label className="meta block mb-1.5">Impact</label>
            <input value={impact} onChange={(e) => setImpact(e.target.value)} placeholder="Loss / damage caused" className={input} />
          </div>
        </div>

        {submitError && (
          <p className="mt-3 text-[11.5px] text-warn">{submitError}</p>
        )}

        <div className="mt-4 flex items-center gap-2 border-t border-edge pt-3.5">
          <p className="text-[11px] text-mute font-mono">title≥8 · desc≥20 · evidence anchors uri:/sha256: · active agent</p>
          <button onClick={submit} disabled={!canSubmit || submitting} className="btn-primary ml-auto disabled:opacity-40">
            {submitting ? 'Signing…' : 'File claim'}
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
        sub="Every incident claim against a registered agent, read from the contract: claimed vs AI-audited severity, status and payout. Select a claim to inspect the on-chain record."
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
        <div className="panel px-4 py-12 text-center text-[13px] text-mute">
          {s.claims.length ? 'No claims match these filters.' : 'No claims on chain yet.'}
        </div>
      )}

      <FileClaimModal open={filing} onClose={() => setFiling(false)} />
    </>
  );
}
