import { useState, useMemo } from "react"
import {
  FolderKanban, Users, Shield, Clock, Search, RefreshCw,
  Calendar, CheckCircle2, Check, Eye, ChevronRight, Filter, X
} from "lucide-react"
import {
  Card, CardContent, CardDescription, CardHeader, CardTitle
} from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription, DialogBody } from "@/components/ui/dialog"
import { useOptimisticQuery } from "@/app/hooks/useOptimisticQuery"
import { projectApi } from "@/lib/api-projects"
import { useNavigate } from "react-router-dom"

export default function AdminProjects() {
  const [searchQuery, setSearchQuery] = useState("")
  const [statusFilter, setStatusFilter] = useState("all")
  const [isDetailsModalOpen, setIsDetailsModalOpen] = useState(false)
  const [selectedProject, setSelectedProject] = useState(null)
  const navigate = useNavigate()

  const { data: projects = [], isLoading, isBackgroundRefresh, refetch } = useOptimisticQuery({
    queryKey: ['admin-projects-all'],
    queryFn: async () => await projectApi.getAllProjects(),
    refetchInterval: 30000,
    placeholderData: []
  })

  const filteredProjects = useMemo(() => {
    return projects.filter(p => {
      const matchesSearch = p.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (p.creatorName && p.creatorName.toLowerCase().includes(searchQuery.toLowerCase())) ||
        (p.description && p.description.toLowerCase().includes(searchQuery.toLowerCase()))
      const matchesStatus = statusFilter === "all" || p.status === statusFilter
      return matchesSearch && matchesStatus
    })
  }, [projects, searchQuery, statusFilter])

  const HighlightText = ({ text, highlight }) => {
    if (!highlight || !text) return <>{text}</>
    const parts = String(text).split(new RegExp(`(${highlight})`, 'gi'))
    return (
      <>
        {parts.map((part, i) => 
          part.toLowerCase() === highlight.toLowerCase() ? 
            <span key={i} className="bg-yellow-200 text-yellow-900 rounded-sm px-0.5">{part}</span> : 
            part
        )}
      </>
    )
  }

  const getInitials = (name) => name ? name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2) : '??'

  const getStatusBadge = (status) => {
    switch (status) {
      case 'active':
        return <Badge className="bg-emerald-100 text-emerald-800 hover:bg-emerald-200 border-none text-[11px]"><CheckCircle2 className="w-3 h-3 mr-1" /> Active</Badge>
      case 'completed':
        return <Badge className="bg-blue-100 text-blue-800 hover:bg-blue-200 border-none text-[11px]"><Check className="w-3 h-3 mr-1" /> Completed</Badge>
      case 'paused':
        return <Badge className="bg-amber-100 text-amber-800 hover:bg-amber-200 border-none text-[11px]"><Clock className="w-3 h-3 mr-1" /> Paused</Badge>
      default:
        return <Badge variant="secondary" className="text-[11px]">{status}</Badge>
    }
  }

  const getMemberRoleBadge = (role, status) => {
    if (role === 'lead') return <Badge className="bg-purple-100 text-purple-700 hover:bg-purple-200 border-none text-[10px]"><Shield className="w-3 h-3 mr-0.5" /> Lead</Badge>
    if (status === 'pending') return <Badge className="bg-amber-100 text-amber-700 hover:bg-amber-200 border-none text-[10px]"><Clock className="w-3 h-3 mr-0.5" /> Pending</Badge>
    return <Badge variant="outline" className="text-[10px]">Member</Badge>
  }

  const activeCount = projects.filter(p => p.status === 'active').length
  const completedCount = projects.filter(p => p.status === 'completed').length

  return (
    <div className="space-y-6 animate-in fade-in-50 duration-500">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-foreground dark:text-slate-50 flex items-center gap-2">
            <FolderKanban className="h-6 w-6 text-blue-600" /> Organization Projects
          </h1>
          <p className="text-muted-foreground mt-1">
            Overview of all projects across the organization
          </p>
        </div>
        <Button variant="outline" size="icon" onClick={refetch} disabled={isBackgroundRefresh}>
          <RefreshCw className={`h-4 w-4 ${isBackgroundRefresh ? 'animate-spin' : ''}`} />
        </Button>
      </div>

      {/* Quick Stats */}
      <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Projects</CardTitle>
            <FolderKanban className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{projects.length}</div>
            <p className="text-xs text-muted-foreground">Across all teams</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Active</CardTitle>
            <CheckCircle2 className="h-4 w-4 text-emerald-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-emerald-600">{activeCount}</div>
            <p className="text-xs text-muted-foreground">Currently in progress</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Completed</CardTitle>
            <Check className="h-4 w-4 text-blue-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-blue-600">{completedCount}</div>
            <p className="text-xs text-muted-foreground">Finished projects</p>
          </CardContent>
        </Card>
      </div>

      {/* Projects List */}
      <Card>
        <CardHeader>
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div>
              <CardTitle>All Projects</CardTitle>
              <CardDescription>View and manage all organization projects</CardDescription>
            </div>
            <div className="flex flex-col sm:flex-row gap-3 w-full sm:w-auto">
              <div className="relative w-full sm:w-64">
                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  type="search"
                  placeholder="Search projects or leads..."
                  className="pl-8 bg-background border-border"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
              </div>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-full sm:w-[130px] border-border bg-background">
                  <div className="flex items-center gap-2">
                    <Filter className="h-3.5 w-3.5 text-muted-foreground" />
                    <SelectValue placeholder="Status" />
                  </div>
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Status</SelectItem>
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="completed">Completed</SelectItem>
                  <SelectItem value="paused">Paused</SelectItem>
                </SelectContent>
              </Select>
              {(searchQuery || statusFilter !== "all") && (
                <Button
                  variant="ghost"
                  className="text-muted-foreground hover:text-red-500 px-2"
                  onClick={() => {
                    setSearchQuery("")
                    setStatusFilter("all")
                  }}
                >
                  <X className="h-4 w-4" />
                </Button>
              )}
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="text-center py-12 text-muted-foreground">
              <RefreshCw className="h-6 w-6 mx-auto animate-spin mb-3 text-blue-500" />
              <p className="font-medium">Loading projects...</p>
            </div>
          ) : filteredProjects.length === 0 ? (
            <div className="text-center py-12 border-2 border-dashed rounded-lg bg-background/50">
              <FolderKanban className="h-10 w-10 mx-auto text-slate-300 dark:text-slate-600 mb-3" />
              <p className="text-muted-foreground font-medium">
                {projects.length === 0 ? "No projects have been created yet" : "No projects match your search"}
              </p>
              <p className="text-sm text-muted-foreground mt-1">
                {projects.length === 0 ? "Employees can create projects from their portal." : "Try adjusting your search terms."}
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {filteredProjects.map(project => {
                const memberCount = project.memberIds?.length || 0
                const acceptedMembers = Object.entries(project.membersData || {}).filter(([, m]) => m.status === 'accepted' || m.role === 'lead')

                return (
                  <div
                    key={project.id}
                    onClick={() => navigate(`/admin/projects/${project.id}`)}
                    className="flex flex-col sm:flex-row sm:items-center justify-between p-4 rounded-lg border bg-card hover:shadow-md cursor-pointer transition-shadow gap-4 border-l-4 border-l-blue-500"
                  >
                    <div className="space-y-1.5 flex-1 min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-semibold text-base sm:text-lg truncate">
                          <HighlightText text={project.name} highlight={searchQuery} />
                        </span>
                        {getStatusBadge(project.status)}
                      </div>
                      <p className="text-sm text-muted-foreground line-clamp-1">
                        <HighlightText text={project.description || "No description provided"} highlight={searchQuery} />
                      </p>
                      <div className="flex flex-wrap items-center gap-3 mt-2">
                        <div className="flex items-center text-xs text-muted-foreground gap-1">
                          <Shield className="w-3.5 h-3.5 text-purple-500" />
                          <span>Led by <strong className="text-foreground"><HighlightText text={project.creatorName || 'Unknown'} highlight={searchQuery} /></strong></span>
                        </div>
                        <div className="flex items-center text-xs text-muted-foreground gap-1">
                          <Users className="w-3.5 h-3.5" />
                          <span>{memberCount} member{memberCount !== 1 ? 's' : ''}</span>
                        </div>
                        {project.createdAt && (
                          <div className="flex items-center text-xs text-muted-foreground gap-1">
                            <Calendar className="w-3.5 h-3.5" />
                            <span>{new Date(project.createdAt).toLocaleDateString()}</span>
                          </div>
                        )}
                        {/* Member avatars */}
                        <div className="flex -space-x-1.5 ml-1">
                          {acceptedMembers.slice(0, 4).map(([id, m]) => (
                            <Avatar key={id} className="inline-block border-2 border-background w-6 h-6">
                              <AvatarFallback className="text-[9px] bg-primary/10 text-primary">
                                {getInitials(m.name)}
                              </AvatarFallback>
                            </Avatar>
                          ))}
                          {acceptedMembers.length > 4 && (
                            <div className="w-6 h-6 rounded-full bg-secondary flex items-center justify-center text-[9px] font-medium border-2 border-background z-10">
                              +{acceptedMembers.length - 4}
                            </div>
                          )}
                        </div>
                      </div>
                    <div className="flex gap-2 shrink-0 mt-4 sm:mt-0">
                      <Button size="sm" variant="outline" className="gap-1 shrink-0" onClick={(e) => {
                        e.stopPropagation()
                        navigate(`/admin/projects/${project.id}`)
                      }}>
                        <Eye className="w-3.5 h-3.5" /> View Details
                      </Button>
                    </div>
                  </div>
                 </div>
                )
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* ─── Details Modal ────────────────────────────────────── */}
      <Dialog open={isDetailsModalOpen} onOpenChange={setIsDetailsModalOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FolderKanban className="h-5 w-5 text-blue-600" />
              {selectedProject?.name}
            </DialogTitle>
            <DialogDescription>
              {selectedProject?.description || "No description provided."}
            </DialogDescription>
          </DialogHeader>
          <DialogBody className="space-y-4">
            <div className="flex flex-wrap gap-2">
              {selectedProject && getStatusBadge(selectedProject.status)}
              {selectedProject?.createdAt && (
                <span className="text-xs text-muted-foreground flex items-center gap-1">
                  <Calendar className="w-3 h-3" />
                  Created {new Date(selectedProject.createdAt).toLocaleDateString()}
                </span>
              )}
            </div>

            <div className="space-y-2">
              <h4 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-2">
                <Users className="w-3.5 h-3.5" /> Members ({Object.keys(selectedProject?.membersData || {}).length})
              </h4>
              <div className="space-y-2">
                {selectedProject && Object.entries(selectedProject.membersData || {}).map(([id, m]) => (
                  <div key={id} className="flex items-center justify-between p-3 rounded-lg border bg-card hover:shadow-sm transition-shadow">
                    <div className="flex items-center gap-3 min-w-0">
                      <Avatar className="h-9 w-9 shrink-0">
                        <AvatarFallback className="bg-primary/10 text-primary text-xs font-semibold">
                          {getInitials(m.name)}
                        </AvatarFallback>
                      </Avatar>
                      <div className="min-w-0">
                        <p className="text-sm font-medium truncate">{m.name}</p>
                        <div className="flex gap-1.5 items-center mt-0.5">
                          {getMemberRoleBadge(m.role, m.status)}
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </DialogBody>
          <DialogFooter>
            <Button onClick={() => setIsDetailsModalOpen(false)}>Close</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
