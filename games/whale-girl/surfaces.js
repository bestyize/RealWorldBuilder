import * as THREE from 'three';

export function paintedTexture(w, h, paint) {
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  paint(canvas.getContext('2d'), w, h);
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  return tex;
}

function random(seed) {
  return () => {
    seed = (1664525 * seed + 1013904223) >>> 0;
    return seed / 4294967296;
  };
}

function polygon(ctx, pts, fill) {
  ctx.beginPath();
  pts.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
  ctx.closePath();
  ctx.fillStyle = fill;
  ctx.fill();
}

export function woodGrain() {
  return paintedTexture(384, 128, (c, w, h) => {
    const rand = random(8);
    c.fillStyle = '#f7f3f0';
    c.fillRect(0, 0, w, h);
    for (let i = 0; i < 220; i++) {
      const y = rand() * h,
        r = rand(),
        x = rand() * w - 80;
      c.strokeStyle = r > 0.48 ? '#796a7424' : '#ffffff38';
      c.lineWidth = 0.4 + r;
      c.beginPath();
      c.moveTo(x, y);
      c.bezierCurveTo(x + 50, y - 3, x + 140, y + 4, x + 250, y - 1);
      c.stroke();
    }
  });
}

export function parquet() {
  return paintedTexture(1536, 1536, (c, w, h) => {
    const rand = random(19);
    const tones = ['#bba99e', '#c4af9f', '#c6b3a3', '#bdaba2', '#c7b5ab', '#bcaa9f', '#cbb9ab', '#bca99e'];
    c.fillStyle = '#978784';
    c.fillRect(0, 0, w, h);
    c.translate(w / 2, h / 2);
    c.rotate(Math.PI / 4);
    const size = 24,
      n = 5;
    for (let y = -52; y <= 52; y++)
      for (let x = -52; x <= 52; x++) {
        const phase = (((x + y) % (2 * n)) + 2 * n) % (2 * n);
        if (phase !== 0 && phase !== n) continue;
        c.save();
        c.translate(x * size, y * size);
        if (phase === n) {
          c.translate(size, 0);
          c.rotate(Math.PI / 2);
        }
        c.fillStyle = tones[Math.floor(rand() * tones.length)];
        c.fillRect(0.55, 0.5, n * size - 1, size - 1);
        c.fillStyle = '#ecd3ac55';
        c.fillRect(1, 1, n * size - 2, 0.8);
        for (let i = 0; i < 7; i++) {
          const sy = 2 + rand() * 19,
            sx = rand() * 23;
          c.strokeStyle = i % 2 ? '#776b6f29' : '#f7eee12b';
          c.lineWidth = 0.65;
          c.beginPath();
          c.moveTo(sx, sy);
          c.bezierCurveTo(34, sy - 2, 63, sy + 2.5, 74 + rand() * 44, sy);
          c.stroke();
        }
        c.restore();
      }
  });
}

function rose(c, x, y, r, light, dark) {
  c.save();
  c.translate(x, y);
  c.strokeStyle = light;
  c.lineWidth = Math.max(1, r * 0.018);
  for (const a of [0.62, 0.71, 0.79]) {
    c.beginPath();
    c.arc(0, 0, r * a, 0, Math.PI * 2);
    c.stroke();
  }
  for (let i = 0; i < 8; i++) {
    const len = i % 2 ? 0.67 * r : r,
      base = 0.12 * r;
    polygon(
      c,
      [
        [0, 0],
        [0, -len],
        [-base, -base * 1.6],
      ],
      light
    );
    polygon(
      c,
      [
        [0, 0],
        [0, -len],
        [base, -base * 1.6],
      ],
      dark
    );
    c.rotate(Math.PI / 4);
  }
  c.restore();
}

