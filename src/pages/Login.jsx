import { useState } from 'react';
import { supabase } from '../supabase';
import { forgetAccount, initials, rememberAccount, savedAccounts } from '../lib';
import { ErrorBox } from '../ui';
import * as I from '../icons';

export default function Login() {
  const saved = savedAccounts();
  const [mode, setMode] = useState(saved.length ? 'pick' : 'email'); // pick | email | signup
  const [picked, setPicked] = useState(saved[0]?.email || '');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const [notice, setNotice] = useState('');

  const loginEmail = mode === 'pick' ? picked : email.trim();
  const pickedAcc = saved.find((a) => a.email === picked);

  async function signIn(e) {
    e.preventDefault();
    setBusy(true); setError(null);
    const { data, error } = await supabase.auth.signInWithPassword({ email: loginEmail, password });
    setBusy(false);
    if (error) return setError(error);
    const { data: p } = await supabase.from('profiles').select('full_name, role').eq('id', data.user.id).maybeSingle();
    rememberAccount({ email: loginEmail, name: p?.full_name || loginEmail, role: p?.role || 'incharge' });
  }

  async function signUp(e) {
    e.preventDefault();
    setBusy(true); setError(null);
    const { data, error } = await supabase.auth.signUp({
      email: email.trim(), password, options: { data: { full_name: fullName.trim(), phone: phone.trim() } },
    });
    setBusy(false);
    if (error) return setError(error);
    rememberAccount({ email: email.trim(), name: fullName.trim(), role: 'incharge' });
    if (!data.session) setNotice('Account created. Check your email to confirm it, then sign in.');
  }

  async function resetPassword() {
    if (!loginEmail) return setError(new Error('Enter your email first.'));
    const { error } = await supabase.auth.resetPasswordForEmail(loginEmail, { redirectTo: window.location.origin });
    if (error) setError(error); else setNotice(`A reset link was sent to ${loginEmail}.`);
  }

  return (
    <>
      <header className="page-head" style={{ flexDirection: 'column', alignItems: 'flex-start', paddingTop: 'calc(env(safe-area-inset-top) + 48px)' }}>
        <span style={{ width: 52, height: 52, borderRadius: 16, background: 'var(--primary)', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><I.Check size={26} sw={2.2} /></span>
        <div>
          <h1>{mode === 'signup' ? 'Create account' : 'Who’s signing in?'}</h1>
          <div className="page-head eyebrow" style={{ padding: 0, marginTop: 4, fontSize: 14, color: 'var(--muted)', fontWeight: 500 }}>
            {mode === 'signup' ? 'For a new group incharge. An admin will add you to your group.' : 'Each group incharge has their own account and sees their own students.'}
          </div>
        </div>
      </header>

      <main className="screen-main" style={{ paddingTop: 0 }}>
        <ErrorBox error={error} />
        {notice && <div className="notice">{notice}</div>}

        {mode === 'signup' ? (
          <form onSubmit={signUp} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div className="field"><label htmlFor="fn">Full name</label><input id="fn" className="input" required value={fullName} onChange={(e) => setFullName(e.target.value)} /></div>
            <div className="field"><label htmlFor="ph">Phone</label><input id="ph" className="input" type="tel" placeholder="03XX XXXXXXX" value={phone} onChange={(e) => setPhone(e.target.value)} /></div>
            <div className="field"><label htmlFor="em">Email</label><input id="em" className="input" type="email" required autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} /></div>
            <div className="field"><label htmlFor="pw">Password (6+ characters)</label><input id="pw" className="input" type="password" required minLength={6} autoComplete="new-password" value={password} onChange={(e) => setPassword(e.target.value)} /></div>
            <button className="btn btn-primary" disabled={busy}>{busy ? 'Creating…' : 'Create account'}</button>
            <button type="button" className="btn btn-ghost" onClick={() => setMode(saved.length ? 'pick' : 'email')}>Back to sign in</button>
          </form>
        ) : (
          <form onSubmit={signIn} style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {mode === 'pick' ? (
              <div role="radiogroup" aria-label="Accounts on this phone" style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {saved.map((a) => (
                  <button type="button" role="radio" aria-checked={picked === a.email} key={a.email}
                    className={`choice ${picked === a.email ? 'on' : ''}`} onClick={() => setPicked(a.email)}>
                    <span className="avatar" style={a.role === 'admin' ? { background: 'var(--ink)', color: '#fff', width: 40, height: 40, borderRadius: 20 } : { background: 'var(--primary-soft)', color: 'var(--primary)', width: 40, height: 40, borderRadius: 20 }}>{initials(a.name)}</span>
                    <span style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 2 }}>
                      <span className="name">{a.name}</span>
                      <span className="meta">{a.role === 'admin' ? 'Admin' : 'Group incharge'} · {a.email}</span>
                    </span>
                    <span className="radio-dot" />
                  </button>
                ))}
              </div>
            ) : (
              <div className="field"><label htmlFor="em2">Email</label><input id="em2" className="input" type="email" required autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} /></div>
            )}

            <div className="field" style={{ marginTop: 6 }}>
              <label htmlFor="pw2">Password{mode === 'pick' && pickedAcc ? ` for ${pickedAcc.name}` : ''}</label>
              <input id="pw2" className="input" type="password" required autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} />
            </div>
            <button className="btn btn-primary" disabled={busy || !loginEmail}>{busy ? 'Signing in…' : 'Sign in'}</button>

            <div style={{ display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap' }}>
              <button type="button" className="btn btn-sm" style={{ background: 'none', color: 'var(--primary)', padding: 0 }} onClick={resetPassword}>Forgot password?</button>
              {mode === 'pick' ? (
                <button type="button" className="btn btn-sm" style={{ background: 'none', color: 'var(--primary)', padding: 0 }} onClick={() => setMode('email')}><I.Plus />Other account</button>
              ) : saved.length ? (
                <button type="button" className="btn btn-sm" style={{ background: 'none', color: 'var(--primary)', padding: 0 }} onClick={() => setMode('pick')}>Saved accounts</button>
              ) : null}
            </div>
            {mode === 'pick' && pickedAcc && (
              <button type="button" className="btn btn-sm" style={{ background: 'none', color: 'var(--muted)', padding: 0, alignSelf: 'flex-start' }}
                onClick={() => { forgetAccount(picked); window.location.reload(); }}>Remove {pickedAcc.name} from this phone</button>
            )}
            <button type="button" className="btn btn-ghost" style={{ marginTop: 8 }} onClick={() => { setMode('signup'); setError(null); }}>Create a new account</button>
          </form>
        )}
      </main>
    </>
  );
}
