import { Avatar, AvatarFallback, AvatarImage } from"@/components/ui/avatar"
import { useEffect, useState } from "react"
import { NotificationDrawer } from "@/components/notification-drawer"

export function EmployeeNavbar() {
 const [employee, setEmployee] = useState(null)

 useEffect(() => {
 const stored = localStorage.getItem("currentEmployee")
 if (stored) {
 setEmployee(JSON.parse(stored))
 }
 }, [])

 return (
 <div className="h-16 bg-primary-gradient border-b border-border flex items-center justify-between px-6 fixed top-0 right-0 left-64 z-10">
 <div>
 <h1 className="text-lg font-semibold">Employee Dashboard</h1>
 </div>

  <div className="flex items-center gap-4">
    <NotificationDrawer />
    <div className="text-right hidden sm:block">
      <p className="text-sm font-medium">{employee?.name || "Employee"}</p>
      <p className="text-xs text-muted-foreground">{employee?.email || ""}</p>
    </div>
 <Avatar>
 <AvatarImage src="/diverse-office-employee.png" alt="Employee" />
 <AvatarFallback className="bg-primary text-on-primary">{employee?.name?.charAt(0) ||"E"}</AvatarFallback>
 </Avatar>
 </div>
 </div>
 )
}
