# Guide: Auto-deploy fra GitHub til Simply.com (ASP.NET Core / IIS)

Denne guide beskriver hvordan man sætter et .NET-webprojekt op, så et **push/merge til `main`**
på GitHub automatisk bygger, tester, publisher og deployer til en **Simply.com IIS-hosting** via
**Web Deploy (msdeploy)**. Setup'et er kopieret fra et velfungerende produktionsprojekt.

> Til Claude: Tilpas .NET-version, RID, projektsti og navne til det aktuelle projekt. Alt der
> står i `<vinkelparenteser>` skal erstattes. Spørg brugeren om de Simply-værdier du ikke kan finde.

---

## ⚠️ Erfaringer fra faktisk opsætning (Runaway på Simply, .NET 10)

Denne sektion opsummerer hvad der reelt virkede, efter en del fejlfinding. **Læs den før du følger
trinnene nedenfor** — den korrigerer et par ting i den generiske guide for netop Simply-hosting.

**Simply har IKKE .NET-hosting-bundle for nye .NET-versioner (fx .NET 10), og `dotnet` er ikke på
worker-processens PATH.** Et framework-dependent build fejler derfor ved opstart. Symptomer set i denne rækkefølge:

| Fejl | Årsag | Fix |
|---|---|---|
| `500.19` — "does not contain a root `<configuration>` tag" | web.config indeholdt kun `<aspNetCore>`-fragmentet | Brug en **komplet** web.config med `<configuration>` + `<handlers>` (se nedenfor) |
| `500.0` in-process, **tom stdout** | ANCM kunne ikke finde `dotnet.exe` (ikke på PATH, ingen runtime på serveren) | Se ANCM-debuglog; skift til self-contained |
| ANCM-log: `Could not find dotnet.exe` / `hostfxr.dll not found` | Framework-dependent build kræver runtime på serveren, som ikke findes | **Self-contained** build (runtime pakkes med) |
| Fungerer stadig ikke ved `win-x64` | Simplys app pool er **32-bit** | **`--runtime win-x86`** |
| Siden hænger på **"Loading"** (WASM booter ikke); `/_framework/blazor.webassembly` → 404 | .NET 9+ fingerprint-placeholderen `#[.{fingerprint}]` i `index.html` erstattes ikke ved publish af det **hostede** Server-projekt | `WasmFingerprintAssets=false` + simpelt scriptnavn `blazor.webassembly.js` |

### Det der virker på Simply (Blazor WASM hosted, .NET 10)

1. **Publish self-contained, 32-bit:**
   ```
   dotnet publish <Server.csproj> --configuration Release --runtime win-x86 --self-contained true --output ./publish
   ```
2. **Start via apphost'en, out-of-process** (undgår bitness-problemer i IIS-workeren). Serverens `web.config`:
   ```xml
   <?xml version="1.0" encoding="utf-8"?>
   <configuration>
     <location path="." inheritInChildApplications="false">
       <system.webServer>
         <handlers>
           <add name="aspNetCore" path="*" verb="*" modules="AspNetCoreModuleV2" resourceType="Unspecified" />
         </handlers>
         <aspNetCore processPath=".\<AppNavn>.exe" arguments="" hostingModel="outofprocess">
           <environmentVariables>
             <environmentVariable name="ASPNETCORE_ENVIRONMENT" value="Production" />
             <!-- SQLite i App_Data så den overlever deploys (skip-reglen) -->
             <environmentVariable name="ConnectionStrings__Default" value="Data Source=App_Data\<db>.db" />
           </environmentVariables>
         </aspNetCore>
       </system.webServer>
     </location>
   </configuration>
   ```
   Tilføj midlertidigt `stdoutLogEnabled="true" stdoutLogFile=".\logs\stdout"` og
   `<handlerSettings><handlerSetting name="debugLevel" value="TRACE"/><handlerSetting name="debugFile" value=".\logs\ancm.log"/></handlerSettings>`
   under fejlfinding — og fjern det igen bagefter. Opret mapperne `App_Data` og `logs` (skrivbare) i sitets rod.

3. **Fiks Blazor-bootstrap-scriptet** (ellers evig "Loading"). I WASM-klientens `.csproj`:
   ```xml
   <WasmFingerprintAssets>false</WasmFingerprintAssets>
   ```
   og i `wwwroot/index.html`:
   ```html
   <script src="_framework/blazor.webassembly.js"></script>
   ```

**Fejlfindingsrækkefølge der virkede:** ANCM-debuglog (`logs/ancm.log`) afslører opstart/host-fejl selv når
stdout er tom → stdout-log (`logs/stdout_*.log`) afslører app-opstart/exceptions → browserens netværksfane
afslører manglende statiske filer (fx 404 på bootstrap-scriptet).

