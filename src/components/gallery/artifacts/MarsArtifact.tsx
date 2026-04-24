'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import type { RoomSpec } from '@/lib/gallery/types';
import { mulberry32 } from '@/lib/gallery/rng';

type Props = { spec: RoomSpec };

/*
 * Room 8 centerpiece. A floating model of Mars with Phobos and Deimos.
 *
 * The Mars albedo + bump maps are painted procedurally, but the paint is
 * expensive: a naive synchronous loop over a big canvas was dropping ~500ms
 * on the main thread the instant Room 8 came into view, which presented as
 * a lag spike mid-Room-7-exit-hallway. Two-part fix:
 *
 *  1. We paint in chunks, yielding to the event loop between rows so React
 *     can commit the scene, the player can keep walking, and the fallback
 *     material renders until the texture is ready.
 *  2. We cache the finished canvases at module scope so revisits, remounts
 *     (e.g. if the room leaves + re-enters the render window) or future
 *     Mars-like rooms reuse the same pixels with zero additional cost.
 *
 * Albedo-only (no separate bump pass): one canvas, half the CPU work, and
 * roughness + the painted macro detail still sell the surface. Mesh counts
 * stay low (48x32 globe, detail-1 moons) so the room matches lightweight
 * set-pieces like the fractal hall for steady FPS.
 */

const TAU = Math.PI * 2;
const MARS_AXIAL_TILT = (25.19 * Math.PI) / 180;

// ---------------------------------------------------------------------------
// Procedural texture painters. Output is cached at module scope.
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

// Anchor "landmarks" (longitude 0-1, latitude -1..1, radius, weight).
// Approximated from Mars maps so the globe reads as Mars to anyone who
// has seen a photo of it. Latitude range: 1 = north pole, -1 = south.
const MARS_LANDMARKS: Array<{ u: number; v: number; r: number; darkness: number }> = [
    { u: 0.78, v: 0.05, r: 0.10, darkness: 0.85 }, // Syrtis Major
    { u: 0.10, v: -0.05, r: 0.13, darkness: 0.72 }, // Mare Erythraeum
    { u: 0.92, v: 0.35, r: 0.09, darkness: 0.55 }, // Mare Acidalium
    { u: 0.20, v: 0.30, r: 0.08, darkness: 0.60 }, // Chryse
    { u: 0.50, v: -0.15, r: 0.12, darkness: 0.40 }, // Valles Marineris scar
    { u: 0.37, v: 0.20, r: 0.07, darkness: 0.35 }, // Tharsis shadow
    { u: 0.63, v: -0.42, r: 0.14, darkness: 0.65 }, // Hellas Planitia
];

/**
 * Paint Mars' equirectangular albedo + bump map into two canvases. Yields
 * to the event loop every `chunkRows` rows so long-running paints don't
 * block the main thread.
 */
