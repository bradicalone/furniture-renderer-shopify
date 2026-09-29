export type SourceFile = { file: File; relativePath: string };
export type FolderGroup = { name: string; files: SourceFile[] };
export type FolderManifest = {
  root: string;
  furniture: FolderGroup[];
  fabrics: FolderGroup[];
  ignored: string[];
  rejected: { path: string; reason: string }[];
  errors: string[];
};

const systemFile = (path: string) => path.split('/').some(part =>
  part === '__MACOSX' || part === '.DS_Store' || part.startsWith('._') ||
  ['thumbs.db', 'desktop.ini'].includes(part.toLowerCase()));

export function parseFolder(files: SourceFile[]): FolderManifest {
  const result: FolderManifest = { root: '', furniture: [], fabrics: [], ignored: [], rejected: [], errors: [] };
  const roots = new Set<string>();
  const seen = new Set<string>();
  const groups = { furniture: new Map<string, FolderGroup>(), fabrics: new Map<string, FolderGroup>() };
  for (const source of files) {
    const path = source.relativePath;
    if (systemFile(path)) { result.ignored.push(path); continue; }
    const parts = path.split('/');
    const reject = (reason: string) => result.rejected.push({ path, reason });
    if (path.includes('\\') || parts.some(p => !p || p === '.' || p === '..')) { reject('Invalid relative path'); continue; }
    roots.add(parts[0]);
    if (parts.length < 4 || !['furniture', 'fabrics'].includes(parts[1])) {
      reject('Expected parent/furniture/item/image or parent/fabrics/fabric/image'); continue;
    }
    const extension = parts.at(-1)!.split('.').at(-1)!.toLowerCase();
    const mime: Record<string, string> = { jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png', webp: 'image/webp' };
    if (!mime[extension] || (source.file.type && source.file.type !== mime[extension])) { reject('Only JPG, PNG and WEBP images are supported'); continue; }
    if (!source.file.size) { reject('File is empty'); continue; }
    if (seen.has(path)) { reject('Duplicate relative path'); continue; }
    seen.add(path);
    const category = parts[1] as 'furniture' | 'fabrics';
    const name = parts[2];
    const group = groups[category].get(name) ?? { name, files: [] };
    group.files.push(source);
    groups[category].set(name, group);
  }
  result.root = [...roots][0] ?? '';
  if (roots.size !== 1) result.errors.push('Choose exactly one parent folder.');
  for (const category of ['furniture', 'fabrics'] as const) {
    result[category] = [...groups[category].values()].sort((a, b) => a.name.localeCompare(b.name));
    result[category].forEach(group => group.files.sort((a, b) => a.relativePath.localeCompare(b.relativePath)));
    if (!result[category].length) result.errors.push(`No supported images found in ${category}/ folders.`);
  }
  return result;
}

// Directory readers return batches; keep reading until the empty final batch.
export async function readEntry(entry: FileSystemEntry, parent = ''): Promise<SourceFile[]> {
  const path = parent ? `${parent}/${entry.name}` : entry.name;
  if (entry.isFile) {
    const file = await new Promise<File>((resolve, reject) => (entry as FileSystemFileEntry).file(resolve, reject));
    return [{ file, relativePath: path }];
  }
  const reader = (entry as FileSystemDirectoryEntry).createReader();
  const files: SourceFile[] = [];
  let entries: FileSystemEntry[];
  do {
    entries = await new Promise<FileSystemEntry[]>((resolve, reject) => reader.readEntries(resolve, reject));
    for (const child of entries) files.push(...await readEntry(child, path));
  } while (entries.length);
  return files;
}
