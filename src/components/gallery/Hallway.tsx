'use client';

import * as THREE from 'three';
import { useMemo } from 'react';
import type { RoomSpec } from '@/lib/gallery/types';
import { HALLWAY_LENGTH, HALLWAY_WIDTH, HALLWAY_HEIGHT } from '@/lib/gallery/roomGenerator';
import { HallLights } from './Lighting';
import StairsHallway from './hallways/StairsHallway';
import BridgeHallway from './hallways/BridgeHallway';
import AquariumHallway from './hallways/AquariumHallway';
import CurvedHallway from './hallways/CurvedHallway';
import JogHallway from './hallways/JogHallway';

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

// Dispatches to the appropriate hallway renderer based on fromRoom's variant.
// Collision logic treats the walkable footprint as a straight AABB regardless
// of variant; only 'stairs' varies the vertical ground height.
export default function Hallway({ fromRoom, toRoom }: Props) {
    const variant = fromRoom.hallwayVariant ?? 'straight';
    switch (variant) {
        case 'stairs':
            return <StairsHallway fromRoom={fromRoom} toRoom={toRoom} />;
        case 'bridge':
            return <BridgeHallway fromRoom={fromRoom} toRoom={toRoom} />;
        case 'aquarium':
            return <AquariumHallway fromRoom={fromRoom} toRoom={toRoom} />;
        case 'curved':
            return <CurvedHallway fromRoom={fromRoom} toRoom={toRoom} />;
        case 'jog':
            return <JogHallway fromRoom={fromRoom} toRoom={toRoom} />;
        default:
            return <StraightHallway fromRoom={fromRoom} toRoom={toRoom} />;
    }
}

// ---------------------------------------------------------------------------
// The original unadorned corridor, extracted so variant renderers can live
// in sibling files without changing the call sites in RoomManager.
// ---------------------------------------------------------------------------
function StraightHallway({ fromRoom, toRoom }: Props) {
    const startZ = fromRoom.origin[2] + fromRoom.depth / 2;
    const length = HALLWAY_LENGTH;
    const endZ = startZ + length;
    const ceilingH = HALLWAY_HEIGHT;
    const wHalf = HALLWAY_WIDTH / 2;

    const fromColor = fromRoom.theme.wallColor;
    const toColor = toRoom?.theme.wallColor ?? fromColor;

    const midColor = useMemo(() => {
        const a = new THREE.Color(fromColor);
        const b = new THREE.Color(toColor);
        const out = a.clone().lerp(b, 0.5);
        return `#${out.getHexString()}`;
    }, [fromColor, toColor]);

    const floorColor = shade(midColor, -0.22);
    const ceilingColor = shade(midColor, 0.08);
    const wallColor = midColor;

    return (
        <group>
            <mesh
                position={[0, -0.01, startZ + length / 2]}
                rotation={[-Math.PI / 2, 0, 0]}
                receiveShadow
            >
                <planeGeometry args={[HALLWAY_WIDTH, length]} />
                <meshStandardMaterial color={floorColor} roughness={0.85} />
            </mesh>
            <mesh
                position={[0, ceilingH, startZ + length / 2]}
                rotation={[Math.PI / 2, 0, 0]}
                receiveShadow
            >
                <planeGeometry args={[HALLWAY_WIDTH, length]} />
                <meshStandardMaterial color={ceilingColor} roughness={0.9} />
            </mesh>
            <mesh
                position={[-wHalf - WALL_T / 2, ceilingH / 2, startZ + length / 2]}
                castShadow
                receiveShadow
            >
                <boxGeometry args={[WALL_T, ceilingH, length]} />
                <meshStandardMaterial color={wallColor} roughness={0.8} />
            </mesh>
            <mesh
                position={[wHalf + WALL_T / 2, ceilingH / 2, startZ + length / 2]}
                castShadow
                receiveShadow
            >
                <boxGeometry args={[WALL_T, ceilingH, length]} />
                <meshStandardMaterial color={wallColor} roughness={0.8} />
            </mesh>

            {!toRoom && (
                <mesh position={[0, ceilingH / 2, endZ + WALL_T / 2]} castShadow receiveShadow>
                    <boxGeometry args={[HALLWAY_WIDTH, ceilingH, WALL_T]} />
                    <meshStandardMaterial color={shade(wallColor, -0.2)} roughness={0.9} />
                </mesh>
            )}

            <HallLights
                startZ={startZ}
                length={length}
                color={fromRoom.theme.lightColor}
                intensity={0.75}
                ceilingHeight={ceilingH}
            />
        </group>
    );
}
