import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
    title: 'Liminosity',
    description:
        'A procedurally generated liminal museum. Walk its endless, impossible halls.',
};

export default function RootLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    return (
        <html lang="en">
            <body>{children}</body>
        </html>
    );
}
