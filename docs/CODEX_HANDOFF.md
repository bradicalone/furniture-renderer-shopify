# Codex handoff

## Architecture

Employees enter through Apps → Furniture Renderer. This is a bulk-first embedded
Shopify app, not the rendering backend. Keep the working Shopify authentication,
session storage, and app configuration intact.

The existing Node.js service owns signed uploads, storage, durable database job
state, queues, OpenAI calls and generated files. The Shopify app owns folder
review, product matching, employee approvals and publishing. Never expose backend
or OpenAI credentials to browser code. Do not create another backend server.

## Implemented

- `/app`: bulk jobs entry point with an explicit unconnected activity state
- `/app/render`: parent-folder drag/drop and `webkitdirectory` fallback
- Local parsing of `root/furniture/<item>/...` and `root/fabrics/<fabric>/...`
- Original relative paths and browser File objects preserved in memory
- System-file filtering, unsupported/empty/duplicate file rejection
- Detected structure review before any upload, per-item fabric selection,
  background/shadow settings and per-bed bedding options
- Explicit local confirmation; edits or new folders invalidate confirmation
- Single-product Admin link extension removed from local source
- Existing server-only rendering adapter preserved for future integration

No upload or render requests are made by the current UI. Confirmation does not
create a durable job. Local drafts disappear on navigation/reload. The activity
screen does not yet fetch job history. Product matching is not yet implemented.
Previously deployed Admin links require a subsequent Shopify deployment to remove.

## Files and models for the next milestones

- `app/lib/bulk-folders.ts`: SourceFile (File + relativePath), FolderGroup,
  FolderManifest (furniture, fabrics, ignored, rejected, errors).
- `app/routes/app.render.tsx`: draft fabric assignments and output options;
  add authenticated product suggestions and explicit employee match confirmation.
- `app/services/rendering-api.server.ts`: existing single-combination adapter;
  extend only after agreeing the bulk contract with the existing backend.
- `app/routes/app._index.tsx`: fetch paginated job summaries and show real
  progress, failures, completion timestamps and links to job detail routes.
- Add job detail routes for per-combination proof revisions, written adjustments,
  approvals, remaining-angle rendering, download and publishing.

Backend-owned durable models to agree:

- BulkJob: id, shop, timestamps, state, counts/progress, failures, furniture items.
- FurnitureItem: id, source folder, ordered uploaded angle IDs, product candidate,
  confirmed product ID and confirmation metadata, per-item bedding option.
- Fabric: id, source folder, uploaded reference IDs.
- Combination: furniture ID + fabric ID, output options, proof revision/state,
  adjustment history, approval tied to the current revision, remaining angles.
- Output: combination/angle/revision IDs, storage identifier, downloadable URL,
  render status/error and Shopify publication result for retry-safe publishing.

Do not use browser File objects as API payloads. Upload first through signed URLs,
then submit verified storage IDs and relative paths. Enforce shop ownership on
all job operations. A confirmed product match and approved output revision must
be checked server-side before publication. Approval must trigger only that
combination's remaining angles. Durable progress and retry handling belong to the
existing backend, not this app's session database.

## Next work

1. Agree signed-upload and bulk job contracts with the existing Node.js server.
2. Add Shopify title-similarity suggestions with manual correction and confirmation.
3. Upload only after folder confirmation and an explicit submit action.
4. Create/poll bulk jobs; review one proof per selected combination.
5. Implement adjustments, revision-specific approval and remaining-angle rendering.
6. Publish approved outputs to confirmed products or download outputs.

Preserve furniture geometry/camera angles across fabric variants. Do not commit
furniture, fabric, swatch or comparison assets. The Cylindo reference is optional.

## Validation

On Node 24: `node --test tests/bulk-folders.test.mjs`.
Also run `npm run typecheck`, `npm run lint`, and `npm run build`.
Browser checks: choose/drop the example hierarchy, verify all relative paths,
reject unsupported files, confirm fabric assignments, then replace the folder and
verify confirmation resets. Verify no upload/render requests occur during review.

