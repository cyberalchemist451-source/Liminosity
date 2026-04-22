'use client';

import { useEffect, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import type { Theme } from '@/lib/gallery/types';

type FluorescentProps = {
    position: [number, number, number];
    color: string;
    intensity?: number;
    flicker?: boolean;
    length?: number;
    // When false, no point light is added - only an emissive tube. Used to
    // cap the total number of real lights per room / hallway so we stay well
    // under WebGL's fragment-texture-unit budget and keep the shader cheap.
    lit?: boolean;
};

export function Fluorescent({
    position,
    color,
    intensity = 1,
    flicker = true,
    length = 1.8,
    lit = true,
}: FluorescentProps) {
    const lightRef = useRef<THREE.PointLight>(null);
    const tubeRef = useRef<THREE.MeshStandardMaterial>(null);
    // Per-fixture phase offset. Computed once post-mount so the lint rule
    // `react-hooks/purity` (no impure calls during render) stays happy.
    const seed = useRef(0);
    useEffect(() => {
        seed.current = Math.random() * 1000;
    }, []);

    useFrame(({ clock }) => {
        const t = clock.getElapsedTime() + seed.current;
        let k = 1;
        if (flicker) {
            // rare drop-out: sine + occasional dips
            const base = 0.94 + 0.06 * Math.sin(t * 2.3);
            const dip = Math.sin(t * 11.0 + seed.current) > 0.985 ? 0.35 : 1;
            const micro = 1 + 0.02 * Math.sin(t * 31.0);
            k = base * dip * micro;
        }
        if (lit && lightRef.current) lightRef.current.intensity = intensity * k;
        if (tubeRef.current) tubeRef.current.emissiveIntensity = 1.3 * k;
    });

    return (
        <group position={position}>
            {/* Tube */}
            <mesh>
                <boxGeometry args={[length, 0.08, 0.22]} />
                <meshStandardMaterial
                    ref={tubeRef}
                    color={'#ffffff'}
                    emissive={color}
                    emissiveIntensity={1.3}
                    roughness={0.5}
                />
            </mesh>
            {/* Fixture housing */}
            <mesh position={[0, 0.08, 0]}>
                <boxGeometry args={[length + 0.2, 0.1, 0.32]} />
                <meshStandardMaterial color={'#2b2b2f'} metalness={0.3} roughness={0.7} />
            </mesh>
            {/* Only some fixtures cast an actual point light. The rest are
                purely emissive; the ambient + single central light per room
                carry the illumination. Caps active lights at ~1 per room and
                ~1 per hallway to keep the shader fast. */}
            {lit && (
                <pointLight
                    ref={lightRef}
                    color={color}
                    intensity={intensity}
                    distance={18}
                    decay={1.6}
                />
            )}
        </group>
    );
}

type RoomLightsProps = {
    theme: Theme;
    origin: [number, number, number];
    width: number;
    depth: number;
    ceilingHeight: number;
};

export function RoomLights({ theme, origin, width, depth, ceilingHeight }: RoomLightsProps) {
    const cols = width > 20 ? 2 : 1;
    const rows = depth > 20 ? 3 : 2;
    // Any grid cell whose center lands within this radius of the room center
    // is discarded. The plinth is a 2.2 m cube at the origin and the
    // ArtifactSpotlight hangs a cylinder puck directly above it; a
    // fluorescent here would collide with that puck and occlude the
    // spotlight's beam/emissive. Keep the cone clear.
    const PLINTH_CLEARANCE = 1.6;
    const fixtures: [number, number][] = [];
    for (let i = 0; i < cols; i++) {
        for (let j = 0; j < rows; j++) {
            const x = (i - (cols - 1) / 2) * (width / cols);
            const z = (j - (rows - 1) / 2) * (depth / rows);
            if (Math.hypot(x, z) < PLINTH_CLEARANCE) continue;
            fixtures.push([x, z]);
        }
    }
    // Pick the fixture nearest the room center to be the only true light source.
    let centerIdx = 0;
    let bestDist = Infinity;
    for (let i = 0; i < fixtures.length; i++) {
        const [fx, fz] = fixtures[i];
        const d = fx * fx + fz * fz;
        if (d < bestDist) {
            bestDist = d;
            centerIdx = i;
        }
    }
    return (
        <group>
            {fixtures.map(([lx, lz], i) => (
                <Fluorescent
                    key={i}
                    position={[origin[0] + lx, origin[1] + ceilingHeight - 0.3, origin[2] + lz]}
                    color={theme.lightColor}
                    intensity={theme.lightIntensity * 1.35}
                    flicker
                    lit={i === centerIdx}
                />
            ))}
        </group>
    );
}

type HallLightsProps = {
    startZ: number;
    length: number;
    color: string;
    intensity?: number;
    ceilingHeight: number;
};

export function HallLights({
    startZ,
    length,
    color,
    intensity = 0.9,
    ceilingHeight,
}: HallLightsProps) {
    const count = Math.max(2, Math.floor(length / 5));
    const fixtures: number[] = [];
    for (let i = 0; i < count; i++) {
        const t = (i + 0.5) / count;
        fixtures.push(startZ + t * length);
    }
    // Only the middle fixture gets a real light; others glow emissive.
    const midIdx = Math.floor(fixtures.length / 2);
    return (
        <group>
            {fixtures.map((lz, i) => (
                <Fluorescent
                    key={i}
                    position={[0, ceilingHeight - 0.25, lz]}
                    color={color}
                    intensity={intensity * 1.3}
                    flicker
                    length={1.2}
                    lit={i === midIdx}
                />
            ))}
        </group>
    );
}
