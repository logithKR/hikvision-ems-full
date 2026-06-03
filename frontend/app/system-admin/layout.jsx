import { useEffect, useState } from "react"
import { useQueryClient } from "@tanstack/react-query"
import { useNavigate, useLocation, Outlet } from "react-router-dom"
import { Link } from "react-router-dom"
import { Button } from "@/components/ui/button"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Separator } from "@/components/ui/separator"
import {
    Shield,
    LayoutDashboard,
    Building2,
    User,
    LogOut,
    Menu,
    X
} from "lucide-react"
import { getCurrentUser, isAuthenticated, logoutUser } from "@/lib/auth"
import { cn } from "@/lib/utils"
import { toast } from "sonner"

export default function SystemAdminLayout({ children }) {
    const navigate = useNavigate()
    const { pathname } = useLocation()
    const [currentUser, setCurrentUser] = useState(null)
    const [sidebarOpen, setSidebarOpen] = useState(false)

    // Check if current page is login
    const isAuthPage = pathname === "/login"

    useEffect(() => {
        // Skip auth check for login page
        if (isAuthPage) return

        // Check authentication
        if (!isAuthenticated()) {
            navigate("/login")
            return
        }

        const user = getCurrentUser()
        if (!user || user.role !== "system_admin") {
            toast.error("Unauthorized. System Admin access required.")
            navigate("/login")
            return
        }

        setCurrentUser(user)
    }, [pathname, isAuthPage, navigate])

    // If it's a login page, render without sidebar
    if (isAuthPage) {
        return <>{children}</>
    }

    const queryClient = useQueryClient()

    const handleLogout = () => {
        if (window.confirm("Are you sure you want to logout?")) {
            queryClient.clear()
            logoutUser()
            navigate("/login")
        }
    }

    const navLinks = [
        {
            href: "/system-admin/dashboard",
            label: "Dashboard",
            icon: LayoutDashboard,
        },
        {
            href: "/system-admin/organizations",
            label: "Organizations",
            icon: Building2,
        },
        {
            href: "/system-admin/profile",
            label: "My Profile",
            icon: User,
        },
    ]

    const isActive = (href) => pathname === href

    const getInitials = (name) => {
        if (!name) return "SA"
        return name
            .split(" ")
            .map((n) => n[0])
            .join("")
            .toUpperCase()
            .slice(0, 2)
    }

    return (
        <div className="min-h-screen bg-slate-100 dark:bg-slate-900">
            {/* Mobile Header (Simplified) */}
            <div className="lg:hidden fixed top-0 left-0 right-0 z-40 bg-gradient-to-r from-slate-800 to-slate-900 px-4 py-3 flex items-center justify-between shadow-md">
                <div className="flex items-center gap-2.5">
                    <div className="p-1.5 bg-white/10 rounded-lg">
                        <Server className="h-5 w-5 text-white" />
                    </div>
                    <span className="font-semibold text-white text-sm tracking-wide">System Admin</span>
                </div>
                
                {/* Mobile Profile/Logout Icon instead of hamburger */}
                <Button
                    variant="ghost"
                    size="icon"
                    className="text-white hover:bg-white/10 rounded-xl h-9 w-9"
                    onClick={handleLogout}
                    title="Logout"
                >
                    <LogOut className="h-5 w-5" />
                </Button>
            </div>

            {/* Mobile Bottom Navigation Bar (Elite SaaS Style) */}
            <nav className="lg:hidden fixed bottom-0 left-0 right-0 z-50 bg-slate-900 border-t border-slate-800 flex items-center justify-around pb-safe px-2 py-2 shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.5)]">
                {navLinks.slice(0, 5).map((link) => {
                    const Icon = link.icon;
                    const active = isActive(link.href);
                    return (
                        <Link
                            key={link.href}
                            to={link.href}
                            className={cn(
                                "flex flex-col items-center justify-center w-16 h-12 gap-1 rounded-xl transition-all",
                                active 
                                    ? "text-blue-400" 
                                    : "text-slate-500 hover:text-slate-300 hover:bg-slate-800"
                            )}
                        >
                            <Icon className={cn("h-5 w-5", active && "drop-shadow-sm")} strokeWidth={active ? 2.5 : 2} />
                            <span className="text-[10px] font-medium truncate w-full text-center">{link.label}</span>
                        </Link>
                    )
                })}
            </nav>

            {/* Sidebar (Desktop Only) */}
            <aside
                className={cn(
                    "hidden lg:flex fixed top-0 left-0 z-50 h-screen w-64 bg-slate-900 border-r border-slate-800 transition-transform duration-300 ease-in-out"
                )}
            >
                <div className="flex flex-col h-full w-full">
                    {/* Logo */}
                    <div className="p-6 border-b border-slate-800">
                        <Link to="/system-admin/dashboard" className="flex items-center gap-3">
                            <div className="p-2 bg-gradient-to-r from-blue-500 to-blue-500 rounded-lg shadow-md">
                                <Shield className="h-6 w-6 text-white" />
                            </div>
                            <div>
                                <h2 className="font-bold text-lg text-slate-100">System Admin</h2>
                                <p className="text-xs text-slate-400">Administration Panel</p>
                            </div>
                        </Link>
                    </div>

                    {/* Navigation */}
                    <nav className="flex-1 p-4 space-y-1 overflow-y-auto">
                        {navLinks.map((link) => {
                            const Icon = link.icon
                            const active = isActive(link.href)

                            return (
                                <Link
                                    key={link.href}
                                    to={link.href}
                                    className={cn(
                                        "flex items-center gap-3 px-4 py-3 rounded-lg transition-all group",
                                        active
                                            ? "bg-blue-600 text-white shadow-md"
                                            : "text-slate-400 hover:text-white hover:bg-slate-800"
                                    )}
                                >
                                    <Icon className={cn("h-5 w-5", active ? "text-white" : "text-slate-500 group-hover:text-slate-300")} />
                                    <span className="font-medium">{link.label}</span>
                                </Link>
                            )
                        })}
                    </nav>

                    <Separator className="bg-slate-800" />

                    {/* User Profile */}
                    <div className="p-4 space-y-3">
                        <div className="flex items-center gap-3 p-3 bg-slate-800 rounded-lg">
                            <Avatar className="h-10 w-10 border-2 border-slate-700">
                                <AvatarFallback className="bg-slate-700 text-slate-300 font-bold">
                                    {getInitials(currentUser?.name)}
                                </AvatarFallback>
                            </Avatar>
                            <div className="flex-1 min-w-0">
                                <p className="text-sm font-medium text-white truncate">
                                    {currentUser?.name || "System Admin"}
                                </p>
                                <p className="text-xs text-slate-400 truncate">
                                    {currentUser?.email}
                                </p>
                            </div>
                        </div>

                        <Button
                            variant="ghost"
                            className="w-full justify-start text-slate-400 hover:text-red-400 hover:bg-slate-800"
                            onClick={handleLogout}
                        >
                            <LogOut className="mr-2 h-4 w-4" />
                            Logout
                        </Button>
                    </div>
                </div>
            </aside>

            {/* Main Content */}
            <main className="lg:pl-64 pt-16 pb-20 lg:pt-0 lg:pb-0 min-h-screen transition-all bg-slate-100 dark:bg-slate-950">
                <div className="p-4 md:p-6 lg:p-8 space-y-6 max-w-7xl mx-auto">
                    {children || <Outlet />}
                </div>
            </main>
        </div>
    )
}
