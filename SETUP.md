# FilmShare - Setup Guide

Welcome to FilmShare! This guide will help you get the application up and running.

## 📋 Prerequisites

- Node.js 18+
- npm or yarn
- Supabase account
- TMDB API key

## 🚀 Quick Start

### 1. **Setup Supabase Database**

1. Go to your Supabase project dashboard
2. Open the SQL Editor
3. Copy and paste the entire contents of `database/schema.sql`
4. Execute the SQL script

This will create:
- `users` table
- `movies` table
- `watched_logs` table
- `shares` table
- `follows` table
- All necessary indexes and RLS policies

### 2. **Environment Variables**

Copy `.env.local.example` to `.env.local`:

```bash
cp .env.local.example .env.local
```

Fill in your credentials:
- `NEXT_PUBLIC_SUPABASE_URL`: Your Supabase project URL
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`: Your Supabase anon key
- `SUPABASE_SERVICE_ROLE_KEY`: Your Supabase service role key
- `TMDB_API_KEY`: Your server-side TMDB API key (or use `TMDB_BEARER_TOKEN`)

### 3. **Install Dependencies**

```bash
npm install
```

### 4. **Run Development Server**

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

---

## 📁 Project Structure

```
src/
├── app/                    # Next.js App Router
│   ├── api/               # API routes
│   ├── auth/              # Auth pages (login, signup)
│   ├── dashboard/         # Dashboard page
│   ├── share/             # Share movie page
│   ├── friends/           # Friends management page
│   ├── layout.tsx         # Root layout
│   └── page.tsx           # Home redirect
├── components/            # Reusable React components
│   ├── MovieCard.tsx
│   ├── Sidebar.tsx
│   ├── SearchBar.tsx
│   ├── UserCard.tsx
│   └── PageLayout.tsx
├── lib/                   # Utilities
│   ├── supabase.ts       # Supabase client
│   ├── auth.ts           # Auth functions
│   ├── tmdb.ts           # TMDB API functions
├── types/                # TypeScript type definitions
│   └── index.ts
└── hooks/                # Custom React hooks

database/
├── schema.sql            # Supabase database schema
```

---

## 🔐 Authentication Flow

1. **Signup**: Users can register with email and password, or continue with Google.
2. **Profile setup**: New Google accounts choose a username and accept the Terms and Privacy Policy before a Canisterr profile is created. The age eligibility condition is part of the Terms.
3. **Username validation**: Email signup checks availability while typing; the server enforces uniqueness for every signup method.
4. **Login**: Firebase Authentication manages email/password and Google sign-in sessions.

To enable Google sign-in, open Firebase Console → Authentication → Sign-in method, enable Google, and save the provider configuration. Add each deployed Canisterr hostname under Authentication → Settings → Authorized domains. Local development also needs `localhost` authorized if it is not already listed. Google provider configuration and authorized domains are managed in Firebase Console, not in application source.

---

## 🎬 Core Features

### Dashboard (`/dashboard`)
- View all movies shared to you
- Quick access to share and log movies
- Upcoming: Create lists, Movie Match

### Share Movies (`/share`)
- Search TMDB for movies
- Select recipients from friends
- Track all shares you've sent
- Delete shares

### Friends (`/friends`)
- **Discover**: Search all users
- **Following**: Friends you're following
- **Followers**: People following you
- **Requests**: Pending follow requests (with badge)

---

## 📊 Data Model

### Users
```sql
- id (UUID)
- username (unique)
- name
- avatar_url (optional)
- created_at
```

### Movies
```sql
- id (TMDB ID)
- title, poster_url, genres, platforms
- director, release_date, overview
- runtime, rating
```

### Watched Logs
```sql
- id, user_id, movie_id
- watched_at, notes
- seen, watch_later (booleans)
```

### Shares
```sql
- id, sender_id, receiver_id, movie_id
- created_at
```

### Follows
```sql
- id, follower_id, following_id
- status ('pending' or 'accepted')
- created_at
```

---

## 🛠️ Key Functions

### **Auth** (`lib/auth.ts`)
- `signUp()` - Register new user
- `signIn()` - Login user
- `signOut()` - Logout user
- `getCurrentUser()` - Fetch logged-in user
- `checkUsernameAvailability()` - Validate username

### **TMDB** (`lib/tmdb.ts`)
- `searchMovies()` - Search for movies
- `getMovieDetails()` - Fetch full movie info
- `getTMDBImageUrl()` - Build image URLs

---

## 🚀 Deployment

### **Vercel** (Recommended)

1. Push code to GitHub
2. Connect repository to Vercel
3. Add environment variables in Vercel settings
4. Deploy

### **Environment Variables for Production**
- Ensure all `.env.local` variables are set in your hosting platform
- Use production Supabase URLs if applicable

---

## ⚠️ Important Notes

### Security
- Never commit `.env.local` to git
- Supabase RLS policies protect data at database level
- Users can only see their own shares and follows

### Rate Limiting
- TMDB API has rate limits (40 requests/10 seconds)
- Implement pagination for large datasets

### Next Steps (Phase 2)
- Add reactions (❤️🔥)
- Log movies feature (fully functional)
- Create lists
- Movie Match algorithm
- Google OAuth
- Notifications

---

## 🐛 Troubleshooting

### "RLS policy violation"
- Ensure the authenticated user has proper policies
- Check Supabase RLS settings

### "Movie not found" after share
- Movie might not exist in DB yet
- App auto-creates from TMDB data

### "Username taken" error
- Username must be unique
- Try a different username

---

## 📝 Development Tips

###  **Add New Features**
1. Create components in `src/components/`
2. Add types in `src/types/`
3. Create pages in `src/app/[feature]/`
4. Use `supabase` client for database queries

### **Database Changes**
1. Modify `database/schema.sql`
2. Run SQL in Supabase dashboard
3. Update types in `src/types/index.ts`

---

## 💡 Support

For issues or questions:
1. Check Supabase logs
2. Verify TMDB API key is valid
3. Ensure environment variables are correct

---

**Happy sharing! 🎬**

## Canisterr Admin

Admin access is restricted to verified email addresses listed in the server-only `CANISTERR_ADMIN_EMAILS` variable or Firebase UIDs listed in `CANISTERR_ADMIN_UIDS`. Set one of these variables in the deployment secret store, restart or redeploy, then sign in and open `/admin`. Do not expose these values in client-side variables, source control, or screenshots. There is no special admin signup or email-verification bypass; use the normal signup and verification flow, then grant access through the server-side allowlist. To remove access, remove the email or UID from the allowlist and redeploy.

The admin page has three sections: Featured lists, Analytics, and API health. Paste comma-separated or newline-separated film and series titles into a featured list and fetch matches from TMDB and TVMaze. Searches are cached in the browser; each fetch and list can contain up to 50 titles. Pick poster matches, save the list, and turn on “Show this list on the home screen” to publish it below Friends Activity. Set an optional expiry date to hide it automatically. Analytics are private aggregate totals, cached for five minutes. The provider health check makes two requests only when you press its button.
