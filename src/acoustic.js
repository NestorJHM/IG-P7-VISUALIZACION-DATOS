// Solo altura visual; las bandas de ruido y dB son los de la fuente.
export const ACOUSTIC_HEIGHTS = [0, 3, 22.5, 145, 270, 390, 500];
export const ACOUSTIC_TOP_OFFSET = 6;
const FLOOR = 0.8;
const interpolate = (values, band) => {
  const i = Math.floor(band),
    j = Math.min(i + 1, values.length - 1);
  return values[i] + (values[j] - values[i]) * (band - i);
};

export function createAcousticVolume(data, project, isLand, palette) {
  const { width: w, height: h, values, extent } = data,
    n = w * h;
  let heights = new Float32Array(n),
    positions = new Float32Array(n * 6),
    colors = new Float32Array(n * 6),
    alphas = new Float32Array(n * 2),
    active = new Uint8Array(n),
    topIndices = [];
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      const k = y * w + x;
      if (values[k] < 0) continue;
      let sum = 0,
        weight = 0;
      for (let dy = -2; dy <= 2; dy++)
        for (let dx = -2; dx <= 2; dx++) {
          const nx = x + dx,
            ny = y + dy;
          if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue;
          const band = values[ny * w + nx];
          if (band < 0) continue;
          const wt = Math.exp(-(dx * dx + dy * dy) / 2.5);
          sum += interpolate(ACOUSTIC_HEIGHTS, band) * wt;
          weight += wt;
        }
      heights[k] = weight ? (sum / weight) * 1.18 : 0;
      alphas[k] = Math.max(0, Math.min(1, (heights[k] - 9) / 45));
      alphas[k + n] = alphas[k] * 0.45;
      const p = project(
        extent.xmin + (x / (w - 1)) * (extent.xmax - extent.xmin),
        extent.ymax - (y / (h - 1)) * (extent.ymax - extent.ymin)
      );
      positions.set([p.x, heights[k] + ACOUSTIC_TOP_OFFSET, p.z], k * 3);
      positions.set([p.x, FLOOR, p.z], (k + n) * 3);
      active[k] = isLand(p.x, p.z) ? 1 : 0;
      const band = values[k],
        lo = Math.floor(band),
        a = palette[lo],
        b = palette[Math.min(6, lo + 1)],
        t = band - lo;
      for (let c = 0; c < 3; c++) {
        const value = a[c] + (b[c] - a[c]) * t;
        colors[k * 3 + c] = value;
        colors[(k + n) * 3 + c] = value * 0.62;
      }
    }
  for (let y = 0; y < h - 1; y++)
    for (let x = 0; x < w - 1; x++) {
      const a = y * w + x,
        b = a + 1,
        c = a + w,
        d = c + 1;
      // Conservamos las partes que tienen datos, aunque falten datos en una esquina.
      if (active[a] && active[c] && active[b]) topIndices.push(a, c, b);
      if (active[b] && active[c] && active[d]) topIndices.push(b, c, d);
    }
  // Cuando faltan datos, dos partes del relieve pueden tocarse solo en una esquina.
  // Separamos esas partes para poder cerrar bien sus paredes, sin que se mezclen.
  const sources = Array.from({ length: n }, (_, i) => i),
    incident = Array.from({ length: n }, () => []);
  for (let i = 0; i < topIndices.length; i++) incident[topIndices[i]].push(i);
  for (let vertex = 0; vertex < n; vertex++) {
    const pending = new Set(incident[vertex]);
    let first = true;
    while (pending.size) {
      const fan = [pending.values().next().value];
      pending.delete(fan[0]);
      for (let f = 0; f < fan.length; f++) {
        const corner = fan[f],
          start = corner - (corner % 3);
        const adjacent = [0, 1, 2]
          .filter((j) => start + j !== corner)
          .map((j) => sources[topIndices[start + j]]);
        for (const candidate of pending) {
          const base = candidate - (candidate % 3);
          if (
            [0, 1, 2].some(
              (j) => base + j !== candidate && adjacent.includes(sources[topIndices[base + j]])
            )
          ) {
            pending.delete(candidate);
            fan.push(candidate);
          }
        }
      }
      if (!first) {
        const duplicate = sources.length;
        sources.push(vertex);
        for (const corner of fan) topIndices[corner] = duplicate;
      }
      first = false;
    }
  }
  const meshSize = sources.length;
  if (meshSize !== n) {
    const fullPositions = new Float32Array(meshSize * 6),
      fullColors = new Float32Array(meshSize * 6),
      fullAlphas = new Float32Array(meshSize * 2);
    for (let i = 0; i < meshSize; i++)
      for (let side = 0; side < 2; side++) {
        const from = sources[i] + side * n,
          to = i + side * meshSize;
        fullPositions.set(positions.subarray(from * 3, from * 3 + 3), to * 3);
        fullColors.set(colors.subarray(from * 3, from * 3 + 3), to * 3);
        fullAlphas[to] = alphas[from];
      }
    positions = fullPositions;
    colors = fullColors;
    alphas = fullAlphas;
  }
  const indices = [...topIndices],
    boundary = new Map();
  for (let i = 0; i < topIndices.length; i += 3) {
    const a = topIndices[i],
      b = topIndices[i + 1],
      c = topIndices[i + 2];
    indices.push(a + meshSize, c + meshSize, b + meshSize);
    for (const [u, v] of [
      [a, b],
      [b, c],
      [c, a],
    ]) {
      const key = Math.min(u, v) * meshSize + Math.max(u, v);
      if (boundary.has(key)) boundary.delete(key);
      else boundary.set(key, [u, v]);
    }
  }
  // Cerramos hasta el suelo los bordes del relieve y los huecos que quedan dentro.
  // Si faltan mediciones, no inventamos valores de ruido.
  for (const [u, v] of boundary.values())
    indices.push(u, u + meshSize, v, v, u + meshSize, v + meshSize);
  return {
    positions,
    colors,
    alphas,
    heights,
    indices: new Uint32Array(indices),
    topIndices: new Uint32Array(topIndices),
    boundaryEdges: boundary.size,
    gridSize: n,
    topSize: meshSize,
    gridSources: Uint32Array.from(sources),
  };
}

