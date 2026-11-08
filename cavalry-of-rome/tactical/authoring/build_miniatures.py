#!/usr/bin/env python3
"""Produce editable, deterministic glTF 2.0 character models for Cavalry of Rome.

This sandbox mesh builder exports GLB assets with a small per-formation triangle budget.
The Nexus authoring command recipe and inspection record sit alongside this file.
Native NexusEngine authoring runtime is unavailable in this sandbox; do not claim
these GLBs were executed through that runtime.
"""
import math
import json
from pathlib import Path
import numpy as np
import trimesh

BASE=Path(__file__).resolve().parents[1]
OUT=BASE/'assets'/'models';OUT.mkdir(parents=True,exist_ok=True)

COLORS={
 'roman':{'cloth':(133,35,33),'cloth2':(185,66,49),'armor':(117,125,128),'dark':(54,52,48),'metal':(197,162,97),'shield':(128,32,29),'skin':(179,135,101),'leather':(85,61,46),'horse':(99,72,53),'horse2':(139,107,81)},
 'enemy':{'cloth':(46,80,96),'cloth2':(68,113,133),'armor':(101,108,114),'dark':(43,52,55),'metal':(169,148,112),'shield':(47,81,112),'skin':(170,129,97),'leather':(68,64,57),'horse':(75,72,69),'horse2':(120,113,104)},
}

def rgba(color,alpha=255):return np.array([*color,alpha],dtype=np.uint8)
class Sculpt:
 def __init__(self):self.meshes=[]
 def mesh(self,m,color):
  m=trimesh.Trimesh(vertices=m.vertices,faces=m.faces,process=False)
  m.visual.vertex_colors=np.tile(rgba(color), (len(m.vertices),1));self.meshes.append(m);return m
 def box(self,pos,ext,color,rotation=None):
  m=trimesh.creation.box(extents=ext)
  if rotation:m.apply_transform(trimesh.transformations.rotation_matrix(*rotation))
  m.apply_translation(pos);return self.mesh(m,color)
 def ball(self,pos,radii,color,detail=1):
  m=trimesh.creation.icosphere(subdivisions=detail,radius=1)
  m.apply_scale(radii);m.apply_translation(pos);return self.mesh(m,color)
 def tube(self,a,b,ra,rb,color,segments=10):
  a,b=np.asarray(a,dtype=float),np.asarray(b,dtype=float)
  tangent=b-a;length=np.linalg.norm(tangent)
  if length<.00001:return
  tangent/=length
  axis=np.array([0.,0.,1.]) if abs(tangent[2])<.8 else np.array([0.,1.,0.])
  right=np.cross(tangent,axis);right/=np.linalg.norm(right)
  up=np.cross(tangent,right)
  verts=[]
  for center,r in ((a,ra),(b,rb)):
   for i in range(segments):
    theta=2*math.pi*i/segments
    verts.append(center+r*(math.cos(theta)*right+math.sin(theta)*up))
  verts=np.asarray(verts)
  faces=[]
  for i in range(segments):
   j=(i+1)%segments
   faces.extend([[i,j,segments+j],[i,segments+j,segments+i]])
   faces.append([segments,i,j]);faces.append([segments+1,segments+j,segments+i])
  # cap at ring center
  v=np.vstack([verts,a,b])
  faces=faces[:2*segments]+[[2*segments,i,(i+1)%segments] for i in range(segments)]+[[2*segments+1,segments+(i+1)%segments,segments+i] for i in range(segments)]
  return self.mesh(trimesh.Trimesh(vertices=v,faces=np.asarray(faces),process=False),color)
 def poly(self,points,color):
  v=np.asarray(points,dtype=float)
  faces=[[0,i,i+1] for i in range(1,len(points)-1)]
  return self.mesh(trimesh.Trimesh(vertices=v,faces=faces,process=False),color)
 def ellipsoid_taper(self,a,b,ra,rb,color):return self.tube(a,b,ra,rb,color,10)
 def export(self,path):
  # Combine all elements so there is one mesh with COLOR_0 and one node.
  mesh=trimesh.util.concatenate(self.meshes)
  mesh.merge_vertices(merge_tex=False,merge_norm=False)
  export=mesh.export(file_type='glb')
  Path(path).write_bytes(export)
  return {'file':str(Path(path).relative_to(BASE)),'triangles':int(len(mesh.faces)),'vertices':int(len(mesh.vertices)),'bytes':len(export),'bounds':[list(map(float,mesh.bounds[0])),list(map(float,mesh.bounds[1]))]}


