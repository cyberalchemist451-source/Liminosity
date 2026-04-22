'use client';

import { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import type { RoomSpec } from '@/lib/gallery/types';
import { FacelessSuit } from './Dweller';

type Props = { spec: RoomSpec };

// Nine suited men in a loose arc around the plinth. Each group pivots on Y
// every frame so its body always faces the player's current head position.
// Positions avoid the front/back doorway corridor so the ring never blocks
// ingress or egress.
export default function SilenceWatchers({ spec }: Props) {
    const { origin, width, depth, doorwayWidth } = spec;
    const [ox, , oz] = origin;

    const anchors = useMemo(() => {
        // Fixed ring of nine angles in radians. Tuned so no watcher sits in
        // the doorway axis (0 or PI) or in its exclusion cone (+/- 18 deg).
        const degrees = [30, 60, 95, 128, 158, 202, 232, 265, 300, 332];
        // Keep exactly 9 of them so the arrangement reads as deliberate.
        const chosen = degrees.slice(0, 9);
        // Radius sized to sit outside the 2.2m plinth but inside the smallest
        // scripted room (~16m).
        const radius = Math.min(
            4.8,
            Math.min(width, depth) / 2 - 2.4,
        );
        return chosen.map((deg) => {
            const rad = (deg * Math.PI) / 180;
            return {
                x: Math.cos(rad) * radius,
                z: Math.sin(rad) * radius,
            };
        });
    }, [width, depth]);

    return (
        <group>
            {anchors.map((a, i) => (
                <Watcher
                    key={i}
                    worldAnchor={[ox + a.x, 0, oz + a.z]}
                    seed={(i + 1) * 1.7}
                    doorwayWidth={doorwayWidth}
                />
            ))}
        </group>
    );
}

type WatcherProps = {
    worldAnchor: [number, number, number];
    seed: number;
    doorwayWidth: number;
};

function Watcher({ worldAnchor, seed }: WatcherProps) {
    const rootRef = useRef<THREE.Group>(null);
    const headLightRef = useRef<THREE.PointLight>(null);

    useFrame(({ camera, clock }) => {
        if (!rootRef.current) return;
        // Yaw only. Watchers never look up/down - that would be too mobile
        // and read as "alive" rather than "surveilling".
        const dx = camera.position.x - worldAnchor[0];
        const dz = camera.position.z - worldAnchor[2];
        const target = Math.atan2(dx, dz);
        // Tiny breathing sway laid over the tracking so it doesn't feel
        // mechanically locked-on.
        const sway = Math.sin(clock.getElapsedTime() * 0.3 + seed) * 0.01;
        rootRef.current.rotation.y = target + sway;
        // Micro-lift to prevent the foot boxes from z-fighting the floor.
        rootRef.current.position.y = 0.0;
        if (headLightRef.current) {
            // Gently pulse the almost-invisible cheekbone fill so the head
            // reads against the dark room without ever looking lit.
            headLightRef.current.intensity =
                0.06 + Math.sin(clock.getElapsedTime() * 0.4 + seed) * 0.01;
        }
    });

    return (
        <group ref={rootRef} position={worldAnchor}>
            <FacelessSuit seed={seed} />
            {/* A murky fill light clipped tight to the head so the watchers
                don't disappear against the dark walls but still never read
                as confidently illuminated. */}
            <pointLight
                ref={headLightRef}
                position={[0, 1.82, 0.22]}
                color="#e8e3d4"
                intensity={0.06}
                distance={1.3}
                decay={2.0}
            />
        </group>
    );
}
