'use client';

import type { Theme } from './types';

// -----------------------------------------------------------------------------
// Ambient audio engine for the liminal gallery.
//
// A single persistent audio graph:
//
//   [drones + noise]  ->  bus  ->  lowpass filter  ->  master  ->  destination
//                                          \-> convolver -> wet gain -> master
//
// An LFO modulates the filter cutoff for slow movement. A scheduled "bell"
// oscillator plays very occasional sparse tones tuned to the active theme.
// Theme changes smoothly ramp oscillator frequencies + gains so transitions
// feel like crossing a threshold rather than a hard cut.
// -----------------------------------------------------------------------------

type DroneVoice = {
    osc: OscillatorNode;
    gain: GainNode;
};

type EpicLayer = {
    // Six oscillator voices making up a fat sustained chord.
    voices: DroneVoice[];
    // Master gain for the whole epic layer (ramped up on enable).
    layerGain: GainNode;
    // Chord-progression stepper + timpani-tick handles.
    chordTimer: number | null;
    timpaniTimer: number | null;
    chordIdx: number;
};

type WindLayer = {
    // Two noise sources feeding separate filters so the "gust" and "rustle"
    // bands can modulate independently.
    gustSource: AudioBufferSourceNode;
    gustFilter: BiquadFilterNode;
    gustGain: GainNode;
    rustleSource: AudioBufferSourceNode;
    rustleFilter: BiquadFilterNode;
    rustleGain: GainNode;
    // LFO that sweeps the gust filter between "breath" and "blow" centres.
    gustLfo: OscillatorNode;
    gustLfoGain: GainNode;
    // Overall wind layer gain; 0 off, ~0.55 on.
    layerGain: GainNode;
};

type Engine = {
    ctx: AudioContext;
    master: GainNode;
    bus: GainNode;
    busGain: GainNode; // dedicated gain in front of the bus so we can duck
    filter: BiquadFilterNode;
    reverb: ConvolverNode;
    wet: GainNode;
    lfo: OscillatorNode;
    lfoGain: GainNode;
    drones: DroneVoice[];
    noise: AudioBufferSourceNode;
    noiseFilter: BiquadFilterNode;
    noiseGain: GainNode;
    bellTimer: number | null;
    epic: EpicLayer;
    wind: WindLayer;
};

let engine: Engine | null = null;
let currentTheme: Theme | null = null;
let muted = false;
let ducked = false;
let silenced = false;
let epicActive = false;
let windActive = false;
const MASTER_VOLUME = 0.55;
const DUCKED_VOLUME = 0.18;
const EPIC_LAYER_VOLUME = 0.7;
const EPIC_BUS_DUCK = 0.32;
const WIND_LAYER_VOLUME = 0.65;
const WIND_BUS_DUCK = 0.45;

// A cinematic four-chord progression in E minor: i - VI - III - VII.
// Each entry is [root Hz, 'min' | 'maj']. Held ~7s per chord.
const EPIC_CHORDS: Array<[number, 'min' | 'maj']> = [
    [82.41, 'min'], // E minor
    [65.41, 'maj'], // C major
    [98.0, 'maj'], // G major
    [73.42, 'maj'], // D major
];
const EPIC_CHORD_HOLD_SEC = 7.0;
const EPIC_CHORD_RAMP_SEC = 1.4;
const EPIC_TIMPANI_BASE_SEC = 3.2;

function generateImpulseResponse(ctx: AudioContext, durationSec = 4, decay = 2.5) {
    const rate = ctx.sampleRate;
    const length = Math.floor(rate * durationSec);
    const impulse = ctx.createBuffer(2, length, rate);
    for (let ch = 0; ch < 2; ch++) {
        const data = impulse.getChannelData(ch);
        for (let i = 0; i < length; i++) {
            data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / length, decay);
        }
    }
    return impulse;
}

