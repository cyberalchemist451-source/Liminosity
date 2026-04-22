'use client';

import { create } from 'zustand';
import type { RoomSpec, Vec3 } from './types';
import { generateRoom } from './roomGenerator';

type Stats = {
    frames: number;
    fps: number;
    playerX: number;
    playerY: number;
    playerZ: number;
    lastError: string | null;
};

type GalleryState = {
    seed: number;
    sections: RoomSpec[];
    currentIndex: number;
    paused: boolean;
    pointerLocked: boolean;
    started: boolean;
    showDiagnostics: boolean;
    audioMuted: boolean;
    stats: Stats;
    // Mandelbrot-fall cutscene state (SECTION 022 - the void shaft).
    //   fallingIntoHole : true while the overlay cutscene is playing
    //   pendingTeleport : set on the frame AFTER the cutscene completes;
    //                     PlayerController will consume it to relocate the
    //                     camera to the next hallway, then clear it.
    fallingIntoHole: boolean;
    pendingTeleport: Vec3 | null;
    setSeed: (seed: number) => void;
    ensureRoomAt: (index: number) => RoomSpec;
    setCurrentIndex: (i: number) => void;
    setPaused: (v: boolean) => void;
    setPointerLocked: (v: boolean) => void;
    setStarted: (v: boolean) => void;
    setShowDiagnostics: (v: boolean) => void;
    setAudioMuted: (v: boolean) => void;
    updateStats: (partial: Partial<Stats>) => void;
    reportError: (msg: string) => void;
    triggerFall: (teleportTo: Vec3) => void;
    endFall: () => void;
    consumeTeleport: () => Vec3 | null;
    reset: () => void;
};

const DEFAULT_SEED = 0xc0ffee;

const DEFAULT_STATS: Stats = {
    frames: 0,
    fps: 0,
    playerX: 0,
    playerY: 0,
    playerZ: 0,
    lastError: null,
};

export const useGalleryStore = create<GalleryState>((set, get) => ({
    seed: DEFAULT_SEED,
    sections: [],
    currentIndex: 0,
    paused: false,
    pointerLocked: false,
    started: false,
    showDiagnostics: false,
    audioMuted: false,
    stats: DEFAULT_STATS,
    fallingIntoHole: false,
    pendingTeleport: null,
    setSeed: (seed) => set({ seed }),
    ensureRoomAt: (index) => {
        const state = get();
        if (state.sections[index]) return state.sections[index];
        // generate any missing rooms up to `index`
        const next = state.sections.slice();
        for (let i = next.length; i <= index; i++) {
            next[i] = generateRoom(i, state.seed, next);
        }
        set({ sections: next });
        return next[index];
    },
    setCurrentIndex: (i) => {
        if (get().currentIndex !== i) set({ currentIndex: i });
    },
    setPaused: (v) => set({ paused: v }),
    setPointerLocked: (v) => set({ pointerLocked: v }),
    setStarted: (v) => set({ started: v }),
    setShowDiagnostics: (v) => set({ showDiagnostics: v }),
    setAudioMuted: (v) => set({ audioMuted: v }),
    updateStats: (partial) => set({ stats: { ...get().stats, ...partial } }),
    reportError: (msg) => set({ stats: { ...get().stats, lastError: msg } }),
    triggerFall: (teleportTo) => {
        if (get().fallingIntoHole) return;
        set({ fallingIntoHole: true, pendingTeleport: teleportTo });
    },
    endFall: () => {
        // Leave pendingTeleport set - the PlayerController will consume it on
        // its next frame to put the camera into the hallway.
        set({ fallingIntoHole: false });
    },
    consumeTeleport: () => {
        const t = get().pendingTeleport;
        if (t) set({ pendingTeleport: null });
        return t;
    },
    reset: () =>
        set({
            sections: [],
            currentIndex: 0,
            paused: false,
            pointerLocked: false,
            started: false,
            stats: DEFAULT_STATS,
            fallingIntoHole: false,
            pendingTeleport: null,
        }),
}));
