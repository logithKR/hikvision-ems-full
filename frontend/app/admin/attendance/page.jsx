import { useEffect, useState, useMemo } from "react"
import { useNavigate } from "react-router-dom"
import { useQuery, useQueryClient } from "@tanstack/react-query"
import { CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Calendar, Clock, UserCheck, UserX, Coffee, LogOut, ArrowLeft, RefreshCw, Users, AlertCircle, MapPin, Search, Filter } from "lucide-react"
import { format } from "date-fns"
import { getCurrentUser, isAuthenticated } from "@/lib/auth"
import { getValidIdToken } from "@/lib/firebaseClient"

export default function AdminAttendancePage() {
  const navigate = useNavigate()
  const queryClient = useQueryClient()

  const [currentUser, setCurrentUser] = useState(null)
  const [dateFilter, setDateFilter] = useState(format(new Date(), "yyyy-MM-dd"))

  // Search & Filters
  const [searchTerm, setSearchTerm] = useState("")
  const [statusFilter, setStatusFilter] = useState("all")

  // Stats calculation
  const [stats, setStats] = useState({
    totalEmployees: 0,
    presentEmployees: 0,
    absentEmployees: 0,
    checkedOut: 0,
    onBreak: 0,
  })

  // Auth Check
  useEffect(() => {
    if (!isAuthenticated()) {
      navigate("/admin/login")
      return
    }

    const user = getCurrentUser()
    if (!user || (user.role !== "admin" && user.role !== "system_admin")) {
      navigate("/admin/login")
      return
    }

    setCurrentUser(user)
  }, [navigate])

  const { data: attendanceRecords = [], isLoading: loading, error: queryError } = useQuery({
    queryKey: ['admin-attendance', dateFilter],
    queryFn: async () => {
      const token = await getValidIdToken()
      if (!token) throw new Error("Authentication failed.")
      const base = import.meta.env.VITE_API_URL || ""
      const response = await fetch(`${base}/api/admin/attendance?date=${dateFilter}`, {
        headers: { Authorization: `Bearer ${token}` },
      })
      if (!response.ok) throw new Error(`Failed to load attendance: ${response.status}`)
      const data = await response.json()
      const records = Array.isArray(data) ? data : (data.records || data.data || [])
      return records
    },
    enabled: !!currentUser,
    staleTime: 30000,
  })

  // Update stats when records change
  useEffect(() => {
    if (attendanceRecords) {
      const total = attendanceRecords.length
      const present = attendanceRecords.filter(r => r.checkIn).length
      const absent = attendanceRecords.filter(r => !r.checkIn).length
      const breakStatus = attendanceRecords.filter(r => r.breakIn && !r.breakOut).length
      const out = attendanceRecords.filter(r => r.checkOut).length

      setStats({
        totalEmployees: total,
        presentEmployees: present,
        absentEmployees: absent,
        onBreak: breakStatus,
        checkedOut: out
      })
    }
  }, [attendanceRecords])

  const error = queryError?.message || null
  const loadAttendance = () => queryClient.invalidateQueries({ queryKey: ['admin-attendance', dateFilter] })

  // ── Client-side Filtering with useMemo ──────────
  const filteredRecords = useMemo(() => {
    let filtered = attendanceRecords

    // Search by name
    if (searchTerm.trim()) {
      const term = searchTerm.toLowerCase()
      filtered = filtered.filter(
        (r) =>
          (r.userName || r.employeeName || "").toLowerCase().includes(term) ||
          (r.department || "").toLowerCase().includes(term)
      )
    }

    // Status filter
    if (statusFilter !== "all") {
      switch (statusFilter) {
        case "present":
          filtered = filtered.filter((r) => r.checkIn && !r.checkOut && !(r.breakIn && !r.breakOut))
          break
        case "absent":
          filtered = filtered.filter((r) => !r.checkIn)
          break
        case "on-break":
          filtered = filtered.filter((r) => r.breakIn && !r.breakOut)
          break
        case "checked-out":
          filtered = filtered.filter((r) => r.checkOut)
          break
      }
    }

    return filtered
  }, [attendanceRecords, searchTerm, statusFilter])

  const getStatusBadge = (record) => {
    if (record.checkOut) {
      return <Badge className="bg-slate-100 text-slate-700 border-slate-200">Checked Out</Badge>
    }
    if (record.breakIn && !record.breakOut) {
      return <Badge className="bg-blue-50 text-blue-700 border-blue-200">On Break</Badge>
    }
    if (record.checkIn) {
      return <Badge className="bg-blue-100 text-blue-800 border-blue-200">Present</Badge>
    }
    return <Badge className="bg-slate-100 text-slate-500 border-slate-200">Absent</Badge>
  }

  if (!currentUser) return null

  return (
    <div className="space-y-6 animate-in fade-in-50 duration-500">
      {/* ── Page Header ─────────────────────────────────── */}
      <div className="bg-white border border-slate-200 rounded-xl px-6 py-5 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 shadow-sm">
        <div className="flex items-center gap-4">
          <div className="p-2.5 bg-blue-600 rounded-lg shadow-sm">
            <Clock className="h-5 w-5 text-white" />
          </div>
          <div>
            <h1 className="text-base sm:text-lg font-semibold text-slate-900 tracking-tight">Organization Attendance</h1>
            <p className="text-sm text-slate-500 mt-0.5">View attendance records for all employees</p>
          </div>
        </div>
        <div className="flex items-center gap-2 sm:gap-3 flex-wrap">
          <div className="flex items-center gap-2 border border-slate-200 rounded-lg px-3 py-2 bg-white shadow-sm hover:border-blue-200 transition-colors">
            <Calendar className="h-4 w-4 text-slate-400" />
            <Input
              type="date"
              value={dateFilter}
              onChange={(e) => setDateFilter(e.target.value)}
              className="w-auto border-0 p-0 h-auto text-sm text-slate-700 focus-visible:ring-0 focus-visible:ring-offset-0 bg-transparent placeholder:text-slate-400"
            />
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={loadAttendance}
            className="border-blue-200 text-blue-600 hover:bg-blue-50 hover:text-blue-700 gap-2"
          >
            <RefreshCw className="h-4 w-4" />
            Refresh
          </Button>
          <Button
            size="sm"
            onClick={() => navigate("/admin/dashboard")}
            className="bg-blue-600 hover:bg-blue-700 text-white gap-2 shadow-none"
          >
            <ArrowLeft className="h-4 w-4" />
            Dashboard
          </Button>
        </div>
      </div>

      {/* Error State */}
      {error && (
        <div className="flex items-start gap-3 p-4 bg-red-50 border border-red-200 rounded-xl">
          <AlertCircle className="h-4 w-4 text-red-500 mt-0.5 flex-shrink-0" />
          <div className="flex-1">
            <p className="text-sm font-semibold text-red-800">Error Loading Attendance</p>
            <p className="text-xs text-red-600 mt-0.5">{error}</p>
            <Button variant="outline" size="sm" onClick={loadAttendance} className="mt-3 border-red-200 text-red-700 hover:bg-red-100">
              <RefreshCw className="mr-2 h-3.5 w-3.5" /> Retry
            </Button>
          </div>
        </div>
      )}

      {/* Stats Cards */}
      <div className="grid gap-3 sm:gap-4 grid-cols-2 sm:grid-cols-3 lg:grid-cols-5">
        <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm hover:shadow-md transition-all duration-200">
          <div className="flex items-center justify-between mb-4">
            <span className="text-xs font-medium text-slate-500 uppercase tracking-wide">Total</span>
            <div className="p-2 bg-blue-50 border border-blue-100 rounded-lg">
              <Users className="h-4 w-4 text-blue-600" />
            </div>
          </div>
          <p className="text-2xl sm:text-3xl font-bold text-blue-600">{stats.totalEmployees}</p>
          <p className="text-xs text-slate-400 mt-1">Employees</p>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm hover:shadow-md transition-all duration-200">
          <div className="flex items-center justify-between mb-4">
            <span className="text-xs font-medium text-slate-500 uppercase tracking-wide">Present</span>
            <div className="p-2 bg-blue-50 border border-blue-100 rounded-lg">
              <UserCheck className="h-4 w-4 text-blue-600" />
            </div>
          </div>
          <p className="text-2xl sm:text-3xl font-bold text-blue-600">{stats.presentEmployees}</p>
          <p className="text-xs text-slate-400 mt-1">Working now</p>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm hover:shadow-md transition-all duration-200">
          <div className="flex items-center justify-between mb-4">
            <span className="text-xs font-medium text-slate-500 uppercase tracking-wide">Absent</span>
            <div className="p-2 bg-slate-50 border border-slate-100 rounded-lg">
              <UserX className="h-4 w-4 text-slate-500" />
            </div>
          </div>
          <p className="text-2xl sm:text-3xl font-bold text-slate-500">{stats.absentEmployees}</p>
          <p className="text-xs text-slate-400 mt-1">Not in</p>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm hover:shadow-md transition-all duration-200">
          <div className="flex items-center justify-between mb-4">
            <span className="text-xs font-medium text-slate-500 uppercase tracking-wide">On Break</span>
            <div className="p-2 bg-blue-50 border border-blue-100 rounded-lg">
              <Coffee className="h-4 w-4 text-blue-600" />
            </div>
          </div>
          <p className="text-2xl sm:text-3xl font-bold text-blue-600">{stats.onBreak}</p>
          <p className="text-xs text-slate-400 mt-1">Paused</p>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm hover:shadow-md transition-all duration-200">
          <div className="flex items-center justify-between mb-4">
            <span className="text-xs font-medium text-slate-500 uppercase tracking-wide">Checked Out</span>
            <div className="p-2 bg-slate-50 border border-slate-200 rounded-lg">
              <LogOut className="h-4 w-4 text-slate-600" />
            </div>
          </div>
          <p className="text-2xl sm:text-3xl font-bold text-slate-600">{stats.checkedOut}</p>
          <p className="text-xs text-slate-400 mt-1">Finished</p>
        </div>
      </div>

      {/* Attendance Table */}
      <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
        {/* Search & Filters Bar */}
        <div className="px-6 py-4 border-b border-slate-100">
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
              <Input
                type="text"
                placeholder="Search by employee name or department..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10 border-slate-200 focus-visible:ring-blue-500 bg-slate-50 hover:bg-white transition-colors"
              />
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-full sm:w-[160px] border-slate-200 text-sm">
                <Filter className="h-3.5 w-3.5 mr-1.5 text-slate-400" />
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="present">Present</SelectItem>
                <SelectItem value="absent">Absent</SelectItem>
                <SelectItem value="on-break">On Break</SelectItem>
                <SelectItem value="checked-out">Checked Out</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="flex items-center gap-2 mt-2">
            <span className="text-xs text-slate-400">
              Showing <span className="font-semibold text-slate-700">{filteredRecords.length}</span> of{" "}
              <span className="font-semibold text-slate-700">{attendanceRecords.length}</span> records
              <span className="ml-2 text-slate-400">•</span>
              <span className="ml-2 font-medium text-slate-500">{format(new Date(dateFilter), "MMMM dd, yyyy")}</span>
            </span>
          </div>
        </div>

        <CardContent className="p-0">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <RefreshCw className="h-6 w-6 animate-spin text-blue-600" />
              <p className="ml-3 text-sm text-slate-500">Loading attendance...</p>
            </div>
          ) : filteredRecords.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <div className="p-4 bg-slate-50 rounded-full mb-4">
                <UserX className="h-8 w-8 text-slate-400" />
              </div>
              <p className="text-sm text-slate-500">
                {searchTerm || statusFilter !== "all"
                  ? "No records match your filters."
                  : "No attendance records found for this date."}
              </p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow className="bg-slate-50 border-b border-slate-100 hover:bg-slate-50">
                  <TableHead className="text-xs font-semibold text-slate-500 uppercase tracking-wide py-3 px-4 sm:px-6">Employee</TableHead>
                  <TableHead className="text-xs font-semibold text-slate-500 uppercase tracking-wide py-3">Status</TableHead>
                  <TableHead className="text-xs font-semibold text-slate-500 uppercase tracking-wide py-3">Check In</TableHead>
                  <TableHead className="text-xs font-semibold text-slate-500 uppercase tracking-wide py-3">Check Out</TableHead>
                  <TableHead className="text-xs font-semibold text-slate-500 uppercase tracking-wide py-3 hidden sm:table-cell">Break In</TableHead>
                  <TableHead className="text-xs font-semibold text-slate-500 uppercase tracking-wide py-3 hidden sm:table-cell">Break Out</TableHead>
                  <TableHead className="text-xs font-semibold text-slate-500 uppercase tracking-wide py-3">Total</TableHead>
                  <TableHead className="text-xs font-semibold text-slate-500 uppercase tracking-wide py-3 hidden md:table-cell">Location</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredRecords.map((record) => (
                  <TableRow key={record.id} className="border-b border-slate-50 hover:bg-slate-50/70 transition-colors">
                    <TableCell className="py-3.5 px-4 sm:px-6 font-medium text-slate-800 whitespace-nowrap">{record.userName || record.employeeName}</TableCell>
                    <TableCell className="py-3.5">{getStatusBadge(record)}</TableCell>
                    <TableCell className="py-3.5">
                      {record.checkIn ? (
                        <span className="text-xs font-mono bg-slate-100 text-slate-700 border border-slate-200 px-2 py-1 rounded">{record.checkIn}</span>
                      ) : (
                        <span className="text-xs text-slate-300">-</span>
                      )}
                    </TableCell>
                    <TableCell className="py-3.5">
                      {record.checkOut ? (
                        <span className="text-xs font-mono bg-slate-100 text-slate-700 border border-slate-200 px-2 py-1 rounded">{record.checkOut}</span>
                      ) : (
                        <span className="text-xs text-slate-300">-</span>
                      )}
                    </TableCell>
                    <TableCell className="py-3.5 hidden sm:table-cell">
                      {record.breakIn ? (
                        <span className="text-xs font-mono bg-slate-100 text-slate-700 border border-slate-200 px-2 py-1 rounded">{record.breakIn}</span>
                      ) : (
                        <span className="text-xs text-slate-300">-</span>
                      )}
                    </TableCell>
                    <TableCell className="py-3.5 hidden sm:table-cell">
                      {record.breakOut ? (
                        <span className="text-xs font-mono bg-slate-100 text-slate-700 border border-slate-200 px-2 py-1 rounded">{record.breakOut}</span>
                      ) : (
                        <span className="text-xs text-slate-300">-</span>
                      )}
                    </TableCell>
                    <TableCell className="py-3.5">
                      {record.totalHours ? (
                        <Badge variant="outline" className="font-mono bg-blue-50 text-blue-700 border border-blue-100 shadow-none hover:bg-blue-100">
                          {record.totalHours}
                        </Badge>
                      ) : (
                        <span className="text-xs text-slate-300">-</span>
                      )}
                    </TableCell>
                    <TableCell className="py-3.5 hidden md:table-cell">
                      {(() => {
                        const checkInEvent = record.events?.find(e => e.type === 'checkIn' && e.location)
                        const checkOutEvent = record.events?.find(e => e.type === 'checkOut' && e.location)

                        if (!checkInEvent && !checkOutEvent) return <span className="text-slate-300 text-xs">-</span>

                        return (
                          <div className="flex flex-col gap-1 items-start">
                            {checkInEvent?.location && (
                              <a
                                href={`https://www.google.com/maps?q=${checkInEvent.location.lat},${checkInEvent.location.lng}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex items-center gap-1.5 text-xs font-medium text-green-600 hover:text-green-800 hover:underline"
                                title="Check In Location"
                              >
                                <MapPin className="h-3 w-3" />
                                In
                              </a>
                            )}
                            {checkOutEvent?.location && (
                              <a
                                href={`https://www.google.com/maps?q=${checkOutEvent.location.lat},${checkOutEvent.location.lng}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex items-center gap-1.5 text-xs font-medium text-red-600 hover:text-red-800 hover:underline"
                                title="Check Out Location"
                              >
                                <MapPin className="h-3 w-3" />
                                Out
                              </a>
                            )}
                          </div>
                        )
                      })()}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </div>
    </div>
  )
}
