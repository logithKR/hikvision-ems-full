import { useEffect, useState, useMemo, useCallback } from"react"
import { useNavigate } from"react-router-dom"
import { useQuery, useQueryClient, useMutation } from"@tanstack/react-query"
import { Card, CardContent, CardHeader, CardTitle } from"@/components/ui/card"
import { Button } from"@/components/ui/button"
import { Input } from"@/components/ui/input"
import { Label } from"@/components/ui/label"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from"@/components/ui/table"
import { Badge } from"@/components/ui/badge"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from"@/components/ui/select"
import { Skeleton } from"@/components/ui/skeleton"
import {
 Dialog, DialogContent, DialogDescription, DialogFooter,
 DialogHeader, DialogTitle, DialogTrigger, DialogBody
} from"@/components/ui/dialog"
import {
 AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
 AlertDialogDescription, AlertDialogFooter, AlertDialogHeader,
 AlertDialogTitle, AlertDialogTrigger
} from"@/components/ui/alert-dialog"
import {
 Users, UserCheck, UserX, Search, Filter, ArrowLeft, RefreshCw,
 AlertCircle, Edit, Trash2, UserPlus, Building2, ChevronDown,
 ChevronRight, Mail, Phone, Shield, Eye, X, Save, LayoutGrid, List, Loader2
} from"lucide-react"
import { getCurrentUser, isAuthenticated } from"@/lib/auth"
import { getValidIdToken } from"@/lib/firebaseClient"
import { toast } from"sonner"

const getApiBase = () => import.meta.env.VITE_API_URL ||""

