"""
Builds supabase/seed.sql from the four course spreadsheets (exported as .xlsx).

Usage:  python3 tools/build_seed.py <folder with tazkiyah.xlsx hadith.xlsx fehm.xlsx tajweed.xlsx>

Only what the app needs is imported: names, father names, registration numbers,
phone/WhatsApp, city, fee status, attendance, listeners, groups and team attendance.
CNIC/B-Form numbers, dates of birth, emails and photo links are deliberately left out.
"""
import datetime as dt
import difflib
import re
import sys
import uuid
from pathlib import Path

import openpyxl

SRC = Path(sys.argv[1] if len(sys.argv) > 1 else '.')
OUT = Path(__file__).resolve().parent.parent / 'supabase' / 'seed.sql'
NS = uuid.UUID('7b0f4d1e-5a8c-4c39-9a51-3f5e2b7c9d10')
report = []


def uid(*parts):
    return str(uuid.uuid5(NS, '|'.join(str(p) for p in parts)))


def clean(v):
    if v is None:
        return ''
    if isinstance(v, float) and v.is_integer():
        v = int(v)
    return re.sub(r'\s+', ' ', str(v)).strip()


def phone(v):
    """Return (primary, alternate) as local 03XXXXXXXXX numbers where possible."""
    s = clean(v)
    if not s:
        return '', ''
    parts = re.split(r'\s+or\s+|/|,|\s{2,}', s)
    nums = []
    for p in parts:
        d = re.sub(r'[^\d+]', '', p)
        if not d:
            continue
        if d.startswith('+'):
            nums.append(d)
            continue
        if d.startswith('92') and len(d) == 12:
            d = '0' + d[2:]
        if len(d) == 10 and d.startswith('3'):
            d = '0' + d
        if d.startswith('0') and len(d) >= 10:
            nums.append(d)
    nums = nums + ['', '']
    return nums[0], nums[1]


def title(name):
    name = clean(name)
    if name.isupper() or name.islower():
        name = ' '.join(w.capitalize() if len(w) > 1 else w.upper() for w in name.split(' '))
    return name


def key(name):
    n = clean(name).lower()
    n = re.sub(r'\b(muhammad|mohammad|muhammed|mohammed|mhammad|m\.|m)\b', 'm', n)
    n = re.sub(r'[^a-z ]', '', n)
    return ' '.join(n.split())


def best(name, candidates, father=None, cutoff=0.86):
    """Find the closest candidate by name (and father name when given)."""
    k = key(name)
    scored = []
    for c in candidates:
        s = difflib.SequenceMatcher(None, k, key(c['name'])).ratio()
        if father and c.get('father'):
            s = s * 0.75 + 0.25 * difflib.SequenceMatcher(None, key(father), key(c['father'])).ratio()
        scored.append((s, c))
    scored.sort(key=lambda x: -x[0])
    if scored and scored[0][0] >= cutoff:
        return scored[0][1]
    return None


def rows(wb, sheet):
    return [list(r) for r in wb[sheet].iter_rows(values_only=True)]


def as_date(v):
    if isinstance(v, dt.datetime):
        return v.date()
    if isinstance(v, dt.date):
        return v
    s = clean(v)
    for fmt in ('%d %B %Y', '%d/%m/%Y', '%m/%d/%Y', '%d %b %Y'):
        try:
            return dt.datetime.strptime(s, fmt).date()
        except ValueError:
            pass
    return None


def form_people(wb, sheet, cols):
    """Read admission-form responses into a list of dicts."""
    out = []
    for r in rows(wb, sheet)[1:]:
        name = clean(r[cols['name']]) if cols['name'] < len(r) else ''
        if not name:
            continue
        g = lambda k: clean(r[cols[k]]) if k in cols and cols[k] < len(r) else ''
        out.append({
            'name': name, 'father': g('father'), 'reg': g('reg'), 'city': g('city'),
            'phone': phone(g('phone'))[0], 'whatsapp': phone(g('whatsapp'))[0],
            'flag': (g('flag') + ' ' + g('flag2')).strip().lower(),
        })
    return out


