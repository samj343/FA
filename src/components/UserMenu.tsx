'use client';

import { useRouter } from 'next/navigation';

export default function UserMenu({ name, email }: { name: string; email: string }) {
  const router = useRouter();
  return (
    <div className="mb-4 rounded-lg bg-ink-900 p-3 text-xs">
      <div className="font-semibold text-white">{name}</div>
      <div className="truncate text-slate-400">{email}</div>
      <button
        className="mt-2 text-slate-300 underline hover:text-white"
        onClick={async () => {
          await fetch('/api/auth/logout', { method: 'POST' });
          router.push('/login');
          router.refresh();
        }}
      >
        Sign out
      </button>
    </div>
  );
}
