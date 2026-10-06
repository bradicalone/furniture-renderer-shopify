# DigitalOcean deployment preparation

`.do/app.yaml.example` mirrors the existing app's App Platform Docker/GitHub
hosting pattern, using a separate app and the Furniture Renderer repository.
It is a draft, not a ready-to-deploy specification. No cloud resources have been
created and no Shopify URLs have been changed.

## Required before deployment

1. Use the existing `mcgee-db` PostgreSQL cluster in SFO3 with the dedicated
   `furniture_renderer` database and `furniture_renderer_app` user. The app spec
   uses SFO and requires an encrypted runtime DATABASE_URL.
2. Docker now generates Prisma from `prisma/postgresql/schema.prisma` and applies
   that schema's separate PostgreSQL migrations at startup. Local development
   continues to use `prisma/schema.prisma` and SQLite unchanged. Keep the Session
   model synchronized in both schemas when adding fields. This creates fresh
   production session tables; it does not transfer local sessions. Employees
   authenticate again. Do not run these migrations against another app's database.
3. Authorize DigitalOcean's GitHub integration for
   `bradicalone/furniture-renderer-shopify` and push the intended deployment commit.
4. Enter Furniture Renderer's own client ID and secret in DigitalOcean. Set the
   secret and rendering service token as encrypted runtime variables; never commit
   a filled-in spec. Replace the backend URL with the actual service URL, or omit
   both backend variables while reviewing the unconnected UI.
5. Use the new app's assigned HTTPS URL for its Shopify application URL and auth
   callback URLs. Do not reuse the discount app's domain, credentials or scopes.
   The runtime SHOPIFY_APP_URL uses DigitalOcean's APP_URL binding.
6. Deploy the web app, verify session persistence across a redeployment, and then
   release the corresponding Shopify configuration. Shopify deployment does not
   deploy the web server. Review removal of the old Admin link extension at release.

The draft starts with one replica; scale after shared session storage is working.
The existing production app is unaffected. Do not copy its two-replica setting
while this project still uses local SQLite.

## Local build preparation

The Dockerfile installs build dependencies before building and prunes development
packages afterward. Prisma client generation is explicit. `.dockerignore` excludes
local secrets, Git metadata and session databases from the image context.

A Docker engine is required to validate the actual container build:

```sh
docker build -t furniture-renderer-shopify .
```

References:
- https://docs.digitalocean.com/products/app-platform/reference/app-spec/
- https://docs.digitalocean.com/products/app-platform/how-to/use-environment-variables/
- https://docs.digitalocean.com/products/app-platform/how-to/manage-databases/

## Database permissions and connection

Using psql or a PostgreSQL GUI, connect as `doadmin` specifically to the
`furniture_renderer` database (not `defaultdb`), then execute:

```sql
GRANT CONNECT ON DATABASE furniture_renderer TO furniture_renderer_app;
GRANT USAGE, CREATE ON SCHEMA public TO furniture_renderer_app;
```

Prisma migrations run as the app user, which owns the tables it creates.
Use the direct connection on port 25060 for migrations, not a transaction pool.
In DigitalOcean's connection panel select the app user and database and copy the
connection string privately into the service's encrypted runtime DATABASE_URL.
Retain SSL settings (`sslmode=require` at minimum). Percent-encode special
characters in credentials if assembling the URL manually.
Allow the App Platform app as a trusted source under database Network Access.
If running grants from your computer, allow that computer's IP temporarily.
Do not paste passwords into chat or commit a completed spec.

Schema validation and migration SQL generation were verified locally without a
remote connection. Live grants, migrations and Docker startup are not yet tested.
