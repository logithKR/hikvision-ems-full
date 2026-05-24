import { useEffect, useState, useMemo } from "react"
import { useNavigate } from "react-router-dom"
import { useQuery } from "@tanstack/react-query"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import {
  Clock, Calendar, BarChart2, Coffee, RefreshCw,
  ChevronRight, AlertCircle, MapPin, Map, CalendarDays,
  Activity, User, Users, Building, CheckCircle2, XCircle,
  Hourglass, ArrowRight, Briefcase
} from "lucide-react"
import { format, subDays, getDay, parseISO, differenceInDays } from "date-fns"
import { safeRedirect } from "@/lib/redirectUtils"
import { getCurrentUser, isAuthenticated } from "@/lib/auth"
import { getValidIdToken } from "@/lib/firebaseClient"
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"

// ─── Live Clock ──────────────────────────────────────────────────────────────
function LiveClock() {
  const [time, setTime] = useState(new Date())
  useEffect(() => {
    const t = setInterval(() => setTime(new Date()), 1000)
    return () => clearInterval(t)
  }, [])
  return (
    <div className="flex flex-col">
      <div className="text-5xl md:text-6xl font-bold text-white tracking-tighter flex items-baseline">
        {format(time, "hh:mm")}
        <span className="text-xl md:text-2xl ml-2 text-blue-200 font-medium">{format(time, "ss a")}</span>
      </div>
      <span className="text-sm text-blue-100 font-medium mt-1 opacity-90">
        {format(time, "EEEE, MMMM do, yyyy")}
      </span>
    </div>
  )
}

// ─── SVG Donut Ring ───────────────────────────────────────────────────────────
function ProgressRing({ radius, stroke, progress, total, colorClass, label, sublabel }) {
  const nr = radius - stroke * 2
  const circ = nr * 2 * Math.PI
  const pct = Math.min((progress / (total || 1)) * 100, 100) || 0
  const offset = circ - (pct / 100) * circ
  return (
    <div className="relative flex items-center justify-center">
      <svg height={radius * 2} width={radius * 2} className="-rotate-90">
        <circle stroke="currentColor" fill="transparent" strokeWidth={stroke} r={nr} cx={radius} cy={radius} className="text-slate-100 dark:text-slate-800" />
        <circle stroke="currentColor" fill="transparent" strokeWidth={stroke}
          strokeDasharray={`${circ} ${circ}`}
          style={{ strokeDashoffset: offset, transition: 'stroke-dashoffset 1s ease-out' }}
          strokeLinecap="round" r={nr} cx={radius} cy={radius} className={colorClass} />
      </svg>
      <div className="absolute flex flex-col items-center justify-center text-center">
        <span className="text-xl font-bold text-slate-800 dark:text-slate-100 tracking-tight leading-none">{label}</span>
        {sublabel && <span className="text-[9px] text-slate-400 font-bold uppercase tracking-widest mt-1">{sublabel}</span>}
      </div>
    </div>
  )
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
const parseTimeToMinutes = (s) => {
  if (!s || typeof s !== 'string') return 0
  const m = s.match(/(\d+):(\d+)\s*(AM|PM)?/i)
  if (!m) return 0
  let h = parseInt(m[1]); const min = parseInt(m[2]); const ap = m[3]
  if (ap) { if (ap.toUpperCase() === 'PM' && h < 12) h += 12; if (ap.toUpperCase() === 'AM' && h === 12) h = 0 }
  return h * 60 + min
}

const getInitials = (name) => name ? name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2) : '??'

const STANDARD_MINS = 24 * 60

