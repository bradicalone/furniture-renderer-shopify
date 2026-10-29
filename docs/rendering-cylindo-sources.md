# Saved Cylindo furniture sources — API v1.3

Implemented contract; deploy the backend and provision catalog grants before enabling
CSV submission. Base: `/api/rendering/v1`. Publishing through the product-image API
by **target variant SKU** is separate work; these endpoints do not publish media.

## Authentication and access

Every endpoint uses `Authorization: Bearer <server-held RENDERING_API_TOKEN>` and
`X-Rendering-Shop: <shop derived from authenticated Shopify session>`. Never send
the service credential to a browser or trust a browser-supplied shop/creator.
POST resolver and POST jobs require `Idempotency-Key` (1–128 letters, numbers,
`.`/`_`/`:`/`-`). JSON bodies use `Content-Type: application/json`.

`RENDERING_ALLOWED_SHOPS` authorizes service use, **not catalog ownership**.
An operator must explicitly provision each allowed source and target variant in
`rendering_source_catalog`, scoped to the calling shop. This is needed because the
existing `cylindo_images` catalog has no shop column. Its sync currently imports
from `mcgee-co.myshopify.com`; access from another shop requires an explicit,
reviewed grant. Storefront `/api/cylindo-images/:sku` read access grants no rendering
permission. Historical `role: comparison` values are not changed.

The app server derives creator identity and verifies employee permissions, reviews
CSV product/variant matching and fabric-folder mappings, and forwards the confirmed
manifest. The backend independently checks source/target metadata against catalog
grants. It cannot infer a fabric's physical color from a folder name or image: the
app's confirmed `fabricId` → `target.colorCode` assignment is the semantic mapping.

## 1. Resolve selected saved angles

`POST /sources/cylindo/resolve` → **200**

```json
{ "sourceVariantSku": "MFRN1234-ALA-K", "frames": [17, 1, 5] }
```

Full SKU only (letters, digits, hyphen, underscore; max 200). Frames are unique
integers 1–32, max 32 per request. Requested order is preserved among returned
sources and among missing frames. A missing row is a missing frame; a database
failure, unavailable blob or checksum mismatch is an error, never a missing frame.
An authorized SKU with no saved frames returns `sources: []` and all requested
frames in `missingFrames`; missing angles can be uploaded normally.

Sanitized illustrative response (IDs/checksums are placeholders):

```json
{
  "sourceVariantSku": "MFRN1234-ALA-K",
  "sources": [
    {
      "sourceId": "11111111-1111-4111-8111-111111111111",
      "sourceVersion": "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
      "sourceVariantSku": "MFRN1234-ALA-K",
      "frame": 17,
      "relativePath": "cylindo/MFRN1234-ALA-K/frame-17.png",
      "sha256": "bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb",
      "normalizedSha256": "cccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccc",
      "width": 1200,
      "height": 1504,
      "contentType": "image/png",
      "productCode": "MFRN1234-K",
      "colorCode": "ALA"
    },
    {
      "sourceId": "22222222-2222-4222-8222-222222222222",
      "sourceVersion": "dddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddd",
      "sourceVariantSku": "MFRN1234-ALA-K",
      "frame": 1,
      "relativePath": "cylindo/MFRN1234-ALA-K/frame-1.png",
      "sha256": "eeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee",
      "normalizedSha256": "ffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff",
      "width": 1200,
      "height": 1504,
      "contentType": "image/png",
      "productCode": "MFRN1234-K",
      "colorCode": "ALA"
    }
  ],
  "missingFrames": [5]
}
```

`sha256` hashes original saved bytes; `normalizedSha256` hashes the immutable PNG
used for rendering. `sourceVersion` hashes the original checksum and canonical
frame/catalog metadata. Unchanged re-sync timestamps and historical role labels
are not version changes. Changed pixels or mappings produce a different version.
Resolver downloads directly from private Azure, enforces the existing 20 MiB /
40-million-pixel / single-frame limits, normalizes without adding geometry, and
pins a non-overwritable PNG. No rendering tasks are created by resolution.

