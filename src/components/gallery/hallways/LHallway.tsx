'use client';

import * as THREE from 'three';
import { useMemo } from 'react';
import type { RoomSpec } from '@/lib/gallery/types';
import {
    HALLWAY_LENGTH,
    HALLWAY_WIDTH,
    HALLWAY_HEIGHT,
} from '@/lib/gallery/roomGenerator';
import { L_SIDE_LEN, L_DOORWAY_SETBACK } from '@/lib/gallery/collision';
import { Fluorescent } from '../Lighting';

const WALL_T = 0.2;

function shade(hex: string, amt: number) {
    const c = new THREE.Color(hex);
    c.offsetHSL(0, 0, amt);
    return `#${c.getHexString()}`;
}

type Props = {
    fromRoom: RoomSpec;
    toRoom?: RoomSpec;
};

// An L-shaped corridor: a short perpendicular "spur" leaves the from-room's
// side wall near its back corner, hits a 90-degree turn at the outer corner,
// and then the usual HALLWAY_LENGTH-long forward stretch runs +Z to the next
// room's front doorway. Collision geometry is maintained in
// lib/gallery/collision.ts; this file is the visual pair.
//
// Coordinates are world-absolute (not relative to any parent group) so the
// spur can sit at world X = fromRoom.origin[0] +/- room.width/2 regardless
// of how the rest of the gallery is laid out.
export default function LHallway({ fromRoom, toRoom }: Props) {
    const variant = fromRoom.hallwayVariant;
    const side = variant === 'l-right' ? 1 : -1;

    const ox = fromRoom.origin[0];
    const backZ = fromRoom.origin[2] + fromRoom.depth / 2;
    const doorwayZ = backZ - L_DOORWAY_SETBACK;
    const roomEdgeX = ox + side * (fromRoom.width / 2);
    const cornerX = ox + side * (fromRoom.width / 2 + L_SIDE_LEN);

    const HW = HALLWAY_WIDTH;
    const hwHalf = HW / 2;
    const ceilingH = HALLWAY_HEIGHT;

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

    // ---- Forward geometry (parallel to +Z) -------------------------
    //
    // Forward runs from the corner +Z for HALLWAY_LENGTH metres; the
    // minZ of this rectangle extends back a half-width so it meets the
    // spur in the corner square cleanly.
    const fwdStartZ = doorwayZ - hwHalf;
    const fwdEndZ = doorwayZ + HALLWAY_LENGTH;
    const fwdLen = fwdEndZ - fwdStartZ;
    const fwdCenterZ = (fwdStartZ + fwdEndZ) / 2;

    // The corner square sits inside both segments so we don't duplicate
    // its floor/ceiling; render the spur's floor as the strip from the
    // room wall up to (but excluding) the corner overlap, and the
    // forward floor covers the rest.
    const spurInnerEndX = cornerX - side * hwHalf;
    const spurCoreLen = Math.abs(spurInnerEndX - roomEdgeX);
    const spurCoreCenterX = (roomEdgeX + spurInnerEndX) / 2;

    return (
        <group>
            {/* ---- Spur floor (room wall -> corner inner edge) ---- */}
            <mesh
                position={[spurCoreCenterX, -0.01, doorwayZ]}
                rotation={[-Math.PI / 2, 0, 0]}
                receiveShadow
            >
                <planeGeometry args={[spurCoreLen, HW]} />
                <meshStandardMaterial color={floorColor} roughness={0.85} />
            </mesh>
            {/* ---- Spur ceiling ---- */}
            <mesh
                position={[spurCoreCenterX, ceilingH, doorwayZ]}
                rotation={[Math.PI / 2, 0, 0]}
                receiveShadow
            >
                <planeGeometry args={[spurCoreLen, HW]} />
                <meshStandardMaterial color={ceilingColor} roughness={0.9} />
            </mesh>
            {/* ---- Spur walls (two long walls running along X) ----
                 These cap the spur along its +Z and -Z edges so the
                 corridor is enclosed. They stop at the corner inner
                 edge so the turn is open. */}
            <mesh
                position={[spurCoreCenterX, ceilingH / 2, doorwayZ - hwHalf - WALL_T / 2]}
                castShadow
                receiveShadow
            >
                <boxGeometry args={[spurCoreLen, ceilingH, WALL_T]} />
                <meshStandardMaterial color={wallColor} roughness={0.8} />
            </mesh>
            <mesh
                position={[spurCoreCenterX, ceilingH / 2, doorwayZ + hwHalf + WALL_T / 2]}
                castShadow
                receiveShadow
            >
                <boxGeometry args={[spurCoreLen, ceilingH, WALL_T]} />
                <meshStandardMaterial color={wallColor} roughness={0.8} />
            </mesh>

            {/* ---- Corner cell floor / ceiling (HW x HW) ---- */}
            <mesh
                position={[cornerX, -0.01, doorwayZ]}
                rotation={[-Math.PI / 2, 0, 0]}
                receiveShadow
            >
                <planeGeometry args={[HW, HW]} />
                <meshStandardMaterial color={floorColor} roughness={0.85} />
            </mesh>
            <mesh
                position={[cornerX, ceilingH, doorwayZ]}
                rotation={[Math.PI / 2, 0, 0]}
                receiveShadow
            >
                <planeGeometry args={[HW, HW]} />
                <meshStandardMaterial color={ceilingColor} roughness={0.9} />
            </mesh>
            {/* Corner outer walls: the two walls of the corner that
                *aren't* shared with the spur or forward. For an l-right
                turn, these are the outer +X wall and the -Z back of the
                corner (which seals the turn cleanly to the back of the
                room). For l-left, mirrored. */}
            <mesh
                position={[
                    cornerX + side * (hwHalf + WALL_T / 2),
                    ceilingH / 2,
                    doorwayZ,
                ]}
                castShadow
                receiveShadow
            >
                <boxGeometry args={[WALL_T, ceilingH, HW + WALL_T * 2]} />
                <meshStandardMaterial color={wallColor} roughness={0.8} />
            </mesh>
            <mesh
                position={[
                    cornerX,
                    ceilingH / 2,
                    doorwayZ - hwHalf - WALL_T / 2,
                ]}
                castShadow
                receiveShadow
            >
                <boxGeometry args={[HW, ceilingH, WALL_T]} />
                <meshStandardMaterial color={wallColor} roughness={0.8} />
            </mesh>

            {/* ---- Forward floor / ceiling (starts at corner far edge) ---- */}
            <mesh
                position={[cornerX, -0.01, fwdCenterZ + hwHalf / 2]}
                rotation={[-Math.PI / 2, 0, 0]}
                receiveShadow
            >
                <planeGeometry args={[HW, fwdLen - HW]} />
                <meshStandardMaterial color={floorColor} roughness={0.85} />
            </mesh>
            <mesh
                position={[cornerX, ceilingH, fwdCenterZ + hwHalf / 2]}
                rotation={[Math.PI / 2, 0, 0]}
                receiveShadow
            >
                <planeGeometry args={[HW, fwdLen - HW]} />
                <meshStandardMaterial color={ceilingColor} roughness={0.9} />
            </mesh>

            {/* ---- Forward side walls ----
                 The forward corridor has a wall on each +X/-X side. The
                 wall opposite the corner runs the full forward length
                 from the corner outer edge to the next room's front.
                 The wall on the corner side starts *after* the corner
                 opening so the turn is walkable. */}
            <mesh
                position={[
                    cornerX + side * (hwHalf + WALL_T / 2),
                    ceilingH / 2,
                    (doorwayZ + hwHalf + fwdEndZ) / 2,
                ]}
                castShadow
                receiveShadow
            >
                <boxGeometry args={[WALL_T, ceilingH, fwdEndZ - (doorwayZ + hwHalf)]} />
                <meshStandardMaterial color={wallColor} roughness={0.8} />
            </mesh>
            <mesh
                position={[
                    cornerX - side * (hwHalf + WALL_T / 2),
                    ceilingH / 2,
                    (doorwayZ + hwHalf + fwdEndZ) / 2,
                ]}
                castShadow
                receiveShadow
            >
                <boxGeometry args={[WALL_T, ceilingH, fwdEndZ - (doorwayZ + hwHalf)]} />
                <meshStandardMaterial color={wallColor} roughness={0.8} />
            </mesh>

            {/* ---- Dead-end cap (when the next room isn't built yet) ---- */}
            {!toRoom && (
                <mesh
                    position={[cornerX, ceilingH / 2, fwdEndZ + WALL_T / 2]}
                    castShadow
                    receiveShadow
                >
                    <boxGeometry args={[HW, ceilingH, WALL_T]} />
                    <meshStandardMaterial color={shade(wallColor, -0.2)} roughness={0.9} />
                </mesh>
            )}

            {/* ---- Fluorescents ----
                 One emissive (lit) fixture at the corner carries the
                 pool of light through the turn; a second unlit tube
                 mid-forward keeps the long stretch feeling populated
                 without spending a second real point light. */}
            <Fluorescent
                position={[cornerX, ceilingH - 0.25, doorwayZ]}
                color={fromRoom.theme.lightColor}
                intensity={0.9}
                lit={true}
                length={1.4}
            />
            <Fluorescent
                position={[cornerX, ceilingH - 0.25, doorwayZ + HALLWAY_LENGTH * 0.65]}
                color={toRoom?.theme.lightColor ?? fromRoom.theme.lightColor}
                intensity={0.6}
                lit={false}
                length={1.8}
            />

        </group>
    );
}
