# my-first-cap

SAP CAP + Fiori Elements app deployed on BTP with HANA Cloud, XSUAA authentication, and SAP Build Work Zone integration.

## Setup

Pick the path that matches your situation:

- **Path A — Local machine, first time**: nothing exists yet (no services, no deploy).
- **Path B — SAP Business Application Studio (BAS)**: cloud IDE, tools preinstalled.
- **Path C — Services already exist in the subaccount**: you (or a previous deploy) already created the CF services and just need to clone, build, and redeploy.

In all cases the CF services live in the **subaccount/space**, not on your machine. Switching machines never requires recreating services.

### Path A — Local machine (first time)

1. Install global tools:

```bash
npm install -g @sap/cds-dk
npm install -g mbt
cf install-plugin multiapps
```

→ See [CURSO.md #2–3](CURSO.md#2-permisos-npm-corregidos) for npm permissions fix on macOS.

2. Clone and install:

```bash
git clone <repo-url>
cd TaskList
npm install
```

3. Log in to CF:

```bash
cf login -a https://api.cf.us10-001.hana.ondemand.com
```

4. Create the XSUAA service (one-time only):

```bash
cf create-service xsuaa application my-first-cap-xsuaa -c xs-security.json
```

The HDI container (`my-first-cap-db`), HTML5 repo services, and destination service are created automatically by the MTA deploy.

5. Make sure your **HANA Cloud instance is running** (trial stops it automatically).

6. Build and deploy:

```bash
npm run build && npm run deploy
```

(`npm run build` = `rimraf resources mta_archives && mbt build --mtar archive`; cleaning first avoids deploying stale zips. `npm run deploy` = `cf deploy mta_archives/archive.mtar --retries 1`.)

7. Assign roles and configure Work Zone — see steps **Roles** and **Work Zone** below.

### Path B — SAP Business Application Studio

1. Create a Dev Space of type **Full Stack Cloud Application** — it ships with `cf` CLI, `mbt`, `@sap/cds-dk`, and the multiapps plugin preinstalled. Skip the global installs entirely.

2. Clone the repo (terminal or "Clone from Git" on the welcome page):

```bash
git clone <repo-url>
cd TaskList
npm install
```

3. Log in to CF — terminal (`cf login -a https://api.cf.us10-001.hana.ondemand.com`) or the Cloud Foundry icon in the left sidebar; select org and space.

4. If the services don't exist yet, run step 4 of Path A. If they do, skip it (see Path C).

5. Verify HANA Cloud is running, then:

```bash
npm run build && npm run deploy
```

### Path C — Services already exist in the subaccount

This is the normal case after the first deploy, or when switching machines (e.g. laptop → BAS).

1. Clone, `npm install`, `cf login` (same as above — any machine).
2. **Skip `cf create-service` entirely.** `my-first-cap-xsuaa` is declared as `org.cloudfoundry.existing-service` in `mta.yaml`: the deploy binds to it, it never creates it. Running create-service again just errors with "instance already exists". The HDI container is reused too — **data in HANA persists across deploys**.
3. If `xs-security.json` changed (e.g. new redirect-uris), apply it once from any machine:

```bash
cf update-service my-first-cap-xsuaa -c xs-security.json
```

This updates the service in the cloud; it does not need to be repeated per machine.

4. Verify HANA Cloud is running, then `npm run build && npm run deploy`.

### Roles

1. BTP Cockpit → Security → Role Collections → Create `TasksEditor`
2. Add roles `Viewer` and `Editor` (app `my-first-cap`)
3. Security → **Users** → assign `TasksEditor` to your user — **on the identity provider you actually log in with**. With IAS configured, your email appears twice (origin `sap.default` and the IAS origin); Work Zone logs you in through **IAS**, so assign the role collection to the IAS entry. See [CURSO.md #31](CURSO.md).
4. Open a fresh incognito window afterwards — JWTs cache the scopes.

### Work Zone (automatic discovery — managed approuter)

The app is discovered automatically via the HTML5 Apps content channel (no manual tile needed; see [CURSO.md #29–31](CURSO.md)):

1. Site Manager → **Channel Manager** → HTML5 Apps → **refresh** the content channel.
2. **Content Manager → Content Explorer → HTML5 Apps** → add `Task Manager` to your content.
3. Assign the app to a group and to a role (e.g. `Everyone`), add it to your site.
4. The app launches inside the Work Zone shell (header, profile, back navigation) via the `Tasks-display` intent.

The standalone approuter remains deployed only as a direct-access URL for testing; Work Zone does not use it.

---

## Known issues / gotchas (updated)

- HANA Cloud trial stops automatically — verify it's running before each deploy
- After assigning roles, open a fresh incognito window to get a new JWT
- **403 "lacking required roles: [Tasks.Read]" inside Work Zone** → the role collection is assigned to the wrong identity-provider entry. Assign `TasksEditor` to the **IAS** user entry, then log out/in (see [CURSO.md #31](CURSO.md))
- **MTA deploy fails at "Detaching service my-first-cap-auth"** → stale MTA metadata from an old deploy; everything before that line deployed correctly. Permanent fix:

```bash
cf cups my-first-cap-auth -p '{}'   # dummy service so the detach succeeds
npm run deploy                       # metadata gets cleaned
cf delete-service my-first-cap-auth -f
```

- `mbt build` error `field build-parameters not found in type mta.Resource` → the `destination-content` block was pasted under `resources:`; it is a **module** (see [CURSO.md #29](CURSO.md))
- Work Zone tile requires FLP hash fix in `index.html` — see [CURSO.md #27](CURSO.md#27-fixes-aplicados-durante-el-proceso)