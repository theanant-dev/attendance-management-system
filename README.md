# Dr. JS Lab Attendance

A Next.js attendance management app for Dr. JS Lab. Users sign in with Google, mark daily attendance, and can only mark attendance when they are within 50 meters of the lab location. Admins can manage users, review attendance, filter reports by date, and export attendance data as an Excel file.

## Features

- Google-only login with NextAuth.
- MongoDB user and attendance storage.
- User attendance marking with confirmation prompt.
- Location permission check before marking attendance.
- Lab radius validation using fixed lab coordinates: `25.5999947, 85.1603588`.
- Attendance allowed only within `50m` of the lab.
- Indian date and time handling using `Asia/Kolkata`.
- Sonner toast messages for success, error, and info feedback.
- Admin-only dashboard and user management.
- Admin can block, unblock, and delete users with confirmation prompts.
- Admin attendance dashboard with today and custom date-range filters.
- Excel export with grouped date columns: `IN`, `Out`, `Total (hr)`.

## Tech Stack

- Next.js `16`
- React `19`
- TypeScript
- Tailwind CSS
- NextAuth
- MongoDB with Mongoose
- Sonner
- shadcn/Base UI components where used

## Main Routes

- `/` - User attendance page.
- `/account` - Google login page.
- `/admin/dashboard` - Admin attendance dashboard.
- `/admin/users` - Admin user management.
- `/api/attendance` - User attendance API.
- `/api/admin/attendance` - Admin attendance report API.
- `/api/admin/attendance/export` - Excel export API.
- `/api/admin/users` - Admin user management API.
- `/api/auth/[...nextauth]` - NextAuth API.

## Environment Variables

Create a `.env` file with:

```env
MONGODB_URI=your_mongodb_connection_string
GOOGLE_CLIENT_ID=your_google_client_id
GOOGLE_CLIENT_SECRET=your_google_client_secret
NEXTAUTH_SECRET=your_nextauth_secret
NEXTAUTH_URL=http://localhost:3000
```

If the project still uses `SECRET`, keep it for compatibility, but `NEXTAUTH_SECRET` is preferred.

Google OAuth callback URL:

```txt
http://localhost:3000/api/auth/callback/google
```

## Getting Started

Install dependencies:

```bash
npm install
```

Run the development server:

```bash
npm run dev
```

Open:

```txt
http://localhost:3000
```

## Scripts

```bash
npm run dev
npm run build
npm run start
npm run lint
npm run seed:attendance
```

## Attendance Rules

- Each user can mark `IN` once per day.
- Each user can mark `OUT` once per day.
- A location check runs before attendance is saved.
- The server also validates location, so users cannot bypass the browser check.
- Attendance dates are stored as `YYYY-MM-DD` using India time.

## Admin Notes

Only users with `role: "admin"` can access admin APIs and admin pages. Normal staff users are stored with `role: "user"` and appear in the admin user list and attendance reports.

The Excel export uses the currently selected dashboard filter and creates a sheet like:

```txt
Name | Email | 07/01/2026          | 07/02/2026
     |       | IN | Out | Total    | IN | Out | Total
```

## Important Files

- `app/page.tsx` - user attendance UI and location permission flow.
- `app/api/attendance/route.ts` - user attendance API and location validation.
- `app/admin/dashboard/page.tsx` - admin report UI.
- `app/api/admin/attendance/export/route.ts` - Excel export generation.
- `app/admin/users/page.tsx` - admin user management UI.
- `app/api/admin/users/route.ts` - admin user management API.
- `app/api/auth/[...nextauth]/options.ts` - NextAuth configuration.
- `lib/india-date.ts` - India timezone date/time helpers.
- `models/user.model.ts` - user schema.
- `models/attendance.model.ts` - attendance schema.
