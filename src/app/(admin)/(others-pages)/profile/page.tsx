"use server";

import UserInfoCard from "@/components/user-profile/UserInfoCard";
import React from "react";
import { getCurrentUser, requireAuth } from "@/libs/auth";

export default async function Profile() {
    await requireAuth({ redirectTo: "/signin" });
    const user = await getCurrentUser();

    if (!user) return null;

    return (
        <div className="space-y-6">
            <UserInfoCard user={user}/>
        </div>
    );
}
