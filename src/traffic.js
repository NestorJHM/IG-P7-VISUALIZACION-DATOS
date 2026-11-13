// Las luces representan el tráfico de forma orientativa: su cantidad depende del ruido del mapa, sin usar recuentos reales de coches.
const hash = (n) => {
  const v = Math.sin(Number(n) * 12.9898) * 43758.5453;
  return v - Math.floor(v);
};
const tailAlpha = [1, 0.38, 0.12],
  tailScale = [1, 0.7, 0.45];
const smooth = (t) => {
  t = Math.max(0, Math.min(1, t));
  return t * t * (3 - 2 * t);
};
export const trafficActivity = (minute) =>
  0.46 + 0.54 * smooth((minute - 420) / 90) * (1 - smooth((minute - 1050) / 240));

function noiseAt(data, lon, lat) {
  if (!data) return null;
  const e = data.extent,
    x = Math.round(((lon - e.xmin) / (e.xmax - e.xmin)) * (data.width - 1)),
    y = Math.round(((e.ymax - lat) / (e.ymax - e.ymin)) * (data.height - 1));
  if (x < 0 || y < 0 || x >= data.width || y >= data.height) return null;
  const band = data.values[y * data.width + x];
  return band >= 0 ? band : null;
}
function pointAt(route, distance, out) {
  distance = ((distance % route.length) + route.length) % route.length;
  let lo = 1,
    hi = route.distances.length - 1;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    if (route.distances[mid] < distance) lo = mid + 1;
    else hi = mid;
  }
  const a = route.points[lo - 1],
    b = route.points[lo],
    span = route.distances[lo] - route.distances[lo - 1];
  const t = span ? (distance - route.distances[lo - 1]) / span : 0;
  out.x = a.x + (b.x - a.x) * t;
  out.z = a.z + (b.z - a.z) * t;
  return out;
}
export function createTraffic(roads, unproject) {
  const routes = [];
  let capacity = 0;
  for (const road of roads) {
    const distances = [0];
    for (let i = 1; i < road.points.length; i++)
      distances.push(
        distances[i - 1] +
          Math.hypot(
            road.points[i].x - road.points[i - 1].x,
            road.points[i].z - road.points[i - 1].z
          )
      );
    const length = distances.at(-1);
    if (length < 45) continue;
    const slots = Math.min(48, Math.max(2, Math.ceil(length / 48)));
    const route = {
      ...road,
      distances,
      length,
      slots,
      offset: capacity,
      count: 0,
      seed: hash(road.id),
      speed: 38 + hash(Number(road.id) + 7) * 30,
      samples: [],
    };
    for (let i = 0; i < 9; i++)
      route.samples.push(unproject(pointAt(route, ((i + 0.5) / 9) * length, {})));
    routes.push(route);
    capacity += slots;
  }
  const positions = new Float32Array(capacity * 9),
    alphas = new Float32Array(capacity * 3),
    scales = new Float32Array(capacity * 3);
  const state = { positions, alphas, scales, routes, visibleCount: 0, capacity };
  const scratch = { x: 0, z: 0 };
  state.setData = (data, minute) => {
    const activity = trafficActivity(minute);
    let visible = 0;
    for (const route of routes) {
      const bands = route.samples.map((p) => noiseAt(data, p.lon, p.lat)).filter((v) => v !== null);
      const mean = bands.length ? bands.reduce((a, b) => a + b, 0) / bands.length : 0;
      const strength = bands.length ? 0.12 + 0.88 * (mean / 6) ** 1.7 : 0.045;
      route.meanBand = bands.length ? mean : null;
      route.count = Math.min(route.slots, (route.length / 60) * strength * activity);
      visible += route.count;
    }
    state.visibleCount = visible;
    return state;
  };
  state.update = (elapsed) => {
    for (const route of routes) {
      for (let i = 0; i < route.slots; i++) {
        const alpha = Math.max(0, Math.min(1, route.count - i));
        const direction = route.oneway ? 1 : i % 2 === 0 ? 1 : -1;
        // Repartimos las luces por toda la calle, incluso cuando hay pocas.
        const phase = (route.seed + i * 0.61803398875) % 1;
        const distance = phase * route.length + elapsed * route.speed * direction;
        for (let tail = 0; tail < 3; tail++) {
          const k = (route.offset + i) * 3 + tail;
          alphas[k] = alpha * tailAlpha[tail];
          scales[k] = tailScale[tail];
          if (!alpha) continue;
          pointAt(route, distance - tail * 9 * direction, scratch);
          positions[k * 3] = scratch.x;
          positions[k * 3 + 1] = 8;
          positions[k * 3 + 2] = scratch.z;
        }
      }
    }
    return state;
  };
  return state;
}
