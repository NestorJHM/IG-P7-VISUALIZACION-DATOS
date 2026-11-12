import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

const ORIGIN={lat:28.131,lon:-15.431};
const MX=111320*Math.cos(ORIGIN.lat*Math.PI/180),MZ=111320;
const project=(lon,lat)=>new THREE.Vector3((lon-ORIGIN.lon)*MX,0,-(lat-ORIGIN.lat)*MZ);
const unproject=p=>({lon:p.x/MX+ORIGIN.lon,lat:-p.z/MZ+ORIGIN.lat});
const zones={mesa:{name:'Mesa y López',lon:-15.4348,lat:28.1268},canteras:{name:'Las Canteras',lon:-15.4382,lat:28.1355},santa:{name:'Santa Catalina',lon:-15.4313,lat:28.1404},alcaravaneras:{name:'Alcaravaneras',lon:-15.4282,lat:28.1282},isleta:{name:'La Isleta',lon:-15.4268,lat:28.1513}};
const palette=['#70bcb7','#99c8af','#e9cf83','#ffac4c','#f4763c','#ed4a3d','#ae263d'].map(c=>new THREE.Color(c));
const bandHeights=[0,6,45,290,540,780,1000];
const rangeLabels=['< 50','50–55','55–60','60–65','65–70','70–75','75–100'];
const upperBounds=[50,55,60,65,70,75,100];
const hash=n=>{const v=Math.sin(Number(n)*12.9898)*43758.5453;return v-Math.floor(v);};

