'use client';

import { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import type { RoomSpec } from '@/lib/gallery/types';
import { rngFor, rand } from '@/lib/gallery/rng';
import Infographic from './Infographic';

/*
 * SECTION 017 - The Grove.
 *
 * A deliberately un-room-like milestone. The RoomSpec bounding box still
 * contains the player (so corridor stitching works), but instead of four
 * walls and a ceiling we render a moonlit clearing: dense trees, a starfield
 * sky, an isolated doorway frame at the back exit, and rare figures that
 * peek out from behind the trunks and then step back out of sight.
 *
 * Audio is switched into "forest" (wind) mode from Room.tsx when this
 * milestone becomes current, and back to the standard ambient engine on
 * leave.
 */

type Props = {
    spec: RoomSpec;
    hasPrev: boolean;
    hasNext: boolean;
    behind?: boolean;
};

const TRUNK_COLOR = '#1b120c';
const CANOPY_COLOR = '#0a1a10';
// Slightly lifted from pitch black so the figures actually receive the
// moonlight when they peek out. Pure-black materials are invisible against
// the equally-dark forest no matter how hard the moon is pushed.
const FIGURE_COLOR = '#1c1f25';
const GROUND_COLOR = '#0a140d';

type TreeInstance = {
    x: number;
    z: number;
    trunkH: number;
    trunkR: number;
    canopyH: number;
    canopyR: number;
    lean: number;
};

type Watcher = {
    // Associated tree index so the figure appears next to a real trunk.
    tree: number;
    // Angle around the tree (where the figure leans out from).
    angle: number;
    // Phase offset for the peek animation so they don't sync.
    phase: number;
    // Period (seconds) for this watcher's peek cycle.
    period: number;
    // Height (metres). Slight variation breaks uniformity.
    height: number;
};

export default function ForestRoom({ spec, hasPrev, hasNext, behind = false }: Props) {
    const { origin, width, depth, ceilingHeight, theme } = spec;
    const [ox, , oz] = origin;

    // Generate trees + watchers deterministically for this room's seed index
    // so the forest is the same every time the player re-enters.
    const { trees, watchers } = useMemo(() => {
        const rng = rngFor(0xf07e57, spec.index);
        const half = { x: width / 2 - 1.0, z: depth / 2 - 1.0 };

        const placed: TreeInstance[] = [];
        // Rejection sampling for a loose Poisson distribution. We want dense
        // trees but with no overlapping trunks and a clear corridor down the
        // Z-axis so the player can see the standing doorway.
        const MIN_DIST = 2.2;
        const TRIES = 260;
        for (let i = 0; i < TRIES && placed.length < 80; i++) {
            const x = rand(rng, -half.x, half.x);
            const z = rand(rng, -half.z, half.z);
            // Keep a narrow unblocked aisle from the front doorway down to
            // the standing exit doorway.
            if (Math.abs(x) < 1.6 && Math.abs(z) < depth / 2 - 1.5) continue;
            // Keep a clear landing area at the front doorway (entry from hallway).
            if (Math.abs(x) < 2.2 && z < -depth / 2 + 3.5) continue;
            // Keep the exit doorway clear as well.
            if (Math.abs(x) < 2.2 && z > depth / 2 - 3.5) continue;

            let ok = true;
            for (const t of placed) {
                if (Math.hypot(t.x - x, t.z - z) < MIN_DIST) {
                    ok = false;
                    break;
                }
            }
            if (!ok) continue;

            placed.push({
                x,
                z,
                trunkH: rand(rng, 5.0, 9.0),
                trunkR: rand(rng, 0.16, 0.32),
                canopyH: rand(rng, 3.4, 5.2),
                canopyR: rand(rng, 1.6, 2.6),
                lean: rand(rng, -0.05, 0.05),
            });
        }

        // Pick a handful of trees to host watchers. We want the watchers to
        // prefer the middle distance - not right next to the player, not so
        // far they're lost in fog.
        const candidates = placed
            .map((t, i) => ({ i, r: Math.hypot(t.x, t.z), t }))
            .filter((c) => c.r > 6 && c.r < 14)
            .sort(() => rng() - 0.5);
        const watcherCount = Math.min(7, candidates.length);
        const ws: Watcher[] = [];
        for (let i = 0; i < watcherCount; i++) {
            const c = candidates[i];
            ws.push({
                tree: c.i,
                angle: rand(rng, 0, Math.PI * 2),
                phase: rand(rng, 0, 30),
                period: rand(rng, 8, 16),
                height: rand(rng, 1.65, 2.1),
            });
        }
        return { trees: placed, watchers: ws };
    }, [spec.index, width, depth]);

    return (
        <group>
            {/* Ground plane - darker than the theme's wallColor suggests */}
            <mesh position={[ox, -0.01, oz]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
                <planeGeometry args={[width, depth]} />
                <meshStandardMaterial color={GROUND_COLOR} roughness={0.95} />
            </mesh>

            {/* Sky "dome" - a dark plane hanging far overhead with faint
                moon glow baked in via a radial gradient shader */}
            <Skybox width={width} depth={depth} ceilingHeight={ceilingHeight} ox={ox} oz={oz} />

            {/* Low fog bank near the ground */}
            <mesh position={[ox, 0.3, oz]}>
                <sphereGeometry args={[0.01, 4, 3]} />
                <meshBasicMaterial visible={false} />
            </mesh>

            {/* Moonlight: a cool directional light from high overhead.
                Brightened in two passes so the watchers register against the
                forest when they lean out. The ambient floor stays low so the
                clearing still reads as moonlit, not floodlit. */}
            {!behind ? (
                <>
                    <directionalLight
                        position={[ox + 6, 14, oz - 4]}
                        intensity={0.95}
                        color={theme.lightColor}
                    />
                    <hemisphereLight
                        args={[theme.lightColor, '#02060a', 0.5]}
                        position={[ox, ceilingHeight, oz]}
                    />
                    {/* Wider, warmer fill anchored at the player's eye-level
                        so trunks and figures both pick up shape detail down
                        the aisle. */}
                    <pointLight
                        position={[ox, 2.8, oz]}
                        color={theme.lightColor}
                        intensity={0.6}
                        distance={26}
                        decay={1.4}
                    />
                </>
            ) : null}

            {/* Invisible back wall collision shell is handled by Room collision;
                we render the visible back wall pieces as dark tree-coloured
                chunks so the player still sees a soft boundary in heavy fog. */}
            <InvisibleBoundary ox={ox} oz={oz} width={width} depth={depth} ceilingHeight={ceilingHeight} />

            {/* Trees */}
            {trees.map((t, i) => (
                <Tree key={i} tree={t} ox={ox} oz={oz} />
            ))}

            {/* Standing doorway at the back exit */}
            {hasNext ? (
                <StandingDoorway ox={ox} oz={oz + depth / 2 - 0.6} color="#3a2616" />
            ) : null}
            {/* Matching doorway at the front entrance for symmetry */}
            {hasPrev ? (
                <StandingDoorway ox={ox} oz={oz - depth / 2 + 0.6} color="#3a2616" />
            ) : null}

            {/* Peeking watchers - fade in/out from behind random trees */}
            {!behind
                ? watchers.map((w, i) => (
                      <Watcher
                          key={i}
                          watcher={w}
                          tree={trees[w.tree]}
                          ox={ox}
                          oz={oz}
                      />
                  ))
                : null}

            {/* Infographic panel mounted on an actual board near the entrance */}
            {!behind ? (
                <group position={[ox - 6.5, 0, oz - 4]} rotation={[0, 0.4, 0]}>
                    {/* Wooden backer */}
                    <mesh position={[0, 1.3, 0]}>
                        <boxGeometry args={[3.0, 1.9, 0.1]} />
                        <meshStandardMaterial color="#2a1a10" roughness={0.95} />
                    </mesh>
                    {/* Posts */}
                    <mesh position={[-1.3, 0.7, 0.06]}>
                        <cylinderGeometry args={[0.08, 0.08, 1.4, 10]} />
                        <meshStandardMaterial color="#1a1008" roughness={0.95} />
                    </mesh>
                    <mesh position={[1.3, 0.7, 0.06]}>
                        <cylinderGeometry args={[0.08, 0.08, 1.4, 10]} />
                        <meshStandardMaterial color="#1a1008" roughness={0.95} />
                    </mesh>
                    {/* The infographic itself, flush on the backer */}
                    <group position={[0, 1.3, 0.06]}>
                        <Infographic
                            theme={theme}
                            position={[0, 0, 0]}
                            rotationY={0}
                            maxWidth={2.7}
                            maxHeight={1.7}
                        />
                    </group>
                </group>
            ) : null}
        </group>
    );
}

// ---------------------------------------------------------------------------

function Tree({ tree, ox, oz }: { tree: TreeInstance; ox: number; oz: number }) {
    const { x, z, trunkH, trunkR, canopyH, canopyR, lean } = tree;
    return (
        <group position={[ox + x, 0, oz + z]} rotation={[0, 0, lean]}>
            <mesh position={[0, trunkH / 2, 0]} castShadow>
                <cylinderGeometry args={[trunkR * 0.75, trunkR, trunkH, 8]} />
                <meshStandardMaterial color={TRUNK_COLOR} roughness={0.95} />
            </mesh>
            <mesh position={[0, trunkH - 0.4 + canopyH / 2, 0]} castShadow>
                <coneGeometry args={[canopyR, canopyH, 10]} />
                <meshStandardMaterial color={CANOPY_COLOR} roughness={0.95} />
            </mesh>
        </group>
    );
}

function StandingDoorway({ ox, oz, color }: { ox: number; oz: number; color: string }) {
    // A lone stone-and-timber frame standing in the clearing. The player
    // walks through this to reach the real doorway in the invisible back
    // boundary.
    const postH = 2.9;
    const postR = 0.13;
    return (
        <group position={[ox, 0, oz]}>
            <mesh position={[-1.1, postH / 2, 0]} castShadow>
                <cylinderGeometry args={[postR, postR * 1.2, postH, 10]} />
                <meshStandardMaterial color={color} roughness={0.9} />
            </mesh>
            <mesh position={[1.1, postH / 2, 0]} castShadow>
                <cylinderGeometry args={[postR, postR * 1.2, postH, 10]} />
                <meshStandardMaterial color={color} roughness={0.9} />
            </mesh>
            <mesh position={[0, postH + 0.08, 0]} castShadow>
                <boxGeometry args={[2.6, 0.22, 0.3]} />
                <meshStandardMaterial color={color} roughness={0.9} />
            </mesh>
            {/* Threshold bar */}
            <mesh position={[0, 0.05, 0]}>
                <boxGeometry args={[2.4, 0.08, 0.3]} />
                <meshStandardMaterial color={color} roughness={0.9} />
            </mesh>
            {/* A hanging lantern glow so the exit reads at a distance */}
            <mesh position={[0, postH - 0.05, 0]}>
                <sphereGeometry args={[0.06, 10, 8]} />
                <meshStandardMaterial color="#ffbb6a" emissive="#ffbb6a" emissiveIntensity={1.6} />
            </mesh>
            <pointLight position={[0, postH - 0.1, 0]} color="#ffbb6a" intensity={0.5} distance={7} />
        </group>
    );
}

function Watcher({
    watcher,
    tree,
    ox,
    oz,
}: {
    watcher: Watcher;
    tree: TreeInstance | undefined;
    ox: number;
    oz: number;
}) {
    const bodyMat = useRef<THREE.MeshStandardMaterial>(null);
    const headMat = useRef<THREE.MeshStandardMaterial>(null);
    const groupRef = useRef<THREE.Group>(null);

    useFrame(({ clock }) => {
        if (!groupRef.current || !tree) return;
        const t = clock.getElapsedTime() + watcher.phase;
        const u = (t % watcher.period) / watcher.period;
        // Smooth peek: a ~20% window around the middle of the cycle.
        const peekCenter = 0.45;
        const peekWidth = 0.12;
        const d = Math.abs(u - peekCenter);
        const visible = Math.max(0, 1 - d / peekWidth);
        const opacity = visible;
        if (bodyMat.current) bodyMat.current.opacity = opacity;
        if (headMat.current) headMat.current.opacity = opacity;

        const lean = visible * 0.35;
        const dx = Math.cos(watcher.angle) * (tree.trunkR + 0.02 + lean);
        const dz = Math.sin(watcher.angle) * (tree.trunkR + 0.02 + lean);
        groupRef.current.position.set(ox + tree.x + dx, 0, oz + tree.z + dz);
        groupRef.current.rotation.y = Math.atan2(-(ox + tree.x + dx), -(oz + tree.z + dz));
    });

    if (!tree) return null;
    return (
        <group ref={groupRef}>
            <mesh position={[0, watcher.height * 0.55, 0]}>
                <cylinderGeometry args={[0.09, 0.11, watcher.height, 8]} />
                <meshStandardMaterial
                    ref={bodyMat}
                    color={FIGURE_COLOR}
                    transparent
                    opacity={0}
                    roughness={0.98}
                />
            </mesh>
            <mesh position={[0, watcher.height + 0.1, 0]}>
                <sphereGeometry args={[0.14, 10, 8]} />
                <meshStandardMaterial
                    ref={headMat}
                    color={FIGURE_COLOR}
                    transparent
                    opacity={0}
                    roughness={0.95}
                />
            </mesh>
        </group>
    );
}

function InvisibleBoundary({
    ox,
    oz,
    width,
    depth,
    ceilingHeight,
}: {
    ox: number;
    oz: number;
    width: number;
    depth: number;
    ceilingHeight: number;
}) {
    // A very dark hull that fades into the fog. It enforces a visual edge so
    // the player's eye doesn't discover a bright horizon past the tree line,
    // while the trees themselves obscure where the hull is.
    const COLOR = '#04080a';
    const T = 0.3;
    const h = Math.min(ceilingHeight, 14);
    return (
        <group>
            <mesh position={[ox - width / 2 - T / 2, h / 2, oz]}>
                <boxGeometry args={[T, h, depth]} />
                <meshStandardMaterial color={COLOR} roughness={1} />
            </mesh>
            <mesh position={[ox + width / 2 + T / 2, h / 2, oz]}>
                <boxGeometry args={[T, h, depth]} />
                <meshStandardMaterial color={COLOR} roughness={1} />
            </mesh>
            <mesh position={[ox, h / 2, oz - depth / 2 - T / 2]}>
                <boxGeometry args={[width, h, T]} />
                <meshStandardMaterial color={COLOR} roughness={1} />
            </mesh>
            <mesh position={[ox, h / 2, oz + depth / 2 + T / 2]}>
                <boxGeometry args={[width, h, T]} />
                <meshStandardMaterial color={COLOR} roughness={1} />
            </mesh>
        </group>
    );
}

// ---------------------------------------------------------------------------

const SKY_FRAG = /* glsl */ `
    precision highp float;
    uniform float uTime;
    varying vec2 vUv;

    // Cheap 2D hash for star placement
    float hash(vec2 p) {
        p = fract(p * vec2(123.34, 456.21));
        p += dot(p, p + 45.32);
        return fract(p.x * p.y);
    }

    void main() {
        vec2 p = vUv;

        // Base gradient: darker at edges, subtle indigo overhead.
        float edge = distance(p, vec2(0.5)) * 1.6;
        vec3 sky = mix(vec3(0.05, 0.06, 0.10), vec3(0.01, 0.02, 0.05), edge);

        // Moon: soft bright disc off-centre.
        vec2 moonPos = vec2(0.68, 0.72);
        float d = distance(p, moonPos);
        float core = smoothstep(0.055, 0.02, d);
        float halo = smoothstep(0.22, 0.05, d) * 0.35;
        sky += vec3(0.95, 0.92, 0.8) * core;
        sky += vec3(0.6, 0.7, 0.9) * halo;

        // Starfield - tiny twinkles
        vec2 g = floor(p * 140.0);
        float star = hash(g);
        if (star > 0.985) {
            float twinkle = 0.5 + 0.5 * sin(uTime * 2.0 + star * 30.0);
            sky += vec3(0.8, 0.85, 1.0) * twinkle * (star - 0.985) * 60.0;
        }

        gl_FragColor = vec4(sky, 1.0);
    }
`;

const SKY_VERT = /* glsl */ `
    varying vec2 vUv;
    void main() {
        vUv = uv;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
`;

function Skybox({
    width,
    depth,
    ceilingHeight,
    ox,
    oz,
}: {
    width: number;
    depth: number;
    ceilingHeight: number;
    ox: number;
    oz: number;
}) {
    const matRef = useRef<THREE.ShaderMaterial>(null);
    const uniforms = useMemo(() => ({ uTime: { value: 0 } }), []);
    useFrame(({ clock }) => {
        const m = matRef.current;
        if (!m) return;
        (m.uniforms.uTime as { value: number }).value = clock.getElapsedTime();
    });
    return (
        <mesh
            position={[ox, ceilingHeight - 0.1, oz]}
            rotation={[Math.PI / 2, 0, 0]}
        >
            <planeGeometry args={[width * 1.4, depth * 1.4]} />
            <shaderMaterial
                ref={matRef}
                vertexShader={SKY_VERT}
                fragmentShader={SKY_FRAG}
                uniforms={uniforms}
                side={THREE.DoubleSide}
            />
        </mesh>
    );
}
