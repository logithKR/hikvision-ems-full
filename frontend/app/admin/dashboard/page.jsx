import { useEffect, useState, useMemo } from"react"
import { useNavigate } from"react-router-dom"
import { useQuery, useQueryClient } from"@tanstack/react-query"
import { Card, CardContent, CardHeader, CardTitle } from"@/components/ui/card"
import { Button } from"@/components/ui/button"
import { Badge } from"@/components/ui/badge"
import { Progress } from"@/components/ui/progress"
import {
 Users, UserCheck, UserX, FileText, RefreshCw, AlertCircle,
 Clock, TrendingUp, Calendar, Plus, Briefcase
} from"lucide-react"
import { getCurrentUser, isAuthenticated } from"@/lib/auth"
import { getValidIdToken } from"@/lib/firebaseClient"

export default function AdminDashboardPage() {
 const navigate = useNavigate()
 const queryClient = useQueryClient()
 const [currentUser, setCurrentUser] = useState(null)

 // Auth Check
 useEffect(() => {
 if (!isAuthenticated()) {
 navigate("/login")
 return
 }
 const user = getCurrentUser()
 if (!user || (user.role !=="admin" && user.role !=="system_admin")) {
 navigate("/login")
 return
 }
 setCurrentUser(user)
 }, [navigate])

 const { data: dashboardData = null, isLoading: loading, error: queryError } = useQuery({
 queryKey: ['admin-dashboard'],
 queryFn: async () => {
 const token = await getValidIdToken()
 if (!token) throw new Error("Authentication failed. Please login again.")
 const apiBase = import.meta.env.VITE_API_URL ||""
 const response = await fetch(`${apiBase}/api/admin/dashboard/stats`, {
 headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' }
 })
 if (response.status === 401) throw new Error("Session expired. Please login again.")
 if (!response.ok) { const errData = await response.json(); throw new Error(errData.error ||"Failed to load dashboard") }
 return response.json()
 },
 enabled: !!currentUser,
 })

 // Fetch employees for position distribution
 const { data: allEmployees = [] } = useQuery({
 queryKey: ['admin-employees'],
 queryFn: async () => {
 const token = await getValidIdToken()
 if (!token) throw new Error("Auth failed")
 const apiBase = import.meta.env.VITE_API_URL ||""
 const response = await fetch(`${apiBase}/api/admin/employees`, {
 headers: { Authorization: `Bearer ${token}` },
 })
 if (!response.ok) throw new Error("Failed to load employees")
 const data = await response.json()
 return data.employees || []
 },
 enabled: !!currentUser,
 staleTime: 30000,
 })

 // Role + Position distribution computed from employees
 const positionStats = useMemo(() => {
 const roleCounts = {}
 const positionCounts = {}
 const systemRoles = ['employee', 'admin', 'business_owner', 'team_lead', 'system_admin']
 allEmployees.forEach((emp) => {
 if (emp.isActive === false) return
 // Count by system role
 const role = emp.role || 'employee'
 const roleLabel = role.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())
 roleCounts[roleLabel] = (roleCounts[roleLabel] || 0) + 1
 // Count by position (only if it's a real position, not a default role name)
 const pos = emp.position
 if (pos && !systemRoles.includes(pos.toLowerCase()) && pos.toLowerCase() !== 'employee') {
 positionCounts[pos] = (positionCounts[pos] || 0) + 1
 }
 })
 const roleEntries = Object.entries(roleCounts).sort((a, b) => b[1] - a[1])
 const posEntries = Object.entries(positionCounts).sort((a, b) => b[1] - a[1]).slice(0, 6)
 return { roles: roleEntries, positions: posEntries }
 }, [allEmployees])

 const maxRoleCount = positionStats.roles.length > 0 ? positionStats.roles[0][1] : 1
 const maxPosCount = positionStats.positions.length > 0 ? positionStats.positions[0][1] : 1

 const error = queryError?.message || null
 const loadDashboard = () => queryClient.invalidateQueries({ queryKey: ['admin-dashboard'] })

 const getQuotaPercentage = () => {
 if (!dashboardData?.quota) return 0
 const raw = dashboardData.quota
 const created = raw.quota?.created ?? raw.employeesCreated ?? 0
 const limit = raw.quota?.limit ?? raw.canCreateUpTo ?? 0
 if (!limit) return 0
 return Math.min(Math.round((created / limit) * 100), 100)
 }

 if (loading) {
 return (
 <div className="flex items-center justify-center min-h-[60vh]">
 <div className="text-center">
 <RefreshCw className="h-8 w-8 animate-spin mx-auto mb-3 text-blue-600" />
 <p className="text-sm text-muted-foreground">Loading dashboard…</p>
 </div>
 </div>
 )
 }

 const employees = dashboardData?.employees || { total: 0, active: 0, inactive: 0 }
 const attendance = dashboardData?.attendance || { presentCount: 0, totalRecords: 0 }
 const leaves = dashboardData?.leaves || { pendingCount: 0, pending: [] }
 const rawQuota = dashboardData?.quota || {}
 const quota = {
 employeesCreated: rawQuota.quota?.created ?? rawQuota.employeesCreated ?? 0,
 canCreateUpTo: rawQuota.quota?.limit ?? rawQuota.canCreateUpTo ?? 0,
 remaining: rawQuota.quota?.remaining ?? rawQuota.remaining ?? 0,
 }

 const quotaPct = getQuotaPercentage()
 const quotaBarColor ="bg-blue-600"

 const statsData = [
  {
  title:"Active Employees",
  value: employees.active || 0,
  subtitle: `${employees.inactive || 0} inactive`,
  icon: Users,
  accent:"text-blue-600 dark:text-blue-400",
  iconBg:"bg-blue-50 dark:bg-blue-500/10 border-blue-100 dark:border-blue-500/20",
  },
  {
  title:"Present Today",
  value: attendance.presentCount || 0,
  subtitle:"Checked in",
  icon: UserCheck,
  accent:"text-blue-600 dark:text-blue-400",
  iconBg:"bg-blue-50 dark:bg-blue-500/10 border-blue-100 dark:border-blue-500/20",
  },
  {
  title:"Absent",
  value: (employees.active || 0) - (attendance.presentCount || 0),
  subtitle:"Not checked in",
  icon: UserX,
  accent:"text-muted-foreground",
  iconBg:"bg-secondary border-border",
  },
  {
  title:"Pending Requests",
  value: leaves.pendingCount || 0,
  subtitle:"Leaves awaiting",
  icon: FileText,
  accent:"text-blue-600 dark:text-blue-400",
  iconBg:"bg-blue-50 dark:bg-blue-500/10 border-blue-100 dark:border-blue-500/20",
  },
 ]

 const quickActions = [
 { label:"Manage Staff", icon: Users, path:"/admin/employees" },
 { label:"Check Attendance", icon: Calendar, path:"/admin/attendance" },
 { label:"Review Leaves", icon: FileText, path:"/admin/leave-requests" },
 ]

 return (
 <div className="space-y-4 sm:space-y-6">

  {/* Page Header */}
  <div className="bg-gradient-to-r from-blue-600 to-blue-700 sm:from-card sm:to-card rounded-2xl px-5 py-6 sm:py-5 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-5 sm:gap-4 shadow-sm sm:border sm:border-border">
  <div>
  <h1 className="text-2xl sm:text-xl font-bold text-white sm:text-foreground tracking-tight">Dashboard</h1>
  <p className="text-sm text-blue-100 sm:text-muted-foreground mt-1">
  Overview for <span className="text-white sm:text-foreground font-medium">{currentUser?.name}</span>
  </p>
  </div>
  <div className="flex w-full sm:w-auto gap-3">
  <Button
  onClick={loadDashboard}
  variant="outline"
  className="flex-1 sm:flex-none gap-2 border-white/30 sm:border-border text-white sm:text-foreground hover:bg-card/10 sm:hover:bg-muted bg-card/10 sm:bg-background"
  >
  <RefreshCw className="h-4 w-4" />
  <span className="hidden sm:inline">Refresh</span>
  </Button>
  <Button
  onClick={() => navigate("/admin/employees")}
  className="flex-1 sm:flex-none gap-2 bg-card sm:bg-blue-600 text-blue-600 sm:text-white hover:bg-blue-50 sm:hover:bg-blue-700 shadow-none dark:bg-blue-600 dark:text-white dark:hover:bg-blue-700"
  >
  <Plus className="h-4 w-4" />
  Add Employee
  </Button>
  </div>
  </div>

 {/* Error Alert */}
 {error && (
 <div className="flex items-start gap-3 p-4 bg-red-50 border border-red-200 rounded-xl">
 <AlertCircle className="h-4 w-4 text-red-500 mt-0.5 flex-shrink-0" />
 <div className="flex-1">
 <p className="text-sm font-semibold text-red-800">Error Loading Dashboard</p>
 <p className="text-xs text-red-600 mt-0.5">{error}</p>
 </div>
 <Button
 size="sm"
 variant="outline"
 onClick={loadDashboard}
 className="border-red-200 text-red-700 hover:bg-red-100 shrink-0"
 >
 Retry
 </Button>
 </div>
 )}

 {/* Stats Grid */}
 <div className="grid gap-3 sm:gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4">
 {statsData.map(({ title, value, subtitle, icon: Icon, accent, iconBg }) => (
 <div key={title} className="bg-card border border-border rounded-2xl p-5 shadow-sm hover:shadow-md transition-all duration-200 border-l-4 border-l-blue-500 flex items-center justify-between sm:block">
 <div className="sm:mb-4">
 <span className="text-[11px] sm:text-xs font-semibold text-muted-foreground uppercase tracking-wide leading-none">{title}</span>
 <p className={`text-2xl sm:text-3xl font-bold mt-1.5 sm:mt-0 ${accent}`}>{value}</p>
 <p className="text-[11px] sm:text-xs text-muted-foreground mt-1">{subtitle}</p>
 </div>
 <div className={`p-3 sm:p-2 rounded-xl border sm:self-start sm:w-fit sm:ml-auto ${iconBg}`}>
 <Icon className={`h-5 w-5 sm:h-4 sm:w-4 ${accent}`} />
 </div>
 </div>
 ))}
 </div>

 {/* Main Content */}
 <div className="grid gap-6 lg:grid-cols-3">

 {/* Left: Quota + Quick Actions */}
 <div className="lg:col-span-2 space-y-6">

 {/* Quota */}
 <div className="bg-card border border-border rounded-xl shadow-sm overflow-hidden">
 <div className="flex items-center gap-3 px-6 py-4 border-b border-border">
 <div className="p-1.5 bg-blue-50 border border-blue-100 rounded-lg">
 <TrendingUp className="h-4 w-4 text-blue-600" />
 </div>
 <h2 className="text-sm font-semibold text-foreground">Employee Creation Quota</h2>
 </div>
 <div className="px-6 py-5">
 <div className="flex items-end justify-between mb-3">
 <div>
 <span className="text-3xl font-bold text-foreground">{quota.employeesCreated || 0}</span>
 <span className="text-sm text-muted-foreground ml-2">of {quota.canCreateUpTo || 0} used</span>
 </div>
 <span className="text-xs font-medium px-2.5 py-1 rounded border border-border bg-background text-slate-600">
 {quota.remaining || 0} remaining
 </span>
 </div>
 <div className="w-full bg-secondary rounded-full h-2 overflow-hidden">
 <div
 className={`h-2 rounded-full transition-all duration-500 ${quotaBarColor}`}
 style={{ width: `${quotaPct}%` }}
 />
 </div>
 <p className="text-xs text-muted-foreground mt-2 text-right">{quotaPct}% capacity used</p>
 </div>
 </div>

 {/* Quick Actions */}
 <div className="grid grid-cols-3 gap-2 sm:gap-4">
 {quickActions.map(({ label, icon: Icon, path }) => (
 <button
 key={label}
 onClick={() => navigate(path)}
 className="bg-card border border-border rounded-xl p-3 sm:p-5 flex flex-col items-center justify-center gap-2 sm:gap-3 hover:border-blue-300 hover:bg-blue-50/40 transition-all duration-150 group shadow-sm hover:shadow-md"
 >
 <div className="p-2.5 sm:p-3 rounded-xl bg-secondary group-hover:bg-blue-100 border border-border group-hover:border-blue-200 transition-colors">
 <Icon className="h-4 w-4 sm:h-5 sm:w-5 text-muted-foreground group-hover:text-blue-600 transition-colors" />
 </div>
 <span className="text-[10px] sm:text-sm font-medium text-foreground group-hover:text-blue-700 transition-colors text-center leading-tight">{label}</span>
 </button>
 ))}
 </div>
 </div>

 {/* Right: Team Composition + Pending Leaves */}
 <div className="space-y-6">

 {/* Team Composition by Role + Position */}
 {positionStats.roles.length > 0 && (
 <div className="bg-card border border-border rounded-xl shadow-sm overflow-hidden">
 <div className="flex items-center justify-between px-5 py-4 border-b border-border">
 <div className="flex items-center gap-2.5">
 <div className="p-1.5 bg-blue-50 border border-blue-100 rounded-lg">
 <Briefcase className="h-3.5 w-3.5 text-blue-600" />
 </div>
 <h2 className="text-sm font-semibold text-foreground">Team Composition</h2>
 </div>
 <Badge className="bg-blue-50 text-blue-700 border-blue-200 text-xs">
 {allEmployees.filter(e => e.isActive !== false).length} active
 </Badge>
 </div>
 <div className="px-5 py-4 space-y-2.5">
 <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">By Role</p>
 {positionStats.roles.map(([role, count]) => (
 <div key={role} className="flex items-center gap-3">
 <span className="text-xs text-slate-600 w-28 truncate font-medium" title={role}>{role}</span>
 <div className="flex-1 bg-secondary rounded-full h-1.5 overflow-hidden">
 <div
 className="h-1.5 rounded-full bg-blue-500 transition-all duration-500"
 style={{ width: `${(count / maxRoleCount) * 100}%` }}
 />
 </div>
 <span className="text-xs font-semibold text-foreground w-6 text-right">{count}</span>
 </div>
 ))}
 {positionStats.positions.length > 0 && (
 <>
 <div className="border-t border-border pt-2.5 mt-2.5">
 <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">By Position</p>
 </div>
 {positionStats.positions.map(([pos, count]) => (
 <div key={pos} className="flex items-center gap-3">
 <span className="text-xs text-slate-600 w-28 truncate font-medium" title={pos}>{pos}</span>
 <div className="flex-1 bg-secondary rounded-full h-1.5 overflow-hidden">
 <div
 className="h-1.5 rounded-full bg-indigo-400 transition-all duration-500"
 style={{ width: `${(count / maxPosCount) * 100}%` }}
 />
 </div>
 <span className="text-xs font-semibold text-foreground w-6 text-right">{count}</span>
 </div>
 ))}
 </>
 )}
 </div>
 </div>
 )}

 {/* Pending Leaves */}
 <div className="bg-card border border-border rounded-xl shadow-sm overflow-hidden flex flex-col">
 <div className="flex items-center justify-between px-5 py-4 border-b border-border">
 <h2 className="text-sm font-semibold text-foreground">Pending Leaves</h2>
 <button
 onClick={() => navigate("/admin/leave-requests")}
 className="text-xs font-medium text-blue-600 hover:text-blue-800 transition-colors"
 >
 View All &rarr;
 </button>
 </div>

 <div className="flex-1 px-5 py-4">
 {!leaves.pending?.length ? (
 <div className="flex flex-col items-center justify-center h-full py-10 text-center">
 <div className="p-3 bg-secondary rounded-full mb-3">
 <FileText className="h-6 w-6 text-slate-300" />
 </div>
 <p className="text-sm text-muted-foreground">No pending requests</p>
 </div>
 ) : (
 <div className="space-y-2">
 {leaves.pending.slice(0, 5).map((leave, i) => (
 <div
 key={i}
 className="flex items-start gap-3 p-3 rounded-lg border border-border bg-background hover:bg-secondary/70 transition-colors"
 >
 <div className="mt-0.5 p-1.5 rounded-md bg-card border border-border shrink-0">
 <Clock className="h-3.5 w-3.5 text-blue-500" />
 </div>
 <div className="flex-1 min-w-0">
 <p className="text-sm font-medium text-foreground truncate">
 {leave.userName || leave.employeeName || 'Employee'}
 </p>
 <div className="flex items-center gap-2 mt-1 flex-wrap">
 <span className="inline-block text-[10px] font-medium px-2 py-0.5 rounded border border-border bg-card text-slate-600">
 {leave.leaveType}
 </span>
 <span className="text-xs text-muted-foreground">{leave.startDate}</span>
 </div>
 </div>
 </div>
 ))}
 </div>
 )}
 </div>
 </div>
 </div>
 </div>
 </div>
 )
}