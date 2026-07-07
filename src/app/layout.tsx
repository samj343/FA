import type { Metadata } from 'next';
import Link from 'next/link';
import './globals.css';
import { getSessionUser } from '@/lib/auth';
import UserMenu from '@/components/UserMenu';

export const metadata: Metadata = {
  title: 'BuyerScope — M&A Buyer Discovery',
  description: 'AI-powered buyer discovery workflow for independent M&A advisors',
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const user = await getSessionUser();
  return (
    <html lang="en">
      <body>
        <div className="flex min-h-screen">
          <aside className="fixed inset-y-0 w-56 bg-ink-950 p-5 text-slate-300">
            <Link href="/" className="mb-8 block">
              <span className="text-lg font-bold text-white">BuyerScope</span>
              <span className="block text-xs text-slate-400">M&A buyer discovery</span>
            </Link>
            <nav className="space-y-1 text-sm">
              <Link href="/" className="block rounded-md px-3 py-2 hover:bg-ink-800 hover:text-white">
                Dashboard
              </Link>
              <Link href="/companies/new" className="block rounded-md px-3 py-2 hover:bg-ink-800 hover:text-white">
                New Company Analysis
              </Link>
              <Link href="/comps" className="block rounded-md px-3 py-2 hover:bg-ink-800 hover:text-white">
                Comparable Deals
              </Link>
              <Link href="/settings" className="block rounded-md px-3 py-2 hover:bg-ink-800 hover:text-white">
                Settings
              </Link>
            </nav>
            <div className="absolute bottom-5 left-5 right-5">
              {user && <UserMenu name={user.name} email={user.email} />}
              <div className="rounded-lg bg-ink-900 p-3 text-[11px] leading-snug text-slate-400">
                AI output is drafted for advisor review. Nothing is sent to buyers without explicit
                approval.
              </div>
            </div>
          </aside>
          <main className="ml-56 flex-1 p-8">{children}</main>
        </div>
      </body>
    </html>
  );
}