Same resolver key/body replays the original response (access is rechecked).
Use a **new** resolver key after a catalog update to review a fresh version.
An unchanged source resolved with a new key retains the same source ID/version.

`GET /sources/{sourceId}/download` → **200**

```json
{
  "sourceId": "11111111-1111-4111-8111-111111111111",
  "url": "https://storage.example.invalid/private/frame.png?REDACTED_SAS",
  "expiresAt": "2026-10-27T19:15:00.000Z",
  "contentType": "image/png"
}
```

URL is a fresh, 15-minute, read-only HTTPS SAS for the pinned PNG. Request a new
URL when needed; persist IDs/versions, never URLs. Preview returns the resolved
snapshot, which may be historical; creation still checks the current catalog.

## 2. Upload missing angles and fabrics

Existing upload flow is unchanged: POST `/uploads` after folder confirmation,
PUT raw bytes to returned SAS using exactly its `Content-Type` and
`x-ms-blob-type: BlockBlob` headers, POST `/uploads/{uploadId}/verify`.
Use role `furniture` for missing angles, `fabric` for fabric references. `.jpg`
and `.jpeg` both declare `image/jpeg`. Do not re-upload saved frames or put them
in `comparisons`. Comparisons are optional, review-only, and not required.

## 3. Create the mixed-source job

`POST /jobs` → **201**. Example using the resolved frame 17 above and an uploaded
missing frame 5 (frame 1 could also be selected with its returned reference):

```json
{
  "name": "CSV furniture batch",
  "createdBy": { "shopifyUserId": "42", "displayName": "Example Employee" },
  "jobInstructions": "Keep fabric color accurate.",
  "furniture": [{
    "id": "bed-king",
    "name": "King bed",
    "folder": "batch/bed-king",
    "sourceVariantSku": "MFRN1234-ALA-K",
    "sources": [
      {
        "sourceId": "11111111-1111-4111-8111-111111111111",
        "sourceVersion": "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
        "frame": 17,
        "relativePath": "cylindo/MFRN1234-ALA-K/frame-17.png"
      },
      {
        "uploadId": "33333333-3333-4333-8333-333333333333",
        "relativePath": "batch/bed-king/frame-5.jpg",
        "frame": 5
      }
    ],
    "firstProofSourceId": "11111111-1111-4111-8111-111111111111",
    "comparisons": [],
    "furnitureInstructions": "",
    "options": { "background": "white", "addContactShadow": true, "addBedding": false }
  }],
  "fabrics": [{
    "id": "green",
    "name": "Green fabric",
    "folder": "batch/fabrics/green",
    "references": [{
      "uploadId": "44444444-4444-4444-8444-444444444444",
      "relativePath": "batch/fabrics/green/reference.jpg"
    }]
  }],
  "combinations": [{
    "furnitureId": "bed-king",
    "fabricId": "green",
    "target": {
      "variantSku": "MFRN1234-GRN-K",
      "productId": "gid://shopify/Product/123",
      "variantId": "gid://shopify/ProductVariant/789",
      "colorCode": "GRN"
    }
  }]
}
```

```json
{ "id": "55555555-5555-4555-8555-555555555555", "status": "queued" }
```

- Send **only** the four documented saved-source reference fields; do not send
  preview URLs or copy the entire resolver response into the manifest.
- `sourceVariantSku` is required for saved-source furniture and may also be used
  when all requested frames are missing and all selected angles are uploads.
- All sources on catalog-backed furniture need unique frame numbers. The `sources`
  array is the authoritative display/output order, preserved in job detail;
  asynchronous worker completion order is not an angle ordering mechanism.
- `firstProofSourceId` must equal a selected `sourceId` or `uploadId`. It need not
  be the first array element. Use output `sourceId` to recover frame/order.
