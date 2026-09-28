export type RenderOptions = {
  background: "white" | "transparent";
  addContactShadow: boolean;
  addBedding: boolean;
};

export type CreateRenderJobInput = {
  shop: string;
  productId?: string;
  productTitle?: string;
  furnitureName: string;
  fabricName: string;
  furnitureFiles: Array<{ name: string; type: string; size: number }>;
  fabricFiles: Array<{ name: string; type: string; size: number }>;
  options: RenderOptions;
  instructions?: string;
};

type RenderJob = {
  id: string;
  status: "queued" | "processing" | "proof_ready" | "approved" | "failed";
};

function getConfiguration() {
  const baseUrl = process.env.RENDERING_API_URL;
  const token = process.env.RENDERING_API_TOKEN;

  if (!baseUrl || !token) {
    throw new Error(
      "Rendering backend is not configured. Set RENDERING_API_URL and RENDERING_API_TOKEN.",
    );
  }

  return { baseUrl: baseUrl.replace(/\/$/, ""), token };
}

export async function createRenderJob(
  input: CreateRenderJobInput,
): Promise<RenderJob> {
  const { baseUrl, token } = getConfiguration();
  const response = await fetch(`${baseUrl}/v1/render-jobs`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(input),
  });

  if (!response.ok) {
    const detail = await response.text();
    throw new Error(`Rendering backend returned ${response.status}: ${detail}`);
  }

  return (await response.json()) as RenderJob;
}
