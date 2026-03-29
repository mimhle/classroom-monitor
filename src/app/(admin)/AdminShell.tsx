"use client";

import React from "react";

import { useSidebar } from "@/context/SidebarContext";
import AppSidebar from "../../layout/AppSidebar";
import Backdrop from "@/layout/Backdrop";
import AppHeader from "@/layout/AppHeader";
import type { CurrentUser } from "@/libs/auth";

export default function AdminShell({
    children,
    user,
}: {
    children: React.ReactNode;
    user: CurrentUser;
}) {
    const { isExpanded, isHovered, isMobileOpen } = useSidebar();

    // Dynamic class for main content margin based on sidebar state
    const mainContentMargin = isMobileOpen
        ? "ml-0"
        : isExpanded || isHovered
            ? "lg:ml-[290px]"
            : "lg:ml-[90px]";

    return (
        <div className="min-h-screen xl:flex">
            {/* Sidebar and Backdrop */}
            <AppSidebar initialUser={user}/>
            <Backdrop/>
            {/* Main Content Area */}
            <div className={`flex-1 transition-all  duration-300 ease-in-out ${mainContentMargin}`}>
                {/* Header */}
                <AppHeader user={user}/>
                {/* Page Content */}
                <div className="p-4 mx-auto max-w-(--breakpoint-2xl) md:p-6">{children}</div>
            </div>
        </div>
    );
}
