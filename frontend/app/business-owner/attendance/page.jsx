import { useEffect, useState, useMemo } from "react"
import { useNavigate } from "react-router-dom"
import { useQuery, useQueryClient } from "@tanstack/react-query"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { Calendar, Clock, UserCheck, UserX, Coffee, LogOut, ArrowLeft, RefreshCw, Users, MapPin, ArrowUpDown } from "lucide-react"
import { format } from "date-fns"
import { safeRedirect } from "@/lib/redirectUtils"

const getApiBase = () => import.meta.env.VITE_API_URL || ""

const fetchAttendance = async (dateFilter) => {
  const token = sessionStorage.getItem("firebaseToken")
  const base = getApiBase()

  const empRes = await fetch(`${base}/api/admin/employees?role=employee`, {
    headers: { Authorization: `Bearer ${token}` },
  })

  let orgEmployees = []
  if (empRes.ok) {
    const empData = await empRes.json()
    const allEmployees = Array.isArray(empData) ? empData : empData.employees || []
    orgEmployees = allEmployees.filter((e) => e.isActive !== false)
  }

  const orgEmployeeIds = new Set(orgEmployees.map((e) => e.id))
  const totalEmployees = orgEmployees.length
  const dateStr = format(new Date(dateFilter), "yyyy-MM-dd")

  const attRes = await fetch(`${base}/api/admin/attendance?date=${dateStr}`, {
    headers: { Authorization: `Bearer ${token}` },
  })

  let orgRecords = []
  if (attRes.ok) {
    const data = await attRes.json()
    const allRecords = data.records || []
    orgRecords = allRecords.filter((r) => orgEmployeeIds.has(r.userId || r.employeeId))
  }

  return { orgRecords, totalEmployees }
}