---

## Overordnet arkitektur

- **To workflows** i `.github/workflows/`:
  - `ci.yml` — kører på pull requests + push til `main`: restore, build (warnings-as-errors), test.
  - `deploy.yml` — hænger af CI via `workflow_run` (kører når CI er grøn på `main`) samt manuelt: publish + deploy til Simply.
- Deploy sker med `msdeploy.exe` (Web Deploy V3), som allerede findes på GitHubs `windows-latest` runner.
- Hemmeligheder (Simply-credentials) ligger i **GitHub Secrets**, ikke i repoet.
- Produktionens `web.config` med miljøvariabler (secrets) **overskrives ALDRIG** ved deploy.

---

## Arbejdsgang (branch → PR → merge → deploy)

Den daglige flow, som pipelinen understøtter:

1. **Opret et issue** for opgaven (evt. med `@claude` hvis Claude-workflowet er sat op, Trin 7).
2. **Lav en branch og en PR** mod `main`. Når PR'en åbnes/opdateres, kører **CI** automatisk på branchen
   (via `pull_request`-triggeren) — så du ser grønt/rødt før merge.
3. **Godkend og merge PR'en** til `main`.
4. Merget udløser **CI på `main`**, og når den er **grøn**, trigger den via `workflow_run` **Deploy to Simply**.
5. Deploy publisher og synkroniserer til Simply → ændringen er live.

```
issue ──▶ branch + PR ──▶ CI (pull_request)         ┐
                                                    │  grøn?
              merge til main ──▶ CI (push) ──▶ Deploy to Simply (workflow_run) ──▶ live
```

> **Anbefalet: slå branch protection til** på `main` (Settings → Branches → Add rule): kræv en PR og
> at **CI-statustjekket er grønt** før merge. Så kan man ikke pushe direkte til `main` uden om CI, og
> kun validerede ændringer bliver deployet. Uden reglen *kan* man teknisk merge/pushe forbi CI.

---

## Forudsætninger på Simply.com

1. Hostingen skal være en **Windows/IIS-plan med Web Deploy (WMSVC) aktiveret**. Simply har en
   knap/indstilling for "Web Deploy" / "Fjernpublicering" pr. website — den skal være slået til.
2. Fra Simplys kontrolpanel skal du finde disse **fire værdier** (de bruges som GitHub Secrets):
   - **Web Deploy URL / server** — fx `wXX.simply.com` eller den serv/host Simply oplyser (uden `https://` og uden port).
   - **Site name** — IIS-sitenavnet, typisk dit domæne, fx `mitdomæne.dk`.
   - **Brugernavn** — Web Deploy-brugeren (ofte `<konto>(<domæne>)` eller lignende).
   - **Adgangskode** — Web Deploy-adgangskoden.
3. **Runtime:** Bekræft om serveren har .NET Hosting Bundle for din `TargetFramework`. På Simply var
   det **ikke** tilfældet for .NET 10 (se erfarings-sektionen), så vi deployer **self-contained** og er
   uafhængige af serverens runtime. Har din plan den rette runtime, kan du i stedet køre framework-dependent
   (`--self-contained false`) for en mindre payload.

---

## Trin 1 — GitHub Secrets

Opret disse fire secrets i repoet (**Settings → Secrets and variables → Actions → New repository secret**).
Brug helst også et **Environment** ved navn `production` (Settings → Environments) og læg dem der,
så man kan tilføje beskyttelsesregler senere. Navnene skal matche `deploy.yml` nedenfor:

| Secret | Indhold |
|---|---|
| `SIMPLY_WEBDEPLOY_URL` | Web Deploy server-host, uden protokol og port. Fx `wXX.simply.com` |
| `SIMPLY_WEBDEPLOY_SITE` | IIS site name. Fx `mitdomæne.dk` |
| `SIMPLY_WEBDEPLOY_USERNAME` | Web Deploy brugernavn |
| `SIMPLY_WEBDEPLOY_PASSWORD` | Web Deploy adgangskode |

---

## Trin 2 — csproj-indstillinger (vigtigt)

Hvis appen bruger miljøvariabler i produktionens `web.config` (connection strings, API-nøgler osv.),
skal du forhindre at publish genererer en ny `web.config` der overskriver serverens. Tilføj i
web-projektets `.csproj` under `<PropertyGroup>`:

```xml
<!--
  Produktionens web.config på serveren indeholder håndredigerede environmentVariables.
  En genereret web.config ville udslette dem ved hver deploy, så vi slår auto-transform fra
  og lader Web Deploy stå af den (se skip-reglen i deploy.yml).
-->
<IsTransformWebConfigDisabled>true</IsTransformWebConfigDisabled>
```

Sørg også for at udviklings-appsettings ikke ryger med til serveren:

```xml
<ItemGroup>
  <Content Update="appsettings.Development.json">
    <CopyToPublishDirectory>Never</CopyToPublishDirectory>
  </Content>
</ItemGroup>
```

**Blazor WebAssembly (hosted):** slå asset-fingerprinting fra i WASM-klientens `.csproj`, ellers
booter appen aldrig i produktion (evig "Loading", 404 på bootstrap-scriptet — se erfarings-sektionen):

```xml
<WasmFingerprintAssets>false</WasmFingerprintAssets>
```

og referér scriptet med det simple navn i `wwwroot/index.html`:

```html
<script src="_framework/blazor.webassembly.js"></script>
```

---

## Trin 3 — `.github/workflows/ci.yml`

Bygger og tester på hver PR og push. Fanger fejl før de kan nå produktion.

```yaml
name: CI

on:
  push:
    branches: [main]
    paths-ignore:          # ren dokumentation udløser hverken CI eller (dermed) deploy
      - '**.md'
      - 'docs/**'
  pull_request:
    branches: [main]
    paths-ignore:
      - '**.md'
      - 'docs/**'

jobs:
  build-and-test:
    runs-on: windows-latest

    steps:
      - name: Checkout
        uses: actions/checkout@v4

      - name: Setup .NET
        uses: actions/setup-dotnet@v4
        with:
          dotnet-version: 9.0.x        # <-- match projektets TargetFramework

      - name: Restore
        run: dotnet restore

      - name: Build
        run: dotnet build --configuration Release --no-restore /warnaserror

      - name: Test
        run: dotnet test --configuration Release --no-build --logger "trx;LogFileName=test-results.trx" --collect:"XPlat Code Coverage"

      - name: Upload test results
        if: always()
        uses: actions/upload-artifact@v4
        with:
          name: test-results
          path: '**/TestResults/**/*'
          retention-days: 14
```

> Hvis projektet ikke har testprojekt endnu, kan `dotnet test`-trinnet fjernes — men behold det
> gerne som tom placeholder, så pipelinen er klar når tests kommer.

---

## Trin 4 — `.github/workflows/deploy.yml`

Publisher og deployer til Simply. **Hæng deploy af CI via `workflow_run`** i stedet for at lytte på
push'et selv — ellers bygger CI og deploy parallelt ved hvert push, og en rød build kan nå serveren.
Med kæden kører flowet: push til `main` → CI → (grøn) → Deploy.