export default function AdminEmployeesPage() {
 const navigate = useNavigate()
 const queryClient = useQueryClient()

 const [currentUser, setCurrentUser] = useState(null)

 // Search & Filters
 const [searchTerm, setSearchTerm] = useState("")
 const [deptFilter, setDeptFilter] = useState("all")
 const [roleFilter, setRoleFilter] = useState("all")
 const [statusFilter, setStatusFilter] = useState("all")
 const [managerFilter, setManagerFilter] = useState("all")
 const [groupByDept, setGroupByDept] = useState(false)

 // Edit Dialog
 const [editDialogOpen, setEditDialogOpen] = useState(false)
 const [editingEmployee, setEditingEmployee] = useState(null)
 const [editForm, setEditForm] = useState({})

 // Detail View Dialog
 const [detailDialogOpen, setDetailDialogOpen] = useState(false)
 const [viewingEmployee, setViewingEmployee] = useState(null)

 // Manager Assignment Dialog
 const [managerDialogOpen, setManagerDialogOpen] = useState(false)
 const [assigningEmployee, setAssigningEmployee] = useState(null)
 const [selectedManagerId, setSelectedManagerId] = useState("")

 // Create Employee Dialog
 const [createDialogOpen, setCreateDialogOpen] = useState(false)
 const [createForm, setCreateForm] = useState({
 name:"", email:"", password:"", department:"", departmentId:"", phone:"", position:"", role:"employee", hikvisionEmployeeId:""
 })

 // Department Management
 const [deptDialogOpen, setDeptDialogOpen] = useState(false)
 const [deptForm, setDeptForm] = useState({ name:"", description:"", maxEmployees: 50 })
 const [deleteDeptConfirmOpen, setDeleteDeptConfirmOpen] = useState(false)
 const [deptToDelete, setDeptToDelete] = useState(null)

 // Department-specific member creation
 const [deptMemberDialogOpen, setDeptMemberDialogOpen] = useState(false)
 const [deptMemberType, setDeptMemberType] = useState("employee") // 'hod', 'manager', 'employee'
 const [selectedDeptForMember, setSelectedDeptForMember] = useState(null)
 const [deptMemberForm, setDeptMemberForm] = useState({
 name:"", email:"", password:"", phone:"", position:"", managerId:"", hikvisionEmployeeId:""
 })

 // Auth Check
 useEffect(() => {
 if (!isAuthenticated()) {
 navigate("/login")
 return
 }
 const user = getCurrentUser()
 if (!user || (user.role !=="admin" && user.role !=="system_admin")) {
 navigate("/login")
 return
 }
 setCurrentUser(user)
 }, [navigate])

 // ── Fetch All Employees ──────────────────────────
 const { data: employees = [], isLoading: loading, error: queryError } = useQuery({
 queryKey: ['admin-employees'],
 queryFn: async () => {
 const token = await getValidIdToken()
 if (!token) throw new Error("Authentication failed.")
 const base = getApiBase()
 const response = await fetch(`${base}/api/admin/employees`, {
 headers: { Authorization: `Bearer ${token}` },
 })
 if (!response.ok) throw new Error(`Failed to load employees: ${response.status}`)
 const data = await response.json()
 return data.employees || []
 },
 enabled: !!currentUser,
 staleTime: 30000, // Cache for 30 seconds
 })

 // ── Fetch Organization Departments ──────────────────
 const { data: orgDepartments = [], isLoading: loadingDepts } = useQuery({
 queryKey: ['admin-departments'],
 queryFn: async () => {
 const token = await getValidIdToken()
 if (!token) throw new Error("Auth failed")
 const base = getApiBase()
 const res = await fetch(`${base}/api/admin/departments`, {
 headers: { Authorization: `Bearer ${token}` }
 })
 if (!res.ok) throw new Error("Failed to load departments")
 const data = await res.json()
 return data.departments || []
 },
 enabled: !!currentUser,
 staleTime: 30000,
 })

 const error = queryError?.message || null
 const refreshEmployees = () => queryClient.invalidateQueries({ queryKey: ['admin-employees'] })
 const refreshDepartments = () => queryClient.invalidateQueries({ queryKey: ['admin-departments'] })

 // ── Update Employee Mutation ────────────────────
 const updateMutation = useMutation({
 mutationFn: async ({ id, data }) => {
 const token = await getValidIdToken()
 const base = getApiBase()
 const response = await fetch(`${base}/api/admin/employees/${id}`, {
 method: 'PUT',
 headers: {
 Authorization: `Bearer ${token}`,
 'Content-Type': 'application/json',
 },
 body: JSON.stringify(data),
 })
 if (!response.ok) {
 const errData = await response.json()
 throw new Error(errData.error || 'Failed to update employee')
 }
 return response.json()
 },
 onSuccess: () => {
 toast.success('Employee updated successfully')
 queryClient.invalidateQueries({ queryKey: ['admin-employees'] })
 queryClient.invalidateQueries({ queryKey: ['admin-dashboard'] })
 setEditDialogOpen(false)
 setEditingEmployee(null)
 },
 onError: (err) => {
 toast.error(err.message)
 },
 })

 // ── Delete Employee Mutation ────────────────────
 const deleteMutation = useMutation({
 mutationFn: async (id) => {
 const token = await getValidIdToken()
 const base = getApiBase()
 const response = await fetch(`${base}/api/admin/employees/${id}`, {
 method: 'DELETE',
 headers: { Authorization: `Bearer ${token}` },
 })
 if (!response.ok) {
 const errData = await response.json()
 throw new Error(errData.error || 'Failed to delete employee')
 }
 return response.json()
 },
 onSuccess: () => {
 toast.success('Employee deleted successfully')
 queryClient.invalidateQueries({ queryKey: ['admin-employees'] })
 queryClient.invalidateQueries({ queryKey: ['admin-dashboard'] })
 },
 onError: (err) => {
 toast.error(err.message)
 },
 })

 // ── Restore Employee Mutation ────────────────────
 const restoreMutation = useMutation({
 mutationFn: async (id) => {
 const token = await getValidIdToken()
 const base = getApiBase()
 const response = await fetch(`${base}/api/admin/employees/${id}/restore`, {
 method: 'POST',
 headers: { Authorization: `Bearer ${token}` },
 })
 if (!response.ok) {
 const errData = await response.json()
 throw new Error(errData.error || 'Failed to restore employee')
 }
 return response.json()
 },
 onSuccess: () => {
 toast.success('Employee restored successfully')
 queryClient.invalidateQueries({ queryKey: ['admin-employees'] })
 queryClient.invalidateQueries({ queryKey: ['admin-dashboard'] })
 },
 onError: (err) => {
 toast.error(err.message)
 },
 })

 // ── Assign Manager Mutation ─────────────────────
 const assignManagerMutation = useMutation({
 mutationFn: async ({ employeeId, managerId }) => {
 const token = await getValidIdToken()
 const base = getApiBase()
 const response = await fetch(`${base}/api/admin/employees/${employeeId}/assign-manager`, {
 method: 'PUT',
 headers: {
 Authorization: `Bearer ${token}`,
 'Content-Type': 'application/json',
 },
 body: JSON.stringify({ managerId: managerId || null }),
 })
 if (!response.ok) {
 const errData = await response.json()
 throw new Error(errData.error || 'Failed to assign manager')
 }
 return response.json()
 },
 onSuccess: () => {
 toast.success('Manager assigned successfully')
 queryClient.invalidateQueries({ queryKey: ['admin-employees'] })
 setManagerDialogOpen(false)
 setAssigningEmployee(null)
 },
 onError: (err) => {
 toast.error(err.message)
 }
 })

 // ── Create Employee Mutation ────────────────────
 const createMutation = useMutation({
 mutationFn: async (formData) => {
 const token = await getValidIdToken()
 const base = getApiBase()
 const response = await fetch(`${base}/api/admin/employees`, {
 method: 'POST',
 headers: {
 Authorization: `Bearer ${token}`,
 'Content-Type': 'application/json',
 },
 body: JSON.stringify(formData),
 })
 if (!response.ok) {
 const errData = await response.json()
 throw new Error(errData.error || 'Failed to create employee')
 }
 return response.json()
 },
 onSuccess: () => {
 toast.success('Employee created successfully')
 queryClient.invalidateQueries({ queryKey: ['admin-employees'] })
 queryClient.invalidateQueries({ queryKey: ['admin-dashboard'] })
 setCreateDialogOpen(false)
 setCreateForm({ name:"", email:"", password:"", department:"", departmentId:"", phone:"", position:"", role:"employee", hikvisionEmployeeId:"" })
 },
 onError: (err) => {
 toast.error(err.message)
 }
 })

 const handleCreateEmployee = () => {
 if (!createForm.name || !createForm.email || !createForm.password) return
 const payload = {
 ...createForm,
 isManager: createForm.role === 'manager',
 }
 createMutation.mutate(payload)
 }

 // ── Create Department Mutation ──────────────────
 const createDeptMutation = useMutation({
 mutationFn: async (data) => {
 const token = await getValidIdToken()
 const res = await fetch(`${getApiBase()}/api/admin/departments`, {
 method: 'POST',
 headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
 body: JSON.stringify(data)
 })
 if (!res.ok) {
 const errData = await res.json()
 throw new Error(errData.error || 'Failed to create department')
 }
 return res.json()
 },
 onSuccess: () => {
 toast.success('Department created successfully')
 queryClient.invalidateQueries({ queryKey: ['admin-departments'] })
 setDeptDialogOpen(false)
 setDeptForm({ name:"", description:"", maxEmployees: 50 })
 },
 onError: (err) => {
 toast.error(err.message)
 }
 })

 // ── Delete Department Mutation ──────────────────
 const deleteDeptMutation = useMutation({
 mutationFn: async (id) => {
 const token = await getValidIdToken()
 const res = await fetch(`${getApiBase()}/api/admin/departments/${id}`, {
 method: 'DELETE',
 headers: { Authorization: `Bearer ${token}` }
 })
 if (!res.ok) {
 const errData = await res.json()
 throw new Error(errData.error || 'Failed to delete department')
 }
 return res.json()
 },
 onSuccess: () => {
 toast.success('Department deleted successfully')
 queryClient.invalidateQueries({ queryKey: ['admin-departments'] })
 queryClient.invalidateQueries({ queryKey: ['admin-employees'] })
 setDeleteDeptConfirmOpen(false)
 setDeptToDelete(null)
 },
 onError: (err) => {
 toast.error(err.message)
 }
 })

 // ── Create Dept Member (HOD/Manager/Employee) Mutation ──
 const createDeptMemberMutation = useMutation({
 mutationFn: async (data) => {
 const token = await getValidIdToken()
 const endpoint = deptMemberType === 'hod'
 ? `/api/admin/departments/${data.departmentId}/hod`
 : deptMemberType === 'manager'
 ? `/api/admin/departments/${data.departmentId}/managers`
 : `/api/admin/departments/${data.departmentId}/employees`
 const res = await fetch(`${getApiBase()}${endpoint}`, {
 method: 'POST',
 headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
 body: JSON.stringify(data)
 })
 if (!res.ok) {
 const errData = await res.json()
 throw new Error(errData.error || `Failed to create ${deptMemberType}`)
 }
 return res.json()
 },
 onSuccess: () => {
 toast.success('Department member created successfully')
 queryClient.invalidateQueries({ queryKey: ['admin-departments'] })
 queryClient.invalidateQueries({ queryKey: ['admin-employees'] })
 setDeptMemberDialogOpen(false)
 setDeptMemberForm({ name:"", email:"", password:"", phone:"", position:"", managerId:"", hikvisionEmployeeId:"" })
 },
 onError: (err) => {
 toast.error(err.message)
 }
 })

 // ── Dept member creation handler ───────────────
 const openDeptMemberDialog = (dept, type) => {
 setSelectedDeptForMember(dept)
 setDeptMemberType(type)
 setDeptMemberForm({
 name:"", email:"", password:"", phone:"",
 position: type === 'hod' ? 'Tech Lead' :"",
 managerId:"",
 hikvisionEmployeeId:""
 })
 setDeptMemberDialogOpen(true)
 }

 const handleCreateDeptMember = () => {
 if (!deptMemberForm.name || !deptMemberForm.email || !deptMemberForm.password) return
 const payload = {
 ...deptMemberForm,
 departmentId: selectedDeptForMember?.id
 }
 // For employees: if managerId is empty or '__hod__', let backend default to HOD
 if (deptMemberType === 'employee') {
 if (payload.managerId === '__hod__' || !payload.managerId) {
 delete payload.managerId // backend defaults to HOD
 }
 } else {
 delete payload.managerId // managers auto-get HOD on backend
 }
 createDeptMemberMutation.mutate(payload)
 }

 // ── Computed Values ─────────────────────────────
 const departments = useMemo(() => {
 const depts = new Set()
 employees.forEach((emp) => {
 if (emp.department) depts.add(emp.department)
 })
 return Array.from(depts).sort()
 }, [employees])

 const managers = useMemo(() => {
 return employees.filter(
 (emp) => emp.isManager === true || emp.role === 'manager' || emp.isDeptHead === true
 )
 }, [employees])

 // Managers available for manager assignment in the Assign Manager dialog
 const assignableManagers = useMemo(() => {
 return employees.filter(
 (emp) => (emp.isManager === true || emp.role === 'manager' || emp.isDeptHead === true) && emp.isActive !== false
 )
 }, [employees])

 // ── Client-Side Filtering with useMemo ──────────
 const filteredEmployees = useMemo(() => {
 let filtered = employees

 // Search
 if (searchTerm.trim()) {
 const term = searchTerm.toLowerCase()
 filtered = filtered.filter(
 (emp) =>
 emp.name?.toLowerCase().includes(term) ||
 emp.email?.toLowerCase().includes(term) ||
 emp.department?.toLowerCase().includes(term) ||
 emp.phone?.toLowerCase().includes(term)
 )
 }

 // Department filter
 if (deptFilter !=="all") {
 filtered = filtered.filter((emp) => emp.department === deptFilter)
 }

 // Role filter
 if (roleFilter !=="all") {
 filtered = filtered.filter((emp) => emp.role === roleFilter)
 }

 // Status filter
 if (statusFilter !=="all") {
 if (statusFilter ==="active") {
 filtered = filtered.filter((emp) => emp.isActive !== false)
 } else {
 filtered = filtered.filter((emp) => emp.isActive === false)
 }
 }

 // Manager filter
 if (managerFilter !=="all") {
 if (managerFilter ==="unassigned") {
 filtered = filtered.filter((emp) => !emp.managerId)
 } else {
 filtered = filtered.filter((emp) => emp.managerId === managerFilter)
 }
 }

 return filtered
 }, [employees, searchTerm, deptFilter, roleFilter, statusFilter, managerFilter])

 // ── Grouped by Department ───────────────────────
 const groupedEmployees = useMemo(() => {
 if (!groupByDept) return null
 const groups = {}
 filteredEmployees.forEach((emp) => {
 const dept = emp.department ||"Unassigned"
 if (!groups[dept]) groups[dept] = []
 groups[dept].push(emp)
 })
 return Object.entries(groups).sort(([a], [b]) => a.localeCompare(b))
 }, [filteredEmployees, groupByDept])

 // ── Stats ───────────────────────────────────────
 const stats = useMemo(() => {
 const total = employees.length
 const active = employees.filter((e) => e.isActive !== false).length
 const inactive = total - active
 const withManagers = employees.filter((e) => e.managerId).length
 return { total, active, inactive, withManagers }
 }, [employees])

 // ── Helpers ─────────────────────────────────────
 const getManagerName = useCallback(
 (managerId) => {
 if (!managerId) return null
 const mgr = employees.find((e) => e.uid === managerId || e.id === managerId)
 return mgr?.name ||"Unknown"
 },
 [employees]
 )

 const getRoleBadge = (role, emp) => {
 // Check for HOD and Manager flags first
 if (emp?.isDeptHead) return <Badge className="bg-purple-100 text-purple-800 border-purple-200">Tech Lead</Badge>
 if (emp?.isManager) return <Badge className="bg-blue-50 text-blue-700 border-blue-200">Manager</Badge>
 switch (role) {
 case"admin":
 return <Badge className="bg-blue-100 text-blue-800 border-blue-200">Admin</Badge>
 case"business_owner":
 return <Badge className="bg-blue-600 text-white border-0">Owner</Badge>
 case"team_lead":
 return <Badge className="bg-blue-50 text-blue-700 border-blue-200">Team Lead</Badge>
 case"manager":
 return <Badge className="bg-blue-50 text-blue-700 border-blue-200">Manager</Badge>
 default:
 return <Badge className="bg-secondary text-slate-600 border-border">Employee</Badge>
 }
 }

 const openEditDialog = (emp) => {
 setEditingEmployee(emp)
 setEditForm({
 name: emp.name ||"",
 email: emp.email ||"",
 department: emp.department ||"",
 phone: emp.phone || "",
 position: emp.position || "",
 role: emp.role || "employee",
 managerId: emp.managerId || "",
 hikvisionEmployeeId: emp.hikvisionEmployeeId || "",
 })
 updateMutation.reset() // clear any previous error
 setEditDialogOpen(true)
 }

 const openManagerDialog = (emp) => {
 setAssigningEmployee(emp)
 setSelectedManagerId(emp.managerId ||"")
 setManagerDialogOpen(true)
 }

 const handleSaveEdit = () => {
 if (!editingEmployee) return
 const id = editingEmployee.uid || editingEmployee.id
 updateMutation.mutate({ id, data: editForm })
 }

 const handleAssignManager = () => {
 if (!assigningEmployee) return
 const employeeId = assigningEmployee.uid || assigningEmployee.id
 assignManagerMutation.mutate({ employeeId, managerId: selectedManagerId || null })
 }

 if (!currentUser) return null

 const statCards = [
 { label:"Total", value: stats.total, sub:"All staff", icon: Users, accent:"text-blue-600", iconBg:"bg-blue-50 border-blue-100" },
 { label:"Active", value: stats.active, sub:"Currently active", icon: UserCheck, accent:"text-blue-600", iconBg:"bg-blue-50 border-blue-100" },
 { label:"Inactive", value: stats.inactive, sub:"Deactivated", icon: UserX, accent:"text-muted-foreground", iconBg:"bg-background border-border" },
 { label:"Has Manager", value: stats.withManagers, sub:"Assigned", icon: UserPlus, accent:"text-blue-600", iconBg:"bg-blue-50 border-blue-100" },
 ]

 // ── Render Employee Row ─────────────────────────
 const renderEmployeeRow = (emp) => {
 const id = emp.uid || emp.id
 const isAdmin = emp.role ==="admin"
 const isOwner = emp.role ==="business_owner"

 return (
 <TableRow key={id} className="border-b border-slate-50 hover:bg-background/70 transition-colors">
 {/* Name + Email */}
 <TableCell className="py-3.5 px-6">
 <div className="flex items-center gap-3">
 <div className="h-9 w-9 rounded-full bg-blue-100 border border-blue-200 flex items-center justify-center text-blue-700 text-xs font-bold shadow-sm">
 {(emp.name ||"U").substring(0, 2).toUpperCase()}
 </div>
 <div>
 <div className="text-sm font-medium text-foreground">{emp.name ||"—"}</div>
 <div className="text-xs text-muted-foreground">{emp.email ||"—"}</div>
 </div>
 </div>
 </TableCell>

 {/* Role */}
 <TableCell className="py-3.5">{getRoleBadge(emp.role, emp)}</TableCell>

 {/* Position */}
 <TableCell className="py-3.5">
 {emp.position ? (
 <span className="text-sm text-foreground">{emp.position}</span>
 ) : (
 <span className="text-xs text-slate-300 italic">No position</span>
 )}
 </TableCell>

 {/* Department */}
 <TableCell className="py-3.5">
 {emp.department ? (
 <span className="text-sm text-foreground">{emp.department}</span>
 ) : (
 <span className="text-xs text-slate-300 italic">No dept</span>
 )}
 </TableCell>

 {/* Manager */}
 <TableCell className="py-3.5">
 {emp.role === 'business_owner' || emp.role === 'admin' ? (
 <span className="text-xs text-slate-300">—</span>
 ) : emp.managerId ? (
 <span className="text-sm text-foreground">{getManagerName(emp.managerId)}</span>
 ) : (
 <span className="text-xs text-slate-300 italic">Unassigned</span>
 )}
 </TableCell>

 {/* Status */}
 <TableCell className="py-3.5">
 {emp.isActive !== false ? (
 <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded text-xs font-medium bg-blue-50 text-blue-700 border border-blue-200">
 <span className="w-1.5 h-1.5 rounded-full bg-blue-500" />
 Active
 </span>
 ) : (
 <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded text-xs font-medium bg-secondary text-muted-foreground border border-border">
 <span className="w-1.5 h-1.5 rounded-full bg-slate-400" />
 Inactive
 </span>
 )}
 </TableCell>

 {/* Actions */}
 <TableCell className="py-3.5 text-right">
 <div className="flex justify-end gap-1.5">
 {/* View */}
 <Button
 variant="ghost"
 size="sm"
 className="h-8 w-8 p-0 text-muted-foreground hover:text-blue-600 hover:bg-blue-50"
 onClick={() => { setViewingEmployee(emp); setDetailDialogOpen(true) }}
 title="View Details"
 >
 <Eye className="h-4 w-4" />
 </Button>

 {/* Edit (not for BO or self) */}
 {!isOwner && (
 <Button
 variant="ghost"
 size="sm"
 className="h-8 w-8 p-0 text-muted-foreground hover:text-blue-600 hover:bg-blue-50"
 onClick={() => openEditDialog(emp)}
 title="Edit"
 >
 <Edit className="h-4 w-4" />
 </Button>
 )}

 {/* Assign Manager (not for admins or BO) */}
 {!isAdmin && !isOwner && (
 <Button
 variant="ghost"
 size="sm"
 className="h-8 w-8 p-0 text-muted-foreground hover:text-blue-600 hover:bg-blue-50"
 onClick={() => openManagerDialog(emp)}
 title="Assign Manager"
 >
 <UserPlus className="h-4 w-4" />
 </Button>
 )}

 {/* Delete/Restore (not for self, BO, or admins) */}
 {!isOwner && !isAdmin && (
 emp.isActive === false ? (
 <AlertDialog>
 <AlertDialogTrigger asChild>
 <Button
 variant="ghost"
 size="sm"
 className="h-8 w-8 p-0 text-muted-foreground hover:text-green-600 hover:bg-green-50"
 title="Restore"
 disabled={restoreMutation.isPending && restoreMutation.variables === id}
 >
 {restoreMutation.isPending && restoreMutation.variables === id ? (
 <Loader2 className="h-4 w-4 animate-spin" />
 ) : (
 <RefreshCw className="h-4 w-4" />
 )}
 </Button>
 </AlertDialogTrigger>
 <AlertDialogContent>
 <AlertDialogHeader>
 <AlertDialogTitle>Restore Employee</AlertDialogTitle>
 <AlertDialogDescription>
 Are you sure you want to restore <strong>{emp.name}</strong>? This will reactivate their account and allow them to log in again.
 </AlertDialogDescription>
 </AlertDialogHeader>
 <AlertDialogFooter>
 <AlertDialogCancel className="border-border">Cancel</AlertDialogCancel>
 <AlertDialogAction
 className="bg-green-600 hover:bg-green-700 text-white"
 onClick={() => restoreMutation.mutate(id)}
 >
 Restore
 </AlertDialogAction>
 </AlertDialogFooter>
 </AlertDialogContent>
 </AlertDialog>
 ) : (
 <AlertDialog>
 <AlertDialogTrigger asChild>
 <Button
 variant="ghost"
 size="sm"
 className="h-8 w-8 p-0 text-muted-foreground hover:text-red-600 hover:bg-red-50"
 title="Delete"
 disabled={deleteMutation.isPending && deleteMutation.variables === id}
 >
 {deleteMutation.isPending && deleteMutation.variables === id ? (
 <Loader2 className="h-4 w-4 animate-spin" />
 ) : (
 <Trash2 className="h-4 w-4" />
 )}
 </Button>
 </AlertDialogTrigger>
 <AlertDialogContent>
 <AlertDialogHeader>
 <AlertDialogTitle>Delete Employee</AlertDialogTitle>
 <AlertDialogDescription>
 Are you sure you want to delete <strong>{emp.name}</strong>? This will deactivate their account.
 </AlertDialogDescription>
 </AlertDialogHeader>
 <AlertDialogFooter>
 <AlertDialogCancel className="border-border">Cancel</AlertDialogCancel>
 <AlertDialogAction
 className="bg-red-600 hover:bg-red-700 text-white"
 onClick={() => deleteMutation.mutate(id)}
 >
 Delete
 </AlertDialogAction>
 </AlertDialogFooter>
 </AlertDialogContent>
 </AlertDialog>
 )
 )}
 </div>
 </TableCell>
 </TableRow>
 )
 }

 return (
 <div className="space-y-6 animate-in fade-in-50 duration-500">
 {/* ── Page Header ─────────────────────────────────── */}
 <div className="bg-card border border-border rounded-xl px-6 py-5 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 shadow-sm">
 <div className="flex items-center gap-4">
 <div className="p-2.5 bg-blue-600 rounded-lg shadow-sm">
 <Users className="h-5 w-5 text-white" />
 </div>
 <div>
 <h1 className="text-base sm:text-lg font-semibold text-foreground tracking-tight">Employee Management</h1>
 <p className="text-xs sm:text-sm text-muted-foreground mt-0.5">View, edit, and manage all organization employees</p>
 </div>
 </div>
 <div className="flex items-center gap-2 sm:gap-3 flex-wrap">
 <Button
 variant="outline"
 size="sm"
 onClick={() => { refreshEmployees(); refreshDepartments(); }}
 disabled={loading}
 className="gap-2 border-blue-200 text-blue-600 hover:bg-blue-50 hover:text-blue-700"
 >
 <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
 Refresh
 </Button>
 <Button
 size="sm"
 onClick={() => setCreateDialogOpen(true)}
 className="bg-blue-600 hover:bg-blue-700 text-white gap-2 shadow-sm"
 >
 <UserPlus className="h-4 w-4" />
 Add Employee
 </Button>
 <Button
 size="sm"
 variant="outline"
 onClick={() => setDeptDialogOpen(true)}
 className="gap-2 border-purple-200 text-purple-700 hover:bg-purple-50"
 >
 <Building2 className="h-4 w-4" />
 New Department
 </Button>
 <Button
 variant="outline"
 size="sm"
 onClick={() => navigate("/admin/dashboard")}
 className="gap-2 border-border text-slate-600 hover:bg-background"
 >
 <ArrowLeft className="h-4 w-4" />
 Dashboard
 </Button>
 </div>
 </div>

 {/* ── Error ────────────────────────────────────── */}
 {error && (
 <div className="flex items-start gap-3 p-4 bg-red-50 border border-red-200 rounded-xl">
 <AlertCircle className="h-4 w-4 text-red-500 mt-0.5 flex-shrink-0" />
 <div className="flex-1">
 <p className="text-sm font-semibold text-red-800">Error Loading Employees</p>
 <p className="text-xs text-red-600 mt-0.5">{error}</p>
 <Button variant="outline" size="sm" onClick={refreshEmployees} className="mt-3 border-red-200 text-red-700 hover:bg-red-100">
 <RefreshCw className="mr-2 h-3.5 w-3.5" /> Retry
 </Button>
 </div>
 </div>
 )}

 {/* ── Stat Cards ───────────────────────────────── */}
 <div className="grid gap-4 grid-cols-2 lg:grid-cols-4">
 {statCards.map(({ label, value, sub, icon: Icon, accent, iconBg }) => (
 <div key={label} className="bg-card border border-border rounded-xl p-5 shadow-sm hover:shadow-md transition-shadow duration-200">
 <div className="flex items-center justify-between mb-4">
 <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">{label}</span>
 <div className={`p-2 rounded-lg border ${iconBg}`}>
 <Icon className={`h-4 w-4 ${accent}`} />
 </div>
 </div>
 <p className={`text-2xl sm:text-3xl font-bold ${accent}`}>{value}</p>
 <p className="text-xs text-muted-foreground mt-1">{sub}</p>
 </div>
 ))}
 </div>

 {/* ── Department Cards Section ──────────────────── */}
 {orgDepartments.length > 0 && (
 <div className="bg-card border border-border rounded-xl shadow-sm p-6">
 <div className="flex items-center justify-between mb-4">
 <h2 className="text-sm font-semibold text-foreground uppercase tracking-wide flex items-center gap-2">
 <Building2 className="h-4 w-4 text-purple-600" /> Departments ({orgDepartments.length})
 </h2>
 <Button size="sm" variant="outline" onClick={() => setDeptDialogOpen(true)} className="h-7 text-xs gap-1.5 border-purple-200 text-purple-700 hover:bg-purple-50">
 <Building2 className="h-3 w-3" /> New
 </Button>
 </div>
 <div className="grid gap-3 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
 {orgDepartments.map((dept) => (
 <div key={dept.id} className="border border-border rounded-lg p-4 hover:border-blue-200 hover:shadow-sm transition-all bg-gradient-to-br from-white to-slate-50">
 <div className="flex items-start justify-between">
 <div className="flex-1">
 <h3 className="text-sm font-bold text-foreground flex items-center gap-1.5">
 <Building2 className="h-3.5 w-3.5 text-blue-600" />
 {dept.name}
 </h3>
 {dept.description && <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{dept.description}</p>}
 </div>
 <Button size="sm" variant="ghost" className="h-7 w-7 p-0 text-red-400 hover:text-red-600 hover:bg-red-50" onClick={() => { setDeptToDelete(dept); setDeleteDeptConfirmOpen(true); }}>
 <Trash2 className="h-3.5 w-3.5" />
 </Button>
 </div>
 {/* Department Stats */}
 <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-3 text-xs text-muted-foreground">
 <span className="flex items-center gap-1"><Users className="h-3 w-3" /> {dept.memberCount || 0}/{dept.maxEmployees || '∞'} members</span>
 {dept.headName ? (
 <span className="flex items-center gap-1 text-purple-600 font-medium"><Shield className="h-3 w-3" /> Tech Lead: {dept.headName}</span>
 ) : (
 <span className="flex items-center gap-1 text-amber-500"><AlertCircle className="h-3 w-3" /> No Tech Lead</span>
 )}
 </div>
 {dept.createdAt && (
 <p className="text-[10px] text-muted-foreground mt-2">Created {new Date(dept.createdAt).toLocaleDateString()}</p>
 )}
 {/* Action Buttons */}
 <div className="flex gap-2 mt-3">
 {!dept.headId ? (
 <Button size="sm" variant="outline" className="h-7 text-xs flex-1 border-purple-200 text-purple-700 hover:bg-purple-50" onClick={() => openDeptMemberDialog(dept, 'hod')}>
 <Shield className="h-3 w-3 mr-1" /> Assign Tech Lead
 </Button>
 ) : (
 <>
 <Button size="sm" variant="outline" className="h-7 text-xs flex-1 border-blue-200 text-blue-700 hover:bg-blue-50" onClick={() => openDeptMemberDialog(dept, 'manager')}>
 <UserPlus className="h-3 w-3 mr-1" /> Manager
 </Button>
 <Button size="sm" variant="outline" className="h-7 text-xs flex-1 border-emerald-200 text-emerald-700 hover:bg-emerald-50" onClick={() => openDeptMemberDialog(dept, 'employee')}>
 <UserPlus className="h-3 w-3 mr-1" /> Employee
 </Button>
 </>
 )}
 </div>
 </div>
 ))}
 </div>
 </div>
 )}

 {/* ── Search & Filters ──────────────────────────── */}
 <div className="bg-card border border-border rounded-xl shadow-sm overflow-hidden">
 <div className="px-6 py-4 border-b border-border">
 <div className="flex flex-col lg:flex-row gap-4">
 {/* Search */}
 <div className="relative flex-1">
 <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
 <Input
 type="text"
 placeholder="Search by name, email, department, phone..."
 value={searchTerm}
 onChange={(e) => setSearchTerm(e.target.value)}
 className="pl-10 border-border focus-visible:ring-blue-500 bg-background hover:bg-card transition-colors"
 />
 </div>

 {/* Filter Dropdowns */}
 <div className="flex gap-2 flex-wrap">
 <Select value={deptFilter} onValueChange={setDeptFilter}>
 <SelectTrigger className="w-full sm:w-[150px] border-border text-sm">
 <Building2 className="h-3.5 w-3.5 mr-1.5 text-muted-foreground" />
 <SelectValue placeholder="Department" />
 </SelectTrigger>
 <SelectContent>
 <SelectItem value="all">All Depts</SelectItem>
 {departments.map((dept) => (
 <SelectItem key={dept} value={dept}>{dept}</SelectItem>
 ))}
 </SelectContent>
 </Select>

 <Select value={roleFilter} onValueChange={setRoleFilter}>
 <SelectTrigger className="w-full sm:w-[140px] border-border text-sm">
 <Shield className="h-3.5 w-3.5 mr-1.5 text-muted-foreground" />
 <SelectValue placeholder="Role" />
 </SelectTrigger>
 <SelectContent>
 <SelectItem value="all">All Roles</SelectItem>
 <SelectItem value="employee">Employee</SelectItem>
 <SelectItem value="team_lead">Team Lead</SelectItem>
 <SelectItem value="admin">Admin</SelectItem>
 <SelectItem value="business_owner">Owner</SelectItem>
 </SelectContent>
 </Select>

 <Select value={statusFilter} onValueChange={setStatusFilter}>
 <SelectTrigger className="w-full sm:w-[130px] border-border text-sm">
 <SelectValue placeholder="Status" />
 </SelectTrigger>
 <SelectContent>
 <SelectItem value="all">All Status</SelectItem>
 <SelectItem value="active">Active</SelectItem>
 <SelectItem value="inactive">Inactive</SelectItem>
 </SelectContent>
 </Select>

 <Select value={managerFilter} onValueChange={setManagerFilter}>
 <SelectTrigger className="w-full sm:w-[160px] border-border text-sm">
 <UserPlus className="h-3.5 w-3.5 mr-1.5 text-muted-foreground" />
 <SelectValue placeholder="Manager" />
 </SelectTrigger>
 <SelectContent>
 <SelectItem value="all">All Managers</SelectItem>
 <SelectItem value="unassigned">Unassigned</SelectItem>
 {managers.map((mgr) => (
 <SelectItem key={mgr.uid || mgr.id} value={mgr.uid || mgr.id}>
 {mgr.name}
 </SelectItem>
 ))}
 </SelectContent>
 </Select>

 {/* Group By Dept Toggle */}
 <Button
 variant={groupByDept ?"default" :"outline"}
 size="sm"
 className={groupByDept
 ?"bg-blue-600 hover:bg-blue-700 text-white gap-1.5"
 :"border-border text-slate-600 hover:bg-blue-50 hover:text-blue-600 gap-1.5"
 }
 onClick={() => setGroupByDept(!groupByDept)}
 >
 <LayoutGrid className="h-3.5 w-3.5" />
 Group
 </Button>

 {/* Clear Filters */}
 {(searchTerm || deptFilter !=="all" || roleFilter !=="all" || statusFilter !=="all" || managerFilter !=="all") && (
 <Button
 variant="ghost"
 size="sm"
 className="text-muted-foreground hover:text-red-500 gap-1"
 onClick={() => {
 setSearchTerm("")
 setSearchTerm("")
 setDeptFilter("all")
 setRoleFilter("all")
 setStatusFilter("all")
 setManagerFilter("all")
 }}
 >
 <X className="h-3.5 w-3.5" />
 Clear
 </Button>
 )}
 </div>
 </div>

 {/* Active Filter Count */}
 <div className="flex items-center gap-2 mt-3">
 <span className="text-xs text-muted-foreground">
 Showing <span className="font-semibold text-foreground">{filteredEmployees.length}</span> of{""}
 <span className="font-semibold text-foreground">{employees.length}</span> employees
 </span>
 </div>
 </div>

 {/* ── Table ──────────────────────────────────── */}
 {loading ? (
 <div className="flex items-center justify-center py-16 gap-3">
 <RefreshCw className="h-5 w-5 animate-spin text-blue-600" />
 <span className="text-sm text-muted-foreground">Loading employees…</span>
 </div>
 ) : filteredEmployees.length === 0 ? (
 <div className="flex flex-col items-center justify-center py-16 text-center">
 <div className="p-4 bg-secondary rounded-full mb-3">
 <Users className="h-7 w-7 text-muted-foreground" />
 </div>
 <p className="text-sm font-medium text-slate-600">No employees found</p>
 <p className="text-xs text-muted-foreground mt-1">
 {searchTerm || deptFilter !=="all" || roleFilter !=="all"
 ?"Try adjusting your search or filters."
 :"No employees in this organization yet."}
 </p>
 </div>
 ) : groupByDept && groupedEmployees ? (
 // ── Grouped View ──────────────────────────
 <div className="divide-y divide-slate-100">
 {groupedEmployees.map(([dept, emps]) => {
 // Find matching org department for CRUD actions
 const orgDept = orgDepartments.find(d => d.name === dept)
 return (
 <div key={dept}>
 <div className="px-6 py-3 bg-background/80 border-b border-border flex items-center justify-between">
 <div className="flex items-center gap-2">
 <Building2 className="h-4 w-4 text-blue-600" />
 <span className="text-sm font-semibold text-foreground">{dept}</span>
 <Badge className="ml-2 bg-blue-50 text-blue-700 border-blue-200 text-xs">{emps.length}</Badge>
 </div>
 {orgDept && (
 <div className="flex items-center gap-2">
 {!orgDept.headId ? (
 <Button size="sm" variant="outline" className="h-7 text-xs border-purple-200 text-purple-700 hover:bg-purple-50" onClick={() => openDeptMemberDialog(orgDept, 'hod')}>
 <Shield className="h-3 w-3 mr-1" /> Assign Tech Lead
 </Button>
 ) : (
 <>
 <Button size="sm" variant="outline" className="h-7 text-xs border-blue-200 text-blue-700 hover:bg-blue-50" onClick={() => openDeptMemberDialog(orgDept, 'manager')}>
 <UserPlus className="h-3 w-3 mr-1" /> Manager
 </Button>
 <Button size="sm" variant="outline" className="h-7 text-xs border-emerald-200 text-emerald-700 hover:bg-emerald-50" onClick={() => openDeptMemberDialog(orgDept, 'employee')}>
 <UserPlus className="h-3 w-3 mr-1" /> Employee
 </Button>
 </>
 )}
 <Button size="sm" variant="ghost" className="h-7 w-7 p-0 text-red-400 hover:text-red-600 hover:bg-red-50" onClick={() => { setDeptToDelete(orgDept); setDeleteDeptConfirmOpen(true); }}>
 <Trash2 className="h-3.5 w-3.5" />
 </Button>
 </div>
 )}
 </div>
 <Table>
 <TableBody>
 {emps.map((emp) => renderEmployeeRow(emp))}
 </TableBody>
 </Table>
 </div>
 )
 })}
 </div>
 ) : (
 // ── Flat Table View ───────────────────────
 <div className="overflow-x-auto">
 <Table>
 <TableHeader>
 <TableRow className="bg-background border-b border-border hover:bg-background">
 <TableHead className="text-xs font-semibold text-muted-foreground uppercase tracking-wide py-3 px-6">Employee</TableHead>
 <TableHead className="text-xs font-semibold text-muted-foreground uppercase tracking-wide py-3">Role</TableHead>
 <TableHead className="text-xs font-semibold text-muted-foreground uppercase tracking-wide py-3">Position</TableHead>
 <TableHead className="text-xs font-semibold text-muted-foreground uppercase tracking-wide py-3">Department</TableHead>
 <TableHead className="text-xs font-semibold text-muted-foreground uppercase tracking-wide py-3">Manager</TableHead>
 <TableHead className="text-xs font-semibold text-muted-foreground uppercase tracking-wide py-3">Status</TableHead>
 <TableHead className="text-xs font-semibold text-muted-foreground uppercase tracking-wide py-3 text-right">Actions</TableHead>
 </TableRow>
 </TableHeader>
 <TableBody>
 {filteredEmployees.map((emp) => renderEmployeeRow(emp))}
 </TableBody>
 </Table>
 </div>
 )}
 </div>

 {/* ── Edit Employee Dialog ──────────────────────── */}
 <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
 <DialogContent className="sm:max-w-md">
 <DialogHeader>
 <DialogTitle className="flex items-center gap-2">
 <Edit className="h-5 w-5 text-blue-600" />
 Edit Employee
 </DialogTitle>
 <DialogDescription>
 Update details for {editingEmployee?.name ||"employee"}.
 </DialogDescription>
 </DialogHeader>
 <DialogBody>
 <div className="space-y-4 py-4">
 <div className="space-y-2">
 <Label htmlFor="edit-name" className="text-sm font-medium text-foreground">Name</Label>
 <Input
 id="edit-name"
 value={editForm.name ||""}
 onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
 className="border-border focus-visible:ring-blue-500"
 />
 </div>
 <div className="space-y-2">
 <Label htmlFor="edit-email" className="text-sm font-medium text-foreground">Email</Label>
 <Input
 id="edit-email"
 value={editForm.email ||""}
 onChange={(e) => setEditForm({ ...editForm, email: e.target.value })}
 className="border-border focus-visible:ring-blue-500"
 />
 </div>
 <div className="space-y-2">
 <Label className="text-sm font-medium text-foreground">Department</Label>
 <Select
 value={editForm.department ||"__none__"}
 onValueChange={(val) => {
 if (val ==="__none__") {
 setEditForm({ ...editForm, department:"", departmentId: null })
 } else {
 const selectedDept = orgDepartments.find(d => d.name === val);
 setEditForm({ ...editForm, department: val, departmentId: selectedDept?.id || null })
 }
 }}
 >
 <SelectTrigger className="border-border">
 <SelectValue placeholder="Select department" />
 </SelectTrigger>
 <SelectContent>
 <SelectItem value="__none__">
 <span className="text-muted-foreground italic">No Department</span>
 </SelectItem>
 {orgDepartments.map((dept) => (
 <SelectItem key={dept.id} value={dept.name}>
 <div className="flex items-center gap-2">
 <Building2 className="h-3 w-3 text-blue-500" />
 <span>{dept.name}</span>
 </div>
 </SelectItem>
 ))}
 </SelectContent>
 </Select>
 </div>
 <div className="space-y-2">
 <Label htmlFor="edit-phone" className="text-sm font-medium text-foreground">Phone</Label>
 <Input
 id="edit-phone"
 value={editForm.phone ||""}
 onChange={(e) => setEditForm({ ...editForm, phone: e.target.value })}
 className="border-border focus-visible:ring-blue-500"
 />
 </div>
 <div className="space-y-2">
 <Label htmlFor="edit-position" className="text-sm font-medium text-foreground">Position</Label>
 <Input
 id="edit-position"
 placeholder="e.g. Designer, Developer"
 value={editForm.position ||""}
 onChange={(e) => setEditForm({ ...editForm, position: e.target.value })}
 className="border-border focus-visible:ring-blue-500"
 />
 </div>
 <div className="space-y-2">
 <Label htmlFor="edit-hikvision" className="text-sm font-medium text-foreground flex items-center gap-1.5">
 Hikvision Employee ID
 <span className="text-xs font-normal text-muted-foreground">(optional)</span>
 </Label>
 <Input
 id="edit-hikvision"
 placeholder="e.g. EMP001"
 value={editForm.hikvisionEmployeeId ||""}
 onChange={(e) => setEditForm({ ...editForm, hikvisionEmployeeId: e.target.value })}
 className="border-border focus-visible:ring-blue-500 font-mono"
 />
 <p className="text-[10px] text-muted-foreground">Must match the Employee No. registered on the Hikvision device.</p>
 </div>
 </div>
 {/* Show error inline inside the dialog */}
 {updateMutation.error && (
 <div className="flex items-start gap-2 p-3 bg-red-50 border border-red-200 rounded-lg mx-0 mt-2">
 <AlertCircle className="h-4 w-4 text-red-500 mt-0.5 shrink-0" />
 <p className="text-xs text-red-700">{updateMutation.error.message}</p>
 </div>
 )}
 </DialogBody>
 <DialogFooter>
 <Button variant="outline" onClick={() => setEditDialogOpen(false)} className="border-border">
 Cancel
 </Button>
 <Button
 onClick={handleSaveEdit}
 disabled={updateMutation.isPending}
 className="bg-blue-600 hover:bg-blue-700 text-white"
 >
 {updateMutation.isPending ? (
 <><RefreshCw className="mr-2 h-4 w-4 animate-spin" /> Saving...</>
 ) : (
 <><Save className="mr-2 h-4 w-4" /> Save Changes</>
 )}
 </Button>
 </DialogFooter>
 </DialogContent>
 </Dialog>

 {/* ── View Details Dialog ──────────────────────── */}
 <Dialog open={detailDialogOpen} onOpenChange={setDetailDialogOpen}>
 <DialogContent className="sm:max-w-lg">
 <DialogHeader>
 <DialogTitle className="flex items-center gap-2">
 <Eye className="h-5 w-5 text-blue-600" />
 Employee Details
 </DialogTitle>
 </DialogHeader>
 <DialogBody>
 {viewingEmployee && (
 <div className="space-y-4 py-2">
 <div className="flex items-center gap-4 pb-4 border-b border-border">
 <div className="h-14 w-14 rounded-full bg-blue-100 border-2 border-blue-200 flex items-center justify-center text-blue-700 text-lg font-bold">
 {(viewingEmployee.name ||"U").substring(0, 2).toUpperCase()}
 </div>
 <div>
 <h3 className="text-lg font-semibold text-foreground">{viewingEmployee.name}</h3>
 <p className="text-sm text-muted-foreground">{viewingEmployee.email}</p>
 </div>
 </div>

 <div className="grid grid-cols-2 gap-4">
 <div>
 <span className="text-xs font-medium text-muted-foreground uppercase">Role</span>
 <div className="mt-1">{getRoleBadge(viewingEmployee.role, viewingEmployee)}</div>
 </div>
 <div>
 <span className="text-xs font-medium text-muted-foreground uppercase">Position</span>
 <p className="mt-1 text-sm text-foreground">{viewingEmployee.position ||"—"}</p>
 </div>
 <div>
 <span className="text-xs font-medium text-muted-foreground uppercase">Status</span>
 <div className="mt-1">
 {viewingEmployee.isActive !== false ? (
 <Badge className="bg-blue-50 text-blue-700 border-blue-200">Active</Badge>
 ) : (
 <Badge className="bg-secondary text-muted-foreground border-border">Inactive</Badge>
 )}
 </div>
 </div>
 <div>
 <span className="text-xs font-medium text-muted-foreground uppercase">Department</span>
 <p className="mt-1 text-sm text-foreground">{viewingEmployee.department ||"—"}</p>
 </div>
 <div>
 <span className="text-xs font-medium text-muted-foreground uppercase">Phone</span>
 <p className="mt-1 text-sm text-foreground">{viewingEmployee.phone ||"—"}</p>
 </div>
 <div>
 <span className="text-xs font-medium text-muted-foreground uppercase">Manager</span>
 <p className="mt-1 text-sm text-foreground">{getManagerName(viewingEmployee.managerId) ||"Unassigned"}</p>
 </div>
 <div>
 <span className="text-xs font-medium text-muted-foreground uppercase">Employee ID</span>
 <p className="mt-1 text-xs font-mono text-muted-foreground break-all">{viewingEmployee.uid || viewingEmployee.id ||"—"}</p>
 </div>
 {viewingEmployee.hikvisionEmployeeId && (
 <div>
 <span className="text-xs font-medium text-muted-foreground uppercase">Hikvision ID</span>
 <p className="mt-1 text-sm text-foreground font-mono">{viewingEmployee.hikvisionEmployeeId}</p>
 </div>
 )}
 {viewingEmployee.createdAt && (
 <div>
 <span className="text-xs font-medium text-muted-foreground uppercase">Created</span>
 <p className="mt-1 text-sm text-foreground">
 {viewingEmployee.createdAt?._seconds
 ? new Date(viewingEmployee.createdAt._seconds * 1000).toLocaleDateString()
 : new Date(viewingEmployee.createdAt).toLocaleDateString()}
 </p>
 </div>
 )}
 </div>
 </div>
 )}
 </DialogBody>
 </DialogContent>
 </Dialog>

 {/* ── Assign Manager Dialog ────────────────────── */}
 <Dialog open={managerDialogOpen} onOpenChange={setManagerDialogOpen}>
 <DialogContent className="sm:max-w-md">
 <DialogHeader>
 <DialogTitle className="flex items-center gap-2">
 <UserPlus className="h-5 w-5 text-blue-600" />
 Assign Manager
 </DialogTitle>
 <DialogDescription>
 Assign a manager for <strong>{assigningEmployee?.name}</strong>. Only managers and Tech Leads are shown.
 </DialogDescription>
 </DialogHeader>
 <DialogBody>
 <div className="space-y-4 py-4">
 <Select value={selectedManagerId ||"__none__"} onValueChange={(val) => setSelectedManagerId(val ==="__none__" ?"" : val)}>
 <SelectTrigger className="border-border">
 <SelectValue placeholder="Select a manager..." />
 </SelectTrigger>
 <SelectContent>
 <SelectItem value="__none__">
 <span className="text-muted-foreground italic">Unassign Manager</span>
 </SelectItem>
 {assignableManagers
 .filter((m) => (m.uid || m.id) !== (assigningEmployee?.uid || assigningEmployee?.id))
 .map((mgr) => (
 <SelectItem key={mgr.uid || mgr.id} value={mgr.uid || mgr.id}>
 <div className="flex items-center gap-2">
 <span>{mgr.name}</span>
 <Badge className="bg-blue-50 text-blue-700 border-blue-200 text-[10px] px-1.5 py-0">Manager</Badge>
 {mgr.department && <span className="text-xs text-muted-foreground">({mgr.department})</span>}
 </div>
 </SelectItem>
 ))}
 </SelectContent>
 </Select>
 </div>
 </DialogBody>
 <DialogFooter>
 <Button variant="outline" onClick={() => setManagerDialogOpen(false)} className="border-border">
 Cancel
 </Button>
 <Button
 onClick={handleAssignManager}
 disabled={assignManagerMutation.isPending}
 className="bg-blue-600 hover:bg-blue-700 text-white"
 >
 {assignManagerMutation.isPending ? (
 <><RefreshCw className="mr-2 h-4 w-4 animate-spin" /> Assigning...</>
 ) : (
 <><UserPlus className="mr-2 h-4 w-4" /> Assign</>
 )}
 </Button>
 </DialogFooter>
 </DialogContent>
 </Dialog>

 {/* ── Create Employee Dialog ───────────────────── */}
 <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
 <DialogContent className="sm:max-w-lg">
 <DialogHeader>
 <DialogTitle className="flex items-center gap-2">
 <UserPlus className="h-5 w-5 text-blue-600" />
 Add New Employee
 </DialogTitle>
 <DialogDescription>
 Create a new employee account. They will receive login credentials.
 </DialogDescription>
 </DialogHeader>
 <DialogBody>

 {createMutation.isError && (
 <div className="flex items-start gap-2 p-3 bg-red-50 border border-red-200 rounded-lg">
 <AlertCircle className="h-4 w-4 text-red-500 mt-0.5 flex-shrink-0" />
 <p className="text-xs text-red-700">{createMutation.error?.message}</p>
 </div>
 )}

 <div className="space-y-4 py-2">
 <div className="grid grid-cols-2 gap-4">
 <div className="space-y-2">
 <Label htmlFor="create-name" className="text-sm font-medium text-foreground">
 Name <span className="text-red-500">*</span>
 </Label>
 <Input
 id="create-name"
 placeholder="Full name"
 value={createForm.name}
 onChange={(e) => setCreateForm({ ...createForm, name: e.target.value })}
 className="border-border focus-visible:ring-blue-500"
 />
 </div>
 <div className="space-y-2">
 <Label htmlFor="create-email" className="text-sm font-medium text-foreground">
 Email <span className="text-red-500">*</span>
 </Label>
 <Input
 id="create-email"
 type="email"
 placeholder="email@company.com"
 value={createForm.email}
 onChange={(e) => setCreateForm({ ...createForm, email: e.target.value })}
 className="border-border focus-visible:ring-blue-500"
 />
 </div>
 </div>
 <div className="space-y-2">
 <Label htmlFor="create-password" className="text-sm font-medium text-foreground">
 Password <span className="text-red-500">*</span>
 </Label>
 <Input
 id="create-password"
 type="password"
 placeholder="Minimum 6 characters"
 value={createForm.password}
 onChange={(e) => setCreateForm({ ...createForm, password: e.target.value })}
 className="border-border focus-visible:ring-blue-500"
 />
 </div>
 <div className="grid grid-cols-2 gap-4">
 <div className="space-y-2">
 <Label className="text-sm font-medium text-foreground">Department</Label>
 <div className="relative">
 <Building2 className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground z-10" />
 <Select
 value={createForm.department || "__none__"}
 onValueChange={(val) => {
 if (val ==="__none__") {
 setCreateForm({ ...createForm, department:"", departmentId: null })
 } else {
 const selectedDept = orgDepartments.find(d => d.name === val);
 setCreateForm({ ...createForm, department: val, departmentId: selectedDept?.id || null })
 }
 }}
 >
 <SelectTrigger className="border-border focus-visible:ring-blue-500 pl-9">
 <SelectValue placeholder="e.g. Sales, Engineering" />
 </SelectTrigger>
 <SelectContent>
 <SelectItem value="__none__">
 <span className="text-muted-foreground italic">No Department</span>
 </SelectItem>
 {orgDepartments.map((dept) => (
 <SelectItem key={dept.id} value={dept.name}>{dept.name}</SelectItem>
 ))}
 </SelectContent>
 </Select>
 </div>
 </div>
 <div className="space-y-2">
 <Label className="text-sm font-medium text-foreground">Role</Label>
 <Select
 value={createForm.role}
 onValueChange={(val) => setCreateForm({ ...createForm, role: val })}
 >
 <SelectTrigger className="border-border">
 <SelectValue placeholder="Select role" />
 </SelectTrigger>
 <SelectContent>
 <SelectItem value="employee">
 <div className="flex items-center gap-2">
 <Users className="h-3 w-3 text-muted-foreground" />
 <span>Employee</span>
 </div>
 </SelectItem>
 <SelectItem value="manager">
 <div className="flex items-center gap-2">
 <Shield className="h-3 w-3 text-blue-500" />
 <span>Manager</span>
 </div>
 </SelectItem>
 </SelectContent>
 </Select>
 </div>
 </div>
 <div className="grid grid-cols-2 gap-4">
 <div className="space-y-2">
 <Label htmlFor="create-position" className="text-sm font-medium text-foreground">Position / Designation</Label>
 <Input
 id="create-position"
 placeholder="e.g. Designer, Developer"
 value={createForm.position}
 onChange={(e) => setCreateForm({ ...createForm, position: e.target.value })}
 className="border-border focus-visible:ring-blue-500"
 />
 </div>
 <div className="space-y-2">
 <Label htmlFor="create-phone" className="text-sm font-medium text-foreground">Phone</Label>
 <Input
 id="create-phone"
 placeholder="+91 ..."
 value={createForm.phone}
 onChange={(e) => setCreateForm({ ...createForm, phone: e.target.value })}
 className="border-border focus-visible:ring-blue-500"
 />
 </div>
 </div>

 {/* Manager Assignment */}
 <div className="space-y-2">
 <Label className="text-sm font-medium text-foreground">Assign Manager</Label>
 <Select
 value={createForm.managerId || '__unassigned__'}
 onValueChange={(val) => setCreateForm({ ...createForm, managerId: val === '__unassigned__' ? '' : val })}
 >
 <SelectTrigger className="border-border">
 <SelectValue placeholder="Select manager" />
 </SelectTrigger>
 <SelectContent>
 <SelectItem value="__unassigned__">
 <div className="flex items-center gap-2">
 <Shield className="h-3 w-3 text-purple-500" />
 <span className="text-purple-700 font-medium">Unassigned</span>
 </div>
 </SelectItem>
 {employees
 .filter(e => (e.isManager === true || e.role === 'manager' || e.isDeptHead === true) && e.isActive !== false)
 .map(mgr => (
 <SelectItem key={mgr.uid || mgr.id} value={mgr.uid || mgr.id}>
 <div className="flex items-center gap-2">
 <UserCheck className="h-3 w-3 text-blue-500" />
 <span>{mgr.name}</span>
 <Badge className="bg-blue-50 text-blue-700 border-blue-200 text-[10px] px-1.5 py-0">Manager</Badge>
 {mgr.department && <span className="text-xs text-muted-foreground">({mgr.department})</span>}
 </div>
 </SelectItem>
 ))}
 </SelectContent>
 </Select>
 </div>

 {/* Hikvision Device Link */}
 <div className="space-y-2">
 <Label htmlFor="create-hikvision" className="text-sm font-medium text-foreground flex items-center gap-1.5">
 Hikvision Employee ID
 <span className="text-xs font-normal text-muted-foreground">(optional)</span>
 </Label>
 <Input
 id="create-hikvision"
 placeholder="e.g. EMP001"
 value={createForm.hikvisionEmployeeId}
 onChange={(e) => setCreateForm({ ...createForm, hikvisionEmployeeId: e.target.value })}
 className="border-border focus-visible:ring-blue-500 font-mono"
 />
 <p className="text-[10px] text-muted-foreground">Enter the Employee No. from the Hikvision device to link attendance automatically. Leave blank if not using a device.</p>
 </div>
 </div>
 </DialogBody>
 <DialogFooter>
 <Button variant="outline" onClick={() => setCreateDialogOpen(false)} className="border-border">
 Cancel
 </Button>
 <Button
 onClick={handleCreateEmployee}
 disabled={createMutation.isPending || !createForm.name || !createForm.email || !createForm.password}
 className="bg-blue-600 hover:bg-blue-700 text-white"
 >
 {createMutation.isPending ? (
 <><RefreshCw className="mr-2 h-4 w-4 animate-spin" /> Creating...</>
 ) : (
 <><UserPlus className="mr-2 h-4 w-4" /> Create Employee</>
 )}
 </Button>
 </DialogFooter>
 </DialogContent>
 </Dialog>
 {/* ── Create Department Dialog ───────────────── */}
 <Dialog open={deptDialogOpen} onOpenChange={setDeptDialogOpen}>
 <DialogContent className="sm:max-w-md">
 <DialogHeader>
 <DialogTitle className="flex items-center gap-2">
 <Building2 className="h-5 w-5 text-purple-600" />
 Create Department
 </DialogTitle>
 <DialogDescription>
 Add a new department to your organization.
 </DialogDescription>
 </DialogHeader>
 <DialogBody>

 {createDeptMutation.isError && (
 <div className="flex items-start gap-2 p-3 bg-red-50 border border-red-200 rounded-lg">
 <AlertCircle className="h-4 w-4 text-red-500 mt-0.5 flex-shrink-0" />
 <p className="text-xs text-red-700">{createDeptMutation.error?.message}</p>
 </div>
 )}

 <div className="space-y-4 py-4">
 <div className="space-y-2">
 <Label htmlFor="dept-name" className="text-sm font-medium text-foreground">
 Department Name <span className="text-red-500">*</span>
 </Label>
 <Input
 id="dept-name"
 placeholder="e.g. Engineering"
 value={deptForm.name}
 onChange={(e) => setDeptForm({ ...deptForm, name: e.target.value })}
 className="border-border focus-visible:ring-blue-500"
 autoFocus
 />
 </div>
 <div className="space-y-2">
 <Label htmlFor="dept-desc" className="text-sm font-medium text-foreground">Description</Label>
 <Input
 id="dept-desc"
 placeholder="Brief description of the department"
 value={deptForm.description}
 onChange={(e) => setDeptForm({ ...deptForm, description: e.target.value })}
 className="border-border focus-visible:ring-blue-500"
 />
 </div>
 <div className="space-y-2">
 <Label htmlFor="dept-max" className="text-sm font-medium text-foreground">Max Employees</Label>
 <Input
 id="dept-max"
 type="number"
 min="1"
 value={deptForm.maxEmployees}
 onChange={(e) => setDeptForm({ ...deptForm, maxEmployees: parseInt(e.target.value) || undefined })}
 className="border-border focus-visible:ring-blue-500"
 />
 </div>
 </div>
 </DialogBody>
 <DialogFooter>
 <Button variant="outline" onClick={() => setDeptDialogOpen(false)} className="border-border">Cancel</Button>
 <Button
 onClick={() => createDeptMutation.mutate(deptForm)}
 disabled={!deptForm.name || createDeptMutation.isPending}
 className="bg-purple-600 hover:bg-purple-700 text-white"
 >
 {createDeptMutation.isPending ? (
 <><RefreshCw className="mr-2 h-4 w-4 animate-spin" /> Creating...</>
 ) : (
 <><Building2 className="mr-2 h-4 w-4" /> Create Department</>
 )}
 </Button>
 </DialogFooter>
 </DialogContent>
 </Dialog>

 {/* ── Add Dept Member (Tech Lead/Manager/Employee) Dialog ── */}
 <Dialog open={deptMemberDialogOpen} onOpenChange={setDeptMemberDialogOpen}>
 <DialogContent className="sm:max-w-lg">
 <DialogHeader>
 <DialogTitle className="flex items-center gap-2">
 {deptMemberType === 'hod' ? <Shield className="h-5 w-5 text-purple-600" /> : <UserPlus className="h-5 w-5 text-blue-600" />}
 Add {deptMemberType === 'hod' ? 'Tech Lead' : deptMemberType === 'manager' ? 'Manager' : 'Employee'}
 </DialogTitle>
 <DialogDescription>
 Create a new {deptMemberType} for <strong>{selectedDeptForMember?.name}</strong>.
 </DialogDescription>
 </DialogHeader>
 <DialogBody>

 {createDeptMemberMutation.isError && (
 <div className="flex items-start gap-2 p-3 bg-red-50 border border-red-200 rounded-lg">
 <AlertCircle className="h-4 w-4 text-red-500 mt-0.5 flex-shrink-0" />
 <p className="text-xs text-red-700">{createDeptMemberMutation.error?.message}</p>
 </div>
 )}

 <div className="space-y-4 py-2">
 <div className="grid grid-cols-2 gap-4">
 <div className="space-y-2">
 <Label className="text-sm font-medium text-foreground">Name <span className="text-red-500">*</span></Label>
 <Input placeholder="Full name" value={deptMemberForm.name} onChange={(e) => setDeptMemberForm({ ...deptMemberForm, name: e.target.value })} className="border-border focus-visible:ring-blue-500" />
 </div>
 <div className="space-y-2">
 <Label className="text-sm font-medium text-foreground">Email <span className="text-red-500">*</span></Label>
 <Input type="email" placeholder="email@company.com" value={deptMemberForm.email} onChange={(e) => setDeptMemberForm({ ...deptMemberForm, email: e.target.value })} className="border-border focus-visible:ring-blue-500" />
 </div>
 </div>
 <div className="space-y-2">
 <Label className="text-sm font-medium text-foreground">Password <span className="text-red-500">*</span></Label>
 <Input type="password" placeholder="Minimum 6 characters" value={deptMemberForm.password} onChange={(e) => setDeptMemberForm({ ...deptMemberForm, password: e.target.value })} className="border-border focus-visible:ring-blue-500" />
 <p className="text-xs text-muted-foreground">Provide this to the employee securely.</p>
 </div>
 <div className="grid grid-cols-2 gap-4">
 <div className="space-y-2">
 <Label className="text-sm font-medium text-foreground">Position</Label>
 <Input
 placeholder="e.g. Senior Developer"
 value={deptMemberForm.position}
 onChange={(e) => setDeptMemberForm({ ...deptMemberForm, position: e.target.value })}
 disabled={deptMemberType === 'hod'}
 className="border-border focus-visible:ring-blue-500"
 />
 {deptMemberType === 'hod' && <p className="text-[10px] text-purple-500 font-medium">Locked for Tech Lead role</p>}
 </div>
 <div className="space-y-2">
 <Label className="text-sm font-medium text-foreground">Phone</Label>
 <Input placeholder="+91 ..." value={deptMemberForm.phone} onChange={(e) => setDeptMemberForm({ ...deptMemberForm, phone: e.target.value })} className="border-border focus-visible:ring-blue-500" />
 </div>
 </div>

 {/* Manager Assignment - shown for Employee type */}
 {deptMemberType === 'employee' && (
 <div className="space-y-2">
 <Label className="text-sm font-medium text-foreground">Assign To Manager</Label>
 <Select
 value={deptMemberForm.managerId || '__hod__'}
 onValueChange={(val) => setDeptMemberForm({ ...deptMemberForm, managerId: val })}
 >
 <SelectTrigger className="border-border">
 <SelectValue placeholder="Select manager" />
 </SelectTrigger>
 <SelectContent>
 <SelectItem value="__hod__">
 <div className="flex items-center gap-2">
 <Shield className="h-3 w-3 text-purple-500" />
 <span className="text-purple-700 font-medium">Unassigned (reports to HOD)</span>
 </div>
 </SelectItem>
 {employees
 .filter(e => (e.isManager === true || e.role === 'manager' || e.isDeptHead === true) && e.isActive !== false && e.department === selectedDeptForMember?.name)
 .map(mgr => (
 <SelectItem key={mgr.uid || mgr.id} value={mgr.uid || mgr.id}>
 <div className="flex items-center gap-2">
 <UserCheck className="h-3 w-3 text-blue-500" />
 <span>{mgr.name}</span>
 {mgr.position && <span className="text-xs text-muted-foreground">({mgr.position})</span>}
 </div>
 </SelectItem>
 ))}
 </SelectContent>
 </Select>
 <p className="text-[10px] text-muted-foreground">If no manager is selected, the employee reports directly to the HOD.</p>
 </div>
 )}

 {/* Auto-assign note for Managers */}
 {deptMemberType === 'manager' && selectedDeptForMember?.headName && (
 <div className="flex items-center gap-2 p-3 bg-blue-50 border border-blue-100 rounded-lg">
 <Shield className="h-4 w-4 text-purple-500" />
 <p className="text-xs text-blue-700">
 This manager will automatically report to <strong>{selectedDeptForMember.headName}</strong> (HOD)
 </p>
 </div>
 )}

 {/* Hikvision Device Link */}
 <div className="space-y-2">
 <Label className="text-sm font-medium text-foreground flex items-center gap-1.5">
 Hikvision Employee ID
 <span className="text-xs font-normal text-muted-foreground">(optional)</span>
 </Label>
 <Input
 placeholder="e.g. EMP001"
 value={deptMemberForm.hikvisionEmployeeId ||""}
 onChange={(e) => setDeptMemberForm({ ...deptMemberForm, hikvisionEmployeeId: e.target.value })}
 className="border-border focus-visible:ring-blue-500 font-mono"
 />
 <p className="text-[10px] text-muted-foreground">Enter the Employee No. from the Hikvision device to auto-link attendance. Leave blank if not using a device.</p>
 </div>
 </div>
 </DialogBody>
 <DialogFooter>
 <Button variant="outline" onClick={() => setDeptMemberDialogOpen(false)} className="border-border">Cancel</Button>
 <Button
 onClick={handleCreateDeptMember}
 disabled={createDeptMemberMutation.isPending || !deptMemberForm.name || !deptMemberForm.email || !deptMemberForm.password}
 className={deptMemberType === 'hod' ? 'bg-purple-600 hover:bg-purple-700 text-white' : 'bg-blue-600 hover:bg-blue-700 text-white'}
 >
 {createDeptMemberMutation.isPending ? (
 <><RefreshCw className="mr-2 h-4 w-4 animate-spin" /> Creating...</>
 ) : (
 <><UserPlus className="mr-2 h-4 w-4" /> Create Account</>
 )}
 </Button>
 </DialogFooter>
 </DialogContent>
 </Dialog>

 {/* ── Delete Department Confirmation ────────────── */}
 <AlertDialog open={deleteDeptConfirmOpen} onOpenChange={setDeleteDeptConfirmOpen}>
 <AlertDialogContent>
 <AlertDialogHeader>
 <AlertDialogTitle className="text-red-600 flex items-center gap-2">
 <AlertCircle className="h-5 w-5" /> Delete Department
 </AlertDialogTitle>
 <AlertDialogDescription>
 Are you sure you want to delete <strong>{deptToDelete?.name}</strong>?<br /><br />
 <span className="text-red-600 font-medium">This will remove the department and unassign all its members.</span>
 </AlertDialogDescription>
 </AlertDialogHeader>
 <AlertDialogFooter>
 <AlertDialogCancel className="border-border">Cancel</AlertDialogCancel>
 <AlertDialogAction
 className="bg-red-600 hover:bg-red-700 text-white"
 onClick={() => deptToDelete && deleteDeptMutation.mutate(deptToDelete.id)}
 >
 Delete Department
 </AlertDialogAction>
 </AlertDialogFooter>
 </AlertDialogContent>
 </AlertDialog>

 {/* Department cards are now rendered above the employee list */}
 </div>
 )
}