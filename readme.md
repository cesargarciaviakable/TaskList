# my-first-cap

SAP CAP + Fiori Elements app deployed on BTP with HANA Cloud, XSUAA authentication, and SAP Build Work Zone integration.

## Stack

- **Backend**: SAP CAP (Node.js), OData V4
- **Database**: SAP HANA Cloud (HDI Container)
- **Auth**: XSUAA (OAuth 2.0 / JWT)
- **UI**: SAP Fiori Elements — List Report + Object Page
- **Deploy**: MTA (`mbt build` + `cf deploy`)
- **Portal**: SAP Build Work Zone Standard Edition

## Prerequisites

- BTP Trial account with:
  - HANA Cloud instance running and mapped to your CF space
  - Cloud Identity Services subscription (IAS tenant)
  - SAP Build Work Zone Standard Edition subscription
- CF CLI installed and logged in: `cf login -a https://api.cf.us10-001.hana.ondemand.com`
- Node.js 18+

## Setup

### 1. Install global tools

```bash
npm install -g @sap/cds-dk
npm install -g mbt
npm install -g mta
npm install -g yo@5.1.0
cf install-plugin multiapps
```

→ See [CURSO.md #2–3](CURSO.md#2-permisos-npm-corregidos) for npm permissions fix on macOS.

### 2. Clone and install

```bash
git clone <repo-url>
cd my-first-cap
npm install
```

### 3. Create CF services

```bash
cf create-service xsuaa application my-first-cap-xsuaa -c xs-security.json
```

The HDI container (`my-first-cap-db`) is created automatically by the MTA deploy.

→ See [CURSO.md #17](CURSO.md#17-autenticaci%C3%B3n----crear-servicio-xsuaa-en-cf-y-bindear-localmente) for XSUAA service details.

### 4. Local development (optional)

Bind services locally and run against HANA Cloud:

```bash
cds bind -2 my-first-cap-db
cds bind -2 my-first-cap-xsuaa
cds watch --profile hybrid
```

→ See [CURSO.md #14](CURSO.md#14-conexi%C3%B3n-a-hana-cloud) for HANA Cloud local setup.

### 5. Build and deploy to BTP

```bash
mbt build
cf deploy mta_archives/my-first-cap_1.0.0.mtar
```

→ See [CURSO.md #24](CURSO.md#24-build-y-deploy-mta) for full deploy details.

### 6. Configure XSUAA redirect URIs

After the first deploy, update the XSUAA service with the correct redirect URI pattern:

```bash
cf update-service my-first-cap-xsuaa -c xs-security.json
```

`xs-security.json` already contains `https://*.cfapps.us10-001.hana.ondemand.com/**`.

### 7. Assign roles in BTP Cockpit

1. Security → Role Collections → Create `TasksEditor`
2. Add roles `Viewer` and `Editor`
3. Assign to your user

→ See [CURSO.md #20](CURSO.md#20-asignaci%C3%B3n-de-roles-al-usuario-en-btp-cockpit).

### 8. Configure Work Zone tile

→ See [CURSO.md #25–26](CURSO.md#25-sap-build-work-zone-standard-edition) for full Work Zone setup and tile creation.

## Project structure

```
my-first-cap/
├── app/
│   └── tasks/              # Fiori Elements UI
│       ├── webapp/
│       │   ├── index.html  # UI5 bootstrap + FLP hash fix
│       │   └── manifest.json
│       ├── xs-app.json     # HTML5 repo routing
│       └── ui5-deploy.yaml # CF build config
├── approuter/              # Application Router
│   ├── xs-app.json
│   └── package.json
├── db/
│   ├── schema.cds          # Data model
│   └── data/               # Seed CSVs
├── srv/
│   ├── task-service.cds    # OData service
│   └── annotations.cds     # Fiori UI annotations
├── xs-security.json        # XSUAA config
├── mta.yaml                # MTA deploy descriptor
└── CURSO.md                # Step-by-step course notes
```

## URLs (trial)

| Resource | URL |
|---|---|
| CAP backend | `https://c4939d22trial-hana-cloud-my-first-cap-srv.cfapps.us10-001.hana.ondemand.com` |
| Approuter | `https://c4939d22trial-hana-cloud-my-first-cap-approuter.cfapps.us10-001.hana.ondemand.com` |
| Work Zone | `https://c4939d22trial.dt.launchpad.cfapps.us10.hana.ondemand.com` |

## Known issues / gotchas

- HANA Cloud trial stops automatically — verify it's running before each deploy
- After assigning roles, open a fresh incognito window to get a new JWT
- MTA deploy always fails at "Detaching service my-first-cap-auth" — stale metadata artifact, not a real error; both apps start correctly
- Work Zone tile requires FLP hash fix in `index.html` — see [CURSO.md #27](CURSO.md#27-fixes-aplicados-durante-el-proceso)
