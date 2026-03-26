import { requireRole } from "@/libs/auth";
import UsersAdmin from "@/components/admin/users/UsersAdmin";

export default async function UsersPage() {
    // Server-side guard: only Admin/Superadmin can access this route.
    await requireRole(["admin", "superadmin"], { redirectTo: "/" });

    return <UsersAdmin/>;
}
