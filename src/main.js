import './style.css';
import { createCity } from './scene.js';

const icons = {
 orbit: '<svg viewBox="0 0 24 24"><ellipse cx="12" cy="12" rx="10" ry="4" transform="rotate(-35 12 12)"/><circle cx="12" cy="12" r="3"/></svg>',
 aerial: '<svg viewBox="0 0 24 24"><path d="m12 3 9 5-9 5-9-5Z M3 12l9 5 9-5 M3 16l9 5 9-5"/></svg>',
 pause: '<svg viewBox="0 0 24 24"><path d="M8 5v14M16 5v14"/></svg>',
 sound: '<svg viewBox="0 0 24 24"><path d="m11 5-6 5H2v4h3l6 5V5Z M16 9l6 6m0-6-6 6"/></svg>',
 arrow: '<svg viewBox="0 0 24 24"><path d="M4 12h16m-6-6 6 6-6 6"/></svg>',
 info: '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="9"/><path d="M12 10v7m0-11v1"/></svg>',
 close: '<svg viewBox="0 0 24 24"><path d="m6 6 12 12M18 6 6 18"/></svg>'
};
const $ = s => document.querySelector(s);
const state = { period: 'night', motion: !matchMedia('(prefers-reduced-motion: reduce)').matches, sound: false, tour: false };
document.querySelector('#app').innerHTML = `
<main class="experience">
 <div id="scene" role="img" aria-label="Mapa tridimensional interactivo de Las Palmas de Gran Canaria. Arrastra para girar; usa la rueda para acercarte. También puedes seleccionar lugares con el menú de zonas."></div>
 <div class="vignette" aria-hidden="true"></div>
 <header class="masthead">
  <div class="identity"><div class="eyebrow"><span class="status-dot"></span> CARTOGRAFÍA DE LO INVISIBLE <span class="edition">VOL. 01</span></div><h1>SILENCIO<sup>TM</sup></h1><p>La ciudad como sistema nervioso</p><span class="identity-rule"></span></div>
  <div class="location"><span class="location-name">LAS PALMAS DE GRAN CANARIA</span><span class="location-divider"></span><div class="period-toggle" role="group" aria-label="Periodo acústico"><button data-period="day" aria-pressed="false">Día</button><button data-period="night" class="selected" aria-pressed="true">Noche</button></div></div>
 </header>
 <aside class="layers glass" aria-label="Capas de visualización">
  <div class="panel-heading"><span>CAPAS</span><span class="small-index">01—03</span></div>
  <label class="layer-row"><span>Tejido urbano</span><input id="buildings" type="checkbox" checked role="switch"/><span class="switch" aria-hidden="true"></span></label>
  <label class="layer-row"><span>Fibras urbanas</span><input id="fibers" type="checkbox" checked role="switch"/><span class="switch" aria-hidden="true"></span></label>
  <label class="layer-row"><span id="noise-layer-name">Ruido nocturno</span><input id="noise" type="checkbox" checked role="switch"/><span class="switch" aria-hidden="true"></span></label>
  <div class="layer-note">El ruido también<br/>ocupa espacio.</div>
  <button id="sources" class="text-button">${icons.info} Datos y lectura</button>
 </aside>
 <div class="map-labels" aria-hidden="true"></div>
 <aside class="inspector glass" aria-label="Información de la zona seleccionada" aria-live="polite">
  <div class="panel-heading"><span>ZONA SELECCIONADA</span><span class="target-icon">⌖</span></div>
  <label class="sr-only" for="zone">Elegir zona</label><select id="zone"><option value="mesa">Mesa y López</option><option value="canteras">Las Canteras</option><option value="santa">Santa Catalina</option><option value="alcaravaneras">Alcaravaneras</option><option value="isleta">La Isleta</option></select>
  <div class="reading" id="reading">—<span>dB</span></div><div class="reading-note" id="reading-note">Preparando cartografía</div>
  <div class="legend"><div class="legend-title">Ruido nocturno · Ln · dB</div><div class="legend-scale"><div class="legend-gradient"></div><div class="legend-ticks"><span>≥ 75</span><span>65</span><span>55</span><span>&lt; 50</span></div><div class="legend-caption">Mayor nivel<br/><span>↕</span><br/>Menor nivel</div></div></div>
  <div class="coordinates" id="coordinates">28.1267° N · 15.4350° O</div>
 </aside>
 <div class="sea-caption" aria-hidden="true">OCÉANO ATLÁNTICO<span>28° 08′ N &nbsp; 15° 26′ O</span></div>
 <div class="map-help"><span class="mouse-icon">↔</span> ARRASTRA PARA EXPLORAR <span>·</span> RUEDA PARA ACERCAR</div>
 <footer class="bottom-bar"><div class="data-status"><span class="status-dot"></span><span id="data-status">CARGANDO DATOS GEOGRÁFICOS</span><button id="credits" aria-label="Ver fuentes y metodología">${icons.info}</button></div><div class="toolbar"><nav aria-label="Controles de la escena"><button id="explore" class="tool active" aria-pressed="true">${icons.orbit}<span>Explorar</span></button><button id="aerial" class="tool" aria-pressed="false">${icons.aerial}<span>Vista aérea</span></button><span class="tool-divider"></span><button id="motion" class="tool" aria-pressed="${state.motion}">${icons.pause}<span>${state.motion?'Pausar movimiento':'Activar movimiento'}</span></button><button id="sound" class="tool" aria-pressed="false">${icons.sound}<span>Sonido desactivado</span></button><button id="tour" class="tool"><span class="tour-dot"></span><span>Recorrido · 30 s</span></button></nav><button id="adapt" class="adapt-button">¿Y si adaptáramos la ciudad? ${icons.arrow}</button></div><div class="attribution">© OpenStreetMap contributors · ODbL <span>ALTURA ACÚSTICA EXAGERADA PARA SU LECTURA</span></div></footer>
 <div class="loading" id="loading"><span class="loader-orbit"></span><p>Reconstruyendo el tejido urbano</p><small>Geografía abierta. Una nueva forma de mirar.</small></div>
 <div class="toast" role="status" id="toast"></div>
 <dialog id="about" class="modal"><button class="close-modal" aria-label="Cerrar">${icons.close}</button><div class="eyebrow">SILENCIO / CUADERNO DE CAMPO</div><h2>Hacer visible<br/>lo que nos atraviesa.</h2><p>Una ciudad también se define por los estímulos que exige soportar. Esta visualización convierte el ruido cartografiado en un paisaje que podemos explorar.</p><div class="source-block"><h3>01 / Geografía</h3><p>Edificios, calles y costa de <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">OpenStreetMap</a>. Las alturas usan las etiquetas disponibles; cuando faltan se aplica una altura ilustrativa determinista.</p><h3>02 / Acústica</h3><p id="acoustic-source">Consultando disponibilidad del servicio municipal.</p><h3>03 / Cómo leer el organismo</h3><p>El color y la altura representan bandas acústicas. La superficie está suavizada por razones visuales; al seleccionar un punto se muestra la banda original muestreada. Sin cobertura significa <strong>sin datos</strong>, no silencio. Las fibras siguen calles reales; sus pulsos son una metáfora visual, no tráfico medido.</p><p>El sonido es una sonificación artística opcional, no una grabación ni una reproducción calibrada de los decibelios. No representa una experiencia neurodivergente universal.</p></div><div class="modal-foot" id="source-date"></div></dialog>
 <dialog id="adapt-dialog" class="modal manifesto"><button class="close-modal" aria-label="Cerrar">${icons.close}</button><div class="eyebrow">UN ESPACIO PARA PENSAR</div><h2>¿Y si el problema<br/>no fuera sentir?</h2><p>Elige un umbral de exploración y observa qué parte de la cartografía disponible queda por debajo. Es una preferencia personal, no un diagnóstico ni una recomendación sanitaria.</p><label for="threshold">Mostrar bandas por debajo de <strong id="threshold-label">60 dB</strong></label><input type="range" id="threshold" min="50" max="75" value="60" step="5"/><div class="range-labels"><span>50 dB</span><span>75 dB</span></div><p class="threshold-result" id="threshold-result"></p><p class="manifesto-end">La sensibilidad no debería ser<br/>una barrera para habitar la ciudad.</p><button id="show-quiet" class="primary-button">Explorar esta lectura ${icons.arrow}</button></dialog>
</main>`;
let city, audio, toastTimer, ready = false;
function toast(message) { $('#toast').textContent=message;$('#toast').classList.add('visible');clearTimeout(toastTimer);toastTimer=setTimeout(()=>$('#toast').classList.remove('visible'),4500); }
function reading(selection) {
 $('#reading').innerHTML=selection.label?`${selection.label}<span>dB</span>`:'—';
 $('#reading-note').textContent=selection.label?'Banda del mapa acústico · sin tiempo real':'Sin datos acústicos en este punto';
 $('#coordinates').textContent=`${selection.lat.toFixed(4)}° N · ${Math.abs(selection.lon).toFixed(4)}° O`;
 if(selection.zone) $('#zone').value=selection.zone;
 if(audio) audio.gain.gain.setTargetAtTime(state.sound?0.018:0,audio.context.currentTime,.6);
}
async function loadJSON(file, optional=false) {
 const response=await fetch(`${import.meta.env.BASE_URL}data/${file}`);
 if(!response.ok) {if(optional)return null;throw Error(`No se pudo cargar ${file}`);}
 try{return await response.json();}catch(e){if(optional)return null;throw e;}
}
try {
 const [geography,day,night] = await Promise.all([loadJSON('city.json'),loadJSON('noise-day.json',true),loadJSON('noise-night.json',true)]);
 city = createCity($('#scene'),{geography,noise:{day,night},motion:state.motion,onSelect:reading,onTourEnd:()=>{state.tour=false;$('#tour').classList.remove('active');$('#tour').setAttribute('aria-pressed','false');toast('Recorrido terminado. Vuelve a explorar.');}});
 ready=true; document.documentElement.dataset.ready='true';
 const actual=night||day;
 if(!night&&day){state.period='day';updatePeriod('day');}
 if(actual){
  $('#data-status').textContent='CARTOGRAFÍA OSM + BANDAS ACÚSTICAS MUNICIPALES';
  $('#acoustic-source').innerHTML=`Bandas de los indicadores Ld (día) y Ln (noche), obtenidas del <a href="https://sit.laspalmasgc.es/server/rest/services/Medioambiente___Mapa_de_Ruido/MapServer" target="_blank" rel="noreferrer">servicio cartográfico del Ayuntamiento de Las Palmas de Gran Canaria</a>. Se clasifican los colores del ráster con su leyenda oficial y se descartan píxeles ambiguos. La fecha del estudio no figura en los metadatos consultados; no se atribuye a una fase concreta. Las condiciones específicas de reutilización municipal deben verificarse antes de una publicación externa.`;
 }else{
  $('#data-status').textContent='GEOGRAFÍA REAL OSM · CAPA ACÚSTICA NO DISPONIBLE';
  $('#acoustic-source').textContent='No hay datos acústicos locales disponibles. La escena no inventa decibelios. Usa npm run data:refresh para volver a intentar la descarga del servicio municipal.';
 }
 $('#source-date').textContent=`Cartografía descargada: ${new Date(geography.fetchedAt).toLocaleDateString('es-ES')}${actual?` · Acústica descargada: ${new Date(actual.fetchedAt).toLocaleDateString('es-ES')}`:''}. La fecha de descarga no es la fecha del estudio.`;
 for(const b of document.querySelectorAll('[data-period]')) if(!(b.dataset.period==='day'?day:night)){b.disabled=true;b.title='Datos no disponibles';}
 $('#loading').classList.add('finished');setTimeout(()=>$('#loading').remove(),700);
} catch(error) {
 console.error(error);$('#loading').innerHTML='<p>No se ha podido reconstruir la ciudad.</p><small>Comprueba los archivos de public/data y ejecuta npm run data:refresh.</small><button class="primary-button" onclick="location.reload()">Reintentar</button>';
 $('#data-status').textContent='CARTOGRAFÍA NO DISPONIBLE';
}
function updatePeriod(period) {
 if(!ready)return;state.period=period;city.setPeriod(period);
 document.querySelectorAll('[data-period]').forEach(b=>{const active=b.dataset.period===period;b.classList.toggle('selected',active);b.setAttribute('aria-pressed',active);});
 $('#noise-layer-name').textContent=period==='night'?'Ruido nocturno':'Ruido diurno';
 $('.legend-title').textContent=period==='night'?'Ruido nocturno · Ln · dB':'Ruido diurno · Ld · dB';
}
document.querySelectorAll('[data-period]').forEach(b=>b.addEventListener('click',()=>updatePeriod(b.dataset.period)));
for(const layer of ['buildings','fibers','noise']) $(`#${layer}`).addEventListener('change',e=>city?.setLayer(layer,e.target.checked));
$('#zone').addEventListener('change',e=>city?.selectZone(e.target.value,true));
function setView(view) {city?.setView(view);for(const id of ['explore','aerial']){$(`#${id}`).classList.toggle('active',id===view);$(`#${id}`).setAttribute('aria-pressed',id===view);}}
$('#explore').onclick=()=>setView('explore');$('#aerial').onclick=()=>setView('aerial');
$('#motion').onclick=()=>{state.motion=!state.motion;city?.setMotion(state.motion);$('#motion').setAttribute('aria-pressed',state.motion);$('#motion span').textContent=state.motion?'Pausar movimiento':'Activar movimiento';};
$('#tour').setAttribute('aria-pressed','false');
$('#tour').onclick=()=>{if(!city)return;state.tour=!state.tour;city.setTour(state.tour);$('#tour').classList.toggle('active',state.tour);$('#tour').setAttribute('aria-pressed',state.tour);toast(state.tour?'Recorrido de 30 segundos. Arrastra para detenerlo.':'Recorrido detenido.');};
$('#sound').onclick=async()=>{
 if(!ready)return;
 try {
  if(!audio){
   const context=new AudioContext();const buffer=context.createBuffer(1,context.sampleRate*2,context.sampleRate);const data=buffer.getChannelData(0);let previous=0;
   for(let i=0;i<data.length;i++){previous=(previous+Math.random()*.04-.02)/1.02;data[i]=previous*3.5;}
   const source=context.createBufferSource();source.buffer=buffer;source.loop=true;const filter=context.createBiquadFilter();filter.type='lowpass';filter.frequency.value=280;const gain=context.createGain();gain.gain.value=0;source.connect(filter).connect(gain).connect(context.destination);source.start();audio={context,gain};
  }
  await audio.context.resume();state.sound=!state.sound;audio.gain.gain.setTargetAtTime(state.sound?.018:0,audio.context.currentTime,.6);$('#sound').setAttribute('aria-pressed',state.sound);$('#sound span').textContent=state.sound?'Sonido activado':'Sonido desactivado';
  if(state.sound)toast('Sonificación artística a volumen bajo. No reproduce los dB del mapa.');
 }catch{toast('El navegador no permite iniciar el audio.');}
};
function openDialog(id){$(id).showModal();}
$('#sources').onclick=$('#credits').onclick=()=>openDialog('#about');
$('#adapt').onclick=()=>{updateThreshold();openDialog('#adapt-dialog');};
document.querySelectorAll('.close-modal').forEach(b=>b.onclick=()=>b.closest('dialog').close());
document.querySelectorAll('dialog').forEach(d=>d.addEventListener('click',e=>{if(e.target===d){const r=d.getBoundingClientRect();if(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom)d.close();}}));
function updateThreshold(){const v=+$('#threshold').value;$('#threshold-label').textContent=`${v} dB`;const stats=city?.thresholdStats(v);$('#threshold-result').textContent=stats===null||stats===undefined?'Sin cobertura acústica disponible.':`${stats}% de las muestras con datos tienen una banda completamente inferior a ${v} dB. No es un porcentaje de población.`;}
$('#threshold').oninput=updateThreshold;
$('#show-quiet').onclick=()=>{city?.setThreshold(+$('#threshold').value);$('#adapt-dialog').close();toast('Lectura activada: las bandas por encima del umbral pierden intensidad. Pulsa Esc para restablecer.');};
window.addEventListener('keydown',e=>{if(document.querySelector('dialog[open]')||['INPUT','SELECT','TEXTAREA','BUTTON'].includes(document.activeElement.tagName))return;if(e.key==='Escape')city?.setThreshold(null);if(e.code==='Space'){e.preventDefault();$('#motion').click();}});
window.addEventListener('pagehide',()=>{audio?.context.close();city?.dispose();});