const continents = [
  [
    [-166, 62],
    [-145, 72],
    [-116, 73],
    [-92, 68],
    [-82, 56],
    [-60, 52],
    [-71, 41],
    [-82, 29],
    [-97, 23],
    [-88, 17],
    [-83, 9],
    [-102, 18],
    [-111, 28],
    [-125, 39],
    [-130, 53],
    [-152, 59],
  ],
  [
    [-82, 12],
    [-68, 11],
    [-50, 1],
    [-35, -7],
    [-45, -23],
    [-57, -36],
    [-68, -55],
    [-74, -45],
    [-72, -27],
    [-80, -8],
  ],
  [
    [-53, 58],
    [-42, 60],
    [-21, 78],
    [-39, 84],
    [-64, 80],
    [-68, 70],
  ],
  [
    [-10, 36],
    [-9, 44],
    [2, 50],
    [10, 57],
    [5, 62],
    [21, 72],
    [29, 69],
    [30, 60],
    [48, 66],
    [76, 73],
    [112, 74],
    [138, 68],
    [175, 65],
    [164, 53],
    [143, 47],
    [129, 38],
    [122, 25],
    [108, 18],
    [104, 8],
    [96, 14],
    [89, 22],
    [80, 8],
    [73, 18],
    [57, 25],
    [49, 12],
    [40, 15],
    [35, 31],
    [24, 39],
    [16, 38],
    [12, 44],
    [3, 42],
  ],
  [
    [-17, 14],
    [-15, 27],
    [-4, 36],
    [13, 37],
    [31, 31],
    [35, 18],
    [50, 11],
    [44, -2],
    [39, -15],
    [28, -34],
    [18, -35],
    [11, -19],
    [9, -3],
    [-1, 4],
    [-12, 7],
  ],
  [
    [112, -22],
    [118, -18],
    [132, -12],
    [138, -17],
    [145, -14],
    [153, -26],
    [150, -37],
    [135, -35],
    [119, -34],
    [113, -28],
  ],
  [
    [48, -13],
    [50, -16],
    [46, -26],
    [44, -24],
  ],
  [
    [130, 31],
    [136, 35],
    [142, 45],
    [145, 44],
    [141, 35],
    [134, 31],
  ],
];

export function globePaper() {
  return paintedTexture(768, 384, (c, w, h) => {
    c.fillStyle = '#5e9794';
    c.fillRect(0, 0, w, h);
    const project = ([x, y]) => [((x + 180) / 360) * w, ((90 - y) / 180) * h];
    for (const shape of continents) {
      polygon(c, shape.map(project), '#d4bd82');
      c.strokeStyle = '#8a805c';
      c.lineWidth = 1.3;
      c.stroke();
    }
    c.strokeStyle = '#d6d0a467';
    c.lineWidth = 0.7;
    for (let x = 0; x < w; x += w / 24) {
      c.beginPath();
      c.moveTo(x, 0);
      c.lineTo(x, h);
      c.stroke();
    }
    for (let y = 0; y < h; y += h / 12) {
      c.beginPath();
      c.moveTo(0, y);
      c.lineTo(w, y);
      c.stroke();
    }
    c.strokeStyle = '#c69a5e';
    c.lineWidth = 2;
    c.beginPath();
    c.moveTo(0, h / 2);
    c.lineTo(w, h / 2);
    c.stroke();
  });
}

export function seaChart() {
  return paintedTexture(640, 448, (c, w, h) => {
    c.fillStyle = '#e9dab0';
    c.fillRect(0, 0, w, h);
    c.strokeStyle = '#a99a783b';
    c.lineWidth = 1;
    for (let x = 22; x < w; x += 32) {
      c.beginPath();
      c.moveTo(x, 12);
      c.lineTo(x, h - 12);
      c.stroke();
    }
    for (let y = 16; y < h; y += 32) {
      c.beginPath();
      c.moveTo(12, y);
      c.lineTo(w - 12, y);
      c.stroke();
    }
    for (const [x, y, scale] of [
      [150, 124, 85],
      [306, 230, 50],
      [373, 165, 20],
      [415, 132, 12],
    ]) {
      for (let band = 3; band >= 0; band--) {
        const pts = [];
        for (let i = 0; i < 82; i++) {
          const a = (i / 82) * Math.PI * 2,
            r =
              scale * (0.82 + 0.23 * Math.sin(3 * a) + 0.12 * Math.cos(5 * a) + 0.04 * Math.sin(13 * a)) +
              band * 6;
          pts.push([x + 1.5 * r * Math.cos(a), y + r * Math.sin(a)]);
        }
        polygon(c, pts, band ? '#dfd6b5' : '#b1b79b');
        c.strokeStyle = band ? '#91a69b' : '#748c79';
        c.lineWidth = 1.5;
        c.stroke();
      }
    }
    c.strokeStyle = '#ac865a88';
    c.lineWidth = 0.8;
    for (let i = 0; i < 16; i++) {
      let a = (i * Math.PI) / 8;
      c.beginPath();
      c.moveTo(495, 285);
      c.lineTo(495 + 740 * Math.cos(a), 285 + 740 * Math.sin(a));
      c.stroke();
    }
    rose(c, 495, 285, 67, '#92734f', '#4a6d69');
    c.strokeStyle = '#88714f';
    c.lineWidth = 3;
    c.strokeRect(12, 12, w - 24, h - 24);
    c.lineWidth = 1;
    c.strokeRect(18, 18, w - 36, h - 36);
    c.fillStyle = '#5c594b';
    c.font = 'italic 23px Georgia, serif';
    c.fillText('Carte des marées', 35, h - 35);
  });
}

