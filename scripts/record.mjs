import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { createRequire } from 'node:module';
import { spawnSync } from 'node:child_process';
const deps=process.env.SILENCIO_DEPS||path.join(process.env.TEMP||os.tmpdir(),'silencio-tools/node_modules');
const require=createRequire(path.join(deps,'../package.json'));const{chromium}=require('playwright');
await fs.mkdir('docs',{recursive:true});
const temporary=await fs.mkdtemp(path.join(os.tmpdir(),'silencio-video-'));
const browser=await chromium.launch({channel:'chrome',headless:true,args:['--enable-webgl','--ignore-gpu-blocklist','--enable-unsafe-swiftshader']});
try{
 const context=await browser.newContext({viewport:{width:1440,height:900},deviceScaleFactor:1,recordVideo:{dir:temporary,size:{width:1440,height:900}}});
 const page=await context.newPage();const started=Date.now();
 await page.goto('http://127.0.0.1:4173/',{waitUntil:'networkidle'});await page.waitForSelector('html[data-ready="true"]',{state:'attached',timeout:45000});await page.waitForTimeout(1500);
 await page.screenshot({path:'docs/vista-desktop.png'});
 const offset=(Date.now()-started)/1000;await page.locator('#tour').click();console.log('Grabando recorrido de 30 segundos…');
 await page.waitForTimeout(30500);const raw=await page.video().path();await context.close();
 const result=spawnSync('ffmpeg',['-y','-ss',String(offset),'-i',raw,'-t','30','-an','-c:v','libx264','-preset','fast','-crf','23','-pix_fmt','yuv420p','-movflags','+faststart',path.resolve('docs/demo.mp4')],{windowsHide:true,encoding:'utf8'});
 if(result.status!==0){await fs.writeFile('docs/demo.webm',await fs.readFile(raw));console.log('MP4 no disponible; vídeo WebM guardado.',result.error?.message||result.stderr.slice(-500));}else console.log('Vídeo guardado: docs/demo.mp4');
 const mobile=await browser.newPage({viewport:{width:390,height:844},deviceScaleFactor:1});await mobile.goto('http://127.0.0.1:4173/',{waitUntil:'networkidle'});await mobile.waitForSelector('html[data-ready="true"]',{state:'attached'});await mobile.waitForTimeout(1000);await mobile.screenshot({path:'docs/vista-mobile.png'});await mobile.close();
}finally{await browser.close();}
