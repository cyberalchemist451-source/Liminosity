'use client';

import * as THREE from 'three';
import { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import type { RoomSpec } from '@/lib/gallery/types';
import { HALLWAY_LENGTH, HALLWAY_WIDTH, HALLWAY_HEIGHT } from '@/lib/gallery/roomGenerator';
import { mulberry32 } from '@/lib/gallery/rng';

const WALL_T = 0.05;
const TUNNEL_HEIGHT = HALLWAY_HEIGHT;
const FISH_BODIES = 5 + 3; // one useFrame, minimal draw calls

// Water box: *strictly* the hallway segment in Z (no end padding). Padding
// was pushing the volume past the door planes into the neighbouring rooms,
// so the back faces of the water shell drew as a huge blue sheet “through”
// solid walls. Width is only slightly past the glass so the tank reads as a
// thin tunnel, not a lake.
const SHELL_WIDTH = HALLWAY_WIDTH + 3.2;
const SHELL_HEIGHT = TUNNEL_HEIGHT + 1.0;
const FISH_MARGIN = 0.35;

type Props = {
    fromRoom: RoomSpec;
    toRoom?: RoomSpec;
};

// Glass-walled tunnel under a thin water volume. Frugal materials (no
// transmission shader), one light, batched fish motion — keeps cost in line
// with other hallway variants and avoids leaking into rooms.
export default function AquariumHallway({ fromRoom, toRoom }: Props) {
    const startZ = fromRoom.origin[2] + fromRoom.depth / 2;
    const length = HALLWAY_LENGTH;
    const endZ = startZ + length;
    const midZ = startZ + length / 2;
    const wHalf = HALLWAY_WIDTH / 2;

    const xInnerAbs = wHalf + FISH_MARGIN + 0.1;
    const xOuterAbs = SHELL_WIDTH / 2 - FISH_MARGIN;
    const yMin = 0.45;
    const yMax = SHELL_HEIGHT - FISH_MARGIN;

    const fishPayload = useMemo(() => {
        const rnd = mulberry32(0x13579bdf ^ Math.floor(startZ * 17.3));
        return Array.from({ length: FISH_BODIES }, (_, i) => ({
            offsetZ: rnd() * length,
            offsetY: Math.min(
                yMax - 0.25,
                Math.max(yMin + 0.2, 1.2 + (rnd() - 0.5) * 1.0 + (i % 2) * 0.4),
            ),
            side: (i % 2 === 0 ? 1 : -1) as 1 | -1,
            speed: 0.55 + rnd() * 0.55,
            phase: rnd() * Math.PI * 2,
            sway: 0.2 + rnd() * 0.22,
            size: 0.07 + rnd() * 0.05,
        }));
    }, [startZ, length, yMin, yMax]);

    return (
        <group>
            <WaterShell centerZ={midZ} length={length} />

            <mesh
                position={[0, -0.01, midZ]}
                rotation={[-Math.PI / 2, 0, 0]}
                receiveShadow
            >
                <planeGeometry args={[HALLWAY_WIDTH, length]} />
                <meshStandardMaterial color="#0a2d3b" roughness={0.7} metalness={0.2} />
            </mesh>

            <GlassPanel
                position={[-wHalf - WALL_T / 2, TUNNEL_HEIGHT / 2, midZ]}
                size={[WALL_T, TUNNEL_HEIGHT, length]}
            />
            <GlassPanel
                position={[wHalf + WALL_T / 2, TUNNEL_HEIGHT / 2, midZ]}
                size={[WALL_T, TUNNEL_HEIGHT, length]}
            />
            <GlassPanel
                position={[0, TUNNEL_HEIGHT + WALL_T / 2, midZ]}
                size={[HALLWAY_WIDTH + WALL_T * 2, WALL_T, length]}
            />

            <BatchedSmallFish
                startZ={startZ}
                length={length}
                xInnerAbs={xInnerAbs}
                xOuterAbs={xOuterAbs}
                yMin={yMin}
                yMax={yMax}
                fish={fishPayload}
            />

            <pointLight
                position={[0, TUNNEL_HEIGHT - 0.4, midZ]}
                color="#7ee0ff"
                intensity={0.85}
                distance={22}
                decay={1.75}
            />

            {!toRoom && (
                <mesh position={[0, TUNNEL_HEIGHT / 2, endZ + 0.1]} castShadow>
                    <boxGeometry args={[HALLWAY_WIDTH, TUNNEL_HEIGHT, 0.1]} />
                    <meshStandardMaterial color="#0a2d3b" roughness={0.9} />
                </mesh>
            )}
        </group>
    );
}

function GlassPanel({
    position,
    size,
}: {
    position: [number, number, number];
    size: [number, number, number];
}) {
    return (
        <mesh position={position}>
            <boxGeometry args={size} />
            <meshStandardMaterial
                color="#6ec8e8"
                transparent
                opacity={0.18}
                roughness={0.2}
                metalness={0.05}
                depthWrite
            />
        </mesh>
    );
}

// Back faces only, solid colour, **depthWrite on** so room walls win the
// depth test and the shell never “projects” through geometry.
function WaterShell({ centerZ, length }: { centerZ: number; length: number }) {
    return (
        <mesh position={[0, SHELL_HEIGHT / 2, centerZ]}>
            <boxGeometry args={[SHELL_WIDTH, SHELL_HEIGHT, length]} />
            <meshStandardMaterial
                color="#0d4a6a"
                emissive="#0a3b55"
                emissiveIntensity={0.12}
                roughness={0.95}
                metalness={0.02}
                side={THREE.BackSide}
                depthWrite
            />
        </mesh>
    );
}

type FishRow = {
    offsetZ: number;
    offsetY: number;
    side: 1 | -1;
    speed: number;
    phase: number;
    sway: number;
    size: number;
};

function BatchedSmallFish({
    startZ,
    length,
    xInnerAbs,
    xOuterAbs,
    yMin,
    yMax,
    fish,
}: {
    startZ: number;
    length: number;
    xInnerAbs: number;
    xOuterAbs: number;
    yMin: number;
    yMax: number;
    fish: FishRow[];
}) {
    const groupRefs = useRef<(THREE.Group | null)[]>([]);
    const xRange = (xOuterAbs - xInnerAbs) / 2 - 0.04;

    useFrame(({ clock }) => {
        const t = clock.getElapsedTime();
        for (let i = 0; i < fish.length; i++) {
            const f = fish[i];
            const g = groupRefs.current[i];
            if (!g) continue;
            const z = startZ + ((f.offsetZ + t * f.speed * 2.8) % length);
            const baseX = f.side * ((xInnerAbs + xOuterAbs) / 2);
            const xOff = Math.sin(t * 1.5 + f.phase) * Math.min(f.sway, xRange);
            const yOff = Math.sin(t * 0.85 + f.phase * 1.2) * 0.15;
            g.position.set(
                baseX + xOff,
                Math.min(yMax, Math.max(yMin, f.offsetY + yOff)),
                z,
            );
            g.rotation.set(0, f.side === 1 ? 0.12 : Math.PI - 0.12, Math.sin(t * 2.5 + f.phase) * 0.1);
        }
    });

    return (
        <>
            {fish.map((f, i) => (
                <group
                    key={i}
                    ref={(el) => {
                        groupRefs.current[i] = el;
                    }}
                >
                    <mesh>
                        <sphereGeometry args={[f.size, 5, 4]} />
                        <meshStandardMaterial
                            color="#b8e0f5"
                            roughness={0.5}
                            metalness={0.25}
                        />
                    </mesh>
                </group>
            ))}
        </>
    );
}
