'use client';

import * as THREE from 'three';
import type { Theme, ThemeId } from './types';

// Draws a small, thematic "museum plaque photo" for each room's infographic.
// Output is a canvas texture that can be applied to a plane inside the panel.

const TEX_SIZE = 256;

const textureCache = new Map<ThemeId, THREE.CanvasTexture>();

type Painter = (
    ctx: CanvasRenderingContext2D,
    W: number,
    H: number,
    theme: Theme,
) => void;

function bg(ctx: CanvasRenderingContext2D, W: number, H: number, a: string, b: string) {
    const g = ctx.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, a);
    g.addColorStop(1, b);
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);
}

function noiseDust(
    ctx: CanvasRenderingContext2D,
    W: number,
    H: number,
    density = 0.02,
    alpha = 0.25,
) {
    const n = Math.floor(W * H * density);
    ctx.fillStyle = `rgba(255,255,255,${alpha})`;
    for (let i = 0; i < n; i++) {
        const x = Math.random() * W;
        const y = Math.random() * H;
        const s = Math.random() < 0.92 ? 1 : 2;
        ctx.fillRect(x, y, s, s);
    }
}

// ---------------------------------------------------------------------------
// Per-theme painters
// ---------------------------------------------------------------------------

const paintUfo: Painter = (ctx, W, H, theme) => {
    bg(ctx, W, H, '#050812', '#0d1020');
    // stars
    ctx.fillStyle = 'rgba(255,255,255,0.7)';
    for (let i = 0; i < 70; i++) {
        ctx.fillRect(Math.random() * W, Math.random() * H * 0.7, 1, 1);
    }
    // horizon
    ctx.fillStyle = '#05060b';
    ctx.fillRect(0, H * 0.72, W, H * 0.28);
    ctx.strokeStyle = theme.accentColor;
    ctx.globalAlpha = 0.25;
    ctx.lineWidth = 1;
    for (let i = 1; i <= 10; i++) {
        const y = H * 0.72 + i * 3;
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(W, y);
        ctx.stroke();
    }
    ctx.globalAlpha = 1;
    // disc
    const cx = W * 0.5;
    const cy = H * 0.45;
    ctx.fillStyle = '#111318';
    ctx.beginPath();
    ctx.ellipse(cx, cy, W * 0.28, H * 0.055, 0, 0, Math.PI * 2);
    ctx.fill();
    // dome
    ctx.fillStyle = theme.accentColor;
    ctx.beginPath();
    ctx.ellipse(cx, cy - 4, W * 0.12, H * 0.05, 0, Math.PI, 0);
    ctx.fill();
    // under-glow beam
    const grad = ctx.createLinearGradient(cx, cy, cx, H);
    grad.addColorStop(0, theme.accentColor + 'aa');
    grad.addColorStop(1, theme.accentColor + '00');
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.moveTo(cx - 10, cy + 3);
    ctx.lineTo(cx - 46, H);
    ctx.lineTo(cx + 46, H);
    ctx.lineTo(cx + 10, cy + 3);
    ctx.closePath();
    ctx.fill();
    noiseDust(ctx, W, H, 0.004, 0.18);
};

