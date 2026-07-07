'use client';

// Comparable-transactions library. Matching entries (by sector keywords) are
// fed to the Valuation agent on every analysis run. Mark fictional or
// unverified entries as "illustrative" so they are labelled in output.

import { useEffect, useState } from 'react';
import { PageTitle } from '@/components/ui';

type Comp = {
  id: string;
  acquirer: string;
  target: string;
  sector: string;
  announcedYear: number | null;
  enterpriseValue: string | null;
  revenueOrArr: string | null;
  multiple: string | null;
  dealType: string | null;
  source: string | null;
  notes: string | null;
  illustrative: boolean;
};

const EMPTY = {
  acquirer: '', target: '', sector: '', announcedYear: '', enterpriseValue: '',
  revenueOrArr: '', multiple: '', dealType: '', source: '', notes: '', illustrative: false,
};

export default function CompsPage() {
  const [comps, setComps] = useState<Comp[]>([]);
  const [form, setForm] = useState({ ...EMPTY });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  async function load() {
    const res = await fetch('/api/comps');
    if (res.ok) setComps(await res.json());
    setLoading(false);
  }
  useEffect(() => {
    load();
  }, []);

  async function add(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    const res = await fetch('/api/comps', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ...form,
        announcedYear: form.announcedYear ? Number(form.announcedYear) : undefined,
      }),
    });
    if (!res.ok) setError('Could not save — acquirer, target, and sector are required.');
    else setForm({ ...EMPTY });
    await load();
  }

  async function remove(id: string) {
    await fetch('/api/comps', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id }),
    });
    await load();
  }

  const set = (k: keyof typeof EMPTY) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm({ ...form, [k]: e.target.value });

  return (
    <div>
      <PageTitle
        title="Comparable Deals"
        subtitle="Your comps library. Sector-matched entries are supplied to the Valuation agent on every run — illustrative entries are labelled as such in output."
      />

      <div className="card mb-6">
        <h2 className="mb-3 text-sm font-bold uppercase tracking-wide text-slate-500">Add a comparable transaction</h2>
        <form onSubmit={add} className="grid grid-cols-4 gap-3">
          <input required className="input" placeholder="Acquirer *" value={form.acquirer} onChange={set('acquirer')} />
          <input required className="input" placeholder="Target *" value={form.target} onChange={set('target')} />
          <input required className="input" placeholder="Sector *" value={form.sector} onChange={set('sector')} />
          <input className="input" placeholder="Year" value={form.announcedYear} onChange={set('announcedYear')} />
          <input className="input" placeholder="EV (e.g. $120M)" value={form.enterpriseValue} onChange={set('enterpriseValue')} />
          <input className="input" placeholder="Revenue/ARR" value={form.revenueOrArr} onChange={set('revenueOrArr')} />
          <input className="input" placeholder="Multiple (e.g. 8x ARR)" value={form.multiple} onChange={set('multiple')} />
          <input className="input" placeholder="Deal type" value={form.dealType} onChange={set('dealType')} />
          <input className="input col-span-2" placeholder="Source (press release, filing…)" value={form.source} onChange={set('source')} />
          <input className="input col-span-2" placeholder="Notes" value={form.notes} onChange={set('notes')} />
          <label className="flex items-center gap-2 text-sm text-slate-600">
            <input
              type="checkbox"
              checked={form.illustrative}
              onChange={(e) => setForm({ ...form, illustrative: e.target.checked })}
            />
            Illustrative / unverified
          </label>
          <button type="submit" className="btn-primary col-start-4 justify-center">Add comp</button>
        </form>
        {error && <p className="mt-2 rounded-lg bg-red-50 p-2 text-xs text-red-700">{error}</p>}
      </div>

      {loading ? (
        <p className="text-sm text-slate-500">Loading…</p>
      ) : comps.length === 0 ? (
        <p className="text-sm text-slate-500">No comps yet — add real transactions as you research them.</p>
      ) : (
        <div className="card overflow-x-auto p-0">
          <table className="table-base">
            <thead>
              <tr>
                <th>Acquirer</th><th>Target</th><th>Sector</th><th>Year</th>
                <th>EV</th><th>Rev/ARR</th><th>Multiple</th><th>Type</th><th>Source</th><th></th>
              </tr>
            </thead>
            <tbody>
              {comps.map((c) => (
                <tr key={c.id}>
                  <td className="font-medium">{c.acquirer}</td>
                  <td>{c.target}</td>
                  <td>{c.sector}</td>
                  <td>{c.announcedYear ?? '—'}</td>
                  <td>{c.enterpriseValue ?? '—'}</td>
                  <td>{c.revenueOrArr ?? '—'}</td>
                  <td>{c.multiple ?? '—'}</td>
                  <td>
                    {c.dealType ?? '—'}
                    {c.illustrative && (
                      <span className="ml-1 rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-semibold text-amber-800">
                        illustrative
                      </span>
                    )}
                  </td>
                  <td className="max-w-[180px] truncate text-xs text-slate-500" title={c.source ?? ''}>{c.source ?? '—'}</td>
                  <td>
                    <button className="text-xs text-red-600 hover:underline" onClick={() => remove(c.id)}>delete</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
