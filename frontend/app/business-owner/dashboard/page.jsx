import { useEffect, useState } from "react"
import { useNavigate } from "react-router-dom"
import { useQuery, useQueryClient } from "@tanstack/react-query"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
import {
  Building2, Users, Shield, UserCheck, FileText,
  RefreshCw, AlertCircle, ChevronRight,
  Settings, Eye, Clock, CalendarDays
} from "lucide-react"
import { getCurrentUser, isAuthenticated } from "@/lib/auth"
import { getValidIdToken } from "@/lib/firebaseClient"

const getApiBase = () => {
  const url = import.meta.env.VITE_API_URL || ""
  return url.endsWith('/api') ? url : `${url}/api`
}

// Fetcher function (extracted so useQuery can call it)
const fetchDashboardData = async () => {
  const token = await getValidIdToken()
  if (!token) throw new Error("Authentication token not found. Please login again.")
  const base = getApiBase()

  const [dashboardRes, adminQuotaRes] = await Promise.all([
    fetch(`${base}/admin/dashboard/stats`, {
      headers: { Authorization: `Bearer ${token}` },
    }),
    fetch(`${base}/admin/admins/quota-status`, {
      headers: { Authorization: `Bearer ${token}` },
    })
  ])

  const dashboardData = dashboardRes.ok ? await dashboardRes.json() : null
  if (dashboardRes.status === 401) throw new Error("SESSION_EXPIRED")
  if (!dashboardRes.ok) {
    const errData = await dashboardRes.json().catch(() => ({}))
    throw new Error(errData.error || "Failed to load dashboard")
  }

  const adminQuotas = adminQuotaRes.ok ? (await adminQuotaRes.json()).admins || [] : []

  return { dashboardData, adminQuotas }
}

