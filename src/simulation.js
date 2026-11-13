export const anchors = { day: 420, evening: 1140, night: 1439 };
export const formatTime = (minute) =>
  `${String(Math.floor(minute / 60)).padStart(2, '0')}:${String(minute % 60).padStart(2, '0')}`;
const hash = (n) => {
  const v = Math.sin(n * 12.9898) * 43758.5453;
  return v - Math.floor(v);
};
const smooth = (t) => t * t * (3 - 2 * t);
function fluctuation(x, y, time) {
  const t = time / 24,
    cell = Math.floor(t),
    f = smooth(t - cell);
  const seed = Math.floor(x / 3) * 157 + Math.floor(y / 3) * 313;
  return (hash(seed + cell * 17) * (1 - f) + hash(seed + (cell + 1) * 17) * f) * 2 - 1;
}
function at(data, lon, lat) {
  const e = data.extent,
    x = Math.round(((lon - e.xmin) / (e.xmax - e.xmin)) * (data.width - 1)),
    y = Math.round(((e.ymax - lat) / (e.ymax - e.ymin)) * (data.height - 1));
  return x < 0 || y < 0 || x >= data.width || y >= data.height
    ? -1
    : data.values[y * data.width + x];
}
export function createSimulation(noise) {
  if (!noise.day || !noise.evening || !noise.night) return null;
  const base = noise.day;
  const aligned = Object.fromEntries(
    Object.entries(anchors).map(([key]) => [
      key,
      base.values.map((_, i) =>
        at(
          noise[key],
          base.extent.xmin +
            ((i % base.width) / (base.width - 1)) * (base.extent.xmax - base.extent.xmin),
          base.extent.ymax -
            (Math.floor(i / base.width) / (base.height - 1)) * (base.extent.ymax - base.extent.ymin)
        )
      ),
    ])
  );
  return (minute) => {
    minute = Math.max(420, Math.min(1439, minute));
    const [a, b] = minute <= 1140 ? ['day', 'evening'] : ['evening', 'night'];
    const t = (minute - anchors[a]) / (anchors[b] - anchors[a]),
      blend = smooth(t);
    const values = base.values.map((_, i) => {
      const lo = aligned[a][i],
        hi = aligned[b][i];
      // En las horas de referencia usamos los datos de su mapa; entre esas horas, solo los puntos que aparecen en ambos mapas.
      if (t === 0) return lo;
      if (t === 1) return hi;
      if (lo < 0 || hi < 0) return -1;
      const jitter =
        fluctuation(i % base.width, Math.floor(i / base.width), minute) *
        0.1 *
        Math.sin(Math.PI * t);
      return Math.max(0, Math.min(6, lo + (hi - lo) * blend + jitter));
    });
    return { ...base, values, indicator: 'SIM', simulated: true, minute };
  };
}

// El día completo de la simulación dura 90 segundos. Al terminar, el reloj se queda en las 23:59.
export function advanceTime(minute, seconds, loop) {
  const next = minute + (Math.max(0, seconds) * (1439 - 420)) / 90;
  return next >= 1439
    ? loop
      ? { minute: 420 + ((next - 420) % (1439 - 420)), ended: false }
      : { minute: 1439, ended: true }
    : { minute: next, ended: false };
}
