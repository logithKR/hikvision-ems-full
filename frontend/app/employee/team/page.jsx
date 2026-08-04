import { useState, useMemo } from"react"
import { useNavigate } from"react-router-dom"
import { useQueryClient } from"@tanstack/react-query"
import {
 Users,
 Clock,
 FileText,
 CheckCircle2,
 XCircle,
 User,
 Calendar,
 ArrowRight,
 RefreshCw,
 Crown,
 Briefcase,
 Shield
} from"lucide-react"
import {
 Card,
 CardContent,
 CardDescription,
 CardHeader,
 CardTitle,
} from"@/components/ui/card"
import { Button } from"@/components/ui/button"
import { Avatar, AvatarFallback, AvatarImage } from"@/components/ui/avatar"
import { Badge } from"@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from"@/components/ui/tabs"
import { getCurrentUser } from"@/lib/auth"
import { getValidIdToken } from"@/lib/firebaseClient"
import { useOptimisticQuery } from"@/app/hooks/useOptimisticQuery"

const getApiBase = () => import.meta.env.VITE_API_URL || ''

export default function TeamDashboard() {
 const navigate = useNavigate()
 const currentUser = getCurrentUser()
 const [activeTab, setActiveTab] = useState("members")

 // ─── Queries ────────────────────────────────────────────────

 const { data: teamData = { members: [], attendance: [], pendingLeaves: [] }, isLoading: loading, isBackgroundRefresh, refresh } = useOptimisticQuery({
 queryKey: ['team-dashboard-data'],
 queryFn: async () => {
 const token = await getValidIdToken()
 const base = getApiBase()
 const headers = { 'Authorization': `Bearer ${token}` }

 // Fetch all 3 endpoints in parallel
 const [membersRes, attendanceRes, leavesRes] = await Promise.all([
 fetch(`${base}/api/team/members`, { headers }),
 fetch(`${base}/api/team/attendance`, { headers }),
 fetch(`${base}/api/team/leaves/pending`, { headers })
 ])

 const result = { members: [], attendance: [], pendingLeaves: [] }

 if (membersRes.ok) {
 const data = await membersRes.json()
 result.members = data.members || []
 }
 if (attendanceRes.ok) {
 const data = await attendanceRes.json()
 result.attendance = data.attendance || []
 }
 if (leavesRes.ok) {
 const data = await leavesRes.json()
 result.pendingLeaves = data.leaves || []
 }
 return result
 },
 refetchInterval: 15000,
 placeholderData: { members: [], attendance: [], pendingLeaves: [] }
 })

 // ─── Helpers ────────────────────────────────────────────────

 const getInitials = (name) => name ? name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2) : '??'

 const getStatusColor = (status) => {
 switch (status?.toLowerCase()) {
 case 'present': return 'text-green-600 bg-green-100 border-green-200'
 case 'absent': return 'text-red-600 bg-red-100 border-red-200'
 case 'late': return 'text-amber-600 bg-amber-100 border-amber-200'
 case 'half day': case 'half-day': return 'text-blue-600 bg-blue-100 border-blue-200'
 default: return 'text-slate-600 bg-secondary border-border'
 }
 }

 const getRoleBadge = (member) => {
 if (member.isDeptHead) return <Badge variant="outline" className="bg-amber-50 text-amber-700 border-amber-200 text-[10px]"><Star className="w-3 h-3 mr-1" /> Tech Lead</Badge>
 return <Badge variant="outline" className="text-[10px]"><User className="w-3 h-3 mr-1" /> Employee</Badge>
 }

 // ─── Render ─────────────────────────────────────────────────

 const presentCount = teamData.attendance.filter(r => r.attendance?.status === 'Present' || r.attendance?.status === 'present').length
 const lateCount = teamData.attendance.filter(r => r.attendance?.status === 'Late' || r.attendance?.status === 'late').length
 const absentCount = teamData.members.length - (presentCount + lateCount)

 return (
 <div className="space-y-6 animate-in fade-in-50 duration-500">
 {/* Header */}
 <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
 <div>
 <h1 className="text-2xl font-bold tracking-tight text-foreground dark:text-slate-50 flex items-center gap-2">
 <Users className="h-6 w-6 text-blue-600" /> My Team
 </h1>
 <p className="text-muted-foreground mt-1">
 Overview of your {currentUser?.isDeptHead ? 'department' : 'direct reports'}
 </p>
 </div>
 <div className="flex gap-2">
 <Button
 onClick={() => navigate("/employee/team/leaves")}
 className={`gap-2 ${teamData.pendingLeaves.length > 0 ? 'bg-amber-600 hover:bg-amber-700' : ''}`}
 >
 <FileText className="h-4 w-4" />
 Approvals
 {teamData.pendingLeaves.length > 0 && <Badge className="ml-1 bg-card text-amber-600 h-5 w-5 p-0 justify-center rounded-full">{teamData.pendingLeaves.length}</Badge>}
 </Button>
 <Button variant="outline" size="icon" onClick={refresh} disabled={isBackgroundRefresh}>
 <RefreshCw className={`h-4 w-4 ${isBackgroundRefresh ? 'animate-spin' : ''}`} />
 </Button>
 </div>
 </div>

 {/* Quick Stats */}
 <div className="grid gap-4 md:grid-cols-4">
 <Card>
 <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
 <CardTitle className="text-sm font-medium">Total Members</CardTitle>
 <Users className="h-4 w-4 text-muted-foreground" />
 </CardHeader>
 <CardContent>
 <div className="text-2xl font-bold">{teamData.members.length}</div>
 <p className="text-xs text-muted-foreground">{currentUser?.isDeptHead ? 'Department strength' : 'Direct reports'}</p>
 </CardContent>
 </Card>
 <Card>
 <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
 <CardTitle className="text-sm font-medium">Present Today</CardTitle>
 <User className="h-4 w-4 text-emerald-500" />
 </CardHeader>
 <CardContent>
 <div className="text-2xl font-bold text-emerald-600">{presentCount}</div>
 <p className="text-xs text-muted-foreground">On time or checked in</p>
 </CardContent>
 </Card>
 <Card>
 <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
 <CardTitle className="text-sm font-medium">Late / Absent</CardTitle>
 <Clock className="h-4 w-4 text-amber-500" />
 </CardHeader>
 <CardContent>
 <div className="text-2xl font-bold text-amber-600">{lateCount + absentCount}</div>
 <p className="text-xs text-muted-foreground">{lateCount} Late, {absentCount} Absent</p>
 </CardContent>
 </Card>
 <Card>
 <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
 <CardTitle className="text-sm font-medium">Pending Leaves</CardTitle>
 <FileText className="h-4 w-4 text-blue-500" />
 </CardHeader>
 <CardContent>
 <div className="text-2xl font-bold text-blue-600">{teamData.pendingLeaves.length}</div>
 <p className="text-xs text-muted-foreground cursor-pointer hover:underline" onClick={() => navigate("/employee/team/leaves")}>Review requests →</p>
 </CardContent>
 </Card>
 </div>

 <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
 <TabsList>
 <TabsTrigger value="members">Team Members</TabsTrigger>
 <TabsTrigger value="attendance">Today's Attendance</TabsTrigger>
 </TabsList>

 <TabsContent value="members" className="space-y-4">
 {loading ? (
 <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
 {[1, 2, 3].map(i => <Card key={i} className="animate-pulse h-32" />)}
 </div>
 ) : (
 <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
 {teamData.members.map(member => (
 <Card key={member.id} className="overflow-hidden hover:shadow-md transition-all">
 <div className={`h-1 w-full ${member.isDeptHead ? 'bg-amber-400' : 'bg-slate-200'}`} />
 <CardContent className="p-4 flex items-center gap-4">
 <Avatar className="h-12 w-12 border-2 border-border">
 <AvatarFallback className="bg-secondary text-foreground font-bold">{getInitials(member.name)}</AvatarFallback>
 </Avatar>
 <div className="flex-1 min-w-0">
 <div className="flex items-center gap-2 mb-1">
 <p className="font-semibold text-sm truncate">{member.name}</p>
 {getRoleBadge(member)}
 </div>
 <p className="text-xs text-muted-foreground truncate">{member.email}</p>
 <p className="text-xs text-muted-foreground truncate mt-0.5">{member.position || 'Employee'}</p>
 </div>
 </CardContent>
 <CardDescription className="px-4 pb-3 text-xs flex justify-between items-center border-t pt-2">
 <span>Joined: {new Date(member.createdAt?._seconds * 1000 || Date.now()).toLocaleDateString()}</span>
 </CardDescription>
 </Card>
 ))}
 </div>
 )}
 </TabsContent>

 <TabsContent value="attendance">
 <Card>
 <CardHeader>
 <CardTitle>Attendance Report</CardTitle>
 <CardDescription>{new Date().toLocaleDateString(undefined, { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</CardDescription>
 </CardHeader>
 <CardContent>
 <div className="space-y-3">
 {teamData.attendance.length === 0 ? (
 <div className="text-center py-8 text-muted-foreground">No attendance records for today yet.</div>
 ) : (
 teamData.attendance.map(record => {
 const att = record.attendance
 const status = att?.status || 'absent'
 const checkIn = att?.checkIn
 ? new Date(att.checkIn).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
 : att?.checkInTimeStr || '--:--'
 const checkOut = att?.checkOut
 ? new Date(att.checkOut).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
 : att?.checkOutTimeStr || '--:--'
 const totalHours = att?.totalHours || '--'
 const isOnline = att?.isOnline || false

 return (
 <div key={record.user?.id || record.id} className="flex items-center justify-between p-4 rounded-lg border bg-background/50 hover:shadow-sm transition-shadow">
 <div className="flex items-center gap-3 flex-1 min-w-0">
 <Avatar className="h-10 w-10">
 <AvatarFallback className="bg-secondary text-foreground font-bold">{getInitials(record.user?.name || record.userName)}</AvatarFallback>
 </Avatar>
 <div className="min-w-0">
 <div className="flex items-center gap-2">
 <p className="font-semibold text-sm truncate">{record.user?.name || record.userName}</p>
 {isOnline && <span className="flex h-2 w-2 rounded-full bg-green-500" title="Currently online" />}
 </div>
 <p className="text-xs text-muted-foreground truncate">{record.user?.email}</p>
 </div>
 </div>
 <div className="flex items-center gap-4 text-sm">
 <div className="text-center min-w-[60px]">
 <p className="text-[10px] text-muted-foreground uppercase">In</p>
 <p className="font-medium text-green-600">{att ? checkIn : '--:--'}</p>
 </div>
 <div className="text-center min-w-[60px]">
 <p className="text-[10px] text-muted-foreground uppercase">Out</p>
 <p className="font-medium text-red-600">{att ? checkOut : '--:--'}</p>
 </div>
 <div className="text-center min-w-[60px]">
 <p className="text-[10px] text-muted-foreground uppercase">Hours</p>
 <p className="font-bold">{att ? totalHours : '--'}</p>
 </div>
 <Badge variant="outline" className={`min-w-[70px] justify-center capitalize ${getStatusColor(status)}`}>
 {status}
 </Badge>
 </div>
 </div>
 )
 })
 )}
 </div>
 </CardContent>
 </Card>
 </TabsContent>
 </Tabs>
 </div>
 )
}
