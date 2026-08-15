'use client';

import { useEffect, useState, type FormEvent } from 'react';

interface User {
  userId: string;
  name: string;
  email: string;
  createdAt: string;
}

export default function Home() {
  const [users, setUsers] = useState<User[]>([]);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function loadUsers() {
    const res = await fetch('/api/users');
    if (res.ok) {
      setUsers(await res.json());
    }
  }

  useEffect(() => {
    loadUsers();
  }, []);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, email }),
      });
      if (!res.ok) {
        const body = await res.json();
        throw new Error(body.error ?? 'Failed to create user');
      }
      setName('');
      setEmail('');
      await loadUsers();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <main>
      <h1>Users</h1>

      <form onSubmit={handleSubmit}>
        <input
          type="text"
          placeholder="Name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          required
        />
        <input
          type="email"
          placeholder="Email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
        />
        <button type="submit" disabled={loading}>
          {loading ? 'Creating…' : 'Create user'}
        </button>
      </form>

      {error && <p className="error">{error}</p>}

      <ul>
        {users.map((user) => (
          <li key={user.userId}>
            <strong>{user.name}</strong> — {user.email}
            <span className="meta"> ({new Date(user.createdAt).toLocaleString()})</span>
          </li>
        ))}
      </ul>
    </main>
  );
}
