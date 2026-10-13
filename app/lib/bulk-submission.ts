import type { FolderManifest, SourceFile } from './bulk-folders';
import type { CreateRequest } from './rendering-types';
export type BulkDraft = {
  manifest: FolderManifest; assignments: Record<string, string[]>;
  comparisons: Record<string, File[]>; firstProofs: Record<string, string>;
  jobInstructions: string; furnitureInstructions: Record<string, string>;
  background: 'white' | 'transparent'; shadows: boolean; beds: string[];
};
export type UploadSource = SourceFile & { role: 'furniture' | 'fabric' | 'comparison' };
export function draftFiles(draft: BulkDraft): UploadSource[] {
  const usedFabrics = new Set(Object.values(draft.assignments).flat());
  return [
    ...draft.manifest.furniture.flatMap(item => item.files.map(file => ({ ...file, role: 'furniture' as const }))),
    ...draft.manifest.fabrics.filter(f => usedFabrics.has(f.name)).flatMap(item => item.files.map(file => ({ ...file, role: 'fabric' as const }))),
    ...draft.manifest.furniture.flatMap(item => (draft.comparisons[item.name] ?? []).map((file, i) => ({file, relativePath: `${draft.manifest.root}/comparisons/${item.name}/${i}-${file.name}`, role: 'comparison' as const }))),
  ];
}
export function createManifest(draft: BulkDraft, uploaded: Map<string, string>): CreateRequest {
  const reference = (relativePath: string) => {
    const uploadId = uploaded.get(relativePath);
    if (!uploadId) throw new Error(`Upload not verified: ${relativePath}`);
    return { uploadId, relativePath };
  };
  const used = new Set(Object.values(draft.assignments).flat());
  return {
    name: draft.manifest.root, jobInstructions: draft.jobInstructions,
    furniture: draft.manifest.furniture.map(item => ({
      id: item.name, name: item.name, folder: `${draft.manifest.root}/furniture/${item.name}`,
      sources: item.files.map(file => reference(file.relativePath)),
      firstProofSourceId: reference(draft.firstProofs[item.name]).uploadId,
      comparisons: draftFiles(draft).filter(file => file.role === 'comparison' && file.relativePath.startsWith(`${draft.manifest.root}/comparisons/${item.name}/`)).map(file => reference(file.relativePath)),
      furnitureInstructions: draft.furnitureInstructions[item.name] ?? '',
      options: { background: draft.background, addContactShadow: draft.shadows, addBedding: draft.beds.includes(item.name) },
    })),
    fabrics: draft.manifest.fabrics.filter(f => used.has(f.name)).map(item => ({ id: item.name, name: item.name, folder: `${draft.manifest.root}/fabrics/${item.name}`, references: item.files.map(file => reference(file.relativePath)) })),
    combinations: draft.manifest.furniture.flatMap(item => (draft.assignments[item.name] ?? []).map(fabricId => ({ furnitureId: item.name, fabricId }))),
  };
}