def cloak(s,side,palette,thickness=.5):
 c=palette['cloth']
 s.poly([[-3.8,17.6,-1.4],[3.8,17.6,-1.4],[5.2,8,-5.3],[-.5,8.5,-5.7],[-5.2,9,-5.3]],c)
 s.poly([[-3.8,17.7,-1.0],[-5.2,9,-5.2],[-6.5,10,-1.8]],palette['cloth2'])

def sword(s,pal,x):
 s.tube([x,10.6,2.6],[x,17.5,3.4],.58,.38,pal['metal'],8)
 s.tube([x-1.35,11.2,2.7],[x+1.4,11.2,2.7],.42,.42,pal['dark'],8)
 s.tube([x,9.0,2.5],[x,10.8,2.7],.65,.65,pal['leather'],8)

def warrior(s,side='roman',kind='medium',offset=(0,0,0),mounted=False):
 pal=COLORS[side]
 off=np.asarray(offset,dtype=float)
 def p(v):return (off+np.asarray(v)).tolist()
 base=11 if mounted else 0
 # feet / greaves / legs
 for x in (-1.65,1.65):
  if not mounted:
   s.tube(p((x,1,0)),p((x,9,0)),1.22,1.52,pal['skin'],9)
   s.tube(p((x,7.5,0)),p((x,10,0)),1.5,1.35,pal['leather'],9)
   s.ball(p((x,1.1,1.35)),[1.95,.85,3],pal['dark'])
  else:
   s.tube(p((x*.65,12,0)),p((x*.75,8.8,2.5)),1.25,.9,pal['leather'],9)
 # tunic, armor shaped as fitted overlapping pieces
 s.ball(p((0,base+13.8,.1)),[3.8,5.2,2.4],pal['cloth2'],1)
 s.ball(p((0,base+16.1,.55)),[4.15,3.8,2.7],pal['armor'],1)
 for i in range(3):s.box(p((0,base+12.7+i*1.52,2.36)),(6.8,1.05,.55),pal['metal'] if i%2 else pal['armor'])
 s.tube(p((-3.6,base+15.7,.4)),p((3.6,base+15.7,.4)),.7,.7,pal['leather'],10)
 # shoulder guards
 for x in (-4.0,4.0):s.ball(p((x,base+18.3,0)),[2,1.4,2.5],pal['armor'])
 # arms are articulated silhouettes not cylinders projected from the camera
 s.tube(p((-4.0,base+17.6,.0)),p((-6.4,base+12,2.9)),1.15,.9,pal['skin'],9)
 s.tube(p((4.0,base+17.6,.0)),p((6.0,base+12.2,2.6)),1.15,.9,pal['skin'],9)
 # neckline + bare face
 s.tube(p((0,base+19.0,0)),p((0,base+20.6,.2)),1.17,1.0,pal['skin'])
 s.ball(p((0,base+22.2,1.0)),[2.4,2.85,2.25],pal['skin'],1)
 # bronze/iron helmet with brow rim, neck guard, plumage, and cheek plates
 s.ball(p((0,base+23.4,.55)),[2.65,1.55,2.5],pal['metal'],1)
 s.tube(p((-2.35,base+22.8,1.1)),p((2.35,base+22.8,1.1)),.48,.48,pal['dark'],10)
 for x in (-2.4,2.4):s.box(p((x,base+21.7,1.9)),(.8,2.3,.65),pal['armor'])
 if side=='roman':
  # crest over helmet: distinct command silhouette at low zoom
  s.ball(p((0,base+25.6,.0)),[2.5,1.15,1.1],pal['cloth'],1)
  s.ball(p((0,base+26.7,-.3)),[2.3,.6,1.3],pal['cloth2'],1)
 if not mounted:
  cloak(s,side,pal)
 # shields / javelins / spears based on class
 if kind=='light':
  # Small round shield strapped to forearm
  s.ball(p((-6.4,base+12.6,2.7)),[3.6,3.6,.65],pal['shield'],1)
  s.ball(p((-6.4,base+12.6,3.4)),[1.2,1.1,.38],pal['metal'],1)
  s.tube(p((5.4,base+9,-1.5)),p((6.9,base+31,1)),.36,.15,pal['leather'],8)
  s.tube(p((6.9,base+30.2,1)),p((7.5,base+33.3,1.2)),.35,0.0,pal['armor'],8)
 elif kind=='medium':
  # Curved rectangular scutum silhouette with raised metal boss.
  shield=[p((-8.8,base+7.1,3.15)),p((-4.65,base+7.1,4.1)),p((-4.5,base+19.5,4.1)),p((-8.8,base+19.5,3.15))]
  s.poly(shield,pal['shield'])
  # side edges and decorated bosses provide contrast from above
  for z in (3.2,4.2):s.tube(p((-8.6,base+7.3,z)),p((-8.6,base+19.4,z)),.36,.36,pal['metal'],8)
  for yy in (7.2,19.35):s.tube(p((-8.5,base+yy,3.35)),p((-4.5,base+yy,4.1)),.35,.35,pal['metal'],8)
  s.ball(p((-6.6,base+13.25,4.2)),[1.2,1.4,.7],pal['metal'],1)
  sword(s,pal,5.8)
 else:
  s.tube(p((5.8,base+8,-1.3)),p((5.8,base+35,1.4)),.43,.24,pal['leather'],8)
  s.tube(p((5.8,base+34.8,1.4)),p((5.8,base+38,1.4)),.42,0,pal['armor'],8)
  s.ball(p((-5.6,base+13.3,2.5)),[3.5,4,.7],pal['shield'],1)
  s.ball(p((-5.6,base+13.3,3.25)),[1.6,1.6,.45],pal['metal'],1)


