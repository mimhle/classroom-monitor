"use client";
import React, { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { usePathname, useRouter } from "next/navigation";
import { useSidebar } from "@/context/SidebarContext";
import { ChevronDownIcon, GridIcon, PlusIcon, UserCircleIcon, UserMultipleIcon, VectorNodesIcon } from "../icons/index";
import { createBranch, getBranches } from "@/libs/actions";
import { onBranchesChanged } from "@/libs/branchEvents";
import { type CurrentUser, getCurrentUser } from "@/libs/auth";
import Button from "@/components/ui/button/Button";
import { Modal } from "@/components/ui/modal";
import Label from "@/components/form/Label";
import Input from "@/components/form/input/InputField";
import { useModal } from "@/hooks/useModal";
import { useNotification } from "@/components/ui/notification";

type NavItem = {
    name: string;
    icon: React.ReactNode;
    path?: string;
    subItems?: {
        name: string;
        path?: string;
        pro?: boolean;
        new?: boolean;
        onclick?: () => void;
    }[];
};

type Branch = {
    branch_id: string;
    group_id: string;
    name: string;
    alert: any;
};

const navItemStatic: NavItem[] = [
    {
        icon: <GridIcon/>,
        name: "Dashboard",
        path: "/",
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

const LAST_BRANCH_STORAGE_KEY = "classroom-monitor:last-branch-id";

const AppSidebar: React.FC = () => {
    const [navItems, setNavItems] = useState<Branch[]>([]);
    const [currentUser, setCurrentUser] = useState<CurrentUser>(null);
    const { isExpanded, isMobileOpen, isHovered, setIsHovered } = useSidebar();
    const pathname = usePathname();
    const router = useRouter();

    const [lastBranchId, setLastBranchId] = useState<string | null>(null);

    const createBranchModal = useModal(false);
    const [branchName, setBranchName] = useState("");
    const [isCreatingBranch, setIsCreatingBranch] = useState(false);
    const [createBranchError, setCreateBranchError] = useState<string | null>(null);
    const { notify } = useNotification();

    const loadBranches = useCallback(async () => {
        const data = await getBranches();
        setNavItems(data.data);
    }, []);

    useEffect(() => {
        loadBranches().catch((error) => {
            console.error("Error fetching branches:", error);
        });
    }, [loadBranches]);

    useEffect(() => {
        return onBranchesChanged(() => {
            loadBranches().catch((error) => {
                console.error("Error refreshing branches:", error);
            });
        });
    }, [loadBranches]);

    useEffect(() => {
        getCurrentUser()
            .then((user) => setCurrentUser(user))
            .catch((e) => {
                // Sidebar shouldn't hard-fail if user info can't be loaded.
                console.error("Failed to fetch current user:", e);
                setCurrentUser(null);
            });
    }, []);

    useEffect(() => {
        // Restore previous branch selection (session scoped) so we can keep it highlighted
        // on routes that don't include the branch id (e.g. sensor detail pages).
        try {
            const stored = sessionStorage.getItem(LAST_BRANCH_STORAGE_KEY);
            if (stored) setLastBranchId(stored);
        } catch {
            // ignore (SSR/blocked storage)
        }
    }, []);

    useEffect(() => {
        // If we navigate to a branch route, remember it as the current selection.
        if (!pathname) return;
        const m = pathname.match(/^\/branches\/([^/]+)(?:\/|$)/);
        if (!m) return;

        const branchId = m[1];
        setLastBranchId(branchId);
        try {
            sessionStorage.setItem(LAST_BRANCH_STORAGE_KEY, branchId);
        } catch {
            // ignore
        }
    }, [pathname]);

    const closeCreateBranchModal = useCallback(() => {
        createBranchModal.closeModal();
        setBranchName("");
        setCreateBranchError(null);
    }, [createBranchModal]);

    const openCreateBranchModal = useCallback(() => {
        setBranchName("");
        setCreateBranchError(null);
        createBranchModal.openModal();
    }, [createBranchModal]);

    const handleCreateBranchSubmit = useCallback(
        async (e: React.FormEvent) => {
            e.preventDefault();
            const name = branchName.trim();
            if (!name) {
                setCreateBranchError("Branch name is required.");
                return;
            }

            setIsCreatingBranch(true);
            setCreateBranchError(null);
            try {
                const res = (await createBranch({ name })) as any;

                // Support typical API response shapes: { data: { branch_id } } or { branch_id }.
                const createdBranch = res?.data ?? res;
                const createdBranchId: string | undefined = createdBranch?.branch_id;

                await loadBranches();
                closeCreateBranchModal();

                notify({
                    variant: "success",
                    title: "Branch created",
                    message: `“${name}” was created successfully.`,
                });

                if (createdBranchId) {
                    router.push(`/branches/${createdBranchId}`);
                }
            } catch (err) {
                const message = err instanceof Error ? err.message : "Failed to create branch.";
                setCreateBranchError(message);
            } finally {
                setIsCreatingBranch(false);
            }
        },
        [branchName, closeCreateBranchModal, loadBranches, notify, router],
    );

    const renderMenuItems = (
        navItems: NavItem[],
        menuType: "main" | "others"
    ) => (
        <ul className="flex flex-col gap-4">
            {navItems.map((nav, index) => (
                <li key={`${nav.name}${nav.path}`}>
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
                                    ? "max-h-fit"
                                    : "max-h-0"
                            }`}
                        >
                            <ul className="mt-2 space-y-1 ml-9">
                                {nav.subItems.map((subItem) => (
                                    <li key={`${subItem.name}${subItem.path}`}>
                                        {subItem.path ? <Link
                                            href={subItem.path}
                                            className={`menu-dropdown-item ${
                                                isActive(subItem.path)
                                                    ? "menu-dropdown-item-active"
                                                    : "menu-dropdown-item-inactive"
                                            }`}
                                        >
                                            {subItem.name}
                                            <span className="flex items-center gap-1 ml-auto">
                                                {subItem.new && (<span
                                                    className={`ml-auto ${
                                                        isActive(subItem.path)
                                                            ? "menu-dropdown-badge-active"
                                                            : "menu-dropdown-badge-inactive"
                                                    } menu-dropdown-badge `}
                                                >new</span>)}
                                                {subItem.pro && (
                                                    <span
                                                        className={`ml-auto ${
                                                            isActive(subItem.path)
                                                                ? "menu-dropdown-badge-active"
                                                                : "menu-dropdown-badge-inactive"
                                                        } menu-dropdown-badge `}
                                                    >pro</span>
                                                )}
                                            </span>
                                        </Link> : <Button
                                            size={"sm"}
                                            variant={"outline"}
                                            startIcon={<PlusIcon/>}
                                            onClick={subItem.onclick}
                                            className={`w-full menu-dropdown-item cursor-pointer ${
                                                subItem.onclick
                                                    ? "menu-dropdown-item-inactive"
                                                    : "menu-dropdown-item-disabled"
                                            }`}
                                        >
                                            {subItem.name}
                                        </Button>}
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

    const isActive = useCallback(
        (path: string) => {
            // Treat nested routes as active, so /branches/123/... keeps the branch highlighted.
            if (path === "/") return pathname === "/";
            return pathname === path || pathname.startsWith(`${path}/`);
        },
        [pathname],
    );

    const staticNavItems = useMemo((): NavItem[] => {
        const role = (currentUser as any)?.role;
        const isAdmin = role === "admin";
        return navItemStatic.filter((item) => {
            if (item.path === "/users") return isAdmin;
            return true;
        });
    }, [currentUser]);

    const menuItems: NavItem[] = useMemo(() => {
        return [
            ...staticNavItems.slice(0, 1),
            {
                icon: <VectorNodesIcon/>,
                name: "Branches",
                subItems: [
                    ...navItems.map((branch) => ({
                        name: branch.name,
                        path: `/branches/${branch.branch_id}`,
                    })),
                    {
                        name: "New branch",
                        onclick: openCreateBranchModal,
                    },
                ],
            },
            ...staticNavItems.slice(1),
        ];
    }, [openCreateBranchModal, navItems, staticNavItems]);

    const keepBranchSelectionSubmenu: { type: "main" | "others"; index: number } | null = useMemo(() => {
        if (!lastBranchId) return null;

        let bestMatch: { type: "main" | "others"; index: number } | null = null;
        let bestScore = -1;
        menuItems.forEach((nav, index) => {
            nav.subItems?.forEach((subItem) => {
                if (!subItem.path) return;
                const m = subItem.path.match(/^\/branches\/([^/]+)(?:\/|$)/);
                if (!m) return;
                if (m[1] !== lastBranchId) return;

                const score = subItem.path.length;
                if (score > bestScore) {
                    bestScore = score;
                    bestMatch = { type: "main", index };
                }
            });
        });

        return bestMatch;
    }, [lastBranchId, menuItems]);

    const routeOpenSubmenu: { type: "main" | "others"; index: number } | null = useMemo(() => {
        let bestMatch: { type: "main" | "others"; index: number } | null = null;
        let bestScore = -1;

        menuItems.forEach((nav, index) => {
            nav.subItems?.forEach((subItem) => {
                if (!subItem.path) return;
                if (!isActive(subItem.path)) return;

                const score = subItem.path.length;
                if (score > bestScore) {
                    bestScore = score;
                    bestMatch = { type: "main", index };
                }
            });
        });

        return bestMatch;
    }, [isActive, menuItems]);

    const effectiveOpenSubmenu = openSubmenu ?? routeOpenSubmenu ?? keepBranchSelectionSubmenu;

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
        <>
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
                                {renderMenuItems([
                                    ...staticNavItems.slice(0, 1),
                                    {
                                        icon: <VectorNodesIcon/>,
                                        name: "Branches",
                                        subItems: [
                                            ...navItems.map((branch) => ({
                                                name: branch.name,
                                                path: `/branches/${branch.branch_id}`,
                                            })),
                                            {
                                                name: "New branch",
                                                onclick: openCreateBranchModal,
                                            },
                                        ],
                                    },
                                    ...staticNavItems.slice(1),
                                ], "main")}
                            </div>
                        </div>
                    </nav>
                </div>
            </aside>

            <Modal
                isOpen={createBranchModal.isOpen}
                onClose={closeCreateBranchModal}
                className="max-w-[584px] p-5 lg:p-8"
            >
                <form onSubmit={handleCreateBranchSubmit}>
                    <h4 className="mb-2 text-lg font-medium text-gray-800 dark:text-white/90">
                        Create branch
                    </h4>

                    <div className="grid grid-cols-1 gap-y-3">
                        <div>
                            <Label htmlFor="branch-name">Branch name</Label>
                            <Input
                                id="branch-name"
                                name="name"
                                type="text"
                                placeholder="e.g. Grade 10 - A"
                                defaultValue={branchName}
                                onChange={(e) => setBranchName(e.target.value)}
                                error={Boolean(createBranchError)}
                                hint={createBranchError ?? undefined}
                                disabled={isCreatingBranch}
                            />
                        </div>
                    </div>

                    <div className="mt-6 flex items-center justify-end gap-3">
                        <Button
                            size="sm"
                            variant="outline"
                            onClick={closeCreateBranchModal}
                            disabled={isCreatingBranch}
                        >
                            Cancel
                        </Button>
                        <Button size="sm" type="submit" disabled={isCreatingBranch}>
                            {isCreatingBranch ? "Creating..." : "Create"}
                        </Button>
                    </div>
                </form>
            </Modal>
        </>
    );
};

export default AppSidebar;

