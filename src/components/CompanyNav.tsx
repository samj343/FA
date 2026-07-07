'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

const TABS = [
  { slug: '', label: 'Profile' },
  { slug: '/buyers', label: 'Buyer Universe' },
  { slug: '/scoring', label: 'Scoring' },
  { slug: '/theses', label: 'Theses' },
  { slug: '/outreach', label: 'Outreach' },
  { slug: '/report', label: 'Report' },
  { slug: '/activity', label: 'Activity' },
];

export default function CompanyNav({ companyId }: { companyId: string }) {
  const pathname = usePathname();
  const base = `/companies/${companyId}`;
  return (
    <div className="mb-6 flex gap-1 border-b border-slate-200">
      {TABS.map((t) => {
        const href = base + t.slug;
        const active = pathname === href;
        return (
          <Link
            key={t.slug}
            href={href}
            className={`-mb-px border-b-2 px-4 py-2 text-sm font-medium ${
              active
                ? 'border-ink-900 text-ink-900'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            {t.label}
          </Link>
        );
      })}
    </div>
  );
}
