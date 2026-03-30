import { requireRole } from "@/libs/auth";
import LogsAdmin from "@/components/admin/logs/LogsAdmin";

export default async function LogsPage() {
    // Server-side guard: only Admin/Superadmin can access this route.
    await requireRole(["admin", "superadmin"], { redirectTo: "/" });

    return <LogsAdmin/>;
}
