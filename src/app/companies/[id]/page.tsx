import { notFound } from 'next/navigation';
import { prisma } from '@/lib/db';
import CompanyNav from '@/components/CompanyNav';
import { PageTitle, Section, BulletList, ConfidenceBadge, parseArr } from '@/components/ui';
import { requireMemberPage } from '@/lib/page-auth';
import RetryRunButton from '@/components/RetryRunButton';

export const dynamic = 'force-dynamic';

async function artifact(companyId: string, kind: string): Promise<any | null> {
  const a = await prisma.analysisArtifact.findUnique({
    where: { companyId_kind: { companyId, kind } },
  });
  return a ? JSON.parse(a.json) : null;
}

export default async function CompanyProfilePage({ params }: { params: { id: string } }) {
  await requireMemberPage(params.id);
  const company = await prisma.targetCompany.findUnique({
    where: { id: params.id },
    include: { decks: true, runs: { orderBy: { createdAt: 'desc' }, take: 1 } },
  });
  if (!company) notFound();

  const [profile, intake, financial, market] = await Promise.all([
    artifact(params.id, 'company_profile'),
    artifact(params.id, 'deck_intake'),
    artifact(params.id, 'financial_analysis'),
    artifact(params.id, 'market_map'),
  ]);
  const run = company.runs[0];

  return (
    <div>
      <PageTitle
        title={company.name}
        subtitle={`${company.sector ?? 'Sector TBD'} · ${company.website ?? 'no website'} · confidentiality: ${company.confidentialityLevel}`}
      />
      <CompanyNav companyId={company.id} />

      {(run?.status === 'running' || run?.status === 'queued') && (
        <p className="mb-4 rounded-lg bg-amber-50 p-3 text-sm text-amber-800">
          {run.status === 'queued' ? 'Analysis queued…' : 'Analysis in progress — sections fill in as agents complete.'}
        </p>
      )}
      {run?.status === 'error' && (
        <div className="mb-4 flex items-center justify-between gap-3 rounded-lg bg-red-50 p-3 text-sm text-red-700">
          <span>Last run failed: {run.error}</span>
          <RetryRunButton runId={run.id} />
        </div>
      )}

      {!profile ? (
        <p className="text-sm text-slate-500">No analysis yet. Run one from the New Company Analysis page.</p>
      ) : (
        <div className="grid grid-cols-2 gap-6">
          <div className="col-span-2">
            <Section title="Executive summary">
              <p className="text-sm leading-relaxed text-slate-700">{profile.executive_summary}</p>
              <div className="mt-3 flex items-center gap-2 text-xs text-slate-500">
                Analysis confidence: <ConfidenceBadge value={profile.confidence_score} />
              </div>
            </Section>
          </div>

          <Section title="Business">
            <dl className="space-y-2 text-sm">
              <div><dt className="font-semibold text-slate-500">What it does</dt><dd>{profile.what_the_company_does}</dd></div>
              <div><dt className="font-semibold text-slate-500">Business model</dt><dd>{profile.business_model}</dd></div>
              <div><dt className="font-semibold text-slate-500">Customer profile</dt><dd>{profile.customer_profile}</dd></div>
              <div><dt className="font-semibold text-slate-500">Revenue model</dt><dd>{intake?.revenue_model ?? '—'}</dd></div>
            </dl>
          </Section>

          <Section title="Financial snapshot">
            <p className="text-sm text-slate-700">{financial?.financial_summary ?? 'Not generated yet.'}</p>
            {financial && (
              <dl className="mt-3 space-y-1 text-sm">
                <div><dt className="inline font-semibold text-slate-500">Stage: </dt><dd className="inline">{financial.company_stage}</dd></div>
                <div><dt className="inline font-semibold text-slate-500">Likely valuation method: </dt><dd className="inline">{financial.likely_valuation_method}</dd></div>
              </dl>
            )}
            <p className="mt-3 rounded bg-amber-50 px-2 py-1 text-xs text-amber-800">Not a formal valuation.</p>
          </Section>

          <Section title="Strategic value drivers">
            <BulletList items={profile.strategic_value_drivers ?? []} />
            <h3 className="mb-1 mt-4 text-xs font-bold uppercase text-slate-400">Why acquirable</h3>
            <p className="text-sm text-slate-700">{profile.why_the_company_may_be_acquirable}</p>
          </Section>

          <Section title="Risks & missing information">
            <h3 className="mb-1 text-xs font-bold uppercase text-slate-400">Key risks</h3>
            <BulletList items={profile.key_risks ?? []} />
            <h3 className="mb-1 mt-4 text-xs font-bold uppercase text-slate-400">Missing information</h3>
            <BulletList items={[...(profile.missing_data ?? []), ...(financial?.missing_financial_data ?? [])]} />
          </Section>

          <Section title="Facts vs assumptions">
            <h3 className="mb-1 text-xs font-bold uppercase text-emerald-600">Facts</h3>
            <BulletList items={profile.facts ?? []} empty="No verified facts recorded." />
            <h3 className="mb-1 mt-4 text-xs font-bold uppercase text-amber-600">Assumptions</h3>
            <BulletList items={profile.assumptions ?? []} empty="No assumptions recorded." />
          </Section>

          <Section title="Market overview">
            {market ? (
              <>
                <p className="text-sm font-semibold">{market.market_category}</p>
                <p className="mt-1 text-sm text-slate-700">{market.market_description}</p>
                <h3 className="mb-1 mt-3 text-xs font-bold uppercase text-slate-400">Tailwinds</h3>
                <BulletList items={market.market_tailwinds ?? []} />
              </>
            ) : (
              <p className="text-sm text-slate-500">Not generated yet.</p>
            )}
          </Section>

          <Section title="Diligence questions">
            <BulletList items={profile.diligence_questions ?? []} />
          </Section>

          <Section title="Source materials">
            <ul className="space-y-1 text-sm text-slate-700">
              {company.decks.map((d) => (
                <li key={d.id}>📄 {d.filename} ({d.pageCount ?? '?'} pages)</li>
              ))}
              {company.decks.length === 0 && <li className="italic text-slate-400">No deck uploaded.</li>}
              {company.financialNotes && <li>💰 Financial notes provided</li>}
              {company.customerNotes && <li>👥 Customer notes provided</li>}
            </ul>
          </Section>
        </div>
      )}
    </div>
  );
}
