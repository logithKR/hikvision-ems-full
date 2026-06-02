"use client"

import { useEffect, useState, useMemo, useCallback } from "react"
import { useNavigate } from "react-router-dom"
import { useQuery } from "@tanstack/react-query"
import { ReactFlow, Controls, Background, MiniMap, Handle, Position, Panel, useReactFlow, ReactFlowProvider } from '@xyflow/react'
import '@xyflow/react/dist/style.css'
import dagre from 'dagre'

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { cn } from "@/lib/utils"
import {
    Building2, Users, ArrowLeft, RefreshCw, AlertCircle, 
    Search, Plus, Minus, Maximize2, Shield
} from "lucide-react"
import { getCurrentUser, isAuthenticated } from "@/lib/auth"
import { getValidIdToken } from "@/lib/firebaseClient"

const getApiBase = () => import.meta.env.VITE_API_URL || ""

// --- 1. Custom React Flow Node ---
const OrgNode = ({ data, id }) => {
    return (
        <div className={cn(
            "relative min-w-[220px] bg-white border rounded-xl p-4 shadow-sm transition-all hover:shadow-md",
            data.isMatch ? "border-amber-400 ring-2 ring-amber-50" : "border-slate-200"
        )}>
            <Handle type="target" position={Position.Top} className="!bg-slate-300 !w-2 !h-2 !border-none" />
            
            {data.isHod && <div className="absolute top-0 right-0 p-2"><Shield className="h-4 w-4 text-purple-500" /></div>}

            <div className="flex items-center gap-3">
                <div className={cn("h-11 w-11 rounded-full flex items-center justify-center font-bold text-sm", data.bgColor, data.textColor)}>
                    {data.label.charAt(0).toUpperCase()}
                </div>
                <div className="flex-1 overflow-hidden">
                    <p className="font-semibold text-slate-800 text-sm truncate" title={data.label}>{data.label}</p>
                    <p className="text-xs text-slate-500 truncate" title={data.role}>{data.role}</p>
                </div>
            </div>
            
            {data.meta && (
                <div className="mt-3 text-[11px] bg-slate-50 border border-slate-100 text-slate-600 px-2.5 py-1 rounded-md font-medium inline-block">
                    {data.meta}
                </div>
            )}
            
            {data.hasChildren && (
                <button 
                    className="absolute -bottom-3.5 left-1/2 -translate-x-1/2 bg-white border border-slate-200 rounded-full h-7 w-7 flex items-center justify-center hover:bg-slate-50 shadow-sm z-10 text-slate-500 hover:text-blue-600 hover:border-blue-300 transition-colors"
                    onClick={() => data.toggleNode(id)}
                    title={data.isExpanded ? "Collapse" : "Expand"}
                >
                    {data.isExpanded ? <Minus className="h-3.5 w-3.5" /> : <Plus className="h-3.5 w-3.5" />}
                </button>
            )}

            <Handle type="source" position={Position.Bottom} className="!bg-slate-300 !w-2 !h-2 !border-none" />
        </div>
    )
}

const nodeTypes = { orgNode: OrgNode }

// --- 2. Layout Algorithm (Dagre) ---
const getLayoutedElements = (nodes, edges, direction = 'TB') => {
    const dagreGraph = new dagre.graphlib.Graph()
    dagreGraph.setDefaultEdgeLabel(() => ({}))

    const nodeWidth = 240
    const nodeHeight = 120

    dagreGraph.setGraph({ rankdir: direction, nodesep: 60, ranksep: 100 })

    nodes.forEach((node) => {
        dagreGraph.setNode(node.id, { width: nodeWidth, height: nodeHeight })
    })

    edges.forEach((edge) => {
        dagreGraph.setEdge(edge.source, edge.target)
    })

    dagre.layout(dagreGraph)

    const newNodes = nodes.map((node) => {
        const nodeWithPosition = dagreGraph.node(node.id)
        return {
            ...node,
            targetPosition: 'top',
            sourcePosition: 'bottom',
            position: {
                x: nodeWithPosition.x - nodeWidth / 2,
                y: nodeWithPosition.y - nodeHeight / 2,
            },
        }
    })

    return { nodes: newNodes, edges }
}

