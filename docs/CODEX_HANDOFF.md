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
