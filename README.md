# Hitster Musik Quiz

En Hitster-inspireret musik-gættequiz bygget som en statisk **React + TypeScript + Vite**-app.
Gæt årstal og placér danske og internationale hits på tidslinjen. 30-sekunders lydklip hentes
live fra iTunes Search API (ingen API-nøgle nødvendig), lydeffekter genereres i browseren.

## Kør lokalt

**Forudsætning:** Node.js 20+

```bash
npm ci
npm run dev      # http://localhost:3000
```

Andre scripts:

```bash
npm run build         # bygger den statiske app til ./dist
npm run lint          # tsc --noEmit (typecheck)
npm run check-songs   # tjekker alle sange mod iTunes (OK/MANGLER)
npm run prune-songs   # fjerner sange uden iTunes-preview fra src/data/songs.ts
```

> `check-songs`/`prune-songs` kalder iTunes Search og skal køres fra et netværk der ikke er
> blokeret (nogle CI/sandbox-IP'er får 403). Ved usikkert svar beholdes sangen (ingen sletning).

## CI/CD (GitHub Actions)

- **`.github/workflows/ci.yml`** — kører på PR + push til `main`: `npm ci`, typecheck, build.
- **`.github/workflows/deploy.yml`** — hænger af CI via `workflow_run`; bygger og synkroniserer
  `dist/` til Simply.com (IIS) via Web Deploy. Statisk site, ingen server-runtime.
- **`.github/workflows/claude.yml`** — skriv `@claude` i et issue eller en PR-kommentar for at få
  Claude til at foreslå/lave ændringer.

### Nødvendige GitHub Secrets

| Secret | Bruges af | Indhold |
|---|---|---|
| `SIMPLY_WEBDEPLOY_URL` | deploy | Web Deploy host uden protokol/port, fx `wXX.simply.com` |
| `SIMPLY_WEBDEPLOY_SITE` | deploy | IIS site name, fx `mitdomæne.dk` |
| `SIMPLY_WEBDEPLOY_USERNAME` | deploy | Web Deploy brugernavn |
| `SIMPLY_WEBDEPLOY_PASSWORD` | deploy | Web Deploy adgangskode |
| `CLAUDE_CODE_OAUTH_TOKEN` | claude | Fra `claude setup-token` (eller brug `ANTHROPIC_API_KEY`) |

Anbefaling: slå branch protection til på `main` og kræv at CI er grøn før merge.
