"use server";

import AdminLayout from "@/app/(admin)/AdminLayout";
import { cookies } from 'next/headers';
import { checkAuth } from "@/libs/auth";
import { redirect } from 'next/navigation'

export default async function Layout({
    children,
}: {
    children: React.ReactNode;
}) {
    // check auth
    const cookieStore = await cookies();
    const token = cookieStore.get('token')?.value;

    if (!(await checkAuth(token || ''))) {
        redirect('/signin');
    }

    return (
        <AdminLayout>{children}</AdminLayout>
    );
}