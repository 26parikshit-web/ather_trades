// Login / Signup — Neo-style card with mode toggle.
import { useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../store/auth';

export default function Login() {
  const [mode, setMode] = useState<'login' | 'signup'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const { login, signup, loading, error, clearError } = useAuth();
  const navigate = useNavigate();

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    try {
      if (mode === 'signup') await signup(email, password, name || undefined);
      else await login(email, password);
      navigate('/');
    } catch {
      /* error already in store */
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center p-4">
      <div className="w-full max-w-sm">
        <div className="mb-6 text-center">
          <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-hud-ink text-2xl text-[#00E676] shadow-[0_22px_45px_-22px_rgba(10,31,23,0.85)]">
            ⚡
          </span>
          <h1 className="mt-4 text-xl font-extrabold tracking-[0.3em] text-hud-text">AETHER</h1>
          <p className="mt-1 text-[11px] font-medium uppercase tracking-widest text-hud-faint">
            Neo Market Intelligence
          </p>
        </div>

        <form onSubmit={submit} className="panel space-y-4 p-6">
          <div className="flex rounded-full border border-hud-border bg-hud-bg p-1 text-xs font-semibold">
            {(['login', 'signup'] as const).map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => {
                  setMode(m);
                  clearError();
                }}
                className={`flex-1 rounded-full py-2 transition-all ${
                  mode === m
                    ? 'bg-hud-ink text-white shadow-card'
                    : 'text-hud-dim hover:text-hud-text'
                }`}
              >
                {m === 'login' ? 'Sign In' : 'Create Account'}
              </button>
            ))}
          </div>

          {mode === 'signup' && (
            <div>
              <label className="label">Name (optional)</label>
              <input
                className="input"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Wolf"
                autoComplete="name"
              />
            </div>
          )}

          <div>
            <label className="label">Email</label>
            <input
              className="input"
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              autoComplete="email"
            />
          </div>

          <div>
            <label className="label">Password</label>
            <input
              className="input"
              type="password"
              required
              minLength={6}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              autoComplete={mode === 'signup' ? 'new-password' : 'current-password'}
            />
          </div>

          {error && (
            <div className="rounded-xl border border-hud-bear/40 bg-hud-bear/10 px-3 py-2 text-[11px] font-medium text-hud-bear">
              {error}
            </div>
          )}

          <button
            className="btn btn-primary w-full !py-3 text-sm"
            disabled={loading}
            type="submit"
          >
            {loading ? 'Linking…' : mode === 'signup' ? 'Create Account →' : 'Enter Dashboard →'}
          </button>

          <p className="text-center text-[10px] text-hud-faint">
            New accounts start on <span className="font-semibold text-hud-dim">BASIC</span> ·
            instant access, no email confirm
          </p>
        </form>
      </div>
    </div>
  );
}