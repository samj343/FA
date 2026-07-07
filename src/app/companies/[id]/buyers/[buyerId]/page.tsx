import Link from 'next/link';
import { notFound } from 'next/navigation';
import { prisma } from '@/lib/db';
import CompanyNav from '@/components/CompanyNav';
import { PageTitle, Section, BulletList, TierBadge, ConfidenceBadge, parseArr } from '@/components/ui';

export const dynamic = 'force-dynamic';

export default async function BuyerDetailPage({
  params,
}: {
  params: { id: string; buyerId: string };
}) {
  const buyer = await prisma.buyer.findFirst({
    where: { id: params.buyerId, companyId: params.id },
    include: { research: true, score: true, thesis: true, company: true },
  });
  if (!buyer) notFound();
  const r = buyer.research;
  const s = buyer.score;
  const t = buyer.thesis;

  return (
    <div>
      <PageTitle
        title={buyer.name}
        subtitle={`${buyer.buyerType} · ${buyer.industry ?? '—'} · target: ${buyer.company.name}`}
        actions={
          <Link href={`/companies/${params.id}/buyers`} className="btn-secondary">← Buyer universe</Link>
        }
      />
      <CompanyNav companyId={params.id} />

      <div className="mb-6 flex items-center gap-4">
        <TierBadge tier={s?.tier} />
        {s && <span className="text-2xl font-bold">{s.weightedScore.toFixed(2)}</span>}
        {r && (
          <span className="text-sm text-slate-500">
            Research confidence: <ConfidenceBadge value={r.confidenceScore} />
          </span>
        )}
      </div>

      <div className="grid grid-cols-2 gap-6">
        <Section title="Buyer overview">
          <p className="text-sm text-slate-700">{r?.companyOverview ?? buyer.initialRationale ?? 'Not researched.'}</p>
          <h3 className="mb-1 mt-3 text-xs font-bold uppercase text-slate-400">Strategic priorities</h3>
          <BulletList items={parseArr(r?.strategicPriorities)} />
        </Section>

        <Section title="Strategic rationale">
          <p className="text-sm text-slate-700">{r?.strategicFitSummary ?? '—'}</p>
          <h3 className="mb-1 mt-3 text-xs font-bold uppercase text-emerald-600">Reasons to acquire</h3>
          <BulletList items={parseArr(r?.reasonsToAcquire)} />
          <h3 className="mb-1 mt-3 text-xs font-bold uppercase text-red-500">Reasons not to acquire</h3>
          <BulletList items={parseArr(r?.reasonsNotToAcquire)} />
        </Section>

        <Section title="M&A history & news">
          <BulletList items={parseArr(r?.mAndAHistory)} empty="No M&A history recorded." />
          <h3 className="mb-1 mt-3 text-xs font-bold uppercase text-slate-400">Recent relevant news</h3>
          <BulletList items={parseArr(r?.recentRelevantNews)} empty="None recorded." />
        </Section>

        <Section title="Fit detail">
          <dl className="space-y-2 text-sm">
            <div><dt className="font-semibold text-slate-500">Product gap</dt><dd>{r?.productGap ?? '—'}</dd></div>
            <div><dt className="font-semibold text-slate-500">Customer overlap</dt><dd>{r?.customerOverlap ?? '—'}</dd></div>
            <div><dt className="font-semibold text-slate-500">Financial capacity</dt><dd>{r?.financialCapacity ?? '—'}</dd></div>
            <div><dt className="font-semibold text-slate-500">Key risk</dt><dd>{s?.keyRisk ?? '—'}</dd></div>
            <div><dt className="font-semibold text-slate-500">Recommended contact</dt><dd>{t?.bestContactType ?? '—'}</dd></div>
          </dl>
        </Section>

        <Section title="Score breakdown">
          {s ? (
            <table className="table-base">
              <tbody>
                {[
                  ['Product fit (25%)', s.productFit],
                  ['Customer overlap (15%)', s.customerOverlap],
                  ['Market expansion (15%)', s.marketExpansionFit],
                  ['M&A history (15%)', s.mAndAHistory],
                  ['Financial capacity (10%)', s.financialCapacity],
                  ['Competitive pressure (10%)', s.competitivePressure],
                  ['Integration feasibility (10%)', s.integrationFeasibility],
                ].map(([label, v]) => (
                  <tr key={String(label)}>
                    <td>{label}</td>
                    <td className="text-right font-semibold">{v}/10</td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <p className="text-sm text-slate-500">Not scored yet.</p>
          )}
          {s?.rationale && <p className="mt-3 text-xs text-slate-600">{s.rationale}</p>}
        </Section>

        <Section title="Evidence">
          <BulletList items={parseArr(r?.evidence)} empty="No evidence recorded — external verification required." />
        </Section>

        {t && (
          <div className="col-span-2">
            <Section title="Acquisition thesis">
              <p className="text-sm leading-relaxed text-slate-700">{t.acquisitionThesis}</p>
              <p className="mt-2 text-xs text-slate-500">
                Full thesis with synergies and objections on the <Link className="underline" href={`/companies/${params.id}/theses`}>Theses tab</Link>.
              </p>
            </Section>
          </div>
        )}
      </div>
    </div>
  );
}