export default function BusinessOwnerDashboardPage() {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [currentUser, setCurrentUser] = useState(null)

  // Auth check
  useEffect(() => {
    if (!isAuthenticated()) {
      navigate("/login")
      return
    }
    const user = getCurrentUser()
    if (!user || user.role !== "business_owner") {
      navigate("/login")
      return
    }
    setCurrentUser(user)
  }, [navigate])

  // TanStack Query — cached, auto-refetch when stale
  const { data, isLoading: loading, error: queryError } = useQuery({
    queryKey: ['bo-dashboard'],
    queryFn: fetchDashboardData,
    enabled: !!currentUser,
  })

  const dashboardData = data?.dashboardData || null
  const adminQuotas = data?.adminQuotas || []
  const error = queryError?.message === "SESSION_EXPIRED"
    ? (() => { setTimeout(() => navigate("/login"), 2000); return "Session expired. Please login again." })()
    : queryError?.message || null

  const loadDashboard = () => queryClient.invalidateQueries({ queryKey: ['bo-dashboard'] })

  // Calculate organization quota percentage
  const getOrgQuotaPercentage = () => {
    if (!dashboardData?.quota?.utilization?.employees) return 0
    const { current, max } = dashboardData.quota.utilization.employees
    if (!max) return 0
    return Math.min(Math.round((current / max) * 100), 100)
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <RefreshCw className="h-8 w-8 animate-spin mx-auto mb-2 text-blue-600" />
          <p className="text-muted-foreground">Loading dashboard...</p>
        </div>
      </div>
    )
  }

  const employees = dashboardData?.employees || { total: 0, active: 0, inactive: 0 }
  const attendance = dashboardData?.attendance || { present: 0, absent: 0, onLeave: 0 }
  const leaves = dashboardData?.leaves || { pendingCount: 0, pending: [] }
  const quota = dashboardData?.quota || {}

  const statsData = [
    {
      title: "Total Employees",
      value: employees.active || 0,
      subtitle: `${employees.inactive || 0} inactive`,
      icon: Users,
      color: "text-blue-600",
      bgColor: "bg-blue-50 dark:bg-blue-900/30",
      borderColor: "border-slate-200 dark:border-slate-800"
    },
    {
      title: "Admins",
      value: adminQuotas.length,
      subtitle: "Managing employees",
      icon: Shield,
      color: "text-slate-600",
      bgColor: "bg-slate-100 dark:bg-slate-800",
      borderColor: "border-slate-200 dark:border-slate-800"
    },
    {
      title: "Present Today",
      value: attendance.present || 0,
      subtitle: "Checked in",
      icon: UserCheck,
      color: "text-blue-600",
      bgColor: "bg-blue-50 dark:bg-blue-900/30",
      borderColor: "border-slate-200 dark:border-slate-800"
    },
    {
      title: "Pending Leaves",
      value: leaves.pendingCount || 0,
      subtitle: "Awaiting approval",
      icon: FileText,
      color: "text-blue-600",
      bgColor: "bg-blue-50 dark:bg-blue-900/30",
      borderColor: "border-slate-200 dark:border-slate-800"
    },
  ]

  return (
    <div className="space-y-6 animate-in fade-in-50 duration-500">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-50">
            Overview
          </h1>
          <p className="text-slate-500 mt-1">
            Manage your organization and oversee operations
          </p>
        </div>
        <div className="flex gap-2">
          <Button onClick={loadDashboard} variant="outline" size="sm" className="gap-2 border-blue-200 text-blue-600 hover:bg-blue-50 hover:text-blue-700">
            <RefreshCw className="h-4 w-4" />
            Refresh
          </Button>
        </div>
      </div>

      {/* Error Alert */}
      {error && (
        <Card className="border-red-200 bg-red-50 dark:bg-red-950/30">
          <CardContent className="pt-6">
            <div className="flex gap-3">
              <AlertCircle className="h-5 w-5 text-red-600 flex-shrink-0" />
              <div>
                <p className="font-medium text-red-900 dark:text-red-200">Error</p>
                <p className="text-sm text-red-700 dark:text-red-300 mt-1">{error}</p>
                <Button size="sm" variant="outline" onClick={loadDashboard} className="mt-2 text-red-700 border-red-200 hover:bg-red-100">
                  <RefreshCw className="mr-2 h-4 w-4" />
                  Retry
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Stats Grid */}
      <div className="grid gap-3 sm:gap-4 grid-cols-2 lg:grid-cols-4">
        {statsData.map((stat, index) => {
          const Icon = stat.icon
          return (
            <Card
              key={index}
              className={`relative overflow-hidden transition-all duration-300 hover:shadow-md border ${stat.borderColor}`}
            >
              <CardHeader className="relative flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium text-slate-500">
                  {stat.title}
                </CardTitle>
                <div className={`p-2 rounded-lg ${stat.bgColor}`}>
                  <Icon className={`h-4 w-4 ${stat.color}`} />
                </div>
              </CardHeader>
              <CardContent className="relative">
                <div className="text-2xl sm:text-3xl font-bold tracking-tight text-slate-900 dark:text-slate-100">{stat.value}</div>
                <p className="text-xs text-slate-500 mt-1">{stat.subtitle}</p>
              </CardContent>
            </Card>
          )
        })}
      </div>

      {/* Organization Quota Overview */}
      <Card className="transition-all duration-300 hover:shadow-md border-slate-200">
        <CardHeader className="pb-3 border-b border-slate-100 dark:border-slate-800">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-base font-semibold text-slate-900 dark:text-slate-100">Organization Capacity</CardTitle>
              <p className="text-sm text-slate-500 mt-1">
                Monitor your organization's resource utilization
              </p>
            </div>
            <div className="p-2 rounded-lg bg-blue-50 dark:bg-blue-900/30">
              <Building2 className="h-5 w-5 text-blue-600" />
            </div>
          </div>
        </CardHeader>
        <CardContent className="pt-6">
          <div className="grid gap-6 sm:gap-8 sm:grid-cols-3">
            {/* Employees Quota */}
            <div className="space-y-3">
              <div className="flex justify-between items-center">
                <span className="text-sm font-medium text-slate-700 dark:text-slate-300">Employees</span>
                <span className="text-sm text-slate-500">
                  <span className="font-semibold text-slate-900 dark:text-slate-100">{quota?.utilization?.employees?.current || 0}</span> / {quota?.utilization?.employees?.max || 0}
                </span>
              </div>
              <Progress
                value={getOrgQuotaPercentage()}
                className="h-2 bg-slate-100 dark:bg-slate-800 [&>div]:bg-blue-600"
              />
              <p className="text-xs text-slate-400">
                {quota?.utilization?.employees?.remaining || 0} slots available
              </p>
            </div>
            {/* Admins Quota */}
            <div className="space-y-3">
              <div className="flex justify-between items-center">
                <span className="text-sm font-medium text-slate-700 dark:text-slate-300">Admins</span>
                <span className="text-sm text-slate-500">
                  <span className="font-semibold text-slate-900 dark:text-slate-100">{adminQuotas.length}</span> / {quota?.utilization?.admins?.max || 0}
                </span>
              </div>
              <Progress
                value={quota?.utilization?.admins?.max ? (adminQuotas.length / quota.utilization.admins.max) * 100 : 0}
                className="h-2 bg-slate-100 dark:bg-slate-800 [&>div]:bg-slate-600"
              />
              <p className="text-xs text-slate-400">
                {Math.max(0, (quota?.utilization?.admins?.max || 0) - adminQuotas.length)} admin slots available
              </p>
            </div>
            {/* Business Owners Quota */}
            <div className="space-y-3">
              <div className="flex justify-between items-center">
                <span className="text-sm font-medium text-slate-700 dark:text-slate-300">Business Owners</span>
                <span className="text-sm text-slate-500">
                  <span className="font-semibold text-slate-900 dark:text-slate-100">{quota?.utilization?.businessOwners?.current || 1}</span> / {quota?.utilization?.businessOwners?.max || 5}
                </span>
              </div>
              <Progress
                value={quota?.utilization?.businessOwners?.max ? ((quota?.utilization?.businessOwners?.current || 1) / quota.utilization.businessOwners.max) * 100 : 20}
                className="h-2 bg-slate-100 dark:bg-slate-800 [&>div]:bg-slate-600"
              />
              <p className="text-xs text-slate-400">
                {quota?.utilization?.businessOwners?.remaining || 0} slots available
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Admin Management and Pending Leaves Row */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Admin Quota Management */}
        <Card className="transition-all duration-300 hover:shadow-md border-slate-200">
          <CardHeader className="pb-3 border-b border-slate-100 dark:border-slate-800">
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-base font-semibold text-slate-900 dark:text-slate-100">Admin Quota Management</CardTitle>
                <p className="text-sm text-slate-500 mt-1">
                  Monitor and manage admin employee creation limits
                </p>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => navigate("/business-owner/employees")}
                className="text-blue-600 hover:text-blue-700 hover:bg-blue-50 h-8"
              >
                Manage
                <ChevronRight className="h-4 w-4 ml-1" />
              </Button>
            </div>
          </CardHeader>
          <CardContent className="pt-6">
            {adminQuotas.length === 0 ? (
              <div className="text-center py-8 text-slate-400">
                <Shield className="h-10 w-10 mx-auto mb-2 opacity-20" />
                <p>No admins created yet</p>
                <p className="text-xs mt-1">Create admins to delegate employee management</p>
              </div>
            ) : (
              <div className="space-y-4">
                {adminQuotas.slice(0, 4).map(admin => {
                  const usage = admin.quota?.limit ? (admin.quota.created / admin.quota.limit) * 100 : 0
                  return (
                    <div
                      key={admin.id}
                      className="p-4 rounded-lg bg-slate-50 dark:bg-slate-900/50 border border-slate-100 dark:border-slate-800"
                    >
                      <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center gap-3">
                          <div className="h-9 w-9 rounded-full bg-white border border-slate-200 dark:border-slate-700 flex items-center justify-center shadow-sm">
                            <Shield className="h-4 w-4 text-slate-600" />
                          </div>
                          <div>
                            <p className="font-medium text-sm text-slate-900 dark:text-slate-100">{admin.name}</p>
                            <p className="text-xs text-slate-500">{admin.email}</p>
                          </div>
                        </div>
                        <Badge variant="secondary" className="bg-white border-slate-200 text-slate-700 hover:bg-slate-50">
                          {admin.quota?.created || 0} / {admin.quota?.limit || 0}
                        </Badge>
                      </div>
                      <Progress value={usage} className="h-1.5 bg-slate-200 dark:bg-slate-700 [&>div]:bg-blue-500" />
                    </div>
                  )
                })}
                {adminQuotas.length > 4 && (
                  <p className="text-sm text-center text-slate-500 pt-2">
                    +{adminQuotas.length - 4} more admins
                  </p>
                )}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Pending Leave Requests */}
        <Card className="transition-all duration-300 hover:shadow-md border-slate-200">
          <CardHeader className="pb-3 border-b border-slate-100 dark:border-slate-800">
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-base font-semibold text-slate-900 dark:text-slate-100">Pending Leave Requests</CardTitle>
                <p className="text-sm text-slate-500 mt-1">
                  {leaves.pendingCount} request{leaves.pendingCount !== 1 ? 's' : ''} in queue
                </p>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => navigate("/business-owner/leave-requests")}
                className="text-blue-600 hover:text-blue-700 hover:bg-blue-50 h-8"
              >
                View All
                <ChevronRight className="h-4 w-4 ml-1" />
              </Button>
            </div>
          </CardHeader>
          <CardContent className="pt-6">
            {leaves.pending?.length === 0 ? (
              <div className="text-center py-8 text-slate-400">
                <FileText className="h-10 w-10 mx-auto mb-2 opacity-20" />
                <p>No pending leave requests</p>
              </div>
            ) : (
              <div className="space-y-3">
                {leaves.pending?.slice(0, 4).map((leave, i) => (
                  <div
                    key={leave.id || i}
                    className="flex items-center justify-between p-3 rounded-lg bg-slate-50 dark:bg-slate-900/50 border border-slate-100 dark:border-slate-800 hover:bg-slate-100 transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      <div className="h-9 w-9 rounded-full bg-blue-50 border border-blue-100 flex items-center justify-center">
                        <Clock className="h-4 w-4 text-blue-600" />
                      </div>
                      <div>
                        <p className="font-medium text-sm text-slate-900 dark:text-slate-100">{leave.userName || leave.employeeName || 'Employee'}</p>
                        <p className="text-xs text-slate-500">
                          {leave.leaveType} • {leave.startDate} - {leave.endDate}
                        </p>
                      </div>
                    </div>
                    <Badge variant="outline" className="text-blue-600 border-blue-200 bg-blue-50">
                      Pending
                    </Badge>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Quick Actions */}
      <Card className="transition-all duration-300 hover:shadow-md border-slate-200">
        <CardHeader className="pb-3 border-b border-slate-100 dark:border-slate-800">
          <CardTitle className="text-base font-semibold text-slate-900 dark:text-slate-100">Quick Actions</CardTitle>
        </CardHeader>
        <CardContent className="pt-6">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4">
            <Button
              variant="outline"
              className="h-auto py-4 flex flex-col gap-3 border-blue-100 hover:border-blue-300 hover:bg-blue-50 dark:hover:bg-blue-900/10 transition-all group shadow-sm hover:shadow-md"
              onClick={() => navigate("/business-owner/employees")}
            >
              <div className="p-3 rounded-full bg-blue-100/50 group-hover:bg-blue-200/50 transition-colors">
                <Users className="h-6 w-6 text-blue-600" />
              </div>
              <span className="text-sm font-semibold text-blue-900 dark:text-blue-100">View Employees</span>
            </Button>
            <Button
              variant="outline"
              className="h-auto py-4 flex flex-col gap-3 border-blue-100 hover:border-blue-300 hover:bg-blue-50 dark:hover:bg-blue-900/10 transition-all group shadow-sm hover:shadow-md"
              onClick={() => navigate("/business-owner/attendance")}
            >
              <div className="p-3 rounded-full bg-blue-100/50 group-hover:bg-blue-200/50 transition-colors">
                <Eye className="h-6 w-6 text-blue-600" />
              </div>
              <span className="text-sm font-semibold text-blue-900 dark:text-blue-100">View Attendance</span>
            </Button>
            <Button
              variant="outline"
              className="h-auto py-4 flex flex-col gap-3 border-blue-100 hover:border-blue-300 hover:bg-blue-50 dark:hover:bg-blue-900/10 transition-all group shadow-sm hover:shadow-md"
              onClick={() => navigate("/business-owner/leave-requests")}
            >
              <div className="p-3 rounded-full bg-blue-100/50 group-hover:bg-blue-200/50 transition-colors">
                <FileText className="h-6 w-6 text-blue-600" />
              </div>
              <span className="text-sm font-semibold text-blue-900 dark:text-blue-100">Leave Requests</span>
            </Button>
            <Button
              variant="outline"
              className="h-auto py-4 flex flex-col gap-3 border-blue-100 hover:border-blue-300 hover:bg-blue-50 dark:hover:bg-blue-900/10 transition-all group shadow-sm hover:shadow-md"
              onClick={() => navigate("/business-owner/profile")}
            >
              <div className="p-3 rounded-full bg-blue-100/50 group-hover:bg-blue-200/50 transition-colors">
                <Settings className="h-6 w-6 text-blue-600" />
              </div>
              <span className="text-sm font-semibold text-blue-900 dark:text-blue-100">Settings</span>
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
