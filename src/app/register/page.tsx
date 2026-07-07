'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

export default function RegisterPage() {
  const router = useRouter();
  const [form, setForm] = useState({ name: '', email: '', password: '' });
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError('');
    const res = await fetch('/api/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(form),
    });
    if (res.ok) {
      router.push('/');
      router.refresh();
    } else {
      const body = await res.json();
      setError(typeof body.error === 'string' ? body.error : 'Registration failed — check your input (password min 8 chars).');
      setBusy(false);
    }
  }

  return (
    <div className="flex min-h-[70vh] items-center justify-center">
      <form onSubmit={submit} className="card w-full max-w-sm space-y-4">
        <div>
          <h1 className="text-xl font-bold">Create your account</h1>
          <p className="mt-1 text-sm text-slate-500">BuyerScope workspace access</p>
        </div>
        <div>
          <label className="label">Name</label>
          <input required className="input" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
        </div>
        <div>
          <label className="label">Email</label>
          <input type="email" required className="input" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
        </div>
        <div>
          <label className="label">Password (min 8 chars)</label>
          <input type="password" required minLength={8} className="input" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} />
        </div>
        {error && <p className="rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</p>}
        <button type="submit" disabled={busy} className="btn-primary w-full justify-center">
          {busy ? 'Creating…' : 'Create account'}
        </button>
        <p className="text-center text-sm text-slate-500">
          Have an account? <Link href="/login" className="font-medium underline">Sign in</Link>
        </p>
      </form>
    </div>
  );
}
