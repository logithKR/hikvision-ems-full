import { useEffect, useState } from "react"
import { useNavigate } from "react-router-dom"
import { useQuery, useQueryClient } from "@tanstack/react-query"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
import {
  Clock, Calendar, FileText, BarChart2, Coffee, LogOut,
  CheckCircle, RefreshCw, ChevronRight, CalendarDays, AlertCircle, MapPin
} from "lucide-react"
import { format } from "date-fns"
import { safeRedirect } from "@/lib/redirectUtils"
import { getCurrentUser, isAuthenticated } from "@/lib/auth"
import { getValidIdToken } from "@/lib/firebaseClient"

export default function EmployeeDashboardPage() {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [currentUser, setCurrentUser] = useState(null)

  // Auth Check
  useEffect(() => {
    if (!isAuthenticated()) {
      safeRedirect(navigate, "/login")
      return
    }

    const user = getCurrentUser()
    if (!user || user.role !== 'employee') {
      safeRedirect(navigate, "/login")
      return
    }

    setCurrentUser(user)
  }, [navigate])

  const getApiBase = () => import.meta.env.VITE_API_URL || ''

  const { data: dashboardData = {}, isLoading: loading, error: queryError } = useQuery({
    queryKey: ['emp-dashboard'],
    queryFn: async () => {
      const token = await getValidIdToken()
      const base = getApiBase()
      const [todayRes, weeklyRes, balanceRes, upcomingRes, recordsRes] = await Promise.all([
        fetch(`${base}/api/attendance/today`, { headers: { 'Authorization': `Bearer ${token}` } }),
        fetch(`${base}/api/attendance/weekly-hours`, { headers: { 'Authorization': `Bearer ${token}` } }),
        fetch(`${base}/api/leave/balance`, { headers: { 'Authorization': `Bearer ${token}` } }),
        fetch(`${base}/api/leave/upcoming`, { headers: { 'Authorization': `Bearer ${token}` } }),
        fetch(`${base}/api/attendance/my-records`, { headers: { 'Authorization': `Bearer ${token}` } })
      ])

      const result = {}
      if (todayRes.ok) result.attendance = await todayRes.json()
      if (weeklyRes.ok) { const d = await weeklyRes.json(); result.stats = { totalHours: d.stats?.totalHours || 0, daysPresent: d.stats?.daysWorked || 0 } }
      else result.stats = { totalHours: 0, daysPresent: 0 }
      if (balanceRes.ok) { const d = await balanceRes.json(); result.leaveBalance = d.data || null }
      if (upcomingRes.ok) { const d = await upcomingRes.json(); result.upcomingLeaves = d.data || [] }
      if (recordsRes.ok) {
        const records = await recordsRes.json()
        const recordsArray = Array.isArray(records) ? records : (records.data || records.records || [])
        const items = recordsArray.slice(0, 5).flatMap(d => {
          const events = []
          if (d.checkIn) events.push({ label: `Checked in at ${d.checkIn}`, when: d.date, color: 'bg-blue-600', icon: 'CheckCircle' })
          if (d.breakIn) events.push({ label: `Started break at ${d.breakIn}`, when: d.date, color: 'bg-slate-400', icon: 'Coffee' })
          if (d.breakOut) events.push({ label: `Ended break at ${d.breakOut}`, when: d.date, color: 'bg-blue-400', icon: 'Coffee' })
          if (d.checkOut) events.push({ label: `Checked out at ${d.checkOut}`, when: d.date, color: 'bg-slate-600', icon: 'LogOut' })
          return events
        })
        result.recent = items.slice(0, 5)
      }
      return result
    },
    enabled: !!currentUser,
  })

  const attendance = dashboardData?.attendance || null
  const stats = dashboardData?.stats || { totalHours: 0, daysPresent: 0 }
  const leaveBalance = dashboardData?.leaveBalance || null
  const upcomingLeaves = dashboardData?.upcomingLeaves || []
  const recent = (dashboardData?.recent || []).map(item => ({
    ...item,
    icon: item.icon === 'CheckCircle' ? CheckCircle : item.icon === 'Coffee' ? Coffee : LogOut
  }))
  const error = queryError?.message || null
  const loadDashboardData = () => queryClient.invalidateQueries({ queryKey: ['emp-dashboard'] })

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

  if (!currentUser) return null

  const isWorking = attendance?.checkIn && !attendance?.checkOut
  const isOnBreak = attendance?.breakIn && !attendance?.breakOut

  return (
    <div className="space-y-6 animate-in fade-in-50 duration-500">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-slate-900 dark:text-slate-50">
            Welcome back, {currentUser.name.split(' ')[0]}! 👋
          </h1>
          <p className="text-slate-500 mt-1">
            {format(new Date(), "EEEE, MMMM do, yyyy")} • Here's your daily overview
          </p>
        </div>
        <Button onClick={loadDashboardData} variant="outline" size="sm" className="gap-2 border-slate-200 hover:bg-slate-50 text-slate-700">
          <RefreshCw className="h-4 w-4" />
          Refresh
        </Button>
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
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Main Grid */}
      <div className="grid gap-6 lg:grid-cols-3">
        {/* Time Tracker Card - Takes 2 columns */}
        <Card className="lg:col-span-2 transition-all duration-300 hover:shadow-md border border-blue-100 dark:border-blue-900 shadow-sm">
          <CardHeader className="pb-4 border-b border-slate-100 dark:border-slate-800">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2.5 rounded-lg bg-blue-50 dark:bg-blue-900/30">
                  <Clock className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                </div>
                <div>
                  <CardTitle className="text-base font-semibold text-slate-900 dark:text-slate-100">Time Tracker</CardTitle>
                  <CardDescription>Track your work hours</CardDescription>
                </div>
              </div>
              <div className="flex items-center gap-2 px-3 py-1 rounded-full bg-slate-50 dark:bg-slate-800 border border-slate-100 dark:border-slate-700">
                <span className={`animate-pulse h-2.5 w-2.5 rounded-full ${isWorking ? 'bg-blue-600' : 'bg-slate-400'}`} />
                <span className="text-sm font-medium text-slate-700 dark:text-slate-300">
                  {isWorking ? (isOnBreak ? 'On Break' : 'Working') : 'Not Working'}
                </span>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-0 p-6">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
              <div className="space-y-1">
                <p className="text-xs font-medium text-slate-500 uppercase tracking-wider">Check In</p>
                <p className="text-lg sm:text-2xl font-mono font-bold tracking-tight text-slate-900 dark:text-slate-100">{attendance?.checkIn || '--:--'}</p>
              </div>
              <div className="space-y-1">
                <p className="text-xs font-medium text-slate-500 uppercase tracking-wider">Check Out</p>
                <p className="text-lg sm:text-2xl font-mono font-bold tracking-tight text-slate-900 dark:text-slate-100">{attendance?.checkOut || '--:--'}</p>
              </div>
              <div className="space-y-1">
                <p className="text-xs font-medium text-slate-500 uppercase tracking-wider">Break</p>
                <div className="flex items-center gap-2">
                  <Coffee className="h-4 w-4 text-slate-400" />
                  <p className="text-lg font-mono font-medium text-slate-700 dark:text-slate-300">
                    {attendance?.breakIn && attendance?.breakOut ? 'Done' : (attendance?.breakIn ? 'Active' : '--')}
                  </p>
                </div>
              </div>
              <div className="space-y-1">
                <p className="text-xs font-medium text-slate-500 uppercase tracking-wider">Total</p>
                <Badge variant="outline" className="text-lg px-2.5 py-0.5 border-blue-200 bg-blue-50 text-blue-700 dark:border-blue-800 dark:bg-blue-950/30 dark:text-blue-400 font-mono">
                  {attendance?.totalHours || '0h 0m'}
                </Badge>
              </div>
            </div>

            <div className="mt-8 pt-6 border-t border-slate-100 dark:border-slate-800">
              <Button className="w-full bg-blue-600 hover:bg-blue-700 text-white" onClick={() => navigate('/employee/attendance')}>
                Go to Attendance Page <ChevronRight className="ml-2 h-4 w-4" />
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Stats Column */}
        <div className="space-y-6">
          <Card className="shadow-sm border-slate-200">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-slate-500">Weekly Overview</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-2xl sm:text-3xl font-bold text-slate-900 dark:text-slate-100">{stats.totalHours} <span className="text-base sm:text-lg font-normal text-slate-500">hrs</span></span>
                    <BarChart2 className="h-5 w-5 text-blue-500" />
                  </div>
                  <Progress value={Math.min((parseFloat(stats.totalHours) / 40) * 100, 100)} className="h-2 bg-slate-100 dark:bg-slate-800 [&>div]:bg-blue-600" />
                  <p className="text-xs text-slate-500 mt-3 flex items-center gap-1">
                    <CheckCircle className="h-3 w-3 text-blue-600" />
                    {stats.daysPresent} days present this week
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="shadow-sm border-slate-200">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-slate-500">Annual Leave</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <span className="text-2xl sm:text-3xl font-bold text-slate-900 dark:text-slate-100">{leaveBalance?.annual?.remaining || 0}</span>
                    <span className="text-sm text-slate-400 ml-1">/ {leaveBalance?.annual?.total || 0}</span>
                  </div>
                  <FileText className="h-5 w-5 text-blue-400" />
                </div>
                <p className="text-xs text-slate-500">Days remaining this year</p>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Leave Balance and Recent Activity Row */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Leave Balance */}
        <Card className="transition-all duration-300 hover:shadow-md border-slate-200">
          <CardHeader className="pb-3 border-b border-slate-50 dark:border-slate-800">
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-base font-semibold text-slate-900 dark:text-slate-100">Leave Balance</CardTitle>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => navigate("/employee/leave-requests")}
                className="text-blue-600 hover:text-blue-700 hover:bg-blue-50 h-8"
              >
                Apply
                <ChevronRight className="h-3.5 w-3.5 ml-1" />
              </Button>
            </div>
          </CardHeader>
          <CardContent className="pt-6">
            {leaveBalance && leaveBalance.allocated ? (
              <div className="space-y-5">
                {Object.entries(leaveBalance.allocated).map(([type, total]) => {
                  const used = leaveBalance.used?.[type] || 0
                  const remaining = leaveBalance.remaining?.[type] || (total - used)
                  const percentage = total > 0 ? (used / total) * 100 : 0
                  return (
                    <div key={type} className="space-y-2">
                      <div className="flex justify-between items-center">
                        <span className="text-sm font-medium text-slate-700 dark:text-slate-300 capitalize">{type}</span>
                        <span className="text-sm">
                          <span className="font-bold text-slate-900 dark:text-white">{remaining}</span>
                          <span className="text-slate-400 text-xs ml-1">left</span>
                        </span>
                      </div>
                      <Progress value={percentage} className="h-1.5 bg-slate-100 dark:bg-slate-800 [&>div]:bg-blue-500" />
                    </div>
                  )
                })}
              </div>
            ) : (
              <div className="text-center py-6 text-slate-400">
                <CalendarDays className="h-10 w-10 mx-auto mb-2 opacity-20" />
                <p>Leave balance not available</p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Recent Activity */}
        <Card className="transition-all duration-300 hover:shadow-md border-slate-200">
          <CardHeader className="pb-3 border-b border-slate-50 dark:border-slate-800">
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-base font-semibold text-slate-900 dark:text-slate-100">Recent Activity</CardTitle>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => navigate("/employee/attendance")}
                className="text-blue-600 hover:text-blue-700 hover:bg-blue-50 h-8"
              >
                View All
                <ChevronRight className="h-3.5 w-3.5 ml-1" />
              </Button>
            </div>
          </CardHeader>
          <CardContent className="pt-6">
            {recent.length === 0 ? (
              <div className="text-center py-6 text-slate-400">
                <Clock className="h-10 w-10 mx-auto mb-2 opacity-20" />
                <p>No recent activity</p>
              </div>
            ) : (
              <div className="relative pl-2 border-l border-slate-100 dark:border-slate-800 space-y-0">
                {recent.map((item, i) => {
                  const Icon = item.icon
                  return (
                    <div key={i} className="mb-6 last:mb-0 relative pl-6 group">
                      <span className={`absolute -left-[9px] top-1 h-4 w-4 rounded-full border-2 border-white dark:border-slate-900 ${item.color.replace('bg-', 'bg-')}`} />
                      <div className="flex flex-col">
                        <span className="text-sm font-medium text-slate-900 dark:text-slate-100">{item.label}</span>
                        <span className="text-xs text-slate-500">
                          {format(new Date(item.when), "MMM d, h:mm a")}
                        </span>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Upcoming Leaves */}
      {upcomingLeaves.length > 0 && (
        <Card className="transition-all duration-300 hover:shadow-md border-slate-200">
          <CardHeader className="pb-3 border-b border-slate-50 dark:border-slate-800">
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-base font-semibold text-slate-900 dark:text-slate-100">Upcoming Leaves</CardTitle>
              </div>
            </div>
          </CardHeader>
          <CardContent className="pt-6">
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {upcomingLeaves.slice(0, 3).map((leave, i) => (
                <div
                  key={leave.id || i}
                  className="p-4 rounded-xl bg-white border border-slate-200 shadow-sm hover:border-blue-200 transition-colors"
                >
                  <div className="flex items-center gap-2 mb-3">
                    <div className="p-1.5 bg-blue-50 rounded-md text-blue-600">
                      <CalendarDays className="h-4 w-4" />
                    </div>
                    <Badge variant="outline" className="text-blue-700 bg-blue-50 border-blue-100">
                      {leave.leaveType}
                    </Badge>
                  </div>
                  <p className="font-semibold text-sm text-slate-900">
                    {format(new Date(leave.startDate), "MMM d")} - {format(new Date(leave.endDate), "MMM d, yyyy")}
                  </p>
                  <p className="text-xs text-slate-500 mt-2 line-clamp-2">{leave.reason || 'No reason provided'}</p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
