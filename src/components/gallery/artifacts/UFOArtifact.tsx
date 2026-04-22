'use client';

import { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import type { RoomSpec } from '@/lib/gallery/types';

type Props = { spec: RoomSpec };

export default function UFOArtifact({ spec }: Props) {
    const saucerRef = useRef<THREE.Group>(null);
    const ringRef = useRef<THREE.Mesh>(null);
    const beamRef = useRef<THREE.Mesh>(null);

    useFrame(({ clock }) => {
        const t = clock.getElapsedTime();
        if (saucerRef.current) {
            saucerRef.current.rotation.y = t * 0.35;
            saucerRef.current.position.y = 2.2 + Math.sin(t * 1.1) * 0.12;
        }
        if (ringRef.current) ringRef.current.rotation.y = -t * 1.2;
        if (beamRef.current) {
            const mat = beamRef.current.material as THREE.MeshStandardMaterial;
            mat.opacity = 0.15 + 0.08 * (0.5 + 0.5 * Math.sin(t * 2.2));
        }
    });

    return (
        <group>
            {/* Hovering saucer */}
            <group ref={saucerRef} position={[0, 2.2, 0]}>
                {/* Disc body */}
                <mesh castShadow receiveShadow position={[0, 0, 0]}>
                    <cylinderGeometry args={[1.1, 0.6, 0.28, 32]} />
                    <meshStandardMaterial color="#c9d0d6" metalness={0.85} roughness={0.18} />
                </mesh>
                {/* Under-disc taper */}
                <mesh castShadow position={[0, -0.22, 0]}>
                    <cylinderGeometry args={[0.6, 0.25, 0.28, 24]} />
                    <meshStandardMaterial color="#8a929a" metalness={0.8} roughness={0.25} />
                </mesh>
                {/* Dome */}
                <mesh castShadow position={[0, 0.28, 0]}>
                    <sphereGeometry args={[0.5, 24, 16, 0, Math.PI * 2, 0, Math.PI / 2]} />
                    <meshStandardMaterial
                        color={spec.theme.accentColor}
                        metalness={0.3}
                        roughness={0.1}
                        transparent
                        opacity={0.7}
                        emissive={spec.theme.accentColor}
                        emissiveIntensity={0.35}
                    />
                </mesh>
                {/* Ring of light */}
                <mesh ref={ringRef} position={[0, -0.05, 0]}>
                    <torusGeometry args={[1.15, 0.035, 12, 48]} />
                    <meshStandardMaterial
                        color={spec.theme.accentColor}
                        emissive={spec.theme.accentColor}
                        emissiveIntensity={1.8}
                    />
                </mesh>
                {/* Tractor beam */}
                <mesh ref={beamRef} position={[0, -1.1, 0]}>
                    <coneGeometry args={[0.6, 2.0, 24, 1, true]} />
                    <meshStandardMaterial
                        color={spec.theme.accentColor}
                        emissive={spec.theme.accentColor}
                        emissiveIntensity={0.6}
                        transparent
                        opacity={0.2}
                        side={THREE.DoubleSide}
                        depthWrite={false}
                    />
                </mesh>
            </group>
            {/* Accent point light under the saucer */}
            <pointLight
                position={[0, 1.1, 0]}
                color={spec.theme.accentColor}
                intensity={0.6}
                distance={6}
            />
        </group>
    );
}
