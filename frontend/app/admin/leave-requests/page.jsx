import { useState, useMemo } from "react"
import { useNavigate } from "react-router-dom"
import { useQuery } from "@tanstack/react-query"
import {
  FileText,
  CheckCircle2,
  XCircle,
  AlertCircle,
  Clock,
  Search,
  Filter,
  RefreshCw,
  Briefcase,
  Crown,
  User
} from "lucide-react"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { getValidIdToken } from "@/lib/firebaseClient"
import { format } from "date-fns"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { useOptimisticQuery } from "@/app/hooks/useOptimisticQuery"

const getApiBase = () => import.meta.env.VITE_API_URL || ''

export default function AdminLeaveRequestsPage() {
  const navigate = useNavigate()

  // ─── Queries ────────────────────────────────────────────────

  const { data: allLeaves = [], isLoading: loading, isBackgroundRefresh, refresh } = useOptimisticQuery({
    queryKey: ['admin-all-leaves'],
    queryFn: async () => {
      const token = await getValidIdToken()
      const res = await fetch(`${getApiBase()}/api/leave/all`, {
        headers: { Authorization: `Bearer ${token}` }
      })
      if (!res.ok) throw new Error("Failed to fetch leaves")
      const data = await res.json()
      return (data.requests || []).sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
    },
    refetchInterval: 30000,
    placeholderData: []
  })

  // ─── Helpers ────────────────────────────────────────────────

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
      case 'pending': return <Badge className="bg-amber-100 text-amber-700 hover:bg-amber-200 border-0"><Clock className="w-3 h-3 mr-1" /> Pending</Badge>
      default: return <Badge variant="outline">{status}</Badge>
    }
  }

  const getRoleBadge = (role) => {
    switch (role) {
      case 'dept_head': return <Badge variant="outline" className="bg-amber-50 text-amber-700 border-amber-200 text-[10px]"><Crown className="w-3 h-3 mr-1" /> HOD</Badge>
      case 'manager': return <Badge variant="outline" className="bg-purple-50 text-purple-700 border-purple-200 text-[10px]"><Briefcase className="w-3 h-3 mr-1" /> Manager</Badge>
      default: return <Badge variant="outline" className="text-[10px]"><User className="w-3 h-3 mr-1" /> Employee</Badge>
    }
  }

  // ─── Render ─────────────────────────────────────────────────

  return (
    <div className="space-y-6 animate-in fade-in-50 duration-500">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-50 flex items-center gap-2">
            <FileText className="h-6 w-6 text-blue-600" /> Leave Requests
          </h1>
          <p className="text-slate-500 mt-1">Monitor all leave activity across the organization</p>
        </div>
        <Button variant="outline" size="sm" onClick={refresh} disabled={isBackgroundRefresh} className="gap-2">
          <RefreshCw className={`h-4 w-4 ${isBackgroundRefresh ? 'animate-spin' : ''}`} /> Refresh
        </Button>
      </div>

      <Card className="border-blue-100 bg-blue-50/50 dark:border-blue-900/50 dark:bg-blue-900/20 shadow-sm">
        <CardContent className="py-4">
          <div className="flex items-start gap-3">
            <div className="p-2 bg-blue-100 dark:bg-blue-900/50 rounded-lg">
              <AlertCircle className="h-5 w-5 text-blue-600 dark:text-blue-400" />
            </div>
            <div>
              <p className="text-sm font-semibold text-blue-900 dark:text-blue-100">Read-Only View</p>
              <p className="text-xs text-blue-700 dark:text-blue-300 mt-1">
                Admins can monitor leave requests but approvals are handled by Department Heads and the Business Owner.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Organization Leave History</CardTitle>
          <CardDescription>All leave requests from employees, managers, and department heads.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto mobile-table-scroll rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Employee</TableHead>
                  <TableHead>Role</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Dates</TableHead>
                  <TableHead>Days</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Requested On</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow>
                    <TableCell colSpan={7} className="h-24 text-center">Loading...</TableCell>
                  </TableRow>
                ) : allLeaves.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="h-24 text-center">No records found</TableCell>
                  </TableRow>
                ) : (
                  allLeaves.map(leave => (
                    <TableRow key={leave.id}>
                      <TableCell className="font-medium">{leave.userName}</TableCell>
                      <TableCell>{getRoleBadge(leave.userRole)}</TableCell>
                      <TableCell className="capitalize">
                        <Badge variant="secondary" className="font-normal">{leave.leaveType}</Badge>
                      </TableCell>
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
    </div>
  )
}
