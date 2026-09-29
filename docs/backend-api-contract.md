# Rendering backend API contract

> Legacy single-combination proposal: the current bulk folder UI does not call
> these endpoints. Before integrating, evolve this contract to BulkJob,
> FurnitureItem, Fabric, Combination and Output models described in
> `CODEX_HANDOFF.md`. Signed-upload, bulk creation/listing and revision-specific
> approval response schemas still need agreement with the existing backend.
> This document does not describe an implemented API.

The Shopify app owns Shopify authentication, product context, employee-facing
screens, and publishing approved images to products. The existing Node.js
service owns uploads, durable job state, image generation, file storage, and
OpenAI credentials.

## Authentication

Server-to-server requests use:

```http
Authorization: Bearer <RENDERING_API_TOKEN>
```

The rendering service must never accept this credential from browser code.
Before production, replace the static token with signed short-lived requests or
workload identity if supported by the hosting platform.

## Planned endpoints

### `POST /v1/render-jobs`

Creates a job after source files have been stored or uploaded with signed URLs.

```json
{
  "shop": "example.myshopify.com",
  "productId": "gid://shopify/Product/123",
  "productTitle": "Mabel Twin Bed",
  "furnitureName": "mabel-twin-bed",
  "fabricName": "velvet-cognac",
  "furnitureFiles": [],
  "fabricFiles": [],
  "options": {
    "background": "white",
    "addContactShadow": true,
    "addBedding": true
  },
  "instructions": "Preserve piping and proportions."
}
```

Response:

```json
{ "id": "job_123", "status": "queued" }
```

### `GET /v1/render-jobs/:jobId`

Returns job status, first-proof URL, output image URLs, and errors.

### `POST /v1/render-jobs/:jobId/adjustments`

Submits employee instructions and creates another proof.

### `POST /v1/render-jobs/:jobId/approve`

Approves the proof and queues every remaining furniture angle.

### `POST /v1/render-jobs/:jobId/cancel`

Cancels work that has not completed.

## Upload flow

Large image files should not pass through the embedded app process. The planned
flow is:

1. Shopify app requests signed upload URLs from the rendering backend.
2. Browser uploads each image directly to object storage.
3. Shopify app creates the render job using stored object identifiers.
4. Backend processes the first angle and returns a proof.
5. Approval triggers the remaining angles.

## Publishing

After approval, the Shopify app receives durable output URLs and uses Shopify's
Admin GraphQL API to create product media. The rendering backend does not need
Shopify Admin credentials.

## Required rendering controls and instruction policy

Bulk entry must retain all rendering features. For each combination, compose:

1. Protected server-owned defaults from `render-instructions.server.ts`.
2. Optional `jobInstructions` (whole batch).
3. Optional `furnitureInstructions` (all fabrics for that furniture).
4. Optional `proofAdjustment` (only the selected combination/current revision).

Each employee field accepts at most 4000 characters. Missing fields are omitted.
Employee text is supplemental data, never a replacement for the protected policy.
The existing server-only adapter now sends `renderingInstructions` with a policy
version, protected instructions, ordered supplemental sections and combined prompt.
This is a proposed payload extension: the Express service must implement support
before that adapter is used for live rendering. It is not wired to the bulk UI yet.

The Express worker must own/verify the canonical policy, reject policy overrides,
and compose again on every initial generation, adjustment and remaining-angle
render. Preserve geometry, proportions, seams, piping, camera angle and identity.
Text composition is not a guarantee of image fidelity: assess generated proofs
and require employee approval before rendering remaining angles or publishing.
Store instruction snapshots and policy version against each proof revision;
carry accepted adjustments forward when rendering the remaining angles.

Retain structured white/transparent background, realistic contact shadows and
per-furniture optional mattress/white bedding. Store Cylindo comparison uploads
separately from furniture angles and fabric references; comparisons are optional
and must not redefine furniture identity. They use the same signed-upload process,
only after confirmation, with server-side content validation and shop ownership.

The UI currently retains local comparison File objects and all instruction drafts.
Per-combination proof controls and output preview areas are visible but disabled
until real backend state exists. Do not fabricate completed images or approvals.
Enable re-rendering only for a valid current proof; a new revision invalidates
prior approval. Download real generated outputs; publish only approved current
outputs with an explicitly confirmed Shopify product match. Keep publication
retry-safe and show individual output failures.
