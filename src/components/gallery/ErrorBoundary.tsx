'use client';

import React from 'react';

type Props = {
    children: React.ReactNode;
    onError?: (err: Error, info: React.ErrorInfo) => void;
};

type State = {
    error: Error | null;
};

export default class GalleryErrorBoundary extends React.Component<Props, State> {
    state: State = { error: null };

    static getDerivedStateFromError(error: Error): State {
        return { error };
    }

    componentDidCatch(error: Error, info: React.ErrorInfo) {
        console.error('[Liminosity] scene crashed:', error, info);
        this.props.onError?.(error, info);
    }

    render() {
        if (this.state.error) {
            return (
                <div
                    style={{
                        position: 'fixed',
                        inset: 0,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        background: 'rgba(6,6,10,0.9)',
                        color: '#ff8080',
                        fontFamily: 'var(--font-mono), monospace',
                        zIndex: 100,
                        padding: 40,
                    }}
                >
                    <div style={{ maxWidth: 720, lineHeight: 1.6 }}>
                        <div style={{ fontSize: 11, letterSpacing: 4, opacity: 0.6 }}>
                            SCENE ERROR
                        </div>
                        <div style={{ fontSize: 22, margin: '8px 0 16px 0', color: '#fff' }}>
                            {this.state.error.message}
                        </div>
                        <pre
                            style={{
                                fontSize: 11,
                                opacity: 0.7,
                                whiteSpace: 'pre-wrap',
                                wordBreak: 'break-word',
                                maxHeight: 360,
                                overflow: 'auto',
                            }}
                        >
                            {this.state.error.stack ?? '(no stack)'}
                        </pre>
                    </div>
                </div>
            );
        }
        return this.props.children;
    }
}
