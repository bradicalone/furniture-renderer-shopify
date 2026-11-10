# Furniture Renderer staging setup

Status: repository preparation complete; cloud resources have NOT been provisioned.
Do not change production environment variables to staging values. Use the same
repository for separate deployments with separate runtime configuration.

## Resource plan

| Resource | Proposed name | Purpose |
|---|---|---|
| Shopify app | Furniture Renderer — Staging | Separate client ID and secret; install on test store only |
| DigitalOcean app | furniture-renderer-staging | Frontend/auth server, own generated HTTPS URL |
| Session database/user | furniture_renderer_staging / furniture_renderer_staging_app | Shopify Prisma sessions only |
| Express service | rendering-api-staging | Separate process, port, hostname and runtime environment |
| Rendering database/user | rendering_staging / rendering_staging_app | Jobs, source catalog and image metadata |
| Azure container | renderes-staging | Private test inputs, sources and generated files |
| OpenAI project/key | Furniture Renderer Staging | Separate spend tracking; generation remains paid |

The two databases may use the existing PostgreSQL cluster but must have separate
restricted users. Use a separate Azure storage account if the backend requires
account-wide keys; a new container with the production account key is not credential
isolation. Container-scoped credentials are acceptable if the backend supports them.

## 1. Server/Azure handoff

Give Codex in the Express project these instructions:

Create a separate staging deployment of the existing Express service, not a new
backend implementation. Inspect existing deployment tooling before changing it.
Use its own process/port/hostname, database and restricted database user, rendering
service token, Azure credentials/storage and OpenAI project/key. Never alter the
production process or environment. Review database grants to ensure the staging
user cannot read or mutate production data. Create no production-wide grants.

IMPORTANT: NODE_ENV must remain production for deployed code. The migration runner
selects DATABASE_URL_PROD when NODE_ENV=production, so BOTH the staging runtime and
migration command must explicitly resolve to the staging rendering database.
Verify the actual database/user before applying migrations, including migration 005
and the Cylindo tables required by the resolver. Do not reuse a production .env.

Set RENDERING_WORKER_ENABLED=false initially. Allow only the confirmed canonical
test shop in RENDERING_ALLOWED_SHOPS. Grant explicitly reviewed test-shop source
and target SKUs with that store's real Shopify IDs. Copy a small authorized sample
of Cylindo source images into staging storage and index those copies in staging.
Do not point staging jobs or catalogs at production blob paths. Use a separately
scoped source-copy process if production read access is needed; do not retain those
credentials in the staging service.

Ensure staging only permits its own frontend origin for storage CORS and can issue
signed upload/read URLs for its container. Keep sources private. Remove production
Shopify write tokens, sync credentials, publishing destinations and background
sync schedules from the staging process. Inventory all automatically started
workers in the shared Express code, not just the rendering worker. No production
publishing or sync calls are permitted from staging.

Return: staging API URL, storage account origin/container, migration verification,
canonical shop grants, credential delivery location, health check results and exact
start/restart commands. Deliver secrets through the approved secret channel, not
this document. Do not start generation as a smoke test.

## 2. Shopify and DigitalOcean

Create a separate Shopify app registration in the appropriate organization. Use
its credentials ONLY in the new DigitalOcean app. Install only on the selected test
store; verify its canonical myshopify.com domain rather than its Admin URL slug.

Create the DigitalOcean app from `.do/app.staging.yaml.example`. Replace every
placeholder first. It uses the existing Dockerfile, port 3000, one instance and
manual deployment (auto-deploy disabled). NODE_ENV is production; APP_ENV is staging.
Add a dedicated session database URL with SSL, add the new app as a trusted source,
and ensure its database user can run the Prisma migrations in that database only.
Docker startup runs the PostgreSQL session migration automatically.

Runtime settings:
- APP_ENV=staging
- STAGING_ALLOWED_SHOPS=<canonical test shop, or explicit comma-separated test shops>
- SHOPIFY_API_KEY / SHOPIFY_API_SECRET=<separate staging app credentials>
- SHOPIFY_APP_URL=<actual generated staging DigitalOcean URL>
- DATABASE_URL=<staging session database URL, encrypted>
- RENDERING_API_URL=<staging Express origin or full /api/rendering/v1 base>
- RENDERING_API_TOKEN=<dedicated staging service token, encrypted>
- RENDERING_STORAGE_ORIGIN=https://<staging-account>.blob.core.windows.net
- RENDERING_STORAGE_CONTAINER=renderes-staging
- RENDERING_CSV_SUBMISSION_ENABLED=false initially

The app exposes only the non-secret storage origin/container to the browser. Both
uploads and all preview/download links must match the exact configured destination.
Staging shows a persistent banner and blocks non-allowlisted shops at the app loader
and rendering resource routes. It rejects the known production app URL, client ID,
API host, session database name and storage destination. These are additional
mistake checks, not substitutes for infrastructure permissions or secret isolation.

Create a separate Shopify CLI configuration linked to the staging registration.
Do NOT modify shopify.app.furniture-renderer.toml or change its production client ID.
Use the staging URL and matching /auth/callback redirect in the staging config.
Release that configuration specifically to the staging app. Never run an unqualified
deploy that could use the current production default. Creating/releasing the app
configuration remains a separate explicit deployment step after IDs/URLs exist.

## 3. Verification and enabling

1. Verify staging DB connection targets, storage permissions and test-store access.
2. Open the staging app from the test store and confirm its STAGING banner.
3. Verify that production storage URLs and non-allowed shops are rejected.
4. Select a small folder; upload/verify only. Confirm blobs exist only in staging.
5. Resolve a reviewed source, preview its pinned frame and test a missing frame.
6. After deployment, migration 005 and grants are confirmed, enable CSV submission
   on staging. Keep production rollout settings unchanged.
7. Enable the staging worker only when ready for a paid one-proof test. Approve to
   test remaining angles. No publishing to live storefronts.

No production credentials, state, images, jobs or app configuration have been
changed as part of the repository preparation. Revoke only staging credentials
and delete only staging resources when retiring the environment.
