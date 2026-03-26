"use client";
import React from "react";
import { useModal } from "@/hooks/useModal";
import { Modal } from "../ui/modal";
import Button from "../ui/button/Button";
import Input from "../form/input/InputField";
import Label from "../form/Label";
import { KeyIcon, PencilIcon } from "@/icons";
import { isAdminOrSuperadmin } from "@/libs/roles";

export default function UserInfoCard({ user }: { user: any }) {
    const {
        isOpen: isOpenInformation,
        openModal: openModalInformation,
        closeModal: closeModalInformation
    } = useModal();
    const { isOpen: isOpenPassword, openModal: openModalPassword, closeModal: closeModalPassword } = useModal();
    const handleSave = () => {
        closeModalInformation();
    };
    const canEdit = isAdminOrSuperadmin(user);

    return (
        <div className="p-5 border border-gray-200 rounded-2xl dark:border-gray-800 lg:p-6">
            <div className="flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between">
                <div>
                    <h4 className="text-lg font-semibold text-gray-800 dark:text-white/90 lg:mb-6">
                        Personal Information
                    </h4>

                    <div className="grid grid-cols-1 gap-4 lg:grid-cols-2 lg:gap-7 2xl:gap-x-32">
                        <div>
                            <p className="mb-2 text-xs leading-normal text-gray-500 dark:text-gray-400">
                                First Name
                            </p>
                            <p className="text-sm font-medium text-gray-800 dark:text-white/90">
                                {user.firstName}
                            </p>
                        </div>

                        <div>
                            <p className="mb-2 text-xs leading-normal text-gray-500 dark:text-gray-400">
                                Last Name
                            </p>
                            <p className="text-sm font-medium text-gray-800 dark:text-white/90">
                                {user.lastName}
                            </p>
                        </div>

                        <div>
                            <p className="mb-2 text-xs leading-normal text-gray-500 dark:text-gray-400">
                                Email address
                            </p>
                            <p className="text-sm font-medium text-gray-800 dark:text-white/90">
                                {user.email}
                            </p>
                        </div>

                        <div>
                            <p className="mb-2 text-xs leading-normal text-gray-500 dark:text-gray-400">
                                Phone
                            </p>
                            <p className="text-sm font-medium text-gray-800 dark:text-white/90">
                                {user.phone}
                            </p>
                        </div>
                    </div>
                </div>

                <div className="flex flex-col gap-2">
                    {canEdit ? (
                        <button
                            onClick={openModalInformation}
                            className="flex w-full items-center justify-center gap-2 rounded-full border border-gray-300 bg-white px-4 py-3 text-sm font-medium text-gray-700 shadow-theme-xs hover:bg-gray-50 hover:text-gray-800 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-400 dark:hover:bg-white/[0.03] dark:hover:text-gray-200 lg:inline-flex lg:w-auto"
                        >
                            <PencilIcon/>
                            Edit information
                        </button>
                    ) : null}
                    <button
                        onClick={openModalPassword}
                        className="flex w-full items-center justify-center gap-2 rounded-full border border-gray-300 bg-white px-4 py-3 text-sm font-medium text-gray-700 shadow-theme-xs hover:bg-gray-50 hover:text-gray-800 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-400 dark:hover:bg-white/[0.03] dark:hover:text-gray-200 lg:inline-flex lg:w-auto"
                    >
                        <KeyIcon/>
                        Change password
                    </button>
                </div>

            </div>

            {canEdit ? (
                <Modal isOpen={isOpenInformation} onClose={closeModalInformation}
                       className="max-w-[700px] m-4 overflow-hidden">
                    <div
                        className="no-scrollbar relative w-full max-w-[700px] overflow-y-auto rounded-3xl bg-white p-4 dark:bg-gray-900 lg:p-11">
                        <div className="px-2 pr-14">
                            <h4 className="mb-2 text-2xl font-semibold text-gray-800 dark:text-white/90">
                                Edit Personal Information
                            </h4>
                            <p className="mb-6 text-sm text-gray-500 dark:text-gray-400 lg:mb-7">
                                Update your details to keep your profile up-to-date.
                            </p>
                        </div>
                        <form className="flex flex-col">
                            <div className="custom-scrollbar h-fit overflow-y-hidden px-2 pb-3">
                                <div className="">
                                    <div className="grid grid-cols-1 gap-x-6 gap-y-5 lg:grid-cols-2">
                                        <div className="col-span-2 lg:col-span-1">
                                            <Label>First Name</Label>
                                            <Input type="text" defaultValue={user.firstName}/>
                                        </div>

                                        <div className="col-span-2 lg:col-span-1">
                                            <Label>Last Name</Label>
                                            <Input type="text" defaultValue={user.lastName}/>
                                        </div>

                                        <div className="col-span-2 lg:col-span-1">
                                            <Label>Email Address</Label>
                                            <Input type="text" defaultValue={user.email}/>
                                        </div>

                                        <div className="col-span-2 lg:col-span-1">
                                            <Label>Phone</Label>
                                            <Input type="text" defaultValue={user.phone}/>
                                        </div>
                                    </div>
                                </div>
                            </div>
                            <div className="flex items-center gap-3 px-2 mt-6 lg:justify-end">
                                <Button size="sm" variant="outline" onClick={closeModalInformation}>
                                    Close
                                </Button>
                                <Button size="sm" onClick={handleSave}>
                                    Save Changes
                                </Button>
                            </div>
                        </form>
                    </div>
                </Modal>
            ) : null}

            <Modal isOpen={isOpenPassword} onClose={closeModalPassword} className="max-w-[700px] m-4 overflow-hidden">
                <div
                    className="no-scrollbar relative w-full max-w-[700px] overflow-y-auto rounded-3xl bg-white p-4 dark:bg-gray-900 lg:p-11">
                    <div className="px-2 pr-14">
                        <h4 className="mb-2 text-2xl font-semibold text-gray-800 dark:text-white/90">
                            Change Password
                        </h4>
                        <p className="mb-6 text-sm text-gray-500 dark:text-gray-400 lg:mb-7">
                            Ensure your account is secure by updating your password regularly.
                        </p>
                    </div>
                    <form className="flex flex-col">
                        <div className="custom-scrollbar h-fit overflow-y-hidden px-2 pb-3">
                            <div className="">
                                <div className="grid grid-cols-1 gap-x-6 gap-y-5 lg:grid-cols-2">
                                    <div className="col-span-2 lg:col-span-1">
                                        <Label>Current Password</Label>
                                        <Input type="password" placeholder="Enter current password"/>
                                    </div>

                                    <div className="col-span-2 lg:col-span-1">
                                        <Label>New Password</Label>
                                        <Input type="password" placeholder="Enter new password"/>
                                    </div>

                                    <div className="col-span-2 lg:col-span-1">
                                    </div>

                                    <div className="col-span-2 lg:col-span-1">
                                        <Label>Confirm New Password</Label>
                                        <Input type="password" placeholder="Confirm new password"/>
                                    </div>
                                </div>
                            </div>
                        </div>
                        <div className="flex items-center gap-3 px-2 mt-6 lg:justify-end">
                            <Button size="sm" variant="outline" onClick={closeModalPassword}>
                                Close
                            </Button>
                            <Button size="sm" onClick={handleSave}>
                                Save Changes
                            </Button>
                        </div>
                    </form>
                </div>
            </Modal>
        </div>
    );
}