const paintAI: Painter = (ctx, W, H, theme) => {
    bg(ctx, W, H, '#0a0905', '#15110a');
    // grid
    ctx.strokeStyle = 'rgba(255,180,80,0.14)';
    ctx.lineWidth = 1;
    for (let x = 0; x <= W; x += 16) {
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, H);
        ctx.stroke();
    }
    for (let y = 0; y <= H; y += 16) {
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(W, y);
        ctx.stroke();
    }
    // neural net: 3 layers of dots with connecting lines
    const layers = 3;
    const nodesPerLayer = [4, 5, 4];
    const nodes: { x: number; y: number }[][] = [];
    for (let l = 0; l < layers; l++) {
        const col: { x: number; y: number }[] = [];
        const x = (l + 1) * (W / (layers + 1));
        for (let i = 0; i < nodesPerLayer[l]; i++) {
            const y = (i + 1) * (H / (nodesPerLayer[l] + 1));
            col.push({ x, y });
        }
        nodes.push(col);
    }
    ctx.strokeStyle = theme.accentColor + '55';
    ctx.lineWidth = 1;
    for (let l = 0; l < layers - 1; l++) {
        for (const a of nodes[l]) {
            for (const b of nodes[l + 1]) {
                ctx.beginPath();
                ctx.moveTo(a.x, a.y);
                ctx.lineTo(b.x, b.y);
                ctx.stroke();
            }
        }
    }
    for (const col of nodes) {
        for (const n of col) {
            ctx.fillStyle = theme.accentColor;
            ctx.beginPath();
            ctx.arc(n.x, n.y, 4, 0, Math.PI * 2);
            ctx.fill();
            ctx.fillStyle = '#fff';
            ctx.beginPath();
            ctx.arc(n.x - 1, n.y - 1, 1.2, 0, Math.PI * 2);
            ctx.fill();
        }
    }
    noiseDust(ctx, W, H, 0.006, 0.15);
};

