"use client";

import { useEffect, useMemo, useRef, useState } from "react";

type Props = {
    src: string;
    className?: string;
    controls?: boolean;
    autoPlay?: boolean;
    muted?: boolean;
    playsInline?: boolean;
    poster?: string;
    onErrorAction?: (message: string) => void;
};

export default function HlsPlayer({
    src,
    className,
    controls = true,
    autoPlay = true,
    muted = true,
    playsInline = true,
    poster,
    onErrorAction,
}: Props) {
    const videoRef = useRef<HTMLVideoElement | null>(null);
    const [error, setError] = useState<string | null>(null);

    const normalizedSrc = useMemo(() => src.trim(), [src]);

    useEffect(() => {
        let cancelled = false;
        let hls: any | null = null;

        const video = videoRef.current;
        if (!video) return;

        setError(null);

        if (!normalizedSrc) {
            const msg = "Missing stream URL.";
            setError(msg);
            onErrorAction?.(msg);
            return;
        }

        // Native HLS (Safari/iOS)
        if (video.canPlayType("application/vnd.apple.mpegurl")) {
            video.src = normalizedSrc;
            return;
        }

        async function setupHls() {
            try {
                const mod = await import("hls.js");
                if (cancelled) return;

                const Hls = mod.default;

                if (!Hls.isSupported()) {
                    const msg = "HLS playback is not supported in this browser.";
                    setError(msg);
                    onErrorAction?.(msg);
                    return;
                }

                hls = new Hls({
                    enableWorker: true,
                    lowLatencyMode: true,
                });

                hls.on(Hls.Events.ERROR, (_event: unknown, data: any) => {
                    if (cancelled) return;
                    if (!data) return;

                    // Surface a helpful message; keep it short.
                    const msg = data?.details
                        ? `Stream error: ${String(data.details)}`
                        : data?.type
                            ? `Stream error: ${String(data.type)}`
                            : "Stream error.";

                    setError(msg);
                    onErrorAction?.(msg);

                    // Try to recover from some fatal errors.
                    if (data?.fatal) {
                        switch (data?.type) {
                            case Hls.ErrorTypes.NETWORK_ERROR:
                                try {
                                    hls?.startLoad();
                                } catch {
                                    // ignore
                                }
                                break;
                            case Hls.ErrorTypes.MEDIA_ERROR:
                                try {
                                    hls?.recoverMediaError();
                                } catch {
                                    // ignore
                                }
                                break;
                            default:
                                try {
                                    hls?.destroy();
                                } catch {
                                    // ignore
                                }
                                hls = null;
                        }
                    }
                });

                hls.loadSource(normalizedSrc);
                hls.attachMedia(video);
            } catch (e) {
                const msg = e instanceof Error ? e.message : "Failed to initialize HLS player.";
                setError(msg);
                onErrorAction?.(msg);
            }
        }

        setupHls();

        return () => {
            cancelled = true;
            try {
                hls?.destroy();
            } catch {
                // ignore
            }
        };
    }, [normalizedSrc, onErrorAction]);

    return (
        <div className={className}>
            <video
                ref={videoRef}
                controls={controls}
                autoPlay={autoPlay}
                muted={muted}
                playsInline={playsInline}
                poster={poster}
                style={{ width: "100%", height: "auto" }}
            />

            {error ? (
                <div className="mt-2 text-sm text-red-600">{error}</div>
            ) : null}
        </div>
    );
}
