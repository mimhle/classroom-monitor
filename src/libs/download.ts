"use client";

/**
 * Trigger a browser download for a Blob.
 *
 * Notes:
 * - We revoke the object URL after click to avoid leaks.
 * - Filename is sanitized for Windows as well.
 */
export function downloadBlob(blob: Blob, filename: string) {
    const safeName = sanitizeFilename(filename || "download");

    const url = URL.createObjectURL(blob);
    try {
        const a = document.createElement("a");
        a.href = url;
        a.download = safeName;
        a.rel = "noopener";
        a.style.display = "none";
        document.body.appendChild(a);
        a.click();
        a.remove();
    } finally {
        // Let the click start before revoking.
        setTimeout(() => URL.revokeObjectURL(url), 0);
    }
}

export function sanitizeFilename(name: string) {
    // Windows reserved chars: < > : " / \ | ? *
    // Also trim and collapse whitespace.
    return name
        .replace(/[<>:"/\\|?*]+/g, "-")
        .replace(/\s+/g, " ")
        .trim();
}
