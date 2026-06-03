import { useState, useMemo } from"react"
import { useNavigate } from"react-router-dom"
import { useQueryClient, useMutation } from"@tanstack/react-query"
import {
 FileText,
 CheckCircle2,
 XCircle,
 AlertCircle,
 Clock,
 User,
 Calendar,
 ArrowLeft,
 RefreshCw
} from"lucide-react"
import {
 Card,
 CardContent,
 CardDescription,
 CardHeader,
 CardTitle,
 CardFooter
} from"@/components/ui/card"
import { Button } from"@/components/ui/button"
import { Badge } from"@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from"@/components/ui/tabs"
import {
 Dialog,
 DialogContent,
 DialogDescription,
 DialogFooter,
 DialogHeader,
 DialogTitle,
} from"@/components/ui/dialog"
import { Label } from"@/components/ui/label"
import { Textarea } from"@/components/ui/textarea"
import { Avatar, AvatarFallback } from"@/components/ui/avatar"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from"@/components/ui/table"
import { getValidIdToken } from"@/lib/firebaseClient"
import { toast } from"sonner"
import { format } from"date-fns"
import { useOptimisticQuery } from"@/app/hooks/useOptimisticQuery"

const getApiBase = () => import.meta.env.VITE_API_URL || ''

export default function TeamLeavesPage() {
 const navigate = useNavigate()
 const queryClient = useQueryClient()
 const [activeTab, setActiveTab] = useState("pending")
 const [actionDialog, setActionDialog] = useState({ open: false, type: null, leave: null })
 const [comments, setComments] = useState("")

 // ─── Queries ────────────────────────────────────────────────

 const { data: pendingLeaves = [], isLoading: pendingLoading, isBackgroundRefresh: pendingRefreshing, refresh: refreshPending } = useOptimisticQuery({
 queryKey: ['team-pending-leaves'],
 queryFn: async () => {
 const token = await getValidIdToken()
 const res = await fetch(`${getApiBase()}/api/team/leaves/pending`, {
 headers: { Authorization: `Bearer ${token}` }
 })
 if (!res.ok) throw new Error("Failed to fetch pending leaves")
 const data = await res.json()
 return data.leaves || []
 },
 refetchInterval: 10000,
 placeholderData: []
 })

 const { data: historyLeaves = [], isLoading: historyLoading } = useOptimisticQuery({
 queryKey: ['team-history-leaves'],
 queryFn: async () => {
 const token = await getValidIdToken()
 const res = await fetch(`${getApiBase()}/api/team/leaves/history`, {
 headers: { Authorization: `Bearer ${token}` }
 })
 if (!res.ok) throw new Error("Failed to fetch leave history")
 const data = await res.json()
 return data.leaves || []
 },
 refetchInterval: 60000,
 placeholderData: []
 })

 // ─── Mutations ──────────────────────────────────────────────

 const processLeave = useMutation({
 mutationFn: async ({ leaveId, type, comment }) => {
 const token = await getValidIdToken()
 const endpoint = type === 'approve' ? 'approve' : 'reject'
 const res = await fetch(`${getApiBase()}/api/team/leaves/${leaveId}/${endpoint}`, {
 method: 'POST',
 headers: {
 'Authorization': `Bearer ${token}`,
 'Content-Type': 'application/json'
 },
 body: JSON.stringify({ comments: comment })
 })
 if (!res.ok) {
 const err = await res.json()
 throw new Error(err.message ||"Action failed")
 }
 return res.json()
 },
 onMutate: async ({ leaveId, type }) => {
 // Optimistic Update
 await queryClient.cancelQueries({ queryKey: ['team-pending-leaves'] })
 const previousPending = queryClient.getQueryData(['team-pending-leaves'])

 // Remove from pending immediately
 queryClient.setQueryData(['team-pending-leaves'], (old) =>
 (old || []).filter(l => l.id !== leaveId)
 )

 return { previousPending }
 },
 onError: (err, variables, context) => {
 toast.error(err.message)
 queryClient.setQueryData(['team-pending-leaves'], context.previousPending)
 },
 onSettled: () => {
 queryClient.invalidateQueries({ queryKey: ['team-pending-leaves'] })
 queryClient.invalidateQueries({ queryKey: ['team-history-leaves'] })
 setActionDialog({ open: false, type: null, leave: null })
 setComments("")
 toast.success("Leave processed successfully")
 }
 })

 // ─── Helpers ────────────────────────────────────────────────

 const getInitials = (name) => name ? name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2) : '??'

 const formatDate = (dateVal) => {
 if (!dateVal) return"N/A"
 try {
 return format(new Date(dateVal),"MMM dd, yyyy")
 } catch (e) {
 return"Invalid Date"
 }
 }

 const getLeaveIndexColor = (i) => {
 const colors = ['bg-blue-500', 'bg-emerald-500', 'bg-purple-500', 'bg-amber-500', 'bg-pink-500']
 return colors[i % colors.length]
 }

 // ─── Render ─────────────────────────────────────────────────

 return (
 <div className="space-y-6 animate-in fade-in-50 duration-500">
 <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
 <div>
 <h1 className="text-2xl font-bold tracking-tight text-foreground dark:text-slate-50 flex items-center gap-2">
 <CheckCircle2 className="h-6 w-6 text-blue-600" /> Team Approvals
 </h1>
 <p className="text-muted-foreground mt-1">Manage leave requests from your team members</p>
 </div>
 <div className="flex gap-2">
 <Button variant="outline" size="sm" onClick={() => navigate("/employee/team")} className="gap-2">
 <ArrowLeft className="h-4 w-4" /> Back to Team
 </Button>
 <Button variant="outline" size="sm" onClick={refreshPending} disabled={pendingRefreshing} className="gap-2">
 <RefreshCw className={`h-4 w-4 ${pendingRefreshing ? 'animate-spin' : ''}`} /> Refresh
 </Button>
 </div>
 </div>

 <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
 <TabsList>
 <TabsTrigger value="pending" className="relative">
 Pending Requests
 {pendingLeaves.length > 0 && (
 <span className="absolute -top-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-red-500 text-[10px] text-white">
 {pendingLeaves.length}
 </span>
 )}
 </TabsTrigger>
 <TabsTrigger value="history">History</TabsTrigger>
 </TabsList>

 {/* TAB 1: Pending Requests */}
 <TabsContent value="pending" className="space-y-4">
 {pendingLoading ? (
 <div className="grid gap-4 md:grid-cols-2">
 {[1, 2].map(i => <Card key={i} className="animate-pulse h-48" />)}
 </div>
 ) : pendingLeaves.length === 0 ? (
 <Card className="border-dashed py-12">
 <div className="flex flex-col items-center text-center">
 <CheckCircle2 className="h-12 w-12 text-blue-500/30 mb-4" />
 <h3 className="text-lg font-semibold">No Pending Requests</h3>
 <p className="text-muted-foreground">Your team has no pending leave requests at the moment.</p>
 </div>
 </Card>
 ) : (
 <div className="grid gap-4 md:grid-cols-2">
 {pendingLeaves.map((leave, idx) => (
 <Card key={leave.id} className="overflow-hidden border-l-4 border-l-blue-500 shadow-sm hover:shadow-md transition-all">
 <div className={`h-1 ${getLeaveIndexColor(idx)} w-full opacity-20 absolute top-0 left-0 right-0`} />
 <CardHeader className="pb-3 pt-5">
 <div className="flex justify-between items-start">
 <div className="flex items-center gap-3">
 <Avatar className="h-10 w-10">
 <AvatarFallback className="bg-secondary text-foreground font-bold">{getInitials(leave.userName)}</AvatarFallback>
 </Avatar>
 <div>
 <CardTitle className="text-base">{leave.userName}</CardTitle>
 <CardDescription className="text-xs flex items-center gap-1">
 <User className="w-3 h-3" /> {leave.userRole === 'manager' ? 'Manager' : 'Team Member'}
 </CardDescription>
 </div>
 </div>
 <Badge variant="outline" className="capitalize bg-background">{leave.leaveType}</Badge>
 </div>
 </CardHeader>
 <CardContent className="space-y-3 pb-3">
 <div className="grid grid-cols-2 gap-4 text-sm bg-background/50 p-3 rounded-lg border border-border">
 <div>
 <p className="text-xs text-muted-foreground mb-1">From</p>
 <p className="font-semibold">{formatDate(leave.startDate)}</p>
 </div>
 <div>
 <p className="text-xs text-muted-foreground mb-1">To</p>
 <p className="font-semibold">{formatDate(leave.endDate)}</p>
 </div>
 </div>
 <div className="flex items-center justify-between text-sm px-1">
 <span className="text-muted-foreground flex items-center gap-1"><Clock className="w-3.5 h-3.5" /> Duration</span>
 <span className="font-bold">{leave.days} Days</span>
 </div>
 <div className="bg-background p-2.5 rounded text-sm text-slate-600 italic border border-border mt-2">
"{leave.reason}"
 </div>
 </CardContent>
 <CardFooter className="bg-background/80 border-t gap-2 p-3 mt-2">
 <Button className="flex-1 bg-emerald-600 hover:bg-emerald-700"
 onClick={() => setActionDialog({ open: true, type: 'approve', leave })}
 >
 Approve
 </Button>
 <Button variant="outline" className="flex-1 text-red-600 border-red-200 hover:bg-red-50"
 onClick={() => setActionDialog({ open: true, type: 'reject', leave })}
 >
 Reject
 </Button>
 </CardFooter>
 </Card>
 ))}
 </div>
 )}
 </TabsContent>

 {/* TAB 2: History */}
 <TabsContent value="history">
 <Card>
 <CardHeader>
 <CardTitle>Approval History</CardTitle>
 <CardDescription>Past leave requests you have processed.</CardDescription>
 </CardHeader>
 <CardContent>
 <div className="overflow-x-auto mobile-table-scroll rounded-md border">
 <Table>
 <TableHeader>
 <TableRow>
 <TableHead>Employee</TableHead>
 <TableHead>Type</TableHead>
 <TableHead>Period</TableHead>
 <TableHead>Days</TableHead>
 <TableHead>Status</TableHead>
 <TableHead>Reviewed By</TableHead>
 <TableHead>Action Date</TableHead>
 </TableRow>
 </TableHeader>
 <TableBody>
 {historyLoading ? (
 <TableRow><TableCell colSpan={6} className="h-24 text-center">Loading...</TableCell></TableRow>
 ) : historyLeaves.length === 0 ? (
 <TableRow><TableCell colSpan={6} className="h-24 text-center">No history found</TableCell></TableRow>
 ) : (
 historyLeaves.map(leave => (
 <TableRow key={leave.id}>
 <TableCell className="font-medium">{leave.userName}</TableCell>
 <TableCell className="capitalize">{leave.leaveType}</TableCell>
 <TableCell className="text-xs">
 {formatDate(leave.startDate)} - {formatDate(leave.endDate)}
 </TableCell>
 <TableCell>{leave.days}</TableCell>
 <TableCell>
 {leave.status?.toLowerCase() === 'approved' ?
 <Badge className="bg-emerald-100 text-emerald-700 border-0">Approved</Badge> :
 <Badge className="bg-red-100 text-red-700 border-0">Rejected</Badge>
 }
 </TableCell>
 <TableCell className="text-xs">
 {leave.reviewedByName || '—'}
 {leave.reviewComments && <p className="text-muted-foreground italic">"{leave.reviewComments}"</p>}
 </TableCell>
 <TableCell className="text-xs text-muted-foreground">{formatDate(leave.updatedAt || leave.createdAt)}</TableCell>
 </TableRow>
 ))
 )}
 </TableBody>
 </Table>
 </div>
 </CardContent>
 </Card>
 </TabsContent>
 </Tabs>

 {/* Action Dialog */}
 <Dialog open={actionDialog.open} onOpenChange={(open) => !open && setActionDialog({ open: false, type: null, leave: null })}>
 <DialogContent className="">
 <DialogHeader>
 <DialogTitle>
 {actionDialog.type === 'approve' ? 'Approve Request' : 'Reject Request'}
 </DialogTitle>
 <DialogDescription>
 Review {actionDialog.leave?.userName}'s request for {actionDialog.leave?.days} days.
 </DialogDescription>
 </DialogHeader>
 <DialogBody>
 <div className="space-y-4 py-4">
 <div className="space-y-2">
 <Label>Comments</Label>
 <Textarea
 placeholder="Add optional comments..."
 value={comments}
 onChange={(e) => setComments(e.target.value)}
 />
 </div>
 </div>
 </DialogBody>
 <DialogFooter>
 <Button variant="outline" onClick={() => setActionDialog({ open: false, type: null, leave: null })}>Cancel</Button>
 <Button
 className={actionDialog.type === 'approve' ?"bg-emerald-600 hover:bg-emerald-700" :"bg-red-600 hover:bg-red-700"}
 disabled={processLeave.isPending}
 onClick={() => processLeave.mutate({
 leaveId: actionDialog.leave.id,
 type: actionDialog.type,
 comment: comments
 })}
 >
 {processLeave.isPending && <RefreshCw className="mr-2 h-4 w-4 animate-spin" />}
 Confirm
 </Button>
 </DialogFooter>
 </DialogContent>
 </Dialog>
 </div>
 )
}
