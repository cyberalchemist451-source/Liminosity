'use client';

import { Suspense, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { Text } from '@react-three/drei';
import type { RoomSpec } from '@/lib/gallery/types';

type Props = { spec: RoomSpec };

// Obsidian obelisk with a floating tome and circling sigils.
export default function EsotericArtifact({ spec }: Props) {
    const sigilsRef = useRef<THREE.Group>(null);
    const tomeRef = useRef<THREE.Group>(null);

    useFrame(({ clock }) => {
        const t = clock.getElapsedTime();
        if (sigilsRef.current) sigilsRef.current.rotation.y = t * 0.4;
        if (tomeRef.current) {
            tomeRef.current.position.y = 2.9 + Math.sin(t * 0.9) * 0.12;
            tomeRef.current.rotation.y = -t * 0.3;
        }
    });

    const glyphs = ['ᛟ', '☿', '⚸', '☤', '⛧', '♄', '∴', '✶'];

    return (
        <group>
            {/* Obelisk */}
            <mesh castShadow receiveShadow position={[0, 2.1, 0]}>
                <cylinderGeometry args={[0.18, 0.55, 3.4, 4]} />
                <meshStandardMaterial color="#1b1422" metalness={0.4} roughness={0.3} />
            </mesh>
            {/* Pyramid top */}
            <mesh castShadow position={[0, 3.95, 0]}>
                <coneGeometry args={[0.22, 0.4, 4]} />
                <meshStandardMaterial
                    color={spec.theme.accentColor}
                    emissive={spec.theme.accentColor}
                    emissiveIntensity={0.8}
                    metalness={0.7}
                    roughness={0.2}
                />
            </mesh>
            {/* Obelisk base rim glow */}
            <mesh position={[0, 1.1, 0]}>
                <torusGeometry args={[0.7, 0.03, 8, 32]} />
                <meshStandardMaterial
                    color={spec.theme.accentColor}
                    emissive={spec.theme.accentColor}
                    emissiveIntensity={1.5}
                />
            </mesh>

            {/* Floating tome */}
            <group ref={tomeRef} position={[0, 2.9, 0]}>
                {/* Cover */}
                <mesh castShadow>
                    <boxGeometry args={[0.7, 0.12, 0.9]} />
                    <meshStandardMaterial color="#3a1018" metalness={0.2} roughness={0.6} />
                </mesh>
                {/* Pages */}
                <mesh position={[0, 0.01, 0]}>
                    <boxGeometry args={[0.66, 0.08, 0.86]} />
                    <meshStandardMaterial color="#ecdfbf" roughness={0.9} />
                </mesh>
                {/* Sigil on cover */}
                <mesh position={[0, 0.07, 0]}>
                    <ringGeometry args={[0.12, 0.18, 24]} />
                    <meshStandardMaterial
                        color={spec.theme.accentColor}
                        emissive={spec.theme.accentColor}
                        emissiveIntensity={1.8}
                        side={THREE.DoubleSide}
                    />
                </mesh>
            </group>

            {/* Circling sigils (wrapped in Suspense; font loads async) */}
            <group ref={sigilsRef}>
                <Suspense fallback={null}>
                    {glyphs.map((g, i) => {
                        const a = (i / glyphs.length) * Math.PI * 2;
                        const r = 1.6;
                        return (
                            <Text
                                key={i}
                                position={[Math.cos(a) * r, 2.4 + Math.sin(a * 2) * 0.15, Math.sin(a) * r]}
                                fontSize={0.3}
                                color={spec.theme.accentColor}
                                outlineColor="#000"
                                outlineWidth={0.01}
                                anchorX="center"
                                anchorY="middle"
                            >
                                {g}
                            </Text>
                        );
                    })}
                </Suspense>
            </group>

            <pointLight
                position={[0, 2.6, 0]}
                color={spec.theme.accentColor}
                intensity={0.9}
                distance={7}
            />
        </group>
    );
}