const paintForbidden: Painter = (ctx, W, H, theme) => {
    bg(ctx, W, H, '#0b0814', '#140820');
    // faint concentric circles
    ctx.strokeStyle = theme.accentColor + '44';
    ctx.lineWidth = 1;
    const cx = W / 2;
    const cy = H / 2;
    for (let r = 20; r < W * 0.6; r += 16) {
        ctx.beginPath();
        ctx.arc(cx, cy, r, 0, Math.PI * 2);
        ctx.stroke();
    }
    // tree of life - 10 sephirot positions on a 3-pillar layout
    const sephirot: [number, number][] = [
        [cx, cy - 80], // Kether
        [cx - 36, cy - 55], // Binah
        [cx + 36, cy - 55], // Chokmah
        [cx - 36, cy - 15], // Geburah
        [cx + 36, cy - 15], // Chesed
        [cx, cy - 5], // Tiphereth
        [cx - 36, cy + 25], // Hod
        [cx + 36, cy + 25], // Netzach
        [cx, cy + 55], // Yesod
        [cx, cy + 85], // Malkuth
    ];
    // connecting paths
    ctx.strokeStyle = theme.accentColor + 'aa';
    ctx.lineWidth = 1.2;
    const paths: [number, number][] = [
        [0, 1],
        [0, 2],
        [1, 2],
        [1, 3],
        [2, 4],
        [3, 4],
        [1, 5],
        [2, 5],
        [3, 5],
        [4, 5],
        [3, 6],
        [4, 7],
        [5, 6],
        [5, 7],
        [6, 7],
        [5, 8],
        [6, 8],
        [7, 8],
        [8, 9],
    ];
    for (const [a, b] of paths) {
        ctx.beginPath();
        ctx.moveTo(sephirot[a][0], sephirot[a][1]);
        ctx.lineTo(sephirot[b][0], sephirot[b][1]);
        ctx.stroke();
    }
    for (const [x, y] of sephirot) {
        ctx.fillStyle = '#0b0814';
        ctx.beginPath();
        ctx.arc(x, y, 7, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = theme.accentColor;
        ctx.lineWidth = 1.5;
        ctx.stroke();
    }
    noiseDust(ctx, W, H, 0.004, 0.2);
};

const paintMycelium: Painter = (ctx, W, H, theme) => {
    bg(ctx, W, H, '#0a1009', '#131a11');
    ctx.strokeStyle = theme.accentColor + 'aa';
    ctx.lineWidth = 1.1;
    const branch = (x: number, y: number, len: number, angle: number, depth: number) => {
        if (depth <= 0 || len < 3) return;
        const x2 = x + Math.cos(angle) * len;
        const y2 = y + Math.sin(angle) * len;
        ctx.globalAlpha = Math.max(0.25, depth / 7);
        ctx.beginPath();
        ctx.moveTo(x, y);
        ctx.lineTo(x2, y2);
        ctx.stroke();
        const nlen = len * 0.72;
        branch(x2, y2, nlen, angle - 0.5 + (Math.random() - 0.5) * 0.3, depth - 1);
        branch(x2, y2, nlen, angle + 0.5 + (Math.random() - 0.5) * 0.3, depth - 1);
        if (Math.random() < 0.35) branch(x2, y2, nlen * 0.8, angle, depth - 1);
    };
    branch(W / 2, H - 10, 40, -Math.PI / 2, 7);
    ctx.globalAlpha = 1;
    // spore dots
    ctx.fillStyle = theme.accentColor + '99';
    for (let i = 0; i < 25; i++) {
        const x = Math.random() * W;
        const y = Math.random() * H * 0.8;
        ctx.beginPath();
        ctx.arc(x, y, 1 + Math.random() * 1.5, 0, Math.PI * 2);
        ctx.fill();
    }
};

const paintMirror: Painter = (ctx, W, H, theme) => {
    bg(ctx, W, H, '#181820', '#0c0c10');
    const cx = W / 2;
    const cy = H / 2;
    ctx.strokeStyle = theme.accentColor;
    for (let i = 0; i < 16; i++) {
        const s = (i + 1) / 16;
        const off = i * 2.5;
        ctx.globalAlpha = 1 - s;
        ctx.lineWidth = 1;
        ctx.strokeRect(cx - s * W * 0.4 + off, cy - s * H * 0.4, s * W * 0.8, s * H * 0.8);
    }
    ctx.globalAlpha = 1;
    noiseDust(ctx, W, H, 0.008, 0.18);
};

const paintLibrary: Painter = (ctx, W, H, theme) => {
    bg(ctx, W, H, '#2a1a0f', '#3a2514');
    // book spines
    const spines = 14;
    for (let i = 0; i < spines; i++) {
        const w = W / spines;
        const x = i * w;
        const hVar = H * (0.6 + (i % 3) * 0.12);
        const hue = 15 + (i * 23) % 40;
        ctx.fillStyle = `hsl(${hue},40%,${20 + (i % 4) * 6}%)`;
        ctx.fillRect(x + 1, H - hVar, w - 2, hVar);
        // gold band
        ctx.fillStyle = theme.accentColor;
        ctx.globalAlpha = 0.75;
        ctx.fillRect(x + 2, H - hVar + 18, w - 4, 3);
        ctx.fillRect(x + 2, H - hVar + hVar * 0.35, w - 4, 2);
        ctx.globalAlpha = 1;
    }
    // shelf
    ctx.fillStyle = '#1b0f08';
    ctx.fillRect(0, H - 8, W, 8);
    noiseDust(ctx, W, H, 0.002, 0.15);
};

const paintOffice: Painter = (ctx, W, H, theme) => {
    bg(ctx, W, H, '#0f1518', '#162023');
    // grid of cubicles
    ctx.strokeStyle = theme.accentColor + '55';
    ctx.lineWidth = 1;
    for (let r = 0; r < 5; r++) {
        for (let c = 0; c < 6; c++) {
            const x = c * (W / 6);
            const y = r * (H / 5);
            ctx.strokeRect(x + 2, y + 2, W / 6 - 4, H / 5 - 4);
            ctx.fillStyle = 'rgba(200,240,240,0.06)';
            ctx.fillRect(x + 6, y + 6, W / 6 - 12, 6);
        }
    }
    // water level
    const waterY = H * 0.55;
    ctx.fillStyle = 'rgba(120,200,210,0.22)';
    ctx.fillRect(0, waterY, W, H - waterY);
    ctx.strokeStyle = theme.accentColor;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(0, waterY);
    for (let x = 0; x <= W; x += 4) {
        const y = waterY + Math.sin(x * 0.15) * 2;
        ctx.lineTo(x, y);
    }
    ctx.stroke();
};

const paintTangerine: Painter = (ctx, W, H, theme) => {
    bg(ctx, W, H, '#1a0a06', '#3a1506');
    // rays
    ctx.strokeStyle = theme.accentColor + '55';
    ctx.lineWidth = 2;
    const sx = W / 2;
    const sy = H * 0.65;
    for (let i = -6; i <= 6; i++) {
        ctx.beginPath();
        ctx.moveTo(sx, sy);
        ctx.lineTo(sx + i * 28, 0);
        ctx.stroke();
    }
    // half sun
    ctx.fillStyle = theme.accentColor;
    ctx.beginPath();
    ctx.arc(sx, sy, W * 0.28, Math.PI, 0);
    ctx.fill();
    // horizon
    ctx.fillStyle = '#1a0a06';
    ctx.fillRect(0, sy, W, H - sy);
    // ground line
    ctx.strokeStyle = theme.accentColor + '88';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(0, sy);
    ctx.lineTo(W, sy);
    ctx.stroke();
};

const paintPrayers: Painter = (ctx, W, H, theme) => {
    bg(ctx, W, H, '#1a1810', '#252014');
    // arched window
    const aw = W * 0.5;
    const ah = H * 0.7;
    const ax = (W - aw) / 2;
    const ay = H - ah - 10;
    ctx.strokeStyle = theme.accentColor;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(ax, H - 10);
    ctx.lineTo(ax, ay + aw / 2);
    // upper half of arch then break
    ctx.arc(ax + aw / 2, ay + aw / 2, aw / 2, Math.PI, Math.PI * 1.6);
    ctx.stroke();
    // broken right half
    ctx.setLineDash([4, 6]);
    ctx.beginPath();
    ctx.arc(ax + aw / 2, ay + aw / 2, aw / 2, Math.PI * 1.75, 0);
    ctx.lineTo(ax + aw, H - 10);
    ctx.stroke();
    ctx.setLineDash([]);
    // cross within
    ctx.strokeStyle = theme.accentColor + 'aa';
    ctx.lineWidth = 1.5;
    const cx = W / 2;
    const cy = ay + aw * 0.6;
    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.lineTo(cx, cy + 40);
    ctx.moveTo(cx - 14, cy + 12);
    ctx.lineTo(cx + 6, cy + 12);
    ctx.stroke();
};

const paintStatic: Painter = (ctx, W, H, theme) => {
    // TV static
    const img = ctx.getImageData(0, 0, W, H);
    for (let i = 0; i < img.data.length; i += 4) {
        const v = Math.floor(Math.random() * 220);
        img.data[i] = v;
        img.data[i + 1] = v;
        img.data[i + 2] = v;
        img.data[i + 3] = 255;
    }
    ctx.putImageData(img, 0, 0);
    // scan lines
    ctx.fillStyle = 'rgba(0,0,0,0.55)';
    for (let y = 0; y < H; y += 3) ctx.fillRect(0, y, W, 1);
    // antenna silhouette
    ctx.strokeStyle = theme.accentColor;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(W * 0.3, H);
    ctx.lineTo(W * 0.5, H * 0.25);
    ctx.lineTo(W * 0.7, H);
    ctx.stroke();
    // cross beam
    ctx.beginPath();
    ctx.moveTo(W * 0.5, H * 0.25);
    ctx.lineTo(W * 0.35, H * 0.2);
    ctx.moveTo(W * 0.5, H * 0.25);
    ctx.lineTo(W * 0.65, H * 0.2);
    ctx.stroke();
};

const paintBone: Painter = (ctx, W, H, theme) => {
    bg(ctx, W, H, '#1a1812', '#2a2619');
    // bone tree silhouette
    ctx.strokeStyle = '#e8ded0';
    ctx.lineWidth = 2;
    const stem = (x: number, y: number, len: number, angle: number, depth: number) => {
        if (depth <= 0) return;
        const x2 = x + Math.cos(angle) * len;
        const y2 = y + Math.sin(angle) * len;
        ctx.lineWidth = Math.max(1, depth * 0.5);
        ctx.beginPath();
        ctx.moveTo(x, y);
        ctx.lineTo(x2, y2);
        ctx.stroke();
        // knuckle
        ctx.beginPath();
        ctx.arc(x2, y2, 3, 0, Math.PI * 2);
        ctx.stroke();
        const nl = len * 0.65;
        stem(x2, y2, nl, angle - 0.5, depth - 1);
        stem(x2, y2, nl, angle + 0.5, depth - 1);
    };
    stem(W / 2, H - 5, 48, -Math.PI / 2, 5);
    // skull suggestion
    ctx.fillStyle = '#d6cabc';
    ctx.beginPath();
    ctx.ellipse(W / 2, H * 0.8, 8, 10, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = theme.accentColor + '66';
    ctx.fillRect(W / 2 - 4, H * 0.78, 3, 3);
    ctx.fillRect(W / 2 + 1, H * 0.78, 3, 3);
};

const paintVending: Painter = (ctx, W, H, theme) => {
    bg(ctx, W, H, '#300608', '#4e0d10');
    // chassis
    ctx.fillStyle = '#1f0305';
    ctx.fillRect(W * 0.12, H * 0.08, W * 0.76, H * 0.84);
    // slots
    const cols = 4;
    const rows = 5;
    const sx = W * 0.16;
    const sy = H * 0.12;
    const sw = (W * 0.68) / cols;
    const sh = (H * 0.58) / rows;
    for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
            const x = sx + c * sw;
            const y = sy + r * sh;
            ctx.fillStyle = '#2a0607';
            ctx.fillRect(x + 2, y + 2, sw - 4, sh - 4);
            if ((r + c) % 3 !== 0) {
                ctx.fillStyle = theme.accentColor;
                ctx.fillRect(x + sw * 0.3, y + sh * 0.35, sw * 0.4, sh * 0.35);
            }
        }
    }
    // glow strip
    ctx.fillStyle = theme.accentColor;
    ctx.fillRect(W * 0.14, H * 0.73, W * 0.72, 3);
};

