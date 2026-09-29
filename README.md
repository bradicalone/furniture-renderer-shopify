# Furniture Renderer — Shopify Admin app

An embedded Shopify app for creating product-ready furniture images from
furniture-angle photos and fabric references.

This repository is the **Shopify-facing application**, not the image-rendering
backend. It handles Shopify authentication, product context, employee workflow,
approval, and eventual product media publishing. Your existing Node.js service
will handle uploads, storage, rendering jobs, and OpenAI API calls.

## Current implementation

- Shopify React Router app based on Shopify's official template
- Embedded Admin home screen
- Bulk folder review and confirmation workspace at `/app/render`
- Parent-folder drag/drop and folder picker with relative-path grouping
- White or transparent background setting
- Contact-shadow and optional bedding settings
- Per-furniture fabric assignments and local draft confirmation
- App-level entry point: **Apps → Furniture Renderer → New rendering job**
- Server-only adapter for the existing rendering backend

No furniture or fabric test assets are committed.

## Local setup

Requirements:

- Node.js 22.12 or newer
- Shopify Partner/developer account
- A Shopify development store
- Shopify CLI authentication

```bash
npm install
cp .env.example .env
npm run dev
```

The first Shopify CLI run links this directory to an app in your Shopify
developer account and supplies the app configuration. The app currently asks
for `write_products` so approved images can later be attached to products.

## Existing backend connection

Set these server-side variables:

```dotenv
RENDERING_API_URL=https://your-existing-node-server.example.com
RENDERING_API_TOKEN=replace-with-a-server-only-secret
```

The browser must never receive `RENDERING_API_TOKEN`. See
[`docs/backend-api-contract.md`](docs/backend-api-contract.md) for the planned
request contract and upload flow.

## Repository boundaries

This repository owns:

- Shopify OAuth and sessions
- Embedded Shopify Admin UI
- Product matching and bulk folder review
- Proof review and employee approval
- Publishing approved outputs to Shopify

The existing Node.js rendering server owns:

- Signed uploads and object storage
- Database and durable job state
- Queues and background workers
- OpenAI Image API credentials and calls
- Image outputs and comparison artifacts

## Next implementation milestone

Agree the bulk job API with the existing backend, then connect product matching,
signed uploads, job history, proof review, approvals, publishing and downloads.
Folder confirmation currently stays local and does not upload or create jobs.
