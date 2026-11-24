import { LAND, LAND_STEP } from "./globe-land";

/**
 * A dark globe drawn in dots: land as faint points, cities as brighter
 * clusters, a cold rim of light on one edge. It turns slowly; with reduced
 * motion it is drawn once. Plain canvas, no dependencies.
 */

type City = readonly [lat: number, lon: number, weight: number];

// Bright spots at night, weight ~ how much light the metro area gives off.
const CITIES: readonly City[] = [
  [40.7, -74, 1],
  [34.05, -118.2, 0.9],
  [41.9, -87.6, 0.8],
  [29.8, -95.4, 0.7],
  [32.8, -96.8, 0.7],
  [33.7, -84.4, 0.6],
  [25.8, -80.2, 0.6],
  [38.9, -77, 0.6],
  [42.4, -71.1, 0.6],
  [39.95, -75.2, 0.55],
  [37.8, -122.4, 0.65],
  [47.6, -122.3, 0.5],
  [33.4, -112, 0.5],
  [39.7, -105, 0.45],
  [44.95, -93.1, 0.45],
  [42.3, -83, 0.5],
  [36.2, -115.1, 0.4],
  [35.2, -80.8, 0.4],
  [30.3, -97.7, 0.4],
  [32.7, -117.2, 0.5],
  [43.65, -79.4, 0.65],
  [45.5, -73.6, 0.5],
  [49.3, -123.1, 0.4],
  [51, -114, 0.35],
  [19.4, -99.1, 0.9],
  [20.7, -103.3, 0.45],
  [25.7, -100.3, 0.45],
  [23.1, -82.4, 0.3],
  [4.7, -74.1, 0.5],
  [10.5, -66.9, 0.4],
  [-12, -77, 0.5],
  [-0.2, -78.5, 0.3],
  [-23.5, -46.6, 0.9],
  [-22.9, -43.2, 0.75],
  [-34.6, -58.4, 0.75],
  [-33.45, -70.7, 0.55],
  [-15.8, -47.9, 0.4],
  [-19.9, -43.9, 0.45],
  [-30, -51.2, 0.4],
  [-8.05, -34.9, 0.4],
  [51.5, -0.1, 0.9],
  [48.85, 2.35, 0.85],
  [52.5, 13.4, 0.6],
  [40.4, -3.7, 0.6],
  [41.4, 2.2, 0.5],
  [41.9, 12.5, 0.55],
  [45.5, 9.2, 0.6],
  [52.4, 4.9, 0.5],
  [50.85, 4.35, 0.5],
  [51.2, 6.8, 0.6],
  [48.1, 11.6, 0.45],
  [50.1, 8.7, 0.45],
  [53.5, 10, 0.45],
  [48.2, 16.4, 0.45],
  [52.2, 21, 0.45],
  [50.1, 14.4, 0.4],
  [47.5, 19.05, 0.4],
  [44.4, 26.1, 0.4],
  [59.3, 18.1, 0.35],
  [59.9, 10.75, 0.3],
  [55.7, 12.6, 0.35],
  [60.2, 24.9, 0.3],
  [53.35, -6.25, 0.35],
  [38.7, -9.1, 0.4],
  [37.98, 23.7, 0.45],
  [41, 28.95, 0.75],
  [39.9, 32.85, 0.4],
  [55.75, 37.6, 0.85],
  [59.95, 30.3, 0.55],
  [50.45, 30.5, 0.45],
  [53.9, 27.55, 0.3],
  [55, 82.9, 0.3],
  [56.8, 60.6, 0.3],
  [30.05, 31.25, 0.8],
  [31.2, 29.9, 0.45],
  [33.6, -7.6, 0.45],
  [36.75, 3.05, 0.4],
  [6.5, 3.4, 0.6],
  [5.6, -0.2, 0.35],
  [-1.3, 36.8, 0.35],
  [9, 38.75, 0.3],
  [-26.2, 28, 0.6],
  [-33.9, 18.4, 0.4],
  [-4.3, 15.3, 0.4],
  [-8.8, 13.2, 0.35],
  [14.7, -17.45, 0.3],
  [32.1, 34.8, 0.45],
  [33.9, 35.5, 0.35],
  [24.7, 46.7, 0.55],
  [21.5, 39.2, 0.4],
  [25.2, 55.3, 0.6],
  [25.3, 51.5, 0.35],
  [29.4, 47.95, 0.35],
  [35.7, 51.4, 0.7],
  [33.3, 44.4, 0.5],
  [24.9, 67, 0.7],
  [31.55, 74.35, 0.6],
  [33.7, 73.05, 0.35],
  [28.6, 77.2, 0.95],
  [19.1, 72.9, 0.9],
  [12.95, 77.6, 0.65],
  [13.1, 80.3, 0.6],
  [22.6, 88.4, 0.75],
  [17.4, 78.5, 0.6],
  [23, 72.6, 0.5],
  [18.5, 73.85, 0.45],
  [26.85, 80.95, 0.4],
  [26.9, 75.8, 0.4],
  [23.8, 90.4, 0.75],
  [27.7, 85.3, 0.3],
  [6.9, 79.85, 0.3],
  [16.85, 96.15, 0.35],
  [13.75, 100.5, 0.7],
  [11.55, 104.9, 0.35],
  [21, 105.85, 0.5],
  [10.8, 106.65, 0.6],
  [3.15, 101.7, 0.5],
  [1.35, 103.8, 0.55],
  [-6.2, 106.85, 0.85],
  [-7.25, 112.75, 0.45],
  [14.6, 121, 0.7],
  [22.3, 114.2, 0.7],
  [23.1, 113.3, 0.85],
  [22.55, 114.05, 0.8],
  [31.2, 121.5, 0.95],
  [39.9, 116.4, 0.9],
  [39.1, 117.2, 0.55],
  [30.6, 114.3, 0.55],
  [30.65, 104.05, 0.55],
  [29.55, 106.5, 0.55],
  [34.25, 108.95, 0.45],
  [32.05, 118.8, 0.5],
  [30.25, 120.15, 0.5],
  [36.65, 117, 0.45],
  [36.1, 120.35, 0.4],
  [41.8, 123.4, 0.45],
  [45.75, 126.65, 0.4],
  [25.05, 121.55, 0.6],
  [37.55, 127, 0.85],
  [35.1, 129.05, 0.45],
  [39.05, 125.75, 0.15],
  [35.7, 139.7, 1],
  [34.7, 135.5, 0.8],
  [35.2, 136.9, 0.55],
  [33.6, 130.4, 0.4],
  [43.05, 141.35, 0.3],
  [-33.85, 151.2, 0.6],
  [-37.8, 144.95, 0.55],
  [-27.5, 153, 0.4],
  [-31.95, 115.85, 0.35],
  [-34.9, 138.6, 0.3],
  [-36.85, 174.75, 0.35],
  [21.3, -157.85, 0.25],
  [61.2, -149.9, 0.2],
  [64.1, -21.9, 0.15],
];

