'use client';

import { useCallback, useRef } from 'react';
import { Canvas } from '@react-three/fiber';
import * as THREE from 'three';
import type { WebGLRenderer, Scene, PerspectiveCamera } from 'three';
import GalleryScene from './GalleryScene';
import GalleryHUD from './GalleryHUD';
import GalleryErrorBoundary from './ErrorBoundary';
import AmbientAudio from './AmbientAudio';
import MandelbrotFallOverlay from './MandelbrotFallOverlay';
import { useGalleryStore } from '@/lib/gallery/galleryStore';

export default function GalleryExperience() {
    const rendererRef = useRef<WebGLRenderer | null>(null);
    const sceneRef = useRef<Scene | null>(null);
    const cameraRef = useRef<PerspectiveCamera | null>(null);

    const takeScreenshot = useCallback(() => {
        const gl = rendererRef.current;
        const scene = sceneRef.current;
        const cam = cameraRef.current;
        if (!gl || !scene || !cam) return;
        // force one fresh render to ensure the buffer is populated
        gl.render(scene, cam);
        const dataUrl = gl.domElement.toDataURL('image/png');
        const a = document.createElement('a');
        a.href = dataUrl;
        a.download = `liminosity-${new Date()
            .toISOString()
            .replace(/[:.]/g, '-')}.png`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
    }, []);

    const reportError = useGalleryStore((s) => s.reportError);

    return (
        <div
            id="gallery-canvas-root"
            style={{
                position: 'fixed',
                inset: 0,
                background: '#06060a',
                overflow: 'hidden',
            }}
        >
            <GalleryErrorBoundary
                onError={(err) => {
                    reportError(`${err.name}: ${err.message}`);
                }}
            >
                <Canvas
                    gl={{
                        antialias: true,
                        preserveDrawingBuffer: true,
                        toneMapping: THREE.ACESFilmicToneMapping,
                        toneMappingExposure: 0.95,
                    }}
                    camera={{ fov: 72, near: 0.08, far: 200, position: [0, 1.65, -6] }}
                    onCreated={({ gl, scene, camera }) => {
                        rendererRef.current = gl;
                        sceneRef.current = scene;
                        cameraRef.current = camera as PerspectiveCamera;
                        console.info('[Liminosity] canvas created', {
                            renderer: gl.info?.render,
                            capabilities: gl.capabilities,
                        });
                    }}
                >
                    <GalleryScene />
                </Canvas>
            </GalleryErrorBoundary>
            <AmbientAudio />
            <GalleryHUD onScreenshot={takeScreenshot} />
            <MandelbrotFallOverlay />
        </div>
    );
}
