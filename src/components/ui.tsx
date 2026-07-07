// Small shared presentation helpers (server-component safe).

export function PageTitle({ title, subtitle, actions }: { title: string; subtitle?: string; actions?: React.ReactNode }) {
  return (
    <div className="mb-6 flex items-start justify-between gap-4">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">{title}</h1>
        {subtitle && <p className="mt-1 text-sm text-slate-500">{subtitle}</p>}
      </div>
      {actions && <div className="flex shrink-0 gap-2">{actions}</div>}
    </div>
  );
}

export function TierBadge({ tier }: { tier?: string | null }) {
  if (!tier) return <span className="text-slate-400">—</span>;
  const styles: Record<string, string> = {
    'Tier 1': 'bg-emerald-100 text-emerald-800',
    'Tier 2': 'bg-amber-100 text-amber-800',
    'Tier 3': 'bg-slate-100 text-slate-600',
  };
  return (
    <span className={`inline-block rounded-full px-2 py-0.5 text-xs font-semibold ${styles[tier] ?? 'bg-slate-100 text-slate-600'}`}>
      {tier}
    </span>
  );
}

export function FitBadge({ fit }: { fit?: string | null }) {
  const styles: Record<string, string> = {
    High: 'bg-emerald-100 text-emerald-800',
    Medium: 'bg-amber-100 text-amber-800',
    Low: 'bg-slate-100 text-slate-600',
  };
  return (
    <span className={`inline-block rounded-full px-2 py-0.5 text-xs font-semibold ${styles[fit ?? ''] ?? 'bg-slate-100 text-slate-600'}`}>
      {fit ?? '—'}
    </span>
  );
}

/** Confidence badge with the spec's rubric colors. */
export function ConfidenceBadge({ value }: { value?: number | null }) {
  if (value === null || value === undefined) return <span className="text-slate-400">—</span>;
  const color =
    value >= 90 ? 'bg-emerald-100 text-emerald-800'
    : value >= 70 ? 'bg-lime-100 text-lime-800'
    : value >= 50 ? 'bg-amber-100 text-amber-800'
    : 'bg-red-100 text-red-700';
  return (
    <span className={`inline-block rounded-full px-2 py-0.5 text-xs font-semibold ${color}`} title="90+: strong evidence · 70-89: reasonable · 50-69: directional · <50: speculative">
      {value}/100
    </span>
  );
}

export function StatusBadge({ status }: { status: string }) {
  const styles: Record<string, string> = {
    'Needs Review': 'bg-amber-100 text-amber-800',
    Approved: 'bg-emerald-100 text-emerald-800',
    Rejected: 'bg-red-100 text-red-700',
    Sent: 'bg-blue-100 text-blue-800',
    Draft: 'bg-slate-100 text-slate-600',
    Interested: 'bg-emerald-100 text-emerald-800',
    'Not Interested': 'bg-slate-200 text-slate-600',
    'NDA Requested': 'bg-violet-100 text-violet-800',
    'Intro Call Scheduled': 'bg-blue-100 text-blue-800',
    'Follow-up Needed': 'bg-orange-100 text-orange-800',
  };
  return (
    <span className={`inline-block rounded-full px-2 py-0.5 text-xs font-semibold ${styles[status] ?? 'bg-slate-100 text-slate-600'}`}>
      {status}
    </span>
  );
}

export function BulletList({ items, empty = 'None recorded.' }: { items: string[]; empty?: string }) {
  if (!items.length) return <p className="text-sm italic text-slate-400">{empty}</p>;
  return (
    <ul className="list-disc space-y-1 pl-5 text-sm text-slate-700">
      {items.map((item, i) => (
        <li key={i}>{item}</li>
      ))}
    </ul>
  );
}

export function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="card">
      <h2 className="mb-3 text-sm font-bold uppercase tracking-wide text-slate-500">{title}</h2>
      {children}
    </section>
  );
}

export function parseArr(s: string | null | undefined): string[] {
  if (!s) return [];
  try {
    const v = JSON.parse(s);
    return Array.isArray(v) ? v.map(String) : [];
  } catch {
    return [];
  }
}
