import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../auth';
import { supabase } from '../supabase';
import { Avatar, BarHeader, ContactButtons, Empty, ErrorBox, Loading } from '../ui';
import * as I from '../icons';

const STATUS = { active: 'Active', left: 'Left', not_joined: 'Not joined' };

export default function Students() {
  const { courseId, course } = useAuth();
  const [rows, setRows] = useState(null);
  const [groups, setGroups] = useState([]);
  const [q, setQ] = useState('');
  const [status, setStatus] = useState('active');
  const [error, setError] = useState(null);

  async function load() {
    const [{ data: st, error: e }, { data: gs }] = await Promise.all([
      supabase.from('students').select('*').eq('course_id', courseId).order('full_name'),
      supabase.from('study_groups').select('id, name').eq('course_id', courseId).order('sort').order('name'),
    ]);
    if (e) return setError(e);
    setRows(st); setGroups(gs || []);
  }
  useEffect(() => { if (courseId) load(); }, [courseId]);

  async function update(id, patch) {
    setRows((list) => list.map((x) => (x.id === id ? { ...x, ...patch } : x)));
    const { error: e } = await supabase.from('students').update(patch).eq('id', id);
    if (e) { setError(e); load(); }
  }

  const count = (k) => (rows || []).filter((s) => s.status === k).length;
  const shown = (rows || []).filter((s) => s.status === status && `${s.full_name} ${s.father_name || ''} ${s.reg_no || ''}`.toLowerCase().includes(q.toLowerCase()));

  return (
    <>
      <BarHeader title="All students" sub={course?.name} back="/"
        right={<Link to="/students/new" className="btn btn-outline btn-sm"><I.Plus />New</Link>} />
      <main className="screen-main" style={{ paddingTop: 14, gap: 8 }}>
        <ErrorBox error={error} />
        <label htmlFor="sq" className="sr-only">Search students</label>
        <input id="sq" type="search" className="input" placeholder="Search name, father name or reg. no." value={q} onChange={(e) => setQ(e.target.value)} />
        <div className="chips" role="tablist" aria-label="Status">
          {Object.entries(STATUS).map(([k, l]) => <button key={k} role="tab" aria-selected={status === k} className={`chip ${status === k ? 'on' : ''}`} onClick={() => setStatus(k)}>{l} {count(k)}</button>)}
        </div>
        {!rows ? <Loading /> : !shown.length ? <Empty>No students here.</Empty> : shown.map((s) => (
          <div key={s.id} className="card" style={{ padding: 12, display: 'flex', flexDirection: 'column', gap: 10 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <Avatar name={s.full_name} />
              <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column' }}>
                <span className="name">{s.full_name}</span>
                <span className="meta">{[s.father_name && `s/o ${s.father_name}`, s.reg_no, s.city].filter(Boolean).join(' · ')}</span>
                {s.remarks && <span className="meta" style={{ fontStyle: 'italic' }}>{s.remarks}</span>}
              </div>
              <ContactButtons name={s.full_name} phone={s.phone} whatsapp={s.whatsapp} message={`Assalam o Alaikum ${s.full_name}, `} />
            </div>
            <div className="grid2">
              <div className="field"><label htmlFor={`g-${s.id}`} style={{ fontSize: 12 }}>Group</label>
                <select id={`g-${s.id}`} className="input" style={{ height: 40 }} value={s.group_id || ''} onChange={(e) => update(s.id, { group_id: e.target.value || null })}>
                  <option value="">No group</option>
                  {groups.map((g) => <option key={g.id} value={g.id}>{g.name}</option>)}
                </select>
              </div>
              <div className="field"><label htmlFor={`st-${s.id}`} style={{ fontSize: 12 }}>Status</label>
                <select id={`st-${s.id}`} className="input" style={{ height: 40 }} value={s.status} onChange={(e) => update(s.id, { status: e.target.value })}>
                  {Object.entries(STATUS).map(([k, l]) => <option key={k} value={k}>{l}</option>)}
                </select>
              </div>
            </div>
          </div>
        ))}
      </main>
    </>
  );
}
