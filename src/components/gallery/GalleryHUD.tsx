'use client';

import Link from 'next/link';
import { useCallback, useEffect } from 'react';
import { Camera, Pause, Play, LogOut, Shuffle, Activity, Volume2, VolumeX } from 'lucide-react';
import { useGalleryStore } from '@/lib/gallery/galleryStore';
import { tryLockPointer } from '@/lib/gallery/pointerLock';

type Props = {
    onScreenshot: () => void;
};

export default function GalleryHUD({ onScreenshot }: Props) {
    const started = useGalleryStore((s) => s.started);
    const paused = useGalleryStore((s) => s.paused);
    const setPaused = useGalleryStore((s) => s.setPaused);
    const setStarted = useGalleryStore((s) => s.setStarted);
    const currentIndex = useGalleryStore((s) => s.currentIndex);
    const sections = useGalleryStore((s) => s.sections);
    const setSeed = useGalleryStore((s) => s.setSeed);
    const reset = useGalleryStore((s) => s.reset);
    const reportError = useGalleryStore((s) => s.reportError);

    const theme = sections[currentIndex]?.theme;
    const stats = useGalleryStore((s) => s.stats);
    const showDiagnostics = useGalleryStore((s) => s.showDiagnostics);
    const setShowDiagnostics = useGalleryStore((s) => s.setShowDiagnostics);
    const pointerLocked = useGalleryStore((s) => s.pointerLocked);
    const audioMuted = useGalleryStore((s) => s.audioMuted);
    const setAudioMuted = useGalleryStore((s) => s.setAudioMuted);

    const handleStart = useCallback(() => {
        setStarted(true);
        setPaused(false);
        // Use drei's PointerLockControls.lock() via the module-level registry.
        // Some browsers reject raw requestPointerLock() when the activation
        // happened on a different element; routing the call through Three's
        // controls (which hold the canvas as the lock target) is more reliable.
        const res = tryLockPointer();
        if (!res.ok) {
            // Fall back: try the raw canvas API. If even that fails, surface
            // the reason in diagnostics so the user can see what happened.
            const canvas = document.querySelector<HTMLCanvasElement>('#gallery-canvas-root canvas');
            try {
                canvas?.requestPointerLock?.();
            } catch (e) {
                reportError(`pointer lock failed: ${res.reason ?? (e as Error).message}`);
            }
        }
    }, [setStarted, setPaused, reportError]);

    const handleResume = useCallback(() => {
        setPaused(false);
        const res = tryLockPointer();
        if (!res.ok) {
            const canvas = document.querySelector<HTMLCanvasElement>('#gallery-canvas-root canvas');
            try {
                canvas?.requestPointerLock?.();
            } catch {
                reportError(`pointer lock failed: ${res.reason ?? 'unknown'}`);
            }
        }
    }, [setPaused, reportError]);

    const handleNewSeed = useCallback(() => {
        setSeed(Math.floor(Math.random() * 0xffffffff));
        reset();
        setStarted(false);
    }, [setSeed, reset, setStarted]);

    // F2 -> screenshot, F3 -> toggle diagnostics, M -> mute audio
    useEffect(() => {
        const onKey = (e: KeyboardEvent) => {
            if (e.key === 'F2') {
                e.preventDefault();
                onScreenshot();
            } else if (e.key === 'F3') {
                e.preventDefault();
                setShowDiagnostics(!useGalleryStore.getState().showDiagnostics);
            } else if (e.key === 'm' || e.key === 'M') {
                e.preventDefault();
                setAudioMuted(!useGalleryStore.getState().audioMuted);
            }
        };
        window.addEventListener('keydown', onKey);
        return () => window.removeEventListener('keydown', onKey);
    }, [onScreenshot, setShowDiagnostics, setAudioMuted]);

    return (
        <>
            {/* Top-left: section / theme */}
            {started && theme && (
                <div
                    style={{
                        position: 'fixed',
                        top: 16,
                        left: 16,
                        color: '#e8e8f0',
                        fontFamily: 'var(--font-mono), ui-monospace, monospace',
                        fontSize: 12,
                        letterSpacing: 1.5,
                        pointerEvents: 'none',
                        textShadow: '0 1px 2px #000',
                        zIndex: 10,
                    }}
                >
                    <div style={{ opacity: 0.6 }}>SECTION {String(currentIndex + 1).padStart(3, '0')}</div>
                    <div style={{ fontSize: 18, letterSpacing: 3, marginTop: 2 }}>
                        {theme.name.toUpperCase()}
                    </div>
                    <div style={{ opacity: 0.55, marginTop: 2, fontSize: 11 }}>{theme.subtitle}</div>
                </div>
            )}

            {/* Top-right controls */}
            {started && (
                <div
                    style={{
                        position: 'fixed',
                        top: 16,
                        right: 16,
                        display: 'flex',
                        gap: 8,
                        zIndex: 10,
                    }}
                >
                    <HudButton title="Screenshot (F2)" onClick={onScreenshot}>
                        <Camera size={16} />
                    </HudButton>
                    <HudButton
                        title={paused ? 'Resume (P)' : 'Pause (P / Esc)'}
                        onClick={() => setPaused(!paused)}
                    >
                        {paused ? <Play size={16} /> : <Pause size={16} />}
                    </HudButton>
                    <HudButton title="New seed" onClick={handleNewSeed}>
                        <Shuffle size={16} />
                    </HudButton>
                    <HudButton
                        title={audioMuted ? 'Unmute ambient (M)' : 'Mute ambient (M)'}
                        onClick={() => setAudioMuted(!audioMuted)}
                    >
                        {audioMuted ? <VolumeX size={16} /> : <Volume2 size={16} />}
                    </HudButton>
                    <HudButton
                        title="Toggle diagnostics (F3)"
                        onClick={() => setShowDiagnostics(!showDiagnostics)}
                    >
                        <Activity size={16} />
                    </HudButton>
                    <Link href="/qualia-fields" style={{ textDecoration: 'none' }}>
                        <HudButton title="Exit to hub">
                            <LogOut size={16} />
                        </HudButton>
                    </Link>
                </div>
            )}

            {/* Diagnostics panel */}
            {showDiagnostics && (
                <div
                    style={{
                        position: 'fixed',
                        bottom: 16,
                        left: 16,
                        minWidth: 260,
                        padding: '10px 12px',
                        background: 'rgba(6,6,10,0.78)',
                        border: '1px solid rgba(255,255,255,0.18)',
                        borderRadius: 4,
                        color: '#d8f0e4',
                        fontFamily: 'var(--font-mono), ui-monospace, monospace',
                        fontSize: 11,
                        letterSpacing: 1,
                        zIndex: 11,
                        backdropFilter: 'blur(4px)',
                    }}
                >
                    <div
                        style={{
                            opacity: 0.55,
                            letterSpacing: 3,
                            marginBottom: 6,
                            display: 'flex',
                            justifyContent: 'space-between',
                        }}
                    >
                        <span>DIAGNOSTICS</span>
                        <span>F3 hide</span>
                    </div>
                    <DiagRow k="started" v={started ? 'yes' : 'no'} />
                    <DiagRow k="paused" v={paused ? 'yes' : 'no'} />
                    <DiagRow k="fps" v={String(stats.fps)} />
                    <DiagRow k="frames" v={String(stats.frames)} />
                    <DiagRow k="section" v={`${currentIndex + 1} / ${sections.length}`} />
                    <DiagRow k="theme" v={theme?.id ?? '-'} />
                    <DiagRow
                        k="player"
                        v={`x ${stats.playerX.toFixed(1)} y ${stats.playerY.toFixed(1)} z ${stats.playerZ.toFixed(1)}`}
                    />
                    {stats.lastError && (
                        <div
                            style={{
                                marginTop: 8,
                                padding: 6,
                                background: 'rgba(200,30,30,0.18)',
                                border: '1px solid rgba(255,80,80,0.4)',
                                color: '#ffb0b0',
                                wordBreak: 'break-word',
                            }}
                        >
                            {stats.lastError}
                        </div>
                    )}
                </div>
            )}

            {/* Click-to-look hint when started but not locked */}
            {started && !paused && !pointerLocked && (
                <div
                    onClick={handleResume}
                    style={{
                        position: 'fixed',
                        inset: 0,
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        justifyContent: 'center',
                        background: 'rgba(6,6,10,0.45)',
                        color: '#e8e8f0',
                        zIndex: 12,
                        cursor: 'pointer',
                        userSelect: 'none',
                        backdropFilter: 'blur(3px)',
                    }}
                >
                    <div
                        style={{
                            padding: '14px 28px',
                            border: '1px solid rgba(255,255,255,0.25)',
                            borderRadius: 2,
                            fontFamily: 'var(--font-mono), monospace',
                            fontSize: 13,
                            letterSpacing: 4,
                            background: 'rgba(255,255,255,0.04)',
                        }}
                    >
                        CLICK TO LOOK
                    </div>
                    <div
                        style={{
                            marginTop: 12,
                            fontSize: 11,
                            opacity: 0.55,
                            letterSpacing: 2,
                            fontFamily: 'var(--font-mono), monospace',
                        }}
                    >
                        WASD to move &nbsp;&middot;&nbsp; Esc to release
                    </div>
                </div>
            )}

            {/* Crosshair */}
            {started && !paused && (
                <div
                    style={{
                        position: 'fixed',
                        inset: 0,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        pointerEvents: 'none',
                        zIndex: 5,
                    }}
                >
                    <div
                        style={{
                            width: 4,
                            height: 4,
                            borderRadius: '50%',
                            background: 'rgba(255,255,255,0.75)',
                            boxShadow: '0 0 8px rgba(255,255,255,0.35)',
                        }}
                    />
                </div>
            )}

            {/* Start overlay */}
            {!started && (
                <div
                    id="gallery-start-overlay"
                    onClick={handleStart}
                    style={{
                        position: 'fixed',
                        inset: 0,
                        background: 'radial-gradient(circle at 50% 40%, #15151e 0%, #06060a 70%)',
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        justifyContent: 'center',
                        zIndex: 20,
                        color: '#e8e8f0',
                        cursor: 'pointer',
                        userSelect: 'none',
                    }}
                >
                    <div
                        style={{
                            fontFamily: 'var(--font-mono), monospace',
                            fontSize: 12,
                            letterSpacing: 4,
                            opacity: 0.55,
                        }}
                    >
                        QUALIA FIELDS
                    </div>
                    <h1
                        style={{
                            fontSize: 48,
                            margin: '8px 0 0 0',
                            letterSpacing: 8,
                            fontWeight: 300,
                        }}
                    >
                        LIMINOSITY
                    </h1>
                    <div
                        style={{
                            marginTop: 20,
                            opacity: 0.7,
                            fontSize: 14,
                            letterSpacing: 1,
                            maxWidth: 520,
                            textAlign: 'center',
                            lineHeight: 1.6,
                        }}
                    >
                        A procedural liminal space. Walk slowly. The hallways are longer than they look.
                    </div>

                    <div
                        style={{
                            marginTop: 40,
                            padding: '14px 28px',
                            border: '1px solid rgba(255,255,255,0.25)',
                            borderRadius: 2,
                            fontFamily: 'var(--font-mono), monospace',
                            fontSize: 13,
                            letterSpacing: 4,
                            background: 'rgba(255,255,255,0.03)',
                        }}
                    >
                        CLICK TO ENTER
                    </div>

                    <div
                        style={{
                            marginTop: 44,
                            display: 'grid',
                            gridTemplateColumns: 'auto auto',
                            gap: '6px 24px',
                            opacity: 0.6,
                            fontSize: 11,
                            letterSpacing: 2,
                            fontFamily: 'var(--font-mono), monospace',
                        }}
                    >
                        <span>WASD / Arrows</span>
                        <span>move</span>
                        <span>Mouse</span>
                        <span>look</span>
                        <span>Space</span>
                        <span>jump</span>
                        <span>Shift</span>
                        <span>sprint</span>
                        <span>P / Esc</span>
                        <span>pause</span>
                        <span>F2</span>
                        <span>screenshot</span>
                        <span>M</span>
                        <span>mute ambient</span>
                    </div>
                </div>
            )}

            {/* Pause overlay */}
            {started && paused && (
                <div
                    style={{
                        position: 'fixed',
                        inset: 0,
                        background: 'rgba(6,6,10,0.82)',
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        justifyContent: 'center',
                        zIndex: 15,
                        color: '#e8e8f0',
                        backdropFilter: 'blur(6px)',
                    }}
                >
                    <div
                        style={{
                            fontFamily: 'var(--font-mono), monospace',
                            fontSize: 12,
                            letterSpacing: 6,
                            opacity: 0.55,
                        }}
                    >
                        PAUSED
                    </div>
                    <h2
                        style={{
                            fontSize: 36,
                            margin: '8px 0 28px 0',
                            letterSpacing: 6,
                            fontWeight: 300,
                        }}
                    >
                        {theme?.name.toUpperCase() ?? 'SOMEWHERE'}
                    </h2>

                    <button
                        id="gallery-resume-button"
                        onClick={handleResume}
                        style={menuBtn}
                    >
                        <Play size={14} /> RESUME
                    </button>
                    <button onClick={onScreenshot} style={menuBtn}>
                        <Camera size={14} /> SCREENSHOT
                    </button>
                    <button onClick={handleNewSeed} style={menuBtn}>
                        <Shuffle size={14} /> NEW SEED
                    </button>
                    <Link href="/qualia-fields" style={{ textDecoration: 'none' }}>
                        <button style={{ ...menuBtn, marginTop: 12 }}>
                            <LogOut size={14} /> EXIT TO HUB
                        </button>
                    </Link>
                </div>
            )}
        </>
    );
}