# ---------------------------------------------------------------- courses

COURSES = [
    dict(key='tazkiyah', name='Tazkiyah e Qalb', short='TQ', weekday='Tuesday', fee=1500, file='tazkiyah.xlsx',
         att='Attendance Sheet', att_layout=dict(header=2, dates=3, first=4, name=1, father=2, contact=3, remarks=4, fee=5, marks=6),
         form=('Form Responses 1', dict(reg=1, flag=3, name=4, father=6, phone=9, whatsapp=11, city=15, flag2=2)),
         team='Team Attendance'),
    dict(key='hadith', name='Uloom ul Hadith', short='UH', weekday='Wednesday', fee=1500, file='hadith.xlsx',
         att='Attendance Sheet', att_layout=dict(header=2, dates=3, first=4, name=1, father=2, contact=3, fee=4, remarks=5, marks=6),
         form=('Form responses 1', dict(reg=1, name=3, father=5, phone=8, whatsapp=10, city=14, flag=2)),
         team='Team Attendance'),
    dict(key='fehm', name="Fehm al Qur'an (Batch 2)", short='FQ', weekday='Friday', fee=5500, file='fehm.xlsx',
         att='Attendance', att_layout=dict(header=3, dates=3, first=4, name=1, father=2, fee=3, contact=4, marks=5),
         form=('Form responses 1', dict(reg=5, name=7, father=8, phone=12, whatsapp=14, city=18, flag=2)),
         team='Team Attendance'),
    dict(key='tajweed', name='Ilm al Tajweed (Level 1)', short='IT', weekday='Thursday', fee=3000, file='tajweed.xlsx',
         att='ilm al Tajweed Attendance', att_layout=dict(header=3, dates=3, first=4, name=1, father=2, marks=3),
         form=('ilm al Tajweed (Level - 1)', dict(reg=1, flag=3, name=4, father=6, phone=9, whatsapp=11, city=15)),
         team='Team Attendance'),
]

sql = []
q = lambda v: 'null' if v in (None, '') else "'" + str(v).replace("'", "''") + "'"

courses, groups, students, sessions, attendance, listeners, team, team_att = [], [], [], [], [], [], [], []


def fee_from(text, course_fee):
    t = clean(text).lower()
    if not t:
        return 'unpaid', None, ''
    m = re.search(r'(\d[\d,]*)\s*paid', t)
    if 'second installment' in t:
        return 'paid', course_fee, 'Both installments paid'
    if m:
        amt = int(m.group(1).replace(',', ''))
        return ('paid' if amt >= course_fee else 'partial'), amt, re.sub(r'[^\w ()]', '', clean(text)).strip()
    if 'unpaid' in t or 'not paid' in t:
        return 'unpaid', None, ''
    if 'paid' in t:
        return 'paid', course_fee, ''
    if 'sponser' in t or 'sponsor' in t:
        return 'unpaid', None, 'Needs sponsorship'
    return 'unpaid', None, clean(text)


