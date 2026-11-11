import {deploymentConfig,assertDeploymentShop} from '../services/deployment.server';
import {StorageContext,TestModeContext} from '../lib/storage-context';
import type { HeadersFunction, LoaderFunctionArgs } from "react-router";
import { Outlet, useLoaderData, useRouteError } from "react-router";
import { boundary } from "@shopify/shopify-app-react-router/server";
import { AppProvider } from "@shopify/shopify-app-react-router/react";

import { authenticate } from "../shopify.server";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const {session}=await authenticate.admin(request);
  assertDeploymentShop(session.shop);

  // eslint-disable-next-line no-undef
  return { apiKey: process.env.SHOPIFY_API_KEY || "", ...deploymentConfig(), testModeEnabled: process.env.RENDERING_TEST_MODE_ENABLED === "true" };
};

export default function App() {
  const { apiKey, staging, storage, testModeEnabled } = useLoaderData<typeof loader>();

  return (
    <AppProvider embedded apiKey={apiKey}>
      <TestModeContext.Provider value={testModeEnabled}>
      <StorageContext.Provider value={storage}>
        {staging && <div role="status" style={{background:"#fff4ce",color:"#573b00",padding:"12px 20px",fontWeight:600}}>STAGING — test store and test image storage</div>}
        <Outlet />
      </StorageContext.Provider>
      </TestModeContext.Provider>
    </AppProvider>
  );
}

// Shopify needs React Router to catch some thrown responses, so that their headers are included in the response.
export function ErrorBoundary() {
  return boundary.error(useRouteError());
}

export const headers: HeadersFunction = (headersArgs) => {
  return boundary.headers(headersArgs);
};
