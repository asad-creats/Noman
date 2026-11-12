import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import './styles.css';
import { isConfigured } from './supabase';
import { AuthProvider, useAuth } from './auth';
import { Loading } from './ui';
import Login from './pages/Login';
import Home from './pages/Home';
import TakeAttendance from './pages/TakeAttendance';
import Absent from './pages/Absent';
import MyGroup from './pages/MyGroup';
import Reports from './pages/Reports';
import ReportDetail from './pages/ReportDetail';
import Payments from './pages/Payments';
import RegisterStudent from './pages/RegisterStudent';
import Students from './pages/Students';
import Account from './pages/Account';
import Team from './pages/Team';

function NotConfigured() {
  return (
    <div className="screen-main" style={{ justifyContent: 'center' }}>
      <h1 style={{ margin: 0 }}>Almost there</h1>
      <p>The app isn't connected to a database yet. Copy <code>.env.example</code> to <code>.env</code>, add your Supabase URL and key, then restart the app. The README has the full steps.</p>
    </div>
  );
}

function Waiting() {
  const { signOut, refresh, profile } = useAuth();
  return (
    <div className="screen-main" style={{ justifyContent: 'center' }}>
      <h1 style={{ margin: 0, fontSize: 24 }}>Waiting for your admin</h1>
      <p style={{ color: 'var(--muted)' }}>
        Hi {profile?.full_name}. Your account is created, but an admin still needs to add you to a course.
        Ask them to open <b>Account › Team</b> and put you in your course.
      </p>
      <button className="btn btn-primary" onClick={refresh}>Check again</button>
      <button className="btn btn-ghost" onClick={signOut}>Sign out</button>
    </div>
  );
}

function Gate() {
  const { session, profile, isAdmin, courseId, courses, loadError, refresh, signOut } = useAuth();
  if (session === undefined) return <Loading />;
  if (!session) return <Login />;
  if (loadError) return (
    <div className="screen-main" style={{ justifyContent: 'center' }}>
      <h1 style={{ margin: 0, fontSize: 24 }}>Couldn’t load your account</h1>
      <div className="error" role="alert">{String(loadError.message || loadError)}</div>
      <p style={{ color: 'var(--muted)' }}>Check your internet connection and try again.</p>
      <button className="btn btn-primary" onClick={refresh}>Try again</button>
      <button className="btn btn-ghost" onClick={signOut}>Sign out</button>
    </div>
  );
  if (!profile) return <Loading />;
  if (!isAdmin && !courseId) return <Waiting />;
  if (isAdmin && !courses.length) return <Team firstRun />;
  return (
    <Routes>
      <Route path="/" element={<Home />} />
      <Route path="/session/:id" element={<TakeAttendance />} />
      <Route path="/absent" element={<Absent />} />
      <Route path="/my-group" element={<MyGroup />} />
      <Route path="/reports" element={<Reports />} />
      <Route path="/reports/:id" element={<ReportDetail />} />
      <Route path="/payments" element={<Payments />} />
      <Route path="/students" element={<Students />} />
      <Route path="/students/new" element={<RegisterStudent />} />
      <Route path="/account" element={<Account />} />
      <Route path="/team" element={isAdmin ? <Team /> : <Navigate to="/" />} />
      <Route path="*" element={<Navigate to="/" />} />
    </Routes>
  );
}

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <div className="app">
      {isConfigured ? (
        <BrowserRouter>
          <AuthProvider><Gate /></AuthProvider>
        </BrowserRouter>
      ) : <NotConfigured />}
    </div>
  </React.StrictMode>
);
