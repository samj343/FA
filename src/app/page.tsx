import Link from 'next/link';
import { prisma } from '@/lib/db';
import { PageTitle, StatusBadge } from '@/components/ui';
import { requireUserPage } from '@/lib/page-auth';

export const dynamic = 'force-dynamic';

export default async function DashboardPage() {
  const user = await requireUserPage();
  const memberOf = { members: { some: { userId: user.id } } };
  const [companies, buyerCount, tier1Count, reportCount, outreach] = await Promise.all([
    prisma.targetCompany.findMany({
      where: memberOf,
      orderBy: { createdAt: 'desc' },
      take: 10,
      include: {
        _count: { select: { buyers: true, reports: true } },
        runs: { orderBy: { createdAt: 'desc' }, take: 1 },
      },
    }),
    prisma.buyer.count({ where: { company: memberOf } }),
    prisma.buyerScore.count({ where: { tier: 'Tier 1', buyer: { company: memberOf } } }),
    prisma.report.count({ where: { company: memberOf } }),
    prisma.outreachMessage.groupBy({
      by: ['status'],
      _count: true,
      where: { company: memberOf },
    }),
  ]);

  const stats = [
    { label: 'Target companies', value: companies.length },
    { label: 'Buyers identified', value: buyerCount },
    { label: 'Tier 1 buyers', value: tier1Count },
    { label: 'Reports generated', value: reportCount },
  ];

  return (
    <div>
      <PageTitle
        title="Dashboard"
        subtitle="AI-assisted buyer discovery — every output requires advisor review before use."
        actions={<Link href="/companies/new" className="btn-primary">+ New Company Analysis</Link>}
      />

      <div className="mb-6 grid grid-cols-4 gap-4">
        {stats.map((s) => (
          <div key={s.label} className="card">
            <div className="text-3xl font-bold text-slate-900">{s.value}</div>
            <div className="mt-1 text-xs font-semibold uppercase tracking-wide text-slate-500">{s.label}</div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-3 gap-6">
        <div className="card col-span-2">
          <h2 className="mb-3 text-sm font-bold uppercase tracking-wide text-slate-500">Recent target companies</h2>
          {companies.length === 0 ? (
            <p className="text-sm text-slate-500">
              No companies yet. Start with <Link href="/companies/new" className="font-medium underline">a new analysis</Link>.
            </p>
          ) : (
            <table className="table-base">
              <thead>
                <tr><th>Company</th><th>Sector</th><th>Buyers</th><th>Last run</th><th></th></tr>
              </thead>
              <tbody>
                {companies.map((c) => (
                  <tr key={c.id}>
                    <td className="font-medium">
                      <Link href={`/companies/${c.id}`} className="hover:underline">{c.name}</Link>
                    </td>
                    <td>{c.sector ?? '—'}</td>
                    <td>{c._count.buyers}</td>
                    <td>
                      {c.runs[0] ? (
                        <span className={
                          c.runs[0].status === 'done' ? 'text-emerald-700'
                          : c.runs[0].status === 'error' ? 'text-red-600'
                          : 'text-amber-600'
                        }>
                          {c.runs[0].status}
                        </span>
                      ) : '—'}
                    </td>
                    <td className="text-right">
                      <Link href={`/companies/${c.id}/buyers`} className="text-xs font-medium text-slate-500 hover:underline">buyers →</Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        <div className="card">
          <h2 className="mb-3 text-sm font-bold uppercase tracking-wide text-slate-500">Outreach status</h2>
          {outreach.length === 0 ? (
            <p className="text-sm text-slate-500">No outreach drafts yet.</p>
          ) : (
            <ul className="space-y-2">
              {outreach.map((o) => (
                <li key={o.status} className="flex items-center justify-between text-sm">
                  <StatusBadge status={o.status} />
                  <span className="font-semibold">{o._count}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