async function paintMarsAsync(
    size: number,
    chunkRows = 32,
): Promise<{ albedo: HTMLCanvasElement }> {
    const W = size;
    const H = size / 2;
    const albedo = document.createElement('canvas');
    albedo.width = W;
    albedo.height = H;
    const ca = albedo.getContext('2d');
    if (!ca) return { albedo };

    const imgA = ca.createImageData(W, H);
    const noiseA = makeNoise(0x5ad00d); // macro continents
    const noiseB = makeNoise(0xc0ffee); // mid detail / dust
    const noiseC = makeNoise(0x13de57); // crater speckle

    const yieldToBrowser = () =>
        new Promise<void>((r) => {
            if (typeof window !== 'undefined' && 'requestIdleCallback' in window) {
                (window as unknown as {
                    requestIdleCallback: (cb: () => void, opts?: { timeout: number }) => void;
                }).requestIdleCallback(() => r(), { timeout: 60 });
            } else {
                setTimeout(r, 0);
            }
        });

    for (let yStart = 0; yStart < H; yStart += chunkRows) {
        const yEnd = Math.min(H, yStart + chunkRows);
        for (let y = yStart; y < yEnd; y++) {
            // v: -1 (south pole) .. +1 (north pole)
            const v = 1 - (y / H) * 2;
            const lat = v * (Math.PI / 2);
            const cosLat = Math.cos(lat);
            for (let x = 0; x < W; x++) {
                const u = x / W;
                // Trimmed octave counts: the sphere is ~1.5m in-scene and the
                // bump map carries most of the perceived detail, so the extra
                // octaves weren't earning their cost.
                const nMacro = noiseA(u * 3, v * 1.5, 4, 2.1, 0.55);
                const nMid = noiseB(u * 7, v * 4, 3, 2.2, 0.5);
                const nFine = noiseC(u * 22, v * 14, 2, 2.2, 0.5);

                // Base rust mixing two Mars-accurate albedo samples.
                const darkRust = [0x5a, 0x2a, 0x17]; // iron-rich shadow
                const midRust = [0xa5, 0x55, 0x2d]; // average red
                const briteRust = [0xd9, 0x8b, 0x58]; // butterscotch plain
                const mBase = Math.min(1, Math.max(0, nMacro * 0.7 + nMid * 0.3));
                let r = darkRust[0] * (1 - mBase) + briteRust[0] * mBase;
                let g = darkRust[1] * (1 - mBase) + briteRust[1] * mBase;
                let b = darkRust[2] * (1 - mBase) + briteRust[2] * mBase;
                const midMix = nMid * 0.35;
                r = r * (1 - midMix) + midRust[0] * midMix;
                g = g * (1 - midMix) + midRust[1] * midMix;
                b = b * (1 - midMix) + midRust[2] * midMix;

                // Landmark dark basaltic regions overlay.
                let darkMask = 0;
                for (const L of MARS_LANDMARKS) {
                    let du = Math.abs(u - L.u);
                    if (du > 0.5) du = 1 - du;
                    du *= cosLat;
                    const dv = v - L.v;
                    const d = Math.sqrt(du * du + dv * dv);
                    const falloff = Math.max(0, 1 - d / L.r);
                    const edgeNoise =
                        noiseB(u * 30 + L.u * 11, v * 30 + L.v * 7, 2) * 0.35;
                    darkMask = Math.max(darkMask, falloff * (L.darkness + edgeNoise));
                }
                darkMask = Math.min(1, darkMask);
                const darkness = darkMask * 0.72;
                r *= 1 - darkness;
                g *= 1 - darkness * 0.85;
                b *= 1 - darkness * 0.9;

                const dust = (nFine - 0.5) * 22;
                r = Math.max(0, Math.min(255, r + dust));
                g = Math.max(0, Math.min(255, g + dust * 0.8));
                b = Math.max(0, Math.min(255, b + dust * 0.7));

                // Polar caps. Edge wobbles by noise so caps aren't a clean band.
                const capEdge = 0.78 + noiseA(u * 6 + 99, v * 3 + 7, 2) * 0.08;
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
            }
        }
        // Let the browser breathe between row-chunks.
        await yieldToBrowser();
    }
    ca.putImageData(imgA, 0, 0);
    return { albedo };
}

// Module-level cache. First Room 8 mount kicks off the paint; revisits are free.
type MarsTextures = { aTex: THREE.CanvasTexture };
let marsTexturesCache: MarsTextures | null = null;
let marsTexturesPromise: Promise<MarsTextures> | null = null;

function getOrBuildMarsTextures(): Promise<MarsTextures> {
    if (marsTexturesCache) return Promise.resolve(marsTexturesCache);
    if (marsTexturesPromise) return marsTexturesPromise;
    if (typeof document === 'undefined') {
        return Promise.reject(new Error('SSR: no document'));
    }
    marsTexturesPromise = paintMarsAsync(384).then(({ albedo }) => {
        const aTex = new THREE.CanvasTexture(albedo);
        aTex.colorSpace = THREE.SRGBColorSpace;
        aTex.anisotropy = 4;
        aTex.wrapS = THREE.RepeatWrapping;
        aTex.wrapT = THREE.ClampToEdgeWrapping;
        marsTexturesCache = { aTex };
        return marsTexturesCache;
    });
    return marsTexturesPromise;
}

