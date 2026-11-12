import { useEffect, useState } from 'react';
import { useAuth } from '../auth';
import { supabase } from '../supabase';
import { Avatar, BarHeader, ErrorBox, Loading, money } from '../ui';

export default function Team({ firstRun = false }) {
  const { courses, courseId, setAdminCourse, refresh, profile } = useAuth();
  const [people, setPeople] = useState(null);
  const [groups, setGroups] = useState([]);
  const [team, setTeam] = useState([]);
  const [form, setForm] = useState({ course: '', group: '', member: '', role: '' });
  const [error, setError] = useState(null);

  async function load() {
    const [{ data: p, error: e }, { data: g }, { data: t }] = await Promise.all([
      supabase.from('profiles').select('*').order('created_at'),
      courseId ? supabase.from('study_groups').select('*').eq('course_id', courseId).order('sort').order('name') : { data: [] },
      courseId ? supabase.from('team_members').select('*').eq('course_id', courseId).order('created_at') : { data: [] },
    ]);
    if (e) setError(e);
    setPeople(p || []); setGroups(g || []); setTeam(t || []);
  }
  useEffect(() => { load(); }, [courseId]);

  const run = async (promise, after = load) => {
    const { error: err } = await promise;
    if (err) setError(err); else { setError(null); after(); }
  };

  const addCourse = (e) => { e.preventDefault(); run(supabase.from('courses').insert({ name: form.course.trim() }), () => { setForm({ ...form, course: '' }); refresh(); }); };
  const editCourse = (c) => {
    const name = window.prompt('Course name', c.name); if (!name) return;
    const fee = window.prompt('Full course fee in PKR (leave blank if none)', c.fee_amount ?? '');
    const weekday = window.prompt('Class day (e.g. Friday)', c.weekday ?? '');
    run(supabase.from('courses').update({ name, fee_amount: fee === '' || fee == null ? null : Number(fee), weekday: weekday || null }).eq('id', c.id), refresh);
  };
  const addGroup = (e) => { e.preventDefault(); run(supabase.from('study_groups').insert({ course_id: courseId, name: form.group.trim(), sort: groups.length + 1 }), () => { setForm({ ...form, group: '' }); load(); }); };
  const addMember = (e) => { e.preventDefault(); run(supabase.from('team_members').insert({ course_id: courseId, full_name: form.member.trim(), role: form.role.trim() || null }), () => { setForm({ ...form, member: '', role: '' }); load(); }); };
  const inCourse = (people || []).filter((p) => p.course_id === courseId || p.role === 'admin');

  return (
    <>
      {firstRun ? (
        <header className="page-head"><div><div className="eyebrow">Welcome, you’re the admin</div><h1>Add your first course</h1></div></header>
      ) : <BarHeader title="Team & groups" back="/account" />}
      <main className="screen-main" style={{ paddingTop: 16 }}>
        <ErrorBox error={error} />

        <h2 className="section-label" style={{ margin: 0 }}>Courses</h2>
        <div className="card">
          {courses.map((c) => (
            <div key={c.id} className="row">
              <div className="grow"><span className="name">{c.name}</span><span className="meta">{[c.weekday, c.fee_amount && money(c.fee_amount)].filter(Boolean).join(' · ') || 'No day or fee set'}</span></div>
              <button className="btn btn-ghost btn-sm" onClick={() => editCourse(c)}>Edit</button>
            </div>
          ))}
          <form onSubmit={addCourse} className="row">
            <label htmlFor="nc" className="sr-only">New course name</label>
            <input id="nc" className="input" style={{ flex: 1 }} placeholder="New course name" required value={form.course} onChange={(e) => setForm({ ...form, course: e.target.value })} />
            <button className="btn btn-primary btn-sm">Add</button>
          </form>
        </div>

        {!firstRun && courseId && (
          <>
            <div className="field" style={{ marginTop: 8 }}>
              <label htmlFor="tc">Manage groups and team for</label>
              <select id="tc" className="input" value={courseId} onChange={(e) => setAdminCourse(e.target.value)}>
                {courses.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>

            <h2 className="section-label">Groups & group incharges</h2>
            <div className="card">
              {groups.map((g) => (
                <div key={g.id} className="row" style={{ flexWrap: 'wrap' }}>
                  <div className="grow" style={{ minWidth: 120 }}><span className="name">{g.name}</span></div>
                  <label htmlFor={`gi-${g.id}`} className="sr-only">Incharge of {g.name}</label>
                  <select id={`gi-${g.id}`} className="input" style={{ height: 40, width: 170 }} value={g.incharge_id || ''}
                    onChange={(e) => run(supabase.from('study_groups').update({ incharge_id: e.target.value || null }).eq('id', g.id))}>
                    <option value="">No incharge</option>
                    {inCourse.map((p) => <option key={p.id} value={p.id}>{p.full_name}</option>)}
                  </select>
                </div>
              ))}
              <form onSubmit={addGroup} className="row">
                <label htmlFor="ng" className="sr-only">New group name</label>
                <input id="ng" className="input" style={{ flex: 1 }} placeholder="New group, e.g. Group 7 Nuh" required value={form.group} onChange={(e) => setForm({ ...form, group: e.target.value })} />
                <button className="btn btn-primary btn-sm">Add</button>
              </form>
            </div>
            <p className="meta" style={{ margin: 0, fontSize: 13 }}>Only people with an account in this course appear in the incharge list.</p>

            <h2 className="section-label">Course team (for team attendance)</h2>
            <div className="card">
              {team.map((m) => (
                <div key={m.id} className="row">
                  <Avatar name={m.full_name} />
                  <div className="grow"><span className="name">{m.full_name}</span><span className="meta">{m.role || 'Team'}{m.active ? '' : ' · inactive'}</span></div>
                  <button className="btn btn-ghost btn-sm" onClick={() => run(supabase.from('team_members').update({ active: !m.active }).eq('id', m.id))}>{m.active ? 'Remove' : 'Restore'}</button>
                </div>
              ))}
              <form onSubmit={addMember} className="row" style={{ flexWrap: 'wrap' }}>
                <input aria-label="Team member name" className="input" style={{ flex: '1 1 140px' }} placeholder="Name" required value={form.member} onChange={(e) => setForm({ ...form, member: e.target.value })} />
                <input aria-label="Role" className="input" style={{ flex: '1 1 140px' }} placeholder="Role, e.g. Sound system" value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })} />
                <button className="btn btn-primary btn-sm">Add</button>
              </form>
            </div>
          </>
        )}

        {!firstRun && (
          <>
            <h2 className="section-label">App accounts</h2>
            <p className="meta" style={{ margin: 0, fontSize: 13 }}>Incharges create their own account on the sign-in screen (“Create a new account”). Then choose their course here.</p>
            {!people ? <Loading /> : people.map((p) => (
              <div key={p.id} className="card" style={{ padding: 12, display: 'flex', flexDirection: 'column', gap: 10 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <Avatar name={p.full_name} tone={p.role === 'admin' ? '' : 'present'} />
                  <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column' }}>
                    <span className="name">{p.full_name}{p.id === profile.id ? ' (me)' : ''}</span>
                    <span className="meta">{p.phone || 'No phone'}</span>
                  </div>
                </div>
                <div className="grid2">
                  <div className="field"><label htmlFor={`r-${p.id}`}>Role</label>
                    <select id={`r-${p.id}`} className="input" style={{ height: 40 }} value={p.role} disabled={p.id === profile.id}
                      onChange={(e) => run(supabase.from('profiles').update({ role: e.target.value }).eq('id', p.id))}>
                      <option value="incharge">Group incharge</option>
                      <option value="admin">Admin</option>
                    </select>
                  </div>
                  <div className="field"><label htmlFor={`c-${p.id}`}>Course</label>
                    <select id={`c-${p.id}`} className="input" style={{ height: 40 }} value={p.course_id || ''}
                      onChange={(e) => run(supabase.from('profiles').update({ course_id: e.target.value || null }).eq('id', p.id), () => { load(); if (p.id === profile.id) refresh(); })}>
                      <option value="">No course</option>
                      {courses.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                    </select>
                  </div>
                </div>
              </div>
            ))}
          </>
        )}
      </main>
    </>
  );
}