function generatePinkNoiseBuffer(ctx: AudioContext, durationSec = 4) {
    const rate = ctx.sampleRate;
    const length = Math.floor(rate * durationSec);
    const buffer = ctx.createBuffer(1, length, rate);
    const data = buffer.getChannelData(0);
    // Paul Kellet's pink noise filter.
    let b0 = 0,
        b1 = 0,
        b2 = 0,
        b3 = 0,
        b4 = 0,
        b5 = 0,
        b6 = 0;
    for (let i = 0; i < length; i++) {
        const white = Math.random() * 2 - 1;
        b0 = 0.99886 * b0 + white * 0.0555179;
        b1 = 0.99332 * b1 + white * 0.0750759;
        b2 = 0.969 * b2 + white * 0.153852;
        b3 = 0.8665 * b3 + white * 0.3104856;
        b4 = 0.55 * b4 + white * 0.5329522;
        b5 = -0.7616 * b5 - white * 0.016898;
        data[i] = (b0 + b1 + b2 + b3 + b4 + b5 + b6 + white * 0.5362) * 0.11;
        b6 = white * 0.115926;
    }
    return buffer;
}

function computeTargetMasterGain() {
    if (muted) return 0;
    // Silence-themed rooms hard-mute the bus so the whole museum goes
    // completely still while the watchers do their work.
    if (silenced) return 0;
    return ducked ? DUCKED_VOLUME : MASTER_VOLUME;
}

