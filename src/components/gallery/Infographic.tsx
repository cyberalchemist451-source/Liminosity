'use client';

import { Suspense, useMemo } from 'react';
import { Text } from '@react-three/drei';
import type { Theme } from '@/lib/gallery/types';
import { fontUrlFor } from '@/lib/gallery/fonts';
import { getArtworkTexture } from '@/lib/gallery/infographicArt';

type Props = {
    theme: Theme;
    position: [number, number, number];
    rotationY?: number;
    // Hard ceiling on how large the panel may grow (room-derived).
    maxWidth: number;
    maxHeight: number;
};

type Layout = {
    width: number;
    height: number;
    titleFontSize: number;
    bodyFontSize: number;
    subtitleFontSize: number;
    titleBandY: number;
    titleBandHeight: number;
    subtitleBandY: number;
    subtitleBandHeight: number;
    dividerYTop: number;
    dividerYBottom: number;
    innerMarginX: number;
    // Image column lives on the left of the middle area.
    imageSize: number;
    imageCenterX: number;
    imageCenterY: number;
    // Body text column on the right.
    bodyColumnWidth: number;
    bodyColumnCenterX: number;
    bodyColumnCenterY: number;
    bodyColumnHeight: number;
};

// Compute a panel layout that is guaranteed to contain the text AND the
// artwork plate. Image occupies a square on the left, text fills a column
// on the right. Font auto-shrinks until the body fits.
function computeLayout(theme: Theme, maxWidth: number, maxHeight: number): Layout {
    const lines = theme.infographic.body.length;
    const title = theme.infographic.title;

    const titleBandHeight = 0.7;
    const subtitleBandHeight = 0.45;
    const innerPadY = 0.18;
    const innerMarginX = 0.28;
    const lineHeight = 1.35;
    const columnGap = 0.2;

    const width = Math.min(maxWidth, 6.5);
    const bandsHeight = titleBandHeight + subtitleBandHeight + 2 * innerPadY;

    // Middle area needs to fit both a ~square image and N lines of text.
    const heightTarget = Math.min(maxHeight, 0.6 + bandsHeight + lines * 0.24);
    const height = Math.max(2.6, heightTarget);
    const middleHeight = Math.max(1.0, height - bandsHeight);

    // Image size: square, bounded by middle area height and a fraction of width.
    const imageSize = Math.min(middleHeight, width * 0.4);
    const bodyColumnWidth = width - imageSize - 2 * innerMarginX - columnGap;

    // Fit body text in the column.
    const rawBody = Math.min(0.2, middleHeight / Math.max(1, lines) / lineHeight);
    // Make sure lines also fit horizontally in the column (loose estimate).
    const avgCharW = 0.52;
    const longestLine = theme.infographic.body.reduce(
        (m, l) => Math.max(m, l.length),
        0,
    );
    const maxByWidth = bodyColumnWidth / Math.max(6, longestLine * avgCharW);
    const bodyFontSize = Math.max(0.1, Math.min(rawBody, maxByWidth));

    // Title shrink if long.
    let titleFontSize = 0.3;
    if (title.length > 18) titleFontSize = 0.24;
    if (title.length > 26) titleFontSize = 0.2;

    const titleBandY = height / 2 - titleBandHeight / 2;
    const subtitleBandY = -height / 2 + subtitleBandHeight / 2;
    const dividerYTop = height / 2 - titleBandHeight;
    const dividerYBottom = -height / 2 + subtitleBandHeight;

    const middleCenterY = (dividerYTop + dividerYBottom) / 2;

    // Image column centered on the left of the middle area.
    const imageCenterX = -width / 2 + innerMarginX + imageSize / 2;
    const imageCenterY = middleCenterY;

    // Body column on the right.
    const bodyColumnCenterX = imageCenterX + imageSize / 2 + columnGap + bodyColumnWidth / 2;
    const bodyColumnCenterY = middleCenterY;
    const bodyColumnHeight = middleHeight;

    return {
        width,
        height,
        titleFontSize,
        bodyFontSize,
        subtitleFontSize: 0.12,
        titleBandY,
        titleBandHeight,
        subtitleBandY,
        subtitleBandHeight,
        dividerYTop,
        dividerYBottom,
        innerMarginX,
        imageSize,
        imageCenterX,
        imageCenterY,
        bodyColumnWidth,
        bodyColumnCenterX,
        bodyColumnCenterY,
        bodyColumnHeight,
    };
}

