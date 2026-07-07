'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';

export default function ExcludeBuyerButton({
  companyId,
  buyerId,
  excluded,
}: {
  companyId: string;
  buyerId: string;
  excluded: boolean;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  return (
    <button
      className={excluded ? 'btn-secondary text-xs' : 'btn-danger text-xs'}
      disabled={busy}
      onClick={async () => {
        setBusy(true);
        await fetch(`/api/companies/${companyId}/buyers/${buyerId}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ excluded: !excluded }),
        });
        setBusy(false);
        router.refresh();
      }}
    >
      {excluded ? 'Re-include' : 'Exclude'}
    </button>
  );
}
