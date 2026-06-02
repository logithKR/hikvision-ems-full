"use client"

import { useEffect, useState, useMemo } from "react"
import { useNavigate } from "react-router-dom"
import { useQuery } from "@tanstack/react-query"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { cn } from "@/lib/utils"
import {
    Building2, Users, Shield, ArrowLeft, RefreshCw,
    AlertCircle, Search, Plus, Minus, Maximize2, Minimize2
} from "lucide-react"
import { getCurrentUser, isAuthenticated } from "@/lib/auth"
import { getValidIdToken } from "@/lib/firebaseClient"

const getApiBase = () => import.meta.env.VITE_API_URL || ""

// --- Recursive Node Component ---
const OrgNode = ({ node, expandedNodes, toggleNode, searchTerm }) => {
    // Determine if expanded (true by default unless explicitly false)
    const isExpanded = expandedNodes[node.id] !== false
    const hasChildren = node.children && node.children.length > 0
    
    // Highlight logic
    const isMatch = searchTerm && node.name.toLowerCase().includes(searchTerm.toLowerCase())

    return (
        <li className="org-node">
            <div className="org-card-container flex flex-col items-center">
                <div 
                    className={cn(
                        "relative w-44 sm:w-48 bg-white border rounded-xl p-4 shadow-sm transition-all duration-200 hover:shadow-md",
                        node.type === 'org' ? "border-blue-400 shadow-blue-100/50 ring-2 ring-blue-50" : 
                        node.type === 'dept' ? "border-slate-300" : 
                        "border-slate-200",
                        isMatch && "ring-2 ring-amber-400 bg-amber-50"
                    )}
                >
                    {/* Visual Indicators */}
                    {node.isHod && <div className="absolute top-0 right-0 p-1.5"><Shield className="h-3.5 w-3.5 text-purple-500" /></div>}
                    
                    {/* Content */}
                    <div className="flex flex-col items-center text-center gap-1.5">
                        {node.type === 'user' ? (
                            <div className={cn(
                                "h-12 w-12 rounded-full flex items-center justify-center font-bold text-sm shadow-inner",
                                node.isHod ? "bg-purple-100 text-purple-700" :
                                node.isManager ? "bg-blue-100 text-blue-700" :
                                "bg-slate-100 text-slate-600"
                            )}>
                                {node.name.charAt(0).toUpperCase()}
                            </div>
                        ) : node.type === 'dept' ? (
                            <div className="p-2.5 bg-slate-50 rounded-lg border border-slate-100 mb-1">
                                <Building2 className="h-5 w-5 text-slate-500" />
                            </div>
                        ) : (
                            <div className="p-3 bg-blue-50 rounded-lg border border-blue-100 mb-1">
                                <Building2 className="h-6 w-6 text-blue-600" />
                            </div>
                        )}
                        
                        <p className="font-semibold text-[13px] sm:text-sm text-slate-800 line-clamp-2 leading-tight" title={node.name}>
                            {node.name}
                        </p>
                        <p className="text-[10px] sm:text-[11px] text-slate-500 line-clamp-1 font-medium">
                            {node.subtitle}
                        </p>
                        {node.meta && (
                            <Badge variant="secondary" className="mt-1.5 text-[10px] h-5 bg-slate-100 text-slate-600 border-none font-medium px-2">
                                {node.meta}
                            </Badge>
                        )}
                    </div>

                    {/* Expand/Collapse Toggle Button */}
                    {hasChildren && (
                        <button 
                            onClick={() => toggleNode(node.id)}
                            className="absolute -bottom-3.5 left-1/2 -translate-x-1/2 h-7 w-7 bg-white border border-slate-300 rounded-full flex items-center justify-center shadow-sm hover:bg-slate-50 hover:text-blue-600 hover:border-blue-300 text-slate-500 transition-colors z-20"
                            title={isExpanded ? "Collapse" : "Expand"}
                        >
                            {isExpanded ? <Minus className="h-3.5 w-3.5" /> : <Plus className="h-3.5 w-3.5" />}
                        </button>
                    )}
                </div>
            </div>
            
            {/* Children Sub-tree */}
            {hasChildren && isExpanded && (
                <ul>
                    {node.children.map(child => (
                        <OrgNode 
                            key={child.id} 
                            node={child} 
                            expandedNodes={expandedNodes} 
                            toggleNode={toggleNode} 
                            searchTerm={searchTerm} 
                        />
                    ))}
                </ul>
            )}
        </li>
    )
}

