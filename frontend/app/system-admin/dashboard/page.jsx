import { useEffect, useState, useMemo } from"react"
import { useNavigate } from"react-router-dom"
import { useQuery, useQueryClient } from"@tanstack/react-query"
import { Card, CardContent, CardHeader, CardTitle } from"@/components/ui/card"
import { Button } from"@/components/ui/button"
import { Badge } from"@/components/ui/badge"
import { Progress } from"@/components/ui/progress"
import {
 Building2, Users, CheckCircle, XCircle, Shield,
 RefreshCw, TrendingUp, ChevronRight, Eye, BarChart3,
 Activity, AlertTriangle
} from"lucide-react"
import { getCurrentUser, isAuthenticated } from"@/lib/auth"
import { getValidIdToken } from"@/lib/firebaseClient"
import { toast } from"sonner"

export default function SystemAdminDashboardPage() {
 const navigate = useNavigate()
 const queryClient = useQueryClient()
 const [currentUser, setCurrentUser] = useState(null)

 useEffect(() => {
 if (!isAuthenticated()) {
 navigate("/login")
 return
 }

 const user = getCurrentUser()
 if (!user || user.role !=="system_admin") {
 toast.error("Unauthorized. System Admin access required.")
 navigate("/login")
 return
 }

 setCurrentUser(user)
 }, [navigate])

 const { data: dashboardData = null, isLoading: loading, error: queryError } = useQuery({
 queryKey: ['sa-dashboard'],
 queryFn: async () => {
 const token = await getValidIdToken()
 if (!token) throw new Error("Authentication token not found. Please login again.")
 const u = import.meta.env.VITE_API_URL ||""
 const base = u.endsWith('/api') ? u : `${u}/api`
 const response = await fetch(`${base}/system-admin/dashboard/stats`, {
 headers: { Authorization: `Bearer ${token}` },
 })
 if (response.status === 401) throw new Error("Session expired. Please login again.")
 if (response.status === 403) throw new Error("Access denied. System Admin privileges required.")
 if (!response.ok) { const errData = await response.json(); throw new Error(errData.error ||"Failed to load dashboard") }
 return response.json()
 },
 enabled: !!currentUser,
 })

 const error = queryError?.message || null
 const loadDashboard = () => queryClient.invalidateQueries({ queryKey: ['sa-dashboard'] })

 const formatDate = (dateString) => {
 try {
 if (!dateString) return"N/A"
 return new Date(dateString).toLocaleDateString("en-US", {
 month:"short",
 day:"numeric",
 year:"numeric",
 })
 } catch {
 return"N/A"
 }
 }

 if (loading) {
 return (
 <div className="flex items-center justify-center min-h-[400px]">
 <div className="text-center">
 <RefreshCw className="h-8 w-8 animate-spin mx-auto mb-2 text-blue-500" />
 <p className="text-muted-foreground">Loading dashboard...</p>
 </div>
 </div>
 )
 }

 if (error) {
 return (
 <div className="flex items-center justify-center min-h-[400px]">
 <Card className="w-full max-w-md">
 <CardContent className="pt-6">
 <div className="text-center">
 <AlertTriangle className="h-12 w-12 text-red-500 mx-auto mb-4" />
 <h3 className="text-lg font-semibold text-red-600 mb-2">Error</h3>
 <p className="text-muted-foreground mb-4">{error}</p>
 <Button onClick={loadDashboard} className="bg-blue-500 hover:bg-blue-600">
 <RefreshCw className="mr-2 h-4 w-4" />
 Retry
 </Button>
 </div>
 </CardContent>
 </Card>
 </div>
 )
 }

 if (!currentUser) return null

 // Parse dashboard data with safe defaults
 const system = dashboardData?.system || {}
 const users = dashboardData?.users || {}
 const organizations = dashboardData?.organizations || []

 return (
 <div className="space-y-6">
 {/* Header */}
 <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
 <div>
 <h1 className="text-2xl md:text-3xl font-bold text-foreground">
 System Dashboard
 </h1>
 <p className="text-muted-foreground mt-1">
 Welcome back, {currentUser.name}. Manage organizations and system settings.
 </p>
 </div>
 <Button
 onClick={loadDashboard}
 variant="outline"
 className="border-blue-200 hover:bg-blue-50 hover:border-blue-300"
 >
 <RefreshCw className="mr-2 h-4 w-4" />
 Refresh
 </Button>
 </div>

 {/* Stats Cards */}
 <div className="grid gap-3 sm:gap-4 grid-cols-2 lg:grid-cols-4">
 {/* Total Organizations */}
 <Card className="transition-all duration-300 hover:shadow-lg border-l-4 border-l-blue-500">
 <CardHeader className="flex flex-row items-center justify-between pb-2">
 <CardTitle className="text-sm font-medium text-muted-foreground">
 Total Organizations
 </CardTitle>
 <div className="p-2 rounded-lg bg-blue-50 dark:bg-blue-950/30">
 <Building2 className="h-4 w-4 text-blue-600" />
 </div>
 </CardHeader>
 <CardContent>
 <div className="text-2xl sm:text-3xl font-bold">{system.totalOrganizations || 0}</div>
 <p className="text-xs text-muted-foreground mt-1">
 Registered in system
 </p>
 </CardContent>
 </Card>

 {/* Active Organizations */}
 <Card className="transition-all duration-300 hover:shadow-lg border-l-4 border-l-green-500">
 <CardHeader className="flex flex-row items-center justify-between pb-2">
 <CardTitle className="text-sm font-medium text-muted-foreground">
 Active
 </CardTitle>
 <div className="p-2 rounded-lg bg-green-50 dark:bg-green-950/30">
 <CheckCircle className="h-4 w-4 text-green-600" />
 </div>
 </CardHeader>
 <CardContent>
 <div className="text-2xl sm:text-3xl font-bold text-green-600">{system.activeOrganizations || 0}</div>
 <p className="text-xs text-muted-foreground mt-1">
 Currently active organizations
 </p>
 </CardContent>
 </Card>

 {/* Inactive Organizations */}
 <Card className="transition-all duration-300 hover:shadow-lg border-l-4 border-l-gray-400">
 <CardHeader className="flex flex-row items-center justify-between pb-2">
 <CardTitle className="text-sm font-medium text-muted-foreground">
 Inactive
 </CardTitle>
 <div className="p-2 rounded-lg bg-gray-50 dark:bg-gray-800">
 <XCircle className="h-4 w-4 text-gray-500" />
 </div>
 </CardHeader>
 <CardContent>
 <div className="text-2xl sm:text-3xl font-bold text-gray-500">{system.inactiveOrganizations || 0}</div>
 <p className="text-xs text-muted-foreground mt-1">
 Deactivated organizations
 </p>
 </CardContent>
 </Card>

 {/* Total Users */}
 <Card className="transition-all duration-300 hover:shadow-lg border-l-4 border-l-blue-500">
 <CardHeader className="flex flex-row items-center justify-between pb-2">
 <CardTitle className="text-sm font-medium text-muted-foreground">
 Total Users
 </CardTitle>
 <div className="p-2 rounded-lg bg-blue-50 dark:bg-blue-950/30">
 <Users className="h-4 w-4 text-blue-600" />
 </div>
 </CardHeader>
 <CardContent>
 <div className="text-2xl sm:text-3xl font-bold text-blue-600">
 {(users.totalBusinessOwners || 0) + (users.totalAdmins || 0) + (users.totalEmployees || 0)}
 </div>
 <p className="text-xs text-muted-foreground mt-1">
 Across all organizations
 </p>
 </CardContent>
 </Card>
 </div>

 {/* User Breakdown */}
 <div className="grid gap-3 sm:gap-4 grid-cols-3">
 <Card className="transition-all duration-300 hover:shadow-lg">
 <CardHeader className="pb-2">
 <CardTitle className="text-sm font-medium flex items-center gap-2">
 <Shield className="h-4 w-4 text-purple-500" />
 Business Owners
 </CardTitle>
 </CardHeader>
 <CardContent>
 <div className="text-2xl font-bold">{users.totalBusinessOwners || 0}</div>
 </CardContent>
 </Card>
 <Card className="transition-all duration-300 hover:shadow-lg">
 <CardHeader className="pb-2">
 <CardTitle className="text-sm font-medium flex items-center gap-2">
 <Activity className="h-4 w-4 text-blue-500" />
 Administrators
 </CardTitle>
 </CardHeader>
 <CardContent>
 <div className="text-2xl font-bold">{users.totalAdmins || 0}</div>
 </CardContent>
 </Card>
 <Card className="transition-all duration-300 hover:shadow-lg">
 <CardHeader className="pb-2">
 <CardTitle className="text-sm font-medium flex items-center gap-2">
 <Users className="h-4 w-4 text-green-500" />
 Employees
 </CardTitle>
 </CardHeader>
 <CardContent>
 <div className="text-2xl font-bold">{users.totalEmployees || 0}</div>
 </CardContent>
 </Card>
 </div>

 {/* Organizations List */}
 <Card className="transition-all duration-300 hover:shadow-lg">
 <CardHeader className="pb-3">
 <div className="flex items-center justify-between">
 <div>
 <CardTitle className="text-lg font-semibold">Organizations Overview</CardTitle>
 <p className="text-sm text-muted-foreground mt-1">
 Manage and monitor all registered organizations
 </p>
 </div>
 <Button
 variant="ghost"
 size="sm"
 onClick={() => navigate("/system-admin/organizations")}
 className="text-blue-600 hover:text-blue-700 hover:bg-blue-50"
 >
 View All
 <ChevronRight className="h-4 w-4 ml-1" />
 </Button>
 </div>
 </CardHeader>
 <CardContent>
 {organizations.length === 0 ? (
 <div className="text-center py-8 text-muted-foreground">
 <Building2 className="h-12 w-12 mx-auto mb-3 opacity-50" />
 <p>No organizations registered yet</p>
 </div>
 ) : (
 <div className="space-y-4">
 {organizations.slice(0, 5).map((org) => (
 <div className="flex flex-col sm:flex-row sm:items-center justify-between p-3 sm:p-4 bg-background/50 rounded-lg border hover:border-blue-200 transition-all gap-3">
 <div className="flex items-center gap-4">
 <div className={`p-2 rounded-lg ${org.isActive ? 'bg-green-100 dark:bg-green-950/30' : 'bg-gray-100 dark:bg-gray-800'}`}>
 <Building2 className={`h-5 w-5 ${org.isActive ? 'text-green-600' : 'text-gray-400'}`} />
 </div>
 <div>
 <p className="font-medium">{org.name}</p>
 <p className="text-xs text-muted-foreground">
 {(org.counts?.businessOwners || 0) + (org.counts?.admins || 0) + (org.counts?.employees || 0)} users
 </p>
 </div>
 </div>
 <div className="flex items-center gap-3">
 <Badge variant={org.isActive ?"default" :"secondary"} className={org.isActive ?"bg-green-500" :""}>
 {org.isActive ?"Active" :"Inactive"}
 </Badge>
 {/* Quota indicators */}
 <div className="hidden md:flex items-center gap-2">
 <div className="text-xs text-muted-foreground">
 <span className="font-medium">{org.utilization?.employeesPercent || 0}%</span> capacity
 </div>
 <Progress value={org.utilization?.employeesPercent || 0} className="w-16 h-2" />
 </div>
 <Button
 variant="ghost"
 size="icon"
 onClick={() => navigate(`/system-admin/organizations?id=${org.id}`)}
 className="hover:bg-blue-50"
 >
 <Eye className="h-4 w-4 text-blue-600" />
 </Button>
 </div>
 </div>
 ))}
 </div>
 )}
 </CardContent>
 </Card>

 {/* Quick Actions */}
 <div className="grid gap-4 md:grid-cols-2">
 <Button
 className="h-16 bg-gradient-to-r from-blue-500 to-blue-500 hover:from-blue-600 hover:to-blue-600 text-white shadow-md"
 onClick={() => navigate("/system-admin/organizations")}
 >
 <Building2 className="mr-2 h-5 w-5" />
 Manage Organizations
 </Button>
 <Button
 variant="outline"
 className="h-16 border-blue-200 hover:bg-blue-50 hover:border-blue-300"
 onClick={() => navigate("/system-admin/profile")}
 >
 <BarChart3 className="mr-2 h-5 w-5 text-blue-600" />
 View System Reports
 </Button>
 </div>
 </div>
 )
}
