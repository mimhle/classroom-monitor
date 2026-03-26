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
    /**
     * If true, optimize for long-running live/infinite streams (buffer caps + stay near live edge).
     * Defaults to true.
     */
    live?: boolean;
    /** Enable console logging of hls.js events (useful for debugging live streams). */
    debug?: boolean;
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
    live = true,
    debug = false,
}: Props) {
    const videoRef = useRef<HTMLVideoElement | null>(null);
    const [error, setError] = useState<string | null>(null);

    const normalizedSrc = useMemo(() => src.trim(), [src]);

    useEffect(() => {
        let cancelled = false;
        let hls: any | null = null;
        let lastUiError = "";

        const video = videoRef.current;
        if (!video) return;

        // Reset element state when src changes to avoid MediaSource leftovers.
        try {
            video.pause();
            // Clearing src helps some browsers release old MSE buffers.
            video.removeAttribute("src");
            video.load();
        } catch {
            // ignore
        }

        setError(null);

        const reportError = (msg: string) => {
            if (cancelled) return;
            // avoid spamming the UI on noisy live streams
            if (msg && msg !== lastUiError) {
                lastUiError = msg;
                setError(msg);
                onErrorAction?.(msg);
            }
        };

        if (!normalizedSrc) {
            reportError("Missing stream URL.");
            return;
        }

        // Native HLS (Safari/iOS)
        if (video.canPlayType("application/vnd.apple.mpegurl")) {
            video.src = normalizedSrc;
            // Some browsers require an explicit play() call.
            if (autoPlay) {
                void video.play().catch(() => {
                    // ignore autoplay blocking
                });
            }
            return;
        }

        async function setupHls() {
            try {
                const mod = await import("hls.js");
                if (cancelled) return;

                const Hls = mod.default;

                if (!Hls.isSupported()) {
                    reportError("HLS playback is not supported in this browser.");
                    return;
                }

                const config: Record<string, unknown> = {
                    enableWorker: true,
                    lowLatencyMode: true,
                    // Live streams can run forever; cap buffers to avoid memory bloat and decoding issues.
                    backBufferLength: live ? 30 : undefined, // seconds kept behind currentTime
                    maxBufferLength: live ? 30 : 60, // forward buffer target (seconds)
                    maxMaxBufferLength: live ? 60 : 120,
                    // Stay close to live edge.
                    liveSyncDurationCount: live ? 2 : undefined,
                    liveMaxLatencyDurationCount: live ? 6 : undefined,
                    maxLiveSyncPlaybackRate: live ? 1.5 : undefined,
                };

                // Drop undefined values (hls.js doesn't love unknown/undefined keys).
                Object.keys(config).forEach((k) => config[k] === undefined && delete config[k]);

                hls = new Hls(config);

                const log = (...args: any[]) => {
                    if (!debug) return;
                    // eslint-disable-next-line no-console
                    console.log("[HlsPlayer]", ...args);
                };

                let networkErrorRetries = 0;
                let mediaErrorRetries = 0;

                const seekToLiveEdgeIfNeeded = () => {
                    if (!live) return;
                    const v = videoRef.current;
                    if (!v) return;
                    const b = v.buffered;
                    if (!b || b.length === 0) return;
                    const end = b.end(b.length - 1);
                    // If we drift far from the live edge (or buffer becomes huge), hop closer.
                    const distance = end - v.currentTime;
                    if (distance > 20) {
                        try {
                            v.currentTime = Math.max(0, end - 2);
                            log("seekToLiveEdge", { end, from: v.currentTime, distance });
                        } catch {
                            // ignore
                        }
                    }
                };

                hls.on(Hls.Events.MEDIA_ATTACHED, () => {
                    log("MEDIA_ATTACHED");
                });

                hls.on(Hls.Events.MANIFEST_PARSED, (_evt: unknown, data: any) => {
                    log("MANIFEST_PARSED", {
                        levels: data?.levels?.length,
                        live: data?.levelDetails?.live,
                    });

                    if (autoPlay) {
                        const v = videoRef.current;
                        if (v) {
                            void v.play().catch(() => {
                                // ignore autoplay blocking
                            });
                        }
                    }
                });

                hls.on(Hls.Events.LEVEL_UPDATED, () => {
                    // Periodic nudge to avoid falling behind on truly infinite streams.
                    seekToLiveEdgeIfNeeded();
                });

                hls.on(Hls.Events.ERROR, (_event: unknown, data: any) => {
                    if (cancelled) return;
                    if (!data) return;

                    const httpCode = data?.response?.code;
                    const details = data?.details ? String(data.details) : "";
                    const type = data?.type ? String(data.type) : "";
                    const fatal = Boolean(data?.fatal);

                    const msg = details
                        ? `Stream error: ${details}${httpCode ? ` (HTTP ${httpCode})` : ""}${fatal ? " (fatal)" : ""}`
                        : type
                            ? `Stream error: ${type}${httpCode ? ` (HTTP ${httpCode})` : ""}${fatal ? " (fatal)" : ""}`
                            : "Stream error.";

                    log("ERROR", { type, details, fatal, httpCode, data });
                    reportError(msg);

                    if (!fatal) {
                        // Non-fatal errors are common on live streams; try to keep going.
                        if (details === Hls.ErrorDetails.BUFFER_STALLED_ERROR) {
                            seekToLiveEdgeIfNeeded();
                        }
                        return;
                    }

                    // Try to recover from some fatal errors with bounded retries.
                    switch (data?.type) {
                        case Hls.ErrorTypes.NETWORK_ERROR: {
                            networkErrorRetries += 1;
                            if (networkErrorRetries <= 5) {
                                const delayMs = Math.min(2000 * networkErrorRetries, 10000);
                                log("NETWORK_ERROR: retry", { networkErrorRetries, delayMs });
                                setTimeout(() => {
                                    if (cancelled) return;
                                    try {
                                        hls?.startLoad();
                                    } catch {
                                        // ignore
                                    }
                                }, delayMs);
                            } else {
                                log("NETWORK_ERROR: giving up");
                                try {
                                    hls?.destroy();
                                } catch {
                                    // ignore
                                }
                                hls = null;
                            }
                            break;
                        }
                        case Hls.ErrorTypes.MEDIA_ERROR: {
                            mediaErrorRetries += 1;
                            if (mediaErrorRetries <= 3) {
                                log("MEDIA_ERROR: recover", { mediaErrorRetries });
                                try {
                                    hls?.recoverMediaError();
                                } catch {
                                    // ignore
                                }
                                // If we recovered, also nudge back to live edge.
                                seekToLiveEdgeIfNeeded();
                            } else {
                                log("MEDIA_ERROR: giving up");
                                try {
                                    hls?.destroy();
                                } catch {
                                    // ignore
                                }
                                hls = null;
                            }
                            break;
                        }
                        default: {
                            log("FATAL: destroy");
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

                // Helpful for long-running live streams where the video may end up paused.
                const vEl = videoRef.current;
                const onStalled = () => {
                    log("video stalled");
                    seekToLiveEdgeIfNeeded();
                };
                const onWaiting = () => {
                    log("video waiting");
                    seekToLiveEdgeIfNeeded();
                };
                if (vEl) {
                    vEl.addEventListener("stalled", onStalled);
                    vEl.addEventListener("waiting", onWaiting);
                }

                return () => {
                    if (vEl) {
                        vEl.removeEventListener("stalled", onStalled);
                        vEl.removeEventListener("waiting", onWaiting);
                    }
                };
            } catch (e) {
                const msg = e instanceof Error ? e.message : "Failed to initialize HLS player.";
                reportError(msg);
            }
        }

        let removeVideoListeners: (() => void) | undefined;
        setupHls().then((cleanup) => {
            removeVideoListeners = cleanup;
        });

        return () => {
            cancelled = true;
            try {
                removeVideoListeners?.();
            } catch {
                // ignore
            }
            try {
                hls?.destroy();
            } catch {
                // ignore
            }
        };
    }, [normalizedSrc, onErrorAction, autoPlay, live, debug]);

    return (
        <div className={className}>
            <video
                ref={videoRef}
                controls={controls}
                autoPlay={autoPlay}
                muted={muted}
                playsInline={playsInline}
                poster={poster}
                className="h-full object-contain"
            />

            {error ? <div className="mt-2 text-sm text-red-600 w-fit">{error}</div> : null}
        </div>
    );
}
