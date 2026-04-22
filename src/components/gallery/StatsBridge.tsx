'use client';

import { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { useGalleryStore } from '@/lib/gallery/galleryStore';

// Publishes frame / position info from inside the R3F scene out to the HUD.
// Throttled to ~4Hz so we don't churn React renders.
export default function StatsBridge() {
    const frameCount = useRef(0);
    const lastTick = useRef(0);
    const lastCount = useRef(0);
    const updateStats = useGalleryStore((s) => s.updateStats);

    useFrame((state) => {
        frameCount.current += 1;
        const now = state.clock.getElapsedTime();
        if (now - lastTick.current >= 0.25) {
            const dt = now - lastTick.current;
            const fps = Math.round((frameCount.current - lastCount.current) / dt);
            lastTick.current = now;
            lastCount.current = frameCount.current;
            updateStats({
                frames: frameCount.current,
                fps,
                playerX: +state.camera.position.x.toFixed(2),
                playerY: +state.camera.position.y.toFixed(2),
                playerZ: +state.camera.position.z.toFixed(2),
            });
        }
    });

    return null;
}
