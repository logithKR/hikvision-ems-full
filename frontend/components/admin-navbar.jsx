import { Avatar, AvatarFallback, AvatarImage } from"@/components/ui/avatar"

export function AdminNavbar() {
 return (
 <div className="h-16 bg-primary-gradient border-b border-border flex items-center justify-between px-6 fixed top-0 right-0 left-64 z-10">
 <div>
 <h1 className="text-lg font-semibold">Admin Dashboard</h1>
 </div>

 <div className="flex items-center gap-3">
 <div className="text-right">
 <p className="text-sm font-medium">Admin User</p>
 <p className="text-xs text-muted-foreground">admin@company.com</p>
 </div>
 <Avatar>
 <AvatarImage src="/admin-interface.png" alt="Admin" />
 <AvatarFallback className="bg-primary text-on-primary">AD</AvatarFallback>
 </Avatar>
 </div>
 </div>
 )
}