export function createClosedContours(volume, levels = [20, 40, 65, 95, 130, 170, 215, 265, 315]) {
  const { positions: p, indices } = volume,
    lines = [];
  // Las líneas de altura recorren todo el relieve y continúan por las paredes para que no queden abiertas.
  for (const level of levels) {
    const y = level + ACOUSTIC_TOP_OFFSET;
    for (let t = 0; t < indices.length; t += 3) {
      const ya = p[indices[t] * 3 + 1],
        yb = p[indices[t + 1] * 3 + 1],
        yc = p[indices[t + 2] * 3 + 1];
      if ((ya < y && yb < y && yc < y) || (ya >= y && yb >= y && yc >= y)) continue;
      const vertices = [indices[t], indices[t + 1], indices[t + 2]],
        hits = [];
      for (let edge = 0; edge < 3; edge++) {
        const a = vertices[edge] * 3,
          b = vertices[(edge + 1) % 3] * 3,
          ya = p[a + 1],
          yb = p[b + 1];
        if (ya < y === yb < y) continue;
        const f = (y - ya) / (yb - ya);
        hits.push([p[a] + (p[b] - p[a]) * f, y + 0.3, p[a + 2] + (p[b + 2] - p[a + 2]) * f]);
      }
      if (hits.length === 2) lines.push(...hits[0], ...hits[1]);
    }
  }
  return new Float32Array(lines);
}

export function createAcousticReveal(initial = 1, duration = 1100) {
  let value = initial,
    target = initial,
    from = initial,
    started = 0,
    span = duration;
  const update = (now) => {
    const t = Math.max(0, Math.min(1, (now - started) / span)),
      ease = t * t * (3 - 2 * t);
    value = from + (target - from) * ease;
    return value;
  };
  return {
    get value() {
      return value;
    },
    get target() {
      return target;
    },
    update,
    setVisible(visible, now) {
      update(now);
      const next = visible ? 1 : 0;
      if (next === target) return;
      from = value;
      target = next;
      started = now;
      span = Math.max(1, duration * Math.abs(target - from));
    },
  };
}
