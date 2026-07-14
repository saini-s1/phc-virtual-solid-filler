# Deploying to Azure (App Service Web App)

This app is a Vite/React SPA with one small backend: an Express server
(`server/index.js`) that (a) serves the built `dist/` bundle and (b) exposes a
tiny REST API used by the Nutrition Calculator's **"Save to library"** feature
(`GET/POST /api/ingredients`). Everything else in the app is a pure static
front end and needs no server.

## Architecture

```
Browser  ──►  Azure App Service (Node 20, Linux)
              └── server/index.js (Express)
                    ├── serves dist/ (the built SPA) + SPA fallback routing
              ├── GET    /api/health
              ├── GET    /api/ingredients      → list saved custom ingredients
              ├── POST   /api/ingredients      → validate + save a new one
              └── DELETE /api/ingredients/:id  → permanently remove a saved one
                                • Azure Table Storage   (AZURE_STORAGE_CONNECTION_STRING set)
                                • local JSON file        (fallback, dev only, gitignored)
```

Nothing else in the repo (the packaging/DEM module, the nutrition calculation
engine) talks to a network — they're pure client-side math.

## Local development

```bash
npm install
cp .env.example .env        # optional — leave AZURE_STORAGE_CONNECTION_STRING blank to use the local file store
npm run dev:full            # Vite (5173) + Express API (8080) together, proxied
```

Or run them separately: `npm run dev` (Vite only) and `npm run server`
(Express only) in two terminals. `npm run build && npm start` runs the exact
production path (Express serving the built `dist/`).

## Environment variables

None of these are hardcoded in source — they're read from `process.env` in
`server/index.js` / `server/store.js` only.

| Variable | Required | Where it's set | Purpose |
| --- | --- | --- | --- |
| `PORT` | No | Azure sets automatically | Port Express listens on (defaults to 8080 locally). |
| `AZURE_STORAGE_CONNECTION_STRING` | Recommended in production | Azure App Service → Configuration → Application settings (secret) | Enables Azure Table Storage for the custom ingredient library. Without it, ingredients only persist to a local JSON file — fine for a dev box, **not** durable/shared in production. |
| `AZURE_STORAGE_TABLE_NAME` | No (default `CustomIngredients`) | Same as above | Table name for saved ingredients. |
| `NODE_ENV` | No | Same as above, set to `production` | Standard Node convention; Express/npm behave slightly differently in prod. |

There is no `VITE_*` build-time variable in this project today — if one is
added later (e.g. `VITE_API_BASE_URL`), remember Vite bakes those into the
client bundle at build time, so they must be set in the CI environment
*before* `npm run build` runs, not just as an App Service app setting.

## One-time Azure setup

1. **Create a Storage Account** (any redundancy tier is fine for a prototype)
   for the custom ingredient library.
   - Azure Portal → Storage account → Access keys → copy a connection string.
2. **Create the Web App**: App Service → Create → Web App.
   - Publish: Code. Runtime stack: **Node 20 LTS**. OS: **Linux** (matches the
     GitHub Actions workflow, which builds on `ubuntu-latest`).
3. **Configure Application settings** (Web App → Configuration → Application settings):
   - `AZURE_STORAGE_CONNECTION_STRING` = the connection string from step 1.
   - `NODE_ENV` = `production`.
   - (Leave `PORT`/startup command as default — Azure's Node image runs `npm start`
     automatically when it finds a `start` script in `package.json`, which this repo has.)
4. **Set up federated (OIDC) login for GitHub Actions** — this is the auth method
   the workflow uses; it's [Microsoft's currently recommended approach](https://learn.microsoft.com/en-us/azure/app-service/deploy-github-actions?tabs=openid#configure-the-github-actions-workflow)
   for Azure/GitHub Actions because no long-lived secret/password is stored in
   GitHub — GitHub proves its identity to Azure AD per-run instead.

   ```bash
   # 1. Create an Azure AD app registration + service principal
   az ad app create --display-name "phc-virtual-solid-filler-gha"
   # note the appId (this is AZURE_CLIENT_ID) from the output, then:
   az ad sp create --id <appId>

   # 2. Grant it permission to deploy to the Web App's resource group
   az role assignment create --role "Website Contributor" \
     --assignee <appId> \
     --scope /subscriptions/<subscriptionId>/resourceGroups/<resourceGroupName>

   # 3. Tell Azure AD to trust GitHub's OIDC tokens for this repo/branch
   az ad app federated-credential create --id <appId> --parameters '{
     "name": "github-main-branch",
     "issuer": "https://token.actions.githubusercontent.com",
     "subject": "repo:<org>/<repo>:ref:refs/heads/main",
     "audiences": ["api://AzureADTokenExchange"]
   }'
   ```

   Then add three GitHub repo secrets (Settings → Secrets and variables →
   Actions → New repository secret) — none of these are passwords, they're just
   identifiers Azure AD uses to recognize the trusted app registration:
   - `AZURE_CLIENT_ID` = the `appId` from step 1
   - `AZURE_TENANT_ID` = your tenant id (`az account show --query tenantId -o tsv`)
   - `AZURE_SUBSCRIPTION_ID` = the subscription id (`az account show --query id -o tsv`)

   > **Simpler alternative (not recommended, but supported):** Web App →
   > Overview → "Get publish profile", stored as a secret and passed to
   > `azure/webapps-deploy@v3` via `publish-profile:`. This still works, but
   > it's a long-lived credential that must be manually rotated if it ever
   > leaks — OIDC has neither problem, which is why the checked-in workflow
   > uses it.
5. **Add a repo variable** `AZURE_WEBAPP_NAME` set to the Web App's resource name
   (Settings → Secrets and variables → Actions → Variables tab).
6. Push to `main` — `.github/workflows/azure-webapp-deploy.yml` builds, tests,
   prunes dev dependencies, and deploys automatically. You can also trigger it
   manually from the Actions tab (`workflow_dispatch`).

## Known gaps / things to revisit before this is more than a prototype

- **No authentication on `/api/ingredients`.** Anyone who can reach the app URL
  can add or delete library entries (rate-limited to 30/15min per IP, and every
  field/id is validated, but there's no login). If this needs to be restricted
  to P&G users, the simplest add-on is Azure App Service **Authentication (Easy
  Auth)** with Microsoft Entra ID — it sits in front of the app with no code
  changes.
- **Table Storage has no soft-delete/versioning configured.** Fine for a
  prototype library of ingredients; revisit if this becomes a system of record.
- The custom ingredient library is **global** (shared by every user), not
  per-user — matches "add it to a library" as requested, but worth confirming
  before wider rollout.