const DOTS = 150_000; // points on the sphere before keeping land
const TILT = (16 * Math.PI) / 180; // northern hemisphere leans toward us
const TURN = (2 * Math.PI) / 150_000; // radians per ms: a turn every 2.5 minutes
const FRAME_MS = 1000 / 30;
const LEVELS = 8;

interface Dot {
  lat: number;
  lon: number;
  glow: number;
}

/** Decodes the run-length mask into rows of 0 (water) and 1 (land). */
function decodeLand(): { width: number; height: number; cells: Uint8Array } {
  const width = Math.round(360 / LAND_STEP);
  const height = Math.round(180 / LAND_STEP);
  const cells = new Uint8Array(width * height);
  const FINAL = "0123456789abcdefghijklmnopqrstuv";
  const CONT = "ABCDEFGHIJKLMNOPQRSTUVWXYZ!#%&*+";
  let row = 0;
  let col = 0;
  let land = 0;
  let value = 0;
  for (const char of LAND) {
    if (char === "~") {
      row += 1;
      col = 0;
      land = 0;
      continue;
    }
    const cont = CONT.indexOf(char);
    if (cont >= 0) {
      value = value * 32 + cont;
      continue;
    }
    value = value * 32 + FINAL.indexOf(char);
    if (land) cells.fill(1, row * width + col, row * width + col + value);
    col += value;
    value = 0;
    land ^= 1;
  }
  return { width, height, cells };
}

let cachedDots: Dot[] | undefined;

