export default function Loading() {
    return (
        <div className="p-4 sm:p-6 lg:p-8">
            <div className="mx-auto w-full max-w-4xl">
                <div className="mb-6">
                    <div className="h-7 w-64 animate-pulse rounded bg-gray-200 dark:bg-gray-800"/>
                    <div className="mt-2 h-4 w-48 animate-pulse rounded bg-gray-200 dark:bg-gray-800"/>
                </div>
                <div
                    className="rounded-xl border border-gray-200 bg-white p-5 shadow-theme-xs dark:border-gray-800 dark:bg-gray-900">
                    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                        <div className="h-20 animate-pulse rounded bg-gray-100 dark:bg-gray-800"/>
                        <div className="h-20 animate-pulse rounded bg-gray-100 dark:bg-gray-800"/>
                    </div>
                </div>

                <div
                    className="mt-6 rounded-2xl border border-gray-200 bg-white dark:border-gray-800 dark:bg-white/[0.03]">
                    <div className="px-6 py-5">
                        <div className="h-5 w-24 animate-pulse rounded bg-gray-200 dark:bg-gray-800"/>
                        <div className="mt-2 h-4 w-56 animate-pulse rounded bg-gray-200 dark:bg-gray-800"/>
                    </div>
                    <div className="border-t border-gray-100 p-4 dark:border-gray-800 sm:p-6">
                        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                            <div className="h-24 animate-pulse rounded-xl bg-gray-100 dark:bg-gray-800"/>
                            <div className="h-24 animate-pulse rounded-xl bg-gray-100 dark:bg-gray-800"/>
                            <div className="h-24 animate-pulse rounded-xl bg-gray-100 dark:bg-gray-800"/>
                            <div className="h-24 animate-pulse rounded-xl bg-gray-100 dark:bg-gray-800"/>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
