import { prisma } from './db';

// CSV export — Google Sheets / Excel compatible (quoted fields, CRLF).

function csvEscape(v: unknown): string {
  const s = v === null || v === undefined ? '' : String(v);
  return `"${s.replace(/"/g, '""').replace(/\r?\n/g, ' ')}"`;
}

export function toCsv(headers: string[], rows: unknown[][]): string {
  return [headers.map(csvEscape).join(','), ...rows.map((r) => r.map(csvEscape).join(','))].join(
    '\r\n'
  );
}

/** Ranked buyer table with the full spec column set. */
export async function buyerTableCsv(companyId: string): Promise<string> {
  const buyers = await prisma.buyer.findMany({
    where: { companyId, excluded: false },
    include: { score: true, thesis: true },
  });
  const sorted = buyers.sort(
    (a, b) => (b.score?.weightedScore ?? -1) - (a.score?.weightedScore ?? -1)
  );
  const headers = [
    'Rank', 'Buyer Name', 'Buyer Type', 'Industry',
    'Product Fit', 'Customer Overlap', 'Market Expansion Fit', 'M&A History',
    'Financial Capacity', 'Competitive Pressure', 'Integration Feasibility',
    'Weighted Score', 'Tier', 'Strategic Rationale', 'Main Risk',
    'Best Contact Type', 'Outreach Angle', 'Confidence Score',
  ];
  const rows = sorted.map((b, i) => [
    b.score ? i + 1 : '',
    b.name,
    b.buyerType,
    b.industry ?? '',
    b.score?.productFit ?? '',
    b.score?.customerOverlap ?? '',
    b.score?.marketExpansionFit ?? '',
    b.score?.mAndAHistory ?? '',
    b.score?.financialCapacity ?? '',
    b.score?.competitivePressure ?? '',
    b.score?.integrationFeasibility ?? '',
    b.score?.weightedScore.toFixed(2) ?? '',
    b.score?.tier ?? '',
    b.score?.rationale ?? b.initialRationale ?? '',
    b.score?.keyRisk ?? '',
    b.thesis?.bestContactType ?? '',
    b.thesis?.recommendedOutreachAngle ?? '',
    b.score?.confidenceScore ?? '',
  ]);
  return toCsv(headers, rows);
}

/** Outreach messages export. */
export async function outreachCsv(companyId: string): Promise<string> {
  const messages = await prisma.outreachMessage.findMany({
    where: { companyId },
    include: { buyer: true },
    orderBy: { createdAt: 'asc' },
  });
  const headers = ['Buyer', 'Message Type', 'Subject', 'Body', 'Status', 'Approved'];
  const rows = messages.map((m) => [
    m.buyer?.name ?? '(general)',
    m.messageType,
    m.subject ?? '',
    m.body,
    m.status,
    m.approvedByUser ? 'yes' : 'no',
  ]);
  return toCsv(headers, rows);
}
