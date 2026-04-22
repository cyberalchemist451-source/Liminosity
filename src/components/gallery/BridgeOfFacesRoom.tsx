'use client';

import { useMemo, useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import type { RoomSpec } from '@/lib/gallery/types';
import { useGalleryStore } from '@/lib/gallery/galleryStore';
import { rngFor } from '@/lib/gallery/rng';

/*
 * SECTION 027 - The Span of Witnesses.
 *
 * An extremely long, narrow stone bridge flying over a bottomless pit.
 * Giant stone faces line both walls in a steady row, staring across at
 * each other (and at the player) as they cross. There is no artifact, no
 * plinth, no infographic - just the crossing and the things that watch.
 *
 * Gameplay: the collision box still permits walking into the pit on either
 * side of the bridge. Stepping off triggers the same Mandelbrot fall
 * cutscene used by the sealed void-shaft room; the player will be
 * teleported to the hallway past this room after the cutscene completes.
 */

type Props = {
    spec: RoomSpec;
    hasPrev: boolean;
    hasNext: boolean;
    behind?: boolean;
};

const WALL_T = 0.4;
const BRIDGE_HALF_WIDTH = 2.25; // bridge is 4.5m wide
const BRIDGE_THICKNESS = 0.6;
const PIT_VISUAL_DEPTH = 60;
const FACE_SPACING = 6.4; // distance between consecutive faces along Z
const FACE_BASE_HEIGHT = 4.0; // the sculpted faces protrude to this height
const FACE_WIDTH = 3.6;
const FACE_DEPTH = 1.5;

export default function BridgeOfFacesRoom({ spec, hasPrev, hasNext, behind = false }: Props) {
    const { origin, width, depth, ceilingHeight, theme } = spec;
    const [ox, , oz] = origin;
    const wHalf = width / 2;
    const dHalf = depth / 2;
    const dw = spec.doorwayWidth;
    const dh = spec.doorwayHeight;
    const sideW = (width - dw) / 2;

    const frontZ = oz - dHalf;
    const backZ = oz + dHalf;

    const triggerFall = useGalleryStore((s) => s.triggerFall);
    const fallingIntoHole = useGalleryStore((s) => s.fallingIntoHole);
    const pendingTeleport = useGalleryStore((s) => s.pendingTeleport);
    const camera = useThree((s) => s.camera);
    const triggeredRef = useRef(false);

    // Lantern positions above the bridge - deterministic evenly spaced
    // lamps at ~2/3 ceiling height. Six of them, so most of the length
    // stays gloomy between lights.
    const lamps = useMemo<Array<[number, number, number]>>(() => {
        const count = 6;
        const y = ceilingHeight * 0.7;
        const span = depth - 8;
        const out: Array<[number, number, number]> = [];
        for (let i = 0; i < count; i++) {
            const t = i / (count - 1);
            const z = oz - span / 2 + t * span;
            out.push([ox, y, z]);
        }
        return out;
    }, [ox, oz, depth, ceilingHeight]);

    // Roll the row of face instances. Each face has a random personality
    // so no two stones look alike - some have sunken eyes, some gape-mouthed,
    // some with bared teeth. Positions are deterministic per seed.
    const faces = useMemo(() => {
        const rng = rngFor(spec.index ^ 0x6fac35, 9);
        const nRows = Math.floor((depth - 10) / FACE_SPACING);
        const out: Array<FaceInstance> = [];
        for (let i = 0; i < nRows; i++) {
            const local = (i - (nRows - 1) / 2) * FACE_SPACING;
            // Left wall face
            out.push({
                side: -1,
                z: oz + local,
                baseY: 0.4 + (rng() - 0.5) * 0.6,
                scale: 1.0 + (rng() - 0.5) * 0.22,
                variant: Math.floor(rng() * 4),
                yaw: (rng() - 0.5) * 0.12,
                gray: 0.3 + rng() * 0.35,
            });
            // Right wall face - independent roll so they don't mirror
            out.push({
                side: 1,
                z: oz + local + (rng() - 0.5) * 0.9,
                baseY: 0.4 + (rng() - 0.5) * 0.6,
                scale: 1.0 + (rng() - 0.5) * 0.22,
                variant: Math.floor(rng() * 4),
                yaw: (rng() - 0.5) * 0.12,
                gray: 0.3 + rng() * 0.35,
            });
        }
        return out;
    }, [spec.index, depth, oz]);

    // Fall detection. Once per frame: if the player is inside the room's
    // horizontal bounds but OFF the bridge strip (|x - ox| > half-bridge),
    // they've walked into the pit. Fire the cutscene; the teleport target
    // is the hallway just past the back doorway of this room.
    useFrame(() => {
        if (behind || fallingIntoHole || pendingTeleport || triggeredRef.current) return;
        const dx = camera.position.x - ox;
        const dz = camera.position.z - oz;
        const insideRoom = Math.abs(dx) < wHalf && Math.abs(dz) < dHalf;
        if (!insideRoom) return;
        // A small buffer so brushing past the bridge edge doesn't instantly
        // kill the player - they have to actually step off.
        if (Math.abs(dx) > BRIDGE_HALF_WIDTH - 0.1) {
            triggeredRef.current = true;
            triggerFall([ox, 1.65, backZ + 3.0]);
        }
    });

    // Deep dark for the pit - lit only by the upper lamps on the bridge so
    // the drop reads as genuinely bottomless. Use a BackSide-shaded box
    // well below the bridge to block any scene behind leaking through.
    return (
        <group>
            {/* Pit shell - a broad black box extending far below the bridge.
                Doesn't interact with collision; walls of the room handle
                containment. */}
            <mesh position={[ox, -PIT_VISUAL_DEPTH / 2, oz]}>
                <boxGeometry args={[width - 0.2, PIT_VISUAL_DEPTH, depth - 0.2]} />
                <meshBasicMaterial color="#000000" side={THREE.BackSide} />
            </mesh>
            {/* Pure black lid way below the pit so looking down into nothing
                is reliable regardless of scene shell. */}
            <mesh
                position={[ox, -PIT_VISUAL_DEPTH + 0.05, oz]}
                rotation={[-Math.PI / 2, 0, 0]}
            >
                <planeGeometry args={[width * 2, depth * 2]} />
                <meshBasicMaterial color="#000000" />
            </mesh>

            {/* THE BRIDGE. A narrow stone strip running the full length of the
                room along Z, centered on x = ox. Top surface is at y = 0 so
                the player's standard gravity+eye-height behaves normally. */}
            <mesh
                position={[ox, -BRIDGE_THICKNESS / 2, oz]}
                receiveShadow
                castShadow
            >
                <boxGeometry args={[BRIDGE_HALF_WIDTH * 2, BRIDGE_THICKNESS, depth]} />
                <meshStandardMaterial
                    color="#2b2730"
                    roughness={0.95}
                    metalness={0.02}
                />
            </mesh>
            {/* Thin trim along the bridge edges */}
            <mesh position={[ox - BRIDGE_HALF_WIDTH - 0.06, -0.05, oz]}>
                <boxGeometry args={[0.12, 0.16, depth]} />
                <meshStandardMaterial
                    color={theme.accentColor}
                    emissive={theme.accentColor}
                    emissiveIntensity={0.4}
                    roughness={0.4}
                />
            </mesh>
            <mesh position={[ox + BRIDGE_HALF_WIDTH + 0.06, -0.05, oz]}>
                <boxGeometry args={[0.12, 0.16, depth]} />
                <meshStandardMaterial
                    color={theme.accentColor}
                    emissive={theme.accentColor}
                    emissiveIntensity={0.4}
                    roughness={0.4}
                />
            </mesh>

            {/* Faint row of lanterns hanging above the bridge. Sparse on
                purpose so most of the hall stays gloomy. */}
            {lamps.map((lamp, i) => (
                <group key={i} position={lamp}>
                    <mesh position={[0, -0.1, 0]}>
                        <sphereGeometry args={[0.18, 12, 10]} />
                        <meshStandardMaterial
                            color={theme.lightColor}
                            emissive={theme.lightColor}
                            emissiveIntensity={1.4}
                            roughness={0.6}
                        />
                    </mesh>
                    <pointLight
                        color={theme.lightColor}
                        intensity={0.55}
                        distance={12}
                        decay={1.8}
                    />
                </group>
            ))}

            {/* Side walls - tall stone slabs that the giant faces protrude
                from. Rendered a little taller than the room's ceilingHeight
                to hide the gap when the player looks up. */}
            <mesh
                position={[ox - wHalf - WALL_T / 2, ceilingHeight / 2 + 4, oz]}
                receiveShadow
            >
                <boxGeometry args={[WALL_T, ceilingHeight + 8, depth]} />
                <meshStandardMaterial
                    color="#0c0b10"
                    roughness={0.95}
                />
            </mesh>
            <mesh
                position={[ox + wHalf + WALL_T / 2, ceilingHeight / 2 + 4, oz]}
                receiveShadow
            >
                <boxGeometry args={[WALL_T, ceilingHeight + 8, depth]} />
                <meshStandardMaterial
                    color="#0c0b10"
                    roughness={0.95}
                />
            </mesh>

            {/* Front and back walls with doorways. The doorway is over the
                bridge strip so the player's approach is aligned. */}
            {hasPrev ? (
                <EndWallWithDoor
                    ox={ox}
                    z={frontZ - WALL_T / 2}
                    height={ceilingHeight + 8}
                    sideW={sideW}
                    dw={dw}
                    dh={dh}
                    color="#0c0b10"
                />
            ) : (
                <mesh position={[ox, (ceilingHeight + 8) / 2, frontZ - WALL_T / 2]}>
                    <boxGeometry args={[width, ceilingHeight + 8, WALL_T]} />
                    <meshStandardMaterial color="#0c0b10" />
                </mesh>
            )}
            {hasNext ? (
                <EndWallWithDoor
                    ox={ox}
                    z={backZ + WALL_T / 2}
                    height={ceilingHeight + 8}
                    sideW={sideW}
                    dw={dw}
                    dh={dh}
                    color="#0c0b10"
                />
            ) : (
                <mesh position={[ox, (ceilingHeight + 8) / 2, backZ + WALL_T / 2]}>
                    <boxGeometry args={[width, ceilingHeight + 8, WALL_T]} />
                    <meshStandardMaterial color="#0c0b10" />
                </mesh>
            )}

            {/* Ceiling - flat, very dark, acts like the arch of a tomb */}
            <mesh
                position={[ox, ceilingHeight, oz]}
                rotation={[Math.PI / 2, 0, 0]}
                receiveShadow
            >
                <planeGeometry args={[width, depth]} />
                <meshStandardMaterial color="#050408" roughness={0.95} />
            </mesh>

            {/* ---------- THE FACES ---------- */}
            {!behind && faces.map((f, i) => (
                <StoneFace
                    key={i}
                    instance={f}
                    wallX={f.side === -1 ? ox - wHalf + 0.05 : ox + wHalf - 0.05}
                />
            ))}

            {/* Very faint fill light so the faces are never pitch-black
                when no lamp is near. */}
            <hemisphereLight
                color="#3d3a4a"
                groundColor="#020205"
                intensity={0.18}
            />
        </group>
    );
}

type FaceInstance = {
    side: -1 | 1;
    z: number;
    baseY: number;
    scale: number;
    variant: number;
    yaw: number;
    gray: number;
};

// ---------------------------------------------------------------------------
// STONE FACE - a giant stone head protruding from a wall at the given Z. The
// face is oriented to look across the bridge (normal points toward +X for
// left-wall faces, -X for right-wall faces). Four rough variants give the
// row some character without modelling anything truly detailed.
// ---------------------------------------------------------------------------

function StoneFace({
    instance,
    wallX,
}: {
    instance: FaceInstance;
    wallX: number;
}) {
    const { side, z, baseY, scale, variant, yaw, gray } = instance;
    const color = new THREE.Color(gray, gray * 0.96, gray * 0.92)
        .getStyle();
    const darker = new THREE.Color(gray * 0.55, gray * 0.52, gray * 0.5)
        .getStyle();

    // Place the face slightly inset from the wall so its back is clipped.
    // side = -1 -> face pokes in +X direction (toward bridge from left wall).
    // side = +1 -> face pokes in -X direction.
    const headCenterX = wallX + side * (FACE_DEPTH / 2 - 0.15);
    const faceRotY = side === -1 ? Math.PI / 2 : -Math.PI / 2;

    return (
        <group
            position={[headCenterX, baseY + FACE_BASE_HEIGHT / 2, z]}
            rotation={[0, faceRotY + yaw, 0]}
            scale={scale}
        >
            {/* Main head block, slight vertical taper for a chin */}
            <mesh castShadow receiveShadow>
                <boxGeometry args={[FACE_WIDTH, FACE_BASE_HEIGHT, FACE_DEPTH]} />
                <meshStandardMaterial color={color} roughness={0.95} metalness={0.02} />
            </mesh>

            {/* Brow ridge */}
            <mesh position={[0, FACE_BASE_HEIGHT * 0.18, FACE_DEPTH / 2 + 0.001]}>
                <boxGeometry args={[FACE_WIDTH * 0.92, 0.26, 0.4]} />
                <meshStandardMaterial color={darker} roughness={0.95} />
            </mesh>

            {/* Eye sockets - two sunken rectangular recesses */}
            <FaceEye x={-FACE_WIDTH * 0.22} y={0.0} z={FACE_DEPTH / 2 + 0.02} variant={variant} />
            <FaceEye x={FACE_WIDTH * 0.22} y={0.0} z={FACE_DEPTH / 2 + 0.02} variant={variant} />

            {/* Nose - a trapezoidal prism sticking out between the eyes */}
            <mesh position={[0, -FACE_BASE_HEIGHT * 0.06, FACE_DEPTH / 2 + 0.22]}>
                <boxGeometry args={[0.5, 1.2, 0.55]} />
                <meshStandardMaterial color={darker} roughness={0.95} />
            </mesh>

            {/* Mouth - depends on variant */}
            <FaceMouth
                y={-FACE_BASE_HEIGHT * 0.3}
                z={FACE_DEPTH / 2 + 0.02}
                width={FACE_WIDTH}
                variant={variant}
                darker={darker}
            />

            {/* Chin shelf */}
            <mesh
                position={[0, -FACE_BASE_HEIGHT * 0.47, FACE_DEPTH / 2 - 0.05]}
            >
                <boxGeometry args={[FACE_WIDTH * 0.78, 0.28, 0.35]} />
                <meshStandardMaterial color={darker} roughness={0.95} />
            </mesh>

            {/* Cheekbones - subtle rectangular ridges */}
            <mesh
                position={[-FACE_WIDTH * 0.34, -FACE_BASE_HEIGHT * 0.12, FACE_DEPTH / 2 + 0.001]}
            >
                <boxGeometry args={[0.6, 0.45, 0.22]} />
                <meshStandardMaterial color={darker} roughness={0.95} />
            </mesh>
            <mesh
                position={[FACE_WIDTH * 0.34, -FACE_BASE_HEIGHT * 0.12, FACE_DEPTH / 2 + 0.001]}
            >
                <boxGeometry args={[0.6, 0.45, 0.22]} />
                <meshStandardMaterial color={darker} roughness={0.95} />
            </mesh>
        </group>
    );
}

function FaceEye({
    x,
    y,
    z,
    variant,
}: {
    x: number;
    y: number;
    z: number;
    variant: number;
}) {
    // variant 0/2 = sunken narrow, 1 = wide open, 3 = closed (just a line)
    const height = variant === 1 ? 0.55 : variant === 3 ? 0.1 : 0.32;
    const width = variant === 1 ? 0.85 : 0.72;
    return (
        <mesh position={[x, y, z]}>
            <boxGeometry args={[width, height, 0.1]} />
            <meshStandardMaterial
                color="#000000"
                roughness={0.9}
                emissive="#000000"
            />
        </mesh>
    );
}

function FaceMouth({
    y,
    z,
    width,
    variant,
    darker,
}: {
    y: number;
    z: number;
    width: number;
    variant: number;
    darker: string;
}) {
    if (variant === 0) {
        // Flat line, stern
        return (
            <mesh position={[0, y, z]}>
                <boxGeometry args={[width * 0.55, 0.14, 0.1]} />
                <meshStandardMaterial color="#000000" />
            </mesh>
        );
    }
    if (variant === 1) {
        // Gaping - tall black rectangle
        return (
            <mesh position={[0, y, z]}>
                <boxGeometry args={[width * 0.42, 0.85, 0.1]} />
                <meshStandardMaterial color="#000000" />
            </mesh>
        );
    }
    if (variant === 2) {
        // Toothy row - stripe of black with thin lighter teeth
        return (
            <group position={[0, y, z]}>
                <mesh>
                    <boxGeometry args={[width * 0.62, 0.42, 0.1]} />
                    <meshStandardMaterial color="#000000" />
                </mesh>
                {[-2, -1, 0, 1, 2].map((i) => (
                    <mesh key={i} position={[i * 0.18, 0, 0.06]}>
                        <boxGeometry args={[0.08, 0.3, 0.06]} />
                        <meshStandardMaterial color={darker} />
                    </mesh>
                ))}
            </group>
        );
    }
    // variant 3: pursed - narrow horizontal line with a dot beneath
    return (
        <group position={[0, y, z]}>
            <mesh>
                <boxGeometry args={[width * 0.28, 0.1, 0.1]} />
                <meshStandardMaterial color="#000000" />
            </mesh>
            <mesh position={[0, -0.25, 0]}>
                <boxGeometry args={[0.14, 0.14, 0.08]} />
                <meshStandardMaterial color={darker} />
            </mesh>
        </group>
    );
}

// ---------------------------------------------------------------------------
// Front/back wall with doorway cut-outs, extended to the taller wall height
// of this room (we render the walls taller than ceilingHeight to hide the
// view up into the pit shell).
// ---------------------------------------------------------------------------

function EndWallWithDoor({
    ox,
    z,
    height,
    sideW,
    dw,
    dh,
    color,
}: {
    ox: number;
    z: number;
    height: number;
    sideW: number;
    dw: number;
    dh: number;
    color: string;
}) {
    return (
        <>
            <mesh position={[ox - (dw / 2 + sideW / 2), height / 2, z]}>
                <boxGeometry args={[sideW, height, WALL_T]} />
                <meshStandardMaterial color={color} roughness={0.95} />
            </mesh>
            <mesh position={[ox + (dw / 2 + sideW / 2), height / 2, z]}>
                <boxGeometry args={[sideW, height, WALL_T]} />
                <meshStandardMaterial color={color} roughness={0.95} />
            </mesh>
            <mesh position={[ox, (height + dh) / 2, z]}>
                <boxGeometry args={[dw, height - dh, WALL_T]} />
                <meshStandardMaterial color={color} roughness={0.95} />
            </mesh>
        </>
    );
}
