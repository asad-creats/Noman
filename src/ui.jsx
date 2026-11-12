import { Link, NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from './auth';
import { initials, telLink, waLink } from './lib';
import * as I from './icons';

export function TabBar() {
  const tabs = [
    ['/', 'Sessions', I.Calendar],
    ['/absent', 'Absent', I.UserX],
    ['/my-group', 'My group', I.Users],
    ['/reports', 'Reports', I.Doc],
    ['/payments', 'Payments', I.Wallet],
  ];
  return (
    <nav className="tabbar" aria-label="Main">
      {tabs.map(([to, label, Icon]) => (
        <NavLink key={to} to={to} end={to === '/'} className={({ isActive }) => (isActive ? 'active' : '')}>
          <span className="pill"><Icon /></span>{label}
        </NavLink>
      ))}
    </nav>
  );
}

export function BarHeader({ title, sub, back = -1, right }) {
  const nav = useNavigate();
  return (
    <header className="bar-head">
      <button className="icon-btn" aria-label="Back" onClick={() => (typeof back === 'string' ? nav(back) : nav(back))}><I.Back /></button>
      <div style={{ flex: 1, minWidth: 0 }}>
        <h1>{title}</h1>
        {sub && <div className="sub">{sub}</div>}
      </div>
      {right}
    </header>
  );
}

export function UserChip() {
  const { profile, isAdmin } = useAuth();
  const name = profile?.full_name || 'Me';
  const short = name.split(' ')[0] + (name.split(' ')[1] ? ' ' + name.split(' ')[1][0] + '.' : '');
  return (
    <Link to="/account" className="user-chip" aria-label={`Signed in as ${name}. Account and switch user`}>
      <span className="who">{short}<small>{isAdmin ? 'Admin' : 'Incharge'}</small></span>
      <span className="avatar">{initials(name)}</span>
    </Link>
  );
}

export function CoursePicker() {
  const { isAdmin, courses, courseId, setAdminCourse, course } = useAuth();
  if (!isAdmin) return <span>{course?.name || 'No course yet'}</span>;
  return (
    <>
      <label htmlFor="crs" className="sr-only">Course</label>
      <select id="crs" value={courseId || ''} onChange={(e) => setAdminCourse(e.target.value)}
        style={{ border: 0, background: 'transparent', font: 'inherit', color: 'inherit', padding: 0, maxWidth: 230 }}>
        {courses.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
      </select>
    </>
  );
}

export const money = (n) => (n == null ? '' : `PKR ${Number(n).toLocaleString('en-PK')}`);

export function Avatar({ name, tone = '' }) {
  return <span className={`avatar ${tone}`}>{initials(name)}</span>;
}

export function ContactButtons({ name, phone, whatsapp, message, waLabel = false }) {
  const wa = whatsapp || phone;
  if (!phone && !wa) return <span className="meta">No phone</span>;
  return (
    <>
      {waLabel ? (
        <a className="wa-pill" href={waLink(wa, message)} target="_blank" rel="noreferrer"><I.Chat size={18} />WhatsApp</a>
      ) : (
        <a className="sq wa" href={waLink(wa, message)} target="_blank" rel="noreferrer" aria-label={`Message ${name} on WhatsApp`}><I.Chat /></a>
      )}
      <a className="sq call" href={telLink(phone || wa)} aria-label={`Call ${name}`}><I.Phone /></a>
    </>
  );
}

export const Loading = () => <div className="loading">Loading…</div>;
export const Empty = ({ children }) => <div className="empty">{children}</div>;
export const ErrorBox = ({ error }) => (error ? <div className="error" role="alert">{String(error.message || error)}</div> : null);
