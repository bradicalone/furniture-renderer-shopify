# Rendering backend integration

The checked-in `rendering-openapi.json` is the implemented backend contract,
provided from `mcgee-api/docs/rendering-openapi.json` on 2026-10-08. It replaces
the earlier `/v1/render-jobs` proposal. Regenerate wire types with
`python3 scripts/rendering-types.py` after updating the contract snapshot.

## App configuration

Set these server-side runtime variables in DigitalOcean:

- `RENDERING_API_URL`: the actual HTTPS API origin, or full base ending in
  `/api/rendering/v1`. Do not include a job/upload route or query string.
- `RENDERING_API_TOKEN`: shared token, encrypted, never sent to the browser.

The Express deployment must enable `RENDERING_ENABLED=true`, run its rendering
migration, and allowlist the installed store in `RENDERING_ALLOWED_SHOPS`.
Confirm production deployment separately; this repository has not verified it.
The backend owns the canonical protected prompt and its instruction snapshots.
The Shopify app sends only job/furniture instructions and revision adjustments;
it does not send the old `renderingInstructions` property (the API rejects it).
The legacy server prompt composer remains as a reference, not the wire contract.

## Implemented Shopify flow

1. Parse the folder locally, choose fabrics, settings, comparisons and a first
   proof source per furniture item. Confirming does not upload.
2. Explicitly select **Upload and verify images only**. The browser hashes each
   file, calls the authenticated app gateway for a signed URL, PUTs the raw bytes
   to Azure, and calls verification through the gateway. Maximum 20 MiB per file.
3. After every upload is verified, explicitly acknowledge rendering charges and
   choose **Create job and generate proofs**. Backend creation queues generation.
4. Open the saved job for polling, proofs, comparison previews, adjustments,
   approval, remaining-angle progress, failure retries and cancellation.
5. Open generated image links to view/download. URLs refresh every ten minutes
   while previews are mounted; employees can refresh links manually as well.

Azure account `uploads`, private container `renderes` (exact spelling), and CORS
origin `https://renderer-app-eu9fw.ondigitalocean.app` were confirmed by the owner.
The browser accepts signed upload URLs only for that account/container. Account
credentials are owned by Express. The browser sends neither service bearer tokens
nor shop headers to Azure. Comparisons are stored for review, never image inputs.

The app gateway at `/app/api/rendering` authenticates Shopify on every request,
derives `X-Rendering-Shop` from `session.shop`, maps only fixed operations, and
forwards idempotency keys. It does not accept a destination URL from the browser.
Signed responses have no-store caching. Raw backend diagnostics are not exposed.

## Retry and draft limits

Action keys and verified upload IDs are retained in browser memory for the current
confirmed draft. Retry the same action on the same page after a network failure.
Upload retries re-request the original key to refresh expired write SAS URLs.
Confirmation locks the draft. Reloading loses unsent draft/retry state; after an
uncertain job submission, check the jobs dashboard before creating another job.
Saved jobs themselves persist in the backend and remain accessible from the list.
Proof adjustments bind to the current revision; successful mutations refresh state.
Expired/failed requests may be retried without pretending an approval succeeded.

## Not yet implemented / verified

- Product search/match confirmation and Shopify media publication (remain disabled).
- Durable browser upload-resume state across reloads, and bulk ZIP downloads.
- Live production smoke test and browser end-to-end verification.

## Storage-only smoke test

After deploying both applications and setting the variables/allowlist, select one
furniture image and one fabric reference. Confirm the folder, click upload/verify,
and STOP at **All images uploaded and verified**. This does not create a job or
queue paid generation. Expect an Azure PUT 201 and successful verification.
For a separately authorized rendering test, create the job, check the dashboard,
review its proof, request an adjustment and approve the resulting revision.
Never share SAS query strings, bearer tokens or database credentials in logs.