/** Land points on a Fibonacci sphere, each with how brightly it glows. */
function landDots(): Dot[] {
  if (cachedDots) return cachedDots;
  const { width, height, cells } = decodeLand();
  const isLand = (lat: number, lon: number) => {
    const r = Math.min(
      height - 1,
      Math.max(0, Math.floor((90 - lat) / LAND_STEP)),
    );
    const c = ((Math.floor((lon + 180) / LAND_STEP) % width) + width) % width;
    return cells[r * width + c] === 1;
  };
  // Seeded noise so every visit sees the same sky.
  let seed = 7;
  const random = () => {
    seed = (seed * 16807) % 2147483647;
    return seed / 2147483647;
  };
  const dots: Dot[] = [];
  const golden = Math.PI * (3 - Math.sqrt(5));
  for (let i = 0; i < DOTS; i += 1) {
    const y = 1 - (2 * (i + 0.5)) / DOTS;
    const lat = (Math.asin(y) * 180) / Math.PI;
    const lon = (((((i * golden * 180) / Math.PI) % 360) + 360) % 360) - 180;
    if (!isLand(lat, lon)) continue;
    let glow = 0.13 + 0.24 * random() ** 2;
    if (lat < -62) glow *= 0.45; // the ice stays dark
    const coast =
      !isLand(lat + 0.6, lon) ||
      !isLand(lat - 0.6, lon) ||
      !isLand(lat, lon + 0.6) ||
      !isLand(lat, lon - 0.6);
    if (coast) glow += 0.12;
    const cosLat = Math.cos((lat * Math.PI) / 180);
    for (const [cLat, cLon, weight] of CITIES) {
      const dLat = lat - cLat;
      let dLon = Math.abs(lon - cLon);
      if (dLon > 180) dLon = 360 - dLon;
      dLon *= cosLat;
      const d2 = dLat * dLat + dLon * dLon;
      const spread = 3.2 * weight + 1.2;
      if (d2 > spread * spread * 9) continue;
      glow +=
        weight *
        1.1 *
        Math.exp(-d2 / (spread * spread)) *
        (0.55 + 0.45 * random());
    }
    dots.push({ lat, lon, glow: Math.min(glow, 1.4) });
  }
  cachedDots = dots;
  return dots;
}

export interface GlobeOptions {
  /** Draw a single still frame. */
  still?: boolean;
}

