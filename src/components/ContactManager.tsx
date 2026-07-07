'use client';

// Buyer contact management: add/remove corp dev, product, CEO contacts.
// Contacts can then be attached to outreach drafts on the Outreach tab.

import { useEffect, useState } from 'react';

export type Contact = {
  id: string;
  name: string | null;
  title: string | null;
  type: string | null;
  email: string | null;
  linkedin: string | null;
};

const TYPE_LABELS: Record<string, string> = {
  corp_dev: 'Corp dev',
  product: 'Product',
  ceo: 'CEO',
  other: 'Other',
};

export default function ContactManager({
  companyId,
  buyerId,
}: {
  companyId: string;
  buyerId: string;
}) {
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [form, setForm] = useState({ name: '', title: '', type: 'corp_dev', email: '', linkedin: '' });
  const [error, setError] = useState('');
  const base = `/api/companies/${companyId}/buyers/${buyerId}/contacts`;

  async function load() {
    const res = await fetch(base);
    if (res.ok) setContacts(await res.json());
  }
  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [buyerId]);

  async function add(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    const res = await fetch(base, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(form),
    });
    if (!res.ok) setError('Could not add contact — check the fields.');
    else setForm({ name: '', title: '', type: 'corp_dev', email: '', linkedin: '' });
    await load();
  }

  async function remove(contactId: string) {
    await fetch(base, {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ contactId }),
    });
    await load();
  }

  return (
    <div>
      {contacts.length === 0 ? (
        <p className="text-sm italic text-slate-400">No contacts yet.</p>
      ) : (
        <ul className="space-y-2">
          {contacts.map((c) => (
            <li key={c.id} className="flex items-start justify-between text-sm">
              <span>
                <span className="font-medium">{c.name}</span>
                {c.title && <span className="text-slate-500"> — {c.title}</span>}
                <span className="ml-2 rounded-full bg-slate-100 px-2 py-0.5 text-xs font-semibold text-slate-600">
                  {TYPE_LABELS[c.type ?? 'other'] ?? c.type}
                </span>
                <span className="block text-xs text-slate-500">
                  {[c.email, c.linkedin].filter(Boolean).join(' · ')}
                </span>
              </span>
              <button className="text-xs text-red-600 hover:underline" onClick={() => remove(c.id)}>
                remove
              </button>
            </li>
          ))}
        </ul>
      )}
      <form onSubmit={add} className="mt-4 grid grid-cols-2 gap-2">
        <input required className="input" placeholder="Name" value={form.name}
          onChange={(e) => setForm({ ...form, name: e.target.value })} />
        <input className="input" placeholder="Title (VP Corp Dev…)" value={form.title}
          onChange={(e) => setForm({ ...form, title: e.target.value })} />
        <select className="input" value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })}>
          <option value="corp_dev">Corp dev</option>
          <option value="product">Product leader</option>
          <option value="ceo">CEO / founder</option>
          <option value="other">Other</option>
        </select>
        <input type="email" className="input" placeholder="Email (optional)" value={form.email}
          onChange={(e) => setForm({ ...form, email: e.target.value })} />
        <input className="input" placeholder="LinkedIn URL (optional)" value={form.linkedin}
          onChange={(e) => setForm({ ...form, linkedin: e.target.value })} />
        <button type="submit" className="btn-primary justify-center">Add contact</button>
      </form>
      {error && <p className="mt-2 rounded-lg bg-red-50 p-2 text-xs text-red-700">{error}</p>}
    </div>
  );
}
