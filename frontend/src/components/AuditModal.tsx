import { useEffect } from 'react';
import clsx from 'clsx';
import { CheckCircle2, Gavel, Loader2, X } from 'lucide-react';
import { AUDIT_STEPS, useShield } from '../lib/shield';

export function AuditModal({ open, onClose }: { open: boolean; onClose(): void }) {
  const s = useShield();

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open) return null;
  const done = !s.auditing && s.auditStep >= AUDIT_STEPS.length;

  return (
    <div className="fixed inset-0 z-50 grid place-items-center px-4" role="dialog" aria-modal="true" aria-label="Claim audit">
      <div className="absolute inset-0 bg-void/80 backdrop-blur-sm" onClick={onClose} />
      <div className="relative panel-elev w-full max-w-[520px] p-5 anim-rise">
        <div className="flex items-start gap-3">
          <span className="grid h-10 w-10 place-items-center rounded-lg border border-accent/40 bg-accent/10">
            {done ? <Gavel size={20} className="text-accent" /> : <Loader2 size={20} className="text-accent animate-spin" />}
          </span>
          <div className="min-w-0">
            <h2 className="text-[17px] font-extrabold tracking-tight">
              {done ? 'Audit complete' : 'Running audit_claim()'}
            </h2>
            <p className="text-[12.5px] text-sub mt-0.5">
              {done
                ? 'Consensus reached — settlement executed deterministically from the liability table.'
                : `Claim #${s.auditClaimId} · validators re-run the same prompt independently.`}
            </p>
          </div>
          <button onClick={onClose} className="ml-auto rounded-md p-1.5 text-mute hover:text-ink hover:bg-elevated" aria-label="Close">
            <X size={16} />
          </button>
        </div>

        <ol className="mt-4 space-y-2">
          {AUDIT_STEPS.map((step, i) => {
            const isDone = i < s.auditStep;
            const isActive = s.auditing && i === s.auditStep;
            return (
              <li
                key={step}
                className={clsx(
                  'flex items-center gap-2.5 rounded-lg border px-3 py-2.5 text-[12.5px] transition-colors',
                  isDone && 'border-ok/40 bg-ok/5 text-ink',
                  isActive && 'border-accent/50 bg-accent/10 text-ink',
                  !isDone && !isActive && 'border-edge bg-panel text-mute'
                )}
              >
                {isDone ? (
                  <CheckCircle2 size={15} className="text-ok shrink-0" />
                ) : isActive ? (
                  <Loader2 size={15} className="text-accent animate-spin shrink-0" />
                ) : (
                  <span className="h-3.5 w-3.5 rounded-full border border-edge shrink-0" />
                )}
                <span className={clsx(isDone && 'font-medium')}>{step}</span>
                <span className="ml-auto font-mono text-[10.5px] text-mute">{isDone ? 'ok' : isActive ? '…' : 'queued'}</span>
              </li>
            );
          })}
        </ol>

        <div className="mt-4 flex items-center gap-2 border-t border-edge pt-3.5">
          <p className="text-[11px] text-mute font-mono">prompt_comparative · 5 validators · studionet</p>
          <button onClick={onClose} className={clsx('ml-auto', done ? 'btn-primary' : 'btn-ghost')}>
            {done ? 'Close' : 'Run in background'}
          </button>
        </div>
      </div>
    </div>
  );
}
