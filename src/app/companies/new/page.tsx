'use client';

// New Company Analysis — create the company, optionally upload a deck, kick
// off the pipeline, and show live step-by-step progress.

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { PageTitle } from '@/components/ui';

type Step = { key: string; label: string; status: 'pending' | 'running' | 'done' | 'error' };

export default function NewCompanyPage() {
  const router = useRouter();
  const [form, setForm] = useState({
    name: '',
    website: '',
    description: '',
    sector: '',
    financialNotes: '',
    customerNotes: '',
    founderNotes: '',
    marketNotes: '',
    preferredBuyerTypes: '',
    excludedBuyers: '',
    confidentialityLevel: 'high',
  });
  const [file, setFile] = useState<File | null>(null);
  const [phase, setPhase] = useState<'form' | 'submitting' | 'running' | 'error'>('form');
  const [error, setError] = useState('');
  const [steps, setSteps] = useState<Step[]>([]);
  const companyIdRef = useRef<string>('');

  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) =>
    setForm({ ...form, [k]: e.target.value });

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setPhase('submitting');
    try {
      // 1. Create the company
      const res = await fetch('/api/companies', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...form,
          excludedBuyers: form.excludedBuyers.split(',').map((s) => s.trim()).filter(Boolean),
        }),
      });
      if (!res.ok) throw new Error((await res.json()).error?.formErrors?.join(', ') || 'Failed to create company');
      const company = await res.json();
      companyIdRef.current = company.id;

      // 2. Upload deck if provided
      if (file) {
        const fd = new FormData();
        fd.append('file', file);
        const up = await fetch(`/api/companies/${company.id}/upload-deck`, { method: 'POST', body: fd });
        if (!up.ok) throw new Error((await up.json()).error || 'Deck upload failed');
      }

      // 3. Run the pipeline
      const run = await fetch(`/api/companies/${company.id}/run-analysis`, { method: 'POST' });
      if (!run.ok) throw new Error('Failed to start analysis');
      setPhase('running');
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      setPhase(companyIdRef.current ? 'error' : 'form');
    }
  }

  // Poll run status while the pipeline executes.
  useEffect(() => {
    if (phase !== 'running') return;
    const id = setInterval(async () => {
      const res = await fetch(`/api/companies/${companyIdRef.current}/analysis-status`);
      if (!res.ok) return;
      const data = await res.json();
      setSteps(data.steps ?? []);
      if (data.status === 'done') {
        clearInterval(id);
        router.push(`/companies/${companyIdRef.current}`);
      } else if (data.status === 'error') {
        clearInterval(id);
        setError(data.error || 'Analysis failed');
        setPhase('error');
      }
    }, 1200);
    return () => clearInterval(id);
  }, [phase, router]);

  if (phase === 'running' || (phase === 'error' && steps.length)) {
    return (
      <div className="mx-auto max-w-xl">
        <PageTitle title="Running analysis" subtitle="The agent pipeline is working through your materials." />
        <div className="card space-y-2">
          {steps.map((s) => (
            <div key={s.key} className="flex items-center gap-3 text-sm">
              <span className="w-5 text-center">
                {s.status === 'done' ? '✓' : s.status === 'running' ? '…' : s.status === 'error' ? '✕' : '·'}
              </span>
              <span className={
                s.status === 'done' ? 'text-emerald-700'
                : s.status === 'running' ? 'font-semibold text-slate-900'
                : s.status === 'error' ? 'text-red-600'
                : 'text-slate-400'
              }>
                {s.label}
              </span>
            </div>
          ))}
        </div>
        {error && <p className="mt-4 rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</p>}
        {phase === 'error' && companyIdRef.current && (
          <button className="btn-secondary mt-4" onClick={() => router.push(`/companies/${companyIdRef.current}`)}>
            View partial results
          </button>
        )}
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl">
      <PageTitle
        title="New Company Analysis"
        subtitle="Provide whatever you have — the pipeline flags what's missing rather than inventing it."
      />
      <form onSubmit={onSubmit} className="card space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="label">Company name *</label>
            <input required className="input" value={form.name} onChange={set('name')} placeholder="ExampleAI" />
          </div>
          <div>
            <label className="label">Website</label>
            <input className="input" value={form.website} onChange={set('website')} placeholder="https://exampleai.com" />
          </div>
        </div>
        <div>
          <label className="label">Company description</label>
          <textarea className="input" rows={3} value={form.description} onChange={set('description')}
            placeholder="AI customer support automation for mid-market SaaS companies…" />
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="label">Sector (optional hint)</label>
            <input className="input" value={form.sector} onChange={set('sector')} placeholder="Customer support software" />
          </div>
          <div>
            <label className="label">Pitch deck (PDF)</label>
            <input type="file" accept="application/pdf" className="input"
              onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
          </div>
        </div>
        <div>
          <label className="label">Financial metrics / notes</label>
          <textarea className="input" rows={2} value={form.financialNotes} onChange={set('financialNotes')}
            placeholder="$2.1M ARR, 80% YoY growth, 78% gross margin, ~$90k monthly burn" />
        </div>
        <div>
          <label className="label">Customer information</label>
          <textarea className="input" rows={2} value={form.customerNotes} onChange={set('customerNotes')} />
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="label">Founder notes</label>
            <textarea className="input" rows={2} value={form.founderNotes} onChange={set('founderNotes')} />
          </div>
          <div>
            <label className="label">Market notes</label>
            <textarea className="input" rows={2} value={form.marketNotes} onChange={set('marketNotes')} />
          </div>
        </div>
        <div className="grid grid-cols-3 gap-4">
          <div>
            <label className="label">Preferred buyer types</label>
            <input className="input" value={form.preferredBuyerTypes} onChange={set('preferredBuyerTypes')}
              placeholder="Strategics, PE platforms" />
          </div>
          <div>
            <label className="label">Excluded buyers (comma-sep)</label>
            <input className="input" value={form.excludedBuyers} onChange={set('excludedBuyers')}
              placeholder="Competitor X, Fund Y" />
          </div>
          <div>
            <label className="label">Confidentiality</label>
            <select className="input" value={form.confidentialityLevel} onChange={set('confidentialityLevel')}>
              <option value="high">High — fully anonymous outreach</option>
              <option value="medium">Medium</option>
              <option value="low">Low</option>
            </select>
          </div>
        </div>
        {error && <p className="rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</p>}
        <button type="submit" disabled={phase === 'submitting'} className="btn-primary w-full justify-center">
          {phase === 'submitting' ? 'Starting…' : 'Run Analysis'}
        </button>
      </form>
    </div>
  );
}