/** Draws the globe into `canvas`, sized to its box. Returns a stop function. */
export function mountGlobe(
  canvas: HTMLCanvasElement,
  options: GlobeOptions = {},
): () => void {
  const context = canvas.getContext("2d");
  if (!context) return () => {};
  const ctx = context;
  const dots = landDots();
  const toRad = Math.PI / 180;
  const sinLat = new Float32Array(dots.length);
  const cosLat = new Float32Array(dots.length);
  const lonRad = new Float32Array(dots.length);
  const glowOf = new Float32Array(dots.length);
  dots.forEach((dot, i) => {
    sinLat[i] = Math.sin(dot.lat * toRad);
    cosLat[i] = Math.cos(dot.lat * toRad);
    lonRad[i] = dot.lon * toRad;
    glowOf[i] = dot.glow;
  });
  const buckets: number[][] = Array.from({ length: LEVELS }, () => []);

  let width = 0;
  let height = 0;
  let scale = 1;
  let frame = 0;
  let last = 0;
  // Start with the Americas and the Atlantic facing us.
  let spin = 40 * toRad;

  function resize(): void {
    const box = canvas.getBoundingClientRect();
    scale = Math.min(window.devicePixelRatio || 1, 2);
    width = Math.max(1, Math.round(box.width * scale));
    height = Math.max(1, Math.round(box.height * scale));
    canvas.width = width;
    canvas.height = height;
    draw();
  }

  function draw(): void {
    ctx.clearRect(0, 0, width, height);
    // A big globe centred past the right edge: its left half arcs through
    // the panel and runs off the top, right and bottom.
    const radius = Math.max(width * 0.85, height * 0.8);
    const cx = width * 1.1;
    const cy = height * 0.55;
    const sinT = Math.sin(TILT);
    const cosT = Math.cos(TILT);

    // The night side of the planet, just lighter than space.
    const body = ctx.createRadialGradient(
      cx - radius * 0.35,
      cy - radius * 0.4,
      radius * 0.1,
      cx,
      cy,
      radius,
    );
    body.addColorStop(0, "#0b0c0f");
    body.addColorStop(0.75, "#060708");
    body.addColorStop(1, "#030304");
    ctx.fillStyle = body;
    ctx.beginPath();
    ctx.arc(cx, cy, radius, 0, Math.PI * 2);
    ctx.fill();

    for (const bucket of buckets) bucket.length = 0;
    const xs = new Float32Array(dots.length);
    const ys = new Float32Array(dots.length);
    for (let i = 0; i < dots.length; i += 1) {
      const lon = (lonRad[i] ?? 0) + spin;
      const x = (cosLat[i] ?? 0) * Math.sin(lon);
      const y0 = sinLat[i] ?? 0;
      const z0 = (cosLat[i] ?? 0) * Math.cos(lon);
      // Tip the north pole toward the viewer.
      const y = y0 * cosT - z0 * sinT;
      const z = y0 * sinT + z0 * cosT;
      if (z <= 0.02) continue;
      const px = cx + x * radius;
      const py = cy - y * radius;
      if (px < -4 || py < -4 || px > width + 4 || py > height + 4) continue;
      // Light falls off toward the right; the left limb catches the rim light.
      const side =
        0.5 + 0.5 * Math.min(1, Math.max(0, -x * 0.7 + 0.45 + (1 - z) * 0.35));
      const level = Math.min(
        LEVELS - 1,
        Math.floor((glowOf[i] ?? 0) * side * LEVELS * 0.9),
      );
      if (level < 0) continue;
      xs[i] = px;
      ys[i] = py;
      buckets[level]?.push(i);
    }

    const size = Math.max(1, 1.15 * scale);
    for (let level = 0; level < LEVELS; level += 1) {
      const bucket = buckets[level];
      if (!bucket?.length) continue;
      const t = (level + 1) / LEVELS;
      // Deep blue for the faintest land, ice-cyan to near white for cities.
      const r = Math.round(95 + 155 * t * t);
      const g = Math.round(110 + 140 * t * t);
      const b = Math.round(130 + 125 * t);
      ctx.fillStyle = `rgba(${r},${g},${b},${0.3 + 0.7 * t})`;
      const s = level >= LEVELS - 2 ? size * 1.5 : size;
      ctx.beginPath();
      for (const i of bucket)
        ctx.rect((xs[i] ?? 0) - s / 2, (ys[i] ?? 0) - s / 2, s, s);
      ctx.fill();
    }

    // City glow: soft halos over the brightest clusters.
    ctx.globalCompositeOperation = "lighter";
    for (const [lat, lonDeg, weight] of CITIES) {
      if (weight < 0.5) continue;
      const lon = lonDeg * toRad + spin;
      const cl = Math.cos(lat * toRad);
      const x = cl * Math.sin(lon);
      const y0 = Math.sin(lat * toRad);
      const z0 = cl * Math.cos(lon);
      const y = y0 * cosT - z0 * sinT;
      const z = y0 * sinT + z0 * cosT;
      if (z <= 0.1) continue;
      const px = cx + x * radius;
      const py = cy - y * radius;
      const halo = (10 + 16 * weight) * scale * (0.5 + 0.5 * z);
      const glow = ctx.createRadialGradient(px, py, 0, px, py, halo);
      glow.addColorStop(0, `rgba(215,232,245,${0.16 * weight})`);
      glow.addColorStop(1, "rgba(215,232,245,0)");
      ctx.fillStyle = glow;
      ctx.fillRect(px - halo, py - halo, halo * 2, halo * 2);
    }

    ctx.globalCompositeOperation = "source-over";

    // Atmosphere: a thin cold rim, bright on the upper left, gone by the lower right.
    const rim = ctx.createLinearGradient(
      cx - radius,
      cy,
      cx + radius * 0.1,
      cy,
    );
    rim.addColorStop(0, "rgba(225,236,245,0.85)");
    rim.addColorStop(0.45, "rgba(170,190,210,0.25)");
    rim.addColorStop(1, "rgba(170,190,210,0)");
    ctx.save();
    ctx.strokeStyle = rim;
    ctx.lineWidth = Math.max(1.5, radius * 0.006);
    ctx.shadowColor = "rgba(190,210,230,0.35)";
    ctx.shadowBlur = 28 * scale;
    ctx.beginPath();
    ctx.arc(cx, cy, radius, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
  }

  function tick(now: number): void {
    frame = requestAnimationFrame(tick);
    if (!last) last = now;
    const elapsed = now - last;
    if (elapsed < FRAME_MS) return;
    last = now;
    spin += elapsed * TURN;
    draw();
  }

  const observer =
    typeof ResizeObserver === "undefined"
      ? undefined
      : new ResizeObserver(resize);
  observer?.observe(canvas);
  resize();
  if (!options.still) frame = requestAnimationFrame(tick);

  return () => {
    cancelAnimationFrame(frame);
    observer?.disconnect();
  };
}
