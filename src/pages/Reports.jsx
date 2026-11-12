import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../auth';
import { sessionsWithCounts } from '../data';
import { fmtDay, fmtMonth, fmtTime, monthEnd, monthStart, pct, shiftMonth } from '../lib';
import { Empty, ErrorBox, CoursePicker, Loading, TabBar } from '../ui';
import * as I from '../icons';

export default function Reports() {
  const { courseId } = useAuth();
  const [month, setMonth] = useState(monthStart());
  const [list, setList] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!courseId) return;
    setList(null);
    sessionsWithCounts(courseId, { from: month, to: monthEnd(month) }).then(setList).catch(setError);
  }, [courseId, month]);

  const marked = (list || []).filter((s) => s.present + s.absent > 0);
  const avg = marked.length ? Math.round(marked.reduce((n, s) => n + pct(s.present, s.present + s.absent), 0) / marked.length) : 0;
  const listeners = (list || []).reduce((n, s) => n + s.listeners, 0);

  return (
    <>
      <header className="page-head">
        <div>
          <div className="eyebrow">Tap a session to open its report · <CoursePicker /></div>
          <h1>Reports</h1>
        </div>
      </header>
      <main className="screen-main" style={{ gap: 12 }}>
        <div className="section-head card" style={{ padding: 4 }}>
          <button className="icon-btn" aria-label="Previous month" onClick={() => setMonth(shiftMonth(month, -1))}><I.Back /></button>
          <b>{fmtMonth(month)}</b>
          <button className="icon-btn" aria-label="Next month" onClick={() => setMonth(shiftMonth(month, 1))}><I.Chevron size={22} /></button>
        </div>
        <ErrorBox error={error} />
        {!list ? <Loading /> : (
          <>
            <section className="card stats-card">
              <div><b style={{ color: 'var(--primary)' }}>{avg}%</b><span>Avg attendance</span></div>
              <div><b>{marked.length}</b><span>Classes held</span></div>
              <div><b style={{ color: 'var(--listener)' }}>{listeners}</b><span>Listeners</span></div>
            </section>
            {!list.length && <Empty>No sessions in {fmtMonth(month)}.</Empty>}
            {list.filter((s) => s.present + s.absent + s.leave > 0 || s.title !== 'Team session').map((s) => {
              const p = pct(s.present, s.present + s.absent);
              return (
                <Link key={s.id} to={`/reports/${s.id}`} className="card" style={{ padding: '14px 16px', display: 'flex', flexDirection: 'column', gap: 10, color: 'var(--ink)' }}>
                  <div className="section-head">
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                      <span style={{ fontSize: 15, fontWeight: 800 }}>{s.title}</span>
                      <span style={{ fontSize: 13, color: 'var(--muted)' }}>{fmtDay(s.held_on)}{s.start_time ? ` · ${fmtTime(s.start_time)}` : ''}</span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <b style={{ fontSize: 18, color: s.saved_at ? 'var(--primary)' : 'var(--muted)' }}>{s.saved_at ? `${p}%` : 'Not marked'}</b>
                      <I.Chevron style={{ color: 'var(--muted)' }} />
                    </div>
                  </div>
                  <div className="bar" aria-hidden="true"><span style={{ width: `${p}%` }} /></div>
                  <div style={{ display: 'flex', gap: 14, fontSize: 13, fontWeight: 600 }}>
                    <span style={{ color: 'var(--primary)' }}>{s.present} present</span>
                    <span style={{ color: 'var(--absent)' }}>{s.absent} absent</span>
                    {s.leave > 0 && <span style={{ color: 'var(--leave)' }}>{s.leave} leave</span>}
                    <span style={{ color: 'var(--listener)' }}>{s.listeners} listeners</span>
                  </div>
                </Link>
              );
            })}
          </>
        )}
      </main>
      <TabBar />
    </>
  );
}
