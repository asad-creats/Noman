import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../auth';
import { supabase } from '../supabase';
import { absenceNote, fetchAll, streaks } from '../data';
import { fmtDay, missedMessage, monthStart, todayISO } from '../lib';
import { Avatar, ContactButtons, CoursePicker, Empty, ErrorBox, Loading, TabBar } from '../ui';

const daysAgo = (n) => {
  const d = new Date(); d.setDate(d.getDate() - n);
  return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
};

export default function Absent() {
  const { courseId } = useAuth();
  const [filter, setFilter] = useState('last');
  const [list, setList] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!courseId) return;
    setList(null);
    (async () => {
      try {
        // All marked sessions of the course, oldest first (needed for "in a row" streaks).
        const { data: all, error: e1 } = await supabase.from('sessions').select('id, title, held_on')
          .eq('course_id', courseId).not('saved_at', 'is', null).lte('held_on', todayISO()).order('held_on');
        if (e1) throw e1;
        if (!all.length) { setList([]); return; }
        const marks = await fetchAll(() => supabase.from('attendance').select('session_id, student_id, status')
          .in('session_id', all.map((s) => s.id)));
        const withMarks = all.filter((s) => marks.some((m) => m.session_id === s.id));
        const info = streaks(withMarks, marks);

        let shown = [...withMarks].reverse();
        if (filter === 'last') shown = shown.slice(0, 1);
        if (filter === 'week') shown = shown.filter((s) => s.held_on >= daysAgo(6));
        if (filter === 'month') shown = shown.filter((s) => s.held_on >= monthStart());
        if (filter === 'repeat') shown = shown.slice(0, 1);

        const absentIds = [...new Set(marks.filter((m) => m.status === 'absent' && shown.some((s) => s.id === m.session_id)).map((m) => m.student_id))];
        const people = absentIds.length ? await fetchAll(() => supabase.from('students')
          .select('id, full_name, father_name, phone, whatsapp, fee_status, status, group:study_groups(name, incharge:profiles(full_name))')
          .in('id', absentIds)) : [];
        const byId = Object.fromEntries(people.map((p) => [p.id, p]));

        const out = shown.map((s) => ({
          ...s,
          people: marks.filter((m) => m.session_id === s.id && m.status === 'absent' && byId[m.student_id])
            .map((m) => ({ ...byId[m.student_id], info: info[`${s.id}:${m.student_id}`] }))
            .filter((p) => filter !== 'repeat' || !p.info?.everPresent || p.info.run >= 2)
            .sort((a, b) => (b.info?.run || 0) - (a.info?.run || 0) || a.full_name.localeCompare(b.full_name)),
        })).filter((s) => s.people.length);
        setList(out);
      } catch (e) { setError(e); }
    })();
  }, [courseId, filter]);

  const total = (list || []).reduce((n, s) => n + s.people.length, 0);
  const chips = [['last', 'Last class'], ['repeat', 'Missed 2+ in a row'], ['week', 'This week'], ['month', 'This month']];

  return (
    <>
      <header className="page-head" style={{ flexDirection: 'column', alignItems: 'stretch' }}>
        <div>
          <div className="eyebrow">Pulled from every session · <CoursePicker /></div>
          <h1>Absent students</h1>
        </div>
        <div className="chips" role="tablist" aria-label="Period">
          {chips.map(([k, l]) => (
            <button key={k} role="tab" aria-selected={filter === k} className={`chip ${filter === k ? 'on' : ''}`} onClick={() => setFilter(k)}>
              {l}{filter === k && list ? ` · ${total}` : ''}
            </button>
          ))}
        </div>
      </header>

      <main className="screen-main" style={{ gap: 18 }}>
        <ErrorBox error={error} />
        {!list ? <Loading /> : !list.length ? <Empty>No absences here.</Empty> : list.map((s) => (
          <section key={s.id} className="list-card">
            <Link to={`/reports/${s.id}`} className="section-head" style={{ color: 'var(--ink)', minHeight: 32 }}>
              <span style={{ fontSize: 15, fontWeight: 800 }}>{s.title} <span style={{ fontWeight: 500, color: 'var(--muted)' }}>· {fmtDay(s.held_on)}</span></span>
              <span className="badge absent">{s.people.length} absent</span>
            </Link>
            <div className="card">
              {s.people.map((p) => {
                const note = absenceNote(p.info);
                return (
                  <div key={p.id} className="row">
                    <Avatar name={p.full_name} tone="absent" />
                    <div className="grow">
                      <span className="name">{p.full_name}</span>
                      <span className="meta">{[p.group?.name, p.group?.incharge?.full_name && `Incharge: ${p.group.incharge.full_name}`, p.fee_status === 'paid' ? 'Fee paid' : `Fee ${p.fee_status}`].filter(Boolean).join(' · ')}</span>
                      {note && <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--absent)' }}>{note}</span>}
                    </div>
                    <ContactButtons name={p.full_name} phone={p.phone} whatsapp={p.whatsapp} message={missedMessage(p.full_name, s.title)} />
                  </div>
                );
              })}
            </div>
          </section>
        ))}
      </main>
      <TabBar />
    </>
  );
}