def horse(s,side):
 pal=COLORS[side]
 # Horse faces forward +Z; offset legs so hooves read at oblique camera angles.
 s.ball((0,12,0),[4.5,4.9,9.6],pal['horse'],2)
 s.ball((0,11,3),[4.5,3.9,6.5],pal['horse2'],1)
 for x in (-3,3):
  for z in (-5.3,5.1):
   back=(z<0)
   s.tube((x,11,z),(x*1.14,5.3,z-(2.8 if back else -2.1)),1.55,.8,pal['horse'],10)
   s.tube((x*1.14,5.3,z-(2.8 if back else -2.1)),(x*1.18,1,z-(3.7 if back else -3.6)),.85,.68,pal['horse2'],9)
   s.box((x*1.18,.75,z-(3.9 if back else -3.9)),(1.8,1.05,2.1),pal['dark'])
 # Neck, ears, muzzle and reins
 s.tube((0,14,6.2),(0,20,10.7),3.4,2.3,pal['horse'],12)
 s.ball((0,21,11),[2.3,3.1,2.2],pal['horse2'],1)
 s.ball((0,19.8,13.2),[2.4,1.7,2.2],pal['horse2'],1)
 for x in (-1.5,1.5):s.tube((x,22.5,10.5),(x*1.2,25.8,11),.65,.2,pal['horse'],9)
 s.tube((-2.4,19.3,12.0),(2.4,19.3,12.0),.3,.3,pal['dark'],8)
 # Saddle and bronze stirrup details
 s.ball((0,16.1,0),[4.35,.85,4.5],pal['leather'],1)
 s.tube((-4.1,16,-1),(4.1,16,-1),.65,.65,pal['metal'],10)
 s.tube((0,12,-8.3),(0,5,-12.3),1.55,.25,pal['dark'],9)


def make_unit(side,kind):
 s=Sculpt()
 if kind=='heavy':horse(s,side);warrior(s,side,kind,mounted=True)
 else:warrior(s,side,kind)
 return s

if __name__=='__main__':
 reports=[]
 for side in ('roman','enemy'):
  for kind in ('light','medium','heavy'):
   path=OUT/f'{side}-{kind}.glb'
   r=make_unit(side,kind).export(path)
   r.update({'faction':side,'class':kind})
   reports.append(r)
 report={'pipeline':'deterministic authoring recipe -> editable mesh -> GLB','author':'sandbox-procedural-authoring','nexus_native_execution':'not_run','models':reports}
 (BASE/'authoring'/'model-inspection.json').write_text(json.dumps(report,indent=2))
 for d in reports:print(d['file'],d['triangles'],'triangles',d['bytes'],'bytes')
