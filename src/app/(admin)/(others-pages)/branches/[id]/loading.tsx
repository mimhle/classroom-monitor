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
            </div>
        </div>
    );
}
