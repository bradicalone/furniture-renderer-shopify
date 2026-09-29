import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseFolder, readEntry } from '../app/lib/bulk-folders.ts';
const source = (relativePath, type = 'image/jpeg') => ({ relativePath, file: new File(['image'], relativePath.split('/').at(-1), { type }) });
const base = () => [source('job/furniture/bed/front.jpg'), source('job/fabrics/velvet/reference.jpg')];
test('preserves nested paths and groups furniture and fabrics', () => {
  const result = parseFolder([...base(), source('job/furniture/bed/angles/side.jpg')]);
  assert.equal(result.furniture.length, 1);
  assert.equal(result.furniture[0].files.length, 2);
  assert.equal(result.furniture[0].files[0].relativePath, 'job/furniture/bed/angles/side.jpg');
  assert.deepEqual(result.errors, []);
  assert.deepEqual(result.rejected, []);
});
test('ignores system files but rejects unsupported, malformed and duplicate files', () => {
  const result = parseFolder([...base(), source('job/.DS_Store'), source('job/__MACOSX/._front.jpg'), source('job/readme.txt', 'text/plain'), source('job/furniture/bed/file.gif', 'image/gif'), source('job/furniture/../bad.jpg'), base()[0]]);
  assert.equal(result.ignored.length, 2);
  assert.equal(result.rejected.length, 4);
});
test('requires a single root and both categories', () => {
  assert.equal(parseFolder([]).errors.length, 3);
  assert.ok(parseFolder([base()[0]]).errors.some(e => e.includes('fabrics')));
  assert.ok(parseFolder([...base(), source('other/fabrics/fawn/ref.jpg')]).errors.some(e => e.includes('one parent')));
});
test('rejects empty files and incompatible MIME types', () => {
  assert.equal(parseFolder([...base(), source('job/furniture/bed/fake.jpg', 'text/plain'), {relativePath:'job/furniture/bed/empty.jpg', file:new File([], 'empty.jpg')}]).rejected.length, 2);
});
test('directory traversal consumes every reader batch and retains root', async () => {
  const fileEntry = name => ({ name, isFile: true, file: resolve => resolve(new File(['x'], name)) });
  let batch = 0;
  const directory = { name: 'job', isFile: false, createReader: () => ({ readEntries: resolve => resolve([[fileEntry('one.jpg')], [fileEntry('two.jpg')], []][batch++]) }) };
  assert.deepEqual((await readEntry(directory)).map(f => f.relativePath), ['job/one.jpg', 'job/two.jpg']);
});
test('directory read errors propagate instead of silently losing files', async () => {
  await assert.rejects(readEntry({name:'job', isFile:false, createReader:() => ({readEntries:(_resolve, reject) => reject(new Error('denied'))})}), /denied/);
});
