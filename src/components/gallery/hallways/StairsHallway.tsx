'use client';

import * as THREE from 'three';
import { useMemo } from 'react';
import type { RoomSpec } from '@/lib/gallery/types';
import { HALLWAY_LENGTH, HALLWAY_WIDTH } from '@/lib/gallery/roomGenerator';
import { STAIRS_RUN, STAIRS_PLATEAU, STAIRS_RISE } from '@/lib/gallery/collision';
import { Fluorescent } from '../Lighting';

const WALL_T = 0.2;
// Clearance between the walking surface and the ceiling at every point
// along the stairwell. The ceiling is held perfectly flat at the plateau's
// roof height, so the narrowest headroom (over the plateau) is exactly
// this value and the widest (at the foot of the ramp) is
// RAMP_CEILING + STAIRS_RISE.
const RAMP_CEILING = 5.2;
const CEILING_Y = STAIRS_RISE + RAMP_CEILING; // local y of the ceiling
const CEILING_T = 0.22; // real thickness so we never read a seam

function shade(hex: string, amt: number) {
    const c = new THREE.Color(hex);
    c.offsetHSL(0, 0, amt);
    return `#${c.getHexString()}`;
}

type Props = {
    fromRoom: RoomSpec;
    toRoom?: RoomSpec;
};

// A hallway that rises for STAIRS_RUN metres from the from-room's floor
// up to a new altitude (STAIRS_RISE higher) and then holds that altitude
// for STAIRS_PLATEAU metres until the doorway into the next room. The
// rise is one-way: every subsequent room is generated at the raised
// floor height, so the museum gains elevation permanently as the player
// climbs more staircases.
//
// All y values in this component are in local (from-room floor relative)
// coordinates. RoomManager wraps the hallway in a group at the from
// room's persistent floor height.
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
    const endZ = startZ + length;

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

    const riserW = HALLWAY_WIDTH;

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

            {/* Plateau - full remaining length at the raised altitude.
                This is what the next room's doorway opens onto. */}
            <mesh
                position={[0, STAIRS_RISE - 0.01, plateauMidZ]}
                rotation={[-Math.PI / 2, 0, 0]}
                receiveShadow
            >
                <planeGeometry args={[HALLWAY_WIDTH, STAIRS_PLATEAU]} />
                <meshStandardMaterial color={floorColor} roughness={0.85} />
            </mesh>

            {/* Decorative step tops and risers on the ascent */}
            {stepsUp.map((s, i) => (
                <group key={`u${i}`}>
                    <mesh
                        position={[0, s.y + s.rise / 2 + 0.005, s.z]}
                        rotation={[-Math.PI / 2, 0, 0]}
                        receiveShadow
                    >
                        <planeGeometry args={[riserW, s.depth]} />
                        <meshStandardMaterial color={stepColor} roughness={0.9} />
                    </mesh>
                    <mesh
                        position={[0, s.y, s.z - s.depth / 2]}
                        receiveShadow
                    >
                        <boxGeometry args={[riserW, s.rise, 0.02]} />
                        <meshStandardMaterial color={stepEdge} roughness={0.85} />
                    </mesh>
                </group>
            ))}

            {/* Flat ceiling at the plateau's roof height, spanning the full
                hallway length as a single thick slab. Overlaps the side walls
                slightly so no sliver of void is ever visible at the joint. */}
            <mesh
                position={[0, CEILING_Y + CEILING_T / 2, startZ + length / 2]}
                receiveShadow
            >
                <boxGeometry
                    args={[HALLWAY_WIDTH + 0.5, CEILING_T, length + 0.2]}
                />
                <meshStandardMaterial color={ceilingColor} roughness={0.9} />
            </mesh>

            {/* Side walls: run from the floor up past the ceiling slab, also
                overlapping slightly so the seam with the ceiling reads as
                solid stone rather than an open edge. */}
            <mesh
                position={[
                    -wHalf - WALL_T / 2,
                    (CEILING_Y + CEILING_T) / 2,
                    startZ + length / 2,
                ]}
                castShadow
                receiveShadow
            >
                <boxGeometry args={[WALL_T, CEILING_Y + CEILING_T + 0.4, length]} />
                <meshStandardMaterial color={wallColor} roughness={0.85} />
            </mesh>
            <mesh
                position={[
                    wHalf + WALL_T / 2,
                    (CEILING_Y + CEILING_T) / 2,
                    startZ + length / 2,
                ]}
                castShadow
                receiveShadow
            >
                <boxGeometry args={[WALL_T, CEILING_Y + CEILING_T + 0.4, length]} />
                <meshStandardMaterial color={wallColor} roughness={0.85} />
            </mesh>

            {/* Lighting: one at the top of the rise, one mid-plateau, one
                near the far doorway so the climb is never dim. */}
            <Fluorescent
                position={[0, CEILING_Y - 0.25, startZ + STAIRS_RUN]}
                color={fromRoom.theme.lightColor}
                intensity={0.6}
            />
            <Fluorescent
                position={[0, CEILING_Y - 0.25, plateauMidZ]}
                color={fromRoom.theme.lightColor}
                intensity={0.55}
            />
            <Fluorescent
                position={[0, CEILING_Y - 0.25, endZ - 2.0]}
                color={fromRoom.theme.lightColor}
                intensity={0.6}
            />

            {/* Dead-end cap when the next room hasn't streamed in yet.
                Sits on the plateau level so we never reveal a wedge of
                void below the stairwell. */}
            {!toRoom && (
                <mesh
                    position={[
                        0,
                        STAIRS_RISE + (CEILING_Y - STAIRS_RISE + CEILING_T) / 2,
                        endZ + WALL_T / 2,
                    ]}
                    castShadow
                    receiveShadow
                >
                    <boxGeometry
                        args={[
                            HALLWAY_WIDTH + 0.5,
                            CEILING_Y - STAIRS_RISE + CEILING_T,
                            WALL_T,
                        ]}
                    />
                    <meshStandardMaterial color={shade(wallColor, -0.2)} roughness={0.9} />
                </mesh>
            )}
        </group>
    );
}
