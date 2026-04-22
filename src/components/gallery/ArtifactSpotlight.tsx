'use client';

import { useEffect, useRef } from 'react';
import * as THREE from 'three';

/*
 * A narrow spot-light aimed straight down at the artifact on the room plinth.
 * Rendered in the local space of the centerpiece group, so the same component
 * works for every room without needing to know the room origin. SpotLight in
 * three.js requires its `target` to be attached to the scene graph; we do
 * that with a tiny marker object placed at the artifact's height.
 */

type Props = {
    // Height of the ceiling the light hangs from (in local Y).
    ceilingHeight: number;
    // Tint color - usually the theme accent.
    color: string;
    // Overall intensity. Kept fairly strong so the beam reads through fog.
    intensity?: number;
    // Beam half-angle (radians).
    angle?: number;
    // Penumbra softness (0 = hard-edged, 1 = fully soft).
    penumbra?: number;
};

export default function ArtifactSpotlight({
    ceilingHeight,
    color,
    intensity = 6,
    angle = 0.42,
    penumbra = 0.55,
}: Props) {
    const lightRef = useRef<THREE.SpotLight>(null);
    const targetRef = useRef<THREE.Object3D>(null);

    useEffect(() => {
        if (lightRef.current && targetRef.current) {
            lightRef.current.target = targetRef.current;
            lightRef.current.target.updateMatrixWorld();
        }
    }, []);

    return (
        <group>
            <spotLight
                ref={lightRef}
                position={[0, Math.max(2.6, ceilingHeight - 0.25), 0]}
                angle={angle}
                penumbra={penumbra}
                intensity={intensity}
                distance={ceilingHeight + 2}
                decay={1.3}
                color={color}
            />
            {/* Target sits on the plinth at the artifact's approximate centroid */}
            <object3D ref={targetRef} position={[0, 1.4, 0]} />

            {/* A small emissive puck under the spotlight simulating the fixture */}
            <mesh position={[0, Math.max(2.7, ceilingHeight - 0.18), 0]}>
                <cylinderGeometry args={[0.18, 0.14, 0.12, 14]} />
                <meshStandardMaterial
                    color="#111"
                    emissive={color}
                    emissiveIntensity={0.6}
                    roughness={0.5}
                    metalness={0.4}
                />
            </mesh>
        </group>
    );
}
