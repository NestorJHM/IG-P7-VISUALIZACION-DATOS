import './style.css';
import { createCity } from './scene.js';
import { loadTerrain } from './terrain.js';
import { formatTime, advanceTime } from './simulation.js';

const icons = {
  play: '<path d="m9 5 11 7-11 7Z"/>',
  pause: '<path d="M8 5v14M16 5v14"/>',
  loop: '<path d="m17 2 4 4-4 4M3 11V8a2 2 0 0 1 2-2h16M7 22l-4-4 4-4m14-1v3a2 2 0 0 1-2 2H3"/>',
  aerial: '<path d="m12 3 9 5-9 5-9-5Z M3 12l9 5 9-5 M3 16l9 5 9-5"/>',
  expand: '<path d="M9 3H3v6m12-6h6v6M3 15v6h6m6 0h6v-6"/>',
  close: '<path d="m6 6 12 12M18 6 6 18"/>',
};
const svg = (key) => `<svg viewBox="0 0 24 24" aria-hidden="true">${icons[key]}</svg>`;
const $ = (selector) => document.querySelector(selector);
const state = { minute: 420, playing: false, speed: 1, loop: false, mapOnly: false, aerial: false };
$('#app').innerHTML = `<main class="experience">
 <div id="scene" role="img" aria-label="Mapa 3D de Las Palmas de Gran Canaria con bandas de ruido. "></div>
 <div class="map-attribution"><a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener noreferrer">© OpenStreetMap</a> · <a href="https://pnoa.ign.es/web/portal/pnoa-imagen/ortofotos-pnoa-maxima-actualidad" target="_blank" rel="noopener noreferrer">Ortofoto PNOA © SCNE</a></div>
 <header class="identity"><h1>SILENCIO</h1><p>Busca la tranquilidad</p></header>

 <aside class="layers map-panel" aria-labelledby="layers-title">
  <div class="panel-heading"><h2 id="layers-title">Capas</h2><output id="layer-count" aria-label="Capas visibles">03 / 03</output></div>
  <div class="layer-controls">
   <label class="layer-row" for="layer-buildings"><span>Edificios</span><button id="layer-buildings" type="button" role="switch" aria-checked="true" aria-label="Edificios" data-layer="buildings" disabled><span></span></button></label>
   <label class="layer-row" for="layer-fibers"><span>Calles</span><button id="layer-fibers" type="button" role="switch" aria-checked="true" aria-label="Calles" data-layer="fibers" disabled><span></span></button></label>
   <label class="layer-row" for="layer-noise"><span>Ruido ambiental</span><button id="layer-noise" type="button" role="switch" aria-checked="true" aria-label="Ruido ambiental" data-layer="noise" disabled><span></span></button></label>
  </div>
  <p class="layer-message">El ruido también<br>ocupa espacio.</p>
  <details class="data-info"><summary><span aria-hidden="true">ⓘ</span> Datos y licencia</summary><div>
   <p>Edificios y calles: <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener noreferrer">OpenStreetMap · ODbL</a>.</p>
   <p>Ortofoto: <a href="https://www.ign.es/resources/licencia/Condiciones_licenciaUso_IGN.pdf" target="_blank" rel="noopener noreferrer">PNOA / SCNE · CC BY 4.0</a>.</p>
   <p>Ruido: <a href="https://sit.laspalmasgc.es/server/rest/services/Medioambiente___Mapa_de_Ruido/MapServer" target="_blank" rel="noopener noreferrer">Ayuntamiento de Las Palmas de Gran Canaria</a>. Evolución horaria simulada; sin medición en tiempo real.</p>
  </div></details>
 </aside>
 <aside class="inspector map-panel" aria-labelledby="selection-title">
  <div class="panel-heading"><h2 id="selection-title">Zona seleccionada</h2><span class="selection-symbol" aria-hidden="true">⌖</span></div>
  <select id="zone" aria-label="Elegir zona"><option value="mesa">Mesa y López</option><option value="canteras">Las Canteras</option><option value="santa" selected>Santa Catalina</option><option value="alcaravaneras">Alcaravaneras</option><option value="isleta">La Isleta</option><option value="point" hidden>Punto del mapa</option></select>
  <div class="reading-line"><output id="reading" aria-label="Nivel de ruido">—</output><span id="reading-unit">dB</span></div>
  <p id="reading-note" class="reading-note">Estimación del mapa acústico · simulación</p>
  <section class="noise-legend" aria-label="Escala de ruido ambiental">
   <h3>Ruido ambiental <span>· dB</span></h3>
   <div class="legend-scale"><div class="legend-gradient" aria-hidden="true"></div><div class="legend-ticks"><span>≥ 75</span><span>70</span><span>65</span><span>60</span><span>55</span><span>50</span><span>&lt; 50</span></div><div class="legend-height"><span>Mayor nivel</span><span class="height-arrow" aria-hidden="true">↕</span><span>Menor nivel</span></div></div>
  </section>
  <p id="coordinates" class="coordinates">—</p>
  <p id="geography-stats" class="geography-stats"></p>
 </aside>
 <footer class="dock" aria-label="Controles del mapa">
  <section class="timeline">
   <button id="play" aria-label="Reproducir" title="Reproducir / pausar" aria-pressed="false" disabled>${svg('play')}</button>
   <button id="loop" aria-label="Repetir en bucle" title="Repetir en bucle" aria-pressed="false" disabled>${svg('loop')}</button>
   <select id="speed" aria-label="Velocidad de reproducción" title="Velocidad de reproducción" disabled><option value="1">x1</option><option value="4">x4</option><option value="8">x8</option></select>
   <output id="time-label" for="time">07:00</output>
   <div class="time-track"><input id="time" type="range" min="420" max="1439" step="1" value="780" aria-label="Hora de la simulación" aria-valuetext="07:00" disabled/><div class="time-limits" aria-hidden="true"><span>07:00</span><span>23:59</span></div></div>
  </section>
  <nav class="view-controls" aria-label="Vista del mapa"><button id="aerial" aria-label="Vista aérea" title="Vista aérea" aria-pressed="false">${svg('aerial')}</button><button id="map-only" aria-label="Mostrar solo mapa" title="Solo mapa · Esc para volver" aria-pressed="false">${svg('expand')}</button></nav>
 </footer>
 <button id="exit-map" aria-label="Volver a los controles" title="Volver · Esc">${svg('close')}</button>
 <div id="loading" class="loading" role="status" aria-label="Cargando mapa"><span></span></div>
</main>`;
let city,
  ready = false,
  frame,
  previousTime,
  lastUpdate = 0;
