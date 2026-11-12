import { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { supabase } from './supabase';

const AuthCtx = createContext(null);
const COURSE_KEY = 'att.adminCourse';

export function AuthProvider({ children }) {
  const [session, setSession] = useState(undefined); // undefined = still loading
  const [profile, setProfile] = useState(null);
  const [loadError, setLoadError] = useState(null);
  const [courses, setCourses] = useState([]);
  const [adminCourse, setAdminCourseState] = useState(() => {
    try { return localStorage.getItem(COURSE_KEY) || ''; } catch { return ''; }
  });

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSession(data.session));
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => setSession(s));
    return () => sub.subscription.unsubscribe();
  }, []);

  const refresh = useCallback(async () => {
    if (!session) { setProfile(null); return; }
    setLoadError(null);
    const [{ data: p, error: e1 }, { data: g, error: e2 }] = await Promise.all([
      supabase.from('profiles').select('*').eq('id', session.user.id).maybeSingle(),
      supabase.from('courses').select('*').order('name'),
    ]);
    if (e1 || e2) { setLoadError(e1 || e2); return; }
    if (!p) { setLoadError(new Error('Your account has no profile yet. Ask your admin to check the database setup.')); return; }
    setProfile(p);
    setCourses(g || []);
  }, [session]);

  useEffect(() => { refresh(); }, [refresh]);

  const setAdminCourse = (id) => {
    setAdminCourseState(id);
    try { localStorage.setItem(COURSE_KEY, id); } catch { /* ignore */ }
  };

  const isAdmin = profile?.role === 'admin';
  let courseId = isAdmin ? (adminCourse || profile?.course_id || courses[0]?.id || null) : profile?.course_id || null;
  if (isAdmin && courseId && courses.length && !courses.some((c) => c.id === courseId)) courseId = courses[0]?.id || null;
  const course = courses.find((c) => c.id === courseId) || null;

  const value = {
    session, user: session?.user || null, profile, loadError, courses, isAdmin, courseId, course,
    setAdminCourse, refresh,
    signOut: () => supabase.auth.signOut(),
  };
  return <AuthCtx.Provider value={value}>{children}</AuthCtx.Provider>;
}

export const useAuth = () => useContext(AuthCtx);
