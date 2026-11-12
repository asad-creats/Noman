import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../auth';
import { supabase } from '../supabase';
import { todayISO } from '../lib';
import { BarHeader, ErrorBox, money } from '../ui';

export default function RegisterStudent() {
  const { courseId, courses, isAdmin } = useAuth();
  const nav = useNavigate();
  const [f, setF] = useState({
    full_name: '', father_name: '', reg_no: '', phone: '', whatsapp: '', city: '',
    joined_on: todayISO(), course_id: courseId, group_id: '', fee_status: 'unpaid', fee_paid: '',
  });
  const [groups, setGroups] = useState([]);
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);
  const course = courses.find((c) => c.id === f.course_id);

  useEffect(() => {
    supabase.from('study_groups').select('id, name, incharge:profiles(full_name)').eq('course_id', f.course_id).order('sort').order('name')
      .then(({ data }) => setGroups(data || []));
  }, [f.course_id]);

  async function submit(e) {
    e.preventDefault();
    setBusy(true); setError(null);
    const row = { ...f };
    Object.keys(row).forEach((k) => { if (row[k] === '') row[k] = null; });
    if (!row.whatsapp) row.whatsapp = row.phone;
    row.fee_paid = f.fee_status === 'paid' ? (course?.fee_amount ?? null) : f.fee_status === 'partial' ? Number(f.fee_paid || 0) : null;
    const { error: err } = await supabase.from('students').insert(row);
    setBusy(false);
    if (err) setError(err); else nav('/students', { replace: true });
  }

  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });

  return (
    <>
      <BarHeader title="Register new student" sub={course?.name} back="/" />
      <form id="reg" className="screen-main" style={{ paddingTop: 16 }} onSubmit={submit}>
        <ErrorBox error={error} />
        {isAdmin && (
          <div className="field"><label htmlFor="rcourse">Course</label>
            <select id="rcourse" className="input" value={f.course_id} onChange={(e) => setF({ ...f, course_id: e.target.value, group_id: '' })}>
              {courses.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>
        )}
        <div className="field"><label htmlFor="rn">Student’s name</label><input id="rn" className="input" required value={f.full_name} onChange={set('full_name')} /></div>
        <div className="field"><label htmlFor="gn">Father’s / guardian’s name</label><input id="gn" className="input" value={f.father_name} onChange={set('father_name')} /></div>
        <div className="grid2">
          <div className="field"><label htmlFor="rp">Contact number</label><input id="rp" className="input" type="tel" placeholder="03XX XXXXXXX" value={f.phone} onChange={set('phone')} /></div>
          <div className="field"><label htmlFor="rw">WhatsApp (if different)</label><input id="rw" className="input" type="tel" value={f.whatsapp} onChange={set('whatsapp')} /></div>
        </div>
        <div className="grid2">
          <div className="field"><label htmlFor="rr">Registration no.</label><input id="rr" className="input" placeholder="70000-261013" value={f.reg_no} onChange={set('reg_no')} /></div>
          <div className="field"><label htmlFor="rcity">City</label><input id="rcity" className="input" value={f.city} onChange={set('city')} /></div>
        </div>
        <div className="field"><label htmlFor="rd">Joining date</label><input id="rd" className="input" type="date" required value={f.joined_on} onChange={set('joined_on')} /></div>

        <h2 className="section-label">Group & incharge</h2>
        {!groups.length ? <p className="meta" style={{ margin: 0 }}>This course has no groups yet. You can put the student in a group later.</p> : (
          <div role="radiogroup" aria-label="Group" style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {[{ id: '', name: 'No group yet' }, ...groups].map((g) => (
              <button type="button" role="radio" aria-checked={f.group_id === g.id} key={g.id || 'none'} className={`choice ${f.group_id === g.id ? 'on' : ''}`} onClick={() => setF({ ...f, group_id: g.id })}>
                <span style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 2 }}>
                  <span className="name">{g.name}</span>
                  {g.id && <span className="meta">Incharge: {g.incharge?.full_name || 'not assigned'}</span>}
                </span>
                <span className="radio-dot" />
              </button>
            ))}
          </div>
        )}

        <h2 className="section-label">Fee{course?.fee_amount ? ` · ${money(course.fee_amount)}` : ''}</h2>
        <div className="seg" role="radiogroup" aria-label="Fee status">
          {[['unpaid', 'Unpaid'], ['partial', 'Part paid'], ['paid', 'Paid'], ['sponsored', 'Sponsored']].map(([k, l]) => (
            <button type="button" key={k} role="radio" aria-checked={f.fee_status === k} className={f.fee_status === k ? 'on' : ''} onClick={() => setF({ ...f, fee_status: k })}>{l}</button>
          ))}
        </div>
        {f.fee_status === 'partial' && (
          <div className="field"><label htmlFor="rfp">Amount paid (PKR)</label><input id="rfp" className="input" type="number" inputMode="numeric" value={f.fee_paid} onChange={set('fee_paid')} /></div>
        )}
      </form>
      <footer className="footer-bar"><button form="reg" className="btn btn-primary" disabled={busy}>{busy ? 'Saving…' : 'Register student'}</button></footer>
    </>
  );
}
