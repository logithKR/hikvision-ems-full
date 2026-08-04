"use client"

import { useEffect, useState, useMemo, useCallback, useRef } from"react"
import { useNavigate } from"react-router-dom"
import { useQuery } from"@tanstack/react-query"
import { ReactFlow, Controls, Background, MiniMap, Handle, Position, Panel, useReactFlow, ReactFlowProvider } from '@xyflow/react'
import '@xyflow/react/dist/style.css'
import dagre from 'dagre'

import { Button } from"@/components/ui/button"
import { Input } from"@/components/ui/input"
import { Badge } from"@/components/ui/badge"
import { cn } from"@/lib/utils"
import {
 Building2, Users, RefreshCw, AlertCircle, 
 Search, Plus, Minus, Maximize2, Shield, X, Mail, Phone, Calendar, Briefcase, Hash
} from"lucide-react"
import { getCurrentUser, isAuthenticated } from"@/lib/auth"
import { getValidIdToken } from"@/lib/firebaseClient"

const getApiBase = () => import.meta.env.VITE_API_URL ||""

// --- 1. Custom React Flow Node (Premium Redesign) ---
const OrgNode = ({ data, id }) => {
 return (
 <div 
 className={cn(
"relative w-[260px] bg-card border rounded-xl p-4 shadow-sm transition-all duration-200 cursor-pointer hover:shadow-md hover:border-blue-300",
 data.isMatch ?"border-amber-400 ring-2 ring-amber-50 shadow-amber-100" :"border-border shadow-slate-100/50",
 data.isSelected &&"border-blue-500 ring-2 ring-blue-50"
 )}
 onClick={() => data.onNodeClick(data.originalData)}
 >
 <Handle type="target" position={Position.Top} className="!bg-slate-300 !w-2 !h-2 !border-none" />
 
 {/* Status Dot */}
 {data.type !== 'dept' && data.type !== 'org' && (
 <div className="absolute top-3 right-3 flex items-center gap-1.5">
 <span className={cn("h-2 w-2 rounded-full", data.isActive ?"bg-emerald-500" :"bg-slate-300")} title={data.isActive ?"Active" :"Offline"} />
 </div>
 )}

 {/* Department Icon / Tech Lead Badge */}
 {data.isHod && <div className="absolute top-2 right-8 p-1"><Shield className="h-4 w-4 text-purple-500" /></div>}

 <div className="flex items-start gap-3">
 {data.profileImageUrl ? (
 <img src={data.profileImageUrl} alt={data.label} className="h-12 w-12 rounded-full object-cover shadow-inner border border-border shrink-0" />
 ) : (
 <div className={cn("h-12 w-12 rounded-full flex items-center justify-center font-bold text-sm shadow-inner shrink-0", data.bgColor, data.textColor)}>
 {data.type === 'dept' ? <Building2 className="h-5 w-5" /> : data.label.charAt(0).toUpperCase()}
 </div>
 )}
 
 <div className="flex-1 overflow-hidden mt-0.5">
 <p className="font-semibold text-foreground text-[13px] truncate" title={data.label}>{data.label}</p>
 <p className="text-[11px] text-muted-foreground truncate mt-0.5" title={data.role}>{data.role}</p>
 
 {data.type !== 'dept' && data.type !== 'org' && (
 <div className="mt-2 space-y-1">
 {data.employeeId && (
 <p className="text-[10px] text-muted-foreground flex items-center gap-1.5 truncate">
 <Hash className="h-3 w-3 shrink-0" /> {data.employeeId}
 </p>
 )}
 {data.email && (
 <p className="text-[10px] text-muted-foreground flex items-center gap-1.5 truncate">
 <Mail className="h-3 w-3 shrink-0" /> {data.email}
 </p>
 )}
 </div>
 )}
 </div>
 </div>
 
 {data.meta && (
 <div className="mt-3.5 text-[10px] bg-background border border-border text-slate-600 px-2 py-1 rounded font-medium inline-flex items-center gap-1">
 {data.meta}
 </div>
 )}
 
 {data.hasChildren && (
 <button 
 className="absolute -bottom-3.5 left-1/2 -translate-x-1/2 bg-card border border-border rounded-full h-7 w-7 flex items-center justify-center hover:bg-secondary shadow-sm z-10 text-muted-foreground hover:text-blue-600 dark:hover:text-blue-400 hover:border-blue-300 dark:hover:border-blue-700 transition-colors"
 onClick={(e) => {
 e.stopPropagation();
 data.toggleNode(id);
 }}
 title={data.isExpanded ?"Collapse" :"Expand"}
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

 const nodeWidth = 260
 const nodeHeight = 160 // Increased to fit email/id

 // Increased spacing for a premium feel
 dagreGraph.setGraph({ rankdir: direction, nodesep: 80, ranksep: 140 })

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
const OrgChartFlow = ({ treeData, expandedNodes, toggleNode, searchTerm, onNodeClick, selectedNodeId }) => {
 const { fitView } = useReactFlow()
 const [nodes, setNodes] = useState([])
 const [edges, setEdges] = useState([])
 const isInitialLayout = useRef(true)
 const prevSearch = useRef(searchTerm)

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
 type: node.type,
 profileImageUrl: node.profileImageUrl,
 employeeId: node.employeeId,
 isActive: node.isActive,
 bgColor: node.type === 'org' ? 'bg-blue-100 dark:bg-blue-900/40' : node.type === 'dept' ? 'bg-slate-100 dark:bg-slate-800' : node.isHod ? 'bg-purple-100 dark:bg-purple-900/40' : 'bg-secondary',
 textColor: node.type === 'org' ? 'text-blue-700 dark:text-blue-300' : node.type === 'dept' ? 'text-slate-700 dark:text-slate-300' : node.isHod ? 'text-purple-700 dark:text-purple-300' : 'text-foreground',
 isExpanded,
 hasChildren,
 isMatch,
 isSelected: selectedNodeId === node.id,
 toggleNode,
 onNodeClick,
 originalData: node
 }
 })

 if (parentId) {
 rawEdges.push({
 id: `e-${parentId}-${node.id}`,
 source: parentId,
 target: node.id,
 type: 'smoothstep',
 animated: false,
 style: { stroke: 'var(--border)', strokeWidth: 2 }
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
 
 // Wait for render then fit view only on first load or search change
 setTimeout(() => {
 if (isInitialLayout.current) {
 fitView({ padding: 0.2, duration: 800 })
 isInitialLayout.current = false
 prevSearch.current = searchTerm
 } else if (prevSearch.current !== searchTerm) {
 // Pan/Zoom to search results
 const matchedNodes = layoutedNodes.filter(n => n.data.isMatch)
 if (matchedNodes.length > 0 && searchTerm.length > 1) {
 fitView({ nodes: matchedNodes, padding: 0.5, duration: 800, maxZoom: 1 })
 }
 prevSearch.current = searchTerm
 }
 }, 100)
 }, [treeData, expandedNodes, searchTerm, toggleNode, fitView, onNodeClick, selectedNodeId])

 return (
 <ReactFlow
 nodes={nodes}
 edges={edges}
 nodeTypes={nodeTypes}
 fitView
 minZoom={0.1}
 maxZoom={2}
 defaultEdgeOptions={{ type: 'smoothstep' }}
 proOptions={{ hideAttribution: true }}
 panOnScroll={true} // Figma style panning
 selectionOnDrag={true}
 zoomOnScroll={false} // Zoom requires Ctrl/Cmd + scroll or pinch
 zoomOnDoubleClick={true}
 className="bg-transparent"
 >
 <Background color="#64748b" gap={24} size={1.5} />
 <Controls position="top-right" showInteractive={false} className="bg-card border-border shadow-md rounded-lg overflow-hidden [&>button]:border-border mt-2 mr-2" />
 
 <Panel position="bottom-center" className="hidden sm:flex bg-card/90 backdrop-blur-md px-4 py-2.5 rounded-full shadow-lg border border-border text-xs text-slate-600 font-medium items-center gap-3">
 <span><kbd className="bg-secondary border border-border rounded px-1.5 py-0.5 font-sans mr-1">Scroll</kbd> to Pan</span>
 <span className="w-1 h-1 rounded-full" />
 <span className="text-xs bg-purple-100 text-purple-700 px-2 py-0.5 rounded-full mt-1 border border-purple-200">Tech Lead</span>
 <span><kbd className="bg-secondary border border-border rounded px-1.5 py-0.5 font-sans mr-1">Ctrl</kbd> + <kbd className="bg-secondary border border-border rounded px-1.5 py-0.5 font-sans">Scroll</kbd> to Zoom</span>
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
 const [selectedNode, setSelectedNode] = useState(null) // Controls side panel

 useEffect(() => {
 if (!isAuthenticated()) { navigate("/login"); return }
 const user = getCurrentUser()
 if (!user || (user.role !=="admin" && user.role !=="system_admin")) { navigate("/login"); return }
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
 subtitle: item.hod.position || 'Tech Lead',
 isHod: true,
 ...item.hod,
 children: []
 }
 deptNode.children.push(deptHeadNode)
 }

 // Regular Employees (Level 3)
 const employeesList = item.employees.map(emp => ({
 id: `user-${emp.id}`,
 type: 'user',
 name: emp.name,
 subtitle: emp.position || 'Employee',
 ...emp,
 children: []
 }))

 // Attach employees to the HOD if they exist, otherwise directly to Department
 if (deptHeadNode) {
 deptHeadNode.children = [...employeesList]
 } else {
 deptNode.children = [...employeesList]
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
 ...emp,
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

 const handleSearchChange = (e) => {
 const val = e.target.value
 setSearchTerm(val)
 
 if (val.length > 2 && treeData) {
 // Auto-expand tree to reveal search results
 const newExpanded = { ...expandedNodes }
 let shouldUpdate = false
 
 const findAndExpand = (node, path) => {
 const match = node.name.toLowerCase().includes(val.toLowerCase()) || 
 (node.employeeId && node.employeeId.toLowerCase().includes(val.toLowerCase())) ||
 (node.email && node.email.toLowerCase().includes(val.toLowerCase()))
 
 let childMatch = false
 if (node.children) {
 node.children.forEach(c => {
 if (findAndExpand(c, [...path, node.id])) {
 childMatch = true
 }
 })
 }
 
 if (match || childMatch) {
 path.forEach(p => {
 if (!newExpanded[p]) {
 newExpanded[p] = true
 shouldUpdate = true
 }
 })
 if (!newExpanded[node.id]) {
 newExpanded[node.id] = true
 shouldUpdate = true
 }
 return true
 }
 return false
 }
 
 findAndExpand(treeData, [])
 if (shouldUpdate) {
 setExpandedNodes(newExpanded)
 }
 }
 }

 if (!currentUser) return null

 // Helper to find dept name
 const getDeptName = (deptId) => {
 if (!chartData || !chartData.chart) return 'Unknown Department'
 const dept = chartData.chart.find(c => c.department.id === deptId)
 return dept ? dept.department.name : 'Unknown Department'
 }

 return (
 <div className="flex flex-col h-[calc(100vh-11rem)] md:h-[calc(100vh-7rem)] lg:h-[calc(100vh-4rem)] relative space-y-4">
 {/* Header Controls */}
 <div className="flex-none bg-card rounded-2xl border border-border px-4 sm:px-6 py-4 z-30 relative shadow-sm">
 <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
 <div>
 <h1 className="text-xl sm:text-2xl font-bold text-foreground tracking-tight flex items-center gap-2">
 <Building2 className="h-6 w-6 text-indigo-600" />
 Organization Flowchart
 </h1>
 <p className="text-sm text-muted-foreground mt-1">Interactive enterprise hierarchy</p>
 </div>
 
 <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 w-full sm:w-auto">
 <div className="relative w-full sm:w-64">
 <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
 <Input 
 placeholder="Find user or department..." 
 className="pl-9 bg-background border-border rounded-full focus-visible:ring-indigo-500 w-full"
 value={searchTerm}
 onChange={handleSearchChange}
 />
 </div>
 <div className="flex items-center gap-2 w-full sm:w-auto">
 <Button variant="outline" size="sm" onClick={expandAll} className="flex-1 sm:flex-none gap-2 text-slate-600 rounded-full">
 <Maximize2 className="h-4 w-4 shrink-0" /> <span className="hidden sm:inline">Expand All</span>
 </Button>
 <Button variant="outline" size="sm" onClick={() => refetch()} disabled={isLoading} className="flex-1 sm:flex-none gap-2 text-indigo-600 hover:bg-indigo-50 rounded-full">
 <RefreshCw className={cn("h-4 w-4 shrink-0", isLoading &&"animate-spin")} /> <span className="hidden sm:inline">Refresh</span>
 </Button>
 <Button onClick={() => navigate("/admin/employees")} className="flex-1 sm:flex-none gap-2 rounded-full bg-indigo-600 hover:bg-indigo-700 text-white">
 <Users className="h-4 w-4 shrink-0" /> <span className="hidden sm:inline">View List</span>
 </Button>
 </div>
 </div>
 </div>
 </div>

 {/* Error State */}
 {error && (
 <div className="absolute top-24 left-1/2 -translate-x-1/2 z-40 flex items-center gap-2 p-4 bg-red-50 border border-red-200 rounded-xl shadow-lg">
 <AlertCircle className="h-5 w-5 text-red-500" />
 <p className="text-sm text-red-700">{error.message}</p>
 </div>
 )}

 <div className="flex-1 w-full h-full relative bg-transparent overflow-hidden rounded-xl">
 {isLoading ? (
 <div className="absolute inset-0 flex items-center justify-center bg-transparent z-10">
 <RefreshCw className="h-8 w-8 text-indigo-600 animate-spin" />
 </div>
 ) : treeData ? (
 <ReactFlowProvider>
 <OrgChartFlow 
 treeData={treeData} 
 expandedNodes={expandedNodes} 
 toggleNode={toggleNode} 
 searchTerm={searchTerm} 
 onNodeClick={setSelectedNode}
 selectedNodeId={selectedNode?.id}
 />
 </ReactFlowProvider>
 ) : null}

 {/* Sliding Side Panel for Rich Data (Now bounded inside Canvas area) */}
 <div 
 className={cn(
"absolute top-0 right-0 h-full w-full sm:w-[400px] bg-card shadow-2xl border-l border-border transform transition-transform duration-300 ease-in-out z-50 flex flex-col",
 selectedNode ?"translate-x-0" :"translate-x-full"
 )}
 >
 {selectedNode && (
 <>
 <div className="p-4 border-b border-border flex items-center justify-between bg-background/50">
 <h2 className="font-semibold text-foreground">Details</h2>
 <Button variant="ghost" size="icon" onClick={() => setSelectedNode(null)} className="h-8 w-8 rounded-full hover:bg-slate-200 text-muted-foreground">
 <X className="h-4 w-4" />
 </Button>
 </div>
 
 <div className="flex-1 overflow-y-auto p-6">
 {selectedNode.type === 'dept' || selectedNode.type === 'org' ? (
 <div className="text-center py-8">
 <div className="mx-auto h-20 w-20 bg-indigo-100 text-indigo-600 rounded-2xl flex items-center justify-center mb-4">
 <Building2 className="h-10 w-10" />
 </div>
 <h3 className="text-xl font-bold text-foreground">{selectedNode.name}</h3>
 <p className="text-muted-foreground mt-1">{selectedNode.subtitle}</p>
 <Badge variant="secondary" className="mt-4">{selectedNode.meta}</Badge>
 </div>
 ) : (
 <div>
 {/* Profile Header */}
 <div className="flex items-center gap-4 mb-8">
 {selectedNode.profileImageUrl ? (
 <img src={selectedNode.profileImageUrl} alt={selectedNode.name} className="h-20 w-20 rounded-full object-cover shadow-sm border border-border" />
 ) : (
 <div className="h-20 w-20 bg-indigo-100 text-indigo-700 rounded-full flex items-center justify-center text-2xl font-bold">
 {selectedNode.name.charAt(0).toUpperCase()}
 </div>
 )}
 <div>
 <h3 className="text-xl font-bold text-foreground">{selectedNode.name}</h3>
 <p className="text-muted-foreground font-medium">{selectedNode.subtitle}</p>
 <div className="flex items-center gap-2 mt-2">
 <span className={cn("h-2.5 w-2.5 rounded-full", selectedNode.isActive ?"bg-emerald-500" :"bg-rose-500")} />
 <span className="text-xs font-medium text-slate-600">{selectedNode.isActive ?"Active Employee" :"Inactive / On Leave"}</span>
 </div>
 </div>
 </div>

 {/* Detailed Info Cards */}
 <div className="space-y-4">
 <div className="bg-background p-4 rounded-xl border border-border shadow-sm">
 <h4 className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider mb-3 flex items-center gap-1.5"><Briefcase className="h-3.5 w-3.5" /> Employment Details</h4>
 <div className="space-y-3">
 <div className="flex items-center gap-3 text-sm">
 <Hash className="h-4 w-4 text-muted-foreground shrink-0" />
 <span className="text-muted-foreground w-24 shrink-0">Employee ID:</span>
 <span className="font-medium text-foreground truncate">{selectedNode.employeeId || 'N/A'}</span>
 </div>
 <div className="flex items-center gap-3 text-sm">
 <Building2 className="h-4 w-4 text-muted-foreground shrink-0" />
 <span className="text-muted-foreground w-24 shrink-0">Department:</span>
 <span className="font-medium text-foreground truncate">{selectedNode.departmentId ? getDeptName(selectedNode.departmentId) : 'Unassigned'}</span>
 </div>
 <div className="flex items-center gap-3 text-sm">
 <Shield className="h-4 w-4 text-muted-foreground shrink-0" />
 <span className="text-muted-foreground w-24 shrink-0">Designation:</span>
 <span className="font-medium text-foreground capitalize truncate">{selectedNode.role || 'Employee'}</span>
 </div>
 <div className="flex items-center gap-3 text-sm">
 <Calendar className="h-4 w-4 text-muted-foreground shrink-0" />
 <span className="text-muted-foreground w-24 shrink-0">Joined:</span>
 <span className="font-medium text-foreground">
 {selectedNode.joinDate ? new Date(selectedNode.joinDate).toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' }) : 'Unknown'}
 </span>
 </div>
 {selectedNode.gender && (
 <div className="flex items-center gap-3 text-sm">
 <Users className="h-4 w-4 text-muted-foreground shrink-0" />
 <span className="text-muted-foreground w-24 shrink-0">Gender:</span>
 <span className="font-medium text-foreground capitalize">{selectedNode.gender}</span>
 </div>
 )}
 </div>
 </div>

 <div className="bg-background p-4 rounded-xl border border-border shadow-sm">
 <h4 className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider mb-3 flex items-center gap-1.5"><Phone className="h-3.5 w-3.5" /> Contact Information</h4>
 <div className="space-y-3">
 <div className="flex items-center gap-3 text-sm group">
 <Mail className="h-4 w-4 text-muted-foreground shrink-0 group-hover:text-indigo-500 transition-colors" />
 <span className="font-medium text-foreground truncate select-all">{selectedNode.email || 'No email provided'}</span>
 </div>
 <div className="flex items-center gap-3 text-sm group">
 <Phone className="h-4 w-4 text-muted-foreground shrink-0 group-hover:text-indigo-500 transition-colors" />
 <span className="font-medium text-foreground select-all">{selectedNode.phone || 'No phone provided'}</span>
 </div>
 </div>
 </div>
 </div>

 {/* Action Buttons */}
 <div className="mt-8 grid grid-cols-2 gap-3">
 <Button variant="outline" className="w-full bg-card" onClick={() => window.location.href = `mailto:${selectedNode.email}`}>
 <Mail className="mr-2 h-4 w-4" /> Message
 </Button>
 <Button className="w-full bg-indigo-600 hover:bg-indigo-700" onClick={() => navigate("/admin/employees")}>
 <Users className="mr-2 h-4 w-4" /> Manage
 </Button>
 </div>
 </div>
 )}
 </div>
 </>
 )}
 </div>
 </div>
 </div>
 )
}
