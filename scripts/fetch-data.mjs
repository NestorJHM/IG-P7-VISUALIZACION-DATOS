import fs from 'node:fs/promises';
import path from 'node:path';
import { createRequire } from 'node:module';
let dependencies=process.env.SILENCIO_DEPS||path.resolve('node_modules');try{await fs.access(path.join(dependencies,'pngjs/package.json'));}catch{dependencies=path.join(process.env.TEMP||process.env.TMP||'/tmp','silencio-tools/node_modules');}const require=createRequire(path.join(dependencies,'../package.json'));
const { PNG } = require('pngjs');
const { XMLParser } = require('fast-xml-parser');
const bbox = [-15.448,28.105,-15.405,28.158];
await fs.mkdir('public/data', { recursive: true });
async function request(url, options = {}) {
 const r = await fetch(url, {...options, signal: AbortSignal.timeout(45000)});
 if (!r.ok) throw new Error(`${r.status}: ${url.slice(0,100)}`);
 return r;
}
const query = `[out:json][timeout:25];(way[building](28.105,-15.448,28.158,-15.405);way[highway][highway!~"footway|steps|path|service|track"](28.105,-15.448,28.158,-15.405);way[natural=coastline](28.105,-15.448,28.158,-15.405);way[natural=beach](28.105,-15.448,28.158,-15.405);way[leisure=park](28.105,-15.448,28.158,-15.405););out geom;`;
try {
 const raw = await Promise.any(['https://overpass-api.de/api/interpreter','https://overpass.private.coffee/api/interpreter','https://overpass.kumi.systems/api/interpreter'].map(async host=>{
  const response = await request(`${host}?data=${encodeURIComponent(query)}`);
  const json = await response.json(); if (!json.elements?.length) throw Error('Empty OSM'); return json;
 }));
 await fs.writeFile('public/data/city.json',JSON.stringify({source:'OpenStreetMap contributors',license:'ODbL-1.0',url:'https://www.openstreetmap.org/copyright',fetchedAt:new Date().toISOString(),bbox,elements:raw.elements.map(e=>({id:e.id,tags:e.tags,geometry:e.geometry}))}));
 console.log('OSM saved:',raw.elements.length);
} catch(e) { console.error('Overpass unavailable. Trying OSM map API.');
 const parser = new XMLParser({ignoreAttributes:false,attributeNamePrefix:''});
 const tiles = [[-15.448,28.105,-15.4265,28.1315],[-15.4265,28.105,-15.405,28.1315],[-15.448,28.1315,-15.4265,28.158],[-15.4265,28.1315,-15.405,28.158]];
 const nodes = new Map(), ways = new Map();let previous=[];try{previous=JSON.parse(await fs.readFile('public/data/city.json','utf8')).elements;}catch{}
 const successfulTiles=[],failedTiles=[];
 for (const tile of tiles) {
  try {
   const r=await request(`https://api.openstreetmap.org/api/0.6/map?bbox=${tile.join(',')}`);
   const raw=parser.parse(await r.text()).osm;successfulTiles.push(tile);
   for(const n of [].concat(raw.node||[])) nodes.set(n.id,{lat:+n.lat,lon:+n.lon});
   for(const w of [].concat(raw.way||[])) ways.set(w.id,w);
  } catch(e) {failedTiles.push(tile);console.error('Tile:',e.message);}
 }
 const elements=[...previous];const known=new Set(elements.map(e=>String(e.id)));
 for(const w of ways.values()) {
  const tags=Object.fromEntries([].concat(w.tag||[]).map(t=>[t.k,t.v]));
  if(!tags.building&&!tags.highway&&tags.natural!=='coastline'&&tags.natural!=='beach'&&tags.leisure!=='park')continue;
  const geometry=[].concat(w.nd||[]).map(n=>nodes.get(n.ref));
  if(geometry.length>1&&geometry.every(Boolean)&&!known.has(String(w.id))) elements.push({id:w.id,tags,geometry});
 }
 if(elements.length) {await fs.writeFile('public/data/city.json',JSON.stringify({source:'OpenStreetMap contributors',license:'ODbL-1.0',url:'https://www.openstreetmap.org/copyright',fetchedAt:new Date().toISOString(),bbox,elements,successfulTiles,failedTiles,coverageNote:'Las teselas fallidas pueden implicar cobertura parcial. Se conserva la instantánea anterior cuando existe.'}));console.log('OSM saved:',elements.length);}
 else throw Error('No city data could be acquired');
}
const root='https://sit.laspalmasgc.es/server/rest/services/Medioambiente___Mapa_de_Ruido/MapServer';
const legends=await (await request(`${root}/legend?f=json`)).json();
for(const [period,layer] of [['day',16],['night',18]]) {
 try {
  const legend=legends.layers.find(l=>l.layerId===layer).legend.map(l=>{
   const image=PNG.sync.read(Buffer.from(l.imageData,'base64'));const i=(10*image.width+10)*4;
   return {label:l.label,rgb:[...image.data.subarray(i,i+3)]};
  });
  const p=new URLSearchParams({f:'json',bbox:bbox.join(','),bboxSR:'4326',imageSR:'4326',size:'320,448',format:'png32',transparent:'true',layers:`show:${layer}`,dpi:'96'});
  const exported=await(await request(`${root}/export?${p}`)).json();
  if(!exported.href)throw Error(JSON.stringify(exported));
  const png=Buffer.from(await(await request(exported.href)).arrayBuffer());
  await fs.writeFile(`public/data/noise-${period}.png`,png);
  const image=PNG.sync.read(png), values=[];
  for(let y=0;y<image.height;y+=4)for(let x=0;x<image.width;x+=4){
   const i=(y*image.width+x)*4;const pixel=[...image.data.subarray(i,i+3)];
   const distances=legend.map(l=>l.rgb.reduce((s,c,k)=>s+(c-pixel[k])**2,0));
   const min=Math.min(...distances); values.push(image.data[i+3]<240||min>1600?-1:distances.indexOf(min));
  }
  const data={source:'Ayuntamiento de Las Palmas de Gran Canaria · SIT',url:`${root}/${layer}`,fetchedAt:new Date().toISOString(),referenceDate:null,notice:'Fecha del estudio no publicada en los metadatos consultados. No es una medición en tiempo real. Comprobar condiciones de reutilización municipal.',layer,indicator:period==='day'?'Ld':'Ln',imageExtent:exported.extent,extent:{...exported.extent,xmin:exported.extent.xmin+.5/image.width*(exported.extent.xmax-exported.extent.xmin),xmax:exported.extent.xmin+(image.width-3.5)/image.width*(exported.extent.xmax-exported.extent.xmin),ymax:exported.extent.ymax-.5/image.height*(exported.extent.ymax-exported.extent.ymin),ymin:exported.extent.ymax-(image.height-3.5)/image.height*(exported.extent.ymax-exported.extent.ymin)},width:Math.ceil(image.width/4),height:Math.ceil(image.height/4),legend,values,method:'Clasificación de píxeles interiores por la leyenda oficial. Muestreo cada 4 píxeles; se descartan transparencia y colores ambiguos. Altura suavizada solo para representación.'};
  await fs.writeFile(`public/data/noise-${period}.json`,JSON.stringify(data));
  console.log('Noise saved:',period,values.filter(v=>v>=0).length,'valid samples /',values.length,JSON.stringify(legend));
 } catch(e) {console.error('Noise:',period,e.message);}
}