function reading(selection) {
  $('#reading').textContent = selection.label || '—';
  $('#reading').setAttribute(
    'aria-label',
    selection.label
      ? `Nivel ${selection.simulated ? 'simulado' : 'del mapa'} ${selection.label} decibelios`
      : 'Sin datos acústicos en este punto'
  );
  $('#reading-unit').hidden = !selection.label;
  $('#reading-note').textContent = !selection.label
    ? 'Sin datos acústicos en este punto'
    : selection.simulated
      ? 'Estimación del mapa acústico · simulación'
      : 'Banda del mapa acústico · sin tiempo real';
  $('#zone').value = selection.zone || 'point';
  $('#coordinates').textContent =
    `${Math.abs(selection.lat).toFixed(4)}° ${selection.lat >= 0 ? 'N' : 'S'} · ${Math.abs(selection.lon).toFixed(4)}° ${selection.lon >= 0 ? 'E' : 'O'}`;
}
function updateTime(minute) {
  state.minute = minute;
  const rounded = Math.round(minute),
    time = formatTime(rounded);
  $('#time').value = rounded;
  $('#time-label').textContent = time;
  $('#time').setAttribute('aria-valuetext', time);
  if (ready) city.setTime(rounded);
}
function setPlaying(value) {
  state.playing = value;
  previousTime = undefined;
  $('#play').innerHTML = svg(value ? 'pause' : 'play');
  $('#play').setAttribute('aria-label', value ? 'Pausar' : 'Reproducir');
  $('#play').setAttribute('aria-pressed', value);
}
function tick(now) {
  frame = requestAnimationFrame(tick);
  if (!state.playing || document.hidden) {
    previousTime = undefined;
    return;
  }
  if (previousTime === undefined) {
    previousTime = now;
    return;
  }
  const delta = (now - previousTime) / 1000;
  previousTime = now;
  const next = advanceTime(state.minute, delta * state.speed, state.loop);
  state.minute = next.minute;
  if (now - lastUpdate >= 100 || next.ended) {
    lastUpdate = now;
    updateTime(next.minute);
  }
  if (next.ended) setPlaying(false);
}
$('#play').onclick = () => {
  if (!ready) return;
  if (!state.playing && state.minute >= 1439) updateTime(420);
  setPlaying(!state.playing);
};
$('#loop').onclick = () => {
  state.loop = !state.loop;
  $('#loop').setAttribute('aria-pressed', state.loop);
};
$('#speed').onchange = () => {
  state.speed = +$('#speed').value;
  previousTime = undefined;
};
$('#time').oninput = () => {
  previousTime = undefined;
  updateTime(+$('#time').value);
};
for (const button of document.querySelectorAll('[data-layer]'))
  button.onclick = () => {
    const visible = button.getAttribute('aria-checked') !== 'true';
    button.setAttribute('aria-checked', String(visible));
    city?.setLayer(button.dataset.layer, visible);
    const active = document.querySelectorAll('[data-layer][aria-checked="true"]').length;
    $('#layer-count').textContent = String(active).padStart(2, '0') + ' / 03';
  };
