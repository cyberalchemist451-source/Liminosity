'use client';

import * as THREE from 'three';
import { useMemo } from 'react';
import type { RoomSpec } from '@/lib/gallery/types';
import { HALLWAY_LENGTH, HALLWAY_WIDTH, HALLWAY_HEIGHT } from '@/lib/gallery/roomGenerator';
import { HallLights } from '../Lighting';

function shade(hex: string, amt: number) {
    const c = new THREE.Color(hex);
    c.offsetHSL(0, 0, amt);
    return `#${c.getHexString()}`;
}

type Props = {
    fromRoom: RoomSpec;
    toRoom?: RoomSpec;
};

// A corridor whose left and right walls meander in a smooth S-curve around
// the centerline. The walkable AABB matches a standard hallway, so players
// never bump into the curve; the effect is purely architectural. Walls are
// built from a ribbon of short segments chasing the curve's X-offset.
export default function CurvedHallway({ fromRoom, toRoom }: Props) {
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
        return `#${a.clone().lerp(b, 0.5).getHexString()}`;
    }, [fromColor, toColor]);

    const floorColor = shade(midColor, -0.22);
    const ceilingColor = shade(midColor, 0.08);
    const wallColor = midColor;

    // Centerline offset function. Amplitude 1.2m; the walkable AABB stays at
    // +-wHalf, so walls bulge out but the player's radius never collides.
    const AMP = 1.2;

    const SEGMENTS = 28; // one box per metre gives a smooth curve
    const segs = useMemo(() => {
        const FREQ = (Math.PI * 2) / length; // one full sinuous wave over the length
        const out: Array<{
            centerZ: number;
            depth: number;
            leftX: number;
            rightX: number;
            leftRotY: number;
            rightRotY: number;
        }> = [];
        for (let i = 0; i < SEGMENTS; i++) {
            const t0 = i / SEGMENTS;
            const t1 = (i + 1) / SEGMENTS;
            const zMid = startZ + ((t0 + t1) / 2) * length;
            const zLocal = (zMid - startZ);
            const offset = AMP * Math.sin(zLocal * FREQ);
            // local derivative for wall rotation so segments align to the curve
            const deriv = AMP * FREQ * Math.cos(zLocal * FREQ);
            const rot = Math.atan(deriv);
            out.push({
                centerZ: zMid,
                depth: length / SEGMENTS + 0.05,
                leftX: offset - wHalf - 0.1,
                rightX: offset + wHalf + 0.1,
                leftRotY: rot,
                rightRotY: rot,
            });
        }
        return out;
    }, [startZ, length, wHalf]);

    // Build a wider floor so the bulges have ground beneath them
    return (
        <group>
            <mesh
                position={[0, -0.01, startZ + length / 2]}
                rotation={[-Math.PI / 2, 0, 0]}
                receiveShadow
            >
                <planeGeometry args={[HALLWAY_WIDTH + AMP * 2 + 0.4, length]} />
                <meshStandardMaterial color={floorColor} roughness={0.85} />
            </mesh>
            <mesh
                position={[0, ceilingH, startZ + length / 2]}
                rotation={[Math.PI / 2, 0, 0]}
                receiveShadow
            >
                <planeGeometry args={[HALLWAY_WIDTH + AMP * 2 + 0.4, length]} />
                <meshStandardMaterial color={ceilingColor} roughness={0.9} />
            </mesh>

            {segs.map((s, i) => (
                <group key={i}>
                    <mesh
                        position={[s.leftX, ceilingH / 2, s.centerZ]}
                        rotation={[0, s.leftRotY, 0]}
                        castShadow
                        receiveShadow
                    >
                        <boxGeometry args={[0.22, ceilingH, s.depth]} />
                        <meshStandardMaterial color={wallColor} roughness={0.8} />
                    </mesh>
                    <mesh
                        position={[s.rightX, ceilingH / 2, s.centerZ]}
                        rotation={[0, s.rightRotY, 0]}
                        castShadow
                        receiveShadow
                    >
                        <boxGeometry args={[0.22, ceilingH, s.depth]} />
                        <meshStandardMaterial color={wallColor} roughness={0.8} />
                    </mesh>
                </group>
            ))}

            {/* Accent trim strip along the inside of each wall, bright accent color */}
            {segs.map((s, i) => (
                <group key={`t${i}`}>
                    <mesh
                        position={[s.leftX + 0.15, ceilingH - 0.2, s.centerZ]}
                        rotation={[0, s.leftRotY, 0]}
                    >
                        <boxGeometry args={[0.02, 0.06, s.depth]} />
                        <meshBasicMaterial
                            color={fromRoom.theme.accentColor}
                            transparent
                            opacity={0.8}
                        />
                    </mesh>
                    <mesh
                        position={[s.rightX - 0.15, ceilingH - 0.2, s.centerZ]}
                        rotation={[0, s.rightRotY, 0]}
                    >
                        <boxGeometry args={[0.02, 0.06, s.depth]} />
                        <meshBasicMaterial
                            color={fromRoom.theme.accentColor}
                            transparent
                            opacity={0.8}
                        />
                    </mesh>
                </group>
            ))}

            {!toRoom && (
                <mesh position={[0, ceilingH / 2, endZ + 0.1]} castShadow receiveShadow>
                    <boxGeometry args={[HALLWAY_WIDTH + AMP * 2 + 0.4, ceilingH, 0.1]} />
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
