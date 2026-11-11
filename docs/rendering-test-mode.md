# Furniture Renderer test jobs — API 1.4

Implemented locally; deploy before the frontend sends testMode. Separate staging
is paused. This uses the existing app, service, database, auth, catalog grants and
worker. A test job queues proofs immediately and incurs normal generation charges.
There is no automatic generation on container configuration or migration.

## Contract

Base `/api/rendering/v1`. Existing server-held bearer token and authenticated
`X-Rendering-Shop` are required. Never expose the service credential in browsers.
Existing Idempotency-Key requirements apply. Existing request fields remain;
add optional boolean `testMode` to POST `/uploads` and POST `/jobs`. Omission and
false mean production. Do not send account, container, blob keys or URL fields.

Example upload request after folder confirmation:

```json
{
  "testMode": true,
  "relativePath": "batch/fabric/reference.png",
  "role": "fabric",
  "contentType": "image/png",
  "size": 12345,
  "sha256": "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa"
}
```

Illustrative response (checksum/IDs are placeholders):

```json
{
  "uploadId": "11111111-1111-4111-8111-111111111111",
  "testMode": true,
  "storageDestination": "test",
  "upload": {
    "url": "https://ACCOUNT.blob.core.windows.net/renderes-test/rendering/SHOP/staging/ID?REDACTED",
    "method": "PUT",
    "headers": {"Content-Type": "image/png", "x-ms-blob-type": "BlockBlob"},
    "expiresAt": "2026-11-10T20:15:00.000Z"
  }
}
```

PUT raw original bytes using those headers, then POST `/uploads/{uploadId}/verify`
with `{}`. Verification checks the original size/SHA256 before normalization.
Verification and GET `/uploads/{uploadId}/download` expose testMode and
storageDestination and use the saved asset destination, not a new client flag.
Changing mode requires new uploads; it is not an update operation.

POST `/jobs`: use the existing complete furniture/fabrics/combinations manifest
from rendering-cylindo-sources.md, with top-level `"testMode": true`. Every uploaded
furniture angle, comparison, and fabric must be a verified upload for the same shop
and mode. The first-proof selection and approval workflow are unchanged.

```json
{
  "id": "22222222-2222-4222-8222-222222222222",
  "status": "queued",
  "testMode": true,
  "storageDestination": "test",
  "publication": {"allowed": false, "reason": "test_job"}
}
```

GET `/jobs` and GET `/jobs/{jobId}` expose these mode/destination/publication fields.
Output records and GET `/jobs/{jobId}/outputs/{outputId}/download` expose testMode,
storageDestination and eligibleForPublishing. Test outputs are always ineligible,
even after approval. Production job publication.allowed is true only when the job
is completed; individual output eligibility still follows revision approval.
Production queued/noncompleted job publication.reason is approval_required.
No new mode filter was added: the existing list includes both modes, so the
frontend must display an explicit Test job label.

Adjustments, approvals, retries, archive/restore and cancellation keep their
existing payloads; adding testMode to these strict schemas is rejected. They do
not alter persisted mode. Upload/job creation idempotency includes mode; same
key plus a changed mode returns 409 idempotency_conflict. Omission and false replay
identically, including legacy production requests/responses.

## Saved Cylindo sources

The resolver and preview contract is unchanged. It requires existing shop grants,
checks immutable versions and resolves into the existing production source catalog.
Resolver previews therefore can use production read-only URLs. At test-job creation,
the backend revalidates grants, source version and original bytes, then copies the
pinned PNG into renderes-test and checks its checksum before copying. Job assets
store the test location and pinned checksum. The worker verifies the checksum and
reads the test copy, including when the production source later changes. Fabric
references remain separate. Production source records/blobs are never rewritten.
No production write credentials are exposed to the frontend.

## Storage and publishing boundary

New uploads, pinned resolver assets, jobs and outputs persist storageLocation with
account and container; their existing objectKey/stagingKey identifies the blob.
They store no SAS URLs. Read operations compare recorded destinations to configured
ones and reject mismatches. Legacy assets without location resolve to existing
production configuration; do not rename that destination. New test assets require
a recorded test location and never fall back to production storage.

The same Azure account/key is used with a separate private container. This is
application-level job isolation, not separate infrastructure or credentials.
Frontend URL validation must permit only the configured HTTPS account origin and
appropriate container path. Uploads/test outputs use renderes-test; resolver previews
may use the existing production source container. Never infer mode from a filename.

No rendering-output publishing endpoint is implemented in this repository.
`Service.publishingOutput(shop, jobId, outputId)` is the required accessor for any
future publisher: it loads the owned job/output, rejects test provenance with 403
and enforces current approval. Never publish from a browser-supplied URL, SKU or
eligibleForPublishing flag. External product-image APIs must adopt that boundary
before enabling publication; this backend cannot police arbitrary independent
external uploads. A downloaded test file can be manually copied outside this API.

## Errors

Existing auth, ownership, checksum, source-version and catalog errors remain.

| HTTP | Code | Meaning |
| --- | --- | --- |
| 422 | upload_mode_mismatch | Upload/asset mode differs from job mode. Create new uploads in the correct mode. |
| 503 | test_storage_unavailable | Test container is missing/misconfigured, public, inaccessible, or test metadata is missing. No production fallback. |
| 503 | storage_destination_mismatch | Persisted account/container differs from the configured destination. |
| 409 | idempotency_conflict | Same operation key reused with changed mode or payload. |
| 403 | test_job_not_publishable | Server-side publishing guard rejected test provenance. |

## Migration and deployment

1. Keep separate staging files/deployments paused. Commit/push through the normal
   production workflow; reconcile server-local changes before pulling.
2. Confirm local and production `RENDERING_AZURE_TEST_CONTAINER=renderes-test` and
   the separate private container already created. Preserve production Azure vars.
3. Confirm DATABASE_URL_PROD is the intended existing production rendering DB.
   With NODE_ENV=production the runner selects that variable. Run:

   ```bash
   NODE_ENV=production npm run migrate:rendering
   ```

   Runner now includes 008-rendering-test-mode.sql after 001/002/005. No new job
   tables or backfill. Migration installs repeatable triggers preventing mode and
   existing location changes on job/upload JSON documents. No historical data,
   snapshots, files or job states are rewritten.
4. Verify/configure the private test container and the existing frontend's CORS:

   ```bash
   NODE_ENV=production npm run configure:rendering-storage -- --test
   ```

   Uses the existing frontend origin https://renderer-app-eu9fw.ondigitalocean.app.
   CORS is account-wide; same-origin rule is reused and unrelated rules retained.
   Do not change production container access levels. This command makes Azure
   configuration changes but creates no jobs or generation requests.
5. Reload the existing Express service through its normal deployment process after
   the environment and migration are applied. Worker configuration remains as-is.
   A restart can process already-queued work; coordinate with existing jobs. Do not
   enable/disable the worker or create jobs as a deployment smoke test.
6. Verify authenticated GET jobs/detail and private container configuration. Frontend
   can validate upload/verify round trips using test mode, without POST jobs. A job
   creation is NOT a free smoke test: it immediately queues paid work if worker enabled.

OpenAPI: docs/rendering-openapi.json, generated via npm run docs:rendering.
Tests: npm run test:rendering uses mock Azure, embedded PostgreSQL and fake providers.
Includes mixed-mode rejection, immutable provenance, idempotency, source copies,
adjustment/approval outputs, retries, downloads and publishing guard checks.
No production migration, cloud writes, existing-job mutation or paid generation
was performed during implementation.
