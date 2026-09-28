import type { HeadersFunction, LoaderFunctionArgs } from "react-router";
import { useLoaderData } from "react-router";
import { authenticate } from "../shopify.server";
import { boundary } from "@shopify/shopify-app-react-router/server";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  await authenticate.admin(request);
  return { backendConfigured: Boolean(process.env.RENDERING_API_URL) };
};

export default function Index() {
  const { backendConfigured } = useLoaderData<typeof loader>();

  return (
    <s-page heading="Furniture image renderer">
      <s-button slot="primary-action" href="/app/render" variant="primary">
        Start a rendering job
      </s-button>

      {!backendConfigured && (
        <s-banner heading="Backend connection not configured" tone="warning">
          Add RENDERING_API_URL and RENDERING_API_TOKEN before submitting live
          rendering jobs. The interface can still be reviewed locally.
        </s-banner>
      )}

      <s-section heading="Create product-ready furniture images">
        <s-stack direction="block" gap="base">
          <s-paragraph>
            Upload furniture angles and fabric references, approve one proof,
            then render the remaining angles consistently.
          </s-paragraph>
          <s-grid gridTemplateColumns="repeat(auto-fit, minmax(190px, 1fr))" gap="base">
            <s-box padding="base" border="base" borderRadius="base">
              <s-stack direction="block" gap="small">
                <s-badge tone="info">1</s-badge>
                <s-heading>Upload</s-heading>
                <s-paragraph>Choose furniture-angle and fabric-reference images.</s-paragraph>
              </s-stack>
            </s-box>
            <s-box padding="base" border="base" borderRadius="base">
              <s-stack direction="block" gap="small">
                <s-badge tone="info">2</s-badge>
                <s-heading>Approve a proof</s-heading>
                <s-paragraph>Review the first angle and request adjustments.</s-paragraph>
              </s-stack>
            </s-box>
            <s-box padding="base" border="base" borderRadius="base">
              <s-stack direction="block" gap="small">
                <s-badge tone="info">3</s-badge>
                <s-heading>Publish</s-heading>
                <s-paragraph>Render all angles and attach approved images to Shopify.</s-paragraph>
              </s-stack>
            </s-box>
          </s-grid>
        </s-stack>
      </s-section>

      <s-section heading="Current milestone">
        <s-unordered-list>
          <s-list-item>Embedded Shopify Admin workflow</s-list-item>
          <s-list-item>Product-aware rendering workspace</s-list-item>
          <s-list-item>Backend API boundary for your existing Node.js server</s-list-item>
        </s-unordered-list>
      </s-section>
    </s-page>
  );
}

export const headers: HeadersFunction = (headersArgs) =>
  boundary.headers(headersArgs);
