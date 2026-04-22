'use client';

import { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import type { RoomSpec } from '@/lib/gallery/types';

type Props = { spec: RoomSpec };

// Chrome "thinker" bust on plinth with a slowly rotating neural-net halo.
export default function AIHistoryArtifact({ spec }: Props) {
    const haloRef = useRef<THREE.Group>(null);

    const nodes = useMemo(() => {
        // Build three layers of nodes around the bust
        const arr: [number, number, number][] = [];
        const layers = [
            { count: 5, y: 2.6, r: 1.1 },
            { count: 7, y: 3.1, r: 1.5 },
            { count: 4, y: 3.6, r: 0.85 },
        ];
        for (const l of layers) {
            for (let i = 0; i < l.count; i++) {
                const a = (i / l.count) * Math.PI * 2;
                arr.push([Math.cos(a) * l.r, l.y, Math.sin(a) * l.r]);
            }
        }
        return arr;
    }, []);

    useFrame(({ clock }) => {
        if (haloRef.current) haloRef.current.rotation.y = clock.getElapsedTime() * 0.15;
    });

    return (
        <group>
            {/* Bust */}
            <group position={[0, 1.0, 0]}>
                {/* Head */}
                <mesh castShadow receiveShadow position={[0, 1.3, 0]}>
                    <sphereGeometry args={[0.45, 20, 16]} />
                    <meshStandardMaterial color="#dadfe3" metalness={0.95} roughness={0.12} />
                </mesh>
                {/* Jaw / chin extension */}
                <mesh castShadow position={[0, 1.05, 0.1]}>
                    <boxGeometry args={[0.55, 0.28, 0.35]} />
                    <meshStandardMaterial color="#b9bec2" metalness={0.9} roughness={0.2} />
                </mesh>
                {/* Shoulders / torso stub */}
                <mesh castShadow receiveShadow position={[0, 0.55, 0]}>
                    <cylinderGeometry args={[0.5, 0.7, 0.9, 16]} />
                    <meshStandardMaterial color="#8a9196" metalness={0.85} roughness={0.25} />
                </mesh>
                {/* Eye strip (glowing accent) */}
                <mesh position={[0, 1.32, 0.36]}>
                    <boxGeometry args={[0.6, 0.08, 0.02]} />
                    <meshStandardMaterial
                        color={spec.theme.accentColor}
                        emissive={spec.theme.accentColor}
                        emissiveIntensity={2.2}
                    />
                </mesh>
                {/* Hand-to-chin (thinker pose): small arm */}
                <mesh castShadow position={[0.25, 0.9, 0.3]} rotation={[0.2, 0, -0.6]}>
                    <cylinderGeometry args={[0.08, 0.08, 0.6, 10]} />
                    <meshStandardMaterial color="#b9bec2" metalness={0.9} roughness={0.2} />
                </mesh>
                <mesh castShadow position={[0.12, 1.18, 0.4]}>
                    <sphereGeometry args={[0.13, 12, 10]} />
                    <meshStandardMaterial color="#dadfe3" metalness={0.95} roughness={0.12} />
                </mesh>
            </group>

            {/* Neural halo */}
            <group ref={haloRef}>
                {nodes.map((p, i) => (
                    <mesh key={i} position={p}>
                        <sphereGeometry args={[0.07, 10, 8]} />
                        <meshStandardMaterial
                            color={spec.theme.accentColor}
                            emissive={spec.theme.accentColor}
                            emissiveIntensity={2}
                        />
                    </mesh>
                ))}
                {/* Thin connecting rings per layer */}
                {[
                    { r: 1.1, y: 2.6 },
                    { r: 1.5, y: 3.1 },
                    { r: 0.85, y: 3.6 },
                ].map((l, i) => (
                    <mesh key={i} position={[0, l.y, 0]} rotation={[Math.PI / 2, 0, 0]}>
                        <torusGeometry args={[l.r, 0.012, 8, 48]} />
                        <meshStandardMaterial
                            color={spec.theme.accentColor}
                            emissive={spec.theme.accentColor}
                            emissiveIntensity={0.8}
                        />
                    </mesh>
                ))}
            </group>

            <pointLight position={[0, 3.1, 0]} color={spec.theme.accentColor} intensity={0.5} distance={6} />
        </group>
    );
}
