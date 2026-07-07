'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';

export default function RetryRunButton({ runId }: { runId: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  return (
    <span className="inline-flex items-center gap-2">
      <button
        className="btn-secondary py-1 text-xs"
        disabled={busy}
        onClick={async () => {
          setBusy(true);
          const res = await fetch(`/api/runs/${runId}/retry`, { method: 'POST' });
          if (!res.ok) setError((await res.json()).error ?? 'Retry failed');
          setBusy(false);
          router.refresh();
        }}
      >
        {busy ? 'Retrying…' : 'Retry from failed step'}
      </button>
      {error && <span className="text-xs text-red-600">{error}</span>}
    </span>
  );
}
