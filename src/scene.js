import * as THREE from 'three';
import { solarState } from './daylight.js';
import { createTerrain } from './terrain.js';
import { createTraffic } from './traffic.js';
import {
  ACOUSTIC_HEIGHTS,
  createAcousticVolume,
  createClosedContours,
  createAcousticReveal,
} from './acoustic.js';
import { createSimulation } from './simulation.js';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

const ORIGIN = { lat: 28.131, lon: -15.431 };
const MX = 111320 * Math.cos((ORIGIN.lat * Math.PI) / 180),
  MZ = 111320;
const project = (lon, lat) =>
  new THREE.Vector3((lon - ORIGIN.lon) * MX, 0, -(lat - ORIGIN.lat) * MZ);
const unproject = (p) => ({ lon: p.x / MX + ORIGIN.lon, lat: -p.z / MZ + ORIGIN.lat });
const zones = {
  mesa: { name: 'Mesa y López', lon: -15.4348, lat: 28.1268 },
  canteras: { name: 'Las Canteras', lon: -15.4382, lat: 28.1355 },
  santa: { name: 'Santa Catalina', lon: -15.4313, lat: 28.1404 },
  alcaravaneras: { name: 'Alcaravaneras', lon: -15.4282, lat: 28.1282 },
  isleta: { name: 'La Isleta', lon: -15.4268, lat: 28.1513 },
};
const palette = ['#70bcb7', '#99c8af', '#e9cf83', '#ffac4c', '#f4763c', '#ed4a3d', '#ae263d'].map(
  (c) => new THREE.Color(c)
);
const bandHeights = ACOUSTIC_HEIGHTS;
const rangeLabels = ['< 50', '50–55', '55–60', '60–65', '65–70', '70–75', '75–100'];
const interpolate = (values, band) => {
  const i = Math.floor(band),
    j = Math.min(i + 1, values.length - 1);
  return values[i] + (values[j] - values[i]) * (band - i);
};
const upperBounds = [50, 55, 60, 65, 70, 75, 100];
const hash = (n) => {
  const v = Math.sin(Number(n) * 12.9898) * 43758.5453;
  return v - Math.floor(v);
};

