// main.ts — "Thursday 19 November 2026 in one page"
// news-image-20261119: sums up Thursday 19 November 2026 in a single image.
// A classic newspaper front page, drawn entirely in code: Node 22 stdlib only,
// no network, no fonts, no assets. Own 5x7 bitmap font, own PNG encoder.
// 43 stories (13 illustrated + 30 in the digest), a world map with numbered
// pins, masthead "Thursday 19 November 2026". Output: /output/entry.png
// (or $MAKEFUN_OUTPUT_DIR/entry.png), 1024x1024, deterministic: two runs
// write byte-identical bytes.
//
// All news comes from the verified prep file for 19 November 2026. Nothing
// from 17/18 November is presented as 19 November news.

import { writeFileSync, mkdirSync } from "node:fs";
import { deflateSync } from "node:zlib";
import { join } from "node:path";

// ---------------------------------------------------------------- canvas ---
export const W = 1024;
export const H = 1024;

type RGB = [number, number, number];

const PAPER: RGB = [246, 239, 221]; // aged newsprint
const PAPER_DARK: RGB = [238, 229, 205];
const INK: RGB = [25, 21, 18];
const RED: RGB = [164, 31, 31];
const BLUE: RGB = [31, 78, 121];
const BLUE_DK: RGB = [18, 48, 78];
const SEA: RGB = [188, 214, 232];
const SEA_LINE: RGB = [160, 190, 214];
const LAND: RGB = [232, 217, 168];
const LAND_LINE: RGB = [168, 148, 98];
const GREY: RGB = [96, 90, 78];
const WHITE: RGB = [255, 255, 255];
const BLACK: RGB = [0, 0, 0];
const GREEN: RGB = [34, 120, 60];
const GREEN_LT: RGB = [90, 190, 110];
const GOLD: RGB = [201, 162, 39];
const ORANGE: RGB = [224, 122, 26];
const SKY: RGB = [168, 205, 232];

// One RGB framebuffer, row-major.
const px = new Uint8Array(W * H * 3);

function fillCanvas(c: RGB): void {
  for (let i = 0; i < W * H; i++) {
    px[i * 3] = c[0];
    px[i * 3 + 1] = c[1];
    px[i * 3 + 2] = c[2];
  }
}

function setPixel(x: number, y: number, c: RGB): void {
  if (x < 0 || y < 0 || x >= W || y >= H) return;
  const i = (y * W + x) * 3;
  px[i] = c[0];
  px[i + 1] = c[1];
  px[i + 2] = c[2];
}

function rect(x: number, y: number, w: number, h: number, c: RGB): void {
  const x0 = Math.max(0, Math.floor(x));
  const y0 = Math.max(0, Math.floor(y));
  const x1 = Math.min(W, Math.ceil(x + w));
  const y1 = Math.min(H, Math.ceil(y + h));
  for (let yy = y0; yy < y1; yy++) {
    let base = (yy * W + x0) * 3;
    for (let xx = x0; xx < x1; xx++) {
      px[base] = c[0];
      px[base + 1] = c[1];
      px[base + 2] = c[2];
      base += 3;
    }
  }
}

function frame(x: number, y: number, w: number, h: number, c: RGB, t: number): void {
  rect(x, y, w, t, c);
  rect(x, y + h - t, w, t, c);
  rect(x, y, t, h, c);
  rect(x + w - t, y, t, h, c);
}

function hline(x: number, y: number, w: number, c: RGB): void {
  rect(x, y, w, 1, c);
}

function vline(x: number, y: number, h: number, c: RGB): void {
  rect(x, y, 1, h, c);
}

// Bresenham line.
function line(x0: number, y0: number, x1: number, y1: number, c: RGB): void {
  let dx = Math.abs(x1 - x0);
  let dy = -Math.abs(y1 - y0);
  const sx = x0 < x1 ? 1 : -1;
  const sy = y0 < y1 ? 1 : -1;
  let err = dx + dy;
  let x = x0;
  let y = y0;
  for (;;) {
    setPixel(x, y, c);
    if (x === x1 && y === y1) break;
    const e2 = 2 * err;
    if (e2 >= dy) {
      err += dy;
      x += sx;
    }
    if (e2 <= dx) {
      err += dx;
      y += sy;
    }
  }
}

function circle(cx: number, cy: number, r: number, c: RGB, filled: boolean): void {
  if (filled) {
    for (let dy = -r; dy <= r; dy++) {
      const half = Math.floor(Math.sqrt(r * r - dy * dy));
      for (let dx = -half; dx <= half; dx++) setPixel(cx + dx, cy + dy, c);
    }
  } else {
    let x = 0;
    let y = r;
    let d = 3 - 2 * r;
    const plot = (ox: number, oy: number): void => {
      setPixel(cx + ox, cy + oy, c);
      setPixel(cx - ox, cy + oy, c);
      setPixel(cx + ox, cy - oy, c);
      setPixel(cx - ox, cy - oy, c);
      setPixel(cx + oy, cy + ox, c);
      setPixel(cx - oy, cy + ox, c);
      setPixel(cx + oy, cy - ox, c);
      setPixel(cx - oy, cy - ox, c);
    };
    while (y >= x) {
      plot(x, y);
      x++;
      if (d > 0) {
        y--;
        d += 4 * (x - y) + 10;
      } else {
        d += 4 * x + 6;
      }
    }
  }
}

// Filled polygon, scanline fill. pts: [[x,y], ...]
function polyFill(pts: Array<[number, number]>, c: RGB): void {
  let minY = Infinity;
  let maxY = -Infinity;
  for (const p of pts) {
    if (p[1] < minY) minY = p[1];
    if (p[1] > maxY) maxY = p[1];
  }
  for (let y = Math.max(0, Math.ceil(minY)); y <= Math.min(H - 1, Math.floor(maxY)); y++) {
    const xs: number[] = [];
    for (let i = 0; i < pts.length; i++) {
      const a = pts[i];
      const b = pts[(i + 1) % pts.length];
      if ((a[1] <= y && b[1] > y) || (b[1] <= y && a[1] > y)) {
        const t = (y - a[1]) / (b[1] - a[1]);
        xs.push(a[0] + t * (b[0] - a[0]));
      }
    }
    xs.sort((p, q) => p - q);
    for (let k = 0; k + 1 < xs.length; k += 2) {
      const x0 = Math.max(0, Math.ceil(xs[k]));
      const x1 = Math.min(W - 1, Math.floor(xs[k + 1]));
      for (let x = x0; x <= x1; x++) setPixel(x, y, c);
    }
  }
}

function polyOutline(pts: Array<[number, number]>, c: RGB): void {
  for (let i = 0; i < pts.length; i++) {
    const a = pts[i];
    const b = pts[(i + 1) % pts.length];
    line(Math.round(a[0]), Math.round(a[1]), Math.round(b[0]), Math.round(b[1]), c);
  }
}

// Four-point starburst (explosion / sun) centred at cx,cy.
function starburst(cx: number, cy: number, r: number, c: RGB): void {
  for (let i = -r; i <= r; i++) {
    const wdt = Math.max(1, Math.floor((r - Math.abs(i)) / 2));
    for (let dx = -wdt; dx <= wdt; dx++) setPixel(cx + dx, cy + i, c);
    for (let dy = -wdt; dy <= wdt; dy++) setPixel(cx + i, cy + dy, c);
  }
  circle(cx, cy, Math.max(2, Math.floor(r / 3)), c, true);
}