export async function ensureAudioStarted(): Promise<boolean> {
    if (typeof window === 'undefined') return false;
    if (engine) {
        if (engine.ctx.state === 'suspended') {
            try {
                await engine.ctx.resume();
            } catch {
                /* ignore */
            }
        }
        return true;
    }
    try {
        const Ctor: typeof AudioContext =
            window.AudioContext ||
            (window as unknown as { webkitAudioContext?: typeof AudioContext })
                .webkitAudioContext!;
        if (!Ctor) return false;
        const ctx = new Ctor();
        if (ctx.state === 'suspended') {
            try {
                await ctx.resume();
            } catch {
                /* ignore */
            }
        }

        const master = ctx.createGain();
        master.gain.value = 0;
        master.connect(ctx.destination);

        const reverb = ctx.createConvolver();
        reverb.buffer = generateImpulseResponse(ctx);
        const wet = ctx.createGain();
        wet.gain.value = 0.4;
        reverb.connect(wet);
        wet.connect(master);

        const filter = ctx.createBiquadFilter();
        filter.type = 'lowpass';
        filter.frequency.value = 700;
        filter.Q.value = 0.6;
        filter.connect(master);
        filter.connect(reverb);

        // busGain lets us duck the ambient bed when epic mode kicks in without
        // disturbing individual drone levels.
        const busGain = ctx.createGain();
        busGain.gain.value = 1.0;
        busGain.connect(filter);

        const bus = ctx.createGain();
        bus.gain.value = 1.0;
        bus.connect(busGain);

        const lfo = ctx.createOscillator();
        lfo.type = 'sine';
        lfo.frequency.value = 0.06;
        const lfoGain = ctx.createGain();
        lfoGain.gain.value = 320;
        lfo.connect(lfoGain);
        lfoGain.connect(filter.frequency);
        lfo.start();

        const drones: DroneVoice[] = [];
        for (let i = 0; i < 5; i++) {
            const osc = ctx.createOscillator();
            osc.type =
                i === 0 ? 'sine' : i === 1 ? 'sine' : i === 2 ? 'triangle' : 'sawtooth';
            osc.frequency.value = 55 * (i + 1);
            osc.detune.value = (i - 2) * 6;
            const gain = ctx.createGain();
            gain.gain.value = 0;
            osc.connect(gain);
            gain.connect(bus);
            osc.start();
            drones.push({ osc, gain });
        }

        const noise = ctx.createBufferSource();
        noise.buffer = generatePinkNoiseBuffer(ctx);
        noise.loop = true;
        const noiseFilter = ctx.createBiquadFilter();
        noiseFilter.type = 'bandpass';
        noiseFilter.frequency.value = 900;
        noiseFilter.Q.value = 1.8;
        const noiseGain = ctx.createGain();
        noiseGain.gain.value = 0;
        noise.connect(noiseFilter);
        noiseFilter.connect(noiseGain);
        noiseGain.connect(bus);
        noise.start();

        // Epic layer: six oscillator voices playing a slow chord progression,
        // routed directly to master (bypassing the underwater low-pass) and
        // also sent to the reverb for cinematic tail.
        const epicLayerGain = ctx.createGain();
        epicLayerGain.gain.value = 0;
        epicLayerGain.connect(master);
        epicLayerGain.connect(reverb);

        const epicVoices: DroneVoice[] = [];
        // Voice slot ordering matters for ratio application: bass, root, third,
        // fifth, octave, tenth.
        const epicVoiceConfig: Array<{ type: OscillatorType; detune: number; gain: number }> = [
            { type: 'sine', detune: -4, gain: 0.16 },
            { type: 'sine', detune: 0, gain: 0.14 },
            { type: 'triangle', detune: 6, gain: 0.11 },
            { type: 'triangle', detune: -6, gain: 0.11 },
            { type: 'sawtooth', detune: 3, gain: 0.08 },
            { type: 'sawtooth', detune: -3, gain: 0.06 },
        ];
        for (let i = 0; i < epicVoiceConfig.length; i++) {
            const cfg = epicVoiceConfig[i];
            const osc = ctx.createOscillator();
            osc.type = cfg.type;
            osc.frequency.value = 110 * (i + 1); // placeholder; real values set on chord step
            osc.detune.value = cfg.detune;
            const gain = ctx.createGain();
            gain.gain.value = 0;
            osc.connect(gain);
            gain.connect(epicLayerGain);
            osc.start();
            epicVoices.push({ osc, gain });
        }

        // Wind layer: two independent noise sources for gusts and high-band
        // rustle, routed direct to master (bypassing the underwater lowpass)
        // plus a send to the reverb for spaciousness.
        const windLayerGain = ctx.createGain();
        windLayerGain.gain.value = 0;
        windLayerGain.connect(master);
        windLayerGain.connect(reverb);

        const gustSource = ctx.createBufferSource();
        gustSource.buffer = generatePinkNoiseBuffer(ctx, 6);
        gustSource.loop = true;
        const gustFilter = ctx.createBiquadFilter();
        gustFilter.type = 'bandpass';
        gustFilter.frequency.value = 500;
        gustFilter.Q.value = 1.2;
        const gustGain = ctx.createGain();
        gustGain.gain.value = 0.9;
        gustSource.connect(gustFilter);
        gustFilter.connect(gustGain);
        gustGain.connect(windLayerGain);
        gustSource.start();

        const rustleSource = ctx.createBufferSource();
        rustleSource.buffer = generatePinkNoiseBuffer(ctx, 6);
        rustleSource.loop = true;
        const rustleFilter = ctx.createBiquadFilter();
        rustleFilter.type = 'bandpass';
        rustleFilter.frequency.value = 4800;
        rustleFilter.Q.value = 2.6;
        const rustleGain = ctx.createGain();
        rustleGain.gain.value = 0.35;
        rustleSource.connect(rustleFilter);
        rustleFilter.connect(rustleGain);
        rustleGain.connect(windLayerGain);
        rustleSource.start();

        const gustLfo = ctx.createOscillator();
        gustLfo.type = 'sine';
        gustLfo.frequency.value = 0.18;
        const gustLfoGain = ctx.createGain();
        gustLfoGain.gain.value = 280;
        gustLfo.connect(gustLfoGain);
        gustLfoGain.connect(gustFilter.frequency);
        gustLfo.start();

        engine = {
            ctx,
            master,
            bus,
            busGain,
            filter,
            reverb,
            wet,
            lfo,
            lfoGain,
            drones,
            noise,
            noiseFilter,
            noiseGain,
            bellTimer: null,
            epic: {
                voices: epicVoices,
                layerGain: epicLayerGain,
                chordTimer: null,
                timpaniTimer: null,
                chordIdx: 0,
            },
            wind: {
                gustSource,
                gustFilter,
                gustGain,
                rustleSource,
                rustleFilter,
                rustleGain,
                gustLfo,
                gustLfoGain,
                layerGain: windLayerGain,
            },
        };

        // Fade in.
        const now = ctx.currentTime;
        master.gain.setValueAtTime(0, now);
        master.gain.linearRampToValueAtTime(computeTargetMasterGain(), now + 2.5);

        // If a theme was already set before the engine existed, apply it.
        if (currentTheme) {
            applyTheme(currentTheme, 2.5);
            // If the player started directly in the chapel, bring the epic
            // layer up now that the engine exists.
            if (currentTheme.id === 'fractal-chapel') {
                epicActive = false; // force setEpicMode to transition
                setEpicMode(true);
            } else if (epicActive) {
                epicActive = false;
                setEpicMode(false);
            }
            if (currentTheme.id === 'forest-grove') {
                windActive = false;
                setWindMode(true);
            } else if (windActive) {
                windActive = false;
                setWindMode(false);
            }
        }
        scheduleBell();
        return true;
    } catch (e) {
        console.warn('[gallery] audio init failed', e);
        return false;
    }
}

