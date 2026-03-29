import { requireRole } from "@/libs/auth";
import GroupsAdmin from "@/components/admin/groups/GroupsAdmin";

export default async function GroupsPage() {
    // Server-side guard: only Superadmin can access this route.
    await requireRole(["superadmin"], { redirectTo: "/" });

    return <GroupsAdmin/>;
}