export default function BusinessOwnerAttendancePage() {
  const navigate = useNavigate()
  const queryClient = useQueryClient()

  const [currentUser, setCurrentUser] = useState(null)
  const [dateFilter, setDateFilter] = useState(format(new Date(), "yyyy-MM-dd"))
  const [sortConfig, setSortConfig] = useState({ key: null, direction: 'asc' })

  useEffect(() => {
    const current = sessionStorage.getItem("currentUser")
    if (!current) {
      safeRedirect(navigate, "/business-owner/login")
      return
    }
    const emp = JSON.parse(current)
    if (emp.role !== "business_owner") {
      alert("Unauthorized. Business Owner access required.")
      safeRedirect(navigate, "/role-selection")
      return
    }
    setCurrentUser(emp)
  }, [navigate])

  const { data, isLoading: loading } = useQuery({
    queryKey: ['bo-attendance', dateFilter],
    queryFn: () => fetchAttendance(dateFilter),
    enabled: !!currentUser,
  })

  const attendanceRecords = data?.orgRecords || []
  const totalEmployees = data?.totalEmployees || 0

  const stats = useMemo(() => {
    const present = attendanceRecords.filter((r) => r.checkIn && !r.checkOut).length
    const checkedOut = attendanceRecords.filter((r) => r.checkOut).length
    const onBreak = attendanceRecords.filter((r) => r.breakIn && !r.breakOut).length
    const absent = Math.max(totalEmployees - attendanceRecords.length, 0)
    return { totalEmployees, presentEmployees: present, absentEmployees: absent, checkedOut, onBreak }
  }, [attendanceRecords, totalEmployees])

  const getStatusBadge = (record) => {
    if (record.checkOut) {
      return <Badge className="bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300 border-0">Checked Out</Badge>
    }
    if (record.breakIn && !record.breakOut) {
      return <Badge className="bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400 border-0">On Break</Badge>
    }
    if (record.checkIn) {
      return <Badge className="bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400 border-0">Present</Badge>
    }
    return <Badge className="bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400 border-0">Absent</Badge>
  }

  const requestSort = (key) => {
    let direction = 'asc'
    if (sortConfig.key === key && sortConfig.direction === 'asc') direction = 'desc'
    setSortConfig({ key, direction })
  }

  const sortedAttendance = useMemo(() => {
    if (!attendanceRecords) return []
    let sortable = [...attendanceRecords]
    if (sortConfig.key) {
      sortable.sort((a, b) => {
        let aVal = a[sortConfig.key] || ''
        let bVal = b[sortConfig.key] || ''

        if (sortConfig.key === 'userName') {
          aVal = (a.userName || a.employeeName || '').toLowerCase()
          bVal = (b.userName || b.employeeName || '').toLowerCase()
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
  }, [attendanceRecords, sortConfig])

  if (!currentUser) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <RefreshCw className="h-8 w-8 animate-spin text-blue-600" />
      </div>
    )
  }

  return (
    <div className="space-y-6 animate-in fade-in-50 duration-500">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-50">
            Organization Attendance
          </h1>
          <p className="text-slate-500 mt-1">
            View attendance records for all employees in your organization
          </p>
        </div>
        <div className="flex items-center gap-2 sm:gap-3 flex-wrap">
          <div className="flex items-center gap-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 px-3 py-2 rounded-md shadow-sm">
            <Calendar className="h-4 w-4 text-slate-500" />
            <Input
              type="date"
              value={dateFilter}
              onChange={(e) => setDateFilter(e.target.value)}
              className="w-auto h-auto p-0 border-0 bg-transparent text-sm focus-visible:ring-0 focus-visible:ring-offset-0"
            />
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => navigate("/business-owner/dashboard")}
            className="gap-2 border-blue-200 text-blue-600 hover:bg-blue-50 hover:text-blue-700"
          >
            <ArrowLeft className="h-4 w-4" />
            Dashboard
          </Button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid gap-3 sm:gap-4 grid-cols-2 sm:grid-cols-3 lg:grid-cols-5">
        <Card className="border-slate-200 shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-slate-500">Total</CardTitle>
            <div className="p-2 bg-slate-100 dark:bg-slate-800 rounded-lg">
              <Users className="h-4 w-4 text-slate-600 dark:text-slate-400" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-slate-900 dark:text-slate-100">
              {stats.totalEmployees}
            </div>
            <p className="text-xs text-slate-500 mt-1">In organization</p>
          </CardContent>
        </Card>

        <Card className="border-slate-200 shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-slate-500">Present</CardTitle>
            <div className="p-2 bg-emerald-50 dark:bg-emerald-900/30 rounded-lg">
              <UserCheck className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-slate-900 dark:text-slate-100">{stats.presentEmployees}</div>
            <p className="text-xs text-slate-500 mt-1">Currently working</p>
          </CardContent>
        </Card>

        <Card className="border-slate-200 shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-slate-500">Absent</CardTitle>
            <div className="p-2 bg-red-50 dark:bg-red-900/30 rounded-lg">
              <UserX className="h-4 w-4 text-red-600 dark:text-red-400" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-slate-900 dark:text-slate-100">{stats.absentEmployees}</div>
            <p className="text-xs text-slate-500 mt-1">Not checked in</p>
          </CardContent>
        </Card>

        <Card className="border-slate-200 shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-slate-500">On Break</CardTitle>
            <div className="p-2 bg-blue-50 dark:bg-blue-900/30 rounded-lg">
              <Coffee className="h-4 w-4 text-blue-600 dark:text-blue-400" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-slate-900 dark:text-slate-100">{stats.onBreak}</div>
            <p className="text-xs text-slate-500 mt-1">Taking break</p>
          </CardContent>
        </Card>

        <Card className="border-slate-200 shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-slate-500">Checked Out</CardTitle>
            <div className="p-2 bg-blue-50 dark:bg-blue-900/30 rounded-lg">
              <LogOut className="h-4 w-4 text-blue-600 dark:text-blue-400" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-slate-900 dark:text-slate-100">{stats.checkedOut}</div>
            <p className="text-xs text-slate-500 mt-1">Finished day</p>
          </CardContent>
        </Card>
      </div>

      {/* Attendance Table */}
      <Card className="border-slate-200 shadow-sm overflow-hidden">
        <CardHeader className="bg-slate-50/50 border-b border-slate-200">
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2 text-base text-slate-800">
              <Clock className="h-4 w-4 text-slate-500" />
              Attendance Records - {format(new Date(dateFilter), "MMMM dd, yyyy")}
            </CardTitle>
            <p className="text-xs text-slate-500">
              View-only. Employees manage their own attendance.
            </p>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <RefreshCw className="h-6 w-6 animate-spin text-blue-600" />
              <p className="ml-3 text-sm text-slate-500">Loading attendance...</p>
            </div>
          ) : attendanceRecords.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <div className="p-4 bg-slate-50 rounded-full mb-4">
                <UserX className="h-8 w-8 text-slate-300" />
              </div>
              <p className="text-sm text-slate-500">
                No attendance records found for {format(new Date(dateFilter), "MMMM dd, yyyy")}
              </p>
            </div>
          ) : (
            <div className="mobile-table-scroll">
              <Table>
                <TableHeader>
                  <TableRow className="bg-slate-50/50 hover:bg-slate-50/50">
                    <TableHead className="cursor-pointer hover:bg-slate-100 transition-colors" onClick={() => requestSort("userName")}><div className="flex items-center gap-1">Employee <ArrowUpDown className="h-3 w-3 text-slate-400" /></div></TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="cursor-pointer hover:bg-slate-100 transition-colors" onClick={() => requestSort("checkIn")}><div className="flex items-center gap-1">Check In <ArrowUpDown className="h-3 w-3 text-slate-400" /></div></TableHead>
                    <TableHead className="cursor-pointer hover:bg-slate-100 transition-colors" onClick={() => requestSort("checkOut")}><div className="flex items-center gap-1">Check Out <ArrowUpDown className="h-3 w-3 text-slate-400" /></div></TableHead>
                    <TableHead className="cursor-pointer hover:bg-slate-100 transition-colors hidden sm:table-cell" onClick={() => requestSort("breakIn")}><div className="flex items-center gap-1">Break In <ArrowUpDown className="h-3 w-3 text-slate-400" /></div></TableHead>
                    <TableHead className="cursor-pointer hover:bg-slate-100 transition-colors hidden sm:table-cell" onClick={() => requestSort("breakOut")}><div className="flex items-center gap-1">Break Out <ArrowUpDown className="h-3 w-3 text-slate-400" /></div></TableHead>
                    <TableHead className="cursor-pointer hover:bg-slate-100 transition-colors" onClick={() => requestSort("totalHours")}><div className="flex items-center gap-1">Total <ArrowUpDown className="h-3 w-3 text-slate-400" /></div></TableHead>
                    <TableHead className="font-semibold text-slate-600 hidden md:table-cell">Location</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {sortedAttendance.map((record) => (
                    <TableRow key={record.id} className="hover:bg-slate-50/50 transition-colors">
                      <TableCell className="font-medium text-slate-900 whitespace-nowrap">{record.userName || record.employeeName}</TableCell>
                      <TableCell>{getStatusBadge(record)}</TableCell>
                      <TableCell>
                        {record.checkIn ? (
                          <span className="text-sm font-mono bg-slate-100 dark:bg-slate-800 px-2 py-1 rounded text-slate-700">{record.checkIn}</span>
                        ) : (
                          <span className="text-xs text-slate-400">-</span>
                        )}
                      </TableCell>
                      <TableCell>
                        {record.checkOut ? (
                          <span className="text-sm font-mono bg-slate-100 dark:bg-slate-800 px-2 py-1 rounded text-slate-700">{record.checkOut}</span>
                        ) : (
                          <span className="text-xs text-slate-400">-</span>
                        )}
                      </TableCell>
                      <TableCell className="hidden sm:table-cell">
                        {record.breakIn ? (
                          <span className="text-sm font-mono bg-slate-100 dark:bg-slate-800 px-2 py-1 rounded text-slate-700">{record.breakIn}</span>
                        ) : (
                          <span className="text-xs text-slate-400">-</span>
                        )}
                      </TableCell>
                      <TableCell className="hidden sm:table-cell">
                        {record.breakOut ? (
                          <span className="text-sm font-mono bg-slate-100 dark:bg-slate-800 px-2 py-1 rounded text-slate-700">{record.breakOut}</span>
                        ) : (
                          <span className="text-xs text-slate-400">-</span>
                        )}
                      </TableCell>
                      <TableCell>
                        {record.totalHours ? (
                          <Badge variant="outline" className="font-mono bg-slate-50 text-slate-700 border-slate-200">
                            {record.totalHours}
                          </Badge>
                        ) : (
                          <span className="text-xs text-slate-400">-</span>
                        )}
                      </TableCell>
                      <TableCell className="hidden md:table-cell">
                        {(() => {
                          const renderLoc = (loc, label, colorClass) => {
                            if (!loc) return null;
                            if (typeof loc === 'string') {
                              return (
                                <div className={`flex items-center gap-1 text-xs ${colorClass}`}>
                                  <MapPin className="h-3 w-3 shrink-0" />
                                  <span>{label}: {loc}</span>
                                </div>
                              );
                            }
                            if (loc.lat && loc.lng) {
                              return (
                                <a
                                  href={`https://www.google.com/maps?q=${loc.lat},${loc.lng}`}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className={`inline-flex items-center gap-1 text-xs ${colorClass} hover:underline`}
                                  title={`Check ${label}`}
                                >
                                  <MapPin className="h-3 w-3" />
                                  {label}: Map
                                </a>
                              );
                            }
                            return null;
                          };

                          const inEvent = record.events?.find(e => e.type === 'checkIn' && e.location);
                          const outEvent = record.events?.find(e => e.type === 'checkOut' && e.location);
                          const inLoc = inEvent?.location || record.checkInLocation || null;
                          const outLoc = outEvent?.location || record.checkOutLocation || null;

                          if (!inLoc && !outLoc) return <span className="text-slate-400 text-xs">-</span>;

                          return (
                            <div className="flex flex-col gap-1">
                              {renderLoc(inLoc, 'In', 'text-emerald-600')}
                              {renderLoc(outLoc, 'Out', 'text-red-600')}
                            </div>
                          );
                        })()}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
