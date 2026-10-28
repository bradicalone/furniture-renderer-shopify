import {test} from 'node:test';
import assert from 'node:assert/strict';
import {parseRenderingManifest} from '../app/lib/rendering-manifest.ts';
const header='Product Name,Target Variant SKU,Color Code,Fabric Folder';
test('manifest supports BOM, CRLF, quoted commas, escaped quotes and multiline instructions',()=>{
 const rows=parseRenderingManifest('\uFEFF'+header+',Rendering Instructions\r\n"Bed, King",SKU-K,ALA,ALA,"Keep ""seams""\nand shape"\r\n');
 assert.equal(rows[0].productName,'Bed, King');assert.equal(rows[0].instructions,'Keep "seams"\nand shape');
});
test('manifest rejects incomplete, duplicate and malformed mappings',()=>{
 for(const text of [header+'\nBed,SKU,ALA',header+'\nBed,SKU,ALA,../ALA',header+'\nBed,SKU,ALA,ALA\nBed,SKU,ALA,ALA',header+'\n"Bed,SKU,ALA,ALA',header+'\nBed,,ALA,ALA'])assert.throws(()=>parseRenderingManifest(text));
});
test('full SKU and explicit color mapping are preserved without deriving SKU segments',()=>{
 const [row]=parseRenderingManifest(header+'\nSofa,MG002-10-S,BSQ,linen-bisque');
 assert.equal(row.sku,'MG002-10-S');assert.equal(row.color,'BSQ');assert.equal(row.fabricFolder,'linen-bisque');
});
