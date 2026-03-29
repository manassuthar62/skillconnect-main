# SkillConnect 🚀

A modern skills networking and discover platform built with **Next.js 14**, **Supabase**, and **Gemini 2.0 AI**. Connect with people through your skills, find external profiles using AI, and build your professional community.

## ✨ Features
- 🔐 **Auth** — Supabase Authentication (Email/Password & Social)
- 🧠 **AI Suggestions** — Gemini-powered external profile discovery and contextual insights
- 🔍 **Discover** — Browse & search native users by skill
- 🔔 **Notifications** — Connection requests & activity
- 👤 **Profile** — Skill management, bio, avatar handling
- 🎨 **UI** — Animated with Framer Motion + Lucide Icons

---

## ⚡ Quick Setup

### Step 1 — Create a Supabase Project

1. Go to [supabase.com](https://supabase.com) and create a new project.
2. In the left sidebar, go to **Authentication** to configure your auth providers.
3. Go to **Database** to set up your tables (e.g., `profiles`, `connections`, etc.).
4. Go to **Project Settings → API** to get your URL and Anon Key.

### Step 2 — Get Google Gemini API Key

1. Go to [Google AI Studio](https://aistudio.google.com/)
2. Generate a new API Key for Gemini.

### Step 3 — Configure Environment

```bash
# In your project directory, copy the example env:
cp .env.local.example .env.local
```

Then edit `.env.local` and fill in your Supabase & Gemini config values:

```env
NEXT_PUBLIC_SUPABASE_URL=https://your-project-url.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGci...
GEMINI_API_KEY=AIzaSy...
```

### Step 4 — Run the app

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) 🎉

---

## 📂 Project Structure

```
app/
  (main)/           ← Protected pages
    chat/           ← Chat list + individual rooms
    discover/       ← Native users + AI External Suggestions
    notifications/  ← Activity alerts
    profile/        ← Your profile + skills
  auth/             ← Login / Signup
components/
  TopBar.js         ← Profile dropdown & navigation
  Sidebar.js        ← Desktop left nav
  BottomNav.js      ← Mobile bottom tab bar
lib/
  supabase.js       ← Supabase client initialization
```
