import { useEffect, useState, useMemo } from "react"
import { useNavigate } from "react-router-dom"
import { useQuery, useQueryClient } from "@tanstack/react-query"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import { Progress } from "@/components/ui/progress"
import {
  Users,
  Search,
  Shield,
  UserCheck,
  Trash2,
  Plus,
  RefreshCw,
  AlertCircle,
  Building2,
  Eye,
  EyeOff,
  ArrowLeft,
  Mail,
  User,
  Briefcase,
  ArrowUpDown
} from "lucide-react"
import { safeRedirect } from "@/lib/redirectUtils"

const getApiBase = () => import.meta.env.VITE_API_URL || ""

const fetchEmployees = async () => {
  const token = sessionStorage.getItem("firebaseToken")
  const base = getApiBase()
  if (!token) throw new Error("Authentication token not found. Please login again.")

  // Fetch ONLY active employees/admins to prevent deleted ones from showing up
  const employeesRes = await fetch(`${base}/api/admin/employees?isActive=true`, {
    headers: { Authorization: `Bearer ${token}` },
  })

  if (employeesRes.status === 401) throw new Error("SESSION_EXPIRED")
  if (!employeesRes.ok) throw new Error(`Failed to load employees: ${employeesRes.status}`)

  const orgEmployees = await employeesRes.json()
  return Array.isArray(orgEmployees) ? orgEmployees : (orgEmployees.employees || [])
}