function applyTheme(theme: Theme, rampSec = 2.5) {
    if (!engine) return;
    const { ctx } = engine;
    const now = ctx.currentTime;
    const tone = theme.audioTone;

    engine.lfo.frequency.linearRampToValueAtTime(tone.lfoHz, now + rampSec);

    // Higher partials attenuate faster.
    for (let i = 0; i < engine.drones.length; i++) {
        const { osc, gain } = engine.drones[i];
        const partial = tone.partials[i];
        if (partial !== undefined) {
            osc.frequency.linearRampToValueAtTime(tone.baseHz * partial, now + rampSec);
            const g = 0.16 / Math.pow(i + 1, 0.55);
            gain.gain.linearRampToValueAtTime(g, now + rampSec);
        } else {
            gain.gain.linearRampToValueAtTime(0, now + rampSec);
        }
    }

    engine.noiseFilter.frequency.linearRampToValueAtTime(
        tone.noiseCenterHz,
        now + rampSec,
    );
    engine.noiseGain.gain.linearRampToValueAtTime(tone.noiseGain, now + rampSec);
}

export function setAudioTheme(theme: Theme) {
    currentTheme = theme;
    // The Silence hard-mutes the master bus; non-silence rooms restore it.
    const nextSilenced = theme.id === 'silence';
    if (nextSilenced !== silenced) {
        silenced = nextSilenced;
        if (engine) {
            const now = engine.ctx.currentTime;
            // Faster fade out entering Silence so the room "feels" when you
            // cross the threshold; slower fade in on exit.
            const ramp = nextSilenced ? 0.7 : 2.0;
            engine.master.gain.linearRampToValueAtTime(
                computeTargetMasterGain(),
                now + ramp,
            );
        }
    }
    applyTheme(theme);
    // The Fractal Chapel swaps the ambient bed for cinematic epic music and
    // reverts back to the theme drones on the way out.
    setEpicMode(theme.id === 'fractal-chapel');
    // The Grove replaces everything with rustling wind for that section only.
    setWindMode(theme.id === 'forest-grove');
}

function voiceGainFor(i: number): number {
    // Bass a little louder, tenth quietest.
    return [0.16, 0.14, 0.11, 0.11, 0.08, 0.06][i] ?? 0.08;
}