$('#zone').onchange = () => city?.selectZone($('#zone').value, true);
$('#aerial').onclick = () => {
  state.aerial = !state.aerial;
  city?.setView(state.aerial ? 'aerial' : 'explore');
  $('#aerial').setAttribute('aria-pressed', state.aerial);
  $('#aerial').setAttribute('aria-label', state.aerial ? 'Vista oblicua' : 'Vista aérea');
};
function setMapOnly(value) {
  state.mapOnly = value;
  document.body.classList.toggle('map-only', value);
  city?.setMapOnly(value);
  $('#map-only').setAttribute('aria-pressed', value);
  (value ? $('#exit-map') : $('#map-only')).focus();
}
$('#map-only').onclick = () => setMapOnly(true);
$('#exit-map').onclick = () => setMapOnly(false);
window.addEventListener('keydown', (e) => {
  if (e.key === 'Escape' && state.mapOnly) {
    setMapOnly(false);
    return;
  }
  if (
    e.code === 'Space' &&
    !['INPUT', 'SELECT', 'BUTTON'].includes(document.activeElement.tagName)
  ) {
    e.preventDefault();
    $('#play').click();
  }
});
async function load(file) {
  const r = await fetch(`${import.meta.env.BASE_URL}data/${file}`);
  if (!r.ok) throw Error(file);
  return r.json();
}
try {
  const [geography, day, evening, night, terrain] = await Promise.all([
    ...['city', 'noise-day', 'noise-evening', 'noise-night'].map((name) => load(`${name}.json`)),
    loadTerrain(import.meta.env.BASE_URL),
  ]);
  city = createCity($('#scene'), {
    geography,
    noise: { day, evening, night },
    terrain,
    motion: !matchMedia('(prefers-reduced-motion: reduce)').matches,
    onSelect: reading,
  });
  ready = true;
  updateTime(state.minute);
  const format = new Intl.NumberFormat('es-ES');
  $('#geography-stats').textContent =
    `${format.format(city.stats.buildingCount)} edificios · ${format.format(city.stats.roadCount)} calles`;
  for (const button of document.querySelectorAll('[data-layer]')) button.disabled = false;
  for (const id of ['time', 'play', 'loop', 'speed']) $(`#${id}`).disabled = false;
  document.documentElement.dataset.ready = 'true';
  $('#loading').remove();
  frame = requestAnimationFrame(tick);
} catch (error) {
  console.error(error);
  $('#loading').innerHTML =
    '<button aria-label="Error al cargar el mapa. Reintentar" title="Reintentar">↻</button>';
  $('#loading button').onclick = () => location.reload();
}
window.addEventListener('pagehide', () => {
  cancelAnimationFrame(frame);
  city?.dispose();
});