export function wallpaper() {
  const tex = paintedTexture(256, 256, (c, w, h) => {
    c.fillStyle = '#e5e7ee';
    c.fillRect(0, 0, w, h);
    const rand = random(64);
    for (let i = 0; i < 4500; i++) {
      c.fillStyle = i % 2 ? '#ffffff23' : '#7d8aa417';
      c.fillRect(rand() * w, rand() * h, 1.5, 0.8);
    }
    // A small shell printed on alternating rows of the paper.
    for (const [x, y] of [
      [64, 68],
      [192, 196],
    ]) {
      c.save();
      c.translate(x, y);
      c.lineWidth = 1.15;
      c.strokeStyle = '#939eb54f';
      c.beginPath();
      c.moveTo(0, 13);
      for (let i = 0; i <= 32; i++) {
        const a = Math.PI * (1.08 + (0.84 * i) / 32),
          r = 25 + 1.4 * Math.cos((i * Math.PI) / 2);
        c.lineTo(Math.cos(a) * r, Math.sin(a) * r);
      }
      c.closePath();
      c.stroke();
      for (let i = 1; i < 8; i++) {
        const a = Math.PI * (1.07 + (0.86 * i) / 8);
        c.beginPath();
        c.moveTo(0, 11);
        c.quadraticCurveTo(Math.cos(a) * 12, -1, Math.cos(a) * 23, Math.sin(a) * 23);
        c.stroke();
      }
      c.fillStyle = '#b2a6947a';
      c.beginPath();
      c.arc(0, 17, 1.9, 0, Math.PI * 2);
      c.fill();
      c.restore();
    }
  });
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(8, 3);
  return tex;
}

export function lace() {
  const tex = paintedTexture(192, 128, (c, w, h) => {
    const tint = c.createLinearGradient(0, 0, 0, h);
    tint.addColorStop(0, '#e2deec');
    tint.addColorStop(0.54, '#fffbf5');
    tint.addColorStop(1, '#f0edf5');
    c.fillStyle = tint;
    c.fillRect(0, 0, w, h);
    c.strokeStyle = '#aca3bc';
    c.lineWidth = 1.7;
    for (const y of [15, 22, 69]) {
      c.beginPath();
      c.moveTo(0, y);
      c.lineTo(w, y);
      c.stroke();
    }
    for (let x = 0; x < w; x += 48) {
      c.beginPath();
      c.moveTo(x, 73);
      c.quadraticCurveTo(x + 24, 118, x + 48, 73);
      c.stroke();
      c.save();
      c.globalCompositeOperation = 'destination-out';
      c.fillStyle = '#000';
      for (const [dx, dy, r] of [
        [12, 85, 2.5],
        [24, 94, 4],
        [36, 85, 2.5],
        [24, 54, 2.3],
      ]) {
        c.beginPath();
        c.ellipse(x + dx, dy, r, r * 1.4, 0, 0, Math.PI * 2);
        c.fill();
      }
      c.restore();
    }
  });
  tex.wrapS = THREE.RepeatWrapping;
  return tex;
}

