"use server";

import AdminShell from "@/app/(admin)/AdminShell";
import { checkAuth, getCurrentUser } from "@/libs/auth";
import { redirect } from "next/navigation";

export default async function Layout({
    children,
}: {
    children: React.ReactNode;
}) {
    if (!(await checkAuth())) {
        redirect("/signin");
    }

    const user = await getCurrentUser();

    return (
        <AdminShell user={user}>{children}</AdminShell>
    );
}