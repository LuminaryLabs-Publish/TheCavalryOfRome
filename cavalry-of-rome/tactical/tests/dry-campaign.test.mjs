import test from 'node:test';
import assert from 'node:assert/strict';
import {sceneEncounter} from '../encounter-scenario.mjs';
import {buildCampaignScenario} from '../campaign-scenario.mjs';
import {authorWorldScene} from '../sculpt-geometry.mjs';
import {RIVER_POLYLINE,riverCenterZ,SITE} from '../terrain-world.mjs';

test('an encounter on dry terrain still builds a finite sculpted battlefield',()=>{
 const source=sceneEncounter();
 source.board.featureCells=source.board.featureCells.filter(f=>!['river','bridge'].includes(f.type));
 source.board.blockedCells=source.board.featureCells.filter(f=>f.obstacle).map(f=>`${f.q},${f.r}`);
 const scenario=buildCampaignScenario(source);
 assert.equal(scenario.active,true);
 assert.equal(RIVER_POLYLINE.length,0,'no synthetic river is introduced');
 assert.ok(Number.isFinite(riverCenterZ(SITE.x)));
 const mesh=authorWorldScene();
 assert.ok(mesh.triangles>10000);
 for(const v of mesh.vertices)assert.ok(Number.isFinite(v),'dry-world mesh contains invalid coordinate');
});