// ─── Main Dashboard ───────────────────────────────────────────────────────────
export default function EmployeeDashboardPage() {
  const navigate = useNavigate()
  const [currentUser, setCurrentUser] = useState(null)

  useEffect(() => {
    if (!isAuthenticated()) { safeRedirect(navigate, "/login"); return }
    const u = getCurrentUser()
    if (!u || u.role !== 'employee') { safeRedirect(navigate, "/login"); return }
    setCurrentUser(u)
  }, [navigate])

  const apiBase = () => import.meta.env.VITE_API_URL || ''

  const { data = {}, isLoading } = useQuery({
    queryKey: ['emp-dashboard-full'],
    queryFn: async () => {
      const token = await getValidIdToken()
      const base = apiBase()
      const H = { 'Authorization': `Bearer ${token}` }

      const [weeklyRes, balanceRes, recordsRes, leavesRes, profileRes] = await Promise.all([
        fetch(`${base}/api/attendance/weekly-hours`, { headers: H }),
        fetch(`${base}/api/leave/balance`, { headers: H }),
        fetch(`${base}/api/attendance/my-records?limit=30`, { headers: H }),
        fetch(`${base}/api/leave/my-leaves`, { headers: H }),
        fetch(`${base}/api/auth/profile`, { headers: H }),
      ])

      const r = {}

      if (weeklyRes.ok) {
        const d = await weeklyRes.json()
        r.stats = { totalHours: d.stats?.totalHours || 0, daysPresent: d.stats?.daysWorked || 0, averagePerDay: d.stats?.averagePerDay || 0, longestDay: d.stats?.longestDay || 0 }
        r.weeklyRecords = d.records || []
      } else { r.stats = { totalHours: 0, daysPresent: 0, averagePerDay: 0, longestDay: 0 }; r.weeklyRecords = [] }

      if (balanceRes.ok) { const d = await balanceRes.json(); r.leaveBalance = d.data || null }
      if (recordsRes.ok) { const d = await recordsRes.json(); r.recent = Array.isArray(d) ? d : (d.data || d.records || []) } else { r.recent = [] }
      if (leavesRes.ok) { const d = await leavesRes.json(); r.myLeaves = d.data || d.requests || [] } else { r.myLeaves = [] }
      if (profileRes.ok) { const d = await profileRes.json(); r.profile = d.user || null } else { r.profile = null }

      return r
    },
    enabled: !!currentUser,
  })

  const stats = data?.stats || { totalHours: 0, daysPresent: 0, averagePerDay: 0, longestDay: 0 }
  const recent = data?.recent || []
  const leaveBalance = data?.leaveBalance || null
  const myLeaves = data?.myLeaves || []
  const profile = data?.profile || null

  const todayStr = format(new Date(), 'yyyy-MM-dd')
  const todayRecord = recent.find(r => r.date === todayStr)
  const isWorking = !!(todayRecord?.checkIn && !todayRecord?.checkOut)
  const isOnBreak = !!(todayRecord?.breakIn && !todayRecord?.breakOut)

  const todayWorkMins = todayRecord ? parseTimeToMinutes(todayRecord.totalHours) : 0
  const todayHoursStr = todayWorkMins > 0 ? `${Math.floor(todayWorkMins / 60)}h ${todayWorkMins % 60}m` : '0h'

  // Days at company
  const daysAtCompany = useMemo(() => {
    if (!profile?.createdAt) return null
    const hire = profile.createdAt?._seconds
      ? new Date(profile.createdAt._seconds * 1000)
      : new Date(profile.createdAt)
    return differenceInDays(new Date(), hire)
  }, [profile])

  // 7-day trend
  const last7Days = useMemo(() => Array.from({ length: 7 }).map((_, i) => {
    const d = subDays(new Date(), 6 - i)
    const rec = recent.find(r => r.date === format(d, 'yyyy-MM-dd'))
    const mins = rec ? (rec.hoursWorked ? rec.hoursWorked * 60 : parseTimeToMinutes(rec.totalHours)) : 0
    return { date: d, dayName: format(d, 'EEE'), mins, h: Math.min((mins / STANDARD_MINS) * 100, 100) }
  }), [recent])

  // 30-day heatmap
  const heatmapDays = useMemo(() => Array.from({ length: 30 }).map((_, i) => {
    const d = subDays(new Date(), 29 - i)
    const rec = recent.find(r => r.date === format(d, 'yyyy-MM-dd'))
    const mins = rec ? (rec.hoursWorked ? rec.hoursWorked * 60 : parseTimeToMinutes(rec.totalHours)) : 0
    let intensity = 'none'
    if (rec?.checkIn) { intensity = mins < 4 * 60 ? 'low' : mins < 8 * 60 ? 'medium' : 'high' }
    const isWeekend = getDay(d) === 0 || getDay(d) === 6
    return { date: d, intensity, isWeekend, formattedDate: format(d, 'MMM dd, yyyy'), timeStr: rec ? (rec.totalHours || '0h') : 'No Record' }
  }), [recent])

  // Pending leaves
  const pendingLeaves = myLeaves.filter(l => l.status === 'Pending' || l.status === 'pending')
  const upcomingLeaves = myLeaves.filter(l => {
    const s = l.status?.toLowerCase()
    if (s !== 'approved') return false
    return new Date(l.startDate) >= new Date()
  }).slice(0, 2)

  if (isLoading) return (
    <div className="flex items-center justify-center min-h-[500px]">
      <div className="text-center"><RefreshCw className="h-10 w-10 animate-spin mx-auto mb-4 text-blue-500" /><p className="text-slate-500 font-medium">Loading workspace...</p></div>
    </div>
  )

  if (!currentUser) return null

  const leaveStatusConfig = {
    approved: { label: 'Approved', cls: 'bg-emerald-50 text-emerald-700 border-emerald-200', icon: <CheckCircle2 className="h-3 w-3" /> },
    pending: { label: 'Pending', cls: 'bg-amber-50 text-amber-700 border-amber-200', icon: <Hourglass className="h-3 w-3" /> },
    rejected: { label: 'Rejected', cls: 'bg-red-50 text-red-700 border-red-200', icon: <XCircle className="h-3 w-3" /> },
  }

  return (
    <div className="space-y-6 pb-16 bg-slate-50/50 dark:bg-slate-950 min-h-screen">

      {/* ══ HERO BANNER ══════════════════════════════════════════════════════════ */}
      <div className="bg-gradient-to-br from-blue-600 via-blue-700 to-indigo-800 rounded-2xl shadow-xl shadow-blue-900/20 overflow-hidden relative">
        <div className="absolute inset-0 pointer-events-none overflow-hidden">
          <div className="absolute -top-20 -right-20 w-80 h-80 bg-white/10 rounded-full blur-3xl" />
          <div className="absolute bottom-0 left-16 w-56 h-56 bg-indigo-400/20 rounded-full blur-2xl" />
        </div>

        <div className="p-5 md:p-8 flex flex-col md:flex-row items-start md:items-center justify-between gap-6 relative z-10">
          {/* Left: Clock + Status */}
          <div className="space-y-5 flex-1">
            <LiveClock />
            <div className="flex flex-wrap items-center gap-3">
              <div className="inline-flex items-center gap-2.5 bg-white/10 backdrop-blur-md px-4 py-2 rounded-full border border-white/20">
                <span className="relative flex h-2.5 w-2.5">
                  {isWorking && <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-200 opacity-75" />}
                  <span className={`relative inline-flex rounded-full h-2.5 w-2.5 ${isWorking ? (isOnBreak ? 'bg-amber-400' : 'bg-emerald-400') : 'bg-slate-400'}`} />
                </span>
                <span className="text-sm font-semibold text-white">
                  {isWorking ? (isOnBreak ? 'On Break' : 'Working') : 'Not Checked In'}
                </span>
              </div>
              {todayRecord?.checkIn && (
                <div className="inline-flex items-center gap-2 bg-white/10 px-3 py-1.5 rounded-full border border-white/20 text-blue-100 text-xs font-semibold">
                  <Clock className="h-3 w-3" /> In: {todayRecord.checkIn}
                  {todayRecord.checkOut && <><span className="opacity-50 mx-1">·</span><span>Out: {todayRecord.checkOut}</span></>}
                </div>
              )}
            </div>
          </div>

          {/* Centre: Profile Info */}
          <div className="flex items-center gap-5">
            <Avatar className="h-14 w-14 border-2 border-white/30 shadow-lg shrink-0">
              <AvatarFallback className="bg-white/20 text-white text-lg font-bold">
                {getInitials(profile?.name || currentUser?.name || 'E')}
              </AvatarFallback>
            </Avatar>
            <div className="text-white">
              <p className="text-lg md:text-xl font-bold tracking-tight">{profile?.name || currentUser?.name || 'Employee'}</p>
              <p className="text-blue-200 font-medium text-sm mt-0.5">{profile?.position || 'Employee'}</p>
              <div className="flex flex-wrap items-center gap-1.5 mt-1.5">
                {profile?.department && (
                  <div className="flex items-center gap-1 text-xs text-blue-100 bg-white/10 px-2 py-0.5 rounded-full">
                    <Building className="h-3 w-3" /> {profile.department}
                  </div>
                )}
                {daysAtCompany !== null && (
                  <div className="flex items-center gap-1 text-xs text-blue-100 bg-white/10 px-2 py-0.5 rounded-full">
                    <Briefcase className="h-3 w-3" /> {daysAtCompany} days
                  </div>
                )}
                {profile?.hikvisionEmployeeId && (
                  <div className="flex items-center gap-1 text-xs text-blue-100 bg-white/10 px-2 py-0.5 rounded-full">
                    <Activity className="h-3 w-3" /> ID: {profile.hikvisionEmployeeId}
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Right: CTA */}
          <div className="flex flex-col gap-3 w-full md:w-auto">
            <Button size="sm" className="w-full md:w-auto bg-white text-blue-700 hover:bg-blue-50 shadow-lg font-bold px-5 py-4 rounded-xl transition-all hover:scale-105 active:scale-95" onClick={() => navigate('/employee/attendance')}>
              Attendance <ChevronRight className="ml-1 h-4 w-4" />
            </Button>
            <Button variant="ghost" size="sm" className="w-full md:w-auto text-white border border-white/20 hover:bg-white/10 text-sm rounded-xl py-3" onClick={() => navigate('/employee/profile')}>
              <User className="h-4 w-4 mr-2" /> My Profile
            </Button>
          </div>
        </div>
      </div>

      {/* ══ ROW 2: TODAY + WEEKLY STATS + LEAVE RINGS ════════════════════════════ */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">

        {/* Today Ring */}
        <Card className="shadow-sm border-slate-100 bg-white dark:bg-slate-900 rounded-2xl">
          <CardHeader className="pb-0 pt-4 px-5">
            <CardTitle className="text-[10px] font-bold text-slate-400 uppercase tracking-widest flex items-center gap-1.5">
              <Activity className="h-3.5 w-3.5 text-blue-500" /> Today's Activity
            </CardTitle>
          </CardHeader>
          <CardContent className="p-4 flex flex-col items-center gap-3">
            <ProgressRing radius={58} stroke={9} progress={todayWorkMins} total={STANDARD_MINS} colorClass="text-blue-500" label={todayHoursStr} sublabel="Logged" />
            <div className="text-center space-y-1">
              {todayRecord?.checkIn && (
                <p className="text-xs text-slate-500 font-medium">In: <span className="text-slate-700 font-bold">{todayRecord.checkIn}</span>{todayRecord?.checkOut ? <> &middot; Out: <span className="text-slate-700 font-bold">{todayRecord.checkOut}</span></> : ''}</p>
              )}
              {todayRecord?.breakDuration ? (
                <p className="text-xs text-slate-400 font-medium">Break: {Math.floor(todayRecord.breakDuration / 60)}h {todayRecord.breakDuration % 60}m</p>
              ) : null}
            </div>
            <Button variant="link" className="text-blue-500 text-[11px] p-0 h-auto font-semibold" onClick={() => navigate('/employee/attendance')}>
              View Full Log <ArrowRight className="h-3 w-3 ml-1" />
            </Button>
          </CardContent>
        </Card>

        {/* Weekly Stats */}
        <Card className="shadow-sm border-slate-100 bg-white dark:bg-slate-900 rounded-2xl">
          <CardHeader className="pb-0 pt-4 px-5">
            <CardTitle className="text-[10px] font-bold text-slate-400 uppercase tracking-widest flex items-center gap-1.5">
              <BarChart2 className="h-3.5 w-3.5 text-indigo-500" /> This Week
            </CardTitle>
          </CardHeader>
          <CardContent className="p-4 space-y-3">
            <div className="grid grid-cols-2 gap-2">
              {[
                { label: 'Avg / Day', value: stats.averagePerDay, accent: false },
                { label: 'Days Logged', value: stats.daysPresent, accent: false },
                { label: 'Total Hours', value: stats.totalHours, accent: true },
                { label: 'Best Day', value: stats.longestDay, accent: false },
              ].map(({ label, value, accent }) => (
                <div key={label} className={`rounded-xl p-2.5 ${accent ? 'bg-blue-50 dark:bg-blue-900/20' : 'bg-slate-50 dark:bg-slate-800/50'}`}>
                  <p className={`text-xl font-bold tracking-tight ${accent ? 'text-blue-600 dark:text-blue-400' : 'text-slate-800 dark:text-white'}`}>{value}</p>
                  <p className="text-[9px] font-bold text-slate-400 uppercase tracking-wider mt-0.5">{label}</p>
                </div>
              ))}
            </div>
            <Button variant="link" className="text-blue-500 text-[11px] p-0 h-auto font-semibold" onClick={() => navigate('/employee/weekly-hours')}>
              Full Weekly Report <ArrowRight className="h-3 w-3 ml-1" />
            </Button>
          </CardContent>
        </Card>

        {/* Leave Balance Rings */}
        <Card className="shadow-sm border-slate-100 bg-white dark:bg-slate-900 rounded-2xl">
          <CardHeader className="pb-0 pt-4 px-5">
            <CardTitle className="text-[10px] font-bold text-slate-400 uppercase tracking-widest flex items-center gap-1.5">
              <Coffee className="h-3.5 w-3.5 text-sky-500" /> Leave Balances
            </CardTitle>
          </CardHeader>
          <CardContent className="p-4 flex flex-col gap-3">
            <div className="flex justify-around items-center">
              {leaveBalance ? ['vacation', 'sick', 'casual'].map((type) => {
                const total = leaveBalance.allocated[type] || 0
                const used = leaveBalance.used[type] || 0
                const remain = leaveBalance.remaining[type] || 0
                const colors = { vacation: 'text-blue-500', sick: 'text-indigo-400', casual: 'text-sky-400' }
                return (
                  <TooltipProvider key={type} delayDuration={100}>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <div className="flex flex-col items-center cursor-pointer group">
                          <ProgressRing radius={32} stroke={6} progress={used} total={total || 1} colorClass={colors[type]} label={remain} />
                          <span className="text-[9px] font-bold text-slate-400 group-hover:text-slate-600 transition-colors uppercase mt-1.5 tracking-widest">{type}</span>
                        </div>
                      </TooltipTrigger>
                      <TooltipContent className="text-xs font-medium">{used} used / {total} total</TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                )
              }) : <p className="text-sm text-slate-400">Loading...</p>}
            </div>
            <Button variant="link" className="text-blue-500 text-[11px] p-0 h-auto font-semibold" onClick={() => navigate('/employee/leave-requests')}>
              Apply for Leave <ArrowRight className="h-3 w-3 ml-1" />
            </Button>
          </CardContent>
        </Card>
      </div>

      {/* ══ ROW 3: MY LEAVE REQUESTS + MANAGER INFO + TEAM ══════════════════════ */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">

        {/* Recent Leave Requests */}
        <Card className="shadow-sm border-slate-100 bg-white dark:bg-slate-900 rounded-2xl">
          <CardHeader className="border-b border-slate-50 dark:border-slate-800 px-6 py-4 flex flex-row items-center justify-between">
            <CardTitle className="text-sm font-bold text-slate-700 dark:text-slate-200 flex items-center gap-2">
              <CalendarDays className="h-4 w-4 text-slate-400" /> My Leaves
              {pendingLeaves.length > 0 && (
                <Badge className="bg-amber-100 text-amber-700 hover:bg-amber-100 text-[10px] font-bold px-1.5 py-0.5">{pendingLeaves.length} pending</Badge>
              )}
            </CardTitle>
            <Button variant="ghost" size="sm" className="text-blue-500 hover:text-blue-600 text-xs font-semibold h-7 px-2" onClick={() => navigate('/employee/leave-requests')}>
              View All <ChevronRight className="h-3 w-3 ml-0.5" />
            </Button>
          </CardHeader>
          <CardContent className="p-4 space-y-3">
            {myLeaves.length === 0 ? (
              <div className="py-8 text-center text-slate-400">
                <CalendarDays className="h-8 w-8 mx-auto mb-2 opacity-20" />
                <p className="text-xs font-medium">No leave requests</p>
              </div>
            ) : (
              myLeaves.slice(0, 4).map((leave, i) => {
                const statusKey = leave.status?.toLowerCase() || 'pending'
                const cfg = leaveStatusConfig[statusKey] || leaveStatusConfig.pending
                return (
                  <div key={leave.id || i} className="flex items-center justify-between p-3 rounded-xl bg-slate-50 dark:bg-slate-800/50 gap-3">
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-bold text-slate-700 dark:text-slate-200 capitalize">{leave.leaveType}</p>
                      <p className="text-[11px] text-slate-400 font-medium mt-0.5">
                        {leave.startDate ? format(new Date(leave.startDate), 'MMM dd') : '--'}
                        {leave.endDate && leave.endDate !== leave.startDate ? ` – ${format(new Date(leave.endDate), 'MMM dd')}` : ''}
                      </p>
                    </div>
                    <Badge variant="outline" className={`text-[10px] font-bold shrink-0 flex items-center gap-1 ${cfg.cls}`}>
                      {cfg.icon} {cfg.label}
                    </Badge>
                  </div>
                )
              })
            )}
          </CardContent>
        </Card>

        {/* Upcoming Approved + Manager Info */}
        <Card className="shadow-sm border-slate-100 bg-white dark:bg-slate-900 rounded-2xl">
          <CardHeader className="border-b border-slate-50 dark:border-slate-800 px-6 py-4">
            <CardTitle className="text-sm font-bold text-slate-700 dark:text-slate-200 flex items-center gap-2">
              <User className="h-4 w-4 text-slate-400" /> My Info
            </CardTitle>
          </CardHeader>
          <CardContent className="p-4 space-y-3">
            {/* Profile Details */}
            {[
              { icon: <Building className="h-3 w-3 text-slate-400" />, label: 'Department', value: profile?.department },
              { icon: <Briefcase className="h-3 w-3 text-slate-400" />, label: 'Position', value: profile?.position },
              { icon: <Users className="h-3 w-3 text-slate-400" />, label: 'Reports To', value: profile?.managerName },
              { icon: <User className="h-3 w-3 text-slate-400" />, label: 'Email', value: profile?.email },
              { icon: <Activity className="h-3 w-3 text-slate-400" />, label: 'Device ID', value: profile?.hikvisionEmployeeId },
            ].map(({ icon, label, value }) => value ? (
              <div key={label} className="flex items-center gap-2 p-2.5 rounded-lg bg-slate-50 dark:bg-slate-800/50">
                <div className="w-6 h-6 rounded-md bg-white dark:bg-slate-700 flex items-center justify-center shadow-sm shrink-0">{icon}</div>
                <div className="min-w-0">
                  <p className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">{label}</p>
                  <p className="text-xs font-semibold text-slate-700 dark:text-slate-200 truncate mt-0.5">{value}</p>
                </div>
              </div>
            ) : null)}

            {/* Upcoming approved leaves */}
            {upcomingLeaves.length > 0 && (
              <div className="mt-4 pt-3 border-t border-slate-100 dark:border-slate-800">
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2">Upcoming Leave</p>
                {upcomingLeaves.map((lv, i) => (
                  <div key={i} className="flex items-center gap-2 p-2.5 rounded-lg bg-blue-50 dark:bg-blue-900/20 border border-blue-100 dark:border-blue-800 mt-2">
                    <CheckCircle2 className="h-4 w-4 text-blue-500 shrink-0" />
                    <div>
                      <p className="text-xs font-semibold text-blue-700 dark:text-blue-300 capitalize">{lv.leaveType}</p>
                      <p className="text-[10px] text-blue-500">{format(new Date(lv.startDate), 'MMM dd')} – {format(new Date(lv.endDate), 'MMM dd')}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* 7-Day Trend */}
        <Card className="shadow-sm border-slate-100 bg-white dark:bg-slate-900 rounded-2xl">
          <CardHeader className="border-b border-slate-50 dark:border-slate-800 px-5 py-3">
            <CardTitle className="text-[10px] font-bold text-slate-400 uppercase tracking-widest flex items-center gap-1.5">
              <Calendar className="h-3.5 w-3.5 text-slate-400" /> 7-Day Trend
            </CardTitle>
          </CardHeader>
          <CardContent className="p-4 h-[180px]">
            <div className="flex items-end justify-between h-full w-full gap-2">
              <TooltipProvider delayDuration={80}>
                {last7Days.map((day, idx) => (
                  <Tooltip key={idx}>
                    <TooltipTrigger asChild>
                      <div className="flex flex-col items-center gap-2 flex-1 group cursor-pointer h-full justify-end">
                        <div className="w-full bg-slate-50 dark:bg-slate-800 rounded-lg relative flex items-end overflow-hidden h-full">
                          <div
                            className="w-full bg-blue-200 dark:bg-blue-800 group-hover:bg-blue-400 transition-all duration-300 rounded-t-sm"
                            style={{ height: `${day.h}%`, minHeight: day.h > 0 ? '4px' : '0' }}
                          />
                        </div>
                        <span className="text-[10px] font-bold text-slate-400 tracking-wider shrink-0">{day.dayName.charAt(0)}</span>
                      </div>
                    </TooltipTrigger>
                    <TooltipContent className="text-xs font-medium shadow-lg">
                      {format(day.date, 'EEE, MMM dd')} — {Math.floor(day.mins / 60)}h {day.mins % 60}m
                    </TooltipContent>
                  </Tooltip>
                ))}
              </TooltipProvider>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* ══ ROW 4: 30-DAY HEATMAP ════════════════════════════════════════════════ */}
      <Card className="shadow-sm border-slate-100 bg-white dark:bg-slate-900 rounded-2xl overflow-hidden">
        <CardHeader className="border-b border-slate-50 dark:border-slate-800 px-6 py-4 flex flex-row items-center justify-between">
          <CardTitle className="text-sm font-bold text-slate-700 dark:text-slate-200 flex items-center gap-2">
            <Activity className="h-4 w-4 text-slate-400" /> 30-Day Activity Map
          </CardTitle>
          <div className="hidden sm:flex items-center gap-2.5 text-[9px] font-bold text-slate-400 uppercase tracking-wide">
            <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-sm bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 inline-block" /> Absent</span>
            <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-sm bg-blue-200 dark:bg-blue-900 inline-block" /> Low</span>
            <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-sm bg-blue-400 inline-block" /> Mid</span>
            <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-sm bg-blue-600 inline-block" /> High</span>
          </div>
        </CardHeader>
        <CardContent className="p-6">
          <div className="flex flex-wrap gap-1.5">
            <TooltipProvider delayDuration={50}>
              {heatmapDays.map((day, idx) => {
                let cls = 'bg-slate-100 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700'
                if (day.isWeekend) cls = 'bg-slate-50 dark:bg-slate-900 border border-slate-100 dark:border-slate-800 opacity-40'
                if (day.intensity === 'low') cls = 'bg-blue-200 dark:bg-blue-900 border border-blue-300 dark:border-blue-800 shadow-sm'
                if (day.intensity === 'medium') cls = 'bg-blue-400 dark:bg-blue-700 shadow-sm'
                if (day.intensity === 'high') cls = 'bg-blue-600 dark:bg-blue-500 shadow-sm'
                return (
                  <Tooltip key={idx}>
                    <TooltipTrigger asChild>
                      <div className={`w-5 h-5 sm:w-6 sm:h-6 rounded-[4px] cursor-pointer transition-all hover:ring-2 hover:ring-blue-400 hover:ring-offset-1 hover:scale-110 ${cls}`} />
                    </TooltipTrigger>
                    <TooltipContent className="text-xs shadow-lg">
                      <p className="font-bold text-slate-800 dark:text-white">{day.formattedDate}</p>
                      <p className="text-slate-500 font-medium mt-0.5">{day.timeStr}</p>
                    </TooltipContent>
                  </Tooltip>
                )
              })}
            </TooltipProvider>
          </div>
        </CardContent>
      </Card>

      {/* ══ ROW 5: 30-DAY LOGS TABLE ═════════════════════════════════════════════ */}
      <Card className="shadow-sm border-slate-100 dark:border-slate-800 rounded-2xl overflow-hidden">
        <CardHeader className="bg-white dark:bg-slate-900 border-b border-slate-50 dark:border-slate-800 px-6 py-4 flex flex-row items-center justify-between">
          <CardTitle className="text-sm font-bold text-slate-700 dark:text-slate-200 flex items-center gap-2">
            <Clock className="h-4 w-4 text-slate-400" /> Detailed Logs
          </CardTitle>
          <Badge variant="secondary" className="bg-slate-100 text-slate-500 hover:bg-slate-100 font-bold text-[10px] tracking-wider">30 DAYS</Badge>
        </CardHeader>
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead className="text-[10px] text-slate-400 bg-slate-50/80 dark:bg-slate-900 uppercase tracking-widest border-b border-slate-100 dark:border-slate-800">
              <tr>
                <th className="px-6 py-3 font-bold">Date</th>
                <th className="px-6 py-3 font-bold w-52">Visual</th>
                <th className="px-6 py-3 font-bold">Hours</th>
                <th className="px-6 py-3 font-bold text-center">Events</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50 dark:divide-slate-800/50 bg-white dark:bg-slate-900">
              {recent.length === 0 ? (
                <tr><td colSpan={4} className="px-6 py-12 text-center text-slate-400">
                  <Clock className="h-8 w-8 mx-auto mb-3 opacity-20" /><p className="font-medium text-xs">No records found.</p>
                </td></tr>
              ) : recent.map((record, idx) => {
                const dateObj = parseISO(record.date)
                const monthDay = format(dateObj, 'MMM dd')
                const dayName = format(dateObj, 'EEE')
                let workWidth = 0
                if (record.hoursWorked) workWidth = Math.min((record.hoursWorked * 60 / STANDARD_MINS) * 100, 100)
                else if (record.totalHours) workWidth = Math.min((parseTimeToMinutes(record.totalHours) / STANDARD_MINS) * 100, 100)

                return (
                  <tr key={idx} className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex flex-col">
                        <span className="font-bold text-slate-800 dark:text-slate-100 tracking-tight text-sm">{monthDay}</span>
                        <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">{dayName}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="h-2 w-full bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                        {workWidth > 0 && <div className="h-full bg-blue-500 rounded-full transition-all" style={{ width: `${workWidth}%` }} />}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className="font-bold text-blue-600 dark:text-blue-400">
                        {record.hoursWorked ? `${record.hoursWorked.toFixed(1)}h` : (record.totalHours || '--')}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-center">
                      <TooltipProvider delayDuration={100}>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <div className="inline-flex items-center justify-center w-8 h-8 rounded-full bg-slate-50 hover:bg-blue-50 hover:text-blue-600 text-slate-400 cursor-pointer border border-slate-100 transition-colors">
                              <MapPin className="h-3.5 w-3.5" />
                            </div>
                          </TooltipTrigger>
                          <TooltipContent side="left" className="p-0 shadow-xl rounded-xl border-slate-200">
                            <div className="p-3 border-b border-slate-100 bg-slate-50 rounded-t-xl">
                              <p className="font-bold text-slate-900 text-xs uppercase tracking-wider">{monthDay} — {record.checkIn || '--'} to {record.checkOut || '...'}</p>
                            </div>
                            <div className="p-3 space-y-2.5 max-w-[240px]">
                              {record.events?.map((evt, ei) => (
                                <div key={ei} className="flex gap-3 text-xs">
                                  <div className="flex flex-col items-center shrink-0">
                                    <div className={`w-2 h-2 rounded-full mt-0.5 ${evt.type === 'checkIn' ? 'bg-blue-500' : evt.type === 'checkOut' ? 'bg-slate-600' : 'bg-amber-400'}`} />
                                    {ei !== record.events.length - 1 && <div className="w-px flex-1 bg-slate-100 my-1" />}
                                  </div>
                                  <div>
                                    <p className="font-bold text-slate-700 capitalize">{evt.type.replace(/([A-Z])/g, ' $1').trim()}</p>
                                    <div className="flex items-center gap-1 mt-0.5 text-slate-400 font-medium">
                                      <Clock className="h-3 w-3" />
                                      {format(parseISO(evt.time), 'hh:mm a')}
                                    </div>
                                    {evt.location && (
                                      <p className="text-slate-400 mt-0.5 flex items-start gap-1 leading-tight">
                                        {evt.location.isUnverified ? <AlertCircle className="h-3 w-3 text-amber-500 shrink-0 mt-0.5" /> : <Map className="h-3 w-3 shrink-0 mt-0.5" />}
                                        <span className="max-w-[160px]">{typeof evt.location === 'object' ? (evt.location.city || 'GPS Location') : evt.location}</span>
                                      </p>
                                    )}
                                  </div>
                                </div>
                              )) || <p className="text-slate-400 text-xs font-medium">No events logged.</p>}
                            </div>
                          </TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </Card>

    </div>
  )
}
