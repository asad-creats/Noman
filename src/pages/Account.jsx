import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../auth';
import { supabase } from '../supabase';
import { BarHeader, ErrorBox } from '../ui';
import * as I from '../icons';

export default function Account() {
  const { profile, user, isAdmin, course, refresh, signOut } = useAuth();
  const [f, setF] = useState({ full_name: profile.full_name || '', phone: profile.phone || '' });
  const [msg, setMsg] = useState('');
  const [error, setError] = useState(null);

  async function save(e) {
    e.preventDefault();
    const { error: err } = await supabase.from('profiles').update(f).eq('id', profile.id);
    if (err) setError(err); else { setMsg('Saved.'); refresh(); }
  }

  return (
    <>
      <BarHeader title="Account" sub={`${user.email} · ${isAdmin ? 'Admin' : 'Group incharge'}${course ? ' · ' + course.name : ''}`} back="/" />
      <main className="screen-main" style={{ paddingTop: 16 }}>
        <ErrorBox error={error} />
        {msg && <div className="notice">{msg}</div>}
        <form onSubmit={save} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div className="field"><label htmlFor="an">Full name</label><input id="an" className="input" value={f.full_name} onChange={(e) => setF({ ...f, full_name: e.target.value })} /></div>
          <div className="field"><label htmlFor="ap">Phone</label><input id="ap" className="input" type="tel" value={f.phone} onChange={(e) => setF({ ...f, phone: e.target.value })} /></div>
          <button className="btn btn-outline">Save details</button>
        </form>
        {isAdmin && <Link to="/team" className="btn btn-ghost"><I.Settings />Team & groups</Link>}
        <Link to="/students" className="btn btn-ghost"><I.Users size={20} />All students</Link>
        <button className="btn btn-primary" onClick={signOut}>Switch user / sign out</button>
        <p className="meta" style={{ textAlign: 'center' }}>Signing out keeps this account in the “Who’s signing in?” list on this phone.</p>
      </main>
    </>
  );
}