export default function BusinessOwnerEmployeesPage() {
  const navigate = useNavigate()
  const queryClient = useQueryClient()

  const [currentUser, setCurrentUser] = useState(null)
  const [searchQuery, setSearchQuery] = useState("")
  const [sortConfig, setSortConfig] = useState({ key: null, direction: "asc" })

  const [showCreateAdmin, setShowCreateAdmin] = useState(false)
  const [createLoading, setCreateLoading] = useState(false)
  const [showPassword, setShowPassword] = useState(false)
  const [newAdmin, setNewAdmin] = useState({
    name: "",
    email: "",
    password: "",
    department: "",
    position: "",
  })

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

  const { data: employees = [], isLoading: loading, error: queryError } = useQuery({
    queryKey: ['bo-employees'],
    queryFn: fetchEmployees,
    enabled: !!currentUser,
  })

  const error = queryError?.message === "SESSION_EXPIRED"
    ? (() => { setTimeout(() => { sessionStorage.clear(); safeRedirect(navigate, "/business-owner/login") }, 2000); return "Session expired. Please login again." })()
    : queryError?.message || null

  const filteredEmployees = useMemo(() => {
    if (!Array.isArray(employees)) return []
    const query = searchQuery.toLowerCase()
    return employees.filter((emp) =>
      emp.name?.toLowerCase().includes(query) ||
      emp.email?.toLowerCase().includes(query) ||
      emp.department?.toLowerCase().includes(query) ||
      emp.position?.toLowerCase().includes(query)
    )
  }, [searchQuery, employees])

  const requestSort = (key) => {
    let direction = 'asc'
    if (sortConfig.key === key && sortConfig.direction === 'asc') direction = 'desc'
    setSortConfig({ key, direction })
  }

  const loadEmployees = () => queryClient.invalidateQueries({ queryKey: ['bo-employees'] })

  const handleCreateAdmin = async (e) => {
    e.preventDefault()

    if (!currentUser) {
      alert("User session not found. Please refresh the page.")
      return
    }

    if (!newAdmin.password || newAdmin.password.length < 6) {
      alert("Password must be at least 6 characters long")
      return
    }

    setCreateLoading(true)
    const token = sessionStorage.getItem("firebaseToken")
    const base = getApiBase()

    try {
      const response = await fetch(`${base}/api/admin/employees`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          name: newAdmin.name,
          email: newAdmin.email,
          password: newAdmin.password,
          department: "Management", // default for BO admins
          position: "Admin",
          role: "admin",
          organizationId: currentUser.organizationId,
          workingType: "Full-time",
          salary: "0",
        }),
      })

      const data = await response.json()

      if (response.ok) {
        const createdAdmin = data.employee || data
        const adminEmail = newAdmin.email
        const adminPassword = newAdmin.password

        // Invalidate both employees AND dashboard caches so they refresh instantly
        queryClient.invalidateQueries({ queryKey: ['bo-employees'] })
        queryClient.invalidateQueries({ queryKey: ['bo-dashboard'] })

        setShowCreateAdmin(false)
        setShowPassword(false)
        setNewAdmin({
          name: "",
          email: "",
          password: "",
        })

        alert(
          `Admin created successfully!\n\n` +
          `Email: ${adminEmail}\n` +
          `Password: ${adminPassword}\n\n` +
          `Share these credentials securely with the admin.`
        )
      } else {
        alert(`${data.error || "Failed to create admin"}`)
      }
    } catch (error) {
      console.error("Create admin error:", error)
      alert("Network error")
    } finally {
      setCreateLoading(false)
    }
  }

  const handleDeleteAdmin = async (adminId, adminName) => {
    // Standard window.confirm is used here. For better UX, we could use a custom dialog,
    // but for now, we'll keep it simple as it's a native browser feature.
    // The key update here is to ensure the rest of the UI remains consistent.
    if (!window.confirm(`Delete admin "${adminName}"? This will deactivate their account.`)) {
      return
    }

    // Optimistic Update: Immediately remove from UI before API call finishes
    queryClient.setQueryData(['bo-employees'], (oldData) => {
      if (!oldData) return []
      const list = Array.isArray(oldData) ? oldData : (oldData.employees || [])
      return list.filter(emp => emp.id !== adminId)
    })

    const token = sessionStorage.getItem("firebaseToken")
    const base = getApiBase()

    try {
      const response = await fetch(`${base}/api/admin/employees/${adminId}`, {
        method: "DELETE",
        headers: {
          Authorization: `Bearer ${token}`,
        },
      })

      if (response.ok) {
        // Success - trigger background refresh to be sure
        queryClient.invalidateQueries({ queryKey: ['bo-employees'] })
        queryClient.invalidateQueries({ queryKey: ['bo-dashboard'] })
      } else {
        alert("Failed to delete admin")
        // Revert optimistic update
        queryClient.invalidateQueries({ queryKey: ['bo-employees'] })
      }
    } catch (error) {
      console.error("Delete admin error:", error)
      alert("Network error")
      queryClient.invalidateQueries({ queryKey: ['bo-employees'] })
    }
  }

  const admins = Array.isArray(filteredEmployees) ? filteredEmployees.filter((e) => e.role === "admin") : []
  const regularEmployees = Array.isArray(filteredEmployees) ? filteredEmployees.filter((e) => e.role === "employee") : []

  const sortedRegularEmployees = useMemo(() => {
    if (!Array.isArray(regularEmployees)) return []
    let sortable = [...regularEmployees]
    if (sortConfig.key) {
      sortable.sort((a, b) => {
        const aVal = a[sortConfig.key]?.toString().toLowerCase() || ''
        const bVal = b[sortConfig.key]?.toString().toLowerCase() || ''
        if (aVal < bVal) return sortConfig.direction === 'asc' ? -1 : 1
        if (aVal > bVal) return sortConfig.direction === 'asc' ? 1 : -1
        return 0
      })
    }
    return sortable
  }, [regularEmployees, sortConfig])

  // Debug: Log roles
  console.log("🔍 All employees roles:", filteredEmployees?.map?.(e => ({ name: e.name, role: e.role })))
  console.log("👑 Admins found:", admins.length)
  console.log("👤 Employees found:", regularEmployees.length)

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
            Organization Employees
          </h1>
          <p className="text-slate-500 mt-1">
            View all employees and manage admins in your organization
          </p>
          {currentUser.organizationId && (
            <Badge variant="outline" className="mt-2 text-slate-500 border-slate-200">
              <Building2 className="mr-1 h-3 w-3" />
              Org: {currentUser.organizationId.substring(0, 12)}...
            </Badge>
          )}
        </div>
        <div className="flex items-center gap-3">
          <Button
            variant="outline"
            size="sm"
            onClick={loadEmployees}
            disabled={loading}
            className="gap-2 border-blue-200 text-blue-600 hover:bg-blue-50 hover:text-blue-700"
          >
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
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

      {/* Error State */}
      {error && (
        <Card className="border-red-200 bg-red-50 dark:border-red-800 dark:bg-red-950/30">
          <CardContent className="flex items-start gap-3 pt-6">
            <AlertCircle className="h-5 w-5 text-red-600 mt-0.5 flex-shrink-0" />
            <div className="flex-1">
              <p className="font-semibold text-red-900 dark:text-red-100">Error Loading Employees</p>
              <p className="text-sm mt-1 text-red-700 dark:text-red-300">{error}</p>
              <Button variant="outline" size="sm" onClick={loadEmployees} className="mt-3">
                <RefreshCw className="mr-2 h-4 w-4" />
                Retry
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Stats Cards */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card className="border-slate-200 shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-slate-500">Total Employees</CardTitle>
            <div className="p-2 bg-blue-50 dark:bg-blue-900/30 rounded-lg">
              <Users className="h-4 w-4 text-blue-600 dark:text-blue-400" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-slate-900 dark:text-slate-100">
              {regularEmployees.length}
            </div>
            <p className="text-xs text-slate-500 mt-1">Active employees</p>
          </CardContent>
        </Card>

        <Card className="border-slate-200 shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-slate-500">Admins</CardTitle>
            <div className="p-2 bg-slate-100 dark:bg-slate-800 rounded-lg">
              <Shield className="h-4 w-4 text-slate-600 dark:text-slate-400" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-slate-900 dark:text-slate-100">
              {admins.length}
            </div>
            <p className="text-xs text-slate-500 mt-1">Managing employees</p>
          </CardContent>
        </Card>

        <Card className="border-slate-200 shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-slate-500">Total Members</CardTitle>
            <div className="p-2 bg-blue-50 dark:bg-blue-900/30 rounded-lg">
              <UserCheck className="h-4 w-4 text-blue-600 dark:text-blue-400" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-slate-900 dark:text-slate-100">
              {filteredEmployees.length}
            </div>
            <p className="text-xs text-slate-500 mt-1">All organization members</p>
          </CardContent>
        </Card>
      </div>

      {/* Search & Create Admin */}
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <Input
            placeholder="Search by name, email, department..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10 h-10 bg-white border-slate-200 focus:border-blue-500 focus:ring-blue-500"
          />
        </div>

        <Dialog open={showCreateAdmin} onOpenChange={setShowCreateAdmin}>
          <DialogTrigger asChild>
            <Button className="bg-blue-600 hover:bg-blue-700 text-white shadow-md hover:shadow-lg transition-all">
              <Plus className="mr-2 h-4 w-4" />
              Create Admin
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-[450px]">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Shield className="h-5 w-5 text-blue-600" />
                Create New Admin
              </DialogTitle>
              <p className="text-sm text-slate-500 mt-2">
                Create a new admin account for your organization.
              </p>
            </DialogHeader>
            <form onSubmit={handleCreateAdmin} className="space-y-4 mt-4">
              <div className="space-y-2">
                <Label htmlFor="name">Full Name <span className="text-red-500">*</span></Label>
                <div className="relative">
                  <User className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                  <Input
                    id="name"
                    value={newAdmin.name}
                    onChange={(e) => setNewAdmin((s) => ({ ...s, name: e.target.value }))}
                    placeholder="John Doe"
                    required
                    disabled={createLoading}
                    className="pl-10"
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="email">Email <span className="text-red-500">*</span></Label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                  <Input
                    id="email"
                    type="email"
                    value={newAdmin.email}
                    onChange={(e) => setNewAdmin((s) => ({ ...s, email: e.target.value }))}
                    placeholder="john@example.com"
                    required
                    disabled={createLoading}
                    className="pl-10"
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="password">Password <span className="text-red-500">*</span></Label>
                <div className="relative">
                  <Input
                    id="password"
                    type={showPassword ? "text" : "password"}
                    value={newAdmin.password}
                    onChange={(e) => setNewAdmin((s) => ({ ...s, password: e.target.value }))}
                    placeholder="Minimum 6 characters"
                    minLength={6}
                    required
                    disabled={createLoading}
                    className="pr-10"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                    disabled={createLoading}
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
                <p className="text-xs text-slate-500">Share this password securely with the admin</p>
              </div>
              <div className="flex justify-end gap-2 pt-4">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    setShowCreateAdmin(false)
                    setShowPassword(false)
                    setNewAdmin({ name: "", email: "", password: "" })
                  }}
                  disabled={createLoading}
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={createLoading}
                  className="bg-blue-600 hover:bg-blue-700 text-white"
                >
                  {createLoading ? (
                    <>
                      <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                      Creating...
                    </>
                  ) : (
                    "Create Admin"
                  )}
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {/* Admins Table */}
      <Card className="border-slate-200 shadow-sm overflow-hidden">
        <CardHeader className="bg-slate-50/50 border-b border-slate-200">
          <CardTitle className="flex items-center gap-2 text-base text-slate-800">
            <Shield className="h-4 w-4 text-slate-500" />
            Admins ({admins.length})
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <RefreshCw className="h-6 w-6 animate-spin text-blue-600" />
              <p className="ml-3 text-sm text-slate-500">Loading admins...</p>
            </div>
          ) : admins.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <div className="p-4 bg-slate-50 rounded-full mb-4">
                <Shield className="h-8 w-8 text-slate-300" />
              </div>
              <p className="text-sm text-slate-500">No admins found. Create one to start managing employees.</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow className="bg-slate-50/50 hover:bg-slate-50/50">
                  <TableHead className="font-semibold text-slate-600">Name</TableHead>
                  <TableHead className="font-semibold text-slate-600">Email</TableHead>
                  <TableHead className="font-semibold text-slate-600">Department</TableHead>
                  <TableHead className="font-semibold text-slate-600">Position</TableHead>
                  <TableHead className="font-semibold text-slate-600">Role</TableHead>
                  <TableHead className="text-right font-semibold text-slate-600">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {admins.map((admin) => (
                  <TableRow key={admin.id} className="hover:bg-slate-50/50 transition-colors">
                    <TableCell className="font-medium text-slate-900">{admin.name}</TableCell>
                    <TableCell className="text-slate-600">{admin.email}</TableCell>
                    <TableCell className="text-slate-600">{admin.department || "-"}</TableCell>
                    <TableCell className="text-slate-600">{admin.position || "Admin"}</TableCell>
                    <TableCell>
                      <Badge variant="secondary" className="bg-slate-100 text-slate-700 hover:bg-slate-200 border-0">
                        <Shield className="mr-1 h-3 w-3" />
                        Admin
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-red-600 hover:text-red-700 hover:bg-red-50"
                        onClick={() => handleDeleteAdmin(admin.id, admin.name)}
                      >
                        <Trash2 className="mr-1 h-4 w-4" />
                        Delete
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Employees Table */}
      <Card className="border-slate-200 shadow-sm overflow-hidden">
        <CardHeader className="bg-slate-50/50 border-b border-slate-200">
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2 text-base text-slate-800">
              <Users className="h-4 w-4 text-slate-500" />
              Employees ({regularEmployees.length})
            </CardTitle>
            <p className="text-xs text-slate-500">
              View-only. Admins manage employee details.
            </p>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <RefreshCw className="h-6 w-6 animate-spin text-blue-600" />
              <p className="ml-3 text-sm text-slate-500">Loading employees...</p>
            </div>
          ) : regularEmployees.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <div className="p-4 bg-slate-50 rounded-full mb-4">
                <Users className="h-8 w-8 text-slate-300" />
              </div>
              <p className="text-sm text-slate-500">No employees found.</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow className="bg-slate-50/50 hover:bg-slate-50/50">
                  <TableHead className="font-semibold text-slate-600 cursor-pointer hover:bg-slate-100 transition-colors" onClick={() => requestSort("name")}>
                    <div className="flex items-center gap-1">Name <ArrowUpDown className="h-3 w-3 text-slate-400" /></div>
                  </TableHead>
                  <TableHead className="font-semibold text-slate-600 cursor-pointer hover:bg-slate-100 transition-colors" onClick={() => requestSort("email")}>
                    <div className="flex items-center gap-1">Email <ArrowUpDown className="h-3 w-3 text-slate-400" /></div>
                  </TableHead>
                  <TableHead className="font-semibold text-slate-600 cursor-pointer hover:bg-slate-100 transition-colors" onClick={() => requestSort("department")}>
                    <div className="flex items-center gap-1">Department <ArrowUpDown className="h-3 w-3 text-slate-400" /></div>
                  </TableHead>
                  <TableHead className="font-semibold text-slate-600 cursor-pointer hover:bg-slate-100 transition-colors" onClick={() => requestSort("position")}>
                    <div className="flex items-center gap-1">Position <ArrowUpDown className="h-3 w-3 text-slate-400" /></div>
                  </TableHead>
                  <TableHead className="font-semibold text-slate-600 cursor-pointer hover:bg-slate-100 transition-colors" onClick={() => requestSort("workingType")}>
                    <div className="flex items-center gap-1">Type <ArrowUpDown className="h-3 w-3 text-slate-400" /></div>
                  </TableHead>
                  <TableHead className="font-semibold text-slate-600 cursor-pointer hover:bg-slate-100 transition-colors" onClick={() => requestSort("isActive")}>
                    <div className="flex items-center gap-1">Status <ArrowUpDown className="h-3 w-3 text-slate-400" /></div>
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {sortedRegularEmployees.map((emp) => (
                  <TableRow key={emp.id} className="hover:bg-slate-50/50 transition-colors">
                    <TableCell className="font-medium text-slate-900">{emp.name}</TableCell>
                    <TableCell className="text-slate-600">{emp.email}</TableCell>
                    <TableCell className="text-slate-600">{emp.department || "-"}</TableCell>
                    <TableCell className="text-slate-600">{emp.position || "-"}</TableCell>
                    <TableCell className="text-slate-600">{emp.workingType || "-"}</TableCell>
                    <TableCell>
                      <Badge
                        variant="outline"
                        className={
                          emp.isActive === false
                            ? "bg-red-50 text-red-700 border-red-200"
                            : "bg-blue-50 text-blue-700 border-blue-200"
                        }
                      >
                        {emp.isActive === false ? 'Inactive' : 'Active'}
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
