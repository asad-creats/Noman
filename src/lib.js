const COUNTRY = String(import.meta.env.VITE_COUNTRY_CODE || '92');

export function initials(name = '') {
  return name.trim().split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0].toUpperCase()).join('') || '?';
}

/** Turn a local number like 0300 1234567 into 923001234567 for WhatsApp. */
export function intlPhone(phone) {
  if (!phone) return '';
  let d = String(phone).replace(/[^\d+]/g, '');
  if (d.startsWith('+')) return d.slice(1);
  if (d.startsWith('00')) return d.slice(2);
  if (d.startsWith('0')) return COUNTRY + d.slice(1);
  if (d.startsWith(COUNTRY)) return d;
  return COUNTRY + d;
}

export function waLink(phone, text) {
  const n = intlPhone(phone);
  const t = text ? `?text=${encodeURIComponent(text)}` : '';
  return n ? `https://wa.me/${n}${t}` : `https://wa.me/${t}`;
}

export function telLink(phone) {
  return phone ? `tel:${String(phone).replace(/[^\d+]/g, '')}` : undefined;
}

export function missedMessage(name, sessionTitle) {
  return `Assalam o Alaikum ${name}, we missed you in ${sessionTitle || 'today’s session'}. Is everything okay?`;
}

export const todayISO = () => {
  const d = new Date();
  return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
};

export function monthStart(iso = todayISO()) {
  return iso.slice(0, 7) + '-01';
}

export function monthEnd(monthISO) {
  const [y, m] = monthISO.split('-').map(Number);
  const last = new Date(Date.UTC(y, m, 0)).getUTCDate();
  return `${monthISO.slice(0, 7)}-${String(last).padStart(2, '0')}`;
}

export function shiftMonth(monthISO, delta) {
  const [y, m] = monthISO.split('-').map(Number);
  const d = new Date(Date.UTC(y, m - 1 + delta, 1));
  return d.toISOString().slice(0, 10);
}

const parse = (iso) => new Date(iso + 'T00:00:00');
export const fmtDay = (iso) => parse(iso).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' });
export const fmtLong = (iso) => parse(iso).toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' });
export const fmtMonth = (iso) => parse(iso).toLocaleDateString('en-GB', { month: 'long', year: 'numeric' });
export const weekdayShort = (iso) => parse(iso).toLocaleDateString('en-GB', { weekday: 'short' });
export const dayNum = (iso) => parse(iso).getDate();
export function fmtTime(t) {
  if (!t) return '';
  const [h, m] = t.split(':').map(Number);
  const ap = h >= 12 ? 'PM' : 'AM';
  return `${((h + 11) % 12) + 1}:${String(m).padStart(2, '0')} ${ap}`;
}

export function ordinal(n) {
  const s = ['th', 'st', 'nd', 'rd'];
  const v = n % 100;
  return n + (s[(v - 20) % 10] || s[v] || s[0]);
}

export const pct = (a, b) => (b ? Math.round((a / b) * 100) : 0);

/** Remembered accounts on this phone, for the "Who's signing in?" list. */
const KEY = 'att.accounts';
export function savedAccounts() {
  try { return JSON.parse(localStorage.getItem(KEY) || '[]'); } catch { return []; }
}
export function rememberAccount(acc) {
  try {
    const list = savedAccounts().filter((a) => a.email !== acc.email);
    list.unshift(acc);
    localStorage.setItem(KEY, JSON.stringify(list.slice(0, 8)));
  } catch { /* storage unavailable */ }
}
export function forgetAccount(email) {
  try { localStorage.setItem(KEY, JSON.stringify(savedAccounts().filter((a) => a.email !== email))); } catch { /* ignore */ }
}
