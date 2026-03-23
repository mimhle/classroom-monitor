export const BRANCHES_CHANGED_EVENT = "classroom-monitor:branches-changed" as const;

/**
 * Emit an app-wide signal that the branches list changed (create/update/delete).
 *
 * This is intentionally implemented as a browser CustomEvent to avoid introducing
 * global state libraries; listeners (e.g. AppSidebar) can re-fetch.
 */
export function emitBranchesChanged() {
    if (typeof window === "undefined") return;
    window.dispatchEvent(new CustomEvent(BRANCHES_CHANGED_EVENT));
}

export function onBranchesChanged(handler: () => void) {
    if (typeof window === "undefined") return () => {
    };

    const listener: EventListener = () => handler();
    window.addEventListener(BRANCHES_CHANGED_EVENT, listener);

    return () => {
        window.removeEventListener(BRANCHES_CHANGED_EVENT, listener);
    };
}
