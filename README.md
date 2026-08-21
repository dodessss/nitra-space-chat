# Nitra Space Chat

Anonymný textový chat pre Nitra Space. Frontend používa Vite + JavaScript + `@supabase/supabase-js`.

## Architektúra

- žiadna registrácia ani Supabase Auth
- anonymné session ID uložené iba v `localStorage`
- párovanie cez `public.find_chat_partner(uuid)`
- ukončenie miestnosti cez `public.close_chat_room(uuid)`
- správy sa neposielajú do vlastnej databázovej tabuľky
- textové správy idú cez Supabase Realtime Broadcast
- Presence sa používa na zachytenie odchodu partnera
- staré miestnosti čistí `public.cleanup_old_chat_rooms()`

Supabase Broadcast správy odoslané priamo klientom nie sú ukladané do databázovej tabuľky správ. Nepoužívame Postgres Changes pre samotný text chatu.

## Lokálne spustenie

1. Nainštaluj Node.js.
2. Vytvor `.env` podľa `.env.example`.
3. Spusť:

```bash
npm install
npm run dev
```

## Environment variables

```env
VITE_SUPABASE_URL=https://yfsurbpfyjgwepymswsk.supabase.co
VITE_SUPABASE_ANON_KEY=...
```

Do frontendu patrí iba publishable key alebo legacy anon key. Nikdy sem nedávaj `service_role` ani secret key.

## Build

```bash
npm run build
```

Výstup je v `dist/`.

## Vercel

Framework preset: **Vite**

Build command:

```bash
npm run build
```

Output directory:

```text
dist
```

Environment Variables:

- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`

Po zmene environment variables sprav nový deploy.

## Supabase

Projekt musí mať existujúce:

- `public.chat_rooms`
- `public.chat_participants`
- `public.find_chat_partner(uuid)`
- `public.close_chat_room(uuid)`
- `public.cleanup_old_chat_rooms()`

Realtime Broadcast musí byť povolený.

### Bezpečnosť

Pri anonymnom klientovi je dôležité, aby klient nemal priame INSERT/UPDATE/DELETE oprávnenia na chatové tabuľky. Párovanie a zatváranie má robiť iba serverová funkcia (`SECURITY DEFINER`) s bezpečne nastaveným `search_path`.

`cleanup_old_chat_rooms()` nemá byť volateľná z verejného klienta.

## Test

Otvori dve okná (ideálne normálne okno + inkognito):

1. V oboch otvor web.
2. V prvom klikni START CHAT.
3. V druhom klikni START CHAT.
4. Oba by mali prejsť do stavu **Pripojený**.
5. Pošli správu z jedného okna.
6. NEXT alebo LEAVE otestuj v jednom okne.
7. Over, že druhé okno zobrazí upozornenie.

## GitHub

```bash
git init
git add .
git commit -m "Initial Nitra Space Chat"
git branch -M main
git remote add origin YOUR_GITHUB_REPOSITORY
git push -u origin main
```

`.env` nikdy necommituj.

## Doména

Vo Verceli otvor projekt → Settings → Domains → Add Domain. Vercel následne zobrazí DNS záznamy, ktoré treba nastaviť u registrátora domény.