## Rendering features retained during bulk conversion

The bulk draft has batch instructions, per-furniture instructions and per-combination
proof-adjustment drafts. The protected default lives only in
`app/services/render-instructions.server.ts`; never return it from loaders or
import it into browser code. The server adapter composes these four levels in
order. The existing Express worker must adopt the contract and enforce its own
canonical policy for every render, including adjustments and remaining angles.

Background, contact shadows and optional per-bed mattress/white bedding remain.
Cylindo comparison images can be selected locally per furniture item; signed
uploads remain pending. Proof/re-render/approval, output preview, download and
Shopify publishing controls remain visible in confirmed drafts, with unavailable
actions disabled pending integration. These are retained workflow requirements,
not claims of working backend features. No selected file uploads automatically.

## Azure storage configuration (confirmed by project owner)

- Account: `uploads`
- Container: `renderes` (exact spelling; do not rename to `renders`)
- Access: private
- CORS origin: `https://renderer-app-eu9fw.ondigitalocean.app`

Storage configuration was reported as verified; it has not been independently
checked from this repository. Azure credentials remain on the existing Express
backend. The Shopify browser receives only scoped, expiring upload/read URLs.

The current Shopify UI still confirms files locally only. There is no connected
upload request, verification request, bulk job submission or status polling.
The existing createRenderJob adapter is not invoked by the bulk screen. A working
storage setup alone does not make the proposed browser smoke test executable.

Before wiring the app, obtain the deployed backend contract: signed-upload request
and response (including required PUT headers), upload verification, bulk-job
creation, job status/proof responses, adjustment and approval endpoints, auth and
shop-scoping requirements, errors and URL expiration behavior. Obtain sanitized
examples or an OpenAPI document, not credentials or signed URLs. Confirm whether
creating a job starts the worker automatically, and provide a storage-only test
path that does not enqueue image generation.

## Integration update — 2026-10-08 (supersedes earlier pending-upload notes)

Implemented the provided Express v1 contract in the Shopify app. See
`backend-api-contract.md` and the checked-in `rendering-openapi.json` for current
configuration, wire schemas and test instructions. The server adapter now uses
`/api/rendering/v1`, authenticated shop headers and idempotency keys; the earlier
single-combination payload and prompt-override payload must not be used.

Uploads/verification, explicit bulk creation, first-proof source selection, live
job listing, detail polling, proof/comparison previews, adjustment/re-render,
revision approval, failed-task retry, cancellation and individual output links
are wired. Product matching and Shopify publishing are still pending. Backend
production deployment and live browser behavior have not been verified here.
No upload or paid generation was triggered while implementing this integration.

### Universal furniture preservation default (2026-10-15)

The app's reference prompt now uses `furniture-preservation-v3`. This is not the
live rendering prompt; Express must implement the corresponding protected rule
in its policy composer before production rendering changes.

For all furniture types, preserve source shape, proportions, existing cushions,
seams and visible structural details. Do not invent absent arms, legs, cushions,
decorative pillows, throws or bedding. Preserve existing features; do not remove
them under the no-additions rule. Keep the exact source viewpoint and orientation.
Only the structured `addBedding` option may authorize adding a mattress, white
sheets and pillows, without changing furniture structure. When disabled, add no
bedding. Employee instructions cannot override these protected requirements.

Backend handoff: update the canonical policy, increment its version, and test
the bedding exception and conflicting supplemental instructions. New jobs and
explicit new adjustment revisions should receive the new policy. Do not rewrite
historical snapshots or trigger generation. No sofa-specific checkbox or API
schema change is needed. Deploy/restart Express separately; deploying this
Shopify app alone does not activate the new rendering policy.

### CSV saved-angle review (2026-10-27)

Implemented a separate review mode on New rendering job; original folder upload
and proof-first submission remain unchanged. CSV parsing is local (1 MiB / 250
rows), requires Product Name, Target Variant SKU, Color Code and Fabric Folder,
and rejects duplicate SKUs and ambiguous CSV. Optional Source Product Code,
Furniture Folder and Rendering Instructions are retained for review.

