'use client';

import { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import type { RoomSpec } from '@/lib/gallery/types';

type Props = { spec: RoomSpec };

// Room 4 centerpiece. A matte-black briefcase sits slightly ajar on the
// plinth. A pencil-thin cold-white beam escapes the gap and climbs far
// beyond what the briefcase should be able to contain. Around it, a
// dozen pages hang motionless in mid-fall, as if a moment has been
// excerpted from a larger event and placed here for examination.
//
// Nothing loops audibly, on purpose - the room is silent. The animation
// budget is deliberately tiny: the briefcase lid breathes by less than a
// tenth of a degree and the beam scintillates on the order of 3% opacity.
export default function SilenceArtifact({ spec }: Props) {
    const lidRef = useRef<THREE.Group>(null);
    const beamRef = useRef<THREE.Mesh>(null);
    const haloRef = useRef<THREE.Mesh>(null);

    // Deterministic page positions per-room-seed so the frozen snapshot is
    // stable across re-renders.
    const pages = useMemo(() => {
        const seed = spec.index * 9301 + 49297;
        let s = seed | 0;
        const rand = () => {
            s = (s * 1664525 + 1013904223) | 0;
            return ((s >>> 0) / 0xffffffff);
        };
        const list: Array<{
            pos: [number, number, number];
            rot: [number, number, number];
            scale: number;
        }> = [];
        for (let i = 0; i < 12; i++) {
            const theta = rand() * Math.PI * 2;
            const r = 0.35 + rand() * 0.95;
            const y = 1.6 + rand() * 3.2;
            list.push({
                pos: [Math.cos(theta) * r, y, Math.sin(theta) * r],
                rot: [
                    (rand() - 0.5) * 1.2,
                    rand() * Math.PI * 2,
                    (rand() - 0.5) * 1.2,
                ],
                scale: 0.85 + rand() * 0.35,
            });
        }
        return list;
    }, [spec.index]);

    useFrame(({ clock }) => {
        const t = clock.getElapsedTime();
        if (lidRef.current) {
            // Imperceptible lid "breath" - reads subconsciously as "alive".
            lidRef.current.rotation.x = -0.18 + Math.sin(t * 0.35) * 0.004;
        }
        if (beamRef.current) {
            const mat = beamRef.current.material as THREE.MeshStandardMaterial;
            mat.opacity = 0.78 + Math.sin(t * 0.7) * 0.025;
        }
        if (haloRef.current) {
            const mat = haloRef.current.material as THREE.MeshStandardMaterial;
            mat.opacity = 0.22 + Math.sin(t * 0.55 + 1.3) * 0.03;
        }
    });

    const beamColor = '#f4f6ff';

    return (
        <group>
            {/* The briefcase, resting on the plinth (plinth top y = 1.0). */}
            <group position={[0, 1.05, 0]}>
                {/* Bottom half - hard-edged leather box */}
                <mesh castShadow receiveShadow position={[0, 0.08, 0]}>
                    <boxGeometry args={[0.72, 0.16, 0.48]} />
                    <meshPhysicalMaterial
                        color="#0c0c0e"
                        roughness={0.6}
                        clearcoat={0.25}
                        clearcoatRoughness={0.7}
                    />
                </mesh>
                {/* Stitched rim */}
                <mesh position={[0, 0.165, 0]}>
                    <boxGeometry args={[0.74, 0.01, 0.5]} />
                    <meshStandardMaterial color="#26241f" roughness={0.7} />
                </mesh>

                {/* Lid - pivots from the back edge, held slightly ajar */}
                <group
                    ref={lidRef}
                    position={[0, 0.175, -0.24]}
                    rotation={[-0.18, 0, 0]}
                >
                    <mesh castShadow receiveShadow position={[0, 0.08, 0.24]}>
                        <boxGeometry args={[0.72, 0.16, 0.48]} />
                        <meshPhysicalMaterial
                            color="#0a0a0c"
                            roughness={0.55}
                            clearcoat={0.3}
                            clearcoatRoughness={0.7}
                        />
                    </mesh>
                    {/* Inner lining glimpsed through the gap */}
                    <mesh position={[0, 0.01, 0.24]}>
                        <boxGeometry args={[0.68, 0.005, 0.44]} />
                        <meshStandardMaterial
                            color={beamColor}
                            emissive={beamColor}
                            emissiveIntensity={0.9}
                        />
                    </mesh>
                </group>

                {/* Two brass latches */}
                {[-0.18, 0.18].map((x) => (
                    <mesh key={x} position={[x, 0.17, 0.245]}>
                        <boxGeometry args={[0.08, 0.04, 0.015]} />
                        <meshStandardMaterial
                            color="#c7a64d"
                            metalness={0.85}
                            roughness={0.3}
                        />
                    </mesh>
                ))}

                {/* Centered handle */}
                <mesh position={[0, 0.27, 0.245]}>
                    <torusGeometry args={[0.08, 0.015, 8, 20, Math.PI]} />
                    <meshStandardMaterial
                        color="#1a1a1e"
                        roughness={0.45}
                        metalness={0.4}
                    />
                </mesh>
            </group>

            {/* The beam - a thin vertical slab of impossible cold light escaping
                the opening. Cuts upward past the ceiling budget. */}
            <mesh ref={beamRef} position={[0, 4.2, -0.18]}>
                <boxGeometry args={[0.62, 6.4, 0.05]} />
                <meshStandardMaterial
                    color={beamColor}
                    emissive={beamColor}
                    emissiveIntensity={3.2}
                    transparent
                    opacity={0.78}
                    depthWrite={false}
                    side={THREE.DoubleSide}
                />
            </mesh>

            {/* Softer halo sleeve around the beam */}
            <mesh ref={haloRef} position={[0, 4.2, -0.18]}>
                <boxGeometry args={[0.95, 6.6, 0.18]} />
                <meshStandardMaterial
                    color={beamColor}
                    emissive={beamColor}
                    emissiveIntensity={1.2}
                    transparent
                    opacity={0.22}
                    depthWrite={false}
                    side={THREE.DoubleSide}
                />
            </mesh>

            {/* Frozen papers in mid-flutter */}
            {pages.map((p, i) => (
                <mesh key={i} position={p.pos} rotation={p.rot} castShadow>
                    <planeGeometry args={[0.22 * p.scale, 0.3 * p.scale]} />
                    <meshStandardMaterial
                        color="#e9e4d6"
                        roughness={0.85}
                        side={THREE.DoubleSide}
                        emissive="#1a1915"
                        emissiveIntensity={0.1}
                    />
                </mesh>
            ))}

            {/* Cold fill light from inside the briefcase, tuned to just below
                the floor level of an obvious light source. */}
            <pointLight
                position={[0, 1.2, -0.1]}
                color={beamColor}
                intensity={0.55}
                distance={5.5}
                decay={1.6}
            />
        </group>
    );
}
