import { cn } from"@/lib/utils"
import { LayoutDashboard, Clock, BarChart2, FileText, UserCircle, LogOut } from"lucide-react"
import { Link, useLocation, useNavigate } from"react-router-dom"
import { handleLogout } from"@/lib/redirectUtils"

export function EmployeeSidebar() {
 const { pathname } = useLocation()
 const navigate = useNavigate()

 const navItems = [
 { href:"/employee/dashboard", label:"Dashboard", icon: LayoutDashboard },
 { href:"/employee/attendance", label:"Attendance", icon: Clock },
 { href:"/employee/weekly-hours", label:"Weekly Hours", icon: BarChart2 },
 { href:"/employee/apply-leave", label:"Apply Leave", icon: FileText },
 { href:"/employee/profile", label:"Profile", icon: UserCircle },
 ]

 const handleEmployeeLogout = () => {
 handleLogout(navigate, 'employee')
 }

 return (
 <div className="w-64 sidebar-primary h-screen fixed left-0 top-0 flex flex-col border-r border-sidebar-border">
 <div className="p-6 border-b border-sidebar-border">
 <h2 className="text-xl font-bold">Employee Portal</h2>
 </div>

 <nav className="flex-1 p-4 space-y-2">
 {navItems.map((item) => {
 const Icon = item.icon
 const isActive = pathname === item.href

 return (
 <Link
 key={item.href}
 to={item.href}
 className={cn(
"flex items-center gap-3 px-4 py-3 rounded-lg transition-colors",
 isActive
 ?"bg-card/10 text-on-primary font-medium"
 :"text-on-primary/90 hover:bg-card/5",
 )}
 >
 <Icon className="w-5 h-5" />
 <span>{item.label}</span>
 </Link>
 )
 })}
 </nav>

 <div className="p-4 border-t border-sidebar-border">
 <button
 onClick={handleEmployeeLogout}
 className="flex items-center gap-3 px-4 py-3 rounded-lg w-full text-sidebar-foreground hover:bg-sidebar-accent/50 transition-colors"
 >
 <LogOut className="w-5 h-5" />
 <span>Logout</span>
 </button>
 </div>
 </div>
 )
}