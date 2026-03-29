import { redirect } from "next/navigation";

import { getCurrentUser } from "@/libs/auth";
import { isSuperadmin } from "@/libs/roles";

import DashboardClient from "@/app/(admin)/DashboardClient";

export default async function Page() {
    const user = await getCurrentUser();
    if (isSuperadmin(user)) {
        redirect("/groups");
    }

    return <DashboardClient/>;
}
