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
            {/* Fog range is kept tight on purpose - it doubles as a
                streaming mask and a perf lever, so we don't widen it when
                the player just wants better near-field visibility. */}
            <fog attach="fog" args={['#06060a', 14, 42]} />
            <AtmosphereDrift />
            {/* Ambient + hemisphere carry most of the baseline visibility,
                so bumping them here brightens every room and hallway at
                once without adding a single real point light to the shader
                budget. Tint stays cool-neutral so themed light colors still
                read as the dominant hue. */}
            <ambientLight intensity={0.48} color="#9aa3b2" />
            <hemisphereLight args={['#2a2d3a', '#07070c', 0.55]} />
            <RoomManager />
            <PlayerController />
            <StatsBridge />
        </>
    );
}
