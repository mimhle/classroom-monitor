"use server";

import AdminLayout from "@/app/(admin)/AdminLayout";
import { checkAuth, getCurrentUser } from "@/libs/auth";
import { redirect } from "next/navigation"

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
        <AdminLayout user={user}>{children}</AdminLayout>
    );
}