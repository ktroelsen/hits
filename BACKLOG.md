# Backlog

## iTunes Search API rate limit

Appen henter previews/artwork fra iTunes Search API (`itunes.apple.com/search`), et gratis,
ikke-autentificeret endpoint med en uofficiel grænse på **~20 requests/minut pr. IP**.
Overskridelse giver HTTP 403 (eller 429) med tom body.

**Problem:** In-app-afspilleren i [src/services/audioService.ts](src/services/audioService.ts)
har ingen throttling/retry og kun en in-memory cache (nulstilles ved reload). En bruger, der
klikker hurtigt gennem 20+ kort på under et minut, kan ramme grænsen; rate-limitede sange
markeres "stille" uden preview indtil reload. Batch-scriptet
[scripts/check-previews.ts](scripts/check-previews.ts) er derimod allerede beskyttet
(3 sek mellem kald + backoff).

### Mulige løsninger

- [x] **1. Persistér cachen** — ✅ `previewCache` i `audioService.ts` loades/gemmes nu i
  localStorage (`hitster.previewCache.v1`). Rate-limit/netværksfejl (403/429) caches ikke
  som negativt resultat, så de kan forsøges igen når grænsen er ovre.

- [x] **2. Pre-fetch og bag URL'er ind i `songs.ts`** — ✅ `Song` har `previewUrl`/`artworkUrl`;
  `fetchSongAudioPreview(song)` bruger dem direkte og springer netværket helt over. Kør
  `npm run bake-songs` for at skrive dem ind i `songs.ts` (idempotent). URL'er udløber, og
  DB'en er sandheden → ✅ backenden fornyer nu døde URL'er i DB'en ugentligt
  (`server/Catalog/PreviewRefresher.cs`) og via `/admin` → Katalog → "Forny previews".

- [ ] **3. Client-side throttling + backoff** i `fetchSongAudioPreview` (samme mønster som
  scriptet). Hjælper mod bursts, men fjerner ikke afhængigheden af live-kald.

- [ ] **4. Alternativ/fallback-kilde** — fx Deezer API (`api.deezer.com/search`), som også
  giver gratis 30-sek previews med en mildere grænse (~50/5 sek), som fallback når iTunes
  returnerer 403. *Mere kode at vedligeholde.*

**Anbefaling:** #1 + #2 kombineret fjerner reelt rate limit-problemet helt.
