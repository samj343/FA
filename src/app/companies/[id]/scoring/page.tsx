'use client';

// Buyer Scoring — editable table. Weighted score and tier are recomputed
// server-side from the configurable weights on every save.

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import CompanyNav from '@/components/CompanyNav';
import { PageTitle, TierBadge, ConfidenceBadge } from '@/components/ui';

const FIELDS = [
  ['productFit', 'Product fit', '25%'],
  ['customerOverlap', 'Cust. overlap', '15%'],
  ['marketExpansionFit', 'Mkt expansion', '15%'],
  ['mAndAHistory', 'M&A history', '15%'],
  ['financialCapacity', 'Fin. capacity', '10%'],
  ['competitivePressure', 'Comp. pressure', '10%'],
  ['integrationFeasibility', 'Integration', '10%'],
] as const;

type BuyerRow = {
  id: string;
  name: string;
  buyerType: string;
  excluded: boolean;
  score: null | ({ weightedScore: number; tier: string; rationale: string | null; keyRisk: string | null; confidenceScore: number; manuallyEdited: boolean } & Record<string, any>);
};

export default function ScoringPage() {
  const { id } = useParams<{ id: string }>();
  const [buyers, setBuyers] = useState<BuyerRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState('');

  async function load() {
    const res = await fetch(`/api/companies/${id}/buyers`);
    setBuyers(await res.json());
    setLoading(false);
  }
  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  async function saveScore(buyerId: string, field: string, value: number) {
    if (Number.isNaN(value) || value < 1 || value > 10) return;
    setSavingId(buyerId);
    await fetch(`/api/companies/${id}/buyers/${buyerId}/score`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ [field]: value }),
    });
    await load();
    setSavingId('');
  }

  const scored = buyers.filter((b) => b.score && !b.excluded);

  return (
    <div>
      <PageTitle
        title="Buyer Scoring"
        subtitle="Edit any cell (1-10). Weighted score and tier recompute automatically using your weights from Settings."
        actions={<a href={`/api/companies/${id}/export.csv`} className="btn-secondary">Export CSV</a>}
      />
      <CompanyNav companyId={id} />

      {loading ? (
        <p className="text-sm text-slate-500">Loading…</p>
      ) : scored.length === 0 ? (
        <p className="text-sm text-slate-500">No scored buyers yet — run an analysis first.</p>
      ) : (
        <div className="card overflow-x-auto p-0">
          <table className="table-base">
            <thead>
              <tr>
                <th>#</th>
                <th>Buyer</th>
                {FIELDS.map(([k, label, weight]) => (
                  <th key={k} title={`Weight ${weight}`}>{label}<br /><span className="font-normal text-slate-400">{weight}</span></th>
                ))}
                <th>Weighted</th>
                <th>Tier</th>
                <th>Conf.</th>
              </tr>
            </thead>
            <tbody>
              {scored.map((b, i) => (
                <tr key={b.id} className={savingId === b.id ? 'opacity-50' : ''}>
                  <td>{i + 1}</td>
                  <td className="whitespace-nowrap font-medium">
                    {b.name}
                    {b.score!.manuallyEdited && (
                      <span className="ml-1 text-xs text-slate-400" title="Manually edited">✎</span>
                    )}
                  </td>
                  {FIELDS.map(([k]) => (
                    <td key={k}>
                      <input
                        type="number"
                        min={1}
                        max={10}
                        defaultValue={b.score![k]}
                        className="w-14 rounded border border-slate-200 px-1.5 py-1 text-center text-sm focus:border-ink-800"
                        onBlur={(e) => {
                          const v = Number(e.target.value);
                          if (v !== b.score![k]) saveScore(b.id, k, v);
                        }}
                      />
                    </td>
                  ))}
                  <td className="font-bold">{b.score!.weightedScore.toFixed(2)}</td>
                  <td><TierBadge tier={b.score!.tier} /></td>
                  <td><ConfidenceBadge value={b.score!.confidenceScore} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <p className="mt-4 text-xs text-slate-500">
        Tier rules: Tier 1 ≥ 8.0 · Tier 2 6.5–8.0 · Tier 3 &lt; 6.5. Confidence is the evidence
        level behind the AI's scores and is separate from fit.
      </p>
    </div>
  );
}
