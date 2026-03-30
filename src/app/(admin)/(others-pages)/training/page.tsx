import { requireRole } from "@/libs/auth";
import TrainingAdmin from "@/components/admin/training/TrainingAdmin";

export default async function TrainingPage() {
    // Admin-only: training creates server-side jobs and should not be available to normal users.
    await requireRole(["admin", "superadmin"], { redirectTo: "/" });

    return <TrainingAdmin/>;
}
