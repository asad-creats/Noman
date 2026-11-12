import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { supabase } from '../supabase';
import { fmtDay, fmtTime } from '../lib';
import { Avatar, BarHeader, Empty, ErrorBox, Loading } from '../ui';
import * as I from '../icons';

export default function TakeAttendance() {
  const { id } = useParams();
  const nav = useNavigate();
  const [params, setParams] = useSearchParams();
  const [session, setSession] = useState(null);
  const [students, setStudents] = useState([]);
  const [marks, setMarks] = useState({});
  const [original, setOriginal] = useState({});
  const [listeners, setListeners] = useState([]);
  const [search, setSearch] = useState('');
  const [groupFilter, setGroupFilter] = useState('');
  const [error, setError] = useState(null);
  const [saving, setSaving] = useState(false);
  const showListener = params.get('listener') === '1';

  async function loadListeners() {
    const { data } = await supabase.from('listeners').select('*').eq('session_id', id).order('created_at');
    setListeners(data || []);
  }

  useEffect(() => {
    (async () => {
      const { data: s, error: e } = await supabase.from('sessions').select('*').eq('id', id).single();
      if (e) return setError(e);
      setSession(s);
      const [{ data: st }, { data: att }] = await Promise.all([
        supabase.from('students').select('id, full_name, father_name, reg_no, group_id, group:study_groups(name)').eq('course_id', s.course_id).eq('status', 'active').order('full_name'),
        supabase.from('attendance').select('student_id, status').eq('session_id', id),
      ]);
      setStudents(st || []);
      const m = Object.fromEntries((att || []).map((a) => [a.student_id, a.status]));
      setMarks(m); setOriginal(m);
      loadListeners();
    })();
  }, [id]);

  const counts = useMemo(() => {
    const v = students.map((x) => marks[x.id]);
    const p = v.filter((x) => x === 'present').length;
    const a = v.filter((x) => x === 'absent').length;
    const l = v.filter((x) => x === 'leave').length;
    return { p, a, l, u: students.length - p - a - l };
  }, [students, marks]);

  const groupNames = [...new Map(students.filter((s) => s.group_id).map((s) => [s.group_id, s.group?.name])).entries()];
  const shown = students.filter((s) => s.full_name.toLowerCase().includes(search.toLowerCase()) && (!groupFilter || s.group_id === groupFilter));
  const toggle = (sid, v) => setMarks((m) => ({ ...m, [sid]: m[sid] === v ? undefined : v }));

  async function save() {
    setSaving(true); setError(null);
    try {
      const rows = Object.entries(marks).filter(([, v]) => v).map(([student_id, status]) => ({ session_id: id, student_id, status }));
      const cleared = Object.keys(original).filter((sid) => original[sid] && !marks[sid]);
      if (rows.length) {
        const { error: e } = await supabase.from('attendance').upsert(rows, { onConflict: 'session_id,student_id' });
        if (e) throw e;
      }
      if (cleared.length) {
        const { error: e } = await supabase.from('attendance').delete().eq('session_id', id).in('student_id', cleared);
        if (e) throw e;
      }
      const { data: u } = await supabase.auth.getUser();
      await supabase.from('sessions').update({ saved_at: new Date().toISOString(), saved_by: u.user.id }).eq('id', id);
      nav(`/reports/${id}`, { replace: true });
    } catch (e) { setError(e); setSaving(false); }
  }

  async function removeListener(lid) {
    await supabase.from('listeners').delete().eq('id', lid);
    loadListeners();
  }

  if (!session) return error ? <div className="screen-main"><ErrorBox error={error} /></div> : <Loading />;

  return (
    <>
      <BarHeader title={session.title} sub={`${fmtDay(session.held_on)}${session.start_time ? ' · ' + fmtTime(session.start_time) : ''}`}
        back="/"
        right={<button className="btn btn-outline btn-sm" onClick={() => setMarks(Object.fromEntries(students.map((s) => [s.id, 'present'])))}>All present</button>} />
      <div style={{ background: 'var(--surface)', padding: '0 16px 12px', borderBottom: '1px solid var(--line)' }}>
        <div className="stats">
          <div className="stat present"><b>{counts.p}</b><span>Present</span></div>
          <div className="stat absent"><b>{counts.a}</b><span>Absent</span></div>
          <div className="stat neutral"><b>{counts.u}</b><span>Unmarked{counts.l ? ` · ${counts.l} leave` : ''}</span></div>
        </div>
      </div>

      <main className="screen-main" style={{ paddingTop: 14, gap: 8 }}>
        <ErrorBox error={error} />
        <label htmlFor="q" className="sr-only">Search students</label>
        <input id="q" type="search" className="input" placeholder="Search students" value={search} onChange={(e) => setSearch(e.target.value)} />
        {groupNames.length > 0 && (
          <div className="chips" role="tablist" aria-label="Group">
            <button role="tab" aria-selected={!groupFilter} className={`chip ${!groupFilter ? 'on' : ''}`} onClick={() => setGroupFilter('')}>All</button>
            {groupNames.map(([id, n]) => <button key={id} role="tab" aria-selected={groupFilter === id} className={`chip ${groupFilter === id ? 'on' : ''}`} onClick={() => setGroupFilter(id)}>{n}</button>)}
          </div>
        )}
        <h2 className="section-label">Students · {shown.length}</h2>
        {!students.length && <Empty>No students in this group yet. Register students first.</Empty>}
        {shown.map((s) => (
          <div key={s.id} className="card row" style={{ padding: '10px 10px 10px 12px' }}>
            <Avatar name={s.full_name} tone={marks[s.id] || ''} />
            <div className="grow"><span className="name">{s.full_name}</span><span className="meta">{[s.father_name, s.group?.name].filter(Boolean).join(' · ')}</span></div>
            <button className={`mark p ${marks[s.id] === 'present' ? 'on' : ''}`} aria-pressed={marks[s.id] === 'present'} aria-label={`Mark ${s.full_name} present`} onClick={() => toggle(s.id, 'present')}>P</button>
            <button className={`mark a ${marks[s.id] === 'absent' ? 'on' : ''}`} aria-pressed={marks[s.id] === 'absent'} aria-label={`Mark ${s.full_name} absent`} onClick={() => toggle(s.id, 'absent')}>A</button>
            <button className={`mark l ${marks[s.id] === 'leave' ? 'on' : ''}`} aria-pressed={marks[s.id] === 'leave'} aria-label={`Mark ${s.full_name} on leave`} onClick={() => toggle(s.id, 'leave')}>L</button>
          </div>
        ))}

        <div className="section-head" style={{ marginTop: 10 }}>
          <h2 className="section-label" style={{ margin: 0 }}>Listeners · {listeners.length}</h2>
          <button className="btn btn-sm" style={{ background: 'none', color: 'var(--listener)', padding: 0, height: 44 }} onClick={() => setParams({ listener: '1' })}><I.Plus />Add listener</button>
        </div>
        {listeners.map((l) => (
          <div key={l.id} className="card row">
            <Avatar name={l.full_name} tone="listener" />
            <div className="grow"><span className="name">{l.full_name}</span><span className="meta">{[l.father_name, l.referred_by, l.note, l.interested ? 'Wants to register' : ''].filter(Boolean).join(' · ')}</span></div>
            <button className="icon-btn" aria-label={`Remove ${l.full_name}`} onClick={() => removeListener(l.id)}><I.Close /></button>
          </div>
        ))}
      </main>

      <footer className="footer-bar">
        <button className="btn btn-primary" disabled={saving} onClick={save}>{saving ? 'Saving…' : 'Save attendance'}</button>
      </footer>

      {showListener && <ListenerSheet sessionId={id} students={students} onClose={() => setParams({})} onAdded={() => { loadListeners(); setParams({}); }} />}
    </>
  );
}