for c in COURSES:
    wb = openpyxl.load_workbook(SRC / c['file'], data_only=True)
    cid = uid('course', c['key'])
    courses.append((cid, c['name'], c['short'], c['weekday'], c['fee']))
    L = c['att_layout']
    data = rows(wb, c['att'])
    date_row = data[L['dates'] - 1]
    date_cols = [(i, as_date(v)) for i, v in enumerate(date_row) if i >= L['marks'] and as_date(v)]

    form = form_people(wb, *c['form'])
    unpaid_names = []
    if 'Unpaid List' in wb.sheetnames:
        unpaid_names = [{'name': clean(r[2]), 'father': clean(r[3])} for r in rows(wb, 'Unpaid List') if len(r) > 3 and clean(r[2]) and clean(r[2]) != 'Student Name']
    voucher_names = []
    if 'Vouchers' in wb.sheetnames:
        for r in rows(wb, 'Vouchers'):
            for i, v in enumerate(r):
                if clean(v).lower() == 'unpaid' and i >= 2:
                    voucher_names.append({'name': clean(r[i - 1])})
    registered = []
    for sn in ('Registred St.', 'Registered'):
        if sn in wb.sheetnames:
            registered = [{'name': clean(r[1]), 'father': clean(r[2])} for r in rows(wb, sn)[2:] if clean(r[1])]

    used_form = set()
    marks_by_date = {d: [] for _, d in date_cols}
    for r in data[L['first'] - 1:]:
        name = clean(r[L['name']]) if len(r) > L['name'] else ''
        if not name:
            continue
        father = clean(r[L['father']]) if 'father' in L else ''
        if re.fullmatch(r'[\d\- ]+', father or '') or father.lower() == "father's name":  # a CNIC or placeholder in the father column
            father = ''
        p1, p2 = phone(r[L['contact']]) if 'contact' in L else ('', '')
        free = [p for p in form if id(p) not in used_form]
        f = next((p for p in free if p1 and p1 in (p['phone'], p['whatsapp']) and
                  difflib.SequenceMatcher(None, key(name), key(p['name'])).ratio() > 0.5), None) or best(name, free, father)
        if f:
            used_form.add(id(f))
        else:
            report.append(f'{c["name"]}: no admission-form match for "{name}"')
        if not p1 and f:
            p1 = f['phone']
        wa = (f or {}).get('whatsapp') or p1
        remarks = clean(r[L['remarks']]) if 'remarks' in L and len(r) > L['remarks'] else ''

        if 'fee' in L:
            status, paid, note = fee_from(r[L['fee']], c['fee'])
            if not clean(r[L['fee']]) and not best(name, unpaid_names, cutoff=0.9):
                status, note = 'unpaid', 'Fee status not recorded'
        else:  # Tajweed: unpaid voucher list vs registered list
            if best(name, voucher_names, cutoff=0.9):
                status, paid, note = 'unpaid', None, 'Voucher unpaid'
            elif best(name, registered, cutoff=0.88):
                status, paid, note = 'paid', c['fee'], ''
            else:
                status, paid, note = 'unpaid', None, 'Fee status not recorded'
        if '(gone)' in clean(r[L['fee']] if 'fee' in L else '').lower():
            remarks = (remarks + ' Left the course').strip()

        flag = (f or {}).get('flag', '')
        st_status = 'left' if ('left' in flag or 'left the course' in remarks.lower()) else 'not_joined' if 'not joined' in flag else 'active'
        sid = uid('student', c['key'], name, father, len(students))
        students.append(dict(id=sid, course=cid, name=title(name), father=title(father or (f or {}).get('father', '')),
                             reg=(f or {}).get('reg', '') if re.fullmatch(r'\d{5}-\d{6}', (f or {}).get('reg', '')) else '',
                             phone=p1, alt=p2, wa=wa, city='' if '@' in (f or {}).get('city', '') else (f or {}).get('city', ''), status=st_status,
                             remarks=remarks, fee=status, paid=paid, note=note, raw=name))
        for i, d in date_cols:
            m = clean(r[i]).upper() if i < len(r) else ''
            if m in ('P', 'A', 'L'):
                marks_by_date[d].append((sid, {'P': 'present', 'A': 'absent', 'L': 'leave'}[m]))

    # People in the admission form who never made it onto the register (left / not joined)
    for p in form:
        if id(p) in used_form:
            continue
        flag = p['flag']
        if not any(w in flag for w in ('left', 'not joined', 'approved', 'admission complete', 'in progress')):
            continue
        if best(p['name'], [{'name': s['raw']} for s in students if s['course'] == cid], cutoff=0.9):
            continue
        st = 'left' if 'left' in flag else 'not_joined'
        students.append(dict(id=uid('student', c['key'], p['name'], p['father'], 'form'), course=cid, name=title(p['name']),
                             father=title(p['father']), reg=p['reg'] if re.fullmatch(r'\d{5}-\d{6}', p['reg']) else '',
                             phone=p['phone'], alt='', wa=p['whatsapp'] or p['phone'], city=p['city'], status=st,
                             remarks='From admission form; not on the attendance register', fee='unpaid', paid=None,
                             note='', raw=p['name']))

    # Absentee lists: fill blanks in the register (never overwrite a P/A/L that was entered).
    abs_sheet = next((n for n in wb.sheetnames if n.lower().replace(' ', '').startswith(('absente', 'abseties'))), None)
    if abs_sheet:
        arows = rows(wb, abs_sheet)
        held = sorted(d for d in marks_by_date if marks_by_date[d])
        blocks, order = [], 0
        for ri, r in enumerate(arows):
            for ci, v in enumerate(r):
                t = clean(v)
                if not re.search(r'(?i)abs[ce]n', t) or len(t) > 70:
                    continue
                tt = re.sub(r'(?i)0ct', 'Oct', t)
                m = re.search(r'(\d{1,2})\s*(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)', tt, re.I)
                o = re.search(r'(?i)(\d)\s*(st|nd|rd|rth|th)\s*day|first day', tt)
                target = None
                if m:
                    guess = dt.datetime.strptime(f'{m.group(1)} {m.group(2)[:3].title()} 2026', '%d %b %Y').date()
                    near = [d for d in held if abs((d - guess).days) <= 3]
                    target = near[0] if near else None
                elif o:
                    order += 1
                    target = held[order - 1] if order <= len(held) else None
                if not target:
                    continue
                # find the "Student Name" header just below, then read names until a gap
                for r2 in range(ri + 1, min(ri + 4, len(arows))):
                    cols = [k for k, x in enumerate(arows[r2]) if clean(x).upper() == 'STUDENT NAME' and ci - 2 <= k <= ci + 3]
                    if cols:
                        names = []
                        for r3 in arows[r2 + 1:]:
                            nm = clean(r3[cols[0]]) if cols[0] < len(r3) else ''
                            if not nm:
                                if names: break
                                continue
                            names.append(nm)
                        blocks.append((target, names))
                        break
        filled = 0
        cand = [{'name': x['raw'], 'id': x['id']} for x in students if x['course'] == cid]
        for d, names in blocks:
            have = {sid for sid, _ in marks_by_date[d]}
            for nm in names:
                hit = best(nm, cand, cutoff=0.85)
                if hit and hit['id'] not in have:
                    marks_by_date[d].append((hit['id'], 'absent')); have.add(hit['id']); filled += 1
        report.append(f'{c["name"]}: filled {filled} blank register cells as absent from {len(blocks)} absentee lists')

    n = 0
    for _, d in sorted(date_cols, key=lambda x: x[1]):
        if not marks_by_date[d]:
            continue
        n += 1
        ssid = uid('session', c['key'], d)
        sessions.append(dict(id=ssid, course=cid, title=f'Session {n}', date=d))
        attendance.extend((ssid, s, st) for s, st in marks_by_date[d])
    session_by_date = {s['date']: s for s in sessions if s['course'] == cid}

    def session_for(d):
        if d in session_by_date:
            return session_by_date[d]['id']
        ssid = uid('session', c['key'], d)
        s = dict(id=ssid, course=cid, title='Team session', date=d)
        sessions.append(s)
        session_by_date[d] = s
        return ssid

    # Team attendance
    trows = rows(wb, c['team'])
    hi = next(i for i, r in enumerate(trows) if clean(r[0]).lower().startswith('session'))
    head = trows[hi]
    roles = trows[hi + 1] if clean(trows[hi + 1][1]).lower() == 'roles' else [None] * len(head)
    members = {}
    for i, v in enumerate(head[2:], 2):
        nm = clean(v)
        if nm:
            mid = uid('team', c['key'], nm)
            members[i] = mid
            team.append((mid, cid, title(nm), clean(roles[i]) if i < len(roles) else ''))
    for r in trows[hi + 1:]:
        d = as_date(r[1]) if len(r) > 1 else None
        if not d:
            continue
        for i, mid in members.items():
            v = r[i] if i < len(r) else None
            if v is None or clean(v) == '':
                continue
            mark = v.strftime('%H:%M') if isinstance(v, dt.time) else clean(v)
            if len(mark) > 40:
                continue
            team_att.append((session_for(d), mid, mark))

    # Groups (Tazkiyah only has a Groups tab)
    if 'Groups' in wb.sheetnames:
        grows = rows(wb, 'Groups')
        cur = {}
        for r in grows:
            for i, v in enumerate(r):
                s = clean(v)
                m = re.search(r'Group\s*(\d+)\s*([A-Za-z]+)', s)
                if m:
                    gid = uid('group', c['key'], m.group(1))
                    groups.append((gid, cid, f'Group {m.group(1)} {m.group(2)}', int(m.group(1))))
                    cur[i] = gid
                elif i in cur and s and s not in ('Name',):
                    father = clean(r[i + 1]) if i + 1 < len(r) else ''
                    cand = [x for x in students if x['course'] == cid]
                    hit = best(s, [{'name': x['raw'], 'father': x['father'], 'x': x} for x in cand], father, cutoff=0.8)
                    if hit:
                        hit['x']['group'] = cur[i]
                    else:
                        report.append(f'{c["name"]}: group member "{s}" not found on the register')

    # Listeners
    if c['key'] == 'fehm':
        lr = rows(wb, 'unregistered or listners')
        hi = next(i for i, r in enumerate(lr) if clean(r[0]).lower().startswith('sr'))
        ldates = [(i, as_date(v)) for i, v in enumerate(lr[hi]) if as_date(v)]
        for r in lr[hi + 1:]:
            nm = clean(r[1])
            if not nm:
                continue
            for i, d in ldates:
                if i < len(r) and clean(r[i]).upper() == 'P':
                    listeners.append((uid('listener', c['key'], nm, d), session_for(d), title(nm.replace('unknown. ', 'Unknown, ')),
                                      title(clean(r[2])), phone(r[4])[0], clean(r[3]), True, False))
    elif c['key'] == 'tazkiyah':
        cur_d = None
        for r in rows(wb, 'Listeners data'):
            cells = [x for x in r if x is not None]
            if not cells:
                continue
            first = r[2] if len(r) > 2 else None
            d = as_date(first) or (as_date(re.sub(r'(?i)date:\s*', '', clean(first))) if first else None)
            if d:
                cur_d = d
                continue
            nm = clean(first)
            if not nm or not cur_d:
                continue
            father = clean(r[3]) if len(r) > 3 else ''
            ph = phone(r[4])[0] if len(r) > 4 else ''
            note = clean(r[5]) if len(r) > 5 else ''
            listeners.append((uid('listener', c['key'], nm, cur_d), session_for(cur_d), title(nm), title(father), ph, note, True,
                              'form' in note.lower()))
    elif c['key'] == 'hadith':
        first = sorted(session_by_date)[1] if len(session_by_date) > 1 else sorted(session_by_date)[0]
        hand = [
            (first, 'Hayan Ali', 'Rafeeq Ahmed', '03102828591', 'Date not recorded'),
            (first, 'Muhammad Usman Ashraf', 'Malik Muhammad Ashraf', '03355765635', 'Date not recorded · send form link'),
            (first, 'Muhammad Muneeb Ur Rehman', 'Attaullah', '03064961274', 'Date not recorded · send form link'),
            (first, 'Irfan Nazir', '', '', 'Date not recorded · send form link'),
            (first, 'Navid Ur Rehman', 'Muhammad Rehman', '03329281744', 'Date not recorded · send form link'),
            (first, 'Abubakar Khan', 'Miftahullah', '03496750844', 'Date not recorded · send form link'),
            (first, 'Adnan Ahmad', 'Amir Zev', '03467781870', 'Date not recorded · send form link'),
            (dt.date(2026, 10, 28), 'Tehseen Ur Rashid', 'Haroon Ur Rashid', '03229574106', ''),
            (dt.date(2026, 10, 28), 'Ahsan Sati', '', '03318175598', ''),
            (dt.date(2026, 11, 4), 'Sharyar Ahmad', 'Ghullam Qadir', '03191606626', ''),
        ]
        for d, nm, fa, ph, note in hand:
            listeners.append((uid('listener', c['key'], nm, d), session_for(d), nm, fa, ph, note, True, 'form' in note))

    report.append(f'{c["name"]}: {sum(1 for s in students if s["course"] == cid)} students, '
                  f'{sum(1 for s in sessions if s["course"] == cid)} sessions')