function chordRatios(kind: 'min' | 'maj'): number[] {
    const third = kind === 'min' ? 1.1892 : 1.2599; // minor or major third
    const fifth = 1.4983; // perfect fifth
    // Bass (octave below), root, third, fifth, octave, tenth (octave + third).
    return [0.5, 1.0, third, fifth, 2.0, 2.0 * third];
}

function stepEpicChord() {
    if (!engine || !epicActive) return;
    const { ctx, epic } = engine;
    const now = ctx.currentTime;
    const [root, kind] = EPIC_CHORDS[epic.chordIdx % EPIC_CHORDS.length];
    const ratios = chordRatios(kind);

    for (let i = 0; i < epic.voices.length; i++) {
        const v = epic.voices[i];
        const target = root * ratios[i];
        v.osc.frequency.linearRampToValueAtTime(target, now + EPIC_CHORD_RAMP_SEC);
        v.gain.gain.linearRampToValueAtTime(voiceGainFor(i), now + EPIC_CHORD_RAMP_SEC);
    }

    epic.chordIdx++;
    if (epic.chordTimer != null) window.clearTimeout(epic.chordTimer);
    epic.chordTimer = window.setTimeout(
        stepEpicChord,
        EPIC_CHORD_HOLD_SEC * 1000,
    ) as unknown as number;
}

function playTimpani() {
    if (!engine || !epicActive) return;
    const { ctx, epic } = engine;
    const osc = ctx.createOscillator();
    osc.type = 'sine';
    const now = ctx.currentTime;
    // A low thud with a fast exponential pitch drop - reads as timpani.
    osc.frequency.setValueAtTime(120, now);
    osc.frequency.exponentialRampToValueAtTime(42, now + 0.9);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, now);
    g.gain.exponentialRampToValueAtTime(0.28, now + 0.015);
    g.gain.exponentialRampToValueAtTime(0.0001, now + 1.0);
    osc.connect(g);
    g.connect(epic.layerGain);
    osc.start(now);
    osc.stop(now + 1.1);
}

function scheduleTimpani() {
    if (!engine || !epicActive) return;
    const { epic } = engine;
    if (epic.timpaniTimer != null) window.clearTimeout(epic.timpaniTimer);
    const jitter = EPIC_TIMPANI_BASE_SEC * (0.85 + Math.random() * 0.5);
    epic.timpaniTimer = window.setTimeout(() => {
        playTimpani();
        scheduleTimpani();
    }, jitter * 1000) as unknown as number;
}

function setEpicMode(on: boolean) {
    if (!engine) {
        // Engine hasn't started yet - flag will be checked when it does.
        epicActive = on;
        return;
    }
    if (epicActive === on) return;
    epicActive = on;
    const { ctx, epic, busGain } = engine;
    const now = ctx.currentTime;
    const rampSec = on ? 3.0 : 2.5;

    epic.layerGain.gain.cancelScheduledValues(now);
    epic.layerGain.gain.setValueAtTime(epic.layerGain.gain.value, now);
    epic.layerGain.gain.linearRampToValueAtTime(on ? EPIC_LAYER_VOLUME : 0, now + rampSec);

    busGain.gain.cancelScheduledValues(now);
    busGain.gain.setValueAtTime(busGain.gain.value, now);
    busGain.gain.linearRampToValueAtTime(on ? EPIC_BUS_DUCK : 1.0, now + rampSec);

    if (on) {
        // Kick straight into a fresh chord cycle.
        epic.chordIdx = 0;
        stepEpicChord();
        scheduleTimpani();
    } else {
        if (epic.chordTimer != null) {
            window.clearTimeout(epic.chordTimer);
            epic.chordTimer = null;
        }
        if (epic.timpaniTimer != null) {
            window.clearTimeout(epic.timpaniTimer);
            epic.timpaniTimer = null;
        }
        // Fade each voice individually in parallel with the layer fade so
        // they land at silence even if the layer gain is reused later.
        for (const v of epic.voices) {
            v.gain.gain.cancelScheduledValues(now);
            v.gain.gain.setValueAtTime(v.gain.gain.value, now);
            v.gain.gain.linearRampToValueAtTime(0, now + rampSec);
        }
    }
}