- Saved SKU/frame/path/version must exactly match the resolved record owned by the
  shop. Catalog metadata and original Azure bytes are rechecked before acceptance.
  Missing/changed sources fail the whole creation transaction; no jobs/tasks persist.
- Each catalog-backed combination requires `target`. Exact target SKU, Shopify
  GIDs and color must match its explicit grant. Source and target must have the
  same Cylindo `productCode` (including size/geometry). A target SKU can occur once
  per job, and a `fabricId` must map consistently to one color code.
- Source SKU's IDs describe the source variant; target IDs describe the output
  variant. Optional existing furniture `productId`, if sent, identifies the source
  product and must match its grant. Target metadata belongs on each combination,
  allowing multiple fabrics/target variants on the same source geometry.
- Upload-only folder jobs without `sourceVariantSku`/`target` remain unchanged.
- Same creation key/body returns the original job even after a later catalog
  change. It never changes the original sources, target mapping or creator.
  Changed body with the same key returns `409 idempotency_conflict`.

Creation queues **one proof per furniture/fabric combination immediately**. If the
worker is enabled, it starts processing without a separate start call. Remaining
angles are enqueued only after the existing approval endpoint succeeds. Resolution,
preview and status requests do not trigger rendering. Tests use fake providers.

## 4. Poll, adjust and approve

Existing endpoints and response envelopes are unchanged:

- GET `/jobs/{jobId}`: complete manifest with ordered source references,
  `sourceVariantSku`, `combinations[].target`, tasks and revision outputs.
- GET `/jobs`: existing summaries; obtain the manifest/mappings from detail.
- POST `/jobs/{jobId}/combinations/{combinationId}/adjustments`:
  `{ "revision": 1, "instructions": "Slightly warmer fabric" }` → 202.
- POST `/jobs/{jobId}/combinations/{combinationId}/approve`:
  `{ "revision": 1 }` → 200; enqueues only remaining sources.
- GET `/jobs/{jobId}/outputs/{outputId}/download`: fresh authorized output URL.

New jobs and explicit adjustment revisions use `furniture-preservation-v4`.
Historical snapshots remain untouched. Input 1 is the sole authority for furniture
geometry and camera/viewpoint/left-right orientation whether it is a saved frame
or an uploaded photograph. Fabric contact sheets and prior/approved proofs guide
appearance only. Structured bedding exception and protected preservation rules
remain. Output is white/transparent product imagery, never a room scene.

Worker reads the pinned private Azure PNG directly and verifies its checksum
before a provider request. Later Cylindo sync does not change an accepted job's
pixels. Source-role authorization is separate from the historical asset label.

## Errors

All errors: `{ "error": { "code": "...", "message": "safe actionable text" } }`.
No credentials, storage keys, signed URLs or provider data appear in errors.

| HTTP | Code | Action |
| --- | --- | --- |
| 400 | `invalid_request` | Correct types/fields, full SKU, unique frames 1–32. |
| 400 | `idempotency_required` | Supply the documented key. |
| 400 | `invalid_proof_source` / `duplicate_source` | Select a member source and remove duplicate IDs/paths. |
| 400 | `invalid_combination` / `duplicate_combination` | Correct furniture/fabric references. |
| 401 | `unauthorized` | Check server-held bearer token. |
| 403 | `shop_forbidden` | Check authenticated shop allowlist. |
| 403 | `source_forbidden` | Have an operator review source/target catalog grants; no fallback shop. |
| 404 | `source_not_found` | Resolve in the current shop; IDs cannot cross shops. |
| 409 | `source_version_changed` | Finish sync, re-resolve with a new key, review frame, then submit a fresh creation request. |
| 409 | `idempotency_conflict` | Reuse the original body or use a new key for a new operation. |
| 413 | `job_too_large` | Split the batch; existing task budget applies. |
| 422 | `invalid_source_mapping` | Correct source SKU/frame/path or optional source product ID. |
| 422 | `invalid_frame_mapping` | Provide unique frames for every catalog furniture source. |
| 422 | `invalid_target_mapping` | Correct target IDs/color/geometry and fabric mapping. |
| 422 | `source_integrity_failed` | Pinned source is corrupt; contact the service administrator before submitting. |
| 422 | `invalid_source_image` | Repair the saved image; existing decoder safety limits apply. |
| 422 | `unverified_upload` | Verify upload ownership, role and exact relative path. |
| 503 | `source_lookup_failed` | Catalog lookup unavailable; do not treat as missing angles. |
| 503 | `source_unavailable` | Catalog row exists but storage read failed; do not substitute an angle. |
| 503 | `service_unavailable` | Database/integration unavailable; retry after recovery. |

