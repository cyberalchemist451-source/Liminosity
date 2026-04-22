'use client';

import { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import type { RoomSpec } from '@/lib/gallery/types';
import { mulberry32 } from '@/lib/gallery/rng';

type Props = { spec: RoomSpec };

/*
 * Room 8 centerpiece. A floating, photo-realistic-ish model of Mars and its
 * two moons Phobos and Deimos. The globe uses a canvas-painted equirectangular
 * texture so the geology reads at a glance: rust-orange highlands, dark
 * basaltic mare regions (Syrtis Major, Mare Erythraeum, Mare Acidalium), an
 * approximation of Valles Marineris, polar ice caps that breathe slightly,
 * a fine pitting of crater speckles, and a companion height/bump map that
 * gives the surface relief under the room's spotlight.
 *
 * The moons are irregular displaced icosahedra (Phobos and Deimos are both
 * potato-shaped, not spherical). Each follows its own inclined orbit at
 * compressed but proportionally-correct speeds (Phobos whips around Mars
 * about four times for every Deimos orbit).
 */

const TAU = Math.PI * 2;
const MARS_AXIAL_TILT = 25.19 * Math.PI / 180;

// ---------------------------------------------------------------------------
// Procedural texture painters. All canvases are built at mount time inside
// useMemo, so SSR is safe (this is a 'use client' component).
// ---------------------------------------------------------------------------

/** Smooth value-noise sampler on a seeded grid. */
function makeNoise(seed: number) {
    const rng = mulberry32(seed);
    const GRID = 64;
    const vals = new Float32Array(GRID * GRID);
    for (let i = 0; i < vals.length; i++) vals[i] = rng();
    const sample = (u: number, v: number) => {
        const fx = ((u % 1) + 1) % 1;
        const fy = ((v % 1) + 1) % 1;
        const x = fx * GRID;
        const y = fy * GRID;
        const ix = Math.floor(x);
        const iy = Math.floor(y);
        const tx = x - ix;
        const ty = y - iy;
        const sx = tx * tx * (3 - 2 * tx);
        const sy = ty * ty * (3 - 2 * ty);
        const a = vals[(iy % GRID) * GRID + (ix % GRID)];
        const b = vals[(iy % GRID) * GRID + ((ix + 1) % GRID)];
        const c = vals[((iy + 1) % GRID) * GRID + (ix % GRID)];
        const d = vals[((iy + 1) % GRID) * GRID + ((ix + 1) % GRID)];
        return (
            a * (1 - sx) * (1 - sy) +
            b * sx * (1 - sy) +
            c * (1 - sx) * sy +
            d * sx * sy
        );
    };
    return (u: number, v: number, octaves: number, lac = 2.05, gain = 0.5) => {
        let s = 0;
        let amp = 1;
        let freq = 1;
        let norm = 0;
        for (let i = 0; i < octaves; i++) {
            s += amp * sample(u * freq, v * freq);
            norm += amp;
            amp *= gain;
            freq *= lac;
        }
        return s / norm;
    };
}

/** Paint Mars' equirectangular albedo + a companion height/bump map. */
function paintMars(size: number) {
    const W = size;
    const H = size / 2;
    const albedo = document.createElement('canvas');
    albedo.width = W;
    albedo.height = H;
    const bump = document.createElement('canvas');
    bump.width = W;
    bump.height = H;
    const ca = albedo.getContext('2d');
    const cb = bump.getContext('2d');
    if (!ca || !cb) return { albedo, bump };

    const imgA = ca.createImageData(W, H);
    const imgB = cb.createImageData(W, H);
    const noiseA = makeNoise(0x5ad00d);  // macro continents
    const noiseB = makeNoise(0xc0ffee);  // mid detail / dust
    const noiseC = makeNoise(0x13de57);  // crater speckle

    // Anchor "landmarks" (longitude 0-1, latitude -1..1, radius, weight).
    // Approximated from Mars maps so the globe reads as Mars to anyone who
    // has seen a photo of it. Latitude range: 1 = north pole, -1 = south.
    const landmarks: Array<{ u: number; v: number; r: number; darkness: number }> = [
        { u: 0.78, v: 0.05, r: 0.10, darkness: 0.85 }, // Syrtis Major
        { u: 0.10, v: -0.05, r: 0.13, darkness: 0.72 }, // Mare Erythraeum
        { u: 0.92, v: 0.35, r: 0.09, darkness: 0.55 }, // Mare Acidalium
        { u: 0.20, v: 0.30, r: 0.08, darkness: 0.60 }, // Chryse
        { u: 0.50, v: -0.15, r: 0.12, darkness: 0.40 }, // Valles Marineris scar
        { u: 0.37, v: 0.20, r: 0.07, darkness: 0.35 }, // Tharsis shadow
        { u: 0.63, v: -0.42, r: 0.14, darkness: 0.65 }, // Hellas Planitia
    ];

    for (let y = 0; y < H; y++) {
        // v: -1 (south pole) .. +1 (north pole)
        const v = 1 - (y / H) * 2;
        const lat = v * (Math.PI / 2);
        const cosLat = Math.cos(lat);
        for (let x = 0; x < W; x++) {
            const u = x / W;
            // macro noise (geology / albedo variation)
            const nMacro = noiseA(u * 3, v * 1.5, 5, 2.1, 0.55);
            const nMid = noiseB(u * 7, v * 4, 4, 2.2, 0.5);
            const nFine = noiseC(u * 22, v * 14, 3, 2.2, 0.5);

            // Base rust mixing two Mars-accurate albedo samples.
            const darkRust = [0x5a, 0x2a, 0x17];       // iron-rich shadow
            const midRust = [0xa5, 0x55, 0x2d];        // average red
            const briteRust = [0xd9, 0x8b, 0x58];      // butterscotch plain
            const mBase = Math.min(1, Math.max(0, nMacro * 0.7 + nMid * 0.3));
            let r = darkRust[0] * (1 - mBase) + briteRust[0] * mBase;
            let g = darkRust[1] * (1 - mBase) + briteRust[1] * mBase;
            let b = darkRust[2] * (1 - mBase) + briteRust[2] * mBase;
            // Blend in mid-rust to soften extremes
            const midMix = nMid * 0.35;
            r = r * (1 - midMix) + midRust[0] * midMix;
            g = g * (1 - midMix) + midRust[1] * midMix;
            b = b * (1 - midMix) + midRust[2] * midMix;

            // Landmark dark basaltic regions overlay.
            let darkMask = 0;
            for (const L of landmarks) {
                // Great-circle-ish distance using the equirectangular unwrap.
                let du = Math.abs(u - L.u);
                if (du > 0.5) du = 1 - du;            // longitude wrap
                du *= cosLat;                          // compress toward poles
                const dv = v - L.v;
                const d = Math.sqrt(du * du + dv * dv);
                const falloff = Math.max(0, 1 - d / L.r);
                // Roughen the edge with noise so landmarks aren't circles.
                const edgeNoise = noiseB(u * 30 + L.u * 11, v * 30 + L.v * 7, 3) * 0.35;
                darkMask = Math.max(darkMask, falloff * (L.darkness + edgeNoise));
            }
            darkMask = Math.min(1, darkMask);
            const darkness = darkMask * 0.72;
            r *= 1 - darkness;
            g *= 1 - darkness * 0.85;
            b *= 1 - darkness * 0.9;

            // Dust streaks / high-frequency detail
            const dust = (nFine - 0.5) * 22;
            r = Math.max(0, Math.min(255, r + dust));
            g = Math.max(0, Math.min(255, g + dust * 0.8));
            b = Math.max(0, Math.min(255, b + dust * 0.7));

            // Polar caps. Edge wobbles by noise so caps aren't a clean band.
            const capEdge = 0.78 + noiseA(u * 6 + 99, v * 3 + 7, 3) * 0.08;
            const polar = Math.max(0, (Math.abs(v) - capEdge) / (1 - capEdge));
            if (polar > 0) {
                const icy = Math.min(1, polar * 2.2);
                r = r * (1 - icy) + 238 * icy;
                g = g * (1 - icy) + 240 * icy;
                b = b * (1 - icy) + 246 * icy;
            }

            const i = (y * W + x) * 4;
            imgA.data[i] = r | 0;
            imgA.data[i + 1] = g | 0;
            imgA.data[i + 2] = b | 0;
            imgA.data[i + 3] = 255;

            // Bump: high = brighter. Encode surface relief from the same
            // macro/mid noise plus some crater punch. Dark landmarks get a
            // slight depression (negative relief) to fake craters/basins.
            let h = 0.45 + nMacro * 0.25 + nMid * 0.18 + (nFine - 0.5) * 0.15;
            h -= darkMask * 0.2;
            h = Math.max(0, Math.min(1, h));
            const hh = (h * 255) | 0;
            imgB.data[i] = hh;
            imgB.data[i + 1] = hh;
            imgB.data[i + 2] = hh;
            imgB.data[i + 3] = 255;
        }
    }
    ca.putImageData(imgA, 0, 0);
    cb.putImageData(imgB, 0, 0);
    return { albedo, bump };
}

// ---------------------------------------------------------------------------
// Irregular moon geometry. IcosahedronGeometry displaced by value noise so
// Phobos and Deimos both look like cratered potatoes rather than spheres.
// ---------------------------------------------------------------------------

function makeMoonGeometry(
    avgRadius: number,
    irregularity: number,
    seed: number,
    detail = 3,
): THREE.BufferGeometry {
    const geo = new THREE.IcosahedronGeometry(avgRadius, detail);
    const pos = geo.attributes.position;
    const noise = makeNoise(seed);
    for (let i = 0; i < pos.count; i++) {
        const x = pos.getX(i);
        const y = pos.getY(i);
        const z = pos.getZ(i);
        const len = Math.hypot(x, y, z) || 1;
        // sample noise along the 3D normal (collapse to 2D via two spherical
        // projections so poles don't pinch)
        const n =
            noise(
                0.5 + Math.atan2(z, x) / TAU,
                0.5 + Math.asin(y / len) / Math.PI,
                4,
                2.3,
                0.52,
            ) -
            0.5;
        // Additional bumps for big crater-like indentations.
        const n2 = noise(x * 0.6 + 3, z * 0.6 + 7, 2, 2, 0.5) - 0.5;
        const d = 1 + n * irregularity + n2 * irregularity * 0.35;
        pos.setXYZ(i, (x / len) * avgRadius * d, (y / len) * avgRadius * d, (z / len) * avgRadius * d);
    }
    geo.computeVertexNormals();
    return geo;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function MarsArtifact({ spec }: Props) {
    const accent = spec.theme.accentColor;

    // Mars textures - painted once per mount.
    const marsTextures = useMemo(() => {
        if (typeof document === 'undefined') return null;
        const { albedo, bump } = paintMars(1024);
        const aTex = new THREE.CanvasTexture(albedo);
        aTex.colorSpace = THREE.SRGBColorSpace;
        aTex.anisotropy = 8;
        aTex.wrapS = THREE.RepeatWrapping;
        aTex.wrapT = THREE.ClampToEdgeWrapping;
        const bTex = new THREE.CanvasTexture(bump);
        bTex.anisotropy = 8;
        bTex.wrapS = THREE.RepeatWrapping;
        bTex.wrapT = THREE.ClampToEdgeWrapping;
        return { aTex, bTex };
    }, []);

    const phobosGeom = useMemo(() => makeMoonGeometry(0.12, 0.35, 0xf0b05, 3), []);
    const deimosGeom = useMemo(() => makeMoonGeometry(0.075, 0.28, 0xde1705, 3), []);

    const marsRef = useRef<THREE.Mesh>(null);
    const phobosGroup = useRef<THREE.Group>(null);
    const phobosMesh = useRef<THREE.Mesh>(null);
    const deimosGroup = useRef<THREE.Group>(null);
    const deimosMesh = useRef<THREE.Mesh>(null);
    const atmoRef = useRef<THREE.Mesh>(null);

    // Orbital parameters (compressed for visibility; the 4:1 ratio between
    // Phobos and Deimos periods is preserved).
    const PHOBOS_R = 2.05;
    const PHOBOS_SPEED = 0.55;
    const PHOBOS_INC = 0.18;
    const DEIMOS_R = 2.95;
    const DEIMOS_SPEED = 0.138;   // ~0.55 / 4
    const DEIMOS_INC = -0.26;

    useFrame(({ clock }) => {
        const t = clock.getElapsedTime();
        if (marsRef.current) {
            marsRef.current.rotation.y = t * 0.09;
        }
        if (phobosGroup.current) {
            const theta = t * PHOBOS_SPEED;
            const x = Math.cos(theta) * PHOBOS_R;
            const z = Math.sin(theta) * PHOBOS_R;
            const y = Math.sin(theta * 1.01) * PHOBOS_INC * PHOBOS_R;
            phobosGroup.current.position.set(x, y, z);
        }
        if (phobosMesh.current) {
            phobosMesh.current.rotation.x = t * 0.45;
            phobosMesh.current.rotation.y = t * 0.32;
        }
        if (deimosGroup.current) {
            const theta = t * DEIMOS_SPEED + 1.7;
            const x = Math.cos(theta) * DEIMOS_R;
            const z = Math.sin(theta) * DEIMOS_R;
            const y = Math.sin(theta * 0.97) * DEIMOS_INC * DEIMOS_R;
            deimosGroup.current.position.set(x, y, z);
        }
        if (deimosMesh.current) {
            deimosMesh.current.rotation.x = t * 0.18;
            deimosMesh.current.rotation.y = -t * 0.25;
        }
        if (atmoRef.current) {
            // Gentle atmospheric shimmer
            const s = 1 + Math.sin(t * 0.7) * 0.006;
            atmoRef.current.scale.set(s, s, s);
        }
    });

    // Centerpiece group is positioned by Room.tsx above the plinth (origin at
    // plinth base). Mars hovers above the plinth top.
    const MARS_Y = 3.15;
    const MARS_R = 1.45;

    return (
        <group position={[0, MARS_Y, 0]} rotation={[0, 0, MARS_AXIAL_TILT]}>
            {/* Mars globe */}
            <mesh ref={marsRef} castShadow receiveShadow>
                <sphereGeometry args={[MARS_R, 96, 72]} />
                {marsTextures ? (
                    <meshStandardMaterial
                        map={marsTextures.aTex}
                        bumpMap={marsTextures.bTex}
                        bumpScale={0.06}
                        roughness={0.92}
                        metalness={0.02}
                    />
                ) : (
                    <meshStandardMaterial color="#a5552d" roughness={0.92} metalness={0.02} />
                )}
            </mesh>

            {/* Thin Martian atmosphere - dusty butterscotch halo */}
            <mesh ref={atmoRef}>
                <sphereGeometry args={[MARS_R * 1.055, 48, 32]} />
                <meshBasicMaterial
                    color="#ffb488"
                    transparent
                    opacity={0.13}
                    side={THREE.BackSide}
                    depthWrite={false}
                />
            </mesh>
            {/* Outer rim glow - softer, larger */}
            <mesh>
                <sphereGeometry args={[MARS_R * 1.12, 32, 24]} />
                <meshBasicMaterial
                    color={accent}
                    transparent
                    opacity={0.05}
                    side={THREE.BackSide}
                    depthWrite={false}
                />
            </mesh>

            {/* Faint orbital guide rings. Kept extremely low-opacity so they
                read as instrumentation rather than decoration. */}
            <mesh rotation={[Math.PI / 2 + PHOBOS_INC, 0, 0]}>
                <torusGeometry args={[PHOBOS_R, 0.004, 6, 128]} />
                <meshBasicMaterial color="#ffb488" transparent opacity={0.18} />
            </mesh>
            <mesh rotation={[Math.PI / 2 + DEIMOS_INC, 0, 0]}>
                <torusGeometry args={[DEIMOS_R, 0.003, 6, 128]} />
                <meshBasicMaterial color="#e8d4b4" transparent opacity={0.14} />
            </mesh>

            {/* Phobos - close, fast, slightly redder */}
            <group ref={phobosGroup}>
                <mesh ref={phobosMesh} geometry={phobosGeom} castShadow receiveShadow>
                    <meshStandardMaterial
                        color="#6a4432"
                        roughness={0.95}
                        metalness={0.04}
                    />
                </mesh>
            </group>

            {/* Deimos - smaller, slower, lighter tan */}
            <group ref={deimosGroup}>
                <mesh ref={deimosMesh} geometry={deimosGeom} castShadow receiveShadow>
                    <meshStandardMaterial
                        color="#8f7658"
                        roughness={0.95}
                        metalness={0.04}
                    />
                </mesh>
            </group>
        </group>
    );
}
