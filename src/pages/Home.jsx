import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../auth';
import { supabase } from '../supabase';
import { createSession, sessionsWithCounts } from '../data';
import { dayNum, fmtLong, fmtTime, todayISO, weekdayShort } from '../lib';
import { Empty, ErrorBox, CoursePicker, Loading, TabBar, UserChip } from '../ui';
import * as I from '../icons';

export default function Home() {
  const { courseId, course } = useAuth();
  const nav = useNavigate();
  const [sessions, setSessions] = useState(null);
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [form, setForm] = useState({ title: '', held_on: todayISO(), start_time: '' });
  const [studentCount, setStudentCount] = useState(0);

  useEffect(() => {
    if (!courseId) return;
    setSessions(null);
    sessionsWithCounts(courseId, { limit: 12 }).then(setSessions).catch(setError);
    supabase.from('students').select('id', { count: 'exact', head: true }).eq('course_id', courseId).eq('status', 'active')
      .then(({ count }) => setStudentCount(count || 0));
  }, [courseId]);

  const today = sessions?.find((s) => s.held_on === todayISO());
  const recent = (sessions || []).filter((s) => s !== today && s.present + s.absent + s.leave > 0);

  async function start(extra, then = '') {
    setBusy(true); setError(null);
    try {
      const s = await createSession(courseId, extra);
      nav(`/session/${s.id}${then}`);
    } catch (e) { setError(e); setBusy(false); }
  }

  const goListener = () => (today ? nav(`/session/${today.id}?listener=1`) : start({}, '?listener=1'));

  return (
    <>
      <header className="page-head">
        <div>
          <div className="eyebrow">{fmtLong(todayISO())} · <CoursePicker /></div>
          <h1>Sessions</h1>
        </div>
        <UserChip />
      </header>

      <main className="screen-main">
        <ErrorBox error={error} />
        {!sessions ? <Loading /> : (
          <>
            <section className="hero">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                  <span className="kicker">Today{today?.start_time ? ` · ${fmtTime(today.start_time)}` : ''}</span>
                  <span className="title">{today ? today.title : 'No session yet'}</span>
                  <span className="sub">{studentCount} active students{course?.weekday ? ` · classes on ${course.weekday}s` : ''}</span>
                </div>
                {today && (
                  <span className="badge" style={{ background: '#fff', color: 'var(--primary)' }}>
                    {today.saved_at ? `${today.present} present` : 'Not marked'}
                  </span>
                )}
              </div>
              {today ? (
                <Link to={`/session/${today.id}`} className="btn"><I.Check size={20} sw={2.2} />{today.saved_at ? 'Update attendance' : 'Take attendance'}</Link>
              ) : (
                <button className="btn" disabled={busy} onClick={() => start()}><I.Check size={20} sw={2.2} />Start today’s session</button>
              )}
              <button onClick={() => setShowNew(true)} style={{ background: 'none', border: 0, color: '#D6EBE4', fontWeight: 700, fontSize: 14, minHeight: 32 }}>+ Session on another date</button>
            </section>

            <section className="quick">
              <Link to="/students/new"><span className="ic" style={{ background: 'var(--primary-soft)', color: 'var(--primary)' }}><I.UserPlus size={20} /></span>Register student</Link>
              <a href="#listener" onClick={(e) => { e.preventDefault(); goListener(); }}><span className="ic" style={{ background: 'var(--listener-soft)', color: 'var(--listener)' }}><I.Headphones size={20} /></span>Add listener</a>
              <Link to="/students"><span className="ic" style={{ background: 'var(--absent-soft)', color: 'var(--absent)' }}><I.Users size={20} /></span>All students</Link>
            </section>

            <section className="list-card">
              <div className="section-head"><h2>Recent sessions</h2><Link to="/reports" style={{ fontSize: 14, fontWeight: 700 }}>See all</Link></div>
              {!recent.length && <Empty>No past sessions yet.</Empty>}
              {recent.map((s) => (
                <Link key={s.id} to={`/reports/${s.id}`} className="card row" style={{ color: 'var(--ink)' }}>
                  <div className="datebox"><span>{weekdayShort(s.held_on)}</span><b>{dayNum(s.held_on)}</b></div>
                  <div className="grow">
                    <span className="name">{s.title}</span>
                    <span style={{ fontSize: 13, color: 'var(--muted)' }}>{s.present} present · <b style={{ color: 'var(--absent)' }}>{s.absent} absent</b> · {s.listeners} listeners</span>
                  </div>
                  <I.Chevron style={{ color: 'var(--muted)' }} />
                </Link>
              ))}
            </section>
          </>
        )}
      </main>
      <TabBar />

      {showNew && (
        <div className="scrim" onClick={(e) => e.target === e.currentTarget && setShowNew(false)}>
          <form className="sheet" role="dialog" aria-label="New session" onSubmit={(e) => { e.preventDefault(); start(form); }}>
            <span className="grabber" />
            <div className="section-head"><h2 style={{ fontSize: 22 }}>New session</h2>
              <button type="button" className="icon-btn" style={{ background: 'var(--ground)' }} aria-label="Close" onClick={() => setShowNew(false)}><I.Close /></button></div>
            <div className="field"><label htmlFor="st">Title (leave blank for the next number)</label><input id="st" className="input" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} /></div>
            <div className="grid2">
              <div className="field"><label htmlFor="sd">Date</label><input id="sd" type="date" className="input" required value={form.held_on} onChange={(e) => setForm({ ...form, held_on: e.target.value })} /></div>
              <div className="field"><label htmlFor="tm">Time</label><input id="tm" type="time" className="input" value={form.start_time} onChange={(e) => setForm({ ...form, start_time: e.target.value })} /></div>
            </div>
            <button className="btn btn-primary" disabled={busy}>Create and take attendance</button>
          </form>
        </div>
      )}
    </>
  );
}