// --- 3. Flow Canvas Component ---
const OrgChartFlow = ({ treeData, expandedNodes, toggleNode, searchTerm }) => {
    const { fitView } = useReactFlow()
    const [nodes, setNodes] = useState([])
    const [edges, setEdges] = useState([])

    useEffect(() => {
        if (!treeData) return

        // Flatten the tree into nodes and edges based on expansion state
        const rawNodes = []
        const rawEdges = []

        const traverse = (node, parentId = null) => {
            const isExpanded = expandedNodes[node.id] !== false
            const hasChildren = node.children && node.children.length > 0
            const isMatch = searchTerm && node.name.toLowerCase().includes(searchTerm.toLowerCase())

            rawNodes.push({
                id: node.id,
                type: 'orgNode',
                data: {
                    label: node.name,
                    role: node.subtitle,
                    meta: node.meta,
                    isHod: node.isHod,
                    bgColor: node.type === 'org' ? 'bg-blue-100' : node.type === 'dept' ? 'bg-slate-100' : node.isHod ? 'bg-purple-100' : node.isManager ? 'bg-indigo-100' : 'bg-slate-100',
                    textColor: node.type === 'org' ? 'text-blue-700' : node.type === 'dept' ? 'text-slate-600' : node.isHod ? 'text-purple-700' : node.isManager ? 'text-indigo-700' : 'text-slate-600',
                    isExpanded,
                    hasChildren,
                    isMatch,
                    toggleNode
                }
            })

            if (parentId) {
                rawEdges.push({
                    id: `e-${parentId}-${node.id}`,
                    source: parentId,
                    target: node.id,
                    type: 'smoothstep',
                    animated: false,
                    style: { stroke: '#cbd5e1', strokeWidth: 2 }
                })
            }

            if (hasChildren && isExpanded) {
                node.children.forEach(child => traverse(child, node.id))
            }
        }

        traverse(treeData)

        // Apply Dagre layout
        const { nodes: layoutedNodes, edges: layoutedEdges } = getLayoutedElements(rawNodes, rawEdges)
        setNodes(layoutedNodes)
        setEdges(layoutedEdges)
        
        // Wait for render then fit view
        setTimeout(() => {
            fitView({ padding: 0.2, duration: 800 })
        }, 100)
    }, [treeData, expandedNodes, searchTerm, toggleNode, fitView])

    return (
        <ReactFlow
            nodes={nodes}
            edges={edges}
            nodeTypes={nodeTypes}
            fitView
            minZoom={0.1}
            maxZoom={1.5}
            defaultEdgeOptions={{ type: 'smoothstep' }}
            proOptions={{ hideAttribution: true }}
            className="bg-slate-50"
        >
            <Background color="#cbd5e1" gap={24} size={1.5} />
            <Controls showInteractive={false} className="bg-white border-slate-200 shadow-md rounded-lg overflow-hidden [&>button]:border-slate-100" />
            <MiniMap 
                nodeStrokeColor="#cbd5e1" 
                nodeColor="#f8fafc" 
                nodeBorderRadius={4}
                maskColor="rgba(241, 245, 249, 0.7)"
                className="bg-white border-slate-200 shadow-md rounded-lg overflow-hidden" 
            />
            
            <Panel position="bottom-center" className="bg-white/90 backdrop-blur-sm px-4 py-2 rounded-full shadow-lg border border-slate-200 text-xs text-slate-500 font-medium">
                Scroll to Zoom • Click & Drag to Pan
            </Panel>
        </ReactFlow>
    )
}

// --- 4. Main Page Component ---
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

    const toggleNode = useCallback((nodeId) => {
        setExpandedNodes(prev => ({
            ...prev,
            [nodeId]: prev[nodeId] === false ? true : false
        }))
    }, [])

    const expandAll = () => setExpandedNodes({})
    
    const collapseAll = () => {
        const collectIds = (node, acc) => {
            if (node.children && node.children.length > 0) {
                acc[node.id] = false
                node.children.forEach(c => collectIds(c, acc))
            }
        }
        if (treeData) {
            const newState = {}
            collectIds(treeData, newState)
            newState['root-org'] = true 
            setExpandedNodes(newState)
        }
    }

    if (!currentUser) return null

    return (
        <div className="flex flex-col h-[calc(100vh-4rem)] lg:h-[calc(100vh-1rem)]">
            {/* Header Controls */}
            <div className="flex-none bg-white border-b border-slate-200 px-4 sm:px-6 py-4 z-30 shadow-sm">
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                    <div>
                        <h1 className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
                            <Building2 className="h-6 w-6 text-blue-600" />
                            Organization Flowchart
                        </h1>
                        <p className="text-sm text-slate-500 mt-1">Interactive map of your enterprise hierarchy</p>
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
                        <Button variant="outline" size="sm" onClick={expandAll} className="hidden sm:flex gap-2 text-slate-600">
                            <Maximize2 className="h-4 w-4" /> Expand All
                        </Button>
                        <Button variant="outline" size="sm" onClick={() => refetch()} disabled={isLoading} className="gap-2 text-blue-600 hover:bg-blue-50">
                            <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} /> Refresh
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

            {/* React Flow Canvas */}
            <div className="flex-1 w-full h-full relative">
                {isLoading ? (
                    <div className="absolute inset-0 flex items-center justify-center bg-slate-50 z-10">
                        <RefreshCw className="h-8 w-8 text-blue-600 animate-spin" />
                    </div>
                ) : treeData ? (
                    <ReactFlowProvider>
                        <OrgChartFlow 
                            treeData={treeData} 
                            expandedNodes={expandedNodes} 
                            toggleNode={toggleNode} 
                            searchTerm={searchTerm} 
                        />
                    </ReactFlowProvider>
                ) : null}
            </div>
        </div>
    )
}
