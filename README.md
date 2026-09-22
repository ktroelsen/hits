# Hitster Musik Quiz

En Hitster-inspireret musik-gættequiz bygget som en statisk **React + TypeScript + Vite**-app.
Gæt årstal og placér danske og internationale hits på tidslinjen. 30-sekunders lydklip hentes
fra iTunes Search API (ingen API-nøgle nødvendig), lydeffekter genereres i browseren.
Previews kan bages ind i sang-dataene på forhånd (`npm run bake-songs`), så appen laver
nul runtime-kald til Apple; ellers hentes de live og caches i browseren (localStorage).

## Kør lokalt

**Forudsætning:** Node.js 20+ og .NET 10 SDK (til backend).

Sangkataloget ligger nu i en **backend-database** (SQLite via ASP.NET Core, se
`server/`). Frontend henter kataloget fra `GET /api/songs`; hvis backend ikke kører,
falder appen tilbage til den bundlede `src/data/songs.ts`.

```bash
# Terminal 1 — backend (API + SQLite på http://localhost:5099)
cd server && dotnet run

# Terminal 2 — frontend (Vite proxyer /api/* til backend)
npm ci
npm run dev      # http://localhost:3000
```

Andre scripts:

```bash
npm run build         # bygger den statiske app til ./dist
npm run lint          # tsc --noEmit (typecheck)
npm run export-songs  # skriver src/data/songs.ts → server/seed/songs.json (DB-seed)
npm run check-songs   # tjekker alle sange mod iTunes (OK/MANGLER)
npm run prune-songs   # fjerner sange uden iTunes-preview fra src/data/songs.ts
npm run bake-songs    # skriver previewUrl + artworkUrl ind i src/data/songs.ts
```

Første gang backend starter, seedes de 273 sange fra `server/seed/songs.json` ind i
SQLite. Derefter er databasen sandheden — tilføj/slet sange via `/admin` eller API'et.

> `check-songs`/`prune-songs`/`bake-songs` kalder iTunes Search og skal køres fra et netværk der ikke er
> blokeret (nogle CI/sandbox-IP'er får 403). Ved usikkert svar beholdes sangen (ingen sletning).

## Admin: udvid kataloget (`/admin`)

Et **lokalt** kurateringsværktøj til at vokse kataloget mod ~500 sange. Det er ikke linket
nogen steder — du skal kende adressen:

```bash
cd server && dotnet run   # backend skal køre — admin skriver til databasen
npm run dev               # i en anden terminal
# åbn http://localhost:3000/admin
```

- Gennemgå kandidater fra `src/data/candidates.json` én ad gangen: afspil preview, redigér
  felter, og **Tilføj / Afvis / Spring over**.
- **Tilføj egen sang** manuelt med samme formular.
- Godkendte sange skrives direkte til **backend-databasen** via `POST /api/songs` (med preview
  + artwork), og er live med det samme — ingen commit eller deploy nødvendig. Beslutninger
  gemmes lokalt i `src/data/candidate-status.json` så afviste ikke dukker op igen.
- Sange der allerede findes i kataloget filtreres automatisk fra.

Admin-pluginnet (`/api/admin/*` i `scripts/adminServer.ts`) findes **kun** under `npm run dev`
og videresender skrivninger til backend-API'et. Selve produktions-frontenden er statisk; det er
backend-API'et der ejer kataloget.

## CI/CD (GitHub Actions)

- **`.github/workflows/ci.yml`** — kører på PR + push til `main`: `npm ci`, typecheck,
  frontend-build og `dotnet build` af backenden.
- **`.github/workflows/deploy.yml`** — hænger af CI via `workflow_run`; bygger frontend ind i
  `server/wwwroot`, kører `dotnet publish -r win-x64 --self-contained`, og synkroniserer
  `publish/` til Simply.com (IIS) via Web Deploy. Den ene .NET-app serverer frontend + API +
  SignalR-hub. `App_Data/` (SQLite-databasen) skippes ved sync, så data overlever redeploys.
- **`.github/workflows/claude.yml`** — skriv `@claude` i et issue eller en PR-kommentar for at få
  Claude til at foreslå/lave ændringer.

### Produktions-arkitektur

Deployet er **self-contained**: `dotnet publish` bundter .NET-runtimen, så Simplys Windows/IIS
ikke behøver .NET installeret. Appen kører i et app pool (ASP.NET Core Module, in-process) og
serverer:

- det byggede React-frontend fra `wwwroot` (med SPA-fallback til `index.html`),
- katalog-API'et (`/api/songs`) og spil-API'et (`/api/games`),
- SignalR-hubben (`/gameHub`).

SQLite-filen ligger i `App_Data/hits.db` (skrivbar, bevaret på tværs af deploys). Vil du hellere
lægge den et andet persistent sted, så sæt `ConnectionStrings__Default` i miljøet/`appsettings`.

### Nødvendige GitHub Secrets

| Secret | Bruges af | Indhold |
|---|---|---|
| `SIMPLY_WEBDEPLOY_URL` | deploy | Web Deploy host uden protokol/port, fx `wXX.simply.com` |
| `SIMPLY_WEBDEPLOY_SITE` | deploy | IIS site name, fx `mitdomæne.dk` |
| `SIMPLY_WEBDEPLOY_USERNAME` | deploy | Web Deploy brugernavn |
| `SIMPLY_WEBDEPLOY_PASSWORD` | deploy | Web Deploy adgangskode |
| `CLAUDE_CODE_OAUTH_TOKEN` | claude | Fra `claude setup-token` (eller brug `ANTHROPIC_API_KEY`) |

Anbefaling: slå branch protection til på `main` og kræv at CI er grøn før merge.
