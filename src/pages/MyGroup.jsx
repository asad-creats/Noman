import { useEffect, useState } from 'react';
import { useAuth } from '../auth';
import { supabase } from '../supabase';
import { absenceNote, fetchAll, streaks } from '../data';
import { fmtDay, missedMessage, pct, todayISO, waLink } from '../lib';
import { Avatar, ContactButtons, Empty, ErrorBox, Loading, TabBar, UserChip } from '../ui';
import * as I from '../icons';

const ALL = 'all';

export default function MyGroup() {
  const { courseId, course, profile } = useAuth();
  const [groups, setGroups] = useState(null);
  const [groupId, setGroupId] = useState('');
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!courseId) return;
    setGroups(null); setGroupId('');
    supabase.from('study_groups').select('id, name, incharge_id, incharge:profiles(full_name)').eq('course_id', courseId).order('sort').order('name')
      .then(({ data: g, error: e }) => {
        if (e) return setError(e);
        setGroups(g);
        const mine = g.find((x) => x.incharge_id === profile.id);
        setGroupId(mine?.id || g[0]?.id || ALL);
      });
  }, [courseId, profile.id]);

  useEffect(() => {
    if (!groupId) return;
    setData(null);
    (async () => {
      try {
        let sq = supabase.from('students').select('id, full_name, father_name, phone, whatsapp, fee_status, fee_paid')
          .eq('course_id', courseId).eq('status', 'active').order('full_name');
        if (groupId !== ALL) sq = sq.eq('group_id', groupId);
        const { data: students, error: e1 } = await sq;
        if (e1) throw e1;
        const { data: sessions, error: e2 } = await supabase.from('sessions').select('id, title, held_on')
          .eq('course_id', courseId).not('saved_at', 'is', null).lte('held_on', todayISO()).order('held_on');
        if (e2) throw e2;
        const ids = students.map((s) => s.id);
        const att = ids.length && sessions.length
          ? await fetchAll(() => supabase.from('attendance').select('session_id, student_id, status').in('student_id', ids))
          : [];
        const held = sessions.filter((s) => att.some((a) => a.session_id === s.id));
        const last = held[held.length - 1] || null;
        const info = streaks(held, att);
        const rows = students.map((s) => {
          const mine = att.filter((a) => a.student_id === s.id);
          const present = mine.filter((a) => a.status === 'present').length;
          const marked = mine.filter((a) => a.status !== 'leave').length;
          return {
            ...s, present, marked, pct: pct(present, marked),
            absentLast: last && mine.some((a) => a.session_id === last.id && a.status === 'absent'),
            info: last ? info[`${last.id}:${s.id}`] : null,
          };
        });
        setData({ rows, last, held: held.length });
      } catch (e) { setError(e); }
    })();
  }, [groupId, courseId]);

  const group = groups?.find((g) => g.id === groupId);
  const absentNow = data?.rows.filter((r) => r.absentLast) || [];
  const avg = data && data.rows.length ? Math.round(data.rows.reduce((n, r) => n + r.pct, 0) / data.rows.length) : 0;
  const shareText = data?.last
    ? `${course?.name}${group ? ` — ${group.name}` : ''}\nAbsent in ${data.last.title} (${fmtDay(data.last.held_on)}):\n${absentNow.map((r, i) => `${i + 1}. ${r.full_name}${r.father_name ? ` s/o ${r.father_name}` : ''}`).join('\n')}`
    : '';

  return (
    <>
      <header className="page-head">
        <div style={{ minWidth: 0 }}>
          <div className="eyebrow">
            <label htmlFor="grp" className="sr-only">Group</label>
            <select id="grp" value={groupId} onChange={(e) => setGroupId(e.target.value)}
              style={{ border: 0, background: 'transparent', font: 'inherit', color: 'inherit', padding: 0, maxWidth: 240 }}>
              {(groups || []).map((g) => <option key={g.id} value={g.id}>{g.name}{g.incharge?.full_name ? ` · ${g.incharge.full_name}` : ''}</option>)}
              <option value={ALL}>Whole course</option>
            </select>
          </div>
          <h1>{group?.incharge_id === profile.id ? 'My students' : group ? group.name : 'All students'}</h1>
        </div>
        <UserChip />
      </header>

      <main className="screen-main">
        <ErrorBox error={error} />
        {groups && !groups.length && <div className="notice">This course has no groups yet. An admin can create them in Account › Team & groups.</div>}
        {!data ? <Loading /> : (
          <>
            <section className="card stats-card">
              <div><b>{data.rows.length}</b><span>Students</span></div>
              <div><b style={{ color: 'var(--primary)' }}>{avg}%</b><span>Attendance so far</span></div>
              <div><b style={{ color: 'var(--absent)' }}>{absentNow.length}</b><span>Absent last class</span></div>
            </section>

            {data.last && absentNow.length > 0 && (
              <section className="absent-box">
                <div className="section-head"><h2>Absent in {data.last.title}</h2><span style={{ fontSize: 12, fontWeight: 700, color: 'var(--absent-dark)' }}>{fmtDay(data.last.held_on)}</span></div>
                {absentNow.map((r) => (
                  <div key={r.id} className="row" style={{ padding: '10px 10px 10px 12px' }}>
                    <div className="grow">
                      <span className="name">{r.full_name}</span>
                      <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--absent)' }}>{absenceNote(r.info) || 'Missed the last class'}</span>
                    </div>
                    <ContactButtons name={r.full_name} phone={r.phone} whatsapp={r.whatsapp} message={missedMessage(r.full_name, data.last.title)} waLabel />
                  </div>
                ))}
                <a className="btn btn-wa" href={waLink('', shareText)} target="_blank" rel="noreferrer"><I.Share />Share absent list on WhatsApp</a>
              </section>
            )}

            <section className="list-card">
              <h2 className="section-label">Attendance · {data.held} classes held</h2>
              {!data.rows.length && <Empty>No students in this group yet.</Empty>}
              {data.rows.map((r) => (
                <div key={r.id} className="card row">
                  <Avatar name={r.full_name} tone={r.absentLast ? 'absent' : 'present'} />
                  <div className="grow" style={{ gap: 6 }}>
                    <div className="section-head"><span className="name">{r.full_name}</span><b style={{ fontSize: 13, color: 'var(--primary)' }}>{r.pct}%</b></div>
                    <div className="bar" aria-hidden="true" style={{ height: 6 }}><span style={{ width: `${r.pct}%` }} /></div>
                    <span className="meta">{r.present} of {r.marked} classes · Fee {r.fee_status}</span>
                  </div>
                  {(r.whatsapp || r.phone) && <a className="sq wa" href={waLink(r.whatsapp || r.phone, `Assalam o Alaikum ${r.full_name}, `)} target="_blank" rel="noreferrer" aria-label={`Message ${r.full_name} on WhatsApp`}><I.Chat /></a>}
                </div>
              ))}
            </section>
          </>
        )}
      </main>
      <TabBar />
    </>
  );
}