// ---------------------------------------------------------------- PNG ------
const CRC_TABLE: Uint32Array = (() => {
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    table[n] = c >>> 0;
  }
  return table;
})();

function crc32(buf: Buffer): number {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function pngChunk(type: string, data: Buffer): Buffer {
  const out = Buffer.alloc(12 + data.length);
  out.writeUInt32BE(data.length, 0);
  out.write(type, 4, "ascii");
  data.copy(out, 8);
  out.writeUInt32BE(crc32(out.subarray(4, 8 + data.length)), 8 + data.length);
  return out;
}

function encodePNG(): Buffer {
  const raw = Buffer.alloc(H * (1 + W * 3));
  for (let y = 0; y < H; y++) {
    raw[y * (1 + W * 3)] = 0; // filter: none
    const src = px.subarray(y * W * 3, (y + 1) * W * 3);
    raw.set(src, y * (1 + W * 3) + 1);
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(W, 0);
  ihdr.writeUInt32BE(H, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 2; // colour type: RGB
  ihdr[10] = 0;
  ihdr[11] = 0;
  ihdr[12] = 0;
  const idat = deflateSync(raw, { level: 9 });
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    pngChunk("IHDR", ihdr),
    pngChunk("IDAT", idat),
    pngChunk("IEND", Buffer.alloc(0)),
  ]);
}

// ------------------------------------------------------------ bitmap font --
// 5x7 pixel font. Each glyph is one 35-character string: 7 rows of 5 bits,
// "1" = ink, "0" = paper. Written fresh for this entry.
const GLYPHS: Record<string, string> = {
  A: "01110100011000111111100011000110001",
  B: "11110100011000111110100011000111110",
  C: "01110100011000010000100001000101110",
  D: "11110100011000110001100011000111110",
  E: "11111100001000011110100001000011111",
  F: "11111100001000011110100001000010000",
  G: "01110100011000010111100011000101111",
  H: "10001100011000111111100011000110001",
  I: "01110001000010000100001000010001110",
  J: "00111000100001000010000101001001100",
  K: "10001100101010011000101001001010001",
  L: "10000100001000010000100001000011111",
  M: "10001110111010110101100011000110001",
  N: "10001110011010110011100011000110001",
  O: "01110100011000110001100011000101110",
  P: "11110100011000111110100001000010000",
  Q: "01110100011000110001101011001001101",
  R: "11110100011000111110101001001010001",
  S: "01111100001000001110000010000111110",
  T: "11111001000010000100001000010000100",
  U: "10001100011000110001100011000101110",
  V: "10001100011000110001100010101000100",
  W: "10001100011000110101101011101110001",
  X: "10001100010101000100010101000110001",
  Y: "10001100010101000100001000010000100",
  Z: "11111000010001000100010001000011111",
  a: "00000000000111000001011111000101111",
  b: "10000100001111010001100011000111110",
  c: "00000000000111010000100001000101110",
  d: "00001000010111110001100011000101111",
  e: "00000000000111010001111111000001110",
  f: "00110010010100011110010000100001000",
  g: "00000011111000110001011110000101110",
  h: "10000100001111010001100011000110001",
  i: "00100000000110000100001000010001110",
  j: "00010000000011000010000100001001100",
  k: "10000100001001010100110001010010010",
  l: "01100001000010000100001000010001110",
  m: "00000000001101010101101011010110101",
  n: "00000000001111010001100011000110001",
  o: "00000000000111010001100011000101110",
  p: "00000000001111010001100011111010000",
  q: "00000000000111110001100010111100001",
  r: "00000000001011011001100001000010000",
  s: "00000000000111110000011100000111110",
  t: "01000010001110001000010000100000110",
  u: "00000000001000110001100011001101101",
  v: "00000000001000110001100010101000100",
  w: "00000000001000110101101011010101010",
  x: "00000000001000101010001000101010001",
  y: "00000000001000110001011110000101110",
  z: "00000000001111100010001000100011111",
  "0": "01110100011001110101110011000101110",
  "1": "00100011000010000100001000010001110",
  "2": "01110100010000100110010001000011111",
  "3": "11111000100010000010000011000101110",
  "4": "00010001100101010010111110001000010",
  "5": "11111100001111000001000011000101110",
  "6": "00110010001000011110100011000101110",
  "7": "11111000010001000100010001000010000",
  "8": "01110100011000101110100011000101110",
  "9": "01110100011000101111000010001001100",
  " ": "00000000000000000000000000000000000",
  ".": "00000000000000000000000000110001100",
  ",": "000000000000000000000011000010001000",
  ":": "00000011000110000000011000110000000",
  ";": "00000011000110000000011000010001000",
  "!": "00100001000010000100001000000000100",
  "?": "01110100010000100010001000000000100",
  "-": "00000000000000001110000000000000000",
  "'": "00100001000100000000000000000000000",
  '"': "01010010100000000000000000000000000",
  "(": "00010001000100001000010000100000010",
  ")": "01000001000001000010000100010001000",
  $: "00100011111010001110001011111000100",
  "%": "11001110100001000100010000101110011",
  "&": "01100100101010001000101011001001101",
  "/": "00001000100001000100010001000010000",
  "+": "00000001000010001110001000010000000",
  "=": "00000000000111000000011100000000000",
  "·": "00000000000000001100000000000000000",
  "*": "00000010100111001110101000000000000",
};

// Normalise curly punctuation to the ASCII glyphs above.
function normalize(s: string): string {
  return s
    .replace(/[’‘]/g, "'")
    .replace(/[“”]/g, '"')
    .replace(/[—–]/g, "-")
    .replace(/…/g, "...");
}

function drawChar(x: number, y: number, ch: string, scale: number, c: RGB): void {
  const g = GLYPHS[ch] ?? GLYPHS["?"];
  for (let row = 0; row < 7; row++) {
    for (let col = 0; col < 5; col++) {
      if (g[row * 5 + col] === "1") {
        rect(x + col * scale, y + row * scale, scale, scale, c);
      }
    }
  }
}

// Advance of one character, in pixels.
function charAdvance(scale: number): number {
  return 6 * scale;
}

function textWidth(s: string, scale: number): number {
  const t = normalize(s);
  if (t.length === 0) return 0;
  return t.length * charAdvance(scale) - scale;
}

function drawText(x: number, y: number, s: string, scale: number, c: RGB): void {
  const t = normalize(s);
  let cx = x;
  for (const ch of t) {
    drawChar(cx, y, ch, scale, c);
    cx += charAdvance(scale);
  }
}

function drawTextCentered(cx: number, y: number, s: string, scale: number, c: RGB): void {
  drawText(cx - Math.floor(textWidth(s, scale) / 2), y, s, scale, c);
}

function drawTextRight(xRight: number, y: number, s: string, scale: number, c: RGB): void {
  drawText(xRight - textWidth(s, scale), y, s, scale, c);
}

// Greedy word wrap: returns lines that fit maxChars characters each.
function wrap(s: string, maxChars: number): string[] {
  const words = normalize(s).split(" ");
  const lines: string[] = [];
  let cur = "";
  for (const w of words) {
    if (cur === "") {
      cur = w;
    } else if (cur.length + 1 + w.length <= maxChars) {
      cur += " " + w;
    } else {
      lines.push(cur);
      cur = w;
    }
  }
  if (cur !== "") lines.push(cur);
  return lines;
}

// Draw a wrapped block; returns the y just below the last line.
function drawBlock(
  x: number,
  y: number,
  s: string,
  scale: number,
  c: RGB,
  maxChars: number,
  lineH: number,
): number {
  const lines = wrap(s, maxChars);
  for (const ln of lines) {
    drawText(x, y, ln, scale, c);
    y += lineH;
  }
  return y;
}

// A thin caption strip pinned to the bottom of an illustration.
function captionStrip(x: number, y: number, w: number, label: string, bg: RGB): void {
  rect(x, y, w, 11, bg);
  drawTextCentered(x + Math.floor(w / 2), y + 2, label, 1, WHITE);
}

// ------------------------------------------------------------- world map ---
// Simplified continent outlines as [lon, lat] points, drawn in an
// equirectangular projection. Coarse on purpose: the map is ~550 px wide,
// so coastlines are drawn as recognisable silhouettes, not survey data.
type LonLat = [number, number];

const NORTH_AMERICA: LonLat[] = [
  [-168, 66], [-158, 71], [-140, 70], [-130, 71], [-122, 70], [-115, 73],
  [-105, 76], [-95, 80], [-85, 80], [-80, 73], [-76, 70], [-70, 62],
  [-65, 60], [-60, 55], [-55, 52], [-60, 47], [-65, 44], [-70, 42],
  [-74, 40], [-76, 35], [-80, 32], [-81, 26], [-84, 30], [-90, 29],
  [-97, 26], [-97, 16], [-94, 17], [-90, 14], [-86, 12], [-83, 9],
  [-80, 8], [-77, 8], [-82, 9], [-86, 11], [-90, 13], [-95, 16],
  [-97, 16], [-105, 20], [-110, 23], [-114, 28], [-117, 33], [-122, 37],
  [-124, 42], [-124, 48], [-130, 55], [-135, 58], [-145, 60], [-155, 58],
  [-162, 55], [-168, 60],
];

const GREENLAND: LonLat[] = [
  [-58, 64], [-45, 60], [-40, 64], [-32, 68], [-25, 70], [-20, 74],
  [-30, 78], [-45, 80], [-58, 76], [-60, 70],
];

const SOUTH_AMERICA: LonLat[] = [
  [-80, 9], [-77, 4], [-80, -3], [-81, -6], [-77, -12], [-72, -18],
  [-70, -23], [-70, -30], [-72, -37], [-73, -44], [-70, -50], [-66, -55],
  [-68, -52], [-65, -45], [-62, -40], [-57, -35], [-50, -30], [-41, -23],
  [-39, -17], [-35, -9], [-35, -6], [-40, -3], [-44, -2], [-50, 0],
  [-53, 4], [-58, 6], [-62, 9], [-68, 11], [-72, 12], [-77, 8],
];

const AFRICA: LonLat[] = [
  [-17, 15], [-17, 21], [-15, 27], [-10, 31], [-5, 35], [0, 36],
  [10, 37], [11, 34], [20, 32], [30, 31], [32, 31], [35, 28],
  [37, 22], [39, 20], [43, 12], [48, 11], [51, 10], [51, 2],
  [48, -2], [42, -5], [40, -10], [40, -15], [36, -20], [33, -26],
  [28, -33], [20, -35], [17, -32], [15, -27], [13, -20], [12, -15],
  [13, -10], [9, -1], [9, 4], [4, 6], [-8, 5], [-13, 8], [-17, 12],
];

const EURASIA: LonLat[] = [
  [-9, 37], [-9, 43], [-2, 44], [-1, 46], [-4, 48], [-2, 50],
  [0, 51], [3, 53], [8, 55], [8, 57], [10, 59], [5, 60],
  [6, 62], [12, 65], [18, 69], [25, 71], [30, 70], [38, 68],
  [44, 68], [50, 69], [56, 69], [62, 70], [68, 73], [73, 73],
  [78, 72], [84, 74], [90, 75], [96, 76], [103, 77], [110, 74],
  [116, 73], [122, 72], [128, 71], [134, 71], [140, 72], [147, 72],
  [153, 71], [158, 70], [162, 69], [170, 66], [178, 65], [178, 62],
  [170, 60], [163, 60], [158, 52], [156, 51], [150, 59], [143, 59],
  [141, 52], [138, 46], [135, 43], [131, 42], [128, 38], [126, 35],
  [122, 38], [121, 32], [120, 28], [116, 24], [110, 20], [108, 18],
  [106, 10], [104, 9], [101, 7], [99, 9], [97, 15], [94, 17],
  [92, 21], [89, 22], [87, 21], [84, 18], [80, 14], [77, 8],
  [76, 10], [73, 16], [70, 21], [67, 24], [64, 25], [60, 25],
  [57, 26], [54, 27], [52, 28], [50, 29], [48, 30], [44, 29],
  [41, 31], [39, 32], [36, 36], [34, 36], [30, 36], [27, 37],
  [26, 38], [23, 36], [22, 37], [19, 40], [16, 42], [14, 44],
  [12, 44], [9, 44], [6, 43], [3, 43], [0, 40], [-1, 38],
  [-5, 36],
];

const AUSTRALIA: LonLat[] = [
  [113, -22], [114, -30], [115, -33], [118, -35], [124, -33], [129, -32],
  [132, -32], [135, -35], [138, -35], [140, -38], [145, -38], [150, -37],
  [153, -32], [153, -27], [150, -23], [146, -19], [142, -15], [142, -11],
  [140, -17], [136, -15], [135, -12], [132, -11], [130, -13], [126, -14],
  [122, -17], [118, -20],
];

const UK: LonLat[] = [
  [-5, 50], [-3, 53], [-5, 56], [-3, 58], [-1, 57], [0, 53], [1, 51], [-2, 50],
];

const JAPAN: LonLat[] = [
  [130, 31], [132, 33], [135, 34], [137, 35], [139, 37], [140, 39],
  [141, 41], [142, 42], [144, 44], [141, 45], [140, 44], [138, 39],
  [136, 37], [133, 35], [130, 33],
];

const BORNEO: LonLat[] = [
  [109, 1], [113, 4], [117, 2], [119, -1], [117, -4], [113, -3], [110, -2],
];

const SUMATRA: LonLat[] = [
  [95, 5], [100, 0], [104, -3], [106, -6], [104, -6], [100, -2], [97, 3],
];

const NEW_GUINEA: LonLat[] = [
  [131, -1], [136, -2], [141, -3], [146, -6], [150, -8], [147, -9],
  [143, -8], [139, -8], [135, -4], [132, -2],
];

const JAVA: LonLat[] = [
  [105, -6], [110, -7], [114, -8], [114, -9], [108, -8],
];

const MADAGASCAR: LonLat[] = [
  [44, -16], [47, -15], [50, -16], [50, -20], [47, -25], [44, -25], [43, -21],
];

const NEW_ZEALAND: LonLat[] = [
  [167, -45], [170, -43], [173, -41], [175, -38], [177, -38], [174, -41],
  [171, -43], [168, -46],
];

const CONTINENTS: LonLat[][] = [
  NORTH_AMERICA, GREENLAND, SOUTH_AMERICA, AFRICA, EURASIA, AUSTRALIA,
  UK, JAPAN, BORNEO, SUMATRA, NEW_GUINEA, JAVA, MADAGASCAR, NEW_ZEALAND,
];

// Map frame (set by drawWorldMap before projecting pins).
let MAP_X = 0;
let MAP_Y = 0;
let MAP_W = 0;
let MAP_H = 0;

function project(lon: number, lat: number): [number, number] {
  const x = MAP_X + ((lon + 180) / 360) * MAP_W;
  const y = MAP_Y + ((78 - lat) / 136) * MAP_H;
  return [x, y];
}

function drawWorldMap(x: number, y: number, w: number, h: number): void {
  MAP_X = x;
  MAP_Y = y;
  MAP_W = w;
  MAP_H = h;
  rect(x, y, w, h, SEA);
  // Graticule every 30 degrees.
  for (let lon = -150; lon <= 150; lon += 30) {
    const gx = Math.round(x + ((lon + 180) / 360) * w);
    for (let yy = y; yy < y + h; yy += 2) setPixel(gx, yy, SEA_LINE);
  }
  for (let lat = -60; lat <= 60; lat += 30) {
    const gy = Math.round(y + ((78 - lat) / 136) * h);
    for (let xx = x; xx < x + w; xx += 2) setPixel(xx, gy, SEA_LINE);
  }
  for (const cont of CONTINENTS) {
    const pts: Array<[number, number]> = cont.map(([lo, la]) => project(lo, la));
    polyFill(pts, LAND);
    polyOutline(pts, LAND_LINE);
  }
  frame(x, y, w, h, INK, 2);
}

// A numbered pin: red disc, white number, optional pixel offset with a
// leader line back to the true point (used where two stories share a city).
function drawPin(n: number, lon: number, lat: number, dx: number, dy: number): void {
  const [px0, py0] = project(lon, lat);
  const cx = Math.round(px0) + dx;
  const cy = Math.round(py0) + dy;
  if (dx !== 0 || dy !== 0) line(Math.round(px0), Math.round(py0), cx, cy, RED);
  circle(cx, cy, 8, RED, true);
  circle(cx, cy, 8, WHITE, false);
  const label = String(n);
  drawText(cx - Math.floor(textWidth(label, 1) / 2), cy - 3, label, 1, WHITE);
}

// ---------------------------------------------------------- illustrations --
// Every illustration is drawn with code into its own framed panel.
// (x, y) is the panel's top-left corner; w/h its size. Each panel ends
// with a caption strip naming the place or subject, like a photo credit.

function panelBase(x: number, y: number, w: number, h: number, bg: RGB): void {
  rect(x, y, w, h, bg);
  frame(x, y, w, h, INK, 1);
}

function flagUS(x: number, y: number, w: number, h: number): void {
  for (let i = 0; i < 7; i++) {
    rect(x, y + Math.floor((i * h) / 7), w, Math.ceil(h / 7), i % 2 === 0 ? [178, 34, 34] : WHITE);
  }
  rect(x, y, Math.floor(w * 0.4), Math.floor(h * 0.55), [30, 50, 110]);
  for (let r = 0; r < 3; r++) {
    for (let c = 0; c < 4; c++) {
      setPixel(x + 3 + c * 4, y + 3 + r * 4, WHITE);
    }
  }
}

function flagCN(x: number, y: number, w: number, h: number): void {
  rect(x, y, w, h, [222, 41, 16]);
  starburst(x + 6, y + 6, 4, [255, 222, 0]);
  setPixel(x + w - 5, y + 3, [255, 222, 0]);
  setPixel(x + w - 4, y + 6, [255, 222, 0]);
  setPixel(x + w - 5, y + 9, [255, 222, 0]);
}

function flagRU(x: number, y: number, w: number, h: number): void {
  rect(x, y, w, Math.ceil(h / 3), WHITE);
  rect(x, y + Math.floor(h / 3), w, Math.ceil(h / 3), [0, 57, 166]);
  rect(x, y + Math.floor((2 * h) / 3), w, Math.ceil(h / 3), [213, 0, 50]);
}

function drawFigure(x: number, y: number, suit: RGB, skin: RGB): void {
  circle(x + 5, y + 4, 4, skin, true); // head
  rect(x, y + 9, 10, 12, suit); // torso
  rect(x + 1, y + 21, 3, 8, INK); // legs
  rect(x + 6, y + 21, 3, 8, INK);
}

// 1 — Trump, Xi and Putin: three flags over a summit table in Shenzhen.
function illoSummit(x: number, y: number, w: number, h: number): void {
  panelBase(x, y, w, h, SKY);
  // Shenzhen skyline behind.
  const skyline: Array<[number, number, number]> = [
    [0, 46, 26], [30, 38, 20], [54, 52, 30], [88, 34, 22], [114, 44, 26],
    [144, 36, 20], [168, 50, 28], [200, 40, 22], [226, 48, 24], [254, 36, 20],
    [278, 46, 26],
  ];
  for (const [bx, bh, bw] of skyline) {
    rect(x + bx, y + h - 12 - bh, bw, bh, [110, 118, 128]);
    for (let wy = y + h - 12 - bh + 4; wy < y + h - 14; wy += 6) {
      for (let wx = x + bx + 3; wx < x + bx + bw - 3; wx += 6) setPixel(wx, wy, [255, 220, 120]);
    }
  }
  rect(x, y + h - 12, w, 12, [90, 70, 50]);
  // Three flags on poles.
  const fw = 34;
  const fh = 22;
  const fy = y + 10;
  flagUS(x + 18, fy, fw, fh);
  flagCN(x + Math.floor(w / 2) - 17, fy, fw, fh);
  flagRU(x + w - 18 - fw, fy, fw, fh);
  vline(x + 18 + Math.floor(fw / 2), fy + fh, 14, INK);
  vline(x + Math.floor(w / 2), fy + fh, 14, INK);
  vline(x + w - 18 - Math.floor(fw / 2), fy + fh, 14, INK);
  // Summit table with three leaders.
  rect(x + 60, y + 52, w - 120, 8, [120, 84, 50]);
  rect(x + 64, y + 60, 4, 14, [80, 56, 32]);
  rect(x + w - 68, y + 60, 4, 14, [80, 56, 32]);
  drawFigure(x + 84, y + 40, [40, 60, 120], [232, 190, 150]);
  drawFigure(x + Math.floor(w / 2) - 5, y + 40, [150, 30, 30], [232, 190, 150]);
  drawFigure(x + w - 96, y + 40, [50, 50, 50], [232, 190, 150]);
  captionStrip(x, y + h - 11, w, "SHENZHEN", BLUE_DK);
}

// 2 — Anthropic IPO: a green board of rising bars, $81.3B, ticker ANT.
function illoIPO(x: number, y: number, w: number, h: number): void {
  panelBase(x, y, w, h, [12, 60, 36]);
  const bars = [12, 20, 16, 28, 36, 48, 62];
  const bw = 26;
  const gap = 10;
  const baseY = y + h - 26;
  for (let i = 0; i < bars.length; i++) {
    const bx = x + 16 + i * (bw + gap);
    rect(bx, baseY - bars[i], bw, bars[i], i === bars.length - 1 ? GREEN_LT : [40, 140, 80]);
  }
  line(x + 14, baseY - 14, x + w - 16, baseY - 66, [255, 220, 90]);
  drawText(x + 14, y + 8, "$81.3B", 2, WHITE);
  drawText(x + 14, y + 30, "BIGGEST IPO EVER", 1, [190, 230, 200]);
  drawTextRight(x + w - 14, y + 8, "ANT", 2, [255, 220, 90]);
  drawTextRight(x + w - 14, y + 30, "NASDAQ", 1, [190, 230, 200]);
  drawText(x + 14, y + h - 24, "$1.5 TRILLION VALUE", 1, [255, 220, 90]);
}

// 3 — Voyager 1: gold probe, sun, stars, one light-day out.
function illoVoyager(x: number, y: number, w: number, h: number): void {
  panelBase(x, y, w, h, [4, 6, 18]);
  const stars: Array<[number, number]> = [
    [12, 10], [30, 26], [52, 8], [70, 20], [92, 12], [120, 30], [150, 8],
    [180, 22], [210, 10], [240, 28], [268, 12], [296, 24], [40, 48], [160, 46],
    [230, 48], [280, 44],
  ];
  for (const [sx, sy] of stars) setPixel(x + sx, y + sy, WHITE);
  // The Sun, bottom left.
  circle(x + 34, y + h - 30, 12, [255, 210, 60], true);
  for (let a = 0; a < 8; a++) {
    const ang = (a * Math.PI) / 4;
    line(
      x + 34 + Math.round(Math.cos(ang) * 15), y + h - 30 + Math.round(Math.sin(ang) * 15),
      x + 34 + Math.round(Math.cos(ang) * 21), y + h - 30 + Math.round(Math.sin(ang) * 21),
      [255, 210, 60],
    );
  }
  // The probe: gold dish, bus, boom.
  const px0 = x + 190;
  const py0 = y + 34;
  line(px0, py0, px0 + 60, py0 - 16, [200, 200, 200]);
  circle(px0 + 64, py0 - 18, 3, [220, 220, 220], true);
  rect(px0 - 6, py0 - 6, 26, 12, [201, 162, 39]);
  circle(px0 - 12, py0, 10, [230, 190, 80], true);
  circle(px0 - 12, py0, 10, GOLD, false);
  line(px0 + 20, py0 + 4, px0 + 52, py0 + 22, [180, 180, 180]);
  rect(px0 + 50, py0 + 20, 14, 6, [200, 200, 200]);
  // Dotted signal path back to Earth.
  for (let i = 0; i < 12; i++) {
    const tx = x + 60 + i * 10;
    const ty = y + h - 34 - i * 3;
    setPixel(tx, ty, [140, 200, 255]);
    setPixel(tx + 1, ty, [140, 200, 255]);
  }
  drawText(x + 12, y + 8, "1 LIGHT-DAY", 2, WHITE);
  drawText(x + 12, y + 30, "25.9 BILLION KM OUT", 1, [160, 200, 240]);
  captionStrip(x, y + h - 11, w, "NO SCIENCE DATA SINCE 14 NOV", BLUE_DK);
}

// 4 — Kerch Bridge: deck, pillars, a blast on the rail section.
function illoBridge(x: number, y: number, w: number, h: number): void {
  panelBase(x, y, w, h, SKY);
  rect(x, y + 46, w, h - 46, [70, 130, 180]); // sea
  for (let i = 0; i < 8; i++) {
    const wx = x + 12 + i * 24;
    hline(wx, y + 56 + (i % 3) * 6, 14, [140, 190, 230]);
  }
  // Deck and pillars.
  rect(x, y + 34, w, 8, [90, 90, 95]);
  rect(x, y + 42, w, 3, [60, 60, 65]);
  for (const px0 of [24, 64, 104, 144, 184]) {
    rect(x + px0, y + 45, 8, 22, [70, 70, 75]);
  }
  // Rail section on the deck.
  rect(x + 120, y + 28, 52, 6, [50, 50, 55]);
  // Blast: orange starburst + smoke.
  starburst(x + 146, y + 24, 12, ORANGE);
  starburst(x + 146, y + 24, 6, [255, 220, 60]);
  circle(x + 132, y + 10, 5, GREY, true);
  circle(x + 142, y + 6, 6, [120, 116, 108], true);
  circle(x + 154, y + 10, 4, GREY, true);
  drawText(x + 8, y + 6, "KERCH STRAIT", 1, INK);
  captionStrip(x, y + h - 11, w, "RAIL TRAFFIC HALTED", BLUE_DK);
}

// 5 — The Gulf: coastline, Bahrain pin, missile trail, radar arcs.
function illoGulf(x: number, y: number, w: number, h: number): void {
  panelBase(x, y, w, h, [120, 180, 215]);
  const coast: Array<[number, number]> = [
    [0, 0], [70, 0], [80, 14], [96, 22], [120, 20], [150, 30],
    [170, 44], [190, 44], [190, 78], [0, 78],
  ];
  polyFill(coast.map(([cx, cy]) => [x + cx, y + cy] as [number, number]), LAND);
  polyOutline(coast.map(([cx, cy]) => [x + cx, y + cy] as [number, number]), LAND_LINE);
  // Bahrain pin.
  circle(x + 150, y + 34, 5, RED, true);
  circle(x + 150, y + 34, 5, WHITE, false);
  drawText(x + 120, y + 20, "BAHRAIN", 1, INK);
  // Missile trail from the east.
  line(x + 188, y + 12, x + 158, y + 30, [255, 120, 40]);
  line(x + 188, y + 12, x + 162, y + 26, [255, 120, 40]);
  starburst(x + 156, y + 32, 5, [255, 200, 60]);
  // Radar arcs bottom left.
  for (let r = 6; r <= 18; r += 6) {
    for (let a = 0; a <= 90; a += 6) {
      const ang = (a * Math.PI) / 180;
      setPixel(x + 14 + Math.round(Math.cos(ang) * r), y + h - 22 - Math.round(Math.sin(ang) * r), [30, 60, 110]);
    }
  }
  drawText(x + 8, y + 6, "THE GULF", 1, INK);
  captionStrip(x, y + h - 11, w, "IRAN HITS GULF STATES", BLUE_DK);
}

// 6 — The Hague: the Peace Palace colonnade and the scales of justice.
function illoCourt(x: number, y: number, w: number, h: number): void {
  panelBase(x, y, w, h, [226, 216, 188]);
  // Pediment.
  polyFill(
    [
      [x + 30, y + 26], [x + w - 30, y + 26], [x + Math.floor(w / 2), y + 8],
    ] as Array<[number, number]>,
    [250, 246, 232],
  );
  rect(x + 28, y + 26, w - 56, 4, [250, 246, 232]);
  // Columns.
  for (const cx of [40, 70, 100, 130, 160]) {
    rect(x + cx, y + 30, 10, 30, [250, 246, 232]);
    rect(x + cx - 2, y + 28, 14, 3, [220, 212, 190]);
    rect(x + cx - 2, y + 60, 14, 3, [220, 212, 190]);
  }
  rect(x + 20, y + 63, w - 40, 4, [220, 212, 190]);
  rect(x + 14, y + 67, w - 28, 3, [200, 190, 168]);
  // Scales of justice, right side.
  const sx = x + w - 34;
  const sy = y + 16;
  vline(sx, sy, 22, INK);
  hline(sx - 12, sy + 2, 24, INK);
  line(sx - 12, sy + 2, sx - 16, sy + 12, INK);
  line(sx - 12, sy + 2, sx - 8, sy + 12, INK);
  line(sx + 12, sy + 2, sx + 8, sy + 12, INK);
  line(sx + 12, sy + 2, sx + 16, sy + 12, INK);
  rect(sx - 19, sy + 12, 6, 2, GOLD);
  rect(sx + 13, sy + 12, 6, 2, GOLD);
  drawText(x + 8, y + 6, "THE HAGUE", 1, INK);
  captionStrip(x, y + h - 11, w, "GAMBIA v MYANMAR", BLUE_DK);
}

// 7 — Van Gogh: a framed "Chataigniers en fleurs" with a red price tag.
function illoVanGogh(x: number, y: number, w: number, h: number): void {
  panelBase(x, y, w, h, [210, 196, 160]);
  // Gold frame.
  frame(x + 26, y + 8, w - 52, h - 30, GOLD, 5);
  // Sky and blossom.
  rect(x + 31, y + 13, w - 62, h - 40, [120, 170, 215]);
  const blossoms: Array<[number, number, number, RGB]> = [
    [52, 30, 12, [110, 170, 90]], [80, 22, 14, [240, 230, 220]],
    [108, 32, 12, [120, 180, 100]], [136, 24, 13, [245, 235, 225]],
    [66, 46, 11, [100, 160, 85]], [120, 48, 12, [235, 225, 215]],
    [94, 40, 10, [115, 175, 95]],
  ];
  for (const [bx, by, br, bc] of blossoms) circle(x + bx, y + by, br, bc, true);
  // Trunk and ground.
  rect(x + 88, y + 44, 8, h - 66, [90, 60, 35]);
  rect(x + 31, y + h - 34, w - 62, 12, [120, 150, 80]);
  // Red price tag.
  rect(x + w - 62, y + 10, 48, 14, RED);
  drawText(x + w - 58, y + 13, "$190.4M", 1, WHITE);
  drawText(x + 8, y + 6, "SOTHEBY'S", 1, INK);
  captionStrip(x, y + h - 11, w, "RECORD FOR VAN GOGH", BLUE_DK);
}

// 8 — Cyclone Akvan: a spiral over the Odisha coast, rain, evacuation.
function illoCyclone(x: number, y: number, w: number, h: number): void {
  panelBase(x, y, w, h, [150, 190, 220]);
  // Coastline at the bottom.
  polyFill(
    [
      [x, y + h], [x, y + h - 18], [x + 50, y + h - 26], [x + 110, y + h - 16],
      [x + 150, y + h - 24], [x + w, y + h - 12], [x + w, y + h],
    ] as Array<[number, number]>,
    LAND,
  );
  // Spiral arms.
  const cx = x + 92;
  const cy = y + 34;
  for (let a = 0; a < 540; a += 6) {
    const ang = (a * Math.PI) / 180;
    const r = 4 + a * 0.045;
    const px0 = Math.round(cx + Math.cos(ang) * r);
    const py0 = Math.round(cy + Math.sin(ang) * r * 0.8);
    setPixel(px0, py0, WHITE);
    setPixel(px0 + 1, py0, WHITE);
  }
  circle(cx, cy, 5, WHITE, true);
  // Rain streaks.
  for (let i = 0; i < 10; i++) {
    const rx = x + 12 + i * 18;
    line(rx, y + 56 + (i % 3) * 2, rx - 3, y + 64 + (i % 3) * 2, [220, 235, 245]);
  }
  drawText(x + 8, y + 6, "315 KM/H", 1, INK);
  drawTextRight(x + w - 8, y + 6, "CAT 3", 1, RED);
  captionStrip(x, y + h - 11, w, "100,000 EVACUATED", BLUE_DK);
}

// 9 — COP31 Antalya: globe, leaves, a row of flags, a negotiating table.
function illoCOP(x: number, y: number, w: number, h: number): void {
  panelBase(x, y, w, h, [200, 225, 200]);
  // Globe.
  circle(x + 52, y + 36, 24, [70, 140, 200], true);
  circle(x + 46, y + 30, 7, GREEN, true);
  circle(x + 60, y + 42, 9, GREEN, true);
  circle(x + 44, y + 44, 5, GREEN, true);
  // Leaves.
  for (const [lx, ly] of [[96, 22], [108, 30], [92, 38]] as Array<[number, number]>) {
    polyFill(
      [
        [x + lx, y + ly], [x + lx + 10, y + ly - 4], [x + lx + 14, y + ly + 4], [x + lx + 4, y + ly + 8],
      ] as Array<[number, number]>,
      [40, 130, 60],
    );
  }
  // Flag row.
  const flagCols: RGB[] = [[200, 40, 40], [40, 90, 200], [240, 200, 40], [40, 140, 70], [150, 60, 160]];
  for (let i = 0; i < flagCols.length; i++) {
    const fx = x + 126 + i * 13;
    vline(fx + 5, y + 16, 26, INK);
    rect(fx, y + 16, 11, 8, flagCols[i]);
  }
  // Table with papers.
  rect(x + 120, y + 48, 62, 6, [140, 100, 60]);
  rect(x + 126, y + 44, 12, 4, WHITE);
  rect(x + 146, y + 44, 12, 4, WHITE);
  rect(x + 166, y + 44, 12, 4, WHITE);
  drawText(x + 8, y + 6, "ANTALYA", 1, INK);
  captionStrip(x, y + h - 11, w, "MINISTERS PUSH TO UNBLOCK TALKS", BLUE_DK);
}

// 10 — Wall Street: a dark board, Dow down, Nasdaq up.
function illoMarkets(x: number, y: number, w: number, h: number): void {
  panelBase(x, y, w, h, [16, 20, 24]);
  drawText(x + 10, y + 8, "DOW", 1, [180, 180, 180]);
  drawText(x + 10, y + 8, "        -561", 1, [255, 90, 80]);
  drawText(x + 10, y + 22, "S&P 500  -0.23%", 1, [255, 90, 80]);
  drawText(x + 10, y + 36, "NASDAQ  +0.42%", 1, [110, 230, 130]);
  // Mini chart: falls, then rises.
  const pts: Array<[number, number]> = [
    [10, 58], [30, 60], [50, 64], [70, 62], [90, 66], [110, 63],
    [130, 58], [150, 56], [170, 52],
  ];
  for (let i = 0; i + 1 < pts.length; i++) {
    line(x + pts[i][0], y + pts[i][1], x + pts[i + 1][0], y + pts[i + 1][1], [255, 220, 90]);
  }
  drawText(x + 10, y + h - 22, "FED MINUTES HAWKISH", 1, [180, 180, 180]);
  captionStrip(x, y + h - 11, w, "WALL STREET", BLUE_DK);
}

// 11 — Strait of Hormuz: a tanker threading a narrow strait, flame.
function illoHormuz(x: number, y: number, w: number, h: number): void {
  panelBase(x, y, w, h, [120, 180, 215]);
  // Land on both sides, leaving a strait in the middle.
  polyFill(
    [
      [x, y], [x + 70, y], [x + 60, y + 30], [x + 78, y + 55], [x + 66, y + h],
      [x, y + h],
    ] as Array<[number, number]>,
    LAND,
  );
  polyFill(
    [
      [x + w, y], [x + 140, y], [x + 130, y + 26], [x + 148, y + 52], [x + 136, y + h],
      [x + w, y + h],
    ] as Array<[number, number]>,
    LAND,
  );
  // Tanker in the strait.
  rect(x + 78, y + 34, 56, 10, [40, 40, 46]);
  rect(x + 84, y + 26, 10, 8, [200, 60, 50]);
  rect(x + 98, y + 28, 8, 6, [240, 200, 60]);
  rect(x + 110, y + 28, 8, 6, [60, 140, 90]);
  rect(x + 122, y + 28, 8, 6, [240, 200, 60]);
  rect(x + 78, y + 44, 56, 2, [20, 20, 24]);
  // Flame above the tanker: energy at risk.
  starburst(x + 168, y + 18, 7, ORANGE);
  starburst(x + 168, y + 18, 3, [255, 220, 60]);
  drawText(x + 8, y + 6, "HORMUZ", 1, INK);
  captionStrip(x, y + h - 11, w, "TOP ENERGY THREAT: IEA", BLUE_DK);
}

// 12 — IMF: a big 4.7% over a globe, with small per-cent marks.
function illoIMF(x: number, y: number, w: number, h: number): void {
  panelBase(x, y, w, h, [232, 226, 200]);
  circle(x + Math.floor(w / 2), y + 40, 26, [150, 190, 220], true);
  circle(x + Math.floor(w / 2) - 8, y + 32, 7, GREEN, true);
  circle(x + Math.floor(w / 2) + 9, y + 46, 8, GREEN, true);
  drawTextCentered(x + Math.floor(w / 2), y + 8, "INFLATION", 1, INK);
  drawText(x + 52, y + 30, "4.7%", 3, RED);
  drawText(x + 14, y + 58, "%", 1, GREY);
  drawText(x + w - 22, y + 58, "%", 1, GREY);
  drawText(x + 14, y + 20, "%", 1, GREY);
  drawText(x + w - 22, y + 20, "%", 1, GREY);
  captionStrip(x, y + h - 11, w, "IMF AT APEC SHENZHEN", BLUE_DK);
}

// 13 — Bangladesh: a house burning at night, smoke over Dhaka.
function illoBangladesh(x: number, y: number, w: number, h: number): void {
  panelBase(x, y, w, h, [28, 26, 40]);
  // Stars.
  for (const [sx, sy] of [[14, 8], [40, 14], [70, 6], [120, 12], [160, 8], [180, 18]] as Array<[number, number]>) {
    setPixel(x + sx, y + sy, WHITE);
  }
  // House silhouette.
  polyFill(
    [
      [x + 60, y + 34], [x + 130, y + 34], [x + 142, y + 48], [x + 142, y + h - 12],
      [x + 48, y + h - 12], [x + 48, y + 48],
    ] as Array<[number, number]>,
    [16, 14, 22],
  );
  rect(x + 88, y + 52, 14, h - 64, [60, 40, 20]);
  // Flames on the roof.
  starburst(x + 76, y + 30, 9, ORANGE);
  starburst(x + 104, y + 26, 11, [255, 170, 40]);
  starburst(x + 122, y + 32, 7, ORANGE);
  starburst(x + 104, y + 26, 4, [255, 230, 120]);
  // Smoke.
  circle(x + 96, y + 14, 5, GREY, true);
  circle(x + 108, y + 8, 6, [120, 116, 108], true);
  drawText(x + 8, y + 6, "DHAKA", 1, WHITE);
  captionStrip(x, y + h - 11, w, "VIOLENCE IN 28 DISTRICTS", BLUE_DK);
}

// ------------------------------------------------------------- the news ----
// 13 illustrated stories. Headlines and decks are taken from the verified
// prep file for Thursday 19 November 2026; nothing here is 17/18 November
// news, and no figure is invented.
type Illo = (x: number, y: number, w: number, h: number) => void;

interface Story {
  n: number;
  kicker: string;
  head: string;
  deck: string;
  illo: Illo;
}

const STORIES: Story[] = [
  {
    n: 1,
    kicker: "1 APEC · SUMMIT",
    head: "Trump, Xi and Putin meet in Shenzhen",
    deck: "First three-way meeting of the three leaders; nuclear arms, Ukraine and the Iran war on the agenda. Xi pledges $20m for Asia-Pacific cooperation.",
    illo: illoSummit,
  },
  {
    n: 2,
    kicker: "2 TECH · MARKETS",
    head: "Anthropic IPO: $81.3bn, the biggest ever",
    deck: "Shares priced at $83; debuts on Nasdaq as ANT at a $1.5 trillion valuation, passing SpaceX's record as the biggest IPO ever.",
    illo: illoIPO,
  },
  {
    n: 3,
    kicker: "3 SPACE",
    head: "Voyager 1 reaches one light-day",
    deck: "First human-made object 25.9 billion km out - a 24-hour light signal - but it has sent no science data since 14 November.",
    illo: illoVoyager,
  },
  {
    n: 4,
    kicker: "4 UKRAINE · WAR",
    head: "Ukraine hits Kerch Bridge for a third time",
    deck: "Rail section struck; train traffic halted across the bridge.",
    illo: illoBridge,
  },
  {
    n: 5,
    kicker: "5 THE GULF · WAR",
    head: "Iran strikes Gulf states after US hit",
    deck: "IRGC claims a hit on a US radar in Bahrain; Houthi missile fired at Saudi Arabia.",
    illo: illoGulf,
  },
  {
    n: 6,
    kicker: "6 THE HAGUE · JUSTICE",
    head: "World Court rules on Rohingya genocide",
    deck: "Gambia v Myanmar: the ICJ rules on the 2017 crackdown that drove 730,000+ Rohingya away.",
    illo: illoCourt,
  },
  {
    n: 7,
    kicker: "7 ART · AUCTION",
    head: "Van Gogh sells for $190.4m record",
    deck: "'Chataigniers en fleurs' (1890) sells at Sotheby's New York, a record for the painter.",
    illo: illoVanGogh,
  },
  {
    n: 8,
    kicker: "8 INDIA · WEATHER",
    head: "Cyclone Akvan hits India; 100,000 flee",
    deck: "Landfall near Gopalpur, Odisha; red alert in three districts of Andhra Pradesh.",
    illo: illoCyclone,
  },
  {
    n: 9,
    kicker: "9 ANTALYA · CLIMATE",
    head: "COP31 ministers push to break deadlock",
    deck: "Vanuatu presses for reform of climate talks; IPCC warns on delayed reports.",
    illo: illoCOP,
  },
  {
    n: 10,
    kicker: "10 US · MARKETS",
    head: "Wall Street mixed; Dow falls 561",
    deck: "Dow -1.11% to 50,198; S&P 500 down a fifth day; Nasdaq +0.42%. Nvidia -2.9%.",
    illo: illoMarkets,
  },
  {
    n: 11,
    kicker: "11 ENERGY",
    head: "IEA: Hormuz crisis tops energy threats",
    deck: "Annual report warns the Strait crisis is the biggest threat to energy security.",
    illo: illoHormuz,
  },
  {
    n: 12,
    kicker: "12 ECONOMY",
    head: "IMF: world inflation stands at 4.7%",
    deck: "Kristalina Georgieva tells the APEC summit in Shenzhen: global inflation is 4.7%.",
    illo: illoIMF,
  },
  {
    n: 13,
    kicker: "13 BANGLADESH",
    head: "Bangladesh in turmoil; Yunus home torched",
    deck: "Ancestral home of Muhammad Yunus burned; violence reported in 28 districts.",
    illo: illoBangladesh,
  },
];

// 30 more stories, one line each, numbered 14-43 in the digest column.
// All from the same verified prep file for 19 November 2026.
const DIGEST: string[] = [
  "14 UK sends 1,000 long-range drones to Ukraine",
  "15 EU proposes 45bn euro loan for Ukraine",
  "16 US and Venezuela sign military pact",
  "17 IAEA: North Korea expands uranium enrichment",
  "18 South Korea's Lee calls for new talks with Pyongyang",
  "19 South Korea and China expand cultural exchanges",
  "20 589m children live in conflict zones",
  "21 Pew: Muslims to outnumber Christians by 2035",
  "22 Israel delays E1 settlement; settler kills woman",
  "23 Uganda landslide victims seek justice at UN",
  "24 Australia sanctions Israeli settlements",
  "25 Spain: police clash with protesters in strike",
  "26 India and Japan hold 4th 2+2 dialogue in Tokyo",
  "27 GTA VI launches in India at midnight, Rs 5,999",
  "28 Webb confirms first-of-kind star merger in Andromeda",
  "29 Brightest gamma-ray burst spectrum rebuilt",
  "30 India begin Wellington Test vs New Zealand",
  "31 PV Sindhu back in world top 5 after 4 years",
  "32 Microsoft offers buyout to 60,000 staff",
  "33 Gold $3,725.90 (-3.58%); oil $82.09 (-4.56%)",
  "34 Bitcoin $63,478 (-2.18%); dollar at year's high",
  "35 Amazon +3.97%, Tesla +0.92% in same session",
  "36 Taj Mahal free entry on 19 Nov (Heritage Week)",
  "37 Pakistan minister leads delegation to Delhi",
  "38 UK abolishes leasehold in England and Wales",
  "39 Google refuses UK order to remove Brand videos",
  "40 NASA announces Northrop Grumman CRS-25 launch",
  "41 Darwin Port row flares as Albanese meets Xi",
  "42 Trump meets Putin for 40 minutes separately",
  "43 Houthi missile fired at southern Saudi Arabia",
];

// Where each illustrated story sits on the world map [lon, lat, dx, dy].
// dx/dy shift a pin off its true point with a leader line when two stories
// share one city (Shenzhen: 1 and 13; New York: 8 and 11).
const PINS: Array<[number, number, number, number, number]> = [
  [1, 114.0, 22.5, 0, 0], // Shenzhen summit
  [2, 33.5, 45.2, 0, 0], // Kerch Bridge
  [3, 50.6, 26.2, 0, 0], // Bahrain
  [4, 4.4, 52.1, 0, 0], // The Hague
  [5, 90.4, 23.8, 0, 0], // Dhaka
  [6, 30.7, 36.9, 0, 0], // Antalya
  [7, -122.4, 37.8, 0, 0], // San Francisco (Anthropic)
  [8, -74.0, 40.7, 0, 0], // New York (Sotheby's)
  [9, -150.0, -25.0, 0, 0], // Voyager 1, deep space over the Pacific
  [10, 84.9, 19.3, 0, 0], // Gopalpur, Odisha
  [11, -74.0, 40.7, 12, 8], // Wall Street, offset from pin 8
  [12, 56.5, 26.6, 0, 0], // Strait of Hormuz
  [13, 114.0, 22.5, -12, 10], // APEC Shenzhen, offset from pin 1
];

// ---------------------------------------------------------------- layout ---
const MARGIN = 12;
const CW = W - MARGIN * 2; // 1000 px of content width

function doubleRule(y: number): void {
  hline(MARGIN, y, CW, INK);
  hline(MARGIN, y + 3, CW, INK);
}

function drawLeadRow(y0: number, stories: Story[]): number {
  const colW = 322;
  const gap = 17;
  const illoH = 100;
  for (let i = 0; i < stories.length; i++) {
    const s = stories[i];
    const x = MARGIN + i * (colW + gap);
    s.illo(x, y0, colW, illoH);
    let y = y0 + illoH + 6;
    drawText(x, y, s.kicker, 1, RED);
    y += 10;
    y = drawBlock(x, y, s.head, 3, INK, 17, 24);
    y += 2;
    y = drawBlock(x, y, s.deck, 1, INK, 53, 9);
    void y;
  }
  return y0 + illoH + 6 + 10 + 3 * 24 + 2 + 3 * 9 + 4;
}

function drawSmallRow(y0: number, stories: Story[]): number {
  const colW = 192;
  const gap = 10;
  const illoH = 78;
  for (let i = 0; i < stories.length; i++) {
    const s = stories[i];
    const x = MARGIN + i * (colW + gap);
    s.illo(x, y0, colW, illoH);
    let y = y0 + illoH + 5;
    drawText(x, y, s.kicker, 1, RED);
    y += 9;
    y = drawBlock(x, y, s.head, 2, INK, 16, 16);
    y += 2;
    y = drawBlock(x, y, s.deck, 1, INK, 32, 9);
    void y;
  }
  return y0 + illoH + 5 + 9 + 3 * 16 + 2 + 3 * 9 + 4;
}

function drawPage(): void {
  fillCanvas(PAPER);
  // Outer double border.
  frame(4, 4, W - 8, H - 8, INK, 1);
  frame(7, 7, W - 14, H - 14, INK, 1);

  // Kicker strip.
  drawText(MARGIN, 14, "THE WORLD'S NEWS IN ONE PICTURE", 1, RED);
  drawTextRight(MARGIN + CW, 14, "43 STORIES · 6 CONTINENTS · ALL FROM THURSDAY", 1, RED);

  // Masthead.
  drawText(MARGIN, 26, "Thursday 19 November 2026", 6, INK);
  doubleRule(76);

  // Lead row: the three biggest stories.
  let y = drawLeadRow(84, STORIES.slice(0, 3));
  hline(MARGIN, y, CW, INK);
  y += 6;

  // Two rows of five smaller stories.
  y = drawSmallRow(y, STORIES.slice(3, 8));
  hline(MARGIN, y, CW, INK);
  y += 6;
  y = drawSmallRow(y, STORIES.slice(8, 13));
  hline(MARGIN, y, CW, INK);
  y += 6;

  // Map + digest.
  const mapY = y + 2;
  drawText(MARGIN, mapY, "WHERE IT HAPPENED", 1, RED);
  drawText(MARGIN + 584, mapY, "ALSO ON THURSDAY 19 NOVEMBER", 1, RED);
  const mapH = 262;
  drawWorldMap(MARGIN, mapY + 12, 560, mapH);
  for (const [n, lon, lat, dx, dy] of PINS) drawPin(n, lon, lat, dx, dy);
  // Legend under the map.
  drawText(MARGIN, mapY + 12 + mapH + 6, "Numbered pins mark stories 1-13.", 1, GREY);
  drawText(MARGIN, mapY + 12 + mapH + 16, "Voyager 1 (9) is one light-day out, over the Pacific.", 1, GREY);

  // Digest column: 30 stories, one line each.
  let dy = mapY + 12;
  for (const item of DIGEST) {
    drawText(MARGIN + 584, dy, item, 1, INK);
    dy += 9;
  }

  // Footer.
  const fy = H - 26;
  hline(MARGIN, fy - 6, CW, INK);
  drawTextCentered(
    Math.floor(W / 2),
    fy,
    "Every story here happened or was first reported on Thursday 19 November 2026.",
    1,
    INK,
  );
  drawTextCentered(
    Math.floor(W / 2),
    fy + 10,
    "43 stories · 13 illustrated · Sources: AP, Reuters, BBC, NYT, APEC, NASA, Sotheby's, IEA, IMF.",
    1,
    GREY,
  );
}

// ------------------------------------------------------------------ main ---
function main(): void {
  drawPage();
  const png = encodePNG();
  const outDir = process.env.MAKEFUN_OUTPUT_DIR ?? ".";
  mkdirSync(outDir, { recursive: true });
  const outPath = join(outDir, "entry.png");
  writeFileSync(outPath, png);
  console.log(`wrote ${outPath} (${png.length} bytes, ${W}x${H})`);
}

main();
