'use client';

import * as THREE from 'three';
import { useMemo } from 'react';
import type { RoomSpec } from '@/lib/gallery/types';
import { HALLWAY_LENGTH, HALLWAY_WIDTH } from '@/lib/gallery/roomGenerator';
import { STAIRS_RUN, STAIRS_PLATEAU, STAIRS_RISE } from '@/lib/gallery/collision';
import { Fluorescent } from '../Lighting';

const WALL_T = 0.2;
const RAMP_CEILING = 4.2;

function shade(hex: string, amt: number) {
    const c = new THREE.Color(hex);
    c.offsetHSL(0, 0, amt);
    return `#${c.getHexString()}`;
}

type Props = {
    fromRoom: RoomSpec;
    toRoom?: RoomSpec;
};

// A hallway that rises for STAIRS_RUN metres to a plateau at STAIRS_RISE,
// holds that height for STAIRS_PLATEAU metres, then descends symmetrically.
// Walking physics is handled centrally through collision.groundYAt; this
// component is visuals only: a smooth ramp mesh acts as the "real" floor for
// sampling, while a stack of box geometries on top decorates it as proper
// steps.
export default function StairsHallway({ fromRoom, toRoom }: Props) {
    const startZ = fromRoom.origin[2] + fromRoom.depth / 2;
    const length = HALLWAY_LENGTH;
    const wHalf = HALLWAY_WIDTH / 2;

    const fromColor = fromRoom.theme.wallColor;
    const toColor = toRoom?.theme.wallColor ?? fromColor;

    const midColor = useMemo(() => {
        const a = new THREE.Color(fromColor);
        const b = new THREE.Color(toColor);
        return `#${a.clone().lerp(b, 0.5).getHexString()}`;
    }, [fromColor, toColor]);

    const floorColor = shade(midColor, -0.22);
    const ceilingColor = shade(midColor, 0.08);
    const wallColor = midColor;
    const stepColor = shade(floorColor, 0.06);
    const stepEdge = shade(stepColor, -0.18);

    // Segment midpoints along Z.
    const upMidZ = startZ + STAIRS_RUN / 2;
    const plateauMidZ = startZ + STAIRS_RUN + STAIRS_PLATEAU / 2;
    const downMidZ = startZ + STAIRS_RUN + STAIRS_PLATEAU + STAIRS_RUN / 2;
    const endZ = startZ + length;

    // Tilt angles for the two ramp planes (so they align with the traversal
    // slope and the step risers sit flush).
    const rampAngle = Math.atan2(STAIRS_RISE, STAIRS_RUN);

    // Build discrete step rectangles for visual steps. 12 steps per ramp.
    const stepsUp = useMemo(() => {
        const n = 12;
        const out: Array<{ z: number; y: number; depth: number; rise: number }> = [];
        const run = STAIRS_RUN / n;
        const rise = STAIRS_RISE / n;
        for (let i = 0; i < n; i++) {
            out.push({
                z: startZ + i * run + run / 2,
                y: i * rise + rise / 2,
                depth: run,
                rise,
            });
        }
        return out;
    }, [startZ]);

    const stepsDown = useMemo(() => {
        const n = 12;
        const out: Array<{ z: number; y: number; depth: number; rise: number }> = [];
        const run = STAIRS_RUN / n;
        const rise = STAIRS_RISE / n;
        const down0 = startZ + STAIRS_RUN + STAIRS_PLATEAU;
        for (let i = 0; i < n; i++) {
            out.push({
                z: down0 + i * run + run / 2,
                y: STAIRS_RISE - i * rise - rise / 2,
                depth: run,
                rise,
            });
        }
        return out;
    }, [startZ]);

    return (
        <group>
            {/* Ascending ramp (smooth physics surface, tilted) */}
            <mesh
                position={[0, STAIRS_RISE / 2, upMidZ]}
                rotation={[-Math.PI / 2 + rampAngle, 0, 0]}
                receiveShadow
            >
                <planeGeometry
                    args={[HALLWAY_WIDTH, Math.sqrt(STAIRS_RUN ** 2 + STAIRS_RISE ** 2)]}
                />
                <meshStandardMaterial color={floorColor} roughness={0.9} />
            </mesh>

            {/* Plateau */}
            <mesh
                position={[0, STAIRS_RISE - 0.01, plateauMidZ]}
                rotation={[-Math.PI / 2, 0, 0]}
                receiveShadow
            >
                <planeGeometry args={[HALLWAY_WIDTH, STAIRS_PLATEAU]} />
                <meshStandardMaterial color={floorColor} roughness={0.85} />
            </mesh>

            {/* Descending ramp */}
            <mesh
                position={[0, STAIRS_RISE / 2, downMidZ]}
                rotation={[-Math.PI / 2 - rampAngle, 0, 0]}
                receiveShadow
            >
                <planeGeometry
                    args={[HALLWAY_WIDTH, Math.sqrt(STAIRS_RUN ** 2 + STAIRS_RISE ** 2)]}
                />
                <meshStandardMaterial color={floorColor} roughness={0.9} />
            </mesh>

            {/* Decorative step tops and risers on the ascent */}
            {stepsUp.map((s, i) => (
                <group key={`u${i}`}>
                    <mesh
                        position={[0, s.y + s.rise / 2 + 0.005, s.z]}
                        rotation={[-Math.PI / 2, 0, 0]}
                        receiveShadow
                    >
                        <planeGeometry args={[HALLWAY_WIDTH, s.depth]} />
                        <meshStandardMaterial color={stepColor} roughness={0.9} />
                    </mesh>
                    <mesh
                        position={[0, s.y, s.z - s.depth / 2]}
                        receiveShadow
                    >
                        <boxGeometry args={[HALLWAY_WIDTH, s.rise, 0.02]} />
                        <meshStandardMaterial color={stepEdge} roughness={0.85} />
                    </mesh>
                </group>
            ))}

            {/* Descent steps */}
            {stepsDown.map((s, i) => (
                <group key={`d${i}`}>
                    <mesh
                        position={[0, s.y + s.rise / 2 + 0.005, s.z]}
                        rotation={[-Math.PI / 2, 0, 0]}
                        receiveShadow
                    >
                        <planeGeometry args={[HALLWAY_WIDTH, s.depth]} />
                        <meshStandardMaterial color={stepColor} roughness={0.9} />
                    </mesh>
                    <mesh
                        position={[0, s.y, s.z + s.depth / 2]}
                        receiveShadow
                    >
                        <boxGeometry args={[HALLWAY_WIDTH, s.rise, 0.02]} />
                        <meshStandardMaterial color={stepEdge} roughness={0.85} />
                    </mesh>
                </group>
            ))}

            {/* Ceiling follows the stair profile roughly: up, plateau high, down */}
            <mesh
                position={[0, RAMP_CEILING + STAIRS_RISE / 2, upMidZ]}
                rotation={[Math.PI / 2 + rampAngle, 0, 0]}
                receiveShadow
            >
                <planeGeometry
                    args={[HALLWAY_WIDTH, Math.sqrt(STAIRS_RUN ** 2 + STAIRS_RISE ** 2) + 0.3]}
                />
                <meshStandardMaterial color={ceilingColor} roughness={0.9} />
            </mesh>
            <mesh
                position={[0, RAMP_CEILING + STAIRS_RISE, plateauMidZ]}
                rotation={[Math.PI / 2, 0, 0]}
                receiveShadow
            >
                <planeGeometry args={[HALLWAY_WIDTH, STAIRS_PLATEAU]} />
                <meshStandardMaterial color={ceilingColor} roughness={0.9} />
            </mesh>
            <mesh
                position={[0, RAMP_CEILING + STAIRS_RISE / 2, downMidZ]}
                rotation={[Math.PI / 2 - rampAngle, 0, 0]}
                receiveShadow
            >
                <planeGeometry
                    args={[HALLWAY_WIDTH, Math.sqrt(STAIRS_RUN ** 2 + STAIRS_RISE ** 2) + 0.3]}
                />
                <meshStandardMaterial color={ceilingColor} roughness={0.9} />
            </mesh>

            {/* Side walls: tall enough to span ground-to-ceiling everywhere */}
            <mesh
                position={[-wHalf - WALL_T / 2, STAIRS_RISE / 2 + RAMP_CEILING / 2, startZ + length / 2]}
                castShadow
                receiveShadow
            >
                <boxGeometry args={[WALL_T, STAIRS_RISE + RAMP_CEILING, length]} />
                <meshStandardMaterial color={wallColor} roughness={0.85} />
            </mesh>
            <mesh
                position={[wHalf + WALL_T / 2, STAIRS_RISE / 2 + RAMP_CEILING / 2, startZ + length / 2]}
                castShadow
                receiveShadow
            >
                <boxGeometry args={[WALL_T, STAIRS_RISE + RAMP_CEILING, length]} />
                <meshStandardMaterial color={wallColor} roughness={0.85} />
            </mesh>

            {/* Lighting: a fixture at plateau entrance and exit plus one in the middle */}
            <Fluorescent
                position={[0, RAMP_CEILING + STAIRS_RISE - 0.3, startZ + STAIRS_RUN]}
                color={fromRoom.theme.lightColor}
                intensity={0.6}
            />
            <Fluorescent
                position={[0, RAMP_CEILING + STAIRS_RISE - 0.3, plateauMidZ]}
                color={fromRoom.theme.lightColor}
                intensity={0.55}
            />
            <Fluorescent
                position={[0, RAMP_CEILING + STAIRS_RISE - 0.3, startZ + STAIRS_RUN + STAIRS_PLATEAU]}
                color={fromRoom.theme.lightColor}
                intensity={0.6}
            />

            {/* Dead-end cap when the next room hasn't streamed in yet */}
            {!toRoom && (
                <mesh
                    position={[0, RAMP_CEILING / 2, endZ + WALL_T / 2]}
                    castShadow
                    receiveShadow
                >
                    <boxGeometry args={[HALLWAY_WIDTH, RAMP_CEILING, WALL_T]} />
                    <meshStandardMaterial color={shade(wallColor, -0.2)} roughness={0.9} />
                </mesh>
            )}
        </group>
    );
}
