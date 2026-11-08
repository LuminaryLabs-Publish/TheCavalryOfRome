import test from 'node:test';
import assert from 'node:assert/strict';
import {DOCTRINE_EMBLEMS, doctrineArtwork} from '../doctrine-art.mjs';
test('all eight cards use distinct recognizable symbols with no generic fallback',()=>{
 const all=Object.entries(DOCTRINE_EMBLEMS);
 assert.equal(all.length,8);
 const symbols=new Set();
 for(const [id,def] of all){
  const markup=doctrineArtwork(id);
  assert.ok(def.title.length>7);
  assert.ok(markup.includes(`data-emblem="${id}"`));
  assert.ok(markup.includes('<svg')&&markup.includes('</svg>'));
  assert.ok(/<path|<circle|<ellipse/.test(def.glyph));
  assert.ok(!symbols.has(def.glyph),id);
  symbols.add(def.glyph);
 }
 assert.throws(()=>doctrineArtwork('invalid-doctrine'));
});