function setWindMode(on: boolean) {
    if (!engine) {
        windActive = on;
        return;
    }
    if (windActive === on) return;
    windActive = on;
    const { ctx, wind, busGain } = engine;
    const now = ctx.currentTime;
    const rampSec = on ? 2.2 : 1.8;

    wind.layerGain.gain.cancelScheduledValues(now);
    wind.layerGain.gain.setValueAtTime(wind.layerGain.gain.value, now);
    wind.layerGain.gain.linearRampToValueAtTime(
        on ? WIND_LAYER_VOLUME : 0,
        now + rampSec,
    );

    // Duck the ambient drone + noise bus so the wind reads as "this room is
    // outdoors" rather than "this room has wind in it".
    // We multiply with any epic-mode duck already applied by using whichever
    // is stronger (numerically smaller).
    busGain.gain.cancelScheduledValues(now);
    const currentBus = busGain.gain.value;
    let target: number;
    if (on) {
        target = Math.min(currentBus, WIND_BUS_DUCK);
    } else {
        // Restore: epic-mode may still want us at EPIC_BUS_DUCK.
        target = epicActive ? EPIC_BUS_DUCK : 1.0;
    }
    busGain.gain.setValueAtTime(currentBus, now);
    busGain.gain.linearRampToValueAtTime(target, now + rampSec);

    // Wobble the gust LFO slightly faster while forest is active so the
    // gusts feel alive even with the tree canopy rendered still.
    wind.gustLfo.frequency.linearRampToValueAtTime(
        on ? 0.22 : 0.18,
        now + rampSec,
    );
}

export function setAudioMuted(m: boolean) {
    muted = m;
    if (!engine) return;
    const now = engine.ctx.currentTime;
    engine.master.gain.linearRampToValueAtTime(computeTargetMasterGain(), now + 0.5);
}

export function setAudioDucked(d: boolean) {
    ducked = d;
    if (!engine) return;
    const now = engine.ctx.currentTime;
    engine.master.gain.linearRampToValueAtTime(computeTargetMasterGain(), now + 0.4);
}

export function isAudioMuted(): boolean {
    return muted;
}

function scheduleBell() {
    if (!engine) return;
    if (engine.bellTimer != null) {
        window.clearTimeout(engine.bellTimer);
    }
    const avg = currentTheme?.audioTone.bellEverySec ?? 22;
    const jitter = avg * (0.55 + Math.random() * 0.9);
    engine.bellTimer = window.setTimeout(() => {
        playBell();
        scheduleBell();
    }, jitter * 1000) as unknown as number;
}

function playBell() {
    if (!engine) return;
    if (muted) return;
    const { ctx, bus } = engine;
    const tone = currentTheme?.audioTone;
    const baseHz = tone?.baseHz ?? 55;
    const ratio = tone?.bellRatio ?? 6;
    const freq = baseHz * ratio * (0.99 + Math.random() * 0.02);

    const osc = ctx.createOscillator();
    osc.type = 'sine';
    osc.frequency.value = freq;

    const osc2 = ctx.createOscillator();
    osc2.type = 'sine';
    osc2.frequency.value = freq * 2.01;
    osc2.detune.value = 4;

    const gain = ctx.createGain();
    gain.gain.value = 0;
    const gain2 = ctx.createGain();
    gain2.gain.value = 0;

    osc.connect(gain);
    osc2.connect(gain2);
    gain.connect(bus);
    gain2.connect(bus);

    const now = ctx.currentTime;
    const dur = 3.8 + Math.random() * 1.6;
    gain.gain.setValueAtTime(0, now);
    gain.gain.linearRampToValueAtTime(0.13, now + 0.04);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + dur);
    gain2.gain.setValueAtTime(0, now);
    gain2.gain.linearRampToValueAtTime(0.04, now + 0.02);
    gain2.gain.exponentialRampToValueAtTime(0.0001, now + dur * 0.7);

    osc.start(now);
    osc2.start(now);
    osc.stop(now + dur + 0.1);
    osc2.stop(now + dur * 0.7 + 0.1);
}

