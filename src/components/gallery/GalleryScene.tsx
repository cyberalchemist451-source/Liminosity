'use client';

import { useEffect, useMemo } from 'react';
import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';
import PlayerController from './PlayerController';
import RoomManager from './RoomManager';
import StatsBridge from './StatsBridge';
import { useGalleryStore } from '@/lib/gallery/galleryStore';

// Drives fog + background color toward the current room's tint. The target
// color is a module-scoped singleton so we neither read refs during render
// nor mutate values returned from hooks.
const atmosphereTarget = new THREE.Color('#06060a');

function AtmosphereDrift() {
    const currentIndex = useGalleryStore((s) => s.currentIndex);
    const sections = useGalleryStore((s) => s.sections);

    const targetHex = useMemo(() => {
        const cur = sections[currentIndex];
        if (!cur) return '#06060a';
        return cur.theme.wallColor;
    }, [currentIndex, sections]);

    useEffect(() => {
        const c = new THREE.Color(targetHex);
        c.multiplyScalar(0.28);
        atmosphereTarget.copy(c);
    }, [targetHex]);

    useFrame((state, dt) => {
        const fog = state.scene.fog as THREE.Fog | null;
        if (fog) fog.color.lerp(atmosphereTarget, Math.min(1, dt * 1.4));
        if (state.scene.background instanceof THREE.Color) {
            state.scene.background.lerp(atmosphereTarget, Math.min(1, dt * 1.4));
        }
    });

    return null;
}

export default function GalleryScene() {
    return (
        <>
            <color attach="background" args={['#06060a']} />
            <fog attach="fog" args={['#06060a', 14, 42]} />
            <AtmosphereDrift />
            <ambientLight intensity={0.22} color="#8891a0" />
            <hemisphereLight args={['#1a1c25', '#05050a', 0.28]} />
            <RoomManager />
            <PlayerController />
            <StatsBridge />
        </>
    );
}
