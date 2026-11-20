import React from 'react';
import { StreamHeaders } from '../../types/iptv';

/* Shared Neon-Prisma form primitives for the admin console. */

export const NeonField: React.FC<{ label: string; children: React.ReactNode; className?: string }> = ({
  label,
  children,
  className,
}) => (
  <label className={`block ${className ?? ''}`}>
    <span className="neon-label">{label}</span>
    {children}
  </label>
);

export const NeonInput: React.FC<React.InputHTMLAttributes<HTMLInputElement>> = (props) => (
  <input {...props} className={`neon-input ${props.className ?? ''}`} />
);

export const NeonTextarea: React.FC<React.TextareaHTMLAttributes<HTMLTextAreaElement>> = (props) => (
  <textarea {...props} className={`neon-input ${props.className ?? ''}`} />
);

export const NeonSelect: React.FC<React.SelectHTMLAttributes<HTMLSelectElement>> = (props) => (
  <select {...props} className={`neon-input ${props.className ?? ''}`} />
);

export const NeonToggle: React.FC<{ on: boolean; onChange: (next: boolean) => void; label?: string }> = ({
  on,
  onChange,
  label,
}) => (
  <button
    type="button"
    role="switch"
    aria-checked={on}
    aria-label={label ?? 'Toggle'}
    onClick={() => onChange(!on)}
    className={`neon-toggle ${on ? 'neon-toggle-on' : ''}`}
  />
);

/** Headers editor: normalized StreamHeaders <-> raw JSON textarea. */
export const HeadersEditor: React.FC<{
  headers: StreamHeaders;
  onChange: (next: StreamHeaders) => void;
}> = ({ headers, onChange }) => {
  const [text, setText] = React.useState(() => JSON.stringify(headers ?? {}, null, 2));
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    setText(JSON.stringify(headers ?? {}, null, 2));
  }, [headers]);

  const commit = (value: string) => {
    setText(value);
    try {
      const parsed = JSON.parse(value || '{}') as StreamHeaders;
      if (typeof parsed !== 'object' || Array.isArray(parsed)) throw new Error('Expected an object');
      setError(null);
      onChange(parsed);
    } catch (e) {
      setError((e as Error).message);
    }
  };

  return (
    <div>
      <span className="neon-label">Stream Headers (JSON)</span>
      <NeonTextarea
        rows={4}
        spellCheck={false}
        value={text}
        onChange={(e) => commit(e.target.value)}
        placeholder='{"userAgent": "...", "referer": "..."}'
        className="font-mono text-[11px] leading-relaxed"
      />
      {error && <p className="mt-1 text-[10.5px] font-semibold text-rose-300">{error}</p>}
    </div>
  );
};

export const Spinner: React.FC<{ className?: string }> = ({ className = 'w-3.5 h-3.5' }) => (
  <svg className={`animate-spin ${className}`} viewBox="0 0 24 24" fill="none" aria-hidden="true">
    <circle cx="12" cy="12" r="9" stroke="currentColor" strokeOpacity="0.25" strokeWidth="3" />
    <path d="M21 12a9 9 0 0 0-9-9" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
  </svg>
);