```yaml
name: Deploy to Simply

on:
  # Hæng af CI: deploy kører først når CI er grøn på main (ikke parallelt med CI).
  workflow_run:
    workflows: [CI]
    branches: [main]
    types: [completed]
  workflow_dispatch:          # tillader manuel kørsel fra GitHub UI

# Kun én deploy ad gangen, så to samtidige pushes ikke slås om IIS-sitet.
concurrency:
  group: deploy-production
  cancel-in-progress: false

jobs:
  deploy:
    # Deploy kun når den udløsende CI-kørsel lykkedes (workflow_dispatch har ingen
    # workflow_run-kontekst, så den lukkes også igennem).
    if: ${{ github.event_name == 'workflow_dispatch' || github.event.workflow_run.conclusion == 'success' }}
    runs-on: windows-latest
    environment: production     # binder til GitHub Environment "production"

    steps:
      - name: Checkout
        uses: actions/checkout@v4
        with:
          # Deploy præcis den commit CI validerede (ikke bare tip of main).
          ref: ${{ github.event_name == 'workflow_run' && github.event.workflow_run.head_sha || github.ref }}

      - name: Setup .NET
        uses: actions/setup-dotnet@v4
        with:
          dotnet-version: 9.0.x                    # <-- match TargetFramework

      - name: Restore
        run: dotnet restore

      # Byg hele solution så evt. testprojekts .dll findes til Test-trinnet.
      - name: Build
        run: dotnet build --configuration Release --no-restore

      - name: Test
        run: dotnet test --configuration Release --no-build

      # Self-contained win-x86: Simply har ikke nyere .NET-runtimes og kører 32-bit
      # app pool, så runtimen bundtes med og bygges 32-bit. (Se "Erfaringer"-sektionen
      # øverst — et framework-dependent build fejler ved opstart på Simply.)
      - name: Publish
        run: dotnet publish <STI/TIL/Projekt.csproj> --configuration Release --runtime win-x86 --self-contained true --output ./publish

      # Deploy alle filer UNDTAGEN web.config (serverens har secrets) og App_Data.
      # msdeploy.exe kaldes direkte, fordi Simplys WMSVC-brugere kun har
      # contentPath-rettigheder på deres eget site — ikke rettigheder til at
      # stoppe/starte app pool. Poolen genstarter selv når .dll'en udskiftes.
      - name: Deploy to Simply via Web Deploy
        shell: pwsh
        env:
          WEBDEPLOY_URL: ${{ secrets.SIMPLY_WEBDEPLOY_URL }}
          WEBDEPLOY_SITE: ${{ secrets.SIMPLY_WEBDEPLOY_SITE }}
          WEBDEPLOY_USERNAME: ${{ secrets.SIMPLY_WEBDEPLOY_USERNAME }}
          WEBDEPLOY_PASSWORD: ${{ secrets.SIMPLY_WEBDEPLOY_PASSWORD }}
        run: |
          $msdeploy = "${env:ProgramFiles}\IIS\Microsoft Web Deploy V3\msdeploy.exe"
          if (-not (Test-Path $msdeploy)) {
            $msdeploy = "${env:ProgramFiles(x86)}\IIS\Microsoft Web Deploy V3\msdeploy.exe"
          }
          if (-not (Test-Path $msdeploy)) {
            Write-Error "msdeploy.exe not found on the runner"
            exit 1
          }

          # Byg hvert argument som én samlet streng. Almindelig PowerShell-kaldesyntaks
          # splitter på komma, hvilket kolliderer med msdeploys komma-separerede
          # provider-settings — så vi samler argumenterne selv.
          $source = "-source:contentPath=$PWD\publish"
          $dest = "-dest:contentPath=$($env:WEBDEPLOY_SITE),computerName=https://$($env:WEBDEPLOY_URL):8172/msdeploy.axd?site=$($env:WEBDEPLOY_SITE),userName=$($env:WEBDEPLOY_USERNAME),password=$($env:WEBDEPLOY_PASSWORD),authType=Basic"
          $skipConfig = '-skip:objectName=filePath,absolutePath=web\.config$'
          $skipData = '-skip:objectName=dirPath,absolutePath=App_Data'

          & $msdeploy `
            -verb:sync `
            $source `
            $dest `
            -allowUntrusted `
            -enableRule:AppOffline `
            -enableRule:DoNotDeleteRule `
            $skipConfig `
            $skipData

          if ($LASTEXITCODE -ne 0) {
            Write-Error "msdeploy failed with exit code $LASTEXITCODE"
            exit $LASTEXITCODE
          }
```

### Hvad de vigtige msdeploy-flag gør

| Flag | Formål |
|---|---|
| `-verb:sync` | Synkroniser publish-mappen op til sitet |
| `computerName=https://<url>:8172/msdeploy.axd?site=<site>` | WMSVC-endpoint på Simply (port **8172**) |
| `authType=Basic` | Web Deploy basic-auth med brugernavn/adgangskode |
| `-allowUntrusted` | Accepter Simplys WMSVC-cert (self-signed) |
| `-enableRule:AppOffline` | Lægger `app_offline.htm` under deploy, så filer ikke er låst |
| `-enableRule:DoNotDeleteRule` | Sletter ikke server-filer der mangler i publish (fx App_Data-indhold) |
| `-skip:...web\.config$` | Rører **aldrig** serverens `web.config` (bevarer secrets) |
| `-skip:...App_Data` | Rører ikke App_Data (uploads/db-filer) |

---

## Trin 5 — Miljøvariabler / secrets på serveren (engangsopgave)

Auto-deployet rører **ikke** `web.config`. Første gang skal appens produktions-secrets derfor
sættes manuelt på serveren via `web.config`'s `<environmentVariables>` under
`<aspNetCore>`. Eksempel:

```xml
<aspNetCore processPath="dotnet" arguments=".\<AppNavn>.dll" hostingModel="inprocess">
  <environmentVariables>
    <environmentVariable name="ASPNETCORE_ENVIRONMENT" value="Production" />
    <environmentVariable name="ConnectionStrings__Default" value="..." />
    <!-- flere secrets efter behov -->
  </environmentVariables>
</aspNetCore>
```

Redigér denne fil via Simplys filhåndtering/FTP **én gang**. Derefter bevarer alle fremtidige
deploys den (pga. skip-reglen).

---

## Trin 6 — Verificér

