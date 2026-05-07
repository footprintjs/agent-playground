/**
 * HitlPauseForm — interactive form rendered in the chat panel when an
 * agent run pauses for human input.
 *
 * Pattern: human-in-the-loop. The agent's `pauseHere({question, ...})`
 * tool throws a `PauseRequest`; the runner returns a
 * `RunnerPauseOutcome { checkpoint, pauseData }` to the playground.
 * SamplePage stores the checkpoint, mounts this form with
 * `pauseData.question` as the prompt, and on Submit calls the
 * sandbox in `mode: 'resume'` with the user's answer — which
 * propagates to the paused tool's return value.
 *
 * Two answer modes (chosen by SamplePage based on pauseData shape):
 *   • free-text: user types into a textarea
 *   • yes/no:    user picks one of two buttons (when pauseData
 *                 indicates a binary approval question)
 *
 * The form is intentionally minimal — it's a teaching example of how
 * a real product's HITL UI would consume the same RunnerPauseOutcome
 * shape. Production apps replace this with their own component
 * (form fields per pauseData schema, role-gated approval, audit log,
 * etc.) using the same `(checkpoint, answer) → resume` contract.
 */

import { useState } from 'react';

export interface HitlPauseFormProps {
  /** Opaque pauseData from the agent. The form pulls `question` if
   *  present; everything else is shown as a small JSON debug strip
   *  below the prompt for the developer audience. */
  readonly pauseData: unknown;
  /** Submit handler — fires with the human's answer. SamplePage wires
   *  this to its `handleResume` callback, which re-invokes the
   *  sandbox in resume mode. */
  readonly onSubmit: (answer: unknown) => void;
  /** True while the resume call is in flight — disables the controls
   *  so the user can't double-submit. */
  readonly busy?: boolean;
}

export function HitlPauseForm({ pauseData, onSubmit, busy = false }: HitlPauseFormProps) {
  const [text, setText] = useState('');

  // Pull a renderable question from the opaque pauseData. Examples
  // ship `pauseData = { question: '…', severity: 'high' }`; real
  // apps may ship richer shapes — we just look up the conventional
  // `question` field and show JSON for everything else.
  const question = extractQuestion(pauseData);

  const submit = (answer: unknown) => {
    if (busy) return;
    onSubmit(answer);
    setText('');
  };

  return (
    <div
      style={{
        marginTop: 8,
        marginBottom: 8,
        padding: 12,
        borderRadius: 8,
        background: 'rgba(245, 158, 11, 0.08)',
        border: '1px solid rgba(245, 158, 11, 0.4)',
        fontFamily: 'ui-sans-serif, system-ui, sans-serif',
        maxWidth: 560,
      }}
    >
      <div
        style={{
          fontSize: 11,
          fontWeight: 600,
          color: '#92400e',
          textTransform: 'uppercase',
          letterSpacing: '0.08em',
          marginBottom: 6,
        }}
      >
        ⏸ Waiting on you
      </div>
      <div style={{ fontSize: 14, color: '#0f172a', marginBottom: 10, lineHeight: 1.5 }}>
        {question}
      </div>

      {/* Free-text answer + Submit. Yes/No buttons are also offered
          for the common binary approval case — most pauseHere demos
          ask Approve / Reject. */}
      <div style={{ display: 'flex', gap: 6, marginBottom: 8 }}>
        <button
          type="button"
          disabled={busy}
          onClick={() => submit('Approved')}
          style={btnStyle('approve', busy)}
        >
          Approve
        </button>
        <button
          type="button"
          disabled={busy}
          onClick={() => submit('Denied')}
          style={btnStyle('deny', busy)}
        >
          Deny
        </button>
      </div>

      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder="Or type a custom answer…"
        rows={2}
        disabled={busy}
        style={{
          width: '100%',
          boxSizing: 'border-box',
          padding: 8,
          fontSize: 13,
          fontFamily: 'inherit',
          border: '1px solid #e2e8f0',
          borderRadius: 6,
          resize: 'vertical',
          background: busy ? '#f8fafc' : '#fff',
        }}
      />
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 6 }}>
        <button
          type="button"
          disabled={busy || text.trim().length === 0}
          onClick={() => submit(text.trim())}
          style={btnStyle('submit', busy || text.trim().length === 0)}
        >
          Send answer
        </button>
      </div>

      {/* Developer strip — shows the raw pauseData shape so it's
          obvious what your UI receives from the agent. Hidden when
          pauseData is just `{ question }`. */}
      {hasExtraFields(pauseData) && (
        <details style={{ marginTop: 8, fontSize: 11, color: '#64748b' }}>
          <summary style={{ cursor: 'pointer' }}>pauseData (raw)</summary>
          <pre style={{ margin: '4px 0 0 0', whiteSpace: 'pre-wrap', fontFamily: 'ui-monospace, monospace' }}>
            {JSON.stringify(pauseData, null, 2)}
          </pre>
        </details>
      )}
    </div>
  );
}

// ── Helpers ────────────────────────────────────────────────────────

function extractQuestion(pauseData: unknown): string {
  if (pauseData && typeof pauseData === 'object') {
    const obj = pauseData as Record<string, unknown>;
    const q = obj.question ?? obj.prompt ?? obj.reason;
    if (typeof q === 'string') return q;
  }
  return 'The agent paused — please respond.';
}

function hasExtraFields(pauseData: unknown): boolean {
  if (!pauseData || typeof pauseData !== 'object') return false;
  const keys = Object.keys(pauseData as Record<string, unknown>);
  // Hide the strip when pauseData has only the question/prompt/reason key.
  if (keys.length === 0) return false;
  if (keys.length === 1 && (keys[0] === 'question' || keys[0] === 'prompt' || keys[0] === 'reason')) {
    return false;
  }
  return true;
}

function btnStyle(
  variant: 'approve' | 'deny' | 'submit',
  disabled: boolean,
): React.CSSProperties {
  const base: React.CSSProperties = {
    padding: '6px 14px',
    fontSize: 13,
    fontWeight: 500,
    fontFamily: 'inherit',
    borderRadius: 6,
    border: '1px solid transparent',
    cursor: disabled ? 'not-allowed' : 'pointer',
    opacity: disabled ? 0.5 : 1,
    transition: 'background 0.15s ease',
  };
  if (variant === 'approve') {
    return { ...base, background: '#10b981', color: '#fff' };
  }
  if (variant === 'deny') {
    return { ...base, background: '#fff', color: '#b91c1c', borderColor: '#fecaca' };
  }
  // submit
  return { ...base, background: '#f59e0b', color: '#fff' };
}
