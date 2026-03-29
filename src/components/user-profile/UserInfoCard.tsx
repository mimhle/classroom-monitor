"use client";
import React, { useCallback, useMemo, useState } from "react";
import { useModal } from "@/hooks/useModal";
import { Modal } from "../ui/modal";
import Button from "../ui/button/Button";
import Input from "../form/input/InputField";
import Label from "../form/Label";
import { KeyIcon, PencilIcon } from "@/icons";
import { useNotification } from "@/components/ui/notification";
import { updateUser } from "@/libs/actions";

export default function UserInfoCard({ user }: { user: any }) {
    const { notify } = useNotification();

    const {
        isOpen: isOpenInformation,
        openModal: openModalInformation,
        closeModal: closeModalInformation,
    } = useModal();
    const { isOpen: isOpenPassword, openModal: openModalPassword, closeModal: closeModalPassword } = useModal();

    const userId = useMemo(() => {
        return (user as any)?.user_id ?? (user as any)?.id;
    }, [user]);

    const [infoDraft, setInfoDraft] = useState({
        username: (user as any)?.username ?? "",
    });

    const [infoSaving, setInfoSaving] = useState(false);

    const syncDraftFromUser = useCallback(() => {
        setInfoDraft({
            username: (user as any)?.username ?? "",
        });
    }, [user]);

    const openInfo = useCallback(() => {
        syncDraftFromUser();
        openModalInformation();
    }, [openModalInformation, syncDraftFromUser]);

    const handleSaveInfo = useCallback(
        async (e?: React.FormEvent) => {
            e?.preventDefault();
            if (!userId) {
                notify({ variant: "error", title: "Can't update profile", message: "Missing user id." });
                return;
            }
            if (!infoDraft.username?.trim()) {
                notify({ variant: "error", title: "Validation error", message: "Username is required." });
                return;
            }

            setInfoSaving(true);
            try {
                await updateUser(String(userId), {
                    username: infoDraft.username.trim(),
                } as any);

                notify({
                    variant: "success",
                    title: "Profile updated",
                    message: "Your profile was updated successfully."
                });
                closeModalInformation();
            } catch (err: any) {
                const message = err?.message ?? "Failed to update profile";
                notify({ variant: "error", title: "Update failed", message });
            } finally {
                setInfoSaving(false);
            }
        },
        [closeModalInformation, infoDraft.username, notify, userId],
    );

    const [pwdDraft, setPwdDraft] = useState({ currentPassword: "", newPassword: "", confirmPassword: "" });
    const [pwdSaving, setPwdSaving] = useState(false);

    const openPwd = useCallback(() => {
        setPwdDraft({ currentPassword: "", newPassword: "", confirmPassword: "" });
        openModalPassword();
    }, [openModalPassword]);

    const handleSavePassword = useCallback(
        async (e?: React.FormEvent) => {
            e?.preventDefault();
            if (!userId) {
                notify({ variant: "error", title: "Can't update password", message: "Missing user id." });
                return;
            }
            if (!pwdDraft.newPassword.trim()) {
                notify({ variant: "error", title: "Validation error", message: "New password is required." });
                return;
            }
            if (pwdDraft.newPassword !== pwdDraft.confirmPassword) {
                notify({ variant: "error", title: "Validation error", message: "Passwords do not match." });
                return;
            }

            setPwdSaving(true);
            try {
                // Many backends only require the new password for an update.
                // If the backend requires currentPassword, it can be added server-side later.
                await updateUser(String(userId), { password: pwdDraft.newPassword } as any);
                notify({
                    variant: "success",
                    title: "Password updated",
                    message: "Your password was updated successfully."
                });
                closeModalPassword();
            } catch (err: any) {
                const message = err?.message ?? "Failed to update password";
                notify({ variant: "error", title: "Update failed", message });
            } finally {
                setPwdSaving(false);
            }
        },
        [closeModalPassword, notify, pwdDraft.confirmPassword, pwdDraft.newPassword, userId],
    );

    return (
        <div className="p-5 border border-gray-200 rounded-2xl dark:border-gray-800 lg:p-6">
            <div className="flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between">
                <div>
                    <h4 className="text-lg font-semibold text-gray-800 dark:text-white/90 lg:mb-6">Personal
                        Information</h4>

                    <div className="grid grid-cols-1 gap-4 lg:grid-cols-2 lg:gap-7 2xl:gap-x-32">
                        <div>
                            <p className="mb-2 text-xs leading-normal text-gray-500 dark:text-gray-400">Username</p>
                            <p className="text-sm font-medium text-gray-800 dark:text-white/90">{user.username}</p>
                        </div>

                        <div>
                            <p className="mb-2 text-xs leading-normal text-gray-500 dark:text-gray-400">Role</p>
                            <p className="text-sm font-medium text-gray-800 dark:text-white/90">{user.role}</p>
                        </div>
                    </div>
                </div>

                <div className="flex flex-col gap-2">
                    <button
                        onClick={openInfo}
                        className="flex w-full items-center justify-center gap-2 rounded-full border border-gray-300 bg-white px-4 py-3 text-sm font-medium text-gray-700 shadow-theme-xs hover:bg-gray-50 hover:text-gray-800 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-400 dark:hover:bg-white/[0.03] dark:hover:text-gray-200 lg:inline-flex lg:w-auto"
                    >
                        <PencilIcon/>
                        Edit information
                    </button>
                    <button
                        onClick={openPwd}
                        className="flex w-full items-center justify-center gap-2 rounded-full border border-gray-300 bg-white px-4 py-3 text-sm font-medium text-gray-700 shadow-theme-xs hover:bg-gray-50 hover:text-gray-800 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-400 dark:hover:bg-white/[0.03] dark:hover:text-gray-200 lg:inline-flex lg:w-auto"
                    >
                        <KeyIcon/>
                        Change password
                    </button>
                </div>
            </div>

            <Modal isOpen={isOpenInformation} onClose={closeModalInformation}
                   className="max-w-[700px] m-4 overflow-hidden">
                <div
                    className="no-scrollbar relative w-full max-w-[700px] overflow-y-auto rounded-3xl bg-white p-4 dark:bg-gray-900 lg:p-11">
                    <div className="px-2 pr-14">
                        <h4 className="mb-2 text-2xl font-semibold text-gray-800 dark:text-white/90">Edit Personal
                            Information</h4>
                        <p className="mb-6 text-sm text-gray-500 dark:text-gray-400 lg:mb-7">
                            Update your details to keep your profile up-to-date.
                        </p>
                    </div>
                    <form className="flex flex-col" onSubmit={handleSaveInfo}>
                        <div className="custom-scrollbar h-fit overflow-y-hidden px-2 pb-3">
                            <div className="grid grid-cols-1 gap-x-6 gap-y-5 lg:grid-cols-2">
                                <div className="col-span-2 lg:col-span-1">
                                    <Label>Username</Label>
                                    <Input
                                        type="text"
                                        value={infoDraft.username}
                                        onChange={(e: any) => setInfoDraft((d) => ({ ...d, username: e.target.value }))}
                                    />
                                </div>
                            </div>
                        </div>
                        <div className="flex items-center gap-3 px-2 mt-6 lg:justify-end">
                            <Button size="sm" variant="outline" type="button" onClick={closeModalInformation}>
                                Close
                            </Button>
                            <Button size="sm" disabled={infoSaving} type="submit">
                                {infoSaving ? "Saving…" : "Save Changes"}
                            </Button>
                        </div>
                    </form>
                </div>
            </Modal>

            <Modal isOpen={isOpenPassword} onClose={closeModalPassword} className="max-w-[700px] m-4 overflow-hidden">
                <div
                    className="no-scrollbar relative w-full max-w-[700px] overflow-y-auto rounded-3xl bg-white p-4 dark:bg-gray-900 lg:p-11">
                    <div className="px-2 pr-14">
                        <h4 className="mb-2 text-2xl font-semibold text-gray-800 dark:text-white/90">Change
                            Password</h4>
                        <p className="mb-6 text-sm text-gray-500 dark:text-gray-400 lg:mb-7">
                            Ensure your account is secure by updating your password regularly.
                        </p>
                    </div>
                    <form className="flex flex-col" onSubmit={handleSavePassword}>
                        <div className="custom-scrollbar h-fit overflow-y-hidden px-2 pb-3">
                            <div className="grid grid-cols-1 gap-x-6 gap-y-5 lg:grid-cols-2">
                                <div className="col-span-2 lg:col-span-1">
                                    <Label>Current Password</Label>
                                    <Input
                                        type="password"
                                        placeholder="Enter current password"
                                        value={pwdDraft.currentPassword}
                                        onChange={(e: any) => setPwdDraft((d) => ({
                                            ...d,
                                            currentPassword: e.target.value
                                        }))}
                                    />
                                </div>

                                <div className="col-span-2 lg:col-span-1">
                                    <Label>New Password</Label>
                                    <Input
                                        type="password"
                                        placeholder="Enter new password"
                                        value={pwdDraft.newPassword}
                                        onChange={(e: any) => setPwdDraft((d) => ({
                                            ...d,
                                            newPassword: e.target.value
                                        }))}
                                    />
                                </div>

                                <div className="col-span-2 lg:col-span-1"></div>

                                <div className="col-span-2 lg:col-span-1">
                                    <Label>Confirm New Password</Label>
                                    <Input
                                        type="password"
                                        placeholder="Confirm new password"
                                        value={pwdDraft.confirmPassword}
                                        onChange={(e: any) => setPwdDraft((d) => ({
                                            ...d,
                                            confirmPassword: e.target.value
                                        }))}
                                    />
                                </div>
                            </div>
                        </div>
                        <div className="flex items-center gap-3 px-2 mt-6 lg:justify-end">
                            <Button size="sm" variant="outline" type="button" onClick={closeModalPassword}>
                                Close
                            </Button>
                            <Button size="sm" disabled={pwdSaving} type="submit">
                                {pwdSaving ? "Saving…" : "Save Changes"}
                            </Button>
                        </div>
                    </form>
                </div>
            </Modal>
        </div>
    );
}
