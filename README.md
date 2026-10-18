# FormFlow – Form Builder + Class Rooms

```bash
npm install
npm run dev
```

## Backend setup (ek baar)
1. Supabase → SQL Editor → `supabase/schema.sql` ka **poora** content run karein.
   (rooms + forms + submissions, RLS, validation trigger, realtime. Purani owner-less/test forms delete hoti hain.)
2. Supabase → Authentication → Providers → **Email** ON rakhein.
3. Email confirmation: chahein to ON rakhein (signup ke baad email verify), ya OFF karein taake signup ke foran baad login ho jaye.

## `.env` (project root)
```
VITE_SUPABASE_URL=https://xxxx.supabase.co
VITE_SUPABASE_ANON_KEY=eyJ...
VITE_APP_URL=https://your-app.vercel.app   # HTTPS public URL (share link isi se banta hai)
```

## Kaam kaise karta hai
- Teacher signup/login karta hai → **My Class Rooms** → room bana kar uske andar forms publish karta hai.
- Har form ka link `https://<VITE_APP_URL>?form=<id>` hota hai; students bina login bharte hain.
- Teacher ko sirf apne rooms aur apne forms ke responses dikhte hain (RLS), doosre teacher ka data nahi.
- Live Sheet realtime hai (naya response bina refresh), Excel/PDF export bhi kaam karta hai.

## Shareable HTTPS link (WhatsApp ke liye)
`http://localhost:5173` link sirf aap ke computer par khulta hai.
1. Vercel/Netlify par import karein (build: `npm run build`, output: `dist`).
2. Wahan bhi wahi 3 env vars daalein, `VITE_APP_URL` = deployed URL.
3. Deploy ke baad login → room → form → **Go Live** → `https://...?form=<id>` link WhatsApp par bhejein.

Temporary test ke liye: `npx cloudflared tunnel --url http://localhost:5173` (https URL milta hai, temporary).
