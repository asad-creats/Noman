# Attendance App

This is a phone-friendly web app for course attendance. It works in the browser and can be added to the home screen like a normal app. All data is stored in Supabase.

## What it does

- **Sessions**: Start today's class and take attendance with P (present), A (absent) or L (leave). You can filter the list by group.
- **Absent**: Shows the absent students from every class. It points out students who have missed 2 or more classes in a row, and students who haven't attended any class yet. Each student has WhatsApp and call buttons.
- **My group**: A group incharge sees only their own group. It shows each student's attendance %, who was absent in the last class, and a button to share the absent list on WhatsApp.
- **Reports**: Every class has a report you can open. It shows who was present, absent or on leave, the listeners, and the team's arrival times. You can share the report on WhatsApp.
- **Payments**: Mark each student's course fee as Paid, Part paid, Unpaid or Sponsored. It shows the total collected, and you can send a WhatsApp fee reminder.
- **Listeners**: Add a listener to any class.
- **Register students**: Add a new student and put them in a group with an incharge.
- **Logins**: Each incharge has their own login. An admin can see every course.

## Your real data is already included

`supabase/seed.sql` was generated from the four Google Sheets (Tazkiyah e Qalb, Uloom ul Hadith, Fehm al Qur'an Batch 2 and Ilm al Tajweed). It includes:

- 201 student enrolments, with registration numbers, father names, phone/WhatsApp numbers, city, status (active, left, not joined) and fee status
- 59 class sessions and 3,027 attendance marks. Blank cells in the register were filled from the absentee-list tabs.
- the 6 Tazkiyah groups (Group 1 Adam … Group 6 Yusuf), with all 36 members matched
- 29 listener visits, plus the course teams and their arrival times

The following were **left out on purpose** because the app doesn't need them: CNIC/B-Form numbers, dates of birth, emails and photo links. Book issues and assignment marks were also left out.

> ⚠️ `seed.sql` contains real phone numbers, so it is listed in `.gitignore`. Don't upload it to a public GitHub repository.

## Setup (about 15 minutes)

1. **Create a Supabase project** at https://supabase.com. The free plan is enough.
2. **Create the database**: In the Supabase dashboard, go to **SQL Editor › New query**. Paste all of `supabase/schema.sql` and click **Run**. Then do the same with `supabase/seed.sql`.
3. **Turn off email confirmation** (recommended): Go to **Authentication › Sign In / Providers › Email** and switch off **Confirm email**. Incharges can then sign in as soon as they create an account.
4. **Connect the app**: Copy `.env.example` to `.env`. Then paste in the **Project URL** and the **anon / publishable key** from **Project Settings › API**.
5. **Run it**:
   ```bash
   npm install
   npm run dev        # opens on your computer and on phones on the same Wi-Fi
   ```
6. **Put it online** (free): Push the folder to a private GitHub repository and import it on https://vercel.com. Add the same three `VITE_…` values as Environment Variables there. `vercel.json` is already included.
7. **Install on phones**: Open the site, then tap **Share › Add to Home Screen** on iPhone, or **⋮ › Install app** on Android.

## First login

- **The first account you create becomes the admin.** Create this account for whoever runs the courses.
- Each incharge then taps **Create a new account** on the sign-in screen.
- Next, the admin opens **Account › Team & groups** and does three things:
  - picks each person's **course**
  - picks an **incharge** for each group
  - adds the course **team** (Course Incharge, Attendance Incharge, and so on), which is used for team attendance
- Several people can use the same phone. The sign-in screen remembers each account in a "Who's signing in?" list.

## Re-importing the spreadsheets later

```bash
pip install openpyxl
# Download each Google Sheet as .xlsx and name them tazkiyah.xlsx, hadith.xlsx, fehm.xlsx, tajweed.xlsx
python3 tools/build_seed.py path/to/folder
```

Running `seed.sql` again is safe, because rows that already exist are skipped.

## Project layout

```
supabase/schema.sql    tables + security rules (incharges only see their own course)
supabase/seed.sql      your imported data
tools/build_seed.py    spreadsheet → seed.sql converter
src/pages/             one file per screen
```