const paintHollowSaint: Painter = (ctx, W, H, theme) => {
    bg(ctx, W, H, '#181612', '#241f17');
    const cx = W / 2;
    const cy = H / 2;
    // halo
    ctx.strokeStyle = theme.accentColor;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(cx, cy, W * 0.3, 0, Math.PI * 2);
    ctx.stroke();
    ctx.lineWidth = 1;
    for (let r = W * 0.32; r < W * 0.45; r += 3) {
        ctx.globalAlpha = 1 - (r - W * 0.32) / (W * 0.13);
        ctx.beginPath();
        ctx.arc(cx, cy, r, 0, Math.PI * 2);
        ctx.stroke();
    }
    ctx.globalAlpha = 1;
    // empty body: dashed outline
    ctx.setLineDash([3, 5]);
    ctx.strokeStyle = theme.accentColor + '88';
    ctx.beginPath();
    ctx.moveTo(cx - 18, cy + 20);
    ctx.lineTo(cx - 18, H - 10);
    ctx.lineTo(cx + 18, H - 10);
    ctx.lineTo(cx + 18, cy + 20);
    ctx.stroke();
    ctx.setLineDash([]);
};

const paintLastColor: Painter = (ctx, W, H, theme) => {
    bg(ctx, W, H, '#0c0a14', '#181228');
    const cx = W / 2;
    const cy = H / 2;
    const slices = 8;
    for (let i = 0; i < slices; i++) {
        const a0 = (i / slices) * Math.PI * 2 - Math.PI / 2;
        const a1 = ((i + 1) / slices) * Math.PI * 2 - Math.PI / 2;
        ctx.beginPath();
        ctx.moveTo(cx, cy);
        ctx.arc(cx, cy, W * 0.32, a0, a1);
        ctx.closePath();
        if (i === 3) {
            ctx.fillStyle = '#000';
        } else {
            ctx.fillStyle = `hsl(${(i / slices) * 360},70%,55%)`;
        }
        ctx.fill();
    }
    // redacted bar
    ctx.fillStyle = '#000';
    ctx.fillRect(cx - 40, cy - 8, 80, 16);
    ctx.strokeStyle = theme.accentColor;
    ctx.lineWidth = 1;
    ctx.strokeRect(cx - 40, cy - 8, 80, 16);
};

