'use client';

// Deal-team management (owner only): add members by email, change roles,
// remove members.

import { useEffect, useState } from 'react';

type Member = {
  id: string;
  role: string;
  user: { id: string; email: string; name: string };
};

export default function MemberManager({
  companyId,
  canManage,
}: {
  companyId: string;
  canManage: boolean;
}) {
  const [members, setMembers] = useState<Member[]>([]);
  const [email, setEmail] = useState('');
  const [role, setRole] = useState('editor');
  const [error, setError] = useState('');

  async function load() {
    const res = await fetch(`/api/companies/${companyId}/members`);
    if (res.ok) setMembers(await res.json());
  }
  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [companyId]);

  async function add(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    const res = await fetch(`/api/companies/${companyId}/members`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, role }),
    });
    if (!res.ok) setError((await res.json()).error ?? 'Failed');
    else setEmail('');
    await load();
  }

  async function remove(userId: string) {
    setError('');
    const res = await fetch(`/api/companies/${companyId}/members`, {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId }),
    });
    if (!res.ok) setError((await res.json()).error ?? 'Failed');
    await load();
  }

  return (
    <div>
      <ul className="space-y-2">
        {members.map((m) => (
          <li key={m.id} className="flex items-center justify-between text-sm">
            <span>
              <span className="font-medium">{m.user.name}</span>{' '}
              <span className="text-slate-500">{m.user.email}</span>
            </span>
            <span className="flex items-center gap-2">
              <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-semibold text-slate-600">
                {m.role}
              </span>
              {canManage && (
                <button className="text-xs text-red-600 hover:underline" onClick={() => remove(m.user.id)}>
                  remove
                </button>
              )}
            </span>
          </li>
        ))}
      </ul>
      {canManage && (
        <form onSubmit={add} className="mt-4 flex gap-2">
          <input
            type="email"
            required
            className="input flex-1"
            placeholder="colleague@firm.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
          <select className="input w-28" value={role} onChange={(e) => setRole(e.target.value)}>
            <option value="viewer">viewer</option>
            <option value="editor">editor</option>
            <option value="owner">owner</option>
          </select>
          <button type="submit" className="btn-primary">Add</button>
        </form>
      )}
      {error && <p className="mt-2 rounded-lg bg-red-50 p-2 text-xs text-red-700">{error}</p>}
    </div>
  );
}