// One-shot "pop" played the instant the Mandelbrot fall cutscene ends and
// the player is teleported into the next hallway. Routed directly to master
// so it bypasses the ambient filter/reverb and reads as punchy. Combines a
// fast low-frequency sine thud (body) with a brief filtered-noise click
// (air) and a faint high chime (sparkle). Total duration ~0.25 s.
export function playArrivalPop(): void {
    if (!engine) return;
    if (muted) return;
    const { ctx, master } = engine;
    const now = ctx.currentTime;

    // --- 1. Low sine thud (80 Hz -> 38 Hz) ------------------------------
    const thud = ctx.createOscillator();
    thud.type = 'sine';
    thud.frequency.setValueAtTime(90, now);
    thud.frequency.exponentialRampToValueAtTime(36, now + 0.22);
    const thudGain = ctx.createGain();
    thudGain.gain.setValueAtTime(0, now);
    thudGain.gain.linearRampToValueAtTime(0.55, now + 0.005);
    thudGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.24);
    thud.connect(thudGain);
    thudGain.connect(master);
    thud.start(now);
    thud.stop(now + 0.26);

    // --- 2. Filtered noise click (air / plosive) -----------------------
    const noiseBuf = ctx.createBuffer(1, Math.floor(ctx.sampleRate * 0.08), ctx.sampleRate);
    const nch = noiseBuf.getChannelData(0);
    for (let i = 0; i < nch.length; i++) {
        // A mild saturation + linear decay so the click doesn't pop harshly.
        const t = i / nch.length;
        nch[i] = (Math.random() * 2 - 1) * (1 - t) * 0.9;
    }
    const noise = ctx.createBufferSource();
    noise.buffer = noiseBuf;
    const noiseFilter = ctx.createBiquadFilter();
    noiseFilter.type = 'bandpass';
    noiseFilter.frequency.setValueAtTime(1800, now);
    noiseFilter.Q.value = 0.9;
    const noiseGain = ctx.createGain();
    noiseGain.gain.setValueAtTime(0, now);
    noiseGain.gain.linearRampToValueAtTime(0.22, now + 0.003);
    noiseGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.08);
    noise.connect(noiseFilter);
    noiseFilter.connect(noiseGain);
    noiseGain.connect(master);
    noise.start(now);
    noise.stop(now + 0.1);

    // --- 3. High chime partial (sparkle so the pop has a "landing" cue) -
    const chime = ctx.createOscillator();
    chime.type = 'sine';
    chime.frequency.setValueAtTime(640, now);
    chime.frequency.exponentialRampToValueAtTime(420, now + 0.14);
    const chimeGain = ctx.createGain();
    chimeGain.gain.setValueAtTime(0, now);
    chimeGain.gain.linearRampToValueAtTime(0.09, now + 0.004);
    chimeGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.17);
    chime.connect(chimeGain);
    chimeGain.connect(master);
    chime.start(now);
    chime.stop(now + 0.19);
}

export function disposeAudio() {
    if (!engine) return;
    try {
        if (engine.bellTimer != null) window.clearTimeout(engine.bellTimer);
        if (engine.epic.chordTimer != null) window.clearTimeout(engine.epic.chordTimer);
        if (engine.epic.timpaniTimer != null) window.clearTimeout(engine.epic.timpaniTimer);
        engine.ctx.close();
    } catch {
        /* ignore */
    }
    engine = null;
    epicActive = false;
}
