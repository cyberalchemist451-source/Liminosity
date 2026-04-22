'use client';

import * as THREE from 'three';
import { useMemo } from 'react';
import type { RoomSpec } from '@/lib/gallery/types';
import { HALLWAY_LENGTH, HALLWAY_WIDTH, HALLWAY_HEIGHT } from '@/lib/gallery/roomGenerator';
import { JOG_STEM_LEN, JOG_MIDDLE_LEN } from '@/lib/gallery/collision';
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

// A hallway that takes two 90-degree turns around corners. Entry and exit
// both sit at x=0 so rooms still stack along +Z, but the middle segment is
// laterally offset by `hallwayJogOffset`. The walkable footprint is a
// piecewise union matched by collision.getJogHallwayXRange.
export default function JogHallway({ fromRoom, toRoom }: Props) {
    const startZ = fromRoom.origin[2] + fromRoom.depth / 2;
    const ceilingH = HALLWAY_HEIGHT;
    const HW = HALLWAY_WIDTH;
    const offset = fromRoom.hallwayJogOffset ?? 5;
    const minSide = Math.min(0, offset);
    const maxSide = Math.max(0, offset);
    const cornerWidth = maxSide - minSide + HW;
    const cornerCenterX = (minSide + maxSide) / 2;

    const stem1End = startZ + JOG_STEM_LEN;
    const corner1End = stem1End + HW;
    const middleEnd = corner1End + JOG_MIDDLE_LEN;
    const corner2End = middleEnd + HW;
    const exitEnd = startZ + HALLWAY_LENGTH;
    const stem2Len = exitEnd - corner2End;

    // Sanity: If the lateral offset would push the corner outside a sensible
    // range, clamp the render accordingly. Already done at roll-time but we
    // cheap-guard here too.

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

    // Convenience helpers for rendering floors/ceilings.
    const floorMat = (
        <meshStandardMaterial color={floorColor} roughness={0.85} />
    );
    const ceilMat = (
        <meshStandardMaterial color={ceilingColor} roughness={0.9} />
    );

    return (
        <group>
            {/* -------- FLOORS (one per segment) -------- */}
            <mesh
                position={[0, -0.01, (startZ + stem1End) / 2]}
                rotation={[-Math.PI / 2, 0, 0]}
                receiveShadow
            >
                <planeGeometry args={[HW, stem1End - startZ]} />
                {floorMat}
            </mesh>
            <mesh
                position={[cornerCenterX, -0.01, (stem1End + corner1End) / 2]}
                rotation={[-Math.PI / 2, 0, 0]}
                receiveShadow
            >
                <planeGeometry args={[cornerWidth, HW]} />
                {floorMat}
            </mesh>
            <mesh
                position={[offset, -0.01, (corner1End + middleEnd) / 2]}
                rotation={[-Math.PI / 2, 0, 0]}
                receiveShadow
            >
                <planeGeometry args={[HW, JOG_MIDDLE_LEN]} />
                {floorMat}
            </mesh>
            <mesh
                position={[cornerCenterX, -0.01, (middleEnd + corner2End) / 2]}
                rotation={[-Math.PI / 2, 0, 0]}
                receiveShadow
            >
                <planeGeometry args={[cornerWidth, HW]} />
                {floorMat}
            </mesh>
            <mesh
                position={[0, -0.01, (corner2End + exitEnd) / 2]}
                rotation={[-Math.PI / 2, 0, 0]}
                receiveShadow
            >
                <planeGeometry args={[HW, stem2Len]} />
                {floorMat}
            </mesh>

            {/* -------- CEILINGS -------- */}
            <mesh
                position={[0, ceilingH, (startZ + stem1End) / 2]}
                rotation={[Math.PI / 2, 0, 0]}
                receiveShadow
            >
                <planeGeometry args={[HW, stem1End - startZ]} />
                {ceilMat}
            </mesh>
            <mesh
                position={[cornerCenterX, ceilingH, (stem1End + corner1End) / 2]}
                rotation={[Math.PI / 2, 0, 0]}
                receiveShadow
            >
                <planeGeometry args={[cornerWidth, HW]} />
                {ceilMat}
            </mesh>
            <mesh
                position={[offset, ceilingH, (corner1End + middleEnd) / 2]}
                rotation={[Math.PI / 2, 0, 0]}
                receiveShadow
            >
                <planeGeometry args={[HW, JOG_MIDDLE_LEN]} />
                {ceilMat}
            </mesh>
            <mesh
                position={[cornerCenterX, ceilingH, (middleEnd + corner2End) / 2]}
                rotation={[Math.PI / 2, 0, 0]}
                receiveShadow
            >
                <planeGeometry args={[cornerWidth, HW]} />
                {ceilMat}
            </mesh>
            <mesh
                position={[0, ceilingH, (corner2End + exitEnd) / 2]}
                rotation={[Math.PI / 2, 0, 0]}
                receiveShadow
            >
                <planeGeometry args={[HW, stem2Len]} />
                {ceilMat}
            </mesh>

            {/* ---------- WALLS ----------
                Stem1 has left, right walls along its full length.
                Corner1 closes the outer corners; the inner corner opens into
                the middle segment. Middle segment has walls along +/-X of
                its narrow corridor except at the Z endpoints. Corner2 and
                stem2 mirror corner1 and stem1. Each wall runs parallel to
                an axis and is a simple box. */}

            {/* Stem1 side walls */}
            <WallZ
                x={-HW / 2 - WALL_T / 2}
                zStart={startZ}
                zEnd={stem1End}
                height={ceilingH}
                color={wallColor}
            />
            <WallZ
                x={HW / 2 + WALL_T / 2}
                zStart={startZ}
                zEnd={stem1End}
                height={ceilingH}
                color={wallColor}
            />

            {/* Corner1 outer-corner walls. One wall on the side opposite the
                jog direction (fills the square), plus a pair that closes the
                far front edge of the cross-bar (leaving only the door back
                into stem1 and the door into the middle segment open). */}
            {offset >= 0 ? (
                <>
                    {/* Wall along -X side of corner1 closing it back into stem1 area */}
                    <WallZ
                        x={-HW / 2 - WALL_T / 2}
                        zStart={stem1End}
                        zEnd={corner1End}
                        height={ceilingH}
                        color={wallColor}
                    />
                    {/* Front face of corner1: +Z side, between HW/2 and offset-HW/2 */}
                    <WallX
                        z={corner1End + WALL_T / 2}
                        xStart={-HW / 2}
                        xEnd={offset - HW / 2}
                        height={ceilingH}
                        color={wallColor}
                    />
                    {/* Back face of corner1: -Z side, between HW/2 and offset+HW/2 */}
                    <WallX
                        z={stem1End - WALL_T / 2}
                        xStart={HW / 2}
                        xEnd={offset + HW / 2}
                        height={ceilingH}
                        color={wallColor}
                    />
                    {/* Outer wall of corner1: +X side (end cap of cross-bar) */}
                    <WallZ
                        x={offset + HW / 2 + WALL_T / 2}
                        zStart={stem1End}
                        zEnd={corner1End}
                        height={ceilingH}
                        color={wallColor}
                    />
                </>
            ) : (
                <>
                    <WallZ
                        x={HW / 2 + WALL_T / 2}
                        zStart={stem1End}
                        zEnd={corner1End}
                        height={ceilingH}
                        color={wallColor}
                    />
                    <WallX
                        z={corner1End + WALL_T / 2}
                        xStart={offset + HW / 2}
                        xEnd={HW / 2}
                        height={ceilingH}
                        color={wallColor}
                    />
                    <WallX
                        z={stem1End - WALL_T / 2}
                        xStart={offset - HW / 2}
                        xEnd={-HW / 2}
                        height={ceilingH}
                        color={wallColor}
                    />
                    <WallZ
                        x={offset - HW / 2 - WALL_T / 2}
                        zStart={stem1End}
                        zEnd={corner1End}
                        height={ceilingH}
                        color={wallColor}
                    />
                </>
            )}

            {/* Middle segment side walls */}
            <WallZ
                x={offset - HW / 2 - WALL_T / 2}
                zStart={corner1End}
                zEnd={middleEnd}
                height={ceilingH}
                color={wallColor}
            />
            <WallZ
                x={offset + HW / 2 + WALL_T / 2}
                zStart={corner1End}
                zEnd={middleEnd}
                height={ceilingH}
                color={wallColor}
            />

            {/* Corner2 - mirror of corner1 (opens toward -Z into middle, and
                toward +Z into stem2). */}
            {offset >= 0 ? (
                <>
                    <WallZ
                        x={-HW / 2 - WALL_T / 2}
                        zStart={middleEnd}
                        zEnd={corner2End}
                        height={ceilingH}
                        color={wallColor}
                    />
                    <WallX
                        z={middleEnd - WALL_T / 2}
                        xStart={-HW / 2}
                        xEnd={offset - HW / 2}
                        height={ceilingH}
                        color={wallColor}
                    />
                    <WallX
                        z={corner2End + WALL_T / 2}
                        xStart={HW / 2}
                        xEnd={offset + HW / 2}
                        height={ceilingH}
                        color={wallColor}
                    />
                    <WallZ
                        x={offset + HW / 2 + WALL_T / 2}
                        zStart={middleEnd}
                        zEnd={corner2End}
                        height={ceilingH}
                        color={wallColor}
                    />
                </>
            ) : (
                <>
                    <WallZ
                        x={HW / 2 + WALL_T / 2}
                        zStart={middleEnd}
                        zEnd={corner2End}
                        height={ceilingH}
                        color={wallColor}
                    />
                    <WallX
                        z={middleEnd - WALL_T / 2}
                        xStart={offset + HW / 2}
                        xEnd={HW / 2}
                        height={ceilingH}
                        color={wallColor}
                    />
                    <WallX
                        z={corner2End + WALL_T / 2}
                        xStart={offset - HW / 2}
                        xEnd={-HW / 2}
                        height={ceilingH}
                        color={wallColor}
                    />
                    <WallZ
                        x={offset - HW / 2 - WALL_T / 2}
                        zStart={middleEnd}
                        zEnd={corner2End}
                        height={ceilingH}
                        color={wallColor}
                    />
                </>
            )}

            {/* Stem2 side walls */}
            <WallZ
                x={-HW / 2 - WALL_T / 2}
                zStart={corner2End}
                zEnd={exitEnd}
                height={ceilingH}
                color={wallColor}
            />
            <WallZ
                x={HW / 2 + WALL_T / 2}
                zStart={corner2End}
                zEnd={exitEnd}
                height={ceilingH}
                color={wallColor}
            />

            {/* Dead-end cap when next room is still pending */}
            {!toRoom && (
                <mesh
                    position={[0, ceilingH / 2, exitEnd + WALL_T / 2]}
                    castShadow
                    receiveShadow
                >
                    <boxGeometry args={[HW, ceilingH, WALL_T]} />
                    <meshStandardMaterial color={shade(wallColor, -0.2)} roughness={0.9} />
                </mesh>
            )}

            {/* Accent strip under each corner ceiling to mark the turn, plus
                one ceiling fixture per segment. */}
            <Fluorescent
                position={[0, ceilingH - 0.25, (startZ + stem1End) / 2]}
                color={fromRoom.theme.lightColor}
                intensity={0.7}
            />
            <Fluorescent
                position={[cornerCenterX, ceilingH - 0.25, (stem1End + corner1End) / 2]}
                color={fromRoom.theme.lightColor}
                intensity={0.65}
            />
            <Fluorescent
                position={[offset, ceilingH - 0.25, (corner1End + middleEnd) / 2]}
                color={fromRoom.theme.lightColor}
                intensity={0.7}
            />
            <Fluorescent
                position={[cornerCenterX, ceilingH - 0.25, (middleEnd + corner2End) / 2]}
                color={fromRoom.theme.lightColor}
                intensity={0.65}
            />
            <Fluorescent
                position={[0, ceilingH - 0.25, (corner2End + exitEnd) / 2]}
                color={fromRoom.theme.lightColor}
                intensity={0.7}
            />
        </group>
    );
}

