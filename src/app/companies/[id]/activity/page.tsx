import { notFound } from 'next/navigation';
import { prisma } from '@/lib/db';
import CompanyNav from '@/components/CompanyNav';
import MemberManager from '@/components/MemberManager';
import { PageTitle, Section } from '@/components/ui';
import { requireMemberPage } from '@/lib/page-auth';

export const dynamic = 'force-dynamic';

const ACTION_LABELS: Record<string, string> = {
  'company.created': 'created the deal',
  'deck.uploaded': 'uploaded a pitch deck',
  'analysis.started': 'started an analysis run',
  'analysis.retried': 'retried a failed analysis run',
  'score.edited': 'edited a buyer score',
  'thesis.edited': 'edited an acquisition thesis',
  'buyer.exclusion_changed': 'changed a buyer exclusion',
  'buyer.edited': 'edited a buyer',
  'outreach.approved': 'approved an outreach draft',
  'outreach.rejected': 'rejected an outreach draft',
  'outreach.status_changed': 'changed an outreach status',
  'outreach.edited': 'edited an outreach draft',
  'outreach.regenerated': 'regenerated outreach drafts',
  'report.regenerated': 'regenerated the report',
  'member.added_or_updated': 'added or updated a team member',
  'member.removed': 'removed a team member',
  'contact.created': 'added a buyer contact',
  'contact.deleted': 'removed a buyer contact',
};

export default async function ActivityPage({ params }: { params: { id: string } }) {
  const { role } = await requireMemberPage(params.id);
  const company = await prisma.targetCompany.findUnique({ where: { id: params.id } });
  if (!company) notFound();

  const logs = await prisma.auditLog.findMany({
    where: { companyId: params.id },
    include: { user: { select: { name: true, email: true } } },
    orderBy: { createdAt: 'desc' },
    take: 200,
  });

  return (
    <div>
      <PageTitle
        title={`${company.name} — Activity`}
        subtitle="Audit trail of approvals, edits, and runs, plus deal-team access."
      />
      <CompanyNav companyId={params.id} />

      <div className="grid grid-cols-3 gap-6">
        <div className="col-span-2">
          <Section title="Audit log">
            {logs.length === 0 ? (
              <p className="text-sm text-slate-500">No activity recorded yet.</p>
            ) : (
              <table className="table-base">
                <thead>
                  <tr><th>When</th><th>Who</th><th>Action</th><th>Detail</th></tr>
                </thead>
                <tbody>
                  {logs.map((l) => (
                    <tr key={l.id}>
                      <td className="whitespace-nowrap text-xs text-slate-500">
                        {l.createdAt.toISOString().slice(0, 16).replace('T', ' ')}
                      </td>
                      <td className="whitespace-nowrap">{l.user?.name ?? 'system'}</td>
                      <td>{ACTION_LABELS[l.action] ?? l.action}</td>
                      <td className="max-w-xs truncate text-xs text-slate-500" title={l.detail ?? ''}>
                        {l.detail ?? ''}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </Section>
        </div>
        <div>
          <Section title="Deal team">
            <MemberManager companyId={params.id} canManage={role === 'owner'} />
            <p className="mt-3 text-[11px] text-slate-400">
              Roles: owner (manage team + everything) · editor (edit &amp; approve) · viewer (read-only).
            </p>
          </Section>
        </div>
      </div>
    </div>
  );
}
