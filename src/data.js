import { supabase } from './supabase';
import { todayISO } from './lib';

/** Sessions of a group with present/absent/listener counts. */
export async function sessionsWithCounts(courseId, { from, to, limit } = {}) {
  let q = supabase.from('sessions').select('*').eq('course_id', courseId)
    .order('held_on', { ascending: false }).order('created_at', { ascending: false });
  if (from) q = q.gte('held_on', from);
  if (to) q = q.lte('held_on', to);
  if (limit) q = q.limit(limit);
  const { data: sessions, error } = await q;
  if (error) throw error;
  if (!sessions.length) return [];
  const ids = sessions.map((s) => s.id);
  const [att, { data: lis, error: e2 }] = await Promise.all([
    fetchAll(() => supabase.from('attendance').select('session_id, status').in('session_id', ids)),
    supabase.from('listeners').select('session_id').in('session_id', ids),
  ]);
  if (e2) throw e2;
  return sessions.map((s) => ({
    ...s,
    present: att.filter((a) => a.session_id === s.id && a.status === 'present').length,
    leave: att.filter((a) => a.session_id === s.id && a.status === 'leave').length,
    absent: att.filter((a) => a.session_id === s.id && a.status === 'absent').length,
    listeners: lis.filter((l) => l.session_id === s.id).length,
  }));
}

export async function createSession(courseId, { title, held_on, start_time } = {}) {
  let name = title;
  if (!name) {
    const { count } = await supabase.from('sessions').select('id', { count: 'exact', head: true }).eq('course_id', courseId).not('title', 'eq', 'Team session');
    name = `Session ${(count || 0) + 1}`;
  }
  const now = new Date();
  const { data, error } = await supabase.from('sessions').insert({
    course_id: courseId,
    title: name,
    held_on: held_on || todayISO(),
    start_time: start_time || `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`,
  }).select().single();
  if (error) throw error;
  return data;
}

export async function todaySession(courseId) {
  const { data } = await supabase.from('sessions').select('*').eq('course_id', courseId).eq('held_on', todayISO())
    .order('created_at', { ascending: false }).limit(1);
  return data?.[0] || null;
}

/** Supabase returns at most 1000 rows per request; this pages through all of them. */
export async function fetchAll(build, page = 1000) {
  const out = [];
  for (let from = 0; ; from += page) {
    const { data, error } = await build().range(from, from + page - 1);
    if (error) throw error;
    out.push(...data);
    if (data.length < page) return out;
  }
}

/** Absent-in-a-row streak and "never attended" flags, per student, up to each session. */
export function streaks(sessionsAsc, rows) {
  const byStudent = {};
  rows.forEach((r) => { (byStudent[r.student_id] ||= {})[r.session_id] = r.status; });
  const result = {}; // `${sessionId}:${studentId}` -> { run, everPresent }
  Object.entries(byStudent).forEach(([sid, marks]) => {
    let run = 0; let ever = false;
    sessionsAsc.forEach((s) => {
      const m = marks[s.id];
      if (!m) return;
      if (m === 'present') { ever = true; run = 0; } else if (m === 'absent') run += 1;
      result[`${s.id}:${sid}`] = { run, everPresent: ever };
    });
  });
  return result;
}

export function absenceNote(info) {
  if (!info) return '';
  if (!info.everPresent) return 'Hasn’t attended any class yet';
  if (info.run >= 2) return `Absent ${info.run} classes in a row`;
  return '';
}
