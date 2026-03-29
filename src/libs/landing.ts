import type { CurrentUser } from "@/libs/auth";
import { isSuperadmin } from "@/libs/roles";

/**
 * Returns the default landing path after login.
 * Superadmins should land on Groups management.
 */
export function getDefaultLandingPath(user: CurrentUser): string {
    if (isSuperadmin(user)) return "/groups";
    return "/";
}
