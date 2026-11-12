import { useEffect, useState } from 'react';
import { useAuth } from '../auth';
import { supabase } from '../supabase';
import { Avatar, ContactButtons, CoursePicker, Empty, ErrorBox, Loading, TabBar, money } from '../ui';

const LABEL = { paid: 'Paid', partial: 'Part paid', unpaid: 'Unpaid', sponsored: 'Sponsored' };

export default function Payments() {
  const { courseId, course } = useAuth();
  const [rows, setRows] = useState(null);
  const [filter, setFilter] = useState('unpaid');
  const [q, setQ] = useState('');
  const [error, setError] = useState(null);

  async function load() {
    const { data, error: e } = await supabase.from('students')
      .select('id, full_name, father_name, phone, whatsapp, fee_status, fee_paid, fee_note, group:study_groups(name)')
      .eq('course_id', courseId).eq('status', 'active').order('full_name');
    if (e) setError(e); else setRows(data);
  }
  useEffect(() => { if (courseId) { setRows(null); load(); } }, [courseId]);

  async function update(r, patch) {
    setError(null);
    if (patch.fee_status === 'paid' && r.fee_paid == null) patch.fee_paid = course?.fee_amount ?? null;
    if (patch.fee_status === 'unpaid') patch.fee_paid = null;
    setRows((list) => list.map((x) => (x.id === r.id ? { ...x, ...patch } : x)));
    const { error: e } = await supabase.from('students').update(patch).eq('id', r.id);
    if (e) { setError(e); load(); }
  }

  const count = (k) => (rows || []).filter((r) => r.fee_status === k).length;
  const collected = (rows || []).reduce((n, r) => n + (r.fee_status === 'paid' ? Number(r.fee_paid ?? course?.fee_amount ?? 0) : r.fee_status === 'partial' ? Number(r.fee_paid || 0) : 0), 0);
  const shown = (rows || []).filter((r) => (filter === 'all' || r.fee_status === filter) && r.full_name.toLowerCase().includes(q.toLowerCase()));
  const filters = [['unpaid', `Unpaid ${count('unpaid')}`], ['partial', `Part paid ${count('partial')}`], ['paid', `Paid ${count('paid')}`], ['sponsored', `Sponsored ${count('sponsored')}`], ['all', 'All']];
  const reminder = (r) => `Assalam o Alaikum ${r.full_name}, a gentle reminder that your ${course?.name || 'course'} fee${course?.fee_amount ? ` (${money(course.fee_amount)})` : ''} is still pending. JazakAllah.`;

  return (
    <>
      <header className="page-head" style={{ flexDirection: 'column', alignItems: 'stretch', gap: 12 }}>
        <div>
          <div className="eyebrow"><CoursePicker />{course?.fee_amount ? ` · Fee ${money(course.fee_amount)}` : ''}</div>
          <h1>Payments</h1>
        </div>
        <div className="stats">
          <div className="stat present"><b>{count('paid')}</b><span>Paid</span></div>
          <div className="stat partial"><b>{count('partial')}</b><span>Part paid</span></div>
          <div className="stat absent"><b>{count('unpaid')}</b><span>Unpaid</span></div>
        </div>
        {collected > 0 && <div className="meta" style={{ fontSize: 13, fontWeight: 600 }}>Collected so far: {money(collected)}</div>}
        <div className="chips" role="tablist" aria-label="Filter by fee status">
          {filters.map(([k, l]) => <button key={k} role="tab" aria-selected={filter === k} className={`chip ${filter === k ? 'on' : ''}`} onClick={() => setFilter(k)}>{l}</button>)}
        </div>
      </header>

      <main className="screen-main" style={{ gap: 8, paddingTop: 4 }}>
        <ErrorBox error={error} />
        <label htmlFor="pq" className="sr-only">Search</label>
        <input id="pq" type="search" className="input" placeholder="Search students" value={q} onChange={(e) => setQ(e.target.value)} />
        {!rows ? <Loading /> : !shown.length ? <Empty>No students here.</Empty> : shown.map((r) => (
          <div key={r.id} className="card" style={{ padding: 12, display: 'flex', flexDirection: 'column', gap: 10 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <Avatar name={r.full_name} />
              <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 2 }}>
                <span className="name">{r.full_name}</span>
                <span className="meta">{[r.group?.name, r.fee_status === 'partial' && r.fee_paid ? `${money(r.fee_paid)} paid` : '', r.fee_note].filter(Boolean).join(' · ') || (r.father_name ? `s/o ${r.father_name}` : '')}</span>
              </div>
              <label htmlFor={`fs-${r.id}`} className="sr-only">Fee status for {r.full_name}</label>
              <select id={`fs-${r.id}`} className={`status-select ${r.fee_status}`} value={r.fee_status} onChange={(e) => update(r, { fee_status: e.target.value })}>
                {Object.entries(LABEL).map(([k, l]) => <option key={k} value={k}>{l}</option>)}
              </select>
            </div>
            {(r.fee_status === 'partial' || r.fee_status === 'unpaid') && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                {r.fee_status === 'partial' && (
                  <>
                    <label htmlFor={`fp-${r.id}`} className="meta" style={{ fontWeight: 700 }}>Paid PKR</label>
                    <input id={`fp-${r.id}`} type="number" inputMode="numeric" className="input" style={{ height: 40, width: 110 }}
                      defaultValue={r.fee_paid ?? ''} onBlur={(e) => update(r, { fee_paid: e.target.value === '' ? null : Number(e.target.value) })} />
                  </>
                )}
                <span style={{ flex: 1 }} />
                <ContactButtons name={r.full_name} phone={r.phone} whatsapp={r.whatsapp} message={reminder(r)} />
              </div>
            )}
          </div>
        ))}
      </main>
      <TabBar />
    </>
  );
}
