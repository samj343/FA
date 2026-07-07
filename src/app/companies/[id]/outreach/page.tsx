'use client';

// Outreach Drafts — review, edit, approve/reject, and track status.
// Nothing is ever sent by the system; "Sent" is a manual status the advisor
// sets after sending from their own email, and requires prior approval.

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import CompanyNav from '@/components/CompanyNav';
import { PageTitle, StatusBadge } from '@/components/ui';

type Message = {
  id: string;
  buyerId: string | null;
  buyer?: { name: string } | null;
  contactId: string | null;
  messageType: string;
  subject: string | null;
  body: string;
  status: string;
  approvedByUser: boolean;
};

type ContactOption = { id: string; name: string | null; type: string | null };

const TYPE_LABELS: Record<string, string> = {
  anonymous_teaser: 'Anonymous teaser',
  buyer_email: 'Buyer email',
  linkedin_message: 'LinkedIn message',
  corp_dev_email: 'Corp dev email',
  product_leader_email: 'Product leader email',
  ceo_email: 'CEO email',
  first_call_script: 'First-call script',
  objection_handling: 'Objection handling',
  follow_up_email: 'Follow-up email',
};

const STATUSES = [
  'Draft', 'Needs Review', 'Approved', 'Rejected', 'Sent', 'Follow-up Needed',
  'Not Interested', 'Interested', 'NDA Requested', 'Intro Call Scheduled',
];

export default function OutreachPage() {
  const { id } = useParams<{ id: string }>();
  const [messages, setMessages] = useState<Message[]>([]);
  const [buyerNames, setBuyerNames] = useState<Record<string, string>>({});
  const [buyerContacts, setBuyerContacts] = useState<Record<string, ContactOption[]>>({});
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState('');

  async function load() {
    const [companyRes, buyersRes] = await Promise.all([
      fetch(`/api/companies/${id}`),
      fetch(`/api/companies/${id}/buyers`),
    ]);
    const buyers = await buyersRes.json();
    const names: Record<string, string> = {};
    const contacts: Record<string, ContactOption[]> = {};
    for (const b of buyers) {
      names[b.id] = b.name;
      contacts[b.id] = b.contacts ?? [];
    }
    setBuyerNames(names);
    setBuyerContacts(contacts);
    // outreach messages come via a dedicated fetch of the company's drafts
    const res = await fetch(`/api/companies/${id}/outreach-list`);
    setMessages(await res.json());
    setLoading(false);
    void companyRes;
  }
  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  async function act(msgId: string, action: 'approve' | 'reject') {
    await fetch(`/api/outreach/${msgId}/${action}`, { method: 'PATCH' });
    await load();
  }
  async function patch(msgId: string, data: Record<string, unknown>) {
    const res = await fetch(`/api/outreach/${msgId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    if (!res.ok) setError((await res.json()).error ?? 'Update failed');
    else setError('');
    await load();
  }
  async function regenerate() {
    setGenerating(true);
    const res = await fetch(`/api/companies/${id}/generate-outreach`, { method: 'POST' });
    if (!res.ok) setError((await res.json()).error ?? 'Generation failed');
    setGenerating(false);
    await load();
  }

  return (
    <div>
      <PageTitle
        title="Outreach Drafts"
        subtitle="Every draft requires your approval. The system never contacts buyers — sending is always done by you, outside the app."
        actions={
          <>
            <a href={`/api/companies/${id}/export-outreach.csv`} className="btn-secondary">Export CSV</a>
            <button onClick={regenerate} disabled={generating} className="btn-primary">
              {generating ? 'Generating…' : 'Regenerate drafts'}
            </button>
          </>
        }
      />
      <CompanyNav companyId={id} />

      {error && <p className="mb-4 rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</p>}

      {loading ? (
        <p className="text-sm text-slate-500">Loading…</p>
      ) : messages.length === 0 ? (
        <p className="text-sm text-slate-500">
          No drafts yet. Run an analysis, or click "Regenerate drafts" once theses exist.
        </p>
      ) : (
        <div className="space-y-4">
          {messages.map((m) => (
            <div key={m.id} className="card">
              <div className="mb-2 flex items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <span className="text-sm font-bold">
                    {TYPE_LABELS[m.messageType] ?? m.messageType}
                  </span>
                  <span className="text-sm text-slate-500">
                    {m.buyerId ? `→ ${buyerNames[m.buyerId] ?? 'buyer'}` : '(general material)'}
                  </span>
                  <StatusBadge status={m.status} />
                </div>
                <div className="flex items-center gap-2">
                  {m.buyerId && (buyerContacts[m.buyerId]?.length ?? 0) > 0 && (
                    <select
                      className="input w-auto py-1 text-xs"
                      value={m.contactId ?? ''}
                      onChange={(e) => patch(m.id, { contactId: e.target.value || null })}
                      title="Contact this draft is addressed to"
                    >
                      <option value="">no contact</option>
                      {buyerContacts[m.buyerId].map((c) => (
                        <option key={c.id} value={c.id}>{c.name} ({c.type})</option>
                      ))}
                    </select>
                  )}
                  <select
                    className="input w-auto py-1 text-xs"
                    value={m.status}
                    onChange={(e) => patch(m.id, { status: e.target.value })}
                  >
                    {STATUSES.map((s) => <option key={s}>{s}</option>)}
                  </select>
                  {!m.approvedByUser && m.status !== 'Rejected' && (
                    <button className="btn-primary py-1 text-xs" onClick={() => act(m.id, 'approve')}>
                      Approve
                    </button>
                  )}
                  {m.status !== 'Rejected' && (
                    <button className="btn-danger py-1 text-xs" onClick={() => act(m.id, 'reject')}>
                      Reject
                    </button>
                  )}
                </div>
              </div>
              {m.subject && (
                <input
                  className="input mb-2 font-medium"
                  defaultValue={m.subject}
                  onBlur={(e) => e.target.value !== m.subject && patch(m.id, { subject: e.target.value })}
                />
              )}
              <textarea
                className="input font-mono text-xs leading-relaxed"
                rows={Math.min(14, Math.max(4, m.body.split('\n').length + 1))}
                defaultValue={m.body}
                onBlur={(e) => e.target.value !== m.body && patch(m.id, { body: e.target.value })}
              />
              <p className="mt-1 text-[11px] text-slate-400">
                Editing an approved draft resets it to "Needs Review". Marking "Sent" requires approval first.
              </p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