function DiagRow({ k, v }: { k: string; v: string }) {
    return (
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12 }}>
            <span style={{ opacity: 0.55 }}>{k}</span>
            <span style={{ color: '#e8f6ee' }}>{v}</span>
        </div>
    );
}

function HudButton({
    children,
    onClick,
    title,
}: {
    children: React.ReactNode;
    onClick?: () => void;
    title?: string;
}) {
    return (
        <button
            type="button"
            title={title}
            onClick={onClick}
            style={{
                width: 34,
                height: 34,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                background: 'rgba(10,10,14,0.55)',
                border: '1px solid rgba(255,255,255,0.2)',
                borderRadius: 4,
                color: '#e8e8f0',
                cursor: 'pointer',
                backdropFilter: 'blur(4px)',
                transition: 'background 0.15s',
            }}
            onMouseEnter={(e) => (e.currentTarget.style.background = 'rgba(30,30,40,0.8)')}
            onMouseLeave={(e) => (e.currentTarget.style.background = 'rgba(10,10,14,0.55)')}
        >
            {children}
        </button>
    );
}

const menuBtn: React.CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    gap: 10,
    justifyContent: 'center',
    width: 240,
    padding: '10px 16px',
    margin: '4px 0',
    background: 'rgba(20,20,28,0.7)',
    border: '1px solid rgba(255,255,255,0.18)',
    color: '#e8e8f0',
    fontFamily: 'var(--font-mono), monospace',
    fontSize: 12,
    letterSpacing: 3,
    cursor: 'pointer',
    borderRadius: 2,
};
