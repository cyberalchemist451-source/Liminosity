'use client';

// Module-level singleton that lets any component (notably the HUD) request
// pointer-lock from the drei <PointerLockControls> without a ref prop chain
// or a React context. PlayerController registers its ref here on mount.

type PLCLike = {
    lock: () => void;
    unlock: () => void;
    isLocked?: boolean;
    domElement?: HTMLElement | null;
};

let controlsRef: PLCLike | null = null;

export function registerPointerLockControls(ref: PLCLike | null) {
    controlsRef = ref;
}

export function tryLockPointer(): { ok: boolean; reason?: string } {
    if (!controlsRef) {
        return { ok: false, reason: 'controls not ready' };
    }
    if (!document.hasFocus()) {
        return { ok: false, reason: 'document not focused' };
    }
    if (document.pointerLockElement) {
        // Already locked; nothing to do.
        return { ok: true };
    }
    try {
        controlsRef.lock();
        return { ok: true };
    } catch (e) {
        return { ok: false, reason: (e as Error).message || 'lock threw' };
    }
}

export function tryUnlockPointer() {
    controlsRef?.unlock();
}
