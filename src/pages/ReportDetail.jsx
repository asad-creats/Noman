import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { supabase } from '../supabase';
import { fmtDay, fmtTime, missedMessage, pct, waLink } from '../lib';
import { Avatar, BarHeader, ContactButtons, Empty, ErrorBox, Loading } from '../ui';
import * as I from '../icons';

export default function ReportDetail() {
  const { id } = useParams();
  const [d, setD] = useState(null);
  const [tab, setTab] = useState('absent');
  const [error, setError] = useState(null);

  async function load() {
    try {
      const { data: s, error: e } = await supabase.from('sessions')
        .select('*, saver:profiles!sessions_saved_by_fkey(full_name), course:courses(name)').eq('id', id).single();
      if (e) throw e;
      const [{ data: att, error: e1 }, { data: lis }, { data: team }, { data: tAtt }] = await Promise.all([
        supabase.from('attendance').select('status, student:students(id, full_name, father_name, reg_no, phone, whatsapp, fee_status, group:study_groups(name, incharge:profiles(full_name)))').eq('session_id', id),
        supabase.from('listeners').select('*').eq('session_id', id).order('created_at'),
        supabase.from('team_members').select('*').eq('course_id', s.course_id).eq('active', true).order('created_at'),
        supabase.from('team_attendance').select('*').eq('session_id', id),
      ]);
      if (e1) throw e1;
      const by = (st) => att.filter((a) => a.status === st && a.student).map((a) => a.student).sort((x, y) => x.full_name.localeCompare(y.full_name));
      setD({ s, present: by('present'), absent: by('absent'), leave: by('leave'), listeners: lis || [], team: team || [],
        teamMarks: Object.fromEntries((tAtt || []).map((t) => [t.member_id, t.mark])) });
    } catch (e) { setError(e); }
  }
  useEffect(() => { load(); }, [id]);

  async function setTeamMark(memberId, mark) {
    const v = mark.trim();
    const { error: e } = v
      ? await supabase.from('team_attendance').upsert({ session_id: id, member_id: memberId, mark: v }, { onConflict: 'session_id,member_id' })
      : await supabase.from('team_attendance').delete().eq('session_id', id).eq('member_id', memberId);
    if (e) setError(e); else setD((x) => ({ ...x, teamMarks: { ...x.teamMarks, [memberId]: v } }));
  }

  if (!d) return error ? <div className="screen-main"><ErrorBox error={error} /></div> : <Loading />;
  const { s, present, absent, leave, listeners, team, teamMarks } = d;
  const total = present.length + absent.length;
  const rate = pct(present.length, total);
  const summary = [
    `${s.course?.name || ''} — ${s.title}, ${fmtDay(s.held_on)}`,
    `Attendance: ${rate}% (${present.length} of ${total})${leave.length ? `, ${leave.length} on leave` : ''}`,
    absent.length ? `Absent (${absent.length}):\n${absent.map((x, i) => `${i + 1}. ${x.full_name}`).join('\n')}` : 'No one absent',
    listeners.length ? `Listeners: ${listeners.map((x) => x.full_name).join(', ')}` : '',
  ].filter(Boolean).join('\n');

  const tabs = [['present', `Present ${present.length}`], ['absent', `Absent ${absent.length}`], ['listener', `Listeners ${listeners.length}`], ['team', 'Team']];
  const meta = (p) => [p.father_name && `s/o ${p.father_name}`, p.group?.name].filter(Boolean).join(' · ');

  return (
    <>
      <BarHeader title={`${s.title} report`} sub={`${fmtDay(s.held_on)}${s.start_time ? ' · ' + fmtTime(s.start_time) : ''}${s.course?.name ? ' · ' + s.course.name : ''}`}
        back="/reports"
        right={<a className="sq" style={{ border: '1px solid var(--line-2)', color: 'var(--ink)' }} href={waLink('', summary)} target="_blank" rel="noreferrer" aria-label="Share report on WhatsApp"><I.Share size={20} /></a>} />
      <main className="screen-main" style={{ paddingTop: 14 }}>
        <ErrorBox error={error} />
        <section className="hero" style={{ flexDirection: 'row', alignItems: 'center', padding: 16 }}>
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 2 }}>
            <span style={{ fontSize: 36, fontWeight: 800, lineHeight: 1 }}>{rate}%</span>
            <span className="sub" style={{ fontWeight: 600, fontSize: 13 }}>attendance · {present.length} of {total}{leave.length ? ` · ${leave.length} on leave` : ''}</span>
          </div>
          {s.saver?.full_name && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4, fontSize: 13, fontWeight: 700, textAlign: 'right' }}>
              <span>Marked by {s.saver.full_name}</span>
              <span style={{ color: '#BFE0D6', fontWeight: 600 }}>Saved {new Date(s.saved_at).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}</span>
            </div>
          )}
        </section>

        <div className="seg" role="tablist" aria-label="Report sections">
          {tabs.map(([k, l]) => <button key={k} role="tab" aria-selected={tab === k} className={tab === k ? 'on' : ''} onClick={() => setTab(k)} style={{ fontSize: 12 }}>{l}</button>)}
        </div>

        <div className="card">
          {tab === 'present' && (present.length || leave.length ? [...present.map((p) => ['present', p]), ...leave.map((p) => ['leave', p])].map(([st, p]) => (
            <div key={p.id} className="row"><Avatar name={p.full_name} tone={st} />
              <div className="grow"><span className="name">{p.full_name}</span><span className="meta">{meta(p)}</span></div>
              <span className={`badge ${st}`}>{st === 'leave' ? 'Leave' : 'Present'}</span></div>
          )) : <Empty>No one marked present.</Empty>)}
          {tab === 'absent' && (absent.length ? absent.map((p) => (
            <div key={p.id} className="row"><Avatar name={p.full_name} tone="absent" />
              <div className="grow"><span className="name">{p.full_name}</span><span className="meta">{meta(p) || `Fee ${p.fee_status}`}</span></div>
              <ContactButtons name={p.full_name} phone={p.phone} whatsapp={p.whatsapp} message={missedMessage(p.full_name, s.title)} /></div>
          )) : <Empty>No one was absent.</Empty>)}
          {tab === 'listener' && (listeners.length ? listeners.map((l) => (
            <div key={l.id} className="row"><Avatar name={l.full_name} tone="listener" />
              <div className="grow"><span className="name">{l.full_name}</span><span className="meta">{[l.father_name && `s/o ${l.father_name}`, l.note, l.interested ? 'Wants to register' : ''].filter(Boolean).join(' · ') || 'Listener'}</span></div>
              {l.phone ? <ContactButtons name={l.full_name} phone={l.phone} message={`Assalam o Alaikum ${l.full_name}, `} /> : <span className="badge listener">Listener</span>}</div>
          )) : <Empty>No listeners.</Empty>)}
          {tab === 'team' && (team.length ? team.map((m) => (
            <div key={m.id} className="row">
              <Avatar name={m.full_name} />
              <div className="grow"><span className="name">{m.full_name}</span><span className="meta">{m.role || 'Team'}</span></div>
              <label htmlFor={`tm-${m.id}`} className="sr-only">Arrival for {m.full_name}</label>
              <input id={`tm-${m.id}`} className="input" style={{ width: 96, height: 40, textAlign: 'center', fontWeight: 700 }}
                placeholder="P / A / 5:30" defaultValue={teamMarks[m.id] || ''} onBlur={(e) => e.target.value !== (teamMarks[m.id] || '') && setTeamMark(m.id, e.target.value)} />
            </div>
          )) : <Empty>No team members for this course yet. Add them in Account › Team & groups.</Empty>)}
        </div>

        <Link to={`/session/${s.id}`} className="btn btn-outline" style={{ height: 48, fontSize: 15 }}><I.Pencil />Edit attendance</Link>
      </main>
    </>
  );
}
