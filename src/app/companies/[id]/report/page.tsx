import { notFound } from 'next/navigation';
import { prisma } from '@/lib/db';
import CompanyNav from '@/components/CompanyNav';
import Markdown from '@/components/Markdown';
import { PageTitle } from '@/components/ui';
import { revalidatePath } from 'next/cache';
import { generateReportMarkdown } from '@/lib/report';

export const dynamic = 'force-dynamic';

export default async function ReportPage({ params }: { params: { id: string } }) {
  const company = await prisma.targetCompany.findUnique({ where: { id: params.id } });
  if (!company) notFound();

  const report = await prisma.report.findFirst({
    where: { companyId: params.id },
    orderBy: { createdAt: 'desc' },
  });

  const companyId = company.id;
  const companyName = company.name;
  async function regenerate() {
    'use server';
    const markdown = await generateReportMarkdown(companyId);
    await prisma.report.create({
      data: {
        companyId,
        title: `${companyName} — Buyer Discovery Packet`,
        markdown,
      },
    });
    revalidatePath(`/companies/${companyId}/report`);
  }

  return (
    <div>
      <PageTitle
        title="Final Report"
        subtitle={report ? `Generated ${report.createdAt.toISOString().slice(0, 16).replace('T', ' ')}` : 'Not generated yet'}
        actions={
          <>
            <a href={`/api/companies/${params.id}/export.md`} className="btn-secondary">Export Markdown</a>
            <a href={`/api/companies/${params.id}/export.csv`} className="btn-secondary">Export Buyer CSV</a>
            <a href={`/api/companies/${params.id}/export-outreach.csv`} className="btn-secondary">Export Outreach CSV</a>
            <form action={regenerate}>
              <button type="submit" className="btn-primary">Regenerate</button>
            </form>
          </>
        }
      />
      <CompanyNav companyId={params.id} />

      {!report ? (
        <p className="text-sm text-slate-500">No report yet — run an analysis first, or click Regenerate.</p>
      ) : (
        <div className="card">
          <Markdown source={report.markdown} />
        </div>
      )}
    </div>
  );
}
