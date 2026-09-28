# Codex handoff

## Architecture decision

This is a standalone Shopify embedded-app repository. Do not turn it into the
general rendering backend and do not create another rendering server.

The company's existing Node.js service will own storage, queues, database job
state, OpenAI Image API calls, and generated files. This Shopify app will own
Shopify authentication, employee UI, product context, approval, and publishing.

## Completed

- Official Shopify React Router template
- Embedded app home and `/app/render` workspace
- Furniture-angle and fabric-reference multi-file selection
- White/transparent background, contact shadow, and optional bedding controls
- First-proof and adjustment workflow shell
- Admin link extension at `admin.product.action.link`
- Server-side rendering API adapter
- Backend contract documentation
- TypeScript, ESLint, React Router build, and `shopify app build` validation

## Important constraints

- Do not commit furniture, fabric, swatch, or Cylindo comparison assets yet.
- Never expose `RENDERING_API_TOKEN` or OpenAI credentials to browser code.
- Generate and approve one proof before rendering all remaining angles.
- Preserve furniture geometry and camera angle across fabric variants.
- The Cylindo output is a comparison reference, not required rendering input.

## Next work

1. Link the repository to the company's Shopify app with `npm run config:link`.
2. Replace placeholder application URLs through Shopify CLI configuration.
3. Define signed-upload endpoints on the existing Node.js rendering service.
4. Wire `/app/render` to signed uploads and `POST /v1/render-jobs`.
5. Poll job status and display the first proof.
6. Implement adjustment and approval calls.
7. Publish approved output URLs through Shopify Admin GraphQL product media.

See `docs/backend-api-contract.md` for the planned service boundary.
