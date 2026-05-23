"use client"

import { useEffect, useState } from "react"
import { useNavigate } from "react-router-dom"
import { useQuery } from "@tanstack/react-query"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import {
    Building2, Users, Shield, UserCheck, ArrowLeft, RefreshCw,
    AlertCircle, ChevronDown, ChevronRight, User
} from "lucide-react"
import { getCurrentUser, isAuthenticated } from "@/lib/auth"
import { getValidIdToken } from "@/lib/firebaseClient"

const getApiBase = () => import.meta.env.VITE_API_URL || ""

export default function AdminOrgChartPage() {
    const navigate = useNavigate()
    const [currentUser, setCurrentUser] = useState(null)
    const [expandedDepts, setExpandedDepts] = useState({})

    useEffect(() => {
        if (!isAuthenticated()) { navigate("/login"); return }
        const user = getCurrentUser()
        if (!user || (user.role !== "admin" && user.role !== "system_admin")) { navigate("/login"); return }
        setCurrentUser(user)
    }, [navigate])

    const { data: chartData, isLoading, error, refetch } = useQuery({
        queryKey: ['admin-org-chart'],
        queryFn: async () => {
            const token = await getValidIdToken()
            if (!token) throw new Error("Auth failed")
            const res = await fetch(`${getApiBase()}/api/admin/org-chart`, {
                headers: { Authorization: `Bearer ${token}` }
            })
            if (!res.ok) throw new Error("Failed to load org chart")
            return res.json()
        },
        enabled: !!currentUser,
        staleTime: 30000,
    })

    const toggleDept = (deptId) => {
        setExpandedDepts(prev => ({ ...prev, [deptId]: !prev[deptId] }))
    }

    if (!currentUser) return null

    const chart = chartData?.chart || []
    const unassigned = chartData?.unassigned || []

    return (
        <div className="space-y-6 p-6 max-w-6xl mx-auto">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
                        <Building2 className="h-6 w-6 text-blue-600" />
                        Organization Chart
                    </h1>
                    <p className="text-sm text-slate-500 mt-1">Department hierarchy and team structure</p>
                </div>
                <div className="flex gap-2">
                    <Button variant="outline" size="sm" onClick={() => refetch()} disabled={isLoading}
                        className="gap-2 border-blue-200 text-blue-600 hover:bg-blue-50">
                        <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} /> Refresh
                    </Button>
                    <Button variant="outline" size="sm" onClick={() => navigate("/admin/employees")}
                        className="gap-2 border-slate-200 text-slate-600 hover:bg-slate-50">
                        <Users className="h-4 w-4" /> Employees
                    </Button>
                    <Button variant="outline" size="sm" onClick={() => navigate("/admin/dashboard")}
                        className="gap-2 border-slate-200 text-slate-600 hover:bg-slate-50">
                        <ArrowLeft className="h-4 w-4" /> Dashboard
                    </Button>
                </div>
            </div>

            {/* Error */}
            {error && (
                <div className="flex items-center gap-2 p-4 bg-red-50 border border-red-200 rounded-xl">
                    <AlertCircle className="h-5 w-5 text-red-500" />
                    <p className="text-sm text-red-700">{error.message}</p>
                </div>
            )}

            {/* Loading */}
            {isLoading ? (
                <div className="flex items-center justify-center h-64">
                    <RefreshCw className="h-8 w-8 text-blue-600 animate-spin" />
                </div>
            ) : chart.length === 0 && unassigned.length === 0 ? (
                <Card className="border-slate-200">
                    <CardContent className="flex flex-col items-center justify-center py-16">
                        <Building2 className="h-12 w-12 text-slate-300 mb-4" />
                        <p className="text-slate-500 text-lg font-medium">No departments yet</p>
                        <p className="text-slate-400 text-sm mt-1">Create departments from the Employees page to see the org chart.</p>
                        <Button className="mt-4 bg-blue-600 hover:bg-blue-700 text-white" onClick={() => navigate("/admin/employees")}>
                            <Users className="h-4 w-4 mr-2" /> Go to Employees
                        </Button>
                    </CardContent>
                </Card>
            ) : (
                <div className="space-y-4">
                    {/* Department Cards */}
                    {chart.map((item) => {
                        const dept = item.department
                        const isExpanded = expandedDepts[dept.id] !== false // expanded by default
                        return (
                            <Card key={dept.id} className="border-slate-200 shadow-sm overflow-hidden">
                                {/* Department Header */}
                                <div
                                    className="flex items-center justify-between px-6 py-4 bg-gradient-to-r from-blue-50 to-slate-50 border-b border-slate-100 cursor-pointer hover:from-blue-100 hover:to-slate-100 transition-colors"
                                    onClick={() => toggleDept(dept.id)}
                                >
                                    <div className="flex items-center gap-3">
                                        {isExpanded ? <ChevronDown className="h-5 w-5 text-blue-600" /> : <ChevronRight className="h-5 w-5 text-blue-600" />}
                                        <Building2 className="h-5 w-5 text-blue-600" />
                                        <h2 className="text-lg font-semibold text-slate-800">{dept.name}</h2>
                                        <Badge className="bg-blue-100 text-blue-700 border-blue-200 text-xs">{dept.memberCount || 0} members</Badge>
                                    </div>
                                </div>

                                {/* Expanded Content */}
                                {isExpanded && (
                                    <CardContent className="p-6">
                                        <div className="space-y-6">
                                            {/* HOD */}
                                            <div>
                                                <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3 flex items-center gap-2">
                                                    <Shield className="h-3.5 w-3.5 text-purple-500" /> Department Head
                                                </h3>
                                                {item.hod ? (
                                                    <div className="flex items-center gap-3 p-3 bg-purple-50 border border-purple-100 rounded-lg">
                                                        <div className="h-10 w-10 rounded-full bg-purple-200 flex items-center justify-center text-purple-700 font-bold text-sm">
                                                            {item.hod.name.charAt(0).toUpperCase()}
                                                        </div>
                                                        <div>
                                                            <p className="text-sm font-semibold text-slate-800">{item.hod.name}</p>
                                                            <p className="text-xs text-slate-500">{item.hod.position || 'Department Head'}</p>
                                                        </div>
                                                        <Badge className="ml-auto bg-purple-100 text-purple-700 border-purple-200">HOD</Badge>
                                                    </div>
                                                ) : (
                                                    <p className="text-sm text-slate-400 italic p-3 border border-dashed border-slate-200 rounded-lg text-center">
                                                        No HOD assigned — assign one from the Employees page
                                                    </p>
                                                )}
                                            </div>

                                            {/* Managers */}
                                            {item.managers.length > 0 && (
                                                <div>
                                                    <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3 flex items-center gap-2">
                                                        <UserCheck className="h-3.5 w-3.5 text-blue-500" /> Managers ({item.managers.length})
                                                    </h3>
                                                    <div className="grid gap-3 grid-cols-1 md:grid-cols-2">
                                                        {item.managers.map((mgr) => (
                                                            <div key={mgr.id} className="p-3 bg-blue-50 border border-blue-100 rounded-lg">
                                                                <div className="flex items-center gap-3">
                                                                    <div className="h-9 w-9 rounded-full bg-blue-200 flex items-center justify-center text-blue-700 font-bold text-sm">
                                                                        {mgr.name.charAt(0).toUpperCase()}
                                                                    </div>
                                                                    <div>
                                                                        <p className="text-sm font-semibold text-slate-800">{mgr.name}</p>
                                                                        <p className="text-xs text-slate-500">{mgr.position || 'Manager'}</p>
                                                                    </div>
                                                                    <Badge className="ml-auto bg-blue-100 text-blue-700 border-blue-200 text-xs">Manager</Badge>
                                                                </div>
                                                                {/* Team Members under this manager */}
                                                                {mgr.teamMembers && mgr.teamMembers.length > 0 && (
                                                                    <div className="mt-3 ml-6 pl-3 border-l-2 border-blue-200 space-y-2">
                                                                        {mgr.teamMembers.map((tm) => (
                                                                            <div key={tm.id} className="flex items-center gap-2 text-xs text-slate-600">
                                                                                <User className="h-3 w-3 text-slate-400" />
                                                                                <span className="font-medium">{tm.name}</span>
                                                                                {tm.position && <span className="text-slate-400">• {tm.position}</span>}
                                                                            </div>
                                                                        ))}
                                                                    </div>
                                                                )}
                                                            </div>
                                                        ))}
                                                    </div>
                                                </div>
                                            )}

                                            {/* Regular Employees */}
                                            {item.employees.length > 0 && (
                                                <div>
                                                    <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3 flex items-center gap-2">
                                                        <Users className="h-3.5 w-3.5 text-emerald-500" /> Employees ({item.employees.length})
                                                    </h3>
                                                    <div className="grid gap-2 grid-cols-1 sm:grid-cols-2 md:grid-cols-3">
                                                        {item.employees.map((emp) => (
                                                            <div key={emp.id} className="flex items-center gap-2 p-2.5 bg-slate-50 border border-slate-100 rounded-lg">
                                                                <div className="h-8 w-8 rounded-full bg-slate-200 flex items-center justify-center text-slate-600 font-bold text-xs">
                                                                    {emp.name.charAt(0).toUpperCase()}
                                                                </div>
                                                                <div>
                                                                    <p className="text-sm font-medium text-slate-700">{emp.name}</p>
                                                                    {emp.position && <p className="text-[11px] text-slate-400">{emp.position}</p>}
                                                                </div>
                                                            </div>
                                                        ))}
                                                    </div>
                                                </div>
                                            )}

                                            {/* Empty department */}
                                            {!item.hod && item.managers.length === 0 && item.employees.length === 0 && (
                                                <p className="text-sm text-slate-400 text-center py-4">No members in this department.</p>
                                            )}
                                        </div>
                                    </CardContent>
                                )}
                            </Card>
                        )
                    })}

                    {/* Unassigned Employees */}
                    {unassigned.length > 0 && (
                        <Card className="border-amber-200 shadow-sm">
                            <CardHeader className="pb-3">
                                <CardTitle className="text-sm font-semibold text-amber-700 flex items-center gap-2">
                                    <AlertCircle className="h-4 w-4" /> Unassigned Employees ({unassigned.length})
                                </CardTitle>
                            </CardHeader>
                            <CardContent>
                                <div className="grid gap-2 grid-cols-1 sm:grid-cols-2 md:grid-cols-3">
                                    {unassigned.map((emp) => (
                                        <div key={emp.id} className="flex items-center gap-2 p-2.5 bg-amber-50 border border-amber-100 rounded-lg">
                                            <div className="h-8 w-8 rounded-full bg-amber-200 flex items-center justify-center text-amber-700 font-bold text-xs">
                                                {emp.name.charAt(0).toUpperCase()}
                                            </div>
                                            <div>
                                                <p className="text-sm font-medium text-slate-700">{emp.name}</p>
                                                {emp.position && <p className="text-[11px] text-slate-400">{emp.position}</p>}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </CardContent>
                        </Card>
                    )}
                </div>
            )}
        </div>
    )
}
