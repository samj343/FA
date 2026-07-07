'use client';

// Settings — scoring weights, outreach tone, confidentiality, exclusions.
// Weight changes recompute every stored weighted score server-side.

import { useEffect, useState } from 'react';
import { PageTitle } from '@/components/ui';

const WEIGHTS: [string, string][] = [
  ['weightProductFit', 'Product fit'],
  ['weightCustomerOverlap', 'Customer overlap'],
  ['weightMarketExpansion', 'Market expansion fit'],
  ['weightMAndAHistory', 'M&A history'],
  ['weightFinancialCapacity', 'Financial capacity'],
  ['weightCompetitivePressure', 'Competitive pressure'],
  ['weightIntegration', 'Integration feasibility'],
];

export default function SettingsPage() {
  const [settings, setSettings] = useState<Record<string, any> | null>(null);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    fetch('/api/settings').then((r) => r.json()).then(setSettings);
  }, []);

  if (!settings) return <p className="text-sm text-slate-500">Loading…</p>;

  const weightSum = WEIGHTS.reduce((acc, [k]) => acc + Number(settings[k] ?? 0), 0);

  async function save() {
    setError('');
    setSaved(false);
    const payload: Record<string, unknown> = {};
    for (const [k] of WEIGHTS) payload[k] = Number(settings![k]);
    payload.outreachTone = settings!.outreachTone;
    payload.confidentialityLevel = settings!.confidentialityLevel;
    payload.minScoreThreshold = Number(settings!.minScoreThreshold ?? 0);
    payload.globalExcludedBuyers = String(settings!.globalExcludedBuyersText ?? parseStored())
      .split(',').map((s: string) => s.trim()).filter(Boolean);
    const res = await fetch('/api/settings', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    if (!res.ok) setError('Save failed — check weight values (0-1).');
    else setSaved(true);
  }

  function parseStored(): string {
    try {
      const v = JSON.parse(settings!.globalExcludedBuyers ?? '[]');
      return Array.isArray(v) ? v.join(', ') : '';
    } catch {
      return '';
    }
  }

  return (
    <div className="mx-auto max-w-2xl">
      <PageTitle title="Settings" subtitle="Defaults applied to every analysis. Changing weights re-ranks all scored buyers." />

      <div className="card space-y-6">
        <div>
          <h2 className="mb-3 text-sm font-bold uppercase tracking-wide text-slate-500">Scoring weights</h2>
          <div className="grid grid-cols-2 gap-3">
            {WEIGHTS.map(([key, label]) => (
              <div key={key} className="flex items-center justify-between gap-3">
                <span className="text-sm">{label}</span>
                <input
                  type="number" step="0.05" min="0" max="1"
                  className="input w-24 text-right"
                  value={settings[key]}
                  onChange={(e) => setSettings({ ...settings, [key]: e.target.value })}
                />
              </div>
            ))}
          </div>
          <p className={`mt-2 text-xs ${Math.abs(weightSum - 1) < 0.001 ? 'text-slate-500' : 'text-amber-600'}`}>
            Weights sum to {weightSum.toFixed(2)} {Math.abs(weightSum - 1) >= 0.001 && '— consider normalizing to 1.00'}
          </p>
        </div>

        <div className="grid grid-cols-3 gap-4">
          <div>
            <label className="label">Outreach tone</label>
            <select className="input" value={settings.outreachTone}
              onChange={(e) => setSettings({ ...settings, outreachTone: e.target.value })}>
              <option value="banker">Banker-style</option>
              <option value="warm">Warm</option>
              <option value="direct">Direct</option>
            </select>
          </div>
          <div>
            <label className="label">Confidentiality level</label>
            <select className="input" value={settings.confidentialityLevel}
              onChange={(e) => setSettings({ ...settings, confidentialityLevel: e.target.value })}>
              <option value="high">High</option>
              <option value="medium">Medium</option>
              <option value="low">Low</option>
            </select>
          </div>
          <div>
            <label className="label">Min score threshold</label>
            <input type="number" step="0.5" min="0" max="10" className="input"
              value={settings.minScoreThreshold ?? 0}
              onChange={(e) => setSettings({ ...settings, minScoreThreshold: e.target.value })} />
          </div>
        </div>

        <div>
          <label className="label">Globally excluded buyers (comma-separated)</label>
          <input className="input"
            defaultValue={parseStored()}
            onChange={(e) => setSettings({ ...settings, globalExcludedBuyersText: e.target.value })}
            placeholder="Names that should never appear in any buyer list" />
        </div>

        {error && <p className="rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</p>}
        {saved && <p className="rounded-lg bg-emerald-50 p-3 text-sm text-emerald-700">Saved. Scores re-ranked.</p>}
        <button onClick={save} className="btn-primary">Save settings</button>
      </div>
    </div>
  );
}
