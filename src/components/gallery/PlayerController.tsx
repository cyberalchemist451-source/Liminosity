'use client';

import { useEffect, useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
// `useThree()` is used only for the initial camera setup in an effect. All
// per-frame mutation goes through `state.camera` inside `useFrame`, which the
// react-hooks/immutability rule permits.
import { PointerLockControls } from '@react-three/drei';
import * as THREE from 'three';
import { useGalleryStore } from '@/lib/gallery/galleryStore';
import { resolveSliding, groundYAt } from '@/lib/gallery/collision';
import { registerPointerLockControls } from '@/lib/gallery/pointerLock';

const EYE_HEIGHT = 1.65;
const PLAYER_RADIUS = 0.38;
const WALK_SPEED = 3.6;
const SPRINT_SPEED = 6.0;
const JUMP_V = 7.5;
const GRAVITY = 24;

type KeyState = {
    forward: boolean;
    back: boolean;
    left: boolean;
    right: boolean;
    jump: boolean;
    sprint: boolean;
};

export default function PlayerController() {
    const controlsRef = useRef<React.ComponentRef<typeof PointerLockControls> | null>(null);
    const threeCamera = useThree((s) => s.camera);
    const keys = useRef<KeyState>({
        forward: false,
        back: false,
        left: false,
        right: false,
        jump: false,
        sprint: false,
    });
    const velocity = useRef(new THREE.Vector3(0, 0, 0));
    const grounded = useRef(true);
    const playerY = useRef(EYE_HEIGHT);

    const paused = useGalleryStore((s) => s.paused);
    const started = useGalleryStore((s) => s.started);
    const sections = useGalleryStore((s) => s.sections);
    const setPointerLocked = useGalleryStore((s) => s.setPointerLocked);
    const setPaused = useGalleryStore((s) => s.setPaused);
    const setCurrentIndex = useGalleryStore((s) => s.setCurrentIndex);
    const fallingIntoHole = useGalleryStore((s) => s.fallingIntoHole);
    const consumeTeleport = useGalleryStore((s) => s.consumeTeleport);

    // Spawn camera at starting position + orientation.
    useEffect(() => {
        threeCamera.position.set(0, EYE_HEIGHT, -6);
        threeCamera.rotation.set(0, 0, 0);
        threeCamera.lookAt(0, EYE_HEIGHT, 10);
    }, [threeCamera]);

    // Input bindings
    useEffect(() => {
        const down = (e: KeyboardEvent) => {
            switch (e.code) {
                case 'KeyW':
                case 'ArrowUp':
                    keys.current.forward = true;
                    break;
                case 'KeyS':
                case 'ArrowDown':
                    keys.current.back = true;
                    break;
                case 'KeyA':
                case 'ArrowLeft':
                    keys.current.left = true;
                    break;
                case 'KeyD':
                case 'ArrowRight':
                    keys.current.right = true;
                    break;
                case 'Space':
                    keys.current.jump = true;
                    e.preventDefault();
                    break;
                case 'ShiftLeft':
                case 'ShiftRight':
                    keys.current.sprint = true;
                    break;
                case 'KeyP':
                    setPaused(!useGalleryStore.getState().paused);
                    break;
                case 'Escape':
                    // pointer lock naturally releases; also pause
                    setPaused(true);
                    break;
            }
        };
        const up = (e: KeyboardEvent) => {
            switch (e.code) {
                case 'KeyW':
                case 'ArrowUp':
                    keys.current.forward = false;
                    break;
                case 'KeyS':
                case 'ArrowDown':
                    keys.current.back = false;
                    break;
                case 'KeyA':
                case 'ArrowLeft':
                    keys.current.left = false;
                    break;
                case 'KeyD':
                case 'ArrowRight':
                    keys.current.right = false;
                    break;
                case 'Space':
                    keys.current.jump = false;
                    break;
                case 'ShiftLeft':
                case 'ShiftRight':
                    keys.current.sprint = false;
                    break;
            }
        };
        window.addEventListener('keydown', down);
        window.addEventListener('keyup', up);
        return () => {
            window.removeEventListener('keydown', down);
            window.removeEventListener('keyup', up);
        };
    }, [setPaused]);

    // Sync pointer lock state
    const onLock = () => setPointerLocked(true);
    const onUnlock = () => setPointerLocked(false);

    useFrame((state, dtRaw) => {
        if (paused || !started) return;
        const camera = state.camera;

        // If the void-shaft cutscene just ended, teleport into the hallway
        // before we run any more input / collision.
        if (!fallingIntoHole) {
            const target = consumeTeleport();
            if (target) {
                camera.position.set(target[0], target[1], target[2]);
                camera.lookAt(target[0], target[1], target[2] + 6);
                playerY.current = target[1];
                velocity.current.set(0, 0, 0);
                grounded.current = true;
            }
        }

        // While falling into the void shaft, suppress all input and physics -
        // the Mandelbrot overlay covers the screen. Camera stays where it is.
        if (fallingIntoHole) return;

        const dt = Math.min(dtRaw, 0.05);

        // Horizontal movement from camera yaw only (ignore pitch).
        const forward = new THREE.Vector3();
        camera.getWorldDirection(forward);
        forward.y = 0;
        forward.normalize();
        const right = new THREE.Vector3();
        right.crossVectors(forward, camera.up).normalize();

        const wish = new THREE.Vector3();
        if (keys.current.forward) wish.add(forward);
        if (keys.current.back) wish.sub(forward);
        if (keys.current.right) wish.add(right);
        if (keys.current.left) wish.sub(right);
        if (wish.lengthSq() > 0) wish.normalize();

        const speed = keys.current.sprint ? SPRINT_SPEED : WALK_SPEED;
        const dx = wish.x * speed * dt;
        const dz = wish.z * speed * dt;

        // Propose new XZ and resolve against walls
        const nextX = camera.position.x + dx;
        const nextZ = camera.position.z + dz;

        if (sections.length > 0) {
            const resolved = resolveSliding(
                { rooms: sections, radius: PLAYER_RADIUS, doorwayWidth: 2.2 },
                nextX,
                nextZ,
            );
            camera.position.x = resolved.x;
            camera.position.z = resolved.z;
        } else {
            camera.position.x = nextX;
            camera.position.z = nextZ;
        }

        // Vertical dynamics. The ground height is sampled per-frame from
        // collision.groundYAt so stairs hallways can ramp the player up and
        // down without changing any room origins.
        const groundY =
            sections.length > 0
                ? groundYAt(sections, camera.position.x, camera.position.z)
                : 0;
        const floorTop = groundY + EYE_HEIGHT;

        if (keys.current.jump && grounded.current) {
            velocity.current.y = JUMP_V;
            grounded.current = false;
        }

        if (grounded.current && velocity.current.y === 0) {
            // Glue to the ground while grounded - allows smooth ramp
            // traversal both up and down. Step-down snap tolerance of 0.6m
            // keeps the player from "floating" briefly when walking off a
            // plateau's descending edge.
            const delta = playerY.current - floorTop;
            if (delta > -0.05 && delta < 0.6) {
                playerY.current = floorTop;
            } else {
                grounded.current = false;
            }
        }

        if (!grounded.current) {
            velocity.current.y -= GRAVITY * dt;
            playerY.current += velocity.current.y * dt;
            if (playerY.current <= floorTop) {
                playerY.current = floorTop;
                velocity.current.y = 0;
                grounded.current = true;
            }
        }
        camera.position.y = playerY.current;

        // Update section index based on Z
        if (sections.length > 0) {
            const z = camera.position.z;
            let idx = 0;
            for (let i = 0; i < sections.length; i++) {
                const room = sections[i];
                const frontZ = room.origin[2] - room.depth / 2;
                if (z >= frontZ - 1) idx = i;
            }
            setCurrentIndex(idx);
        }
    });

    return (
        <PointerLockControls
            ref={(ctl) => {
                controlsRef.current = ctl;
                registerPointerLockControls(ctl);
            }}
            onLock={onLock}
            onUnlock={onUnlock}
        />
    );
}
