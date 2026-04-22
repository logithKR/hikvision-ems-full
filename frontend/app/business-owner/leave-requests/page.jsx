import { useState, useMemo } from "react"
import { useNavigate } from "react-router-dom"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import {
  FileText,
  CheckCircle2,
  XCircle,
  AlertCircle,
  Clock,
  Search,
  Filter,
  ArrowLeft,
  RefreshCw,
  Briefcase,
  Crown,
  ArrowUpDown
} from "lucide-react"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  CardFooter
} from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { getValidIdToken } from "@/lib/firebaseClient"
import { toast } from "sonner"
import { format } from "date-fns"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"

const getApiBase = () => import.meta.env.VITE_API_URL || ''

export default function BusinessOwnerLeaveRequestsPage() {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [activeTab, setActiveTab] = useState("approvals")
  const [actionDialog, setActionDialog] = useState({ open: false, type: null, leave: null })
  const [comments, setComments] = useState("")
  const [sortConfig, setSortConfig] = useState({ key: null, direction: 'asc' })

  // ─── Queries ────────────────────────────────────────────────

  // 1. Pending HOD Leaves (Actionable)
  const { data: pendingLeaves = [], isLoading: pendingLoading } = useQuery({
    queryKey: ['bo-pending-leaves'],
    queryFn: async () => {
      const token = await getValidIdToken()
      const res = await fetch(`${getApiBase()}/api/leave/bo/pending`, {
        headers: { Authorization: `Bearer ${token}` }
      })
      if (!res.ok) throw new Error("Failed to fetch pending leaves")
      const data = await res.json()
      return data.leaves || []
    },
    refetchInterval: 15000
  })

  // 2. All Organization Leaves (Read-only/Monitoring)
  const { data: allLeaves = [], isLoading: allLoading } = useQuery({
    queryKey: ['bo-all-leaves'],
    queryFn: async () => {
      const token = await getValidIdToken()
      const res = await fetch(`${getApiBase()}/api/leave/all`, {
        headers: { Authorization: `Bearer ${token}` }
      })
      if (!res.ok) throw new Error("Failed to fetch all leaves")
      const data = await res.json()
      return (data.requests || []).sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
    },
    staleTime: 60000
  })

  // ─── Mutations ──────────────────────────────────────────────

  const processLeave = useMutation({
    mutationFn: async ({ leaveId, type, comment }) => {
      const token = await getValidIdToken()
      const endpoint = type === 'approve' ? 'approve' : 'reject'
      const res = await fetch(`${getApiBase()}/api/leave/bo/${leaveId}/${endpoint}`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ comments: comment })
      })
      if (!res.ok) {
        const err = await res.json()
        throw new Error(err.message || "Action failed")
      }
      return res.json()
    },
    onSuccess: (_, variables) => {
      toast.success(`Leave request ${variables.type === 'approve' ? 'approved' : 'rejected'} successfully`)
      queryClient.invalidateQueries({ queryKey: ['bo-pending-leaves'] })
      queryClient.invalidateQueries({ queryKey: ['bo-all-leaves'] })
      setActionDialog({ open: false, type: null, leave: null })
      setComments("")
    },
    onError: (err) => {
      toast.error(err.message)
    }
  })

  // ─── Sorting Logic ──────────────────────────────────────────

  const requestSort = (key) => {
    let direction = 'asc'
    if (sortConfig.key === key && sortConfig.direction === 'asc') direction = 'desc'
    setSortConfig({ key, direction })
  }

  const sortedAllLeaves = useMemo(() => {
    let sortable = [...allLeaves]
    if (sortConfig.key) {
      sortable.sort((a, b) => {
        let aVal = a[sortConfig.key] || ''
        let bVal = b[sortConfig.key] || ''

        // Special handling for dates
        if (sortConfig.key === 'startDate' || sortConfig.key === 'createdAt') {
          aVal = new Date(aVal).getTime()
          bVal = new Date(bVal).getTime()
        } else {
          aVal = aVal.toString().toLowerCase()
          bVal = bVal.toString().toLowerCase()
        }

        if (aVal < bVal) return sortConfig.direction === 'asc' ? -1 : 1
        if (aVal > bVal) return sortConfig.direction === 'asc' ? 1 : -1
        return 0
      })
    }
    return sortable
  }, [allLeaves, sortConfig])

  // ─── Helpers ────────────────────────────────────────────────

  const getInitials = (name) => name ? name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2) : '??'

  const formatDate = (dateVal) => {
    if (!dateVal) return "N/A"
    try {
      return format(new Date(dateVal), "MMM dd, yyyy")
    } catch (e) {
      return "Invalid Date"
    }
  }

  const getStatusBadge = (status) => {
    switch (status?.toLowerCase()) {
      case 'approved': return <Badge className="bg-emerald-100 text-emerald-700 hover:bg-emerald-200 border-0"><CheckCircle2 className="w-3 h-3 mr-1" /> Approved</Badge>
      case 'rejected': return <Badge className="bg-red-100 text-red-700 hover:bg-red-200 border-0"><XCircle className="w-3 h-3 mr-1" /> Rejected</Badge>
      case 'pending': return <Badge className="bg-blue-100 text-blue-700 hover:bg-blue-200 border-0"><Clock className="w-3 h-3 mr-1" /> Pending</Badge>
      default: return <Badge variant="outline">{status}</Badge>
    }
  }

  // ─── Render ─────────────────────────────────────────────────

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-50 flex items-center gap-2">
            <Crown className="h-6 w-6 text-blue-500" /> Leave Management
          </h1>
          <p className="text-slate-500 mt-1">Approve Department Head leaves and monitor organization status</p>
        </div>
        <Button variant="outline" size="sm" onClick={() => queryClient.invalidateQueries()} className="gap-2">
          <RefreshCw className="h-4 w-4" /> Refresh
        </Button>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
        <TabsList>
          <TabsTrigger value="approvals" className="relative">
            Pending Approvals
            {pendingLeaves.length > 0 && (
              <span className="absolute -top-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-red-500 text-[10px] text-white">
                {pendingLeaves.length}
              </span>
            )}
          </TabsTrigger>
          <TabsTrigger value="all">All Organization Leaves</TabsTrigger>
        </TabsList>

        {/* TAB 1: Pending Approvals */}
        <TabsContent value="approvals" className="space-y-4">
          {pendingLoading ? (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {[1, 2, 3].map(i => <Card key={i} className="animate-pulse h-48" />)}
            </div>
          ) : pendingLeaves.length === 0 ? (
            <Card className="border-dashed py-12">
              <div className="flex flex-col items-center text-center">
                <CheckCircle2 className="h-12 w-12 text-emerald-500/50 mb-4" />
                <h3 className="text-lg font-semibold">All Caught Up!</h3>
                <p className="text-muted-foreground">No pending leave requests from Department Heads.</p>
              </div>
            </Card>
          ) : (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {pendingLeaves.map(leave => (
                <Card key={leave.id} className="overflow-hidden border-l-4 border-l-blue-500 shadow-sm hover:shadow-md transition-all">
                  <CardHeader className="pb-3 bg-slate-50/50">
                    <div className="flex justify-between items-start">
                      <div className="flex items-center gap-3">
                        <Avatar>
                          <AvatarFallback className="bg-blue-100 text-blue-700">{getInitials(leave.userName)}</AvatarFallback>
                        </Avatar>
                        <div>
                          <CardTitle className="text-base">{leave.userName}</CardTitle>
                          <CardDescription className="flex items-center gap-1 text-xs">
                            <Crown className="w-3 h-3 text-blue-500" /> Department Head
                          </CardDescription>
                        </div>
                      </div>
                      <Badge variant="outline" className="capitalize">{leave.leaveType}</Badge>
                    </div>
                  </CardHeader>
                  <CardContent className="pt-4 space-y-3">
                    <div className="flex justify-between text-sm">
                      <div className="space-y-1">
                        <p className="text-muted-foreground text-xs">Duration</p>
                        <p className="font-medium flex items-center gap-1">
                          <Clock className="w-3 h-3" />
                          {formatDate(leave.startDate)} - {formatDate(leave.endDate)}
                        </p>
                      </div>
                      <div className="text-right space-y-1">
                        <p className="text-muted-foreground text-xs">Days</p>
                        <p className="font-bold text-slate-900">{leave.days} Days</p>
                      </div>
                    </div>
                    <div className="bg-slate-50 p-2 rounded text-sm text-slate-600 italic border border-slate-100">
                      "{leave.reason}"
                    </div>
                  </CardContent>
                  <CardFooter className="bg-slate-50/50 border-t gap-2 p-3">
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

        {/* TAB 2: All Leaves (Read Only) */}
        <TabsContent value="all">
          <Card>
            <CardHeader>
              <CardTitle>Organization Leave History</CardTitle>
              <CardDescription>Monitor leave requests across all departments.</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto mobile-table-scroll rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="cursor-pointer hover:bg-slate-100 transition-colors" onClick={() => requestSort("userName")}><div className="flex items-center gap-1">Employee <ArrowUpDown className="h-3 w-3 text-slate-400" /></div></TableHead>
                      <TableHead className="cursor-pointer hover:bg-slate-100 transition-colors" onClick={() => requestSort("userRole")}><div className="flex items-center gap-1">Role <ArrowUpDown className="h-3 w-3 text-slate-400" /></div></TableHead>
                      <TableHead className="cursor-pointer hover:bg-slate-100 transition-colors" onClick={() => requestSort("leaveType")}><div className="flex items-center gap-1">Type <ArrowUpDown className="h-3 w-3 text-slate-400" /></div></TableHead>
                      <TableHead className="cursor-pointer hover:bg-slate-100 transition-colors" onClick={() => requestSort("startDate")}><div className="flex items-center gap-1">Dates <ArrowUpDown className="h-3 w-3 text-slate-400" /></div></TableHead>
                      <TableHead className="cursor-pointer hover:bg-slate-100 transition-colors" onClick={() => requestSort("days")}><div className="flex items-center gap-1">Days <ArrowUpDown className="h-3 w-3 text-slate-400" /></div></TableHead>
                      <TableHead className="cursor-pointer hover:bg-slate-100 transition-colors" onClick={() => requestSort("status")}><div className="flex items-center gap-1">Status <ArrowUpDown className="h-3 w-3 text-slate-400" /></div></TableHead>
                      <TableHead className="cursor-pointer hover:bg-slate-100 transition-colors" onClick={() => requestSort("createdAt")}><div className="flex items-center gap-1">Applied On <ArrowUpDown className="h-3 w-3 text-slate-400" /></div></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {allLoading ? (
                      <TableRow>
                        <TableCell colSpan={7} className="h-24 text-center">Loading...</TableCell>
                      </TableRow>
                    ) : allLeaves.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={7} className="h-24 text-center">No records found</TableCell>
                      </TableRow>
                    ) : (
                      sortedAllLeaves.map(leave => (
                        <TableRow key={leave.id}>
                          <TableCell className="font-medium">{leave.userName}</TableCell>
                          <TableCell>
                            {leave.userRole === 'dept_head' ?
                              <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200 text-[10px]">HOD</Badge> :
                              <Badge variant="outline" className="text-[10px]">Employee</Badge>
                            }
                          </TableCell>
                          <TableCell className="capitalize">{leave.leaveType}</TableCell>
                          <TableCell className="text-xs">
                            {formatDate(leave.startDate)} <br />
                            <span className="text-muted-foreground">{formatDate(leave.endDate)}</span>
                          </TableCell>
                          <TableCell>{leave.days}</TableCell>
                          <TableCell>{getStatusBadge(leave.status)}</TableCell>
                          <TableCell className="text-xs text-muted-foreground">{formatDate(leave.createdAt)}</TableCell>
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
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {actionDialog.type === 'approve' ? 'Approve Leave Request' : 'Reject Leave Request'}
            </DialogTitle>
            <DialogDescription>
              {actionDialog.leave?.userName} - {actionDialog.leave?.days} days ({actionDialog.leave?.leaveType})
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Comments ({actionDialog.type === 'reject' ? 'Required' : 'Optional'})</Label>
              <Textarea
                placeholder={actionDialog.type === 'reject' ? "Please provide a reason for rejection..." : "Add a note (optional)..."}
                value={comments}
                onChange={(e) => setComments(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setActionDialog({ open: false, type: null, leave: null })}>Cancel</Button>
            <Button
              className={actionDialog.type === 'approve' ? "bg-emerald-600 hover:bg-emerald-700" : "bg-red-600 hover:bg-red-700"}
              disabled={processLeave.isPending || (actionDialog.type === 'reject' && !comments.trim())}
              onClick={() => processLeave.mutate({
                leaveId: actionDialog.leave.id,
                type: actionDialog.type,
                comment: comments
              })}
            >
              {processLeave.isPending && <RefreshCw className="mr-2 h-4 w-4 animate-spin" />}
              {actionDialog.type === 'approve' ? 'Confirm Approval' : 'Confirm Rejection'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