A worker-side pinned checksum mismatch marks the task failed with
`source_integrity_failed`, does not auto-retry and does not call the provider.
Existing worker/provider failure and retry handling otherwise remains unchanged.

## Migration, catalog grants and deployment

1. Review/commit/push the local changes through the normal workflow. On the server,
   inspect `git status` and reconcile any local edits before pulling; don't discard
   production changes. Install the committed dependencies normally.
2. Confirm the intended database target. `NODE_ENV=production` selects
   `DATABASE_URL_PROD`; otherwise the runner selects `DATABASE_URL`. Do not print
   secrets. Run `NODE_ENV=production npm run migrate:rendering` on the intended
   production host. Runner includes **005-rendering-cylindo-sources.sql** after 001
   and 002. It creates only `rendering_source_catalog` and `rendering_sources`,
   with no backfill, role update, existing-job mutation or file deletion.
   Existing `cylindo_images` must already be installed by the Cylindo migration.
3. Prepare an operator-reviewed JSON array of explicit grants for **both source and
   target SKUs**. Get canonical productCode/color/IDs from the trusted catalog and
   Shopify product lookup; never derive access from public previews or browser
   claims. A target need not have saved frames; its reviewed grant supplies the
   authoritative mapping. Example (fictional):

   ```json
   [
     { "shop": "example.myshopify.com", "variantSku": "MFRN1234-ALA-K", "productCode": "MFRN1234-K", "productId": "gid://shopify/Product/123", "variantId": "gid://shopify/ProductVariant/456", "colorCode": "ALA" },
     { "shop": "example.myshopify.com", "variantSku": "MFRN1234-GRN-K", "productCode": "MFRN1234-K", "productId": "gid://shopify/Product/123", "variantId": "gid://shopify/ProductVariant/789", "colorCode": "GRN" }
   ]
   ```

   Run `NODE_ENV=production node scripts/grant-rendering-sources.js /secure/path/reviewed-catalog.json`.
   Script checks the service shop allowlist, uses the same DB selection as the
   migration runner, and applies all entries transactionally. Repeat identical
   grants safely; differing or disabled existing grants cause failure rather than
   an implicit authorization change. To revoke future resolution/creation/preview,
   an operator can explicitly set the relevant grant's `enabled` to false.
   Existing accepted jobs retain their immutable inputs and normal workflow.
4. Restart/reload the existing Express process with its existing environment after
   migration. No new environment variables, Azure secrets or CORS rules are needed.
   To verify without processing paid queued work, keep the worker disabled during
   the smoke test; do not enable it as part of verification.
5. With server-held authentication, resolve a known permitted SKU, preview it and
   check a missing frame result. Verify another ungranted shop gets 403. These
   calls may write immutable source copies/idempotency records, but create no jobs.
   Do **not** POST jobs/approve/adjust/retry during production verification.
6. Hand the app this document and `rendering-openapi.json`, then enable its CSV
   submission only after reviewed grants and smoke checks are complete.

Local checks: `npm run test:rendering`, `npm run test:cylindo`,
`npm run docs:rendering`. The tests use embedded PostgreSQL, mock Azure and fake
providers. Production migrations, catalog grants, deployment and generation are
not performed by the test suite.
