import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { pathToFileURL } from 'node:url';
const candidates=[process.env.SILENCIO_DEPS,path.resolve('node_modules'),path.join(process.env.TEMP||process.env.TMP||'/tmp','silencio-tools/node_modules')].filter(Boolean);
let tools;
for(const candidate of candidates){try{await fs.access(path.join(candidate,'vite/dist/node/index.js'));await fs.access(path.join(candidate,'three/build/three.module.js'));tools=candidate;break;}catch{}}
if(!tools){console.error('Faltan dependencias. Ejecuta npm install. Si Google Drive impide la instalación, consulta el README.');process.exit(1);}
process.env.SILENCIO_DEPS=tools;
const vite=await import(pathToFileURL(path.join(tools,'vite/dist/node/index.js')));
const task=process.argv[2]||'dev';
if(task==='build') {
 const temporary=await fs.mkdtemp(path.join(os.tmpdir(),'silencio-build-'));
 await vite.build({configLoader:'native',build:{outDir:temporary,emptyOutDir:false}});
 async function copy(source,target){try{await fs.mkdir(target,{recursive:true});}catch(e){if(e.code!=='EEXIST')throw e;}for(const item of await fs.readdir(source,{withFileTypes:true})){const from=path.join(source,item.name),to=path.join(target,item.name);if(item.isDirectory())await copy(from,to);else await fs.writeFile(to,await fs.readFile(from));}}
 await copy(temporary,path.resolve('build'));console.log('Compilación copiada a build/');
}
else if(task==='preview'){const server=await vite.preview({configLoader:'native',preview:{host:'127.0.0.1',port:4173,strictPort:true}});server.printUrls();}
else{const server=await vite.createServer({configLoader:'native',server:{host:'127.0.0.1',port:5173,strictPort:true}});await server.listen();server.printUrls();}