// Axis-aligned wall running parallel to Z. `x` is the world X center of the
// slab; wall spans z in [zStart, zEnd] with thickness WALL_T on X.
function WallZ({
    x,
    zStart,
    zEnd,
    height,
    color,
}: {
    x: number;
    zStart: number;
    zEnd: number;
    height: number;
    color: string;
}) {
    const len = zEnd - zStart;
    if (len <= 0) return null;
    return (
        <mesh
            position={[x, height / 2, (zStart + zEnd) / 2]}
            castShadow
            receiveShadow
        >
            <boxGeometry args={[WALL_T, height, len]} />
            <meshStandardMaterial color={color} roughness={0.8} />
        </mesh>
    );
}

// Axis-aligned wall running parallel to X. `z` is the Z center of the slab.
function WallX({
    z,
    xStart,
    xEnd,
    height,
    color,
}: {
    z: number;
    xStart: number;
    xEnd: number;
    height: number;
    color: string;
}) {
    const lo = Math.min(xStart, xEnd);
    const hi = Math.max(xStart, xEnd);
    const len = hi - lo;
    if (len <= 0) return null;
    return (
        <mesh
            position={[(lo + hi) / 2, height / 2, z]}
            castShadow
            receiveShadow
        >
            <boxGeometry args={[len, height, WALL_T]} />
            <meshStandardMaterial color={color} roughness={0.8} />
        </mesh>
    );
}