# ---------------------------------------------------------------- write SQL
lines = ['-- Generated by tools/build_seed.py. Run AFTER schema.sql, once, in the Supabase SQL editor.',
         '-- Re-running it is safe: existing rows are skipped.', 'begin;', '']
lines.append('insert into public.courses (id, name, short_name, weekday, fee_amount) values')
lines.append(',\n'.join(f'({q(a)}, {q(b)}, {q(s)}, {q(w)}, {f})' for a, b, s, w, f in courses) + '\non conflict do nothing;\n')
if groups:
    lines.append('insert into public.study_groups (id, course_id, name, sort) values')
    lines.append(',\n'.join(f'({q(a)}, {q(b)}, {q(n)}, {o})' for a, b, n, o in groups) + '\non conflict do nothing;\n')
lines.append('insert into public.students (id, course_id, group_id, reg_no, full_name, father_name, phone, alt_phone, whatsapp, city, status, remarks, fee_status, fee_paid, fee_note) values')
lines.append(',\n'.join(
    f"({q(s['id'])}, {q(s['course'])}, {q(s.get('group'))}, {q(s['reg'])}, {q(s['name'])}, {q(s['father'])}, {q(s['phone'])}, "
    f"{q(s['alt'])}, {q(s['wa'])}, {q(s['city'])}, {q(s['status'])}, {q(s['remarks'])}, {q(s['fee'])}, "
    f"{s['paid'] if s['paid'] is not None else 'null'}, {q(s['note'])})" for s in students) + '\non conflict do nothing;\n')