export default function Infographic({
    theme,
    position,
    rotationY = 0,
    maxWidth,
    maxHeight,
}: Props) {
    const frameColor = theme.accentColor;
    const panelColor = '#0e0e12';
    const bandColor = '#16161c';
    const dividerColor = theme.accentColor;
    const titleColor = theme.accentColor;
    const bodyColor = '#e8e8ee';
    const subtitleColor = '#e8e8ee';

    const layout = useMemo(
        () => computeLayout(theme, maxWidth, maxHeight),
        [theme, maxWidth, maxHeight],
    );

    const fontUrl = fontUrlFor(theme.font);
    const align = theme.bodyAlign ?? 'center';
    const titleSpacing = theme.titleLetterSpacing ?? 0.1;

    const artworkTexture = useMemo(() => getArtworkTexture(theme), [theme]);

    return (
        <group position={position} rotation={[0, rotationY, 0]}>
            {/* Outer frame */}
            <mesh position={[0, 0, -0.025]}>
                <boxGeometry args={[layout.width + 0.2, layout.height + 0.2, 0.06]} />
                <meshStandardMaterial color={frameColor} metalness={0.5} roughness={0.35} />
            </mesh>

            {/* Main panel */}
            <mesh position={[0, 0, 0]}>
                <boxGeometry args={[layout.width, layout.height, 0.04]} />
                <meshStandardMaterial color={panelColor} metalness={0.1} roughness={0.8} />
            </mesh>

            {/* Title band (raised strip at top) */}
            <mesh position={[0, layout.titleBandY, 0.025]}>
                <boxGeometry args={[layout.width - 0.08, layout.titleBandHeight, 0.02]} />
                <meshStandardMaterial color={bandColor} metalness={0.1} roughness={0.75} />
            </mesh>

            {/* Subtitle band (raised strip at bottom) */}
            <mesh position={[0, layout.subtitleBandY, 0.025]}>
                <boxGeometry
                    args={[layout.width - 0.08, layout.subtitleBandHeight, 0.02]}
                />
                <meshStandardMaterial color={bandColor} metalness={0.1} roughness={0.75} />
            </mesh>

            {/* Thin accent dividers between bands */}
            <mesh position={[0, layout.dividerYTop, 0.04]}>
                <boxGeometry args={[layout.width - 0.2, 0.012, 0.005]} />
                <meshStandardMaterial
                    color={dividerColor}
                    emissive={dividerColor}
                    emissiveIntensity={0.55}
                />
            </mesh>
            <mesh position={[0, layout.dividerYBottom, 0.04]}>
                <boxGeometry args={[layout.width - 0.2, 0.012, 0.005]} />
                <meshStandardMaterial
                    color={dividerColor}
                    emissive={dividerColor}
                    emissiveIntensity={0.55}
                />
            </mesh>

            {/* Image plate: thin inner frame + canvas texture */}
            <mesh position={[layout.imageCenterX, layout.imageCenterY, 0.03]}>
                <boxGeometry args={[layout.imageSize + 0.06, layout.imageSize + 0.06, 0.01]} />
                <meshStandardMaterial
                    color={frameColor}
                    metalness={0.4}
                    roughness={0.4}
                />
            </mesh>
            <mesh position={[layout.imageCenterX, layout.imageCenterY, 0.045]}>
                <planeGeometry args={[layout.imageSize, layout.imageSize]} />
                <meshBasicMaterial map={artworkTexture} toneMapped={false} />
            </mesh>

            {/* Thin vertical divider between image and text */}
            <mesh
                position={[
                    layout.imageCenterX + layout.imageSize / 2 + 0.08,
                    layout.imageCenterY,
                    0.04,
                ]}
            >
                <boxGeometry args={[0.01, layout.bodyColumnHeight * 0.92, 0.005]} />
                <meshStandardMaterial
                    color={dividerColor}
                    emissive={dividerColor}
                    emissiveIntensity={0.45}
                />
            </mesh>

            {/* Text lives in its own Suspense boundary so font fetch never
                unmounts the rest of the scene. Each <Text> is individually
                clipped to its own region. */}
            <Suspense fallback={null}>
                {/* Title */}
                <Text
                    font={fontUrl}
                    position={[0, layout.titleBandY, 0.045]}
                    fontSize={layout.titleFontSize}
                    color={titleColor}
                    anchorX="center"
                    anchorY="middle"
                    maxWidth={layout.width - 0.5}
                    letterSpacing={titleSpacing}
                    outlineWidth={0.003}
                    outlineColor="#000"
                    clipRect={[
                        -(layout.width - 0.1) / 2,
                        -layout.titleBandHeight / 2,
                        (layout.width - 0.1) / 2,
                        layout.titleBandHeight / 2,
                    ]}
                >
                    {theme.infographic.title}
                </Text>

                {/* Body column */}
                <Text
                    font={fontUrl}
                    position={[layout.bodyColumnCenterX, layout.bodyColumnCenterY, 0.045]}
                    fontSize={layout.bodyFontSize}
                    color={bodyColor}
                    anchorX={align === 'left' ? 'left' : align === 'right' ? 'right' : 'center'}
                    anchorY="middle"
                    textAlign={align}
                    maxWidth={layout.bodyColumnWidth}
                    lineHeight={1.35}
                    clipRect={[
                        -layout.bodyColumnWidth / 2,
                        -layout.bodyColumnHeight / 2,
                        layout.bodyColumnWidth / 2,
                        layout.bodyColumnHeight / 2,
                    ]}
                >
                    {theme.infographic.body.join('\n')}
                </Text>

                {/* Subtitle / nameplate */}
                <Text
                    font={fontUrl}
                    position={[0, layout.subtitleBandY, 0.045]}
                    fontSize={layout.subtitleFontSize}
                    color={subtitleColor}
                    anchorX="center"
                    anchorY="middle"
                    maxWidth={layout.width - 0.5}
                    letterSpacing={0.15}
                    clipRect={[
                        -(layout.width - 0.1) / 2,
                        -layout.subtitleBandHeight / 2,
                        (layout.width - 0.1) / 2,
                        layout.subtitleBandHeight / 2,
                    ]}
                >
                    {`${theme.name.toUpperCase()} / ${theme.subtitle}`}
                </Text>
            </Suspense>

            {/* Tiny accent dots at each band corner for flavor */}
            {[-1, 1].map((sx) =>
                [-1, 1].map((sy) => (
                    <mesh
                        key={`${sx}-${sy}`}
                        position={[
                            sx * (layout.width / 2 - 0.12),
                            sy * (layout.height / 2 - 0.12),
                            0.045,
                        ]}
                    >
                        <sphereGeometry args={[0.025, 8, 6]} />
                        <meshStandardMaterial
                            color={frameColor}
                            emissive={frameColor}
                            emissiveIntensity={1.5}
                        />
                    </mesh>
                )),
            )}
        </group>
    );
}
