"use client";
import React, { useCallback, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { useSidebar } from "@/context/SidebarContext";
import { ChevronDownIcon, GridIcon, UserCircleIcon, UserMultipleIcon, VectorNodesIcon } from "../icons/index";

type NavItem = {
    name: string;
    icon: React.ReactNode;
    path?: string;
    subItems?: { name: string; path: string; pro?: boolean; new?: boolean }[];
};

const navItems: NavItem[] = [
    {
        icon: <GridIcon/>,
        name: "Dashboard",
        path: "/",
    },
    {
        icon: <VectorNodesIcon/>,
        name: "Branches",
        subItems: [
            { name: "Branch 1", path: "/branches/1" },
            { name: "Branch 2", path: "/branches/2" },
        ],
    },
    {
        icon: <UserMultipleIcon/>,
        name: "Manage users",
        path: "/users",
    },
    {
        icon: <UserCircleIcon/>,
        name: "User Profile",
        path: "/profile",
    },
];

const AppSidebar: React.FC = () => {
    const { isExpanded, isMobileOpen, isHovered, setIsHovered } = useSidebar();
    const pathname = usePathname();

    const renderMenuItems = (
        navItems: NavItem[],
        menuType: "main" | "others"
    ) => (
        <ul className="flex flex-col gap-4">
            {navItems.map((nav, index) => (
                <li key={nav.name}>
                    {nav.subItems ? (
                        <button
                            onClick={() => handleSubmenuToggle(index, menuType)}
                            className={`menu-item group  ${
                                effectiveOpenSubmenu?.type === menuType && effectiveOpenSubmenu?.index === index
                                    ? "menu-item-active"
                                    : "menu-item-inactive"
                            } cursor-pointer ${
                                !isExpanded && !isHovered
                                    ? "lg:justify-center"
                                    : "lg:justify-start"
                            }`}
                        >
              <span
                  className={` ${
                      effectiveOpenSubmenu?.type === menuType && effectiveOpenSubmenu?.index === index
                          ? "menu-item-icon-active"
                          : "menu-item-icon-inactive"
                  }`}
              >
                {nav.icon}
              </span>
                            {(isExpanded || isHovered || isMobileOpen) && (
                                <span className={`menu-item-text`}>{nav.name}</span>
                            )}
                            {(isExpanded || isHovered || isMobileOpen) && (
                                <ChevronDownIcon
                                    className={`ml-auto w-5 h-5 transition-transform duration-200  ${
                                        effectiveOpenSubmenu?.type === menuType &&
                                        effectiveOpenSubmenu?.index === index
                                            ? "rotate-180 text-brand-500"
                                            : ""
                                    }`}
                                />
                            )}
                        </button>
                    ) : (
                        nav.path && (
                            <Link
                                href={nav.path}
                                className={`menu-item group ${
                                    isActive(nav.path) ? "menu-item-active" : "menu-item-inactive"
                                }`}
                            >
                <span
                    className={`${
                        isActive(nav.path)
                            ? "menu-item-icon-active"
                            : "menu-item-icon-inactive"
                    }`}
                >
                  {nav.icon}
                </span>
                                {(isExpanded || isHovered || isMobileOpen) && (
                                    <span className={`menu-item-text`}>{nav.name}</span>
                                )}
                            </Link>
                        )
                    )}
                    {nav.subItems && (isExpanded || isHovered || isMobileOpen) && (
                        <div
                            className={`overflow-hidden transition-all duration-300 ${
                                effectiveOpenSubmenu?.type === menuType && effectiveOpenSubmenu?.index === index
                                    ? "max-h-96"
                                    : "max-h-0"
                            }`}
                        >
                            <ul className="mt-2 space-y-1 ml-9">
                                {nav.subItems.map((subItem) => (
                                    <li key={subItem.name}>
                                        <Link
                                            href={subItem.path}
                                            className={`menu-dropdown-item ${
                                                isActive(subItem.path)
                                                    ? "menu-dropdown-item-active"
                                                    : "menu-dropdown-item-inactive"
                                            }`}
                                        >
                                            {subItem.name}
                                            <span className="flex items-center gap-1 ml-auto">
                        {subItem.new && (
                            <span
                                className={`ml-auto ${
                                    isActive(subItem.path)
                                        ? "menu-dropdown-badge-active"
                                        : "menu-dropdown-badge-inactive"
                                } menu-dropdown-badge `}
                            >
                            new
                          </span>
                        )}
                                                {subItem.pro && (
                                                    <span
                                                        className={`ml-auto ${
                                                            isActive(subItem.path)
                                                                ? "menu-dropdown-badge-active"
                                                                : "menu-dropdown-badge-inactive"
                                                        } menu-dropdown-badge `}
                                                    >
                            pro
                          </span>
                                                )}
                      </span>
                                        </Link>
                                    </li>
                                ))}
                            </ul>
                        </div>
                    )}
                </li>
            ))}
        </ul>
    );

    const [openSubmenu, setOpenSubmenu] = useState<{
        type: "main" | "others";
        index: number;
    } | null>(null);

    // const isActive = (path: string) => path === pathname;
    const isActive = useCallback((path: string) => path === pathname, [pathname]);

    // Derive the submenu that should be open for the current route (no memoization needed).
    let routeOpenSubmenu: { type: "main" | "others"; index: number } | null = null;
    navItems.forEach((nav, index) => {
        if (nav.subItems) {
            nav.subItems.forEach((subItem) => {
                if (pathname === subItem.path) {
                    routeOpenSubmenu = { type: "main", index };
                }
            });
        }
    });

    const effectiveOpenSubmenu = openSubmenu ?? routeOpenSubmenu;

    const handleSubmenuToggle = (index: number, menuType: "main" | "others") => {
        setOpenSubmenu((prevOpenSubmenu) => {
            if (
                prevOpenSubmenu &&
                prevOpenSubmenu.type === menuType &&
                prevOpenSubmenu.index === index
            ) {
                return null;
            }
            return { type: menuType, index };
        });
    };

    return (
        <aside
            className={`fixed mt-16 flex flex-col lg:mt-0 top-0 px-5 left-0 bg-white dark:bg-gray-900 dark:border-gray-800 text-gray-900 h-screen transition-all duration-300 ease-in-out z-50 border-r border-gray-200 
        ${
                isExpanded || isMobileOpen
                    ? "w-[290px]"
                    : isHovered
                        ? "w-[290px]"
                        : "w-[90px]"
            }
        ${isMobileOpen ? "translate-x-0" : "-translate-x-full"}
        lg:translate-x-0`}
            onMouseEnter={() => !isExpanded && setIsHovered(true)}
            onMouseLeave={() => setIsHovered(false)}
        >
            <div
                className={`py-8 flex  ${
                    !isExpanded && !isHovered ? "lg:justify-center" : "justify-start"
                }`}
            >
                <Link href="/" className="w-full">
                    {isExpanded || isHovered || isMobileOpen ? (
                        <div className="flex flex-row justify-center w-full">
                            <Image
                                className="dark:hidden"
                                src="/images/logo/logo.png"
                                alt="Logo"
                                width={130}
                                height={40}
                            />
                            <Image
                                className="hidden dark:block"
                                src="/images/logo/logo.png"
                                alt="Logo"
                                width={130}
                                height={40}
                            />
                        </div>
                    ) : (
                        <div className="flex flex-row justify-center w-full">
                            <Image
                                src="/images/logo/logo.png"
                                alt="Logo"
                                width={32}
                                height={32}
                            />
                        </div>
                    )}
                </Link>
            </div>
            <div className="flex flex-col overflow-y-auto duration-300 ease-linear no-scrollbar">
                <nav className="mb-6">
                    <div className="flex flex-col gap-4">
                        <div>
                            {renderMenuItems(navItems, "main")}
                        </div>
                    </div>
                </nav>
            </div>
        </aside>
    );
};

export default AppSidebar;
