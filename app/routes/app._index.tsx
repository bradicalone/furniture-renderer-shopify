import type { HeadersFunction, LoaderFunctionArgs } from "react-router";
import { authenticate } from "../shopify.server";
import { boundary } from "@shopify/shopify-app-react-router/server";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  await authenticate.admin(request);
  return null;
};

export default function Index() {
  return <s-page heading="Rendering jobs">
    <s-button slot="primary-action" href="/app/render" variant="primary">New rendering job</s-button>
    <s-section heading="Bulk furniture rendering">
      <p>Start with a parent folder of furniture angles and fabric references. Review the detected structure, then choose fabrics for each furniture item.</p>
      <p>You can complete folder preparation here without opening an individual Shopify product.</p>
    </s-section>
    <s-section heading="Job activity">
      <p>Job history is not connected yet. Processing progress, proof approvals, completed outputs and failures will appear here once the bulk job API is integrated.</p>
      <p>Folder review is available now. It does not upload files or create jobs.</p>
    </s-section>
  </s-page>;
}

export const headers: HeadersFunction = (headersArgs) => boundary.headers(headersArgs);