const paintCarpet: Painter = (ctx, W, H, theme) => {
    bg(ctx, W, H, '#3d2a0e', '#543a15');
    const size = 24;
    for (let y = 0; y < H; y += size) {
        for (let x = 0; x < W; x += size) {
            ctx.strokeStyle = theme.accentColor + '55';
            ctx.beginPath();
            ctx.moveTo(x, y + size / 2);
            ctx.lineTo(x + size / 2, y);
            ctx.lineTo(x + size, y + size / 2);
            ctx.lineTo(x + size / 2, y + size);
            ctx.closePath();
            ctx.stroke();
            ctx.fillStyle = theme.accentColor + '22';
            ctx.fillRect(x + size / 2 - 1, y + size / 2 - 1, 2, 2);
        }
    }
    noiseDust(ctx, W, H, 0.004, 0.12);
};

const paintTiledSea: Painter = (ctx, W, H, theme) => {
    bg(ctx, W, H, '#0a2533', '#1a425a');
    const size = 20;
    ctx.strokeStyle = theme.accentColor + '55';
    for (let y = 0; y < H; y += size) {
        for (let x = 0; x < W; x += size) {
            ctx.strokeRect(x, y, size, size);
        }
    }
    // waves overlay
    ctx.strokeStyle = '#d8eef7';
    ctx.lineWidth = 1.4;
    for (let row = 0; row < 6; row++) {
        const y = H * (0.15 + row * 0.14);
        ctx.beginPath();
        for (let x = 0; x <= W; x += 4) {
            const yy = y + Math.sin((x + row * 10) * 0.1) * 3;
            if (x === 0) ctx.moveTo(x, yy);
            else ctx.lineTo(x, yy);
        }
        ctx.stroke();
    }
};

