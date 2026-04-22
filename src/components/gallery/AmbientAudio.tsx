'use client';

import { useEffect } from 'react';
import { useGalleryStore } from '@/lib/gallery/galleryStore';
import {
    ensureAudioStarted,
    setAudioDucked,
    setAudioMuted,
    setAudioTheme,
} from '@/lib/gallery/ambientAudio';

// Non-rendering bridge between the gallery store and the Web Audio engine.
// Lives OUTSIDE the R3F Canvas so the engine survives scene remounts.
export default function AmbientAudio() {
    const started = useGalleryStore((s) => s.started);
    const paused = useGalleryStore((s) => s.paused);
    const muted = useGalleryStore((s) => s.audioMuted);
    const sections = useGalleryStore((s) => s.sections);
    const currentIndex = useGalleryStore((s) => s.currentIndex);

    useEffect(() => {
        if (started) {
            void ensureAudioStarted();
        }
    }, [started]);

    useEffect(() => {
        setAudioMuted(muted);
    }, [muted]);

    useEffect(() => {
        setAudioDucked(paused);
    }, [paused]);

    useEffect(() => {
        const cur = sections[currentIndex];
        if (cur) setAudioTheme(cur.theme);
    }, [sections, currentIndex]);

    return null;
}
