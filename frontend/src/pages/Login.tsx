// Login / Signup — one screen, mode toggle.
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
          <div className="text-3xl">⚡</div>
          <h1 className="mt-2 text-lg font-black tracking-[0.4em] text-hud-cyan">AETHER</h1>
          <p className="mt-1 text-[11px] uppercase tracking-widest text-hud-faint">
            Tactical Market Intelligence
          </p>
        </div>

        <form onSubmit={submit} className="panel space-y-4 p-5">
          <div className="flex rounded-md border border-hud-border text-xs">
            {(['login', 'signup'] as const).map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => {
                  setMode(m);
                  clearError();
                }}
                className={`flex-1 rounded-md py-2 uppercase tracking-widest transition-colors ${
                  mode === m
                    ? 'bg-hud-cyan/15 text-hud-cyan'
                    : 'text-hud-dim hover:text-hud-text'
                }`}
              >
                {m === 'login' ? 'Sign In' : 'Create Account'}
              </button>
            ))}
          </div>

          {mode === 'signup' && (
            <div>
              <label className="label">Callsign (optional)</label>
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
            <div className="rounded border border-hud-bear/40 bg-hud-bear/10 px-3 py-2 text-[11px] text-hud-bear">
              {error}
            </div>
          )}

          <button
            className="btn btn-primary w-full !py-2.5"
            disabled={loading}
            type="submit"
          >
            {loading ? '⌁ LINKING…' : mode === 'signup' ? 'Create Account →' : 'Enter HUD →'}
          </button>

          <p className="text-center text-[10px] text-hud-faint">
            New accounts start on <span className="text-hud-dim">BASIC</span> · instant
            access, no email confirm
          </p>
        </form>
      </div>
    </div>
  );
}