lines.append('insert into public.sessions (id, course_id, title, held_on, saved_at) values')
lines.append(',\n'.join(f"({q(s['id'])}, {q(s['course'])}, {q(s['title'])}, {q(s['date'].isoformat())}, {q(s['date'].isoformat() + 'T20:00:00+05')})" for s in sessions) + '\non conflict do nothing;\n')
lines.append('insert into public.attendance (session_id, student_id, status) values')
lines.append(',\n'.join(f'({q(a)}, {q(b)}, {q(c)})' for a, b, c in attendance) + '\non conflict do nothing;\n')
if listeners:
    lines.append('insert into public.listeners (id, session_id, full_name, father_name, phone, note, present, interested) values')
    lines.append(',\n'.join(f"({q(a)}, {q(b)}, {q(n)}, {q(f)}, {q(p)}, {q(t)}, {str(pr).lower()}, {str(i).lower()})" for a, b, n, f, p, t, pr, i in listeners) + '\non conflict do nothing;\n')
lines.append('insert into public.team_members (id, course_id, full_name, role) values')
lines.append(',\n'.join(f'({q(a)}, {q(b)}, {q(n)}, {q(r)})' for a, b, n, r in team) + '\non conflict do nothing;\n')
lines.append('insert into public.team_attendance (session_id, member_id, mark) values')
lines.append(',\n'.join(f'({q(a)}, {q(b)}, {q(m)})' for a, b, m in team_att) + '\non conflict do nothing;\n')
lines.append('commit;')
OUT.write_text('\n'.join(lines), encoding='utf-8')

print('\n'.join(report))
print(f'\nTotals: {len(courses)} courses, {len(groups)} groups, {len(students)} students, {len(sessions)} sessions, '
      f'{len(attendance)} attendance marks, {len(listeners)} listener visits, {len(team)} team members, {len(team_att)} team marks')
print('Wrote', OUT)
