'use client';

import dynamic from 'next/dynamic';

const GalleryExperience = dynamic(
    () => import('@/components/gallery/GalleryExperience'),
    { ssr: false },
);

export default function LiminosityPage() {
    return <GalleryExperience />;
}
