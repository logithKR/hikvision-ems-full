import { useEffect, useState } from"react"
import { useQueryClient } from"@tanstack/react-query"
import { useNavigate, useLocation, Outlet } from"react-router-dom"
import { Link } from"react-router-dom"
import { ThemeToggle } from"@/components/theme-toggle"
import { Button } from"@/components/ui/button"
import { Avatar, AvatarFallback } from"@/components/ui/avatar"
import { Separator } from"@/components/ui/separator"
import {
 Building2,
 LayoutDashboard,
 Users,
 Calendar,
 FileText,
 LogOut,
 User,
 Menu,
 X,
 Shield,
 FolderKanban,
 GitBranch
} from"lucide-react"
import { getCurrentUser, isAuthenticated, logoutUser } from"@/lib/auth"
import { cn } from"@/lib/utils"

export default function BusinessOwnerLayout({ children }) {
 // children is used for auth pages (login/register wrapped directly)
 // Outlet is used for nested routes (dashboard, employees, etc.)
 const navigate = useNavigate()
 const { pathname } = useLocation()
 const [currentUser, setCurrentUser] = useState(null)
 const [sidebarOpen, setSidebarOpen] = useState(false)

 // Check if current page is login or register
 const isAuthPage = pathname ==="/login" || pathname ==="/business-owner/register"

 useEffect(() => {
 // Skip auth check for login/register pages
 if (isAuthPage) return

 // Check authentication
 if (!isAuthenticated()) {
 navigate("/login")
 return
 }

 const user = getCurrentUser()
 if (!user || user.role !=="business_owner") {
 navigate("/login")
 return
 }

 setCurrentUser(user)
 }, [pathname, isAuthPage, navigate])

 // If it's a login/register page, render without sidebar
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
 href:"/business-owner/dashboard",
 label:"Dashboard",
 icon: LayoutDashboard,
 },
 {
 href:"/business-owner/org-chart",
 label:"Org Chart",
 icon: GitBranch,
 },
 {
 href:"/business-owner/employees",
 label:"Employees",
 icon: Users,
 },
 {
 href:"/business-owner/attendance",
 label:"Attendance",
 icon: Calendar,
 },
 {
 href:"/business-owner/leave-requests",
 label:"Leave Requests",
 icon: FileText,
 },
 {
 href:"/business-owner/projects",
 label:"Projects",
 icon: FolderKanban,
 },
 {
 href:"/business-owner/profile",
 label:"Profile",
 icon: User,
 },
 ]

 const isActive = (href) => pathname === href

 const getInitials = (name) => {
 if (!name) return"BO"
 return name
 .split("")
 .map((n) => n[0])
 .join("")
 .toUpperCase()
 .slice(0, 2)
 }

 return (
 <div className="min-h-screen bg-secondary">
 {/* Mobile Header (Simplified) */}
 <div className="lg:hidden fixed top-0 left-0 right-0 z-[100] bg-gradient-to-r from-blue-600 to-blue-700 px-4 py-3 flex items-center justify-between shadow-md">
 <div className="flex items-center gap-2.5">
 <div className="p-1.5 bg-card/20 rounded-lg">
 <Building2 className="h-5 w-5 text-white" />
 </div>
 <span className="font-semibold text-white text-sm tracking-wide">Business Owner</span>
 </div>
 
 {/* Mobile Profile/Logout Icon instead of hamburger */}
 <div className="flex items-center gap-2">
 <ThemeToggle className="text-white hover:bg-card/20" />
 <Button
 variant="ghost"
 size="icon"
 className="text-white hover:bg-card/10 rounded-xl h-9 w-9"
 onClick={handleLogout}
 title="Logout"
 >
 <LogOut className="h-5 w-5" />
 </Button>
 </div>
 </div>

 {/* Mobile Bottom Navigation Bar (Elite SaaS Style) */}
 <nav className="lg:hidden fixed bottom-0 left-0 right-0 z-[100] bg-card border-t border-border flex items-center justify-around pb-safe px-2 py-2 shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.05)]">
 {navLinks.slice(0, 6).map((link) => {
 const Icon = link.icon;
 const active = isActive(link.href);
 return (
 <Link
 key={link.href}
 to={link.href}
 className={cn(
"flex flex-col items-center justify-center w-16 h-12 gap-1 rounded-xl transition-all",
 active 
 ?"text-blue-600 dark:text-blue-400" 
 :"text-muted-foreground hover:text-foreground dark:text-muted-foreground dark:hover:text-slate-200 hover:bg-background dark:hover:bg-slate-800"
 )}
 >
 <Icon className={cn("h-5 w-5", active &&"drop-shadow-sm")} strokeWidth={active ? 2.5 : 2} />
 <span className="text-[10px] font-medium truncate w-full text-center">{link.label}</span>
 </Link>
 )
 })}
 </nav>

 {/* Sidebar (Desktop Only) */}
 <aside
 className={cn(
"hidden lg:flex fixed top-0 left-0 z-[100] h-screen w-64 bg-card border-r border-sidebar-border transition-transform duration-300 ease-in-out"
 )}
 >
 <div className="flex flex-col h-full w-full">
 {/* Logo */}
 <div className="h-16 flex items-center px-6 border-b border-sidebar-border">
 <Link to="/business-owner/dashboard" className="flex items-center gap-3">
 <div className="p-2 bg-blue-600 rounded-lg shadow-sm">
 <Building2 className="h-5 w-5 text-white" />
 </div>
 <div>
 <h2 className="font-bold text-lg text-foreground tracking-tight">Business Owner</h2>
 <p className="text-[10px] text-muted-foreground uppercase tracking-wider font-semibold">Management</p>
 </div>
 </Link>
 <div className="ml-auto flex items-center gap-2">
 <ThemeToggle />
 </div>
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
 onClick={() => setSidebarOpen(false)}
 className={cn(
"flex items-center gap-3 px-4 py-3 rounded-lg transition-all group border border-transparent",
 active
 ?"bg-blue-50 border-blue-100 text-blue-700 shadow-sm dark:bg-blue-900/20 dark:border-blue-800 dark:text-blue-300"
 :"text-slate-600 dark:text-muted-foreground hover:bg-background hover:text-foreground dark:hover:bg-slate-800/50 dark:hover:text-slate-200"
 )}
 >
 <Icon className={cn("h-5 w-5", active ?"text-blue-600 dark:text-blue-400" :"text-muted-foreground group-hover:text-slate-600 dark:text-muted-foreground dark:group-hover:text-slate-300")} />
 <span className="font-medium">{link.label}</span>
 </Link>
 )
 })}
 </nav>

 <Separator className="opacity-50" />

 {/* User Profile */}
 <div className="p-4 space-y-3 bg-background/50 /50">
 <div className="flex items-center gap-3 p-3 bg-card rounded-lg border border-sidebar-border shadow-sm">
 <Avatar className="h-10 w-10 border-2 border-white shadow-sm">
 <AvatarFallback className="bg-blue-100 text-blue-700 font-bold text-xs">
 {getInitials(currentUser?.name)}
 </AvatarFallback>
 </Avatar>
 <div className="flex-1 min-w-0">
 <p className="text-sm font-semibold truncate text-foreground">
 {currentUser?.name ||"Business Owner"}
 </p>
 <p className="text-xs text-muted-foreground truncate">
 {currentUser?.email}
 </p>
 </div>
 </div>

 <Button
 variant="outline"
 className="w-full justify-start text-red-600 border-red-100 hover:bg-red-50 hover:text-red-700 hover:border-red-200 dark:border-red-900/30 dark:text-red-400 dark:hover:bg-red-950/30"
 onClick={handleLogout}
 >
 <LogOut className="mr-2 h-4 w-4" />
 Logout
 </Button>
 </div>
 </div>
 </aside>

 {/* Main Content */}
 <main className="lg:pl-64 pt-16 pb-20 lg:pt-0 lg:pb-0 min-h-screen transition-all bg-secondary">
 <div className="p-4 md:p-6 lg:p-8 space-y-6 max-w-7xl mx-auto">
 {children || <Outlet />}
 </div>
 </main>
 </div>
 )
}