const paintFractalChapel: Painter = (ctx, W, H, theme) => {
    // deep cosmic background
    const g = ctx.createRadialGradient(W / 2, H / 2, 0, W / 2, H / 2, W / 1.1);
    g.addColorStop(0, '#28003e');
    g.addColorStop(0.7, '#08002a');
    g.addColorStop(1, '#02000a');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);

    const cx = W / 2;
    const cy = H / 2;

    // rainbow petal rays
    const petals = 24;
    for (let i = 0; i < petals; i++) {
        const ang = (i / petals) * Math.PI * 2;
        const hue = (i / petals) * 360;
        ctx.fillStyle = `hsla(${hue}, 100%, 58%, 0.38)`;
        ctx.beginPath();
        ctx.moveTo(cx, cy);
        ctx.arc(cx, cy, W * 0.46, ang - Math.PI / petals, ang + Math.PI / petals);
        ctx.closePath();
        ctx.fill();
    }

    // concentric spectrum rings
    for (let r = 10; r < W * 0.48; r += 5) {
        const hue = (r * 8) % 360;
        ctx.strokeStyle = `hsla(${hue}, 90%, 65%, 0.55)`;
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.arc(cx, cy, r, 0, Math.PI * 2);
        ctx.stroke();
    }

    // flower of life
    ctx.strokeStyle = 'rgba(255,255,255,0.9)';
    ctx.lineWidth = 1.25;
    const rCircle = 18;
    ctx.beginPath();
    ctx.arc(cx, cy, rCircle, 0, Math.PI * 2);
    ctx.stroke();
    for (let i = 0; i < 6; i++) {
        const ang = i * (Math.PI / 3);
        ctx.beginPath();
        ctx.arc(
            cx + Math.cos(ang) * rCircle,
            cy + Math.sin(ang) * rCircle,
            rCircle,
            0,
            Math.PI * 2,
        );
        ctx.stroke();
    }

    // all-seeing eye
    ctx.fillStyle = '#fff';
    ctx.beginPath();
    ctx.ellipse(cx, cy, 12, 8, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#080010';
    ctx.beginPath();
    ctx.arc(cx, cy, 5, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = theme.accentColor;
    ctx.beginPath();
    ctx.arc(cx, cy, 2.2, 0, Math.PI * 2);
    ctx.fill();

    // radiating triangles (alex-grey style circuit hints)
    ctx.strokeStyle = 'rgba(255,255,255,0.35)';
    ctx.lineWidth = 0.8;
    for (let i = 0; i < 12; i++) {
        const a = (i / 12) * Math.PI * 2;
        ctx.beginPath();
        ctx.moveTo(cx + Math.cos(a) * 22, cy + Math.sin(a) * 22);
        ctx.lineTo(cx + Math.cos(a) * W * 0.45, cy + Math.sin(a) * W * 0.45);
        ctx.stroke();
    }
};

const paintMarine: Painter = (ctx, W, H, theme) => {
    // Depth-column gradient: sunlit surface at top, inky abyss at bottom.
    const g = ctx.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0.0, '#8fd6e0');
    g.addColorStop(0.18, '#4a9cb0');
    g.addColorStop(0.45, '#134f6b');
    g.addColorStop(0.75, '#071e33');
    g.addColorStop(1.0, '#02040c');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);

    // Depth rulers (horizontal tick lines with labels on the right edge).
    ctx.strokeStyle = 'rgba(180, 230, 230, 0.35)';
    ctx.lineWidth = 0.6;
    ctx.font = '9px monospace';
    ctx.fillStyle = 'rgba(200, 240, 235, 0.85)';
    const zones: Array<[number, string]> = [
        [0.18, '200m'],
        [0.36, '1000m'],
        [0.62, '4000m'],
        [0.88, '11000m'],
    ];
    for (const [yf, label] of zones) {
        const y = Math.round(H * yf) + 0.5;
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(W, y);
        ctx.stroke();
        ctx.fillText(label, W - 44, y - 3);
    }

    // Floating plankton / particulate.
    for (let i = 0; i < 60; i++) {
        const x = Math.random() * W;
        const y = Math.random() * H;
        const a = 0.1 + Math.random() * 0.3;
        ctx.fillStyle = `rgba(255, 255, 255, ${a})`;
        ctx.beginPath();
        ctx.arc(x, y, Math.random() * 1.2 + 0.3, 0, Math.PI * 2);
        ctx.fill();
    }

    // Jellyfish silhouette near the top.
    const jx = W * 0.28;
    const jy = H * 0.22;
    ctx.fillStyle = 'rgba(255, 220, 230, 0.55)';
    ctx.beginPath();
    ctx.ellipse(jx, jy, 18, 12, 0, Math.PI, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = 'rgba(255, 220, 230, 0.55)';
    ctx.lineWidth = 1;
    for (let i = -3; i <= 3; i++) {
        ctx.beginPath();
        ctx.moveTo(jx + i * 4, jy + 3);
        ctx.bezierCurveTo(
            jx + i * 4 + 2,
            jy + 18,
            jx + i * 4 - 2,
            jy + 26,
            jx + i * 4 + 1,
            jy + 36,
        );
        ctx.stroke();
    }

    // Coelacanth / deep fish in the midnight zone.
    const fx = W * 0.68;
    const fy = H * 0.56;
    ctx.fillStyle = 'rgba(30, 60, 80, 0.95)';
    ctx.beginPath();
    ctx.ellipse(fx, fy, 32, 10, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(fx + 30, fy - 8);
    ctx.lineTo(fx + 46, fy);
    ctx.lineTo(fx + 30, fy + 8);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = theme.accentColor;
    ctx.beginPath();
    ctx.arc(fx - 20, fy - 2, 1.6, 0, Math.PI * 2);
    ctx.fill();

    // Angler fish at the bottom with a glowing lure.
    const ax = W * 0.32;
    const ay = H * 0.82;
    ctx.fillStyle = '#05080c';
    ctx.beginPath();
    ctx.ellipse(ax, ay, 26, 14, 0, 0, Math.PI * 2);
    ctx.fill();
    // teeth
    ctx.fillStyle = '#e0e8ec';
    for (let t = -5; t < 5; t++) {
        ctx.beginPath();
        ctx.moveTo(ax + t * 2.1, ay + 3);
        ctx.lineTo(ax + t * 2.1 + 0.8, ay + 7);
        ctx.lineTo(ax + t * 2.1 + 1.6, ay + 3);
        ctx.closePath();
        ctx.fill();
    }
    // lure
    ctx.strokeStyle = '#ffe488';
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.moveTo(ax - 6, ay - 8);
    ctx.quadraticCurveTo(ax - 14, ay - 22, ax - 8, ay - 26);
    ctx.stroke();
    const lureG = ctx.createRadialGradient(ax - 8, ay - 26, 0, ax - 8, ay - 26, 10);
    lureG.addColorStop(0, 'rgba(255, 240, 150, 1)');
    lureG.addColorStop(1, 'rgba(255, 240, 150, 0)');
    ctx.fillStyle = lureG;
    ctx.beginPath();
    ctx.arc(ax - 8, ay - 26, 10, 0, Math.PI * 2);
    ctx.fill();

    // Trench silhouette at very bottom.
    ctx.fillStyle = '#000104';
    ctx.beginPath();
    ctx.moveTo(0, H);
    ctx.lineTo(0, H - 18);
    ctx.lineTo(W * 0.25, H - 10);
    ctx.lineTo(W * 0.45, H - 22);
    ctx.lineTo(W * 0.7, H - 8);
    ctx.lineTo(W, H - 16);
    ctx.lineTo(W, H);
    ctx.closePath();
    ctx.fill();
};

const PAINTERS: Partial<Record<ThemeId, Painter>> = {
    ufo: paintUfo,
    'ai-history': paintAI,
    'forbidden-knowledge': paintForbidden,
    'mycelium-cathedral': paintMycelium,
    'mirror-loop': paintMirror,
    'infinite-library': paintLibrary,
    'drowned-office': paintOffice,
    'tangerine-void': paintTangerine,
    'hall-of-unfinished-prayers': paintPrayers,
    'static-cathedral': paintStatic,
    'bone-orchard': paintBone,
    'red-vending': paintVending,
    'hollow-saint': paintHollowSaint,
    'last-color': paintLastColor,
    'carpet-forever': paintCarpet,
    'tiled-sea': paintTiledSea,
    'fractal-chapel': paintFractalChapel,
    'marine-biology': paintMarine,
};

function drawFrame(
    ctx: CanvasRenderingContext2D,
    W: number,
    H: number,
    accent: string,
) {
    ctx.strokeStyle = accent;
    ctx.lineWidth = 4;
    ctx.strokeRect(2, 2, W - 4, H - 4);
    ctx.lineWidth = 1;
    ctx.strokeStyle = accent + '55';
    ctx.strokeRect(8, 8, W - 16, H - 16);
    // corner ticks
    ctx.fillStyle = accent;
    const t = 6;
    for (const [cx, cy] of [
        [4, 4],
        [W - 4 - t, 4],
        [4, H - 4 - t],
        [W - 4 - t, H - 4 - t],
    ]) {
        ctx.fillRect(cx, cy, t, t);
    }
}

export function getArtworkTexture(theme: Theme): THREE.CanvasTexture {
    const cached = textureCache.get(theme.id);
    if (cached) return cached;

    const canvas = document.createElement('canvas');
    canvas.width = TEX_SIZE;
    canvas.height = TEX_SIZE;
    const ctx = canvas.getContext('2d');
    if (!ctx) {
        // Fallback: empty texture.
        const tex = new THREE.CanvasTexture(canvas);
        textureCache.set(theme.id, tex);
        return tex;
    }

    const paint = PAINTERS[theme.id];
    if (paint) {
        paint(ctx, TEX_SIZE, TEX_SIZE, theme);
    } else {
        // Generic fallback - gradient with theme accent glyph.
        bg(ctx, TEX_SIZE, TEX_SIZE, '#101018', '#08080c');
        ctx.fillStyle = theme.accentColor;
        ctx.beginPath();
        ctx.arc(TEX_SIZE / 2, TEX_SIZE / 2, 60, 0, Math.PI * 2);
        ctx.fill();
        noiseDust(ctx, TEX_SIZE, TEX_SIZE, 0.01, 0.2);
    }
    drawFrame(ctx, TEX_SIZE, TEX_SIZE, theme.accentColor);

    const tex = new THREE.CanvasTexture(canvas);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.needsUpdate = true;
    textureCache.set(theme.id, tex);
    return tex;
}
