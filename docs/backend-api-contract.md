# Rendering backend API contract

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
