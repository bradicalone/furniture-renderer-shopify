import { useMemo, useState } from "react";
import type { ChangeEvent } from "react";
import type { HeadersFunction, LoaderFunctionArgs } from "react-router";
import { useLoaderData } from "react-router";
import { authenticate } from "../shopify.server";
import { boundary } from "@shopify/shopify-app-react-router/server";
import styles from "../styles/render-workspace.module.css";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  await authenticate.admin(request);
  const url = new URL(request.url);

  return {
    productId: url.searchParams.get("productId") ?? url.searchParams.get("id") ?? "",
    productTitle: url.searchParams.get("productTitle") ?? "",
    backendConfigured: Boolean(process.env.RENDERING_API_URL),
  };
};

type UploadGroupProps = {
  id: string;
  title: string;
  description: string;
  files: File[];
  onFiles: (files: File[]) => void;
};

function UploadGroup({ id, title, description, files, onFiles }: UploadGroupProps) {
  const handleChange = (event: ChangeEvent<HTMLInputElement>) => {
    onFiles(Array.from(event.currentTarget.files ?? []));
  };

  return (
    <div className={styles.uploadCard}>
      <div>
        <h3>{title}</h3>
        <p>{description}</p>
      </div>
      <label className={styles.dropArea} htmlFor={id}>
        <span className={styles.dropTitle}>Drop images here or choose files</span>
        <span className={styles.dropHint}>JPG, PNG or WEBP · multiple files accepted</span>
      </label>
      <input
        className={styles.fileInput}
        id={id}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        multiple
        onChange={handleChange}
      />
      <div className={styles.fileSummary}>
        {files.length === 0
          ? "No files selected"
          : `${files.length} image${files.length === 1 ? "" : "s"} selected`}
      </div>
    </div>
  );
}

export default function RenderWorkspace() {
  const { productId, productTitle, backendConfigured } = useLoaderData<typeof loader>();
  const [furnitureFiles, setFurnitureFiles] = useState<File[]>([]);
  const [fabricFiles, setFabricFiles] = useState<File[]>([]);
  const [background, setBackground] = useState("white");
  const [contactShadow, setContactShadow] = useState(true);
  const [bedding, setBedding] = useState(false);
  const [instructions, setInstructions] = useState("");
  const [stage, setStage] = useState<"setup" | "proof">("setup");

  const ready = furnitureFiles.length > 0 && fabricFiles.length > 0;
  const contextLabel = useMemo(() => {
    if (productTitle) return productTitle;
    if (productId) return productId.replace("gid://shopify/Product/", "Product ");
    return "No Shopify product selected";
  }, [productId, productTitle]);

  return (
    <s-page heading="New rendering job" inlineSize="large">
      <s-button slot="secondary-actions" href="/app">Back to home</s-button>
      <s-button
        slot="primary-action"
        variant="primary"
        disabled={!ready}
        onClick={() => setStage("proof")}
      >
        Generate first proof
      </s-button>

      {!backendConfigured && (
        <s-banner heading="Preview mode" tone="info">
          The existing Node.js rendering backend is not connected yet. You can
          review the complete workflow, but Generate will not upload images.
        </s-banner>
      )}

      <s-section heading="Shopify product">
        <s-stack direction="inline" gap="base" alignItems="center">
          <s-badge tone={productId ? "success" : "caution"}>
            {productId ? "Linked" : "Not linked"}
          </s-badge>
          <s-text>{contextLabel}</s-text>
        </s-stack>
      </s-section>

      {stage === "setup" ? (
        <>
          <s-section heading="1. Source images">
            <div className={styles.uploadGrid}>
              <UploadGroup
                id="furniture-images"
                title="Furniture angles"
                description="Use clean photos of the same furniture piece from every required angle."
                files={furnitureFiles}
                onFiles={setFurnitureFiles}
              />
              <UploadGroup
                id="fabric-images"
                title="Fabric references"
                description="Upload close, well-lit references for one fabric and color. A swatch is optional."
                files={fabricFiles}
                onFiles={setFabricFiles}
              />
            </div>
          </s-section>

          <s-section heading="2. Output settings">
            <s-stack direction="block" gap="base">
              <s-choice-list
                label="Background"
                name="background"
                values={[background]}
                onChange={(event) =>
                  setBackground(event.currentTarget.values[0] ?? "white")
                }
              >
                <s-choice value="white">White background</s-choice>
                <s-choice value="transparent">Transparent background</s-choice>
              </s-choice-list>
              <s-switch
                label="Add realistic contact shadows"
                checked={contactShadow}
                onChange={(event) => setContactShadow(event.currentTarget.checked)}
              />
              <s-switch
                label="Add mattress, white sheets and pillows"
                details="Enable this for bed products only."
                checked={bedding}
                onChange={(event) => setBedding(event.currentTarget.checked)}
              />
              <s-text-area
                label="Initial rendering instructions"
                name="instructions"
                rows={4}
                value={instructions}
                placeholder="Example: preserve the piping and make the velvet nap slightly more visible."
                onChange={(event) => setInstructions(event.currentTarget.value)}
              />
            </s-stack>
          </s-section>
        </>
      ) : (
        <s-section heading="3. First proof">
          <s-stack direction="block" gap="base">
            <s-banner heading="Ready for backend rendering" tone="success">
              The job contains {furnitureFiles.length} furniture angle(s) and{" "}
              {fabricFiles.length} fabric reference(s).
            </s-banner>
            <div className={styles.proofPlaceholder}>
              <strong>Rendered proof will appear here</strong>
              <span>The backend will return the first completed angle for approval.</span>
            </div>
            <s-text-area
              label="Adjustment request"
              name="adjustment"
              rows={4}
              placeholder="Describe changes to fabric color, texture, shadows, bedding, or cutout."
            />
            <s-button-group>
              <s-button onClick={() => setStage("setup")}>Edit setup</s-button>
              <s-button disabled>Request adjustment</s-button>
              <s-button variant="primary" disabled>
                Approve and render all angles
              </s-button>
            </s-button-group>
          </s-stack>
        </s-section>
      )}

      <s-section slot="aside" heading="Job summary">
        <s-unordered-list>
          <s-list-item>{furnitureFiles.length} furniture angle(s)</s-list-item>
          <s-list-item>{fabricFiles.length} fabric reference(s)</s-list-item>
          <s-list-item>{background} background</s-list-item>
          <s-list-item>Contact shadow: {contactShadow ? "yes" : "no"}</s-list-item>
          <s-list-item>Bedding: {bedding ? "yes" : "no"}</s-list-item>
        </s-unordered-list>
      </s-section>
    </s-page>
  );
}

export const headers: HeadersFunction = (headersArgs) =>
  boundary.headers(headersArgs);