export function tideNotes() {
  return paintedTexture(768, 520, (c, w, h) => {
    c.fillStyle = '#ece6d8';
    c.fillRect(0, 0, w, h);
    c.fillStyle = '#4b627d';
    c.fillRect(28, 24, w - 56, h - 48);
    c.fillStyle = '#f6eddc';
    c.fillRect(36, 32, w - 72, h - 64);
    c.fillStyle = '#415a78';
    c.font = '36px "Songti SC", serif';
    c.fillText('海湾潮汐手记', 66, 92);
    c.strokeStyle = '#a09182';
    c.lineWidth = 1;
    c.beginPath();
    c.moveTo(65, 106);
    c.lineTo(701, 106);
    c.stroke();
    // Five small observations, drawn in blue ink on the same sheet as the tide curves.
    for (let i = 0; i < 5; i++) {
      const x = 108 + i * 81,
        y = 170,
        r = 21;
      c.fillStyle = '#506885';
      c.beginPath();
      c.arc(x, y, r, 0, Math.PI * 2);
      c.fill();
      c.save();
      c.clip();
      c.fillStyle = '#dfc393';
      if (i === 4) c.fillRect(x - r, y - r, r * 2, r * 2);
      else if (i > 0) {
        c.beginPath();
        c.arc(x, y, r, -Math.PI / 2, Math.PI / 2);
        c.ellipse(x, y, Math.max(0.1, Math.abs(2 - i) * r * 0.58), r, 0, Math.PI / 2, -Math.PI / 2, i < 2);
        c.fill();
      }
      c.restore();
    }
    for (let line = 0; line < 6; line++) {
      c.strokeStyle = '#8096a52e';
      c.beginPath();
      c.moveTo(64, 255 + line * 26);
      c.lineTo(493, 255 + line * 26);
      c.stroke();
    }
    for (const [offset, color] of [
      [0, '#476f91'],
      [0.85, '#aa8778'],
    ]) {
      c.strokeStyle = color;
      c.lineWidth = 2.4;
      c.beginPath();
      for (let x = 0; x < 426; x += 2) {
        const y =
          319 + Math.sin(x / 36 + offset) * (21 + 12 * Math.cos(x / 76)) + 4 * Math.sin(x / 11 + offset);
        if (x === 0) c.moveTo(66 + x, y);
        else c.lineTo(66 + x, y);
      }
      c.stroke();
    }
    // A scallop sketched beside the high-water line.
    c.save();
    c.translate(603, 310);
    c.rotate(-0.19);
    const ribs = 15;
    c.strokeStyle = '#5b6c84';
    c.lineWidth = 3;
    c.beginPath();
    c.moveTo(0, 51);
    for (let i = 0; i <= ribs * 4; i++) {
      const a = Math.PI * (1.04 + (0.92 * i) / (ribs * 4)),
        r = 81 + 3 * Math.cos((i * Math.PI) / 2);
      c.lineTo(Math.cos(a) * r, Math.sin(a) * r);
    }
    c.closePath();
    c.fillStyle = '#d9d0c3';
    c.fill();
    c.stroke();
    for (let i = 1; i < ribs; i++) {
      const a = Math.PI * (1.04 + (0.92 * i) / ribs),
        x = Math.cos(a) * 79,
        y = Math.sin(a) * 79;
      c.lineWidth = i % 2 ? 2 : 1;
      c.beginPath();
      c.moveTo(0, 49);
      c.bezierCurveTo(x * 0.15, 25, x * 0.75, y + 24, x, y);
      c.stroke();
    }
    c.restore();
    c.fillStyle = '#657185';
    c.font = 'italic 19px Georgia,serif';
    c.fillText('Luna  ·  Mare', 67, 446);
  });
}

export function letterPaper() {
  return paintedTexture(384, 464, (c, w, h) => {
    c.fillStyle = '#f9f1e5';
    c.fillRect(0, 0, w, h);
    c.strokeStyle = '#9eafc6';
    c.lineWidth = 2;
    c.strokeRect(13, 14, w - 26, h - 28);
    c.fillStyle = '#536480';
    c.font = '24px "Songti SC", serif';
    c.fillText('见信安。', 38, 104);
    c.fillText('今天海湾涨潮了。', 38, 165);
    c.fillText('等你来看月亮。', 38, 217);
    c.font = 'italic 21px "Songti SC", serif';
    c.fillText('溟月', 279, 314);
    c.strokeStyle = '#8a9eb8';
    c.lineWidth = 2;
    for (let i = 0; i < 3; i++) {
      c.beginPath();
      c.moveTo(57, 350 + i * 11);
      c.bezierCurveTo(91, 322 + i * 11, 107, 375 + i * 11, 145, 348 + i * 11);
      c.stroke();
    }
  });
}