1. Commit begge workflow-filer og push til en branch → åbn PR → se at **CI** kører grønt.
2. Merge til `main` → se **Deploy to Simply** køre i fanen **Actions**.
3. Tjek at siden på nettet viser ændringen.
4. Kan også trigges manuelt: **Actions → Deploy to Simply → Run workflow**.

---

## Fejlfinding

| Symptom | Årsag / løsning |
|---|---|
| `msdeploy.exe not found` | Sjældent på `windows-latest`; Web Deploy V3 er præinstalleret. Tjek stien. |
| `ERROR_USER_UNAUTHORIZED` / 401 | Forkert brugernavn/adgangskode, eller Web Deploy ikke aktiveret på sitet. |
| `Could not connect ... 8172` | Forkert `WEBDEPLOY_URL`, eller WMSVC ikke slået til hos Simply. |
| Cert-fejl | `-allowUntrusted` skal være med (self-signed WMSVC-cert). |
| Siden nede efter deploy pga. manglende secrets | `web.config` blev overskrevet — bekræft `IsTransformWebConfigDisabled` og skip-reglen. |
| App pool låser filer | `-enableRule:AppOffline` skal være med. |
| Forkert RID/arkitektur | Match `--runtime` (win-x86/win-x64) til det app pool'en kører (32/64-bit). Simply = win-x86. |
| `500.0` in-process + tom stdout, ANCM: `Could not find dotnet.exe` | Ingen .NET-runtime på serveren → publicér **self-contained**. |
| Blazor WASM hænger på "Loading", 404 på `/_framework/blazor.webassembly` | Fingerprint-placeholder ikke erstattet → `WasmFingerprintAssets=false` + `blazor.webassembly.js`. |

---

## Trin 7 — (valgfrit) Claude GitHub Action

Lader dig skrive **`@claude`** i et issue eller en PR-kommentar og få Claude til at svare/lave ændringer
og åbne en PR. Uafhængig af CI/deploy — fejler kun sig selv, hvis token mangler.

### `.github/workflows/claude.yml`

```yaml
name: Claude

on:
  issues:
    types: [opened, assigned]
  issue_comment:
    types: [created]
  pull_request_review_comment:
    types: [created]
  pull_request_review:
    types: [submitted]

concurrency:
  group: claude-${{ github.event.issue.number || github.event.pull_request.number }}
  cancel-in-progress: false

jobs:
  claude:
    if: |
      (github.event_name == 'issue_comment' && contains(github.event.comment.body, '@claude')) ||
      (github.event_name == 'pull_request_review_comment' && contains(github.event.comment.body, '@claude')) ||
      (github.event_name == 'pull_request_review' && contains(github.event.review.body, '@claude')) ||
      (github.event_name == 'issues' && (contains(github.event.issue.body, '@claude') || contains(github.event.issue.title, '@claude')))
    runs-on: ubuntu-latest
    permissions:
      contents: write
      pull-requests: write
      issues: write
      id-token: write
    steps:
      - uses: actions/checkout@v4
        with:
          fetch-depth: 1
      - name: Setup .NET
        uses: actions/setup-dotnet@v4
        with:
          dotnet-version: '10.0.x'
      - name: Run Claude Code
        uses: anthropics/claude-code-action@v1
        with:
          claude_code_oauth_token: ${{ secrets.CLAUDE_CODE_OAUTH_TOKEN }}
          claude_args: |
            --allowed-tools "Bash(dotnet restore:*),Bash(dotnet build:*),Bash(dotnet test:*)"
```

### Sådan får du den nødvendige nøgle/token

Læg **én** af følgende i repoets secrets (**Settings → Secrets and variables → Actions**). Ovenstående
workflow bruger `CLAUDE_CODE_OAUTH_TOKEN`; vil du hellere bruge en API-nøgle, så byt linjen ud med
`anthropic_api_key: ${{ secrets.ANTHROPIC_API_KEY }}`.

| Mulighed | Sådan får du den | Secret-navn |
|---|---|---|
| **Claude Code OAuth-token** (bruger dit Claude-abonnement, fx Pro/Max) | Kør `claude setup-token` i en **interaktiv** Claude Code-terminal; kopiér tokenen | `CLAUDE_CODE_OAUTH_TOKEN` |
| **Anthropic API-nøgle** (pay-as-you-go) | [console.anthropic.com](https://console.anthropic.com) → **API Keys → Create Key** (kræver konto med kredit) | `ANTHROPIC_API_KEY` |

Nemmeste opsætning: kør `/install-github-app` i en interaktiv `claude`-terminal — den installerer GitHub-app'en,
opretter workflow-filen og lægger den rette secret ind. (`claude setup-token` og `/install-github-app` er
interaktive og kan ikke køres i en non-interaktiv session.)