function ListenerSheet({ sessionId, students, onClose, onAdded }) {
  const [f, setF] = useState({ full_name: '', father_name: '', phone: '', referred_by: '', note: '', present: true, interested: false });
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);

  async function submit(e) {
    e.preventDefault();
    setBusy(true);
    const { error: err } = await supabase.from('listeners').insert({ ...f, session_id: sessionId, referred_by: f.referred_by || null, father_name: f.father_name || null, note: f.note || null });
    setBusy(false);
    if (err) setError(err); else onAdded();
  }

  return (
    <div className="scrim" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <form className="sheet" role="dialog" aria-label="Add listener" onSubmit={submit}>
        <span className="grabber" />
        <div className="section-head">
          <div><h2 style={{ fontSize: 22 }}>Add listener</h2><span className="meta" style={{ fontSize: 13 }}>Listeners attend a session without enrolling.</span></div>
          <button type="button" className="icon-btn" style={{ background: 'var(--ground)' }} aria-label="Close" onClick={onClose}><I.Close /></button>
        </div>
        <ErrorBox error={error} />
        <div className="field"><label htmlFor="ln">Full name</label><input id="ln" className="input" required value={f.full_name} onChange={(e) => setF({ ...f, full_name: e.target.value })} /></div>
        <div className="field"><label htmlFor="lf">Father’s name</label><input id="lf" className="input" value={f.father_name} onChange={(e) => setF({ ...f, father_name: e.target.value })} /></div>
        <div className="field"><label htmlFor="lp">Phone number</label><input id="lp" className="input" type="tel" placeholder="03XX XXXXXXX" value={f.phone} onChange={(e) => setF({ ...f, phone: e.target.value })} /></div>
        <div className="field"><label htmlFor="lr">Referred by (optional)</label>
          <select id="lr" className="input" value={f.referred_by} onChange={(e) => setF({ ...f, referred_by: e.target.value })}>
            <option value="">—</option>
            <option>Walk-in</option>
            <option>Social media</option>
            {students.map((s) => <option key={s.id} value={`Guest of ${s.full_name}`}>Guest of {s.full_name}</option>)}
          </select>
        </div>
        <div className="field"><label htmlFor="lnote">Note (optional)</label><input id="lnote" className="input" placeholder="e.g. send form link" value={f.note} onChange={(e) => setF({ ...f, note: e.target.value })} /></div>
        <label className="check"><input type="checkbox" checked={f.present} onChange={(e) => setF({ ...f, present: e.target.checked })} />Mark as present in this session</label>
        <label className="check"><input type="checkbox" checked={f.interested} onChange={(e) => setF({ ...f, interested: e.target.checked })} />Interested in registering as a student</label>
        <div className="grid2">
          <button type="button" className="btn btn-ghost" onClick={onClose}>Cancel</button>
          <button className="btn btn-primary" disabled={busy}>Add listener</button>
        </div>
      </form>
    </div>
  );
}
