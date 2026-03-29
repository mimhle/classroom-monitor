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
    /** Called when the player transitions between playing and not playing. */
    onPlayingChange?: (playing: boolean) => void;
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
    onPlayingChange,
    live = true,
    debug = false,
}: Props) {
    const videoRef = useRef<HTMLVideoElement | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [isPlaying, setIsPlaying] = useState(false);

    const normalizedSrc = useMemo(() => src.trim(), [src]);

    useEffect(() => {
        let cancelled = false;
        let hls: any | null = null;
        let lastUiError = "";

        const video = videoRef.current;
        if (!video) return;

        const setPlaying = (playing: boolean) => {
            if (cancelled) return;
            setIsPlaying(playing);
            onPlayingChange?.(playing);
            // If we recovered and are playing again, hide any prior error.
            if (playing) setError(null);
        };

        const onPlaying = () => setPlaying(true);
        const onPause = () => setPlaying(false);
        const onEnded = () => setPlaying(false);
        const onWaiting = () => setPlaying(false);
        const onStalled = () => setPlaying(false);

        // Detect native media element errors (rare for MSE, common for native HLS).
        const onNativeError = () => {
            const mediaError = video.error;
            const code = mediaError?.code;
            const msg = code ? `Playback error (code ${code}).` : "Playback error.";
            // Report but let UI decide if it should be shown (we suppress while playing).
            setError(msg);
            onErrorAction?.(msg);
        };

        video.addEventListener("playing", onPlaying);
        video.addEventListener("pause", onPause);
        video.addEventListener("ended", onEnded);
        video.addEventListener("waiting", onWaiting);
        video.addEventListener("stalled", onStalled);
        video.addEventListener("error", onNativeError);

        // Some video attributes aren't in React's typed props; set them directly.
        video.disableRemotePlayback = true;

        // Reset element state when src changes to avoid MediaSource leftovers.
        try {
            video.pause();
            video.removeAttribute("src");
            video.load();
        } catch {
            // ignore
        }

        setPlaying(false);
        setError(null);

        const reportError = (msg: string) => {
            if (cancelled) return;
            // If the video is currently playing, don't surface errors (live streams can be noisy).
            if (videoRef.current && !videoRef.current.paused && !videoRef.current.ended) return;

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

                // Note: lowLatencyMode is great for LL-HLS, but can be harsher on flaky networks.
                // We keep it enabled, but the buffer/live-sync settings below are tuned to reduce stalls.
                const config: Record<string, unknown> = {
                    enableWorker: true,
                    lowLatencyMode: false,

                    // Recoverability
                    fragLoadingTimeOut: 20000,
                    fragLoadingMaxRetry: 6,
                    fragLoadingRetryDelay: 1000,
                    fragLoadingMaxRetryTimeout: 10000,
                    manifestLoadingTimeOut: 20000,
                    manifestLoadingMaxRetry: 5,
                    manifestLoadingRetryDelay: 1000,
                    manifestLoadingMaxRetryTimeout: 10000,

                    // Live streams can run forever; cap buffers to avoid memory bloat and decoding issues.
                    backBufferLength: live ? 20 : undefined, // seconds kept behind currentTime
                    maxBufferLength: live ? 20 : 60, // forward buffer target (seconds)
                    maxMaxBufferLength: live ? 40 : 120,

                    // Stay close to live edge.
                    liveSyncDurationCount: live ? 2 : undefined,
                    liveMaxLatencyDurationCount: live ? 6 : undefined,
                    maxLiveSyncPlaybackRate: live ? 1.4 : undefined,

                    // When drifting, let hls.js nudge playback rate rather than letting us fall behind.
                    // (kept small to avoid 'chipmunk' audio)
                    // If your stream has no audio, this is still fine.
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

                // Stall recovery state (bounded) to avoid infinite loops.
                let stallRecoveries = 0;
                let lastStallRecoveryAt = 0;

                const seekToLiveEdgeIfNeeded = (reason?: string) => {
                    if (!live) return false;
                    const v = videoRef.current;
                    if (!v) return false;

                    // Prefer hls.js live sync position when available.
                    const liveSyncPos = typeof hls?.liveSyncPosition === "number" ? hls.liveSyncPosition : undefined;

                    // Fallback to buffered end.
                    const b = v.buffered;
                    const bufferedEnd = b && b.length ? b.end(b.length - 1) : undefined;

                    const target = liveSyncPos ?? (bufferedEnd !== undefined ? Math.max(0, bufferedEnd - 1) : undefined);
                    if (target === undefined || Number.isNaN(target)) return false;

                    // If we're too far behind the target, hop closer.
                    const distance = target - v.currentTime;
                    if (distance > 8) {
                        try {
                            const from = v.currentTime;
                            v.currentTime = Math.max(0, target);
                            log("seekToLiveEdge", {
                                reason,
                                from,
                                to: v.currentTime,
                                target,
                                liveSyncPos,
                                bufferedEnd,
                                distance
                            });
                            return true;
                        } catch {
                            // ignore
                        }
                    }
                    return false;
                };

                const tryRecoverFromStall = (reason: string) => {
                    if (cancelled) return;
                    const now = Date.now();

                    // Basic backoff (avoid aggressive loops on very bad connections).
                    if (now - lastStallRecoveryAt < 1500) return;
                    lastStallRecoveryAt = now;

                    stallRecoveries += 1;
                    log("stall recovery", { reason, stallRecoveries });

                    // 1) Seek nearer live edge (usually fixes BUFFER_STALLED when we fell behind).
                    const didSeek = seekToLiveEdgeIfNeeded(reason);

                    // 2) Kick loader if it stopped.
                    try {
                        hls?.startLoad();
                    } catch {
                        // ignore
                    }

                    // 3) Ensure playback continues.
                    const v = videoRef.current;
                    if (v && autoPlay) {
                        void v.play().catch(() => {
                            // ignore autoplay blocking
                        });
                    }

                    // 4) If repeated stalls, try media error recovery once in a while.
                    if (stallRecoveries === 3 || (stallRecoveries > 3 && stallRecoveries % 3 === 0)) {
                        try {
                            hls?.recoverMediaError?.();
                            log("stall recovery: recoverMediaError");
                        } catch {
                            // ignore
                        }
                    }

                    // 5) If we can't unstick after several attempts, restart the load pipeline.
                    if (!didSeek && stallRecoveries >= 8) {
                        log("stall recovery: reload pipeline");
                        try {
                            hls?.stopLoad();
                        } catch {
                            // ignore
                        }
                        setTimeout(() => {
                            if (cancelled) return;
                            try {
                                hls?.startLoad(-1);
                            } catch {
                                // ignore
                            }
                            seekToLiveEdgeIfNeeded("reload pipeline");
                        }, 500);
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

                    // reset stall state on successful parse
                    stallRecoveries = 0;

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
                    seekToLiveEdgeIfNeeded("level updated");
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
                        if (
                            details === Hls.ErrorDetails.BUFFER_STALLED_ERROR ||
                            details === Hls.ErrorDetails.BUFFER_NUDGE_ON_STALL
                        ) {
                            tryRecoverFromStall(details);
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
                                seekToLiveEdgeIfNeeded("media error");
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
                    tryRecoverFromStall("video stalled");
                };
                const onWaiting = () => {
                    log("video waiting");
                    tryRecoverFromStall("video waiting");
                };
                const onPause = () => {
                    if (!live) return;
                    // Some browsers pause silently after long runs; make a best-effort to resume.
                    const v = videoRef.current;
                    if (!v) return;
                    if (autoPlay && !v.ended) {
                        void v.play().catch(() => {
                            // ignore
                        });
                    }
                };

                if (vEl) {
                    vEl.addEventListener("stalled", onStalled);
                    vEl.addEventListener("waiting", onWaiting);
                    vEl.addEventListener("pause", onPause);
                }

                return () => {
                    if (vEl) {
                        vEl.removeEventListener("stalled", onStalled);
                        vEl.removeEventListener("waiting", onWaiting);
                        vEl.removeEventListener("pause", onPause);
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
                video.removeEventListener("playing", onPlaying);
                video.removeEventListener("pause", onPause);
                video.removeEventListener("ended", onEnded);
                video.removeEventListener("waiting", onWaiting);
                video.removeEventListener("stalled", onStalled);
                video.removeEventListener("error", onNativeError);
            } catch {
                // ignore
            }
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
    }, [normalizedSrc, onErrorAction, onPlayingChange, autoPlay, live, debug]);

    return (
        <div className={className}>
            <video
                ref={videoRef}
                controls={controls}
                autoPlay={autoPlay}
                muted={muted}
                playsInline={playsInline}
                poster={poster}
                preload={live ? "auto" : "metadata"}
                className="h-full object-contain"
            />

            {error && !isPlaying ? <div className="mt-2 text-sm text-red-600 w-fit">{error}</div> : null}
        </div>
    );
}