export function createCity(container,{geography,noise,motion,onSelect,onTourEnd}) {
 const scene=new THREE.Scene();scene.background=new THREE.Color('#090f13');scene.fog=new THREE.FogExp2('#0b1419',.000105);
 const renderer=new THREE.WebGLRenderer({antialias:true,alpha:false,powerPreference:'high-performance',preserveDrawingBuffer:true});
 renderer.setPixelRatio(Math.min(devicePixelRatio,1.7));renderer.setSize(innerWidth,innerHeight);renderer.outputColorSpace=THREE.SRGBColorSpace;renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=1.2;
 renderer.shadowMap.enabled=true;renderer.shadowMap.type=THREE.PCFSoftShadowMap;container.append(renderer.domElement);
 const camera=new THREE.PerspectiveCamera(43,innerWidth/innerHeight,5,22000);
 const target=new THREE.Vector3(10,0,-400);const home=new THREE.Vector3(-3000,2550,2300);camera.position.copy(home);
 const composer=new EffectComposer(renderer);composer.addPass(new RenderPass(scene,camera));composer.addPass(new UnrealBloomPass(new THREE.Vector2(innerWidth,innerHeight),.45,.65,.88));composer.addPass(new OutputPass());
 const controls=new OrbitControls(camera,renderer.domElement);controls.target.copy(target);controls.enableDamping=true;controls.dampingFactor=.065;controls.minDistance=550;controls.maxDistance=11500;controls.maxPolarAngle=Math.PI*.475;controls.minPolarAngle=.08;controls.enablePan=true;
 scene.add(new THREE.AmbientLight('#8eafc2',1.15));scene.add(new THREE.HemisphereLight('#c4dfe5','#10181b',1.75));
 const key=new THREE.DirectionalLight('#ffe3b6',3);key.position.set(-1800,3500,1500);key.castShadow=true;key.shadow.mapSize.set(2048,2048);Object.assign(key.shadow.camera,{left:-3500,right:3500,top:4000,bottom:-3500,near:100,far:8500});key.shadow.bias=-.0004;key.shadow.normalBias=2;scene.add(key);
 const rim=new THREE.DirectionalLight('#72a9b9',1.7);rim.position.set(2000,1500,-2200);scene.add(rim);
 const world=new THREE.Group();scene.add(world);
 const buildings=new THREE.Group(),fibers=new THREE.Group(),noiseGroup=new THREE.Group();world.add(buildings,fibers,noiseGroup);
 const seaMaterial=new THREE.ShaderMaterial({uniforms:{time:{value:0}},vertexShader:'varying vec3 vWorld; void main(){vWorld=(modelMatrix*vec4(position,1.)).xyz;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',fragmentShader:`varying vec3 vWorld; uniform float time; void main(){float w=sin(vWorld.x*.045+sin(vWorld.z*.018+time*.12)*2.)*sin(vWorld.z*.042)*.5+.5;float d=exp(-length(vWorld.xz-vec2(-1600.,900.))*.0003);vec3 c=mix(vec3(.002,.004,.007),vec3(.006,.016,.021),d);c+=w*.0015;gl_FragColor=vec4(c,1.);}`});
 const sea=new THREE.Mesh(new THREE.PlaneGeometry(32000,32000,1,1),seaMaterial);sea.rotation.x=-Math.PI/2;sea.position.y=-15;scene.add(sea);
 // Generalized geographic base; detailed coastline is drawn from the downloaded OSM ways.
 const coastBase=[[-15.453,28.098],[-15.451,28.115],[-15.4438,28.126],[-15.4386,28.135],[-15.4346,28.142],[-15.4312,28.148],[-15.4325,28.153],[-15.439,28.158],[-15.439,28.172],[-15.408,28.177],[-15.397,28.165],[-15.407,28.156],[-15.421,28.15],[-15.428,28.1465],[-15.4274,28.134],[-15.4276,28.129],[-15.4253,28.1234],[-15.4233,28.1212],[-15.4144,28.1105],[-15.410,28.098]];
 function shapeMesh(points,material,y=0){const shape=new THREE.Shape(points.map(p=>{const v=project(p[0],p[1]);return new THREE.Vector2(v.x,-v.z);}));const mesh=new THREE.Mesh(new THREE.ShapeGeometry(shape),material);mesh.rotation.x=-Math.PI/2;mesh.position.y=y;mesh.receiveShadow=true;world.add(mesh);return mesh;}
 const land=shapeMesh(coastBase,new THREE.MeshStandardMaterial({color:'#1c282b',roughness:.92,metalness:.1}),0);
 const roadPositions=[],majorPositions=[],coastPositions=[],roofPositions=[];
 function insideLand(x,z){const p=unproject({x,z});let inside=false;for(let i=0,j=coastBase.length-1;i<coastBase.length;j=i++){const a=coastBase[i],b=coastBase[j];if((a[1]>p.lat)!==(b[1]>p.lat)&&p.lon<(b[0]-a[0])*(p.lat-a[1])/(b[1]-a[1])+a[0])inside=!inside;}return inside;}const geometries=[[],[],[]];const curves=[];
 let buildingCount=0,roadCount=0;
 for(const e of geography.elements){
  const points=e.geometry.map(p=>project(p.lon,p.lat));if(points.length<2)continue;
  if(e.tags.building&&points.length>3){
   const shape=new THREE.Shape(points.map(p=>new THREE.Vector2(p.x,-p.z)));
   const providedHeight=parseFloat(e.tags.height),levels=parseFloat(e.tags['building:levels']);
   const h=1.65*(Number.isFinite(providedHeight)?Math.max(3,Math.min(160,providedHeight)):Number.isFinite(levels)?Math.max(3,Math.min(160,levels*3.2)):12+hash(e.id)*27);
   const g=new THREE.ExtrudeGeometry(shape,{depth:h,bevelEnabled:false,steps:1,curveSegments:1});g.rotateX(-Math.PI/2);g.translate(0,2,0);geometries[Math.floor(hash(e.id)*3)].push(g);buildingCount++;
   for(let i=1;i<points.length;i++)roofPositions.push(points[i-1].x,h+2.2,points[i-1].z,points[i].x,h+2.2,points[i].z);
  }
  if(e.tags.highway&&!['footway','steps','path','track','service','cycleway'].includes(e.tags.highway)){
   const major=['primary','secondary','tertiary','trunk','primary_link','secondary_link'].includes(e.tags.highway);
   for(let i=1;i<points.length;i++){const list=major?majorPositions:roadPositions;list.push(points[i-1].x,3,points[i-1].z,points[i].x,3,points[i].z);}roadCount++;
   if(major&&points.length>2&&curves.length<180){const curve=new THREE.CatmullRomCurve3(points.map(p=>new THREE.Vector3(p.x,8,p.z)));if(curve.getLength()>120)curves.push(curve);}
  }
  if(e.tags.natural==='coastline')for(let i=1;i<points.length;i++)coastPositions.push(points[i-1].x,-.1,points[i-1].z,points[i].x,-.1,points[i].z);
  if(e.tags.natural==='beach'&&points.length>3)shapeMesh(e.geometry.map(p=>[p.lon,p.lat]),new THREE.MeshStandardMaterial({color:'#8b8066',roughness:1}),.3);
  if(e.tags.leisure==='park'&&points.length>3)shapeMesh(e.geometry.map(p=>[p.lon,p.lat]),new THREE.MeshStandardMaterial({color:'#233d37',roughness:1}),.5);
 }
 for(let i=0;i<3;i++)if(geometries[i].length){const merged=mergeGeometries(geometries[i]);const mesh=new THREE.Mesh(merged,new THREE.MeshStandardMaterial({color:['#354044','#454a48','#56564d'][i],roughness:.87,metalness:.12}));mesh.castShadow=true;mesh.receiveShadow=true;buildings.add(mesh);geometries[i].forEach(g=>g.dispose());}
 function segments(positions,color,opacity,parent=world){const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));const m=new THREE.LineBasicMaterial({color,transparent:true,opacity,depthWrite:false});const line=new THREE.LineSegments(g,m);parent.add(line);return line;}
 segments(roofPositions,'#b5b9a9',.16,buildings);segments(roadPositions,'#7caaa5',.48,fibers);const majorLines=segments(majorPositions,'#f5d8a0',1,fibers);majorLines.material.color.multiplyScalar(2.2);segments(coastPositions,'#a3cdc9',.5);
 // Neural nodes and pulses follow real road geometries. They do not encode traffic.
 const particlePositions=[],pulseCurves=curves.filter((_,i)=>i%2===0);
 for(const c of curves){const p=c.getPoint(.5);particlePositions.push(p.x,9,p.z);}
 const particleTexture=(()=>{const cv=document.createElement('canvas');cv.width=cv.height=32;const ctx=cv.getContext('2d');const gr=ctx.createRadialGradient(16,16,0,16,16,16);gr.addColorStop(0,'rgba(255,250,222,1)');gr.addColorStop(.15,'rgba(255,235,190,1)');gr.addColorStop(.45,'rgba(255,213,142,.3)');gr.addColorStop(1,'rgba(255,213,142,0)');ctx.fillStyle=gr;ctx.fillRect(0,0,32,32);return new THREE.CanvasTexture(cv);})();
 const particlesGeometry=new THREE.BufferGeometry();particlesGeometry.setAttribute('position',new THREE.Float32BufferAttribute(particlePositions,3));fibers.add(new THREE.Points(particlesGeometry,new THREE.PointsMaterial({map:particleTexture,size:28,transparent:true,depthWrite:false,blending:THREE.AdditiveBlending,color:'#ffe7af'})));
 const pulseGeometry=new THREE.BufferGeometry();pulseGeometry.setAttribute('position',new THREE.Float32BufferAttribute(new Float32Array(pulseCurves.length*3),3));fibers.add(new THREE.Points(pulseGeometry,new THREE.PointsMaterial({map:particleTexture,size:38,transparent:true,depthWrite:false,blending:THREE.AdditiveBlending,color:'#fff0c1'})));
 let period=noise.night?'night':'day',currentData=noise[period],threshold=null;const noiseMeshes={};
 function acousticSurface(data){
  const group=new THREE.Group();if(!data)return group;
  const {width:w,height:h,values,extent}=data;
  const alphas=new Float32Array(w*h);
  const heights=new Float32Array(w*h),positions=new Float32Array(w*h*3),colors=new Float32Array(w*h*3),indices=[];
  for(let y=0;y<h;y++)for(let x=0;x<w;x++){
   const k=y*w+x;if(values[k]<0)continue;let sum=0,weight=0;
   for(let dy=-2;dy<=2;dy++)for(let dx=-2;dx<=2;dx++){const nx=x+dx,ny=y+dy;if(nx<0||ny<0||nx>=w||ny>=h)continue;const band=values[ny*w+nx];if(band<0)continue;const wt=Math.exp(-(dx*dx+dy*dy)/2.5);sum+=bandHeights[band]*wt;weight+=wt;}
   heights[k]=weight?sum/weight*1.18:0;alphas[k]=Math.max(0,Math.min(1,(heights[k]-18)/90));
   const p=project(extent.xmin+x/(w-1)*(extent.xmax-extent.xmin),extent.ymax-y/(h-1)*(extent.ymax-extent.ymin));positions.set([p.x,heights[k]+12,p.z],k*3);
   const color=palette[values[k]].clone();colors.set([color.r,color.g,color.b],k*3);
  }
  for(let y=0;y<h-1;y++)for(let x=0;x<w-1;x++){const a=y*w+x,b=a+1,c=a+w,d=c+1;if([a,b,c,d].every(k=>values[k]>=0)&&insideLand(positions[a*3],positions[a*3+2])&&Math.max(heights[a],heights[b],heights[c],heights[d])>20)indices.push(a,c,b,b,c,d);}
  const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.BufferAttribute(positions,3));geometry.setAttribute('color',new THREE.BufferAttribute(colors,3));geometry.setAttribute('surfaceAlpha',new THREE.BufferAttribute(alphas,1));geometry.setIndex(indices);geometry.computeVertexNormals();
  const surface=new THREE.Mesh(geometry,new THREE.MeshBasicMaterial({vertexColors:true,transparent:true,opacity:.39,side:THREE.DoubleSide,depthWrite:false,toneMapped:false,blending:THREE.NormalBlending}));surface.material.onBeforeCompile=shader=>{shader.vertexShader='attribute float surfaceAlpha; varying float vSurfaceAlpha;\n'+shader.vertexShader;shader.vertexShader=shader.vertexShader.replace('#include <begin_vertex>','#include <begin_vertex>\nvSurfaceAlpha=surfaceAlpha;');shader.fragmentShader='varying float vSurfaceAlpha;\n'+shader.fragmentShader;shader.fragmentShader=shader.fragmentShader.replace('#include <color_fragment>','#include <color_fragment>\ndiffuseColor.a *= vSurfaceAlpha;');};group.add(surface);
  // Contours expose the form without obscuring the street-level geography.
  const lines=[];
  const gridPoint=(x,y)=>new THREE.Vector3(positions[(y*w+x)*3],heights[y*w+x]+13,positions[(y*w+x)*3+2]);
  for(const level of [40,80,130,190,260,340,430,530,630]){
   for(let y=0;y<h-1;y++)for(let x=0;x<w-1;x++){
    const corners=[[x,y],[x+1,y],[x+1,y+1],[x,y+1]];
    if(corners.some(([xx,yy])=>values[yy*w+xx]<0)||!corners.some(([xx,yy])=>values[yy*w+xx]>=3)||!insideLand(positions[(y*w+x)*3],positions[(y*w+x)*3+2]))continue;
    const hits=[];for(let i=0;i<4;i++){const a=corners[i],b=corners[(i+1)%4],ha=heights[a[1]*w+a[0]],hb=heights[b[1]*w+b[0]];if((ha<level)===(hb<level))continue;const t=(level-ha)/(hb-ha);const p=gridPoint(...a).lerp(gridPoint(...b),t);p.y=level+13;hits.push(p);}
    for(let i=0;i+1<hits.length;i+=2)lines.push(...hits[i].toArray(),...hits[i+1].toArray());
   }
  }
  const contours=segments(lines,'#ffad68',.7,group);contours.material.color.multiplyScalar(1.35);
  group.userData={surface,data,baseColors:colors.slice()};noiseGroup.add(group);return group;
 }
 for(const key of ['day','night']){noiseMeshes[key]=acousticSurface(noise[key]);noiseMeshes[key].visible=key===period;}
 const ring=new THREE.Mesh(new THREE.RingGeometry(19,23,64),new THREE.MeshBasicMaterial({color:'#fff1c9',side:THREE.DoubleSide,transparent:true,opacity:.95,depthTest:false}));ring.rotation.x=-Math.PI/2;ring.renderOrder=10;scene.add(ring);
 const markerGeometry=new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(),new THREE.Vector3(0,220,0)]);const marker=new THREE.Line(markerGeometry,new THREE.LineBasicMaterial({color:'#fff0c5',transparent:true,opacity:.7,depthTest:false}));marker.renderOrder=10;scene.add(marker);
 const markerDot=new THREE.Mesh(new THREE.SphereGeometry(9,12,8),new THREE.MeshBasicMaterial({color:'#fff4d5',depthTest:false}));scene.add(markerDot);
 let selected={...zones.santa,zone:'santa'},runningMotion=motion,tour=false,tourStarted=0,viewTransition=null,elapsed=0,lastFrame=0,disposed=false,frame;
 function sample(lon,lat){if(!currentData)return null;const d=currentData,e=d.extent;const x=Math.round((lon-e.xmin)/(e.xmax-e.xmin)*(d.width-1)),y=Math.round((e.ymax-lat)/(e.ymax-e.ymin)*(d.height-1));if(x<0||y<0||x>=d.width||y>=d.height)return null;const band=d.values[y*d.width+x];return band<0?null:band;}
 function select(lon,lat,zone){selected={lon,lat,zone};const p=project(lon,lat),band=sample(lon,lat);ring.position.set(p.x,10,p.z);marker.position.set(p.x,10,p.z);marker.scale.y=band===null?.2:(bandHeights[band]+120)/220;markerDot.position.set(p.x,10+220*marker.scale.y,p.z);onSelect({lon,lat,zone,label:band===null?null:rangeLabels[band],band});}
 function stopTour(){if(tour){tour=false;onTourEnd?.();}}
 function selectZone(key,move=false){const z=zones[key];if(!z)return;select(z.lon,z.lat,key);if(move){stopTour();const p=project(z.lon,z.lat);startTransition(camera.position.clone().add(p.clone().sub(controls.target).multiplyScalar(.6)),p,1000);}}
 function startTransition(position,lookAt,duration=1600){viewTransition={from:camera.position.clone(),to:position,start:performance.now(),duration,targetFrom:controls.target.clone(),targetTo:lookAt};}
 function setPeriod(value){period=value;currentData=noise[period];Object.entries(noiseMeshes).forEach(([key,mesh])=>mesh.visible=key===period);select(selected.lon,selected.lat,selected.zone);setThreshold(threshold);}
 function setThreshold(value){threshold=value;for(const group of Object.values(noiseMeshes)){const {surface,data,baseColors}=group.userData;if(!surface)continue;const colors=surface.geometry.attributes.color;for(let i=0;i<data.values.length;i++){const factor=value===null||data.values[i]<0||upperBounds[data.values[i]]<=value?1:.12;for(let k=0;k<3;k++)colors.array[i*3+k]=baseColors[i*3+k]*factor;}colors.needsUpdate=true;}}
 function thresholdStats(value){if(!currentData)return null;const valid=currentData.values.filter(v=>v>=0);if(!valid.length)return null;return Math.round(valid.filter(v=>upperBounds[v]<=value).length/valid.length*100);}
 const raycaster=new THREE.Raycaster(),pointer=new THREE.Vector2(),ground=new THREE.Plane(new THREE.Vector3(0,1,0),0);let pointerStart;
 renderer.domElement.addEventListener('pointerdown',e=>{pointerStart={x:e.clientX,y:e.clientY};stopTour();viewTransition=null;});
 renderer.domElement.addEventListener('pointerup',e=>{if(!pointerStart||Math.hypot(e.clientX-pointerStart.x,e.clientY-pointerStart.y)>6)return;const r=renderer.domElement.getBoundingClientRect();pointer.set((e.clientX-r.left)/r.width*2-1,-(e.clientY-r.top)/r.height*2+1);raycaster.setFromCamera(pointer,camera);const p=new THREE.Vector3();if(raycaster.ray.intersectPlane(ground,p)){const geo=unproject(p);if(geo.lat>28.095&&geo.lat<28.18&&geo.lon>-15.46&&geo.lon<-15.39){let closest=null,d=Infinity;for(const [key,z]of Object.entries(zones)){const dd=p.distanceTo(project(z.lon,z.lat));if(dd<d){d=dd;closest=key;}}select(geo.lon,geo.lat,d<300?closest:undefined);}}});
 const labelsContainer=document.querySelector('.map-labels');const labels=Object.entries(zones).filter(([k])=>k!=='mesa').map(([key,z])=>{const el=document.createElement('span');el.className='place-label';el.textContent=z.name.toUpperCase();labelsContainer.append(el);return{el,p:project(z.lon,z.lat)};});
 const clock=new THREE.Clock();
 function render(now){if(disposed)return;frame=requestAnimationFrame(render);if(now-lastFrame<30)return;lastFrame=now;const delta=Math.min(clock.getDelta(),.1);if(runningMotion)elapsed+=delta;seaMaterial.uniforms.time.value=elapsed;
  if(viewTransition){const t=Math.min(1,(now-viewTransition.start)/viewTransition.duration),k=t*t*(3-2*t);camera.position.lerpVectors(viewTransition.from,viewTransition.to,k);controls.target.lerpVectors(viewTransition.targetFrom,viewTransition.targetTo,k);if(t===1)viewTransition=null;}
  if(tour){const progress=Math.min(1,(now-tourStarted)/30000),angle=-.84+progress*.92,radius=5200-progress*850;camera.position.set(Math.sin(angle)*radius,3000+Math.sin(progress*Math.PI)*350,Math.cos(angle)*radius);controls.target.set(0,0,350-progress*450);if(progress>=1){tour=false;onTourEnd?.();}}
  controls.update();
  for(let i=0;i<pulseCurves.length;i++){const p=pulseCurves[i].getPoint((elapsed*.055+i*.173)%1);pulseGeometry.attributes.position.setXYZ(i,p.x,10,p.z);}pulseGeometry.attributes.position.needsUpdate=true;
  ring.scale.setScalar(1+Math.sin(elapsed*1.8)*.09);
  composer.render();
  for(const label of labels){const p=label.p.clone();p.y=65;p.project(camera);const x=(p.x*.5+.5)*innerWidth,y=(-p.y*.5+.5)*innerHeight;label.el.style.transform=`translate(${x}px,${y}px)`;label.el.style.opacity=p.z<1&&x>260&&x<innerWidth-300&&y>165&&y<innerHeight-170?'.65':'0';}
 }
 function resize(){camera.aspect=innerWidth/innerHeight;camera.updateProjectionMatrix();renderer.setSize(innerWidth,innerHeight);renderer.setPixelRatio(Math.min(devicePixelRatio,1.7));composer.setSize(innerWidth,innerHeight);}
 addEventListener('resize',resize);selectZone('santa');frame=requestAnimationFrame(render);
 return {
  setPeriod,setThreshold,thresholdStats,selectZone,
  setLayer:(name,visible)=>({buildings,fibers,noise:noiseGroup}[name].visible=visible),
  setMotion:value=>{runningMotion=value;if(!value)stopTour();},
  setView:view=>{stopTour();startTransition(view==='aerial'?new THREE.Vector3(0,5700,-300):home.clone(),target.clone());},
  setTour:value=>{tour=value;viewTransition=null;if(value)tourStarted=performance.now();},
  stats:{buildingCount,roadCount},
  dispose:()=>{disposed=true;cancelAnimationFrame(frame);removeEventListener('resize',resize);controls.dispose();scene.traverse(o=>{o.geometry?.dispose();if(o.material){for(const m of [].concat(o.material))m.dispose();}});particleTexture.dispose();composer.dispose();renderer.dispose();renderer.domElement.remove();labels.forEach(l=>l.el.remove());}
 };
}
