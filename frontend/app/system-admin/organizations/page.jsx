import { useEffect, useState, useMemo } from "react"
import { useNavigate, useSearchParams } from "react-router-dom"
import { useQuery, useQueryClient } from "@tanstack/react-query"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Progress } from "@/components/ui/progress"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog"
import {
    Building2, Users, CheckCircle, XCircle, Search,
    RefreshCw, Settings, Eye, Power, AlertTriangle,
    Shield, Activity, ChevronRight
} from "lucide-react"
import { getCurrentUser, isAuthenticated } from "@/lib/auth"
import { getValidIdToken } from "@/lib/firebaseClient"
import { toast } from "sonner"

const getApiBase = () => {
    const url = import.meta.env.VITE_API_URL || ""
    return url.endsWith('/api') ? url : `${url}/api`
}

const EMPTY_ARRAY = []

export default function SystemAdminOrganizationsPage() {
    const navigate = useNavigate()
    const searchParams = useSearchParams()
    const queryClient = useQueryClient()
    const [currentUser, setCurrentUser] = useState(null)
    const [filteredOrgs, setFilteredOrgs] = useState([])
    const [searchQuery, setSearchQuery] = useState("")
    const [activeTab, setActiveTab] = useState("all")
    const [actionLoading, setActionLoading] = useState(false)

    // Modal states
    const [selectedOrg, setSelectedOrg] = useState(null)
    const [showDetailsModal, setShowDetailsModal] = useState(false)
    const [showLimitsModal, setShowLimitsModal] = useState(false)
    const [showToggleModal, setShowToggleModal] = useState(false)
    const [newLimits, setNewLimits] = useState({ maxBusinessOwners: 5, maxAdmins: 20, maxEmployees: 1000 })

    useEffect(() => {
        if (!isAuthenticated()) {
            navigate("/system-admin/login")
            return
        }

        const user = getCurrentUser()
        if (!user || user.role !== "system_admin") {
            toast.error("Unauthorized. System Admin access required.")
            navigate("/system-admin/login")
            return
        }

        setCurrentUser(user)
        loadOrganizations()
    }, [navigate])

    const { data: organizations = EMPTY_ARRAY, isLoading: loading, error: queryError } = useQuery({
        queryKey: ['sa-organizations'],
        queryFn: async () => {
            const token = await getValidIdToken()
            if (!token) throw new Error("Authentication failed.")
            const base = getApiBase()
            const response = await fetch(`${base}/system-admin/organizations`, {
                headers: { Authorization: `Bearer ${token}` },
            })
            if (!response.ok) throw new Error(`Failed: ${response.status}`)
            const data = await response.json()
            return Array.isArray(data) ? data : (data.organizations || [])
        },
        enabled: !!currentUser,
    })

    const error = queryError?.message || null
    const loadOrganizations = () => queryClient.invalidateQueries({ queryKey: ['sa-organizations'] })

    useEffect(() => {
        filterOrganizations()
    }, [organizations, searchQuery, activeTab])

    const filterOrganizations = () => {
        let filtered = [...organizations]

        // Filter by tab
        if (activeTab === "active") {
            filtered = filtered.filter(org => org.isActive)
        } else if (activeTab === "inactive") {
            filtered = filtered.filter(org => !org.isActive)
        }

        // Filter by search
        if (searchQuery) {
            const query = searchQuery.toLowerCase()
            filtered = filtered.filter(org =>
                org.name?.toLowerCase().includes(query) ||
                org.id?.toLowerCase().includes(query)
            )
        }

        setFilteredOrgs(filtered)
    }

    const handleViewDetails = async (org) => {
        setSelectedOrg(org)
        setShowDetailsModal(true)
    }

    const handleEditLimits = (org) => {
        setSelectedOrg(org)
        setNewLimits({
            maxBusinessOwners: org.limits?.maxBusinessOwners || 5,
            maxAdmins: org.limits?.maxAdmins || 20,
            maxEmployees: org.limits?.maxEmployees || 1000
        })
        setShowLimitsModal(true)
    }

    const handleToggleStatus = (org) => {
        setSelectedOrg(org)
        setShowToggleModal(true)
    }

    const saveLimits = async () => {
        if (!selectedOrg) return
        setActionLoading(true)

        const token = await getValidIdToken()
        const base = getApiBase()

        try {
            const response = await fetch(`${base}/system-admin/organizations/${selectedOrg.id}/limits`, {
                method: "PUT",
                headers: {
                    "Content-Type": "application/json",
                    Authorization: `Bearer ${token}`
                },
                body: JSON.stringify(newLimits)
            })

            if (response.ok) {
                setShowLimitsModal(false)
                loadOrganizations()
            } else {
                const errData = await response.json()
                toast.error(errData.error || "Failed to update limits")
            }
        } catch (error) {
            console.error("Failed to update limits:", error)
            toast.error("Failed to update limits: " + error.message)
        } finally {
            setActionLoading(false)
        }
    }

    const toggleOrgStatus = async () => {
        if (!selectedOrg) return
        setActionLoading(true)

        const token = await getValidIdToken()
        const base = getApiBase()
        const action = selectedOrg.isActive ? "deactivate" : "activate"
        const newStatus = !selectedOrg.isActive

        // Optimistic Update
        queryClient.setQueryData(['sa-organizations'], (oldData) => {
            if (!oldData) return []
            const list = Array.isArray(oldData) ? oldData : (oldData.organizations || [])
            return list.map(org =>
                org.id === selectedOrg.id ? { ...org, isActive: newStatus } : org
            )
        })

        // Also update the selectedOrg state so the modal reflects the change immediately
        setSelectedOrg(prev => ({ ...prev, isActive: newStatus }))
        // Close modal immediately for better UX
        setShowToggleModal(false)

        try {
            const response = await fetch(`${base}/system-admin/organizations/${selectedOrg.id}/${action}`, {
                method: "POST",
                headers: { Authorization: `Bearer ${token}` }
            })

            if (response.ok) {
                // Background refresh
                loadOrganizations()
                queryClient.invalidateQueries({ queryKey: ['sa-dashboard'] })
            } else {
                const errData = await response.json()
                toast.error(errData.error || `Failed to ${action} organization`)
                // Revert
                loadOrganizations()
            }
        } catch (error) {
            console.error(`Failed to ${action} organization:`, error)
            toast.error(`Failed to ${action} organization: ` + error.message)
            // Revert
            loadOrganizations()
        } finally {
            setActionLoading(false)
        }
    }

    const formatDate = (dateString) => {
        try {
            if (!dateString) return "N/A"
            return new Date(dateString).toLocaleDateString("en-US", {
                month: "short",
                day: "numeric",
                year: "numeric",
            })
        } catch {
            return "N/A"
        }
    }

    if (loading) {
        return (
            <div className="flex items-center justify-center min-h-[400px]">
                <div className="text-center">
                    <RefreshCw className="h-8 w-8 animate-spin mx-auto mb-2 text-blue-500" />
                    <p className="text-muted-foreground">Loading organizations...</p>
                </div>
            </div>
        )
    }

    if (error) {
        return (
            <div className="flex items-center justify-center min-h-[400px]">
                <Card className="w-full max-w-md">
                    <CardContent className="pt-6">
                        <div className="text-center">
                            <AlertTriangle className="h-12 w-12 text-red-500 mx-auto mb-4" />
                            <h3 className="text-lg font-semibold text-red-600 mb-2">Error</h3>
                            <p className="text-muted-foreground mb-4">{error}</p>
                            <Button onClick={loadOrganizations} className="bg-blue-500 hover:bg-blue-600">
                                <RefreshCw className="mr-2 h-4 w-4" />
                                Retry
                            </Button>
                        </div>
                    </CardContent>
                </Card>
            </div>
        )
    }

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h1 className="text-2xl md:text-3xl font-bold text-slate-900 dark:text-slate-100">
                        Organizations
                    </h1>
                    <p className="text-muted-foreground mt-1">
                        Manage organization settings, quotas, and status
                    </p>
                </div>
                <Button
                    onClick={loadOrganizations}
                    variant="outline"
                    className="border-blue-200 hover:bg-blue-50 hover:border-blue-300"
                >
                    <RefreshCw className="mr-2 h-4 w-4" />
                    Refresh
                </Button>
            </div>

            {/* Stats Summary */}
            <div className="grid gap-4 md:grid-cols-3">
                <Card className="border-l-4 border-l-blue-500">
                    <CardHeader className="pb-2">
                        <CardTitle className="text-sm font-medium text-muted-foreground">Total</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{organizations.length}</div>
                    </CardContent>
                </Card>
                <Card className="border-l-4 border-l-green-500">
                    <CardHeader className="pb-2">
                        <CardTitle className="text-sm font-medium text-muted-foreground">Active</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold text-green-600">
                            {organizations.filter(o => o.isActive).length}
                        </div>
                    </CardContent>
                </Card>
                <Card className="border-l-4 border-l-gray-400">
                    <CardHeader className="pb-2">
                        <CardTitle className="text-sm font-medium text-muted-foreground">Inactive</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold text-gray-500">
                            {organizations.filter(o => !o.isActive).length}
                        </div>
                    </CardContent>
                </Card>
            </div>

            {/* Search and Filters */}
            <Card>
                <CardContent className="pt-6">
                    <div className="flex flex-col md:flex-row gap-4">
                        <div className="relative flex-1">
                            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                            <Input
                                placeholder="Search organizations..."
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                className="pl-9"
                            />
                        </div>
                        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full md:w-auto">
                            <TabsList>
                                <TabsTrigger value="all">All ({organizations.length})</TabsTrigger>
                                <TabsTrigger value="active">Active ({organizations.filter(o => o.isActive).length})</TabsTrigger>
                                <TabsTrigger value="inactive">Inactive ({organizations.filter(o => !o.isActive).length})</TabsTrigger>
                            </TabsList>
                        </Tabs>
                    </div>
                </CardContent>
            </Card>

            {/* Organizations List */}
            <Card>
                <CardHeader>
                    <CardTitle>Organizations ({filteredOrgs.length})</CardTitle>
                </CardHeader>
                <CardContent>
                    {filteredOrgs.length === 0 ? (
                        <div className="text-center py-12 text-muted-foreground">
                            <Building2 className="h-12 w-12 mx-auto mb-3 opacity-50" />
                            <p>No organizations found</p>
                        </div>
                    ) : (
                        <div className="space-y-4">
                            {filteredOrgs.map((org) => (
                                <div
                                    key={org.id}
                                    className="flex flex-col md:flex-row md:items-center justify-between p-4 bg-slate-50 dark:bg-slate-800/50 rounded-lg border hover:border-blue-200 transition-all gap-4"
                                >
                                    {/* Org Info */}
                                    <div className="flex items-center gap-4">
                                        <div className={`p-3 rounded-lg ${org.isActive ? 'bg-green-100 dark:bg-green-950/30' : 'bg-gray-100 dark:bg-gray-800'}`}>
                                            <Building2 className={`h-6 w-6 ${org.isActive ? 'text-green-600' : 'text-gray-400'}`} />
                                        </div>
                                        <div>
                                            <p className="font-semibold text-lg">{org.name}</p>
                                            <p className="text-sm text-muted-foreground">ID: {org.id}</p>
                                            <div className="flex items-center gap-2 mt-1">
                                                <Badge variant={org.isActive ? "default" : "secondary"} className={org.isActive ? "bg-green-500" : ""}>
                                                    {org.isActive ? "Active" : "Inactive"}
                                                </Badge>
                                                <span className="text-xs text-muted-foreground">
                                                    Created {formatDate(org.createdAt)}
                                                </span>
                                            </div>
                                        </div>
                                    </div>

                                    {/* User Counts */}
                                    <div className="flex items-center gap-6 text-sm">
                                        <div className="text-center">
                                            <p className="font-bold text-purple-600">{org.counts?.businessOwners || 0}</p>
                                            <p className="text-xs text-muted-foreground">Owners</p>
                                        </div>
                                        <div className="text-center">
                                            <p className="font-bold text-blue-600">{org.counts?.admins || 0}</p>
                                            <p className="text-xs text-muted-foreground">Admins</p>
                                        </div>
                                        <div className="text-center">
                                            <p className="font-bold text-green-600">{org.counts?.employees || 0}</p>
                                            <p className="text-xs text-muted-foreground">Employees</p>
                                        </div>
                                    </div>

                                    {/* Quota Progress */}
                                    <div className="hidden lg:block w-32">
                                        <p className="text-xs text-muted-foreground mb-1">Capacity</p>
                                        <Progress
                                            value={org.limits?.maxEmployees ? ((org.counts?.employees || 0) / org.limits.maxEmployees * 100) : 0}
                                            className="h-2"
                                        />
                                        <p className="text-xs text-muted-foreground mt-1">
                                            {org.counts?.employees || 0} / {org.limits?.maxEmployees || 1000}
                                        </p>
                                    </div>

                                    {/* Actions */}
                                    <div className="flex items-center gap-2">
                                        <Button
                                            variant="ghost"
                                            size="sm"
                                            onClick={() => handleViewDetails(org)}
                                            className="hover:bg-blue-50"
                                        >
                                            <Eye className="h-4 w-4 mr-1" />
                                            View
                                        </Button>
                                        <Button
                                            variant="ghost"
                                            size="sm"
                                            onClick={() => handleEditLimits(org)}
                                            className="hover:bg-blue-50"
                                        >
                                            <Settings className="h-4 w-4 mr-1" />
                                            Limits
                                        </Button>
                                        <Button
                                            variant="ghost"
                                            size="sm"
                                            onClick={() => handleToggleStatus(org)}
                                            className={org.isActive ? "hover:bg-red-50 text-red-600" : "hover:bg-green-50 text-green-600"}
                                        >
                                            <Power className="h-4 w-4 mr-1" />
                                            {org.isActive ? "Deactivate" : "Activate"}
                                        </Button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </CardContent>
            </Card>

            {/* Details Modal */}
            <Dialog open={showDetailsModal} onOpenChange={setShowDetailsModal}>
                <DialogContent className="max-w-2xl">
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2">
                            <Building2 className="h-5 w-5 text-blue-500" />
                            {selectedOrg?.name}
                        </DialogTitle>
                        <DialogDescription>
                            Organization details and statistics
                        </DialogDescription>
                    </DialogHeader>
                    {selectedOrg && (
                        <div className="space-y-4">
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <p className="text-sm text-muted-foreground">Status</p>
                                    <Badge variant={selectedOrg.isActive ? "default" : "secondary"} className={selectedOrg.isActive ? "bg-green-500" : ""}>
                                        {selectedOrg.isActive ? "Active" : "Inactive"}
                                    </Badge>
                                </div>
                                <div>
                                    <p className="text-sm text-muted-foreground">Created</p>
                                    <p className="font-medium">{formatDate(selectedOrg.createdAt)}</p>
                                </div>
                            </div>

                            <div className="border-t pt-4">
                                <h4 className="font-medium mb-3">User Counts</h4>
                                <div className="grid grid-cols-3 gap-4">
                                    <Card className="bg-purple-50 dark:bg-purple-950/20">
                                        <CardContent className="pt-4 text-center">
                                            <Shield className="h-6 w-6 mx-auto mb-1 text-purple-600" />
                                            <p className="text-2xl font-bold text-purple-600">{selectedOrg.counts?.businessOwners || 0}</p>
                                            <p className="text-xs text-muted-foreground">Business Owners</p>
                                        </CardContent>
                                    </Card>
                                    <Card className="bg-blue-50 dark:bg-blue-950/20">
                                        <CardContent className="pt-4 text-center">
                                            <Activity className="h-6 w-6 mx-auto mb-1 text-blue-600" />
                                            <p className="text-2xl font-bold text-blue-600">{selectedOrg.counts?.admins || 0}</p>
                                            <p className="text-xs text-muted-foreground">Admins</p>
                                        </CardContent>
                                    </Card>
                                    <Card className="bg-green-50 dark:bg-green-950/20">
                                        <CardContent className="pt-4 text-center">
                                            <Users className="h-6 w-6 mx-auto mb-1 text-green-600" />
                                            <p className="text-2xl font-bold text-green-600">{selectedOrg.counts?.employees || 0}</p>
                                            <p className="text-xs text-muted-foreground">Employees</p>
                                        </CardContent>
                                    </Card>
                                </div>
                            </div>

                            <div className="border-t pt-4">
                                <h4 className="font-medium mb-3">Quota Limits</h4>
                                <div className="space-y-3">
                                    <div>
                                        <div className="flex justify-between text-sm mb-1">
                                            <span>Business Owners</span>
                                            <span>{selectedOrg.counts?.businessOwners || 0} / {selectedOrg.limits?.maxBusinessOwners || 5}</span>
                                        </div>
                                        <Progress value={((selectedOrg.counts?.businessOwners || 0) / (selectedOrg.limits?.maxBusinessOwners || 5)) * 100} className="h-2" />
                                    </div>
                                    <div>
                                        <div className="flex justify-between text-sm mb-1">
                                            <span>Admins</span>
                                            <span>{selectedOrg.counts?.admins || 0} / {selectedOrg.limits?.maxAdmins || 20}</span>
                                        </div>
                                        <Progress value={((selectedOrg.counts?.admins || 0) / (selectedOrg.limits?.maxAdmins || 20)) * 100} className="h-2" />
                                    </div>
                                    <div>
                                        <div className="flex justify-between text-sm mb-1">
                                            <span>Employees</span>
                                            <span>{selectedOrg.counts?.employees || 0} / {selectedOrg.limits?.maxEmployees || 1000}</span>
                                        </div>
                                        <Progress value={((selectedOrg.counts?.employees || 0) / (selectedOrg.limits?.maxEmployees || 1000)) * 100} className="h-2" />
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setShowDetailsModal(false)}>Close</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Limits Modal */}
            <Dialog open={showLimitsModal} onOpenChange={setShowLimitsModal}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2">
                            <Settings className="h-5 w-5 text-blue-500" />
                            Edit Quota Limits
                        </DialogTitle>
                        <DialogDescription>
                            Update quota limits for {selectedOrg?.name}
                        </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4">
                        <div>
                            <Label>Max Business Owners</Label>
                            <Input
                                type="number"
                                value={newLimits.maxBusinessOwners}
                                onChange={(e) => setNewLimits(prev => ({ ...prev, maxBusinessOwners: parseInt(e.target.value) || 0 }))}
                                min="1"
                                max="100"
                            />
                        </div>
                        <div>
                            <Label>Max Admins</Label>
                            <Input
                                type="number"
                                value={newLimits.maxAdmins}
                                onChange={(e) => setNewLimits(prev => ({ ...prev, maxAdmins: parseInt(e.target.value) || 0 }))}
                                min="1"
                                max="1000"
                            />
                        </div>
                        <div>
                            <Label>Max Employees</Label>
                            <Input
                                type="number"
                                value={newLimits.maxEmployees}
                                onChange={(e) => setNewLimits(prev => ({ ...prev, maxEmployees: parseInt(e.target.value) || 0 }))}
                                min="1"
                                max="100000"
                            />
                        </div>
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setShowLimitsModal(false)}>Cancel</Button>
                        <Button onClick={saveLimits} disabled={actionLoading} className="bg-blue-500 hover:bg-blue-600">
                            {actionLoading ? <RefreshCw className="h-4 w-4 animate-spin mr-2" /> : null}
                            Save Limits
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Toggle Status Modal */}
            <Dialog open={showToggleModal} onOpenChange={setShowToggleModal}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2">
                            <Power className={`h-5 w-5 ${selectedOrg?.isActive ? 'text-red-500' : 'text-green-500'}`} />
                            {selectedOrg?.isActive ? "Deactivate" : "Activate"} Organization
                        </DialogTitle>
                        <DialogDescription>
                            {selectedOrg?.isActive
                                ? `Are you sure you want to deactivate "${selectedOrg?.name}"? Users will not be able to login.`
                                : `Are you sure you want to activate "${selectedOrg?.name}"? Users will be able to login again.`
                            }
                        </DialogDescription>
                    </DialogHeader>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setShowToggleModal(false)}>Cancel</Button>
                        <Button
                            onClick={toggleOrgStatus}
                            disabled={actionLoading}
                            className={selectedOrg?.isActive ? "bg-red-500 hover:bg-red-600" : "bg-green-500 hover:bg-green-600"}
                        >
                            {actionLoading ? <RefreshCw className="h-4 w-4 animate-spin mr-2" /> : null}
                            {selectedOrg?.isActive ? "Deactivate" : "Activate"}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    )
}
