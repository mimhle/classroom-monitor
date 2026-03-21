import { Outfit } from "next/font/google";
import "./globals.css";
import "flatpickr/dist/flatpickr.css";
import { SidebarProvider } from "@/context/SidebarContext";
import { ThemeProvider } from "@/context/ThemeContext";
import { NotificationProvider } from "@/components/ui/notification";

const outfit = Outfit({
    subsets: ["latin"],
});

export default function RootLayout({
    children,
}: Readonly<{
    children: React.ReactNode;
}>) {
    return (
        <html lang="en">
            <body className={`${outfit.className} dark:bg-gray-900`}>
                <ThemeProvider>
                    <NotificationProvider>
                        <SidebarProvider>{children}</SidebarProvider>
                    </NotificationProvider>
                </ThemeProvider>
            </body>
        </html>
    );
}