export function createCity(container, { geography, noise, terrain, motion, onSelect, onTourEnd }) {
  const scene = new THREE.Scene();
  scene.background = new THREE.Color('#090f13');
  scene.fog = new THREE.FogExp2('#0b1419', 0.000105);
  const renderer = new THREE.WebGLRenderer({
    antialias: true,
    alpha: false,
    powerPreference: 'high-performance',
    preserveDrawingBuffer: true,
  });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 1.7));
  renderer.setSize(innerWidth, innerHeight);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.2;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  container.append(renderer.domElement);
  const camera = new THREE.PerspectiveCamera(43, innerWidth / innerHeight, 5, 22000);
  const target = new THREE.Vector3(10, 0, -400);
  const home = new THREE.Vector3(-3000, 2550, 2300);
  camera.position.copy(home);
  const composer = new EffectComposer(renderer);
  composer.addPass(new RenderPass(scene, camera));
  composer.addPass(
    new UnrealBloomPass(new THREE.Vector2(innerWidth, innerHeight), 0.45, 0.65, 0.88)
  );
  composer.addPass(new OutputPass());
  const controls = new OrbitControls(camera, renderer.domElement);
  controls.target.copy(target);
  controls.enableDamping = true;
  controls.dampingFactor = 0.065;
  controls.minDistance = 550;
  controls.maxDistance = 11500;
  controls.maxPolarAngle = Math.PI * 0.475;
  controls.minPolarAngle = 0.08;
  controls.enablePan = true;
  const ambient = new THREE.AmbientLight('#8eafc2', 0.3),
    sky = new THREE.HemisphereLight('#c4dfe5', '#10181b', 0.5);
  scene.add(ambient, sky);
  const key = new THREE.DirectionalLight('#ffe3b6', 3);
  key.position.set(-1800, 3500, 1500);
  key.castShadow = true;
  key.shadow.mapSize.set(4096, 4096);
  Object.assign(key.shadow.camera, {
    left: -4700,
    right: 4700,
    top: 4700,
    bottom: -4700,
    near: 100,
    far: 22000,
  });
  key.shadow.bias = -0.0004;
  key.shadow.normalBias = 0.7;
  scene.add(key);
  renderer.shadowMap.autoUpdate = false;
  const rim = new THREE.DirectionalLight('#72a9b9', 1.7);
  rim.position.set(2000, 1500, -2200);
  scene.add(rim);
  const world = new THREE.Group();
  scene.add(world);
  const buildings = new THREE.Group(),
    fibers = new THREE.Group(),
    noiseGroup = new THREE.Group();
  world.add(buildings, fibers, noiseGroup);
  const seaMaterial = new THREE.ShaderMaterial({
    uniforms: { time: { value: 0 }, daylight: { value: 0 } },
    vertexShader:
      'varying vec3 vWorld; void main(){vWorld=(modelMatrix*vec4(position,1.)).xyz;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',
    fragmentShader: `varying vec3 vWorld; uniform float time; uniform float daylight; void main(){float w=sin(vWorld.x*.045+sin(vWorld.z*.018+time*.12)*2.)*sin(vWorld.z*.042)*.5+.5;float d=exp(-length(vWorld.xz-vec2(-1600.,900.))*.0003);vec3 c=mix(vec3(.002,.004,.007),vec3(.006,.016,.021),d);c=mix(c,vec3(.035,.085,.105)+w*.004,daylight);c+=w*.0015;gl_FragColor=vec4(c,1.);}`,
  });
  const sea = new THREE.Mesh(new THREE.PlaneGeometry(32000, 32000, 1, 1), seaMaterial);
  sea.rotation.x = -Math.PI / 2;
  sea.position.y = -15;
  scene.add(sea);
  // La foto aérea y los edificios se colocan con las mismas coordenadas del mapa.
  const coastBase = terrain.polygons[0];
  createTerrain(world, renderer, terrain, project);
  const roadPositions = [],
    majorPositions = [],
    coastPositions = [],
    roofPositions = [];
  // Guardamos qué puntos están en tierra para no repetir el cálculo al actualizar el ruido.
  const landMask = new Map();
  function insideLand(x, z) {
    const key = x + ',' + z;
    if (landMask.has(key)) return landMask.get(key);
    const p = unproject({ x, z });
    let inside = false;
    for (let i = 0, j = coastBase.length - 1; i < coastBase.length; j = i++) {
      const a = coastBase[i],
        b = coastBase[j];
      if (
        a[1] > p.lat !== b[1] > p.lat &&
        p.lon < ((b[0] - a[0]) * (p.lat - a[1])) / (b[1] - a[1]) + a[0]
      )
        inside = !inside;
    }
    landMask.set(key, inside);
    return inside;
  }
  const geometries = [[], [], []];
  const trafficRoads = [];
  let buildingCount = 0,
    roadCount = 0;
  for (const e of geography.elements) {
    const points = e.geometry.map((p) => project(p.lon, p.lat));
    if (points.length < 2) continue;
    if (e.tags.building && points.length > 3) {
      const shape = new THREE.Shape(points.map((p) => new THREE.Vector2(p.x, -p.z)));
      const providedHeight = parseFloat(e.tags.height),
        levels = parseFloat(e.tags['building:levels']);
      const h =
        1.65 *
        (Number.isFinite(providedHeight)
          ? Math.max(3, Math.min(160, providedHeight))
          : Number.isFinite(levels)
            ? Math.max(3, Math.min(160, levels * 3.2))
            : 12 + hash(e.id) * 27);
      const g = new THREE.ExtrudeGeometry(shape, {
        depth: h,
        bevelEnabled: false,
        steps: 1,
        curveSegments: 1,
      });
      g.rotateX(-Math.PI / 2);
      g.translate(0, 2, 0);
      geometries[Math.floor(hash(e.id) * 3)].push(g);
      buildingCount++;
      for (let i = 1; i < points.length; i++)
        roofPositions.push(
          points[i - 1].x,
          h + 2.2,
          points[i - 1].z,
          points[i].x,
          h + 2.2,
          points[i].z
        );
    }
    if (
      e.tags.highway &&
      !['footway', 'steps', 'path', 'track', 'service', 'cycleway'].includes(e.tags.highway)
    ) {
      const major = [
        'primary',
        'secondary',
        'tertiary',
        'trunk',
        'primary_link',
        'secondary_link',
      ].includes(e.tags.highway);
      for (let i = 1; i < points.length; i++) {
        const list = major ? majorPositions : roadPositions;
        list.push(points[i - 1].x, 3, points[i - 1].z, points[i].x, 3, points[i].z);
      }
      roadCount++;
      trafficRoads.push({
        id: e.id,
        points,
        oneway: e.tags.oneway === 'yes' || e.tags.oneway === '1',
      });
    }
    if (e.tags.natural === 'coastline')
      for (let i = 1; i < points.length; i++)
        coastPositions.push(points[i - 1].x, 0.15, points[i - 1].z, points[i].x, 0.15, points[i].z);
  }
  for (let i = 0; i < 3; i++)
    if (geometries[i].length) {
      const merged = mergeGeometries(geometries[i]);
      const mesh = new THREE.Mesh(
        merged,
        new THREE.MeshStandardMaterial({
          color: ['#354044', '#454a48', '#56564d'][i],
          roughness: 0.87,
          metalness: 0.12,
        })
      );
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      buildings.add(mesh);
      geometries[i].forEach((g) => g.dispose());
    }
  function segments(positions, color, opacity, parent = world) {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    const m = new THREE.LineBasicMaterial({ color, transparent: true, opacity, depthWrite: false });
    const line = new THREE.LineSegments(g, m);
    parent.add(line);
    return line;
  }
  segments(roofPositions, '#b5b9a9', 0.16, buildings);
  segments(roadPositions, '#7caaa5', 0.48, fibers);
  const majorLines = segments(majorPositions, '#f5d8a0', 1, fibers);
  majorLines.material.color.multiplyScalar(2.2);
  segments(coastPositions, '#a3cdc9', 0.5);
  // Las luces siguen las calles de OpenStreetMap y son más numerosas donde hay más ruido.
  const traffic = createTraffic(trafficRoads, unproject);
  const particleTexture = (() => {
    const cv = document.createElement('canvas');
    cv.width = cv.height = 32;
    const ctx = cv.getContext('2d');
    const gr = ctx.createRadialGradient(16, 16, 0, 16, 16, 16);
    gr.addColorStop(0, 'rgba(255,250,222,1)');
    gr.addColorStop(0.18, 'rgba(255,235,190,1)');
    gr.addColorStop(0.5, 'rgba(255,213,142,.3)');
    gr.addColorStop(1, 'rgba(255,213,142,0)');
    ctx.fillStyle = gr;
    ctx.fillRect(0, 0, 32, 32);
    return new THREE.CanvasTexture(cv);
  })();
  const trafficGeometry = new THREE.BufferGeometry();
  trafficGeometry.setAttribute(
    'position',
    new THREE.BufferAttribute(traffic.positions, 3).setUsage(THREE.DynamicDrawUsage)
  );
  trafficGeometry.setAttribute(
    'trafficAlpha',
    new THREE.BufferAttribute(traffic.alphas, 1).setUsage(THREE.DynamicDrawUsage)
  );
  trafficGeometry.setAttribute('trafficScale', new THREE.BufferAttribute(traffic.scales, 1));
  const trafficMaterial = new THREE.PointsMaterial({
    map: particleTexture,
    size: 26,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    color: new THREE.Color('#ffe9b3').multiplyScalar(2.4),
    toneMapped: false,
  });
  trafficMaterial.onBeforeCompile = (shader) => {
    shader.vertexShader =
      'attribute float trafficAlpha; attribute float trafficScale; varying float vTrafficAlpha;\n' +
      shader.vertexShader;
    shader.vertexShader = shader.vertexShader
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvTrafficAlpha=trafficAlpha;')
      .replace('gl_PointSize = size;', 'gl_PointSize = size * trafficScale;');
    shader.fragmentShader = 'varying float vTrafficAlpha;\n' + shader.fragmentShader;
    shader.fragmentShader = shader.fragmentShader.replace(
      '#include <color_fragment>',
      '#include <color_fragment>\ndiffuseColor.a *= vTrafficAlpha;'
    );
  };
  const trafficLights = new THREE.Points(trafficGeometry, trafficMaterial);
  trafficLights.name = 'Luces de trafico ilustrativas';
  trafficLights.renderOrder = 2;
  trafficLights.frustumCulled = false;
  fibers.add(trafficLights);
  let period = noise.night ? 'night' : 'day',
    currentData = noise[period],
    threshold = null;
  const noiseMeshes = {};
  let trafficMinute = 780;
  traffic.setData(currentData, trafficMinute).update(0);
  trafficGeometry.attributes.trafficScale.needsUpdate = true;
  const noiseReveal = createAcousticReveal();
  const acousticPalette = palette.map((color) => [color.r, color.g, color.b]);
  function acousticSurface(data) {
    const group = new THREE.Group();
    if (!data) return group;
    const volume = createAcousticVolume(data, project, insideLand, acousticPalette);
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.BufferAttribute(volume.positions, 3));
    geometry.setAttribute('color', new THREE.BufferAttribute(volume.colors, 3));
    geometry.setAttribute('surfaceAlpha', new THREE.BufferAttribute(volume.alphas, 1));
    geometry.setIndex(new THREE.BufferAttribute(volume.indices, 1));
    const surface = new THREE.Mesh(
      geometry,
      new THREE.MeshBasicMaterial({
        vertexColors: true,
        transparent: true,
        opacity: 0.39,
        side: THREE.FrontSide,
        depthWrite: false,
        toneMapped: false,
      })
    );
    surface.name = 'Volumen acustico cerrado';
    surface.userData.baseOpacity = 0.39;
    surface.material.onBeforeCompile = (shader) => {
      shader.vertexShader =
        'attribute float surfaceAlpha; varying float vSurfaceAlpha;\n' + shader.vertexShader;
      shader.vertexShader = shader.vertexShader.replace(
        '#include <begin_vertex>',
        '#include <begin_vertex>\nvSurfaceAlpha=surfaceAlpha;'
      );
      shader.fragmentShader = 'varying float vSurfaceAlpha;\n' + shader.fragmentShader;
      shader.fragmentShader = shader.fragmentShader.replace(
        '#include <color_fragment>',
        '#include <color_fragment>\ndiffuseColor.a *= vSurfaceAlpha;'
      );
    };
    group.add(surface);
    const contours = segments(createClosedContours(volume), '#ffad68', 0.7, group);
    contours.material.color.multiplyScalar(1.35);
    contours.userData.baseOpacity = 0.7;
    group.userData = {
      surface,
      data,
      baseColors: volume.colors.slice(),
      gridSize: volume.gridSize,
      topSize: volume.topSize,
      gridSources: volume.gridSources,
      boundaryEdges: volume.boundaryEdges,
    };
    noiseGroup.add(group);
    return group;
  }
  for (const key of ['day', 'evening', 'night']) {
    noiseMeshes[key] = acousticSurface(noise[key]);
    noiseMeshes[key].visible = key === period;
  }
  const simulate = createSimulation(noise);
  const ring = new THREE.Mesh(
    new THREE.RingGeometry(19, 23, 64),
    new THREE.MeshBasicMaterial({
      color: '#fff1c9',
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0.95,
      depthTest: false,
    })
  );
  ring.rotation.x = -Math.PI / 2;
  ring.renderOrder = 10;
  scene.add(ring);
  const markerGeometry = new THREE.BufferGeometry().setFromPoints([
    new THREE.Vector3(),
    new THREE.Vector3(0, 220, 0),
  ]);
  const marker = new THREE.Line(
    markerGeometry,
    new THREE.LineBasicMaterial({
      color: '#fff0c5',
      transparent: true,
      opacity: 0.7,
      depthTest: false,
    })
  );
  marker.renderOrder = 10;
  scene.add(marker);
  const markerDot = new THREE.Mesh(
    new THREE.SphereGeometry(9, 12, 8),
    new THREE.MeshBasicMaterial({ color: '#fff4d5', depthTest: false })
  );
  scene.add(markerDot);
  let selected = { ...zones.santa, zone: 'santa' },
    runningMotion = motion,
    tour = false,
    tourStarted = 0,
    viewTransition = null,
    elapsed = 0,
    lastFrame = 0,
    disposed = false,
    frame;
  function sample(lon, lat) {
    if (!currentData) return null;
    const d = currentData,
      e = d.extent;
    const x = Math.round(((lon - e.xmin) / (e.xmax - e.xmin)) * (d.width - 1)),
      y = Math.round(((e.ymax - lat) / (e.ymax - e.ymin)) * (d.height - 1));
    if (x < 0 || y < 0 || x >= d.width || y >= d.height) return null;
    const band = d.values[y * d.width + x];
    return band < 0 ? null : band;
  }
  function select(lon, lat, zone) {
    selected = { lon, lat, zone };
    const p = project(lon, lat),
      band = sample(lon, lat);
    ring.position.set(p.x, 10, p.z);
    marker.position.set(p.x, 10, p.z);
    marker.scale.y = band === null ? 0.2 : (interpolate(bandHeights, band) + 60) / 220;
    markerDot.position.set(p.x, 10 + 220 * marker.scale.y, p.z);
    onSelect({
      lon,
      lat,
      zone,
      label:
        band === null
          ? null
          : currentData.simulated
            ? '≈ ' + (47.5 + band * 5).toFixed(1)
            : rangeLabels[band],
      band,
      simulated: !!currentData?.simulated,
    });
  }
  function stopTour() {
    if (tour) {
      tour = false;
      onTourEnd?.();
    }
  }
  function selectZone(key, move = false) {
    const z = zones[key];
    if (!z) return;
    select(z.lon, z.lat, key);
    if (move) {
      stopTour();
      const p = project(z.lon, z.lat);
      startTransition(
        camera.position.clone().add(p.clone().sub(controls.target).multiplyScalar(0.6)),
        p,
        1000
      );
    }
  }
  function startTransition(position, lookAt, duration = 1600) {
    viewTransition = {
      from: camera.position.clone(),
      to: position,
      start: performance.now(),
      duration,
      targetFrom: controls.target.clone(),
      targetTo: lookAt,
    };
  }
  function setPeriod(value) {
    period = value;
    currentData = noise[period];
    traffic.setData(currentData, trafficMinute);
    Object.entries(noiseMeshes).forEach(([key, mesh]) => (mesh.visible = key === period));
    select(selected.lon, selected.lat, selected.zone);
    setThreshold(threshold);
  }
  function setLighting(minute) {
    const sun = solarState(minute),
      day = sun.daylight,
      altitudeFactor = Math.sin(sun.altitude),
      lightLevel = day * (0.25 + 0.75 * altitudeFactor);
    key.position.set(sun.x, Math.max(15, sun.y), sun.z);
    key.intensity = day * (1.4 + 2.2 * Math.sin(sun.altitude));
    key.color.set('#ffd2a0').lerp(new THREE.Color('#fff3dc'), Math.sin(sun.altitude));
    key.castShadow = day > 0.01;
    renderer.shadowMap.needsUpdate = true;
    ambient.intensity = 0.2 + lightLevel * 0.4 + sun.twilight * 0.12;
    sky.intensity = 0.35 + lightLevel * 0.8;
    sky.color
      .set('#7794b8')
      .lerp(new THREE.Color('#bc9477'), day)
      .lerp(new THREE.Color('#c6e2eb'), lightLevel);
    rim.intensity = 0.25 + (1 - day) * 0.3;
    scene.background
      .set('#090f13')
      .lerp(new THREE.Color('#59473e'), day * 0.5)
      .lerp(new THREE.Color('#58737c'), lightLevel);
    scene.fog.color.copy(scene.background);
    seaMaterial.uniforms.daylight.value = lightLevel;
    renderer.toneMappingExposure = 1.05 + day * 0.25;
    trafficMaterial.size = 28 + day * 8;
  }
  function setTime(minute) {
    trafficMinute = minute;
    setLighting(minute);
    if (!simulate) {
      traffic.setData(currentData, minute);
      return;
    }
    const previous = noiseMeshes.simulation;
    if (previous) {
      noiseGroup.remove(previous);
      previous.traverse((o) => {
        o.geometry?.dispose();
        if (o.material) for (const m of [].concat(o.material)) m.dispose();
      });
    }
    currentData = simulate(minute);
    period = 'simulation';
    traffic.setData(currentData, minute);
    noiseMeshes.simulation = acousticSurface(currentData);
    Object.entries(noiseMeshes).forEach(([key, mesh]) => (mesh.visible = key === period));
    select(selected.lon, selected.lat, selected.zone);
    setThreshold(threshold);
  }
  function setMapOnly(value) {
    ring.visible = marker.visible = markerDot.visible = !value;
  }
  function setThreshold(value) {
    threshold = value;
    for (const group of Object.values(noiseMeshes)) {
      const { surface, data, baseColors, topSize, gridSources } = group.userData;
      if (!surface) continue;
      const colors = surface.geometry.attributes.color;
      for (let i = 0; i < colors.count; i++) {
        const band = data.values[gridSources[i % topSize]],
          factor = value === null || band < 0 || interpolate(upperBounds, band) <= value ? 1 : 0.12;
        for (let k = 0; k < 3; k++) colors.array[i * 3 + k] = baseColors[i * 3 + k] * factor;
      }
      colors.needsUpdate = true;
    }
  }
  function thresholdStats(value) {
    if (!currentData) return null;
    const valid = currentData.values.filter((v) => v >= 0);
    if (!valid.length) return null;
    return Math.round(
      (valid.filter((v) => interpolate(upperBounds, v) <= value).length / valid.length) * 100
    );
  }
  const raycaster = new THREE.Raycaster(),
    pointer = new THREE.Vector2(),
    ground = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
  let pointerStart;
  renderer.domElement.addEventListener('pointerdown', (e) => {
    pointerStart = { x: e.clientX, y: e.clientY };
    stopTour();
    viewTransition = null;
  });
  renderer.domElement.addEventListener('pointerup', (e) => {
    if (!pointerStart || Math.hypot(e.clientX - pointerStart.x, e.clientY - pointerStart.y) > 6)
      return;
    const r = renderer.domElement.getBoundingClientRect();
    pointer.set(
      ((e.clientX - r.left) / r.width) * 2 - 1,
      (-(e.clientY - r.top) / r.height) * 2 + 1
    );
    raycaster.setFromCamera(pointer, camera);
    const p = new THREE.Vector3();
    if (raycaster.ray.intersectPlane(ground, p)) {
      const geo = unproject(p);
      if (geo.lat > 28.095 && geo.lat < 28.18 && geo.lon > -15.46 && geo.lon < -15.39) {
        let closest = null,
          d = Infinity;
        for (const [key, z] of Object.entries(zones)) {
          const dd = p.distanceTo(project(z.lon, z.lat));
          if (dd < d) {
            d = dd;
            closest = key;
          }
        }
        select(geo.lon, geo.lat, d < 300 ? closest : undefined);
      }
    }
  });
  const clock = new THREE.Clock();
  function render(now) {
    if (disposed) return;
    frame = requestAnimationFrame(render);
    if (now - lastFrame < 30) return;
    lastFrame = now;
    const delta = Math.min(clock.getDelta(), 0.1);
    if (runningMotion) elapsed += delta;
    seaMaterial.uniforms.time.value = elapsed;
    if (viewTransition) {
      const t = Math.min(1, (now - viewTransition.start) / viewTransition.duration),
        k = t * t * (3 - 2 * t);
      camera.position.lerpVectors(viewTransition.from, viewTransition.to, k);
      controls.target.lerpVectors(viewTransition.targetFrom, viewTransition.targetTo, k);
      if (t === 1) viewTransition = null;
    }
    if (tour) {
      const progress = Math.min(1, (now - tourStarted) / 30000),
        angle = -0.84 + progress * 0.92,
        radius = 5200 - progress * 850;
      camera.position.set(
        Math.sin(angle) * radius,
        3000 + Math.sin(progress * Math.PI) * 350,
        Math.cos(angle) * radius
      );
      controls.target.set(0, 0, 350 - progress * 450);
      if (progress >= 1) {
        tour = false;
        onTourEnd?.();
      }
    }
    controls.update();
    const reveal = noiseReveal.update(now);
    noiseGroup.scale.y = reveal;
    noiseGroup.visible = reveal > 0 || noiseReveal.target > 0;
    const opacity = Math.min(1, reveal * 4);
    for (const group of Object.values(noiseMeshes))
      for (const object of group.children)
        if (object.userData.baseOpacity !== undefined)
          object.material.opacity = object.userData.baseOpacity * opacity;
    traffic.update(elapsed);
    trafficGeometry.attributes.position.needsUpdate = true;
    trafficGeometry.attributes.trafficAlpha.needsUpdate = true;
    ring.scale.setScalar(1 + Math.sin(elapsed * 1.8) * 0.09);
    composer.render();
  }
  function resize() {
    camera.aspect = innerWidth / innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(innerWidth, innerHeight);
    renderer.setPixelRatio(Math.min(devicePixelRatio, 1.7));
    composer.setSize(innerWidth, innerHeight);
  }
  addEventListener('resize', resize);
  selectZone('santa');
  frame = requestAnimationFrame(render);
  return {
    setPeriod,
    setTime,
    setMapOnly,
    setThreshold,
    thresholdStats,
    selectZone,
    setLayer: (name, visible) => {
      if (name === 'noise') {
        noiseReveal.setVisible(visible, performance.now());
        if (visible) noiseGroup.visible = true;
        return;
      }
      ({ buildings, fibers })[name].visible = visible;
      if (name === 'buildings') renderer.shadowMap.needsUpdate = true;
    },
    setMotion: (value) => {
      runningMotion = value;
      if (!value) stopTour();
    },
    setView: (view) => {
      stopTour();
      startTransition(
        view === 'aerial' ? new THREE.Vector3(0, 5700, -300) : home.clone(),
        target.clone()
      );
    },
    setTour: (value) => {
      tour = value;
      viewTransition = null;
      if (value) tourStarted = performance.now();
    },
    stats: { buildingCount, roadCount },
    dispose: () => {
      disposed = true;
      cancelAnimationFrame(frame);
      removeEventListener('resize', resize);
      controls.dispose();
      scene.traverse((o) => {
        o.geometry?.dispose();
        if (o.material) {
          for (const m of [].concat(o.material)) m.dispose();
        }
      });
      particleTexture.dispose();
      terrain.texture.dispose();
      composer.dispose();
      renderer.dispose();
      renderer.domElement.remove();
    },
  };
}