Authenticated `/app/api/rendering-sources` resolves an exact, unambiguous SKU
against the current shop using Admin GraphQL, then reads the existing
`/api/cylindo-images/:sku` endpoint on the configured rendering API origin. It
never forwards service tokens to that separate route. The current backend code
exposes that lookup without rendering-service authentication; confirm this
contract and cross-shop asset permissions before wider rollout. Production
connectivity has not been tested. Preview URLs are allowlisted to the existing
Azure account/container, are not persisted, and can be refreshed explicitly.

Employees choose their fabrics directory, review Shopify options against the
explicit color code, select frames 1–32 (defaults 1,3,5,9,17), and supply local
missing/replacement files. Nothing uploads during review. Errors are not treated
as missing frames; only a real 404 produces an empty saved-angle list.
Confirmation is local only. CSV job submission is intentionally unavailable.

Required Express work before submission can be enabled:
- Add an authenticated, shop-scoped saved-source resolver/import contract, using
  stable SKU/frame identifiers plus immutable version/checksum provenance.
- Explicitly permit selected Cylindo assets to act as furniture sources; they
  currently have comparison role. Resolve private blobs server-side, not via
  stored expiring SAS URLs or browser-provided blob paths.
- Support mixing those sources with verified uploaded missing angles and
  preserve explicit frame/order metadata and selected first-proof source.
- Persist per-combination target variant SKU, Shopify IDs, color code and fabric
  mapping. Validate matches server-side and reject changed assets or mappings
  rather than silently substituting. Keep current proof-first behavior.
- Define whether fallback to a different source SKU is supported. Current UI
  only queries the full target SKU; Source Product Code is not used to guess it.
- Return updated OpenAPI schema, permission rules and idempotency behavior.
- No Shopify media publishing: future publication is to the product-image API.

After that contract is deployed, connect confirmation to signed uploads and job
creation, carrying verified mappings through the server. Do not route CSV drafts
through the old manifest builder: it would discard target and frame metadata.

### API v1.3 frontend connection (2026-10-28)

Supersedes the review-only/source-contract blockers above. Attached contract is
saved as `rendering-cylindo-sources.md`; wire types regenerated from its OpenAPI.
CSV review now resolves via authenticated `POST /sources/cylindo/resolve` with
idempotency keys and obtains pinned previews via `/sources/:id/download`.
The public Cylindo endpoint is no longer used. Shopify lookup only confirms the
exact target SKU and its IDs/options in the authenticated shop. Optional CSV
`Source Variant SKU` defaults to the target SKU; product code is never used to
construct or guess a SKU. Backend grants independently validate target color,
source geometry and ownership.

Employees specify ordered frame numbers and a selected first-proof frame, review
fabric references and Shopify options, set bedding per row plus batch background,
shadows and instructions, and confirm all rows before local uploads. Submission
uses existing signed upload/verify endpoints for local missing/replacement angles
and fabrics only, then a mixed-source manifest. Saved refs contain exactly
sourceId, sourceVersion, frame and relativePath. Signed URLs exist only in preview
state. Each combination carries target variant SKU/GIDs/color/fabric mapping.
The existing proof-first behavior remains. Details display outputs by manifest
source order, not worker completion order. Resolver retry reuses a key; explicit
fresh resolution uses a new key. Confirmed submissions are locked and creation
retries reuse their key and body. A changed source version requires fresh review
and a new submission, never silently replacing a pinned selection.

DEPLOYMENT GATE: CSV creation is disabled by default on BOTH UI and app server.
Only after the operator confirms backend v1.3 deployment, migration 005, reviewed
shop-scoped source/target catalog grants, and resolver smoke checks, set the
Shopify app runtime `RENDERING_CSV_SUBMISSION_ENABLED=true` and redeploy. This is
an app-side rollout flag, not a new Express requirement. No such confirmation or
production verification has been performed here. Original upload-only jobs remain
available. Never bypass the gate using browser input.
