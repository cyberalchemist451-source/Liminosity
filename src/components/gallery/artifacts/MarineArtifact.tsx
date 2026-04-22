'use client';

import { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import type { RoomSpec } from '@/lib/gallery/types';

type Props = { spec: RoomSpec };

/*
 * Marine Biology centerpiece. A suspended anglerfish specimen with a glowing
 * lure, flanked by a drifting cloud of jellyfish-like shapes and a preserved
 * coelacanth silhouette on a lower shelf.
 */

export default function MarineArtifact({ spec }: Props) {
    const accent = spec.theme.accentColor;
    const wall = spec.theme.wallColor;

    const jelliesRef = useRef<THREE.Group>(null);
    const lureRef = useRef<THREE.PointLight>(null);
    const anglerRef = useRef<THREE.Group>(null);

    useFrame(({ clock }) => {
        const t = clock.getElapsedTime();
        if (jelliesRef.current) {
            jelliesRef.current.rotation.y = t * 0.12;
        }
        if (anglerRef.current) {
            anglerRef.current.position.y = 2.1 + Math.sin(t * 0.6) * 0.06;
            anglerRef.current.rotation.y = Math.sin(t * 0.35) * 0.15;
        }
        if (lureRef.current) {
            lureRef.current.intensity = 0.9 + Math.sin(t * 2.2) * 0.25;
        }
    });

    return (
        <group>
            {/* Preservation jar on the plinth - coelacanth silhouette inside */}
            <mesh position={[0, 1.4, 0]}>
                <cylinderGeometry args={[0.55, 0.55, 1.4, 24, 1, true]} />
                <meshStandardMaterial
                    color="#dfe6e4"
                    transparent
                    opacity={0.22}
                    roughness={0.15}
                    metalness={0.05}
                    side={THREE.DoubleSide}
                />
            </mesh>
            <mesh position={[0, 0.72, 0]}>
                <cylinderGeometry args={[0.58, 0.58, 0.05, 24]} />
                <meshStandardMaterial color={wall} roughness={0.7} metalness={0.3} />
            </mesh>
            <mesh position={[0, 2.12, 0]}>
                <cylinderGeometry args={[0.58, 0.58, 0.05, 24]} />
                <meshStandardMaterial color={wall} roughness={0.7} metalness={0.3} />
            </mesh>
            {/* Coelacanth inside the jar - lumpy ellipsoid + tail fin */}
            <group position={[0, 1.4, 0]} rotation={[0, 0.25, 0]}>
                <mesh scale={[1.0, 0.35, 0.4]}>
                    <sphereGeometry args={[0.4, 18, 14]} />
                    <meshStandardMaterial color="#3d5a5a" roughness={0.7} />
                </mesh>
                <mesh position={[-0.42, 0, 0]}>
                    <coneGeometry args={[0.18, 0.3, 4]} />
                    <meshStandardMaterial color="#2a4343" roughness={0.8} />
                </mesh>
                <mesh position={[0.22, 0.02, 0.11]}>
                    <sphereGeometry args={[0.028, 10, 8]} />
                    <meshStandardMaterial color="#f6eac8" emissive={accent} emissiveIntensity={0.3} />
                </mesh>
            </group>

            {/* Suspended anglerfish above the jar */}
            <group ref={anglerRef} position={[0, 2.1, 0]}>
                {/* Body - bulbous */}
                <mesh scale={[1.1, 0.85, 0.8]} castShadow>
                    <sphereGeometry args={[0.45, 18, 14]} />
                    <meshStandardMaterial color="#1a1e22" roughness={0.85} />
                </mesh>
                {/* Tail */}
                <mesh position={[-0.45, 0.02, 0]} rotation={[0, 0, 0.1]}>
                    <coneGeometry args={[0.25, 0.5, 3]} />
                    <meshStandardMaterial color="#12151a" roughness={0.88} />
                </mesh>
                {/* Jaw with teeth */}
                <mesh position={[0.38, -0.1, 0]} rotation={[0, 0, -0.4]}>
                    <coneGeometry args={[0.3, 0.35, 6]} />
                    <meshStandardMaterial color="#0a0b10" roughness={0.9} />
                </mesh>
                {[-0.1, -0.05, 0, 0.05, 0.1].map((dx, i) => (
                    <mesh key={i} position={[0.48, -0.22, dx]} rotation={[0, 0, Math.PI]}>
                        <coneGeometry args={[0.02, 0.07, 4]} />
                        <meshStandardMaterial color="#f4eed8" roughness={0.4} />
                    </mesh>
                ))}
                {/* Illicium (lure arm) arching forward */}
                <mesh
                    position={[0.38, 0.36, 0]}
                    rotation={[0, 0, -1.1]}
                    castShadow
                >
                    <cylinderGeometry args={[0.018, 0.012, 0.5, 8]} />
                    <meshStandardMaterial color="#1a1e22" roughness={0.85} />
                </mesh>
                {/* The glowing bulb */}
                <mesh position={[0.66, 0.58, 0]}>
                    <sphereGeometry args={[0.07, 16, 12]} />
                    <meshStandardMaterial
                        color="#fff3b0"
                        emissive="#ffd566"
                        emissiveIntensity={2.5}
                    />
                </mesh>
                <pointLight
                    ref={lureRef}
                    position={[0.66, 0.58, 0]}
                    color="#ffd180"
                    intensity={0.9}
                    distance={4.5}
                />
                {/* Eye */}
                <mesh position={[0.2, 0.14, 0.28]}>
                    <sphereGeometry args={[0.035, 10, 8]} />
                    <meshStandardMaterial color="#fff" roughness={0.2} />
                </mesh>
                <mesh position={[0.21, 0.14, 0.31]}>
                    <sphereGeometry args={[0.02, 10, 8]} />
                    <meshStandardMaterial color="#000" />
                </mesh>
            </group>

            {/* Drifting jellyfish cloud around the centerpiece */}
            <group ref={jelliesRef} position={[0, 2.8, 0]}>
                {[0, 1, 2, 3, 4, 5].map((i) => {
                    const a = (i / 6) * Math.PI * 2;
                    const r = 1.4 + (i % 2) * 0.4;
                    const y = (i % 3) * 0.4 - 0.2;
                    return (
                        <group key={i} position={[Math.cos(a) * r, y, Math.sin(a) * r]}>
                            <mesh>
                                <sphereGeometry
                                    args={[0.22, 16, 10, 0, Math.PI * 2, 0, Math.PI / 2]}
                                />
                                <meshStandardMaterial
                                    color="#ffd9e8"
                                    transparent
                                    opacity={0.45}
                                    emissive={accent}
                                    emissiveIntensity={0.35}
                                    side={THREE.DoubleSide}
                                />
                            </mesh>
                            {[-0.08, -0.03, 0.03, 0.08].map((dx, k) => (
                                <mesh key={k} position={[dx, -0.28, 0]}>
                                    <cylinderGeometry args={[0.004, 0.004, 0.45, 6]} />
                                    <meshStandardMaterial
                                        color="#ffd9e8"
                                        transparent
                                        opacity={0.5}
                                    />
                                </mesh>
                            ))}
                        </group>
                    );
                })}
            </group>

            {/* Cold ambient glow from the specimen */}
            <pointLight position={[0, 2.2, 0]} color={accent} intensity={0.6} distance={6.5} />
        </group>
    );
}