// ---------------------------------------------------------------------------
// Irregular moon geometry. IcosahedronGeometry displaced by value noise so
// Phobos and Deimos both look like cratered potatoes rather than spheres.
// detail 1: ~42 verts — fine at arm's length.
// ---------------------------------------------------------------------------

function makeMoonGeometry(
    avgRadius: number,
    irregularity: number,
    seed: number,
    detail = 1,
): THREE.BufferGeometry {
    const geo = new THREE.IcosahedronGeometry(avgRadius, detail);
    const pos = geo.attributes.position;
    const noise = makeNoise(seed);
    for (let i = 0; i < pos.count; i++) {
        const x = pos.getX(i);
        const y = pos.getY(i);
        const z = pos.getZ(i);
        const len = Math.hypot(x, y, z) || 1;
        const n =
            noise(
                0.5 + Math.atan2(z, x) / TAU,
                0.5 + Math.asin(y / len) / Math.PI,
                3,
                2.3,
                0.52,
            ) - 0.5;
        const n2 = noise(x * 0.6 + 3, z * 0.6 + 7, 2, 2, 0.5) - 0.5;
        const d = 1 + n * irregularity + n2 * irregularity * 0.35;
        pos.setXYZ(
            i,
            (x / len) * avgRadius * d,
            (y / len) * avgRadius * d,
            (z / len) * avgRadius * d,
        );
    }
    geo.computeVertexNormals();
    return geo;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function MarsArtifact({ spec }: Props) {
    // Kick off (or reuse) the texture paint. Until it's ready we show a
    // flat rust material so the room looks right immediately and walking
    // around isn't gated on a 500ms paint.
    const [textures, setTextures] = useState<MarsTextures | null>(
        () => marsTexturesCache,
    );
    useEffect(() => {
        if (textures) return;
        let cancelled = false;
        getOrBuildMarsTextures()
            .then((t) => {
                if (!cancelled) setTextures(t);
            })
            .catch(() => {
                /* SSR or canvas-unavailable; fallback material stays. */
            });
        return () => {
            cancelled = true;
        };
    }, [textures]);

    const phobosGeom = useMemo(() => makeMoonGeometry(0.12, 0.35, 0xf0b05, 1), []);
    const deimosGeom = useMemo(() => makeMoonGeometry(0.075, 0.28, 0xde1705, 1), []);

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
    const DEIMOS_SPEED = 0.138; // ~0.55 / 4
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
            const s = 1 + Math.sin(t * 0.7) * 0.006;
            atmoRef.current.scale.set(s, s, s);
        }
    });

    const MARS_Y = 3.15;
    const MARS_R = 1.45;

    return (
        <group key={`mars-artifact-${spec.index}`} position={[0, MARS_Y, 0]} rotation={[0, 0, MARS_AXIAL_TILT]}>
            <mesh ref={marsRef} castShadow receiveShadow>
                <sphereGeometry args={[MARS_R, 48, 32]} />
                {textures ? (
                    <meshStandardMaterial
                        map={textures.aTex}
                        roughness={0.9}
                        metalness={0.02}
                    />
                ) : (
                    <meshStandardMaterial color="#a5552d" roughness={0.9} metalness={0.02} />
                )}
            </mesh>

            <mesh ref={atmoRef}>
                <sphereGeometry args={[MARS_R * 1.06, 20, 14]} />
                <meshBasicMaterial
                    color="#ffb488"
                    transparent
                    opacity={0.12}
                    side={THREE.BackSide}
                    depthWrite={false}
                />
            </mesh>

            <mesh rotation={[Math.PI / 2 + PHOBOS_INC, 0, 0]}>
                <torusGeometry args={[PHOBOS_R, 0.004, 5, 48]} />
                <meshBasicMaterial color="#ffb488" transparent opacity={0.16} />
            </mesh>
            <mesh rotation={[Math.PI / 2 + DEIMOS_INC, 0, 0]}>
                <torusGeometry args={[DEIMOS_R, 0.003, 5, 48]} />
                <meshBasicMaterial color="#e8d4b4" transparent opacity={0.12} />
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