// --- Main Page Component ---
export default function AdminOrgChartPage() {
    const navigate = useNavigate()
    const [currentUser, setCurrentUser] = useState(null)
    const [expandedNodes, setExpandedNodes] = useState({})
    const [searchTerm, setSearchTerm] = useState("")

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

    // Transform API flat response into a strict hierarchical tree
    const treeData = useMemo(() => {
        if (!chartData) return null

        const root = {
            id: 'root-org',
            type: 'org',
            name: 'Our Organization',
            subtitle: 'Executive Hierarchy',
            children: []
        }

        const chart = chartData.chart || []
        const unassigned = chartData.unassigned || []

        chart.forEach(item => {
            const deptNode = {
                id: `dept-${item.department.id}`,
                type: 'dept',
                name: item.department.name,
                subtitle: 'Department',
                meta: `${item.department.memberCount || 0} Members`,
                children: []
            }

            // HOD (Level 2)
            let deptHeadNode = null
            if (item.hod) {
                deptHeadNode = {
                    id: `user-${item.hod.id}`,
                    type: 'user',
                    name: item.hod.name,
                    subtitle: item.hod.position || 'Head of Department',
                    isHod: true,
                    children: []
                }
                deptNode.children.push(deptHeadNode)
            }

            // Managers (Level 3)
            const managersList = item.managers.map(mgr => ({
                id: `user-${mgr.id}`,
                type: 'user',
                name: mgr.name,
                subtitle: mgr.position || 'Manager',
                isManager: true,
                children: (mgr.teamMembers || []).map(tm => ({
                    id: `user-${tm.id}`,
                    type: 'user',
                    name: tm.name,
                    subtitle: tm.position || 'Team Member',
                    children: []
                }))
            }))

            // Regular Employees without managers (Level 3)
            const employeesList = item.employees.map(emp => ({
                id: `user-${emp.id}`,
                type: 'user',
                name: emp.name,
                subtitle: emp.position || 'Employee',
                children: []
            }))

            // Attach managers and employees to the HOD if they exist, otherwise directly to Department
            if (deptHeadNode) {
                deptHeadNode.children = [...managersList, ...employeesList]
            } else {
                deptNode.children = [...managersList, ...employeesList]
            }

            root.children.push(deptNode)
        })

        // Unassigned Branch
        if (unassigned.length > 0) {
            root.children.push({
                id: 'dept-unassigned',
                type: 'dept',
                name: 'Unassigned',
                subtitle: 'Pending Department',
                meta: `${unassigned.length} Members`,
                children: unassigned.map(emp => ({
                    id: `user-${emp.id}`,
                    type: 'user',
                    name: emp.name,
                    subtitle: emp.position || 'Employee',
                    children: []
                }))
            })
        }

        return root
    }, [chartData])

    const toggleNode = (nodeId) => {
        setExpandedNodes(prev => ({
            ...prev,
            [nodeId]: prev[nodeId] === false ? true : false
        }))
    }

    const expandAll = () => setExpandedNodes({})
    
    const collapseAll = () => {
        // Collect all node IDs
        const collectIds = (node, acc) => {
            if (node.children && node.children.length > 0) {
                acc[node.id] = false
                node.children.forEach(c => collectIds(c, acc))
            }
        }
        if (treeData) {
            const newState = {}
            collectIds(treeData, newState)
            // Keep root expanded by default even in collapse all
            newState['root-org'] = true 
            setExpandedNodes(newState)
        }
    }

    if (!currentUser) return null

    return (
        <div className="flex flex-col h-[calc(100vh-4rem)] lg:h-screen">
            {/* Header Controls (Sticky) */}
            <div className="flex-none bg-white border-b border-slate-200 px-4 sm:px-6 py-4 z-30 shadow-sm">
                <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                    <div>
                        <h1 className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
                            <Building2 className="h-6 w-6 text-blue-600" />
                            Organization Chart
                        </h1>
                        <p className="text-sm text-slate-500 mt-1">Interactive enterprise hierarchy</p>
                    </div>
                    
                    <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
                        <div className="relative flex-1 sm:w-64 min-w-[200px]">
                            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-slate-400" />
                            <Input 
                                placeholder="Find user or department..." 
                                className="pl-9 bg-slate-50 border-slate-200"
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                            />
                        </div>
                        <Button variant="outline" size="icon" onClick={expandAll} title="Expand All" className="hidden sm:flex">
                            <Maximize2 className="h-4 w-4 text-slate-600" />
                        </Button>
                        <Button variant="outline" size="icon" onClick={collapseAll} title="Collapse All" className="hidden sm:flex">
                            <Minimize2 className="h-4 w-4 text-slate-600" />
                        </Button>
                        <Button variant="outline" size="icon" onClick={() => refetch()} disabled={isLoading} title="Refresh">
                            <RefreshCw className={`h-4 w-4 text-blue-600 ${isLoading ? 'animate-spin' : ''}`} />
                        </Button>
                        <Button variant="outline" onClick={() => navigate("/admin/employees")} className="gap-2 hidden md:flex">
                            <Users className="h-4 w-4" /> Employees
                        </Button>
                    </div>
                </div>
            </div>

            {/* Error State */}
            {error && (
                <div className="m-6 flex items-center gap-2 p-4 bg-red-50 border border-red-200 rounded-xl">
                    <AlertCircle className="h-5 w-5 text-red-500" />
                    <p className="text-sm text-red-700">{error.message}</p>
                </div>
            )}

            {/* Canvas Area (Scrollable Pan/Zoom container) */}
            <div className="flex-1 overflow-auto bg-slate-50/50 relative dot-pattern">
                {/* Dot grid background using standard CSS gradient */}
                <div 
                    className="absolute inset-0 pointer-events-none" 
                    style={{
                        backgroundImage: 'radial-gradient(#e2e8f0 1.5px, transparent 1.5px)',
                        backgroundSize: '24px 24px'
                    }}
                />

                {isLoading ? (
                    <div className="absolute inset-0 flex items-center justify-center">
                        <RefreshCw className="h-8 w-8 text-blue-600 animate-spin" />
                    </div>
                ) : treeData && treeData.children.length === 0 ? (
                    <div className="absolute inset-0 flex flex-col items-center justify-center">
                        <Building2 className="h-16 w-16 text-slate-200 mb-4" />
                        <p className="text-slate-500 text-lg font-medium">No departments yet</p>
                        <Button className="mt-4 bg-blue-600 hover:bg-blue-700" onClick={() => navigate("/admin/employees")}>
                            <Users className="h-4 w-4 mr-2" /> Go to Employees
                        </Button>
                    </div>
                ) : treeData ? (
                    <div className="min-w-max min-h-max p-8 sm:p-16 flex justify-center pb-32">
                        {/* THE TREE ROOT */}
                        <div className="org-tree">
                            <ul>
                                <OrgNode 
                                    node={treeData} 
                                    expandedNodes={expandedNodes} 
                                    toggleNode={toggleNode} 
                                    searchTerm={searchTerm} 
                                />
                            </ul>
                        </div>
                    </div>
                ) : null}
            </div>
        </div>
    )
}
