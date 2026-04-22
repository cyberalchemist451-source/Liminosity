'use client';

import { useMemo, useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import type { RoomSpec } from '@/lib/gallery/types';
import { useGalleryStore } from '@/lib/gallery/galleryStore';
import Infographic from './Infographic';

/*
 * SECTION 022 - The Drop.
 *
 * A small, sealed room with no doorway in the back wall. The only way forward
 * is a circular hole in the floor: stepping over it triggers a Mandelbrot
 * "fall" cutscene (handled at the DOM layer) that lasts ~10 seconds, then
 * teleports the player out into the hallway leading to the next section.
 */

const WALL_T = 0.2;
const HOLE_RADIUS = 1.6;
const HOLE_DEPTH = 18; // how far the abyss cylinder extends downwards visually

type Props = {
    spec: RoomSpec;
    hasPrev: boolean;
    hasNext: boolean;
    behind?: boolean;
};

function shade(hex: string, amt: number) {
    const c = new THREE.Color(hex);
    c.offsetHSL(0, 0, amt);
    return `#${c.getHexString()}`;
}

export default function VoidShaftRoom({ spec, hasPrev, behind = false }: Props) {
    const { origin, width, depth, ceilingHeight, theme } = spec;
    const [ox, , oz] = origin;

    const wallColor = theme.wallColor;
    const floorColor = useMemo(() => shade(theme.wallColor, -0.28), [theme.wallColor]);
    const ceilingColor = useMemo(() => shade(theme.wallColor, 0.04), [theme.wallColor]);

    const dHalf = depth / 2;
    const wHalf = width / 2;
    const dw = spec.doorwayWidth;
    const dh = spec.doorwayHeight;
    const sideW = (width - dw) / 2;

    const triggerFall = useGalleryStore((s) => s.triggerFall);
    const fallingIntoHole = useGalleryStore((s) => s.fallingIntoHole);
    const pendingTeleport = useGalleryStore((s) => s.pendingTeleport);
    const camera = useThree((s) => s.camera);
    const triggeredRef = useRef(false);

    useFrame(() => {
        if (behind || fallingIntoHole || pendingTeleport || triggeredRef.current) return;
        const dx = camera.position.x - ox;
        const dz = camera.position.z - oz;
        const insideRoom =
            Math.abs(dx) < wHalf && Math.abs(dz) < dHalf;
        if (!insideRoom) return;
        if (Math.hypot(dx, dz) < HOLE_RADIUS - 0.1) {
            triggeredRef.current = true;
            // Target: 3m into the hallway past this room's back wall, camera
            // at standard eye height, facing +Z.
            const backZ = origin[2] + depth / 2;
            triggerFall([ox, 1.65, backZ + 3.0]);
        }
    });

    // Pulse the rim glow
    const rimRef = useRef<THREE.MeshStandardMaterial>(null);
    useFrame(({ clock }) => {
        if (!rimRef.current) return;
        const t = clock.getElapsedTime();
        rimRef.current.emissiveIntensity = 1.4 + Math.sin(t * 1.3) * 0.45;
    });

    return (
        <group>
            {/* Floor - a ring with the hole punched out. Outer radius is
                large enough to cover the 14m room and then some, which is
                fine because the walls clip the view. */}
            <mesh
                position={[ox, -0.01, oz]}
                rotation={[-Math.PI / 2, 0, 0]}
                receiveShadow
            >
                <ringGeometry args={[HOLE_RADIUS, 14, 48, 1]} />
                <meshStandardMaterial color={floorColor} roughness={0.9} />
            </mesh>

            {/* Abyss: a dark cylinder descending from the hole. */}
            <mesh position={[ox, -HOLE_DEPTH / 2, oz]}>
                <cylinderGeometry
                    args={[HOLE_RADIUS, HOLE_RADIUS * 0.3, HOLE_DEPTH, 48, 1, true]}
                />
                <meshStandardMaterial
                    color="#020005"
                    roughness={1}
                    side={THREE.DoubleSide}
                />
            </mesh>
            {/* Pure-black cap so distant looks-down doesn't peek past the
                cylinder's bottom. */}
            <mesh
                position={[ox, -HOLE_DEPTH + 0.02, oz]}
                rotation={[-Math.PI / 2, 0, 0]}
            >
                <circleGeometry args={[HOLE_RADIUS * 1.1, 48]} />
                <meshBasicMaterial color="#000000" />
            </mesh>

            {/* Glowing rim around the hole */}
            <mesh position={[ox, 0.01, oz]} rotation={[-Math.PI / 2, 0, 0]}>
                <ringGeometry
                    args={[HOLE_RADIUS - 0.08, HOLE_RADIUS + 0.06, 48, 1]}
                />
                <meshStandardMaterial
                    ref={rimRef}
                    color={theme.accentColor}
                    emissive={theme.accentColor}
                    emissiveIntensity={1.6}
                    roughness={0.4}
                />
            </mesh>
            <pointLight
                position={[ox, 0.3, oz]}
                color={theme.accentColor}
                intensity={1.1}
                distance={10}
            />
            {/* Downward cast inside the pit - adds depth */}
            <pointLight
                position={[ox, -2.0, oz]}
                color={theme.accentColor}
                intensity={0.5}
                distance={6}
            />

            {/* Ceiling */}
            <mesh
                position={[ox, ceilingHeight, oz]}
                rotation={[Math.PI / 2, 0, 0]}
                receiveShadow
            >
                <planeGeometry args={[width, depth]} />
                <meshStandardMaterial color={ceilingColor} roughness={0.9} />
            </mesh>

            {/* Side walls */}
            <mesh
                position={[ox - wHalf - WALL_T / 2, ceilingHeight / 2, oz]}
                castShadow
                receiveShadow
            >
                <boxGeometry args={[WALL_T, ceilingHeight, depth]} />
                <meshStandardMaterial color={wallColor} roughness={0.8} />
            </mesh>
            <mesh
                position={[ox + wHalf + WALL_T / 2, ceilingHeight / 2, oz]}
                castShadow
                receiveShadow
            >
                <boxGeometry args={[WALL_T, ceilingHeight, depth]} />
                <meshStandardMaterial color={wallColor} roughness={0.8} />
            </mesh>

            {/* Front wall - keep its doorway so player can enter from the hallway */}
            {hasPrev ? (
                <>
                    <mesh
                        position={[ox - (dw / 2 + sideW / 2), ceilingHeight / 2, oz - dHalf - WALL_T / 2]}
                        castShadow
                        receiveShadow
                    >
                        <boxGeometry args={[sideW, ceilingHeight, WALL_T]} />
                        <meshStandardMaterial color={wallColor} roughness={0.8} />
                    </mesh>
                    <mesh
                        position={[ox + (dw / 2 + sideW / 2), ceilingHeight / 2, oz - dHalf - WALL_T / 2]}
                        castShadow
                        receiveShadow
                    >
                        <boxGeometry args={[sideW, ceilingHeight, WALL_T]} />
                        <meshStandardMaterial color={wallColor} roughness={0.8} />
                    </mesh>
                    <mesh
                        position={[ox, (ceilingHeight + dh) / 2, oz - dHalf - WALL_T / 2]}
                        castShadow
                        receiveShadow
                    >
                        <boxGeometry args={[dw, ceilingHeight - dh, WALL_T]} />
                        <meshStandardMaterial color={wallColor} roughness={0.8} />
                    </mesh>
                </>
            ) : (
                <mesh
                    position={[ox, ceilingHeight / 2, oz - dHalf - WALL_T / 2]}
                    castShadow
                    receiveShadow
                >
                    <boxGeometry args={[width, ceilingHeight, WALL_T]} />
                    <meshStandardMaterial color={wallColor} roughness={0.8} />
                </mesh>
            )}

            {/* Back wall - SEALED. No doorway. This is the whole point. */}
            <mesh
                position={[ox, ceilingHeight / 2, oz + dHalf + WALL_T / 2]}
                castShadow
                receiveShadow
            >
                <boxGeometry args={[width, ceilingHeight, WALL_T]} />
                <meshStandardMaterial color={wallColor} roughness={0.8} />
            </mesh>

            {/* Infographic on the back wall, telling the player what to do */}
            {!behind ? (
                <Infographic
                    theme={theme}
                    position={[ox, ceilingHeight * 0.55, oz + dHalf - 0.15]}
                    rotationY={Math.PI}
                    maxWidth={Math.min(6.5, width * 0.72)}
                    maxHeight={Math.min(3.6, ceilingHeight * 0.72)}
                />
            ) : null}

            {/* Violet ambient fill */}
            {!behind ? (
                <pointLight
                    position={[ox, ceilingHeight - 0.3, oz]}
                    color={theme.lightColor}
                    intensity={0.4}
                    distance={14}
                />
            ) : null}
        </group>
    );
}
