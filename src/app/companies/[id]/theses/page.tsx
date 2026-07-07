'use client';

// Acquisition Theses — buyer-specific theses with inline editing.

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import CompanyNav from '@/components/CompanyNav';
import { PageTitle, TierBadge } from '@/components/ui';

type BuyerWithThesis = {
  id: string;
  name: string;
  buyerType: string;
  score: { tier: string; weightedScore: number } | null;
  thesis: Record<string, any> | null;
};

const EDITABLE: [string, string][] = [
  ['acquisitionThesis', 'Acquisition thesis'],
  ['productSynergy', 'Product synergy'],
  ['revenueSynergy', 'Revenue synergy'],
  ['customerSynergy', 'Customer synergy'],
  ['technologySynergy', 'Technology synergy'],
  ['competitiveRationale', 'Competitive rationale'],
  ['integrationPath', 'Integration path'],
  ['recommendedOutreachAngle', 'Recommended outreach angle'],
  ['bestContactType', 'Best contact type'],
];

function parseArr(s: unknown): string[] {
  if (typeof s !== 'string') return [];
  try {
    const v = JSON.parse(s);
    return Array.isArray(v) ? v.map(String) : [];
  } catch {
    return [];
  }
}

export default function ThesesPage() {
  const { id } = useParams<{ id: string }>();
  const [buyers, setBuyers] = useState<BuyerWithThesis[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState('');

  useEffect(() => {
    fetch(`/api/companies/${id}/buyers`)
      .then((r) => r.json())
      .then((data) => {
        setBuyers(data.filter((b: BuyerWithThesis) => b.thesis));
        setLoading(false);
      });
  }, [id]);

  async function saveField(buyerId: string, field: string, value: string) {
    setSaving(buyerId + field);
    await fetch(`/api/companies/${id}/buyers/${buyerId}/thesis`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ [field]: value }),
    });
    setSaving('');
  }

  return (
    <div>
      <PageTitle
        title="Acquisition Theses"
        subtitle="Buyer-specific theses for Tier 1 / Tier 2 buyers. Click into any field to edit — changes save on blur."
      />
      <CompanyNav companyId={id} />

      {loading ? (
        <p className="text-sm text-slate-500">Loading…</p>
      ) : buyers.length === 0 ? (
        <p className="text-sm text-slate-500">No theses yet — run an analysis first.</p>
      ) : (
        <div className="space-y-6">
          {buyers.map((b) => (
            <div key={b.id} className="card">
              <div className="mb-3 flex items-center gap-3">
                <h2 className="text-lg font-bold">{b.name}</h2>
                <TierBadge tier={b.score?.tier} />
                <span className="text-sm text-slate-500">{b.buyerType}</span>
              </div>
              <div className="grid grid-cols-2 gap-4">
                {EDITABLE.map(([field, label]) => (
                  <div key={field} className={field === 'acquisitionThesis' ? 'col-span-2' : ''}>
                    <label className="label">
                      {label} {saving === b.id + field && <span className="text-amber-600">saving…</span>}
                    </label>
                    <textarea
                      className="input"
                      rows={field === 'acquisitionThesis' ? 3 : 2}
                      defaultValue={b.thesis?.[field] ?? ''}
                      onBlur={(e) => {
                        if (e.target.value !== (b.thesis?.[field] ?? '')) {
                          saveField(b.id, field, e.target.value);
                        }
                      }}
                    />
                  </div>
                ))}
              </div>
              <div className="mt-4 grid grid-cols-2 gap-4 text-sm">
                <div>
                  <h3 className="mb-1 text-xs font-bold uppercase text-red-500">Potential objections</h3>
                  <ul className="list-disc pl-5 text-slate-700">
                    {parseArr(b.thesis?.potentialObjections).map((o, i) => <li key={i}>{o}</li>)}
                  </ul>
                </div>
                <div>
                  <h3 className="mb-1 text-xs font-bold uppercase text-emerald-600">Responses</h3>
                  <ul className="list-disc pl-5 text-slate-700">
                    {parseArr(b.thesis?.objectionResponses).map((o, i) => <li key={i}>{o}</li>)}
                  </ul>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
