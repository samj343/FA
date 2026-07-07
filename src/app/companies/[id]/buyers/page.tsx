import Link from 'next/link';
import { notFound } from 'next/navigation';
import { prisma } from '@/lib/db';
import CompanyNav from '@/components/CompanyNav';
import ExcludeBuyerButton from '@/components/ExcludeBuyerButton';
import { PageTitle, TierBadge, FitBadge, ConfidenceBadge } from '@/components/ui';
import { requireMemberPage } from '@/lib/page-auth';

export const dynamic = 'force-dynamic';

export default async function BuyerUniversePage({ params }: { params: { id: string } }) {
  await requireMemberPage(params.id);
  const company = await prisma.targetCompany.findUnique({ where: { id: params.id } });
  if (!company) notFound();

  const buyers = await prisma.buyer.findMany({
    where: { companyId: params.id },
    include: { score: true, research: true },
  });
  const sorted = buyers.sort(
    (a, b) => (b.score?.weightedScore ?? -1) - (a.score?.weightedScore ?? -1)
  );
  const types = [...new Set(buyers.map((b) => b.buyerType))];

  return (
    <div>
      <PageTitle
        title={`${company.name} — Buyer Universe`}
        subtitle={`${buyers.filter((b) => !b.excluded).length} active buyers across ${types.length} categories`}
        actions={
          <a href={`/api/companies/${params.id}/export.csv`} className="btn-secondary">Export CSV</a>
        }
      />
      <CompanyNav companyId={params.id} />

      {buyers.length === 0 ? (
        <p className="text-sm text-slate-500">No buyers yet — run an analysis first.</p>
      ) : (
        <div className="card overflow-x-auto p-0">
          <table className="table-base">
            <thead>
              <tr>
                <th>Buyer</th><th>Type</th><th>Industry</th><th>Fit</th>
                <th>Rationale</th><th>Tier</th><th>Confidence</th><th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {sorted.map((b) => (
                <tr key={b.id} className={b.excluded ? 'opacity-40' : ''}>
                  <td className="font-medium">
                    <Link href={`/companies/${params.id}/buyers/${b.id}`} className="hover:underline">
                      {b.name}
                    </Link>
                  </td>
                  <td className="whitespace-nowrap">{b.buyerType}</td>
                  <td>{b.industry ?? '—'}</td>
                  <td><FitBadge fit={b.estimatedFit} /></td>
                  <td className="max-w-md text-xs text-slate-600">{b.initialRationale}</td>
                  <td><TierBadge tier={b.score?.tier} /></td>
                  <td><ConfidenceBadge value={b.research?.confidenceScore ?? null} /></td>
                  <td>
                    <ExcludeBuyerButton companyId={params.id} buyerId={b.id} excluded={b.excluded} />
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
