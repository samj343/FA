import Link from 'next/link';
import { notFound } from 'next/navigation';
import { prisma } from '@/lib/db';
import CompanyNav from '@/components/CompanyNav';
import { PageTitle, Section, BulletList, TierBadge, ConfidenceBadge, StatusBadge, parseArr } from '@/components/ui';
import { requireMemberPage } from '@/lib/page-auth';
import ContactManager from '@/components/ContactManager';

export const dynamic = 'force-dynamic';

export default async function BuyerDetailPage({
  params,
}: {
  params: { id: string; buyerId: string };
}) {
  await requireMemberPage(params.id);
  const buyer = await prisma.buyer.findFirst({
    where: { id: params.buyerId, companyId: params.id },
    include: {
      research: true,
      score: true,
      thesis: true,
      company: true,
      outreach: { orderBy: { createdAt: 'asc' } },
    },
  });
  if (!buyer) notFound();
  const r = buyer.research;
  const s = buyer.score;
  const t = buyer.thesis;

  // Simple CRM-style sequencing: order this buyer's drafts into the intended
  // outreach sequence and derive the recommended next action from statuses.
  const SEQUENCE = ['buyer_email', 'linkedin_message', 'corp_dev_email', 'product_leader_email', 'ceo_email', 'follow_up_email'];
  const sequence = [...buyer.outreach].sort(
    (a, b) => SEQUENCE.indexOf(a.messageType) - SEQUENCE.indexOf(b.messageType)
  );
  const nextAction = (() => {
    const statuses = sequence.map((m) => m.status);
    if (statuses.includes('Intro Call Scheduled')) return 'Prepare for the intro call using the first-call script.';
    if (statuses.includes('NDA Requested')) return 'Coordinate the NDA, then share detailed materials.';
    if (statuses.includes('Interested')) return 'Qualify interest and propose an NDA.';
    if (statuses.includes('Not Interested')) return 'Park this buyer; revisit next quarter.';
    if (statuses.includes('Follow-up Needed')) return 'Send the follow-up email (after approval).';
    if (statuses.includes('Sent')) return 'Await response; mark Follow-up Needed after ~1 week of silence.';
    if (statuses.includes('Approved')) return 'Send the approved message from your own email, then mark it Sent.';
    if (statuses.includes('Needs Review')) return 'Review and approve the drafts on the Outreach tab.';
    if (sequence.length === 0) return 'No drafts yet — generate outreach for top buyers on the Outreach tab.';
    return 'Review drafts on the Outreach tab.';
  })();

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

        <Section title="Contacts">
          <ContactManager companyId={params.id} buyerId={buyer.id} />
        </Section>

        <Section title="Outreach sequence">
          <p className="mb-3 rounded-lg bg-slate-50 px-3 py-2 text-sm">
            <span className="font-semibold text-slate-500">Next action: </span>
            {nextAction}
          </p>
          {sequence.length === 0 ? (
            <p className="text-sm italic text-slate-400">No outreach drafts for this buyer yet.</p>
          ) : (
            <ol className="space-y-2">
              {sequence.map((m, i) => (
                <li key={m.id} className="flex items-center justify-between gap-2 text-sm">
                  <span>
                    <span className="mr-2 text-xs font-bold text-slate-400">{i + 1}.</span>
                    {m.messageType.replace(/_/g, ' ')}
                    {m.sentAt && (
                      <span className="ml-2 text-xs text-slate-400">
                        sent {m.sentAt.toISOString().slice(0, 10)}
                      </span>
                    )}
                  </span>
                  <StatusBadge status={m.status} />
                </li>
              ))}
            </ol>
          )}
          <p className="mt-3 text-[11px] text-slate-400">
            Statuses are managed on the Outreach tab. Sending always happens from your own email —
            the app never contacts buyers.
          </p>
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
