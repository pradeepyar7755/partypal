# 🎉 PartyPal — AI-Powered Party Planning

Live at: **partypal.social**  
Built with: Next.js 14 · Claude AI · Vercel

---

## 🚀 Quick Start (Local Dev)

### 1. Install dependencies
```bash
npm install
```

### 2. Add your API key
```bash
cp .env.example .env.local
```
Open `.env.local` and replace with your real key:
```
ANTHROPIC_API_KEY=sk-ant-api03-YOUR_REAL_KEY_HERE
```

### 3. Run dev server
```bash
npm run dev
```
Open [http://localhost:3000](http://localhost:3000)

---

## 🌐 Deploy to Vercel (Production)

### Step 1 — Push to GitHub
```bash
git init
git add .
git commit -m "Initial PartyPal app"
git remote add origin https://github.com/YOUR_USERNAME/partypal.git
git push -u origin main
```

### Step 2 — Deploy on Vercel
1. Go to [vercel.com](https://vercel.com) → New Project
2. Import your GitHub repo
3. Add environment variable:
   - Name: `ANTHROPIC_API_KEY`
   - Value: your key from console.anthropic.com
4. Click Deploy

### Step 3 — Connect partypal.social
1. In Vercel: Settings → Domains → Add `partypal.social`
2. In Namecheap: DNS → Add the CNAME record Vercel gives you
3. Wait ~10 minutes for DNS to propagate

---

## 📁 Project Structure

```
app/
├── page.tsx              # Homepage + AI wizard
├── results/page.tsx      # AI-generated party plan
├── vendors/page.tsx      # Vendor marketplace
├── guests/page.tsx       # Guest management + invite generator
└── api/
    ├── plan/route.ts     # Claude: full party plan
    ├── vendors/route.ts  # Claude: vendor recommendations  
    ├── moodboard/route.ts# Claude: theme & mood board
    └── guests/route.ts   # Claude: invite generator
```

---

## 💡 Features

- **AI Party Planner** — Fill a 6-field form, get a full plan in ~3 seconds
- **Vendor Marketplace** — Claude finds real local vendors by category + location
- **Mood Board** — Color palettes, decor ideas, music vibes, lighting
- **Guest Dashboard** — Add guests, track RSVPs, manage dietary needs
- **AI Invite Generator** — Claude writes personalized invites + RSVP links

---

## 💰 Running Costs (Monthly)

| Service | Plan | Cost |
|---|---|---|
| Vercel | Hobby | Free |
| Anthropic API | Pay-as-you-go | ~$5–20 |
| Namecheap domain | partypal.social | ~$1/mo |
| **Total** | | **~$6–21/mo** |

---

## 🔒 Security Notes

- **Never commit `.env.local`** — it's in `.gitignore`
- Add your API key only via Vercel's Environment Variables dashboard
- API routes validate inputs and handle errors gracefully
