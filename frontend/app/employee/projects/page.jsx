import { useState, useEffect, useMemo } from "react"
import {
  FolderKanban, Plus, Users, UserPlus, Check, X, Shield, Clock,
  Search, RefreshCw, ChevronRight, Calendar, Trash2, Eye,
  Mail, CheckCircle2, XCircle, AlertCircle, Edit, LogOut
} from "lucide-react"
import {
  Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter
} from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription, DialogBody } from "@/components/ui/dialog"
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue
} from "@/components/ui/select"
import { useNavigate } from "react-router-dom"
import { useOptimisticQuery } from "@/app/hooks/useOptimisticQuery"
import { useQuery } from "@tanstack/react-query"
import { projectApi } from "@/lib/api-projects"
import { getCurrentUser } from "@/lib/auth"
import { toast } from "sonner"

export default function EmployeeProjects() {
  const currentUser = getCurrentUser()
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false)
  const [isInviteModalOpen, setIsInviteModalOpen] = useState(false)
  const [isDetailsModalOpen, setIsDetailsModalOpen] = useState(false)
  const [isEditModalOpen, setIsEditModalOpen] = useState(false)
  const [selectedProject, setSelectedProject] = useState(null)
  const [searchQuery, setSearchQuery] = useState("")
  const [activeTab, setActiveTab] = useState("my-projects")
  
  const navigate = useNavigate()
  
  // Form state
  const [newProject, setNewProject] = useState({ name: "", description: "" })
  const [editProjectData, setEditProjectData] = useState({ name: "", description: "", status: "" })
  const [inviteData, setInviteData] = useState({ targetUserId: "" })
  const [creating, setCreating] = useState(false)
  const [inviting, setInviting] = useState(false)
  const [editing, setEditing] = useState(false)

  const { data: projects = [], refetch, isLoading, isBackgroundRefresh } = useOptimisticQuery({
    queryKey: ['employee-projects'],
    queryFn: async () => await projectApi.getMyProjects(),
    refetchInterval: 15000,
    placeholderData: []
  })

  // Separate active projects and pending invites
  const myProjects = useMemo(() => {
    return projects.filter(p => {
      const myData = p.membersData?.[currentUser?.id]
      return myData?.status === 'accepted' || myData?.role === 'lead'
    }).filter(p =>
      p.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      p.description?.toLowerCase().includes(searchQuery.toLowerCase())
    )
  }, [projects, currentUser, searchQuery])

  const pendingInvites = useMemo(() => {
    return projects.filter(p => {
      const myData = p.membersData?.[currentUser?.id]
      return myData?.status === 'pending' && myData?.role !== 'lead'
    })
  }, [projects, currentUser])

  const { data: orgEmployees = [], isLoading: isLoadingEmployees } = useQuery({
    queryKey: ['org-employees'],
    queryFn: () => projectApi.getOrgEmployees(),
    staleTime: 5 * 60 * 1000 // Cache for 5 minutes
  })

  // Filter available employees for invite dropdown
  const allEmployees = useMemo(() => {
    if (!selectedProject) return []
    const memberIds = selectedProject.memberIds || []
    return orgEmployees.filter(e => !memberIds.includes(e.id))
  }, [orgEmployees, selectedProject])

  const handleCreateProject = async () => {
    if (!newProject.name) return
    setCreating(true)
    try {
      await projectApi.createProject(newProject)
      setNewProject({ name: "", description: "" })
      setIsCreateModalOpen(false)
      refetch()
      toast.success("Project created successfully!")
    } catch (error) {
      console.error(error)
      toast.error("Failed to create project: " + error.message)
    } finally {
      setCreating(false)
    }
  }

  const handleInvite = async () => {
    if (!inviteData.targetUserId) return
    setInviting(true)
    try {
      await projectApi.inviteMember(selectedProject.id, inviteData.targetUserId, 'member')
      setIsInviteModalOpen(false)
      setInviteData({ targetUserId: "" })
      refetch()
      toast.success("Invitation sent successfully!")
    } catch (error) {
      console.error(error)
      toast.error("Failed to send invite: " + error.message)
    } finally {
      setInviting(false)
    }
  }

  const handleRespond = async (projectId, accept) => {
    try {
      await projectApi.respondToInvite(projectId, currentUser.id, accept)
      refetch()
      toast.success(accept ? "Invite accepted!" : "Invite declined.")
    } catch (error) {
      console.error(error)
      toast.error("Failed to respond: " + error.message)
    }
  }

  const handleRemoveMember = async (projectId, memberId) => {
    if (!confirm("Remove this member from the project?")) return
    try {
      await projectApi.removeMember(projectId, memberId)
      // Update the selected project in the details modal
      const updated = await projectApi.getMyProjects()
      const refreshedProject = updated.find(p => p.id === projectId)
      if (refreshedProject) setSelectedProject(refreshedProject)
      refetch()
      toast.success("Member removed")
    } catch (error) {
      console.error(error)
      toast.error("Failed to remove member: " + error.message)
    }
  }

  const handleEditProject = async () => {
    if (!editProjectData.name) return
    setEditing(true)
    try {
      await projectApi.updateProject(selectedProject.id, editProjectData)
      setIsEditModalOpen(false)
      const updated = await projectApi.getMyProjects()
      const refreshedProject = updated.find(p => p.id === selectedProject.id)
      if (refreshedProject) setSelectedProject(refreshedProject)
      refetch()
      toast.success("Project updated successfully!")
    } catch (error) {
      console.error(error)
      toast.error("Failed to update project: " + error.message)
    } finally {
      setEditing(false)
    }
  }

  const handleDeleteProject = async (projectId) => {
    if (!confirm("Are you sure you want to permanently delete this project? This action cannot be undone.")) return
    try {
      await projectApi.deleteProject(projectId)
      setIsDetailsModalOpen(false)
      refetch()
      toast.success("Project deleted successfully")
    } catch (error) {
      console.error(error)
      toast.error("Failed to delete project: " + error.message)
    }
  }

  const handleLeaveProject = async (projectId) => {
    if (!confirm("Are you sure you want to leave this project?")) return
    try {
      await projectApi.removeMember(projectId, currentUser.id)
      setIsDetailsModalOpen(false)
      refetch()
      toast.success("You have left the project")
    } catch (error) {
      console.error(error)
      toast.error("Failed to leave project: " + error.message)
    }
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

  // ─── Render ─────────────────────────────────────────────────

  return (
    <div className="space-y-6 animate-in fade-in-50 duration-500">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-foreground dark:text-slate-50 flex items-center gap-2">
            <FolderKanban className="h-6 w-6 text-blue-600" /> Projects
          </h1>
          <p className="text-muted-foreground mt-1">
            Manage and collaborate on your projects
          </p>
        </div>
        <div className="flex gap-2">
          <Button onClick={() => setIsCreateModalOpen(true)} className="gap-2">
            <Plus className="w-4 h-4" />
            Create Project
          </Button>
          <Button variant="outline" size="icon" onClick={refetch} disabled={isBackgroundRefresh}>
            <RefreshCw className={`h-4 w-4 ${isBackgroundRefresh ? 'animate-spin' : ''}`} />
          </Button>
        </div>
      </div>

      {/* Quick Stats */}
      <div className="grid gap-4 grid-cols-2 md:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Projects</CardTitle>
            <FolderKanban className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{myProjects.length}</div>
            <p className="text-xs text-muted-foreground">Active memberships</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Leading</CardTitle>
            <Shield className="h-4 w-4 text-purple-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-purple-600">
              {myProjects.filter(p => p.membersData?.[currentUser?.id]?.role === 'lead').length}
            </div>
            <p className="text-xs text-muted-foreground">As team lead</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Member Of</CardTitle>
            <Users className="h-4 w-4 text-blue-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-blue-600">
              {myProjects.filter(p => p.membersData?.[currentUser?.id]?.role !== 'lead').length}
            </div>
            <p className="text-xs text-muted-foreground">As contributor</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Pending Invites</CardTitle>
            <Mail className="h-4 w-4 text-amber-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-amber-600">{pendingInvites.length}</div>
            <p className="text-xs text-muted-foreground">Awaiting response</p>
          </CardContent>
        </Card>
      </div>

      {/* Pending Invites Section */}
      {pendingInvites.length > 0 && (
        <Card className="border-amber-200 dark:border-amber-800 bg-amber-50/50 dark:bg-amber-950/20">
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Mail className="h-4 w-4 text-amber-600" />
              Pending Invitations
              <Badge className="bg-amber-100 text-amber-800 border-none ml-1">{pendingInvites.length}</Badge>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {pendingInvites.map(project => (
              <div key={project.id} className="flex flex-col sm:flex-row sm:items-center justify-between p-4 rounded-lg border bg-card hover:shadow-sm transition-shadow gap-3">
                <div className="space-y-1 flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-base truncate">{project.name}</span>
                    {getStatusBadge(project.status)}
                  </div>
                  <p className="text-sm text-muted-foreground line-clamp-1">{project.description || "No description"}</p>
                  <div className="flex items-center text-xs text-muted-foreground gap-2 mt-1">
                    <Users className="w-3 h-3" />
                    <span>{project.memberIds?.length || 0} members</span>
                  </div>
                </div>
                <div className="flex gap-2 shrink-0">
                  <Button size="sm" className="bg-emerald-600 hover:bg-emerald-700 gap-1" onClick={() => handleRespond(project.id, true)}>
                    <Check className="w-3.5 h-3.5" /> Accept
                  </Button>
                  <Button size="sm" variant="outline" className="text-red-600 hover:text-red-700 hover:bg-red-50 gap-1" onClick={() => handleRespond(project.id, false)}>
                    <X className="w-3.5 h-3.5" /> Decline
                  </Button>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* Main Projects Section */}
      <Card>
        <CardHeader>
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div>
              <CardTitle>My Projects</CardTitle>
              <CardDescription>Projects you are a member of or lead</CardDescription>
            </div>
            <div className="relative w-full sm:w-64">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                type="search"
                placeholder="Search projects..."
                className="pl-8"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="text-center py-12 text-muted-foreground">
              <RefreshCw className="h-6 w-6 mx-auto animate-spin mb-3 text-blue-500" />
              <p className="font-medium">Loading projects...</p>
            </div>
          ) : myProjects.length === 0 ? (
            <div className="text-center py-12 border-2 border-dashed rounded-lg bg-background/50">
              <FolderKanban className="h-10 w-10 mx-auto text-slate-300 dark:text-slate-600 mb-3" />
              <p className="text-muted-foreground font-medium">
                {projects.length === 0 ? "No projects yet" : "No projects match your search"}
              </p>
              <p className="text-sm text-muted-foreground mt-1">
                {projects.length === 0 ? "Create your first project or wait for an invitation." : "Try adjusting your search terms."}
              </p>
              {projects.length === 0 && (
                <Button variant="link" onClick={() => setIsCreateModalOpen(true)} className="text-blue-600 mt-2">
                  <Plus className="w-4 h-4 mr-1" /> Create a project
                </Button>
              )}
            </div>
          ) : (
            <div className="space-y-3">
              {myProjects.map(project => {
                const myData = project.membersData?.[currentUser?.id]
                const isLead = myData?.role === 'lead'
                const memberCount = project.memberIds?.length || 0
                const acceptedMembers = Object.entries(project.membersData || {}).filter(([, m]) => m.status === 'accepted' || m.role === 'lead')

                return (
                  <Card 
                    key={project.id} 
                    className="hover:shadow-md transition-shadow cursor-pointer flex flex-col group border-l-4 border-l-primary"
                    onClick={() => navigate(`/employee/projects/${project.id}`)}
                  >
                    <CardHeader className="pb-3">
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                        <div className="space-y-1.5 flex-1 min-w-0">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="font-semibold text-base sm:text-lg truncate">{project.name}</span>
                            {getStatusBadge(project.status)}
                            {isLead && (
                              <Badge className="bg-purple-100 text-purple-700 hover:bg-purple-200 border-none text-[11px]">
                                <Shield className="w-3 h-3 mr-1" /> Lead
                              </Badge>
                            )}
                          </div>
                          <p className="text-sm text-muted-foreground line-clamp-1">{project.description || "No description provided"}</p>
                          <div className="flex flex-wrap items-center gap-3 mt-2">
                            <div className="flex items-center text-xs text-muted-foreground gap-1">
                              <Users className="w-3.5 h-3.5" />
                              <span>{memberCount} member{memberCount !== 1 ? 's' : ''}</span>
                            </div>
                            {project.createdAt && (
                              <div className="flex items-center text-xs text-muted-foreground gap-1">
                                <Calendar className="w-3.5 h-3.5" />
                                <span>Created {new Date(project.createdAt).toLocaleDateString()}</span>
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
                        </div>
                        <div className="flex gap-2 shrink-0">
                          <Button size="sm" variant="outline" className="gap-1" onClick={(e) => {
                            e.stopPropagation()
                            setSelectedProject(project)
                            setIsDetailsModalOpen(true)
                          }}>
                            <Eye className="w-3.5 h-3.5" /> Details
                          </Button>
                          {isLead && (
                            <Button size="sm" className="gap-1" onClick={(e) => {
                              e.stopPropagation()
                              setSelectedProject(project)
                              setIsInviteModalOpen(true)
                            }}>
                              <UserPlus className="w-3.5 h-3.5" /> Invite
                            </Button>
                          )}
                        </div>
                      </div>
                    </CardHeader>
                  </Card>
                )
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* ─── Create Project Modal ─────────────────────────────── */}
      <Dialog open={isCreateModalOpen} onOpenChange={setIsCreateModalOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FolderKanban className="h-5 w-5 text-blue-600" />
              Create New Project
            </DialogTitle>
            <DialogDescription>
              You will automatically become the Team Lead of this project.
            </DialogDescription>
          </DialogHeader>
          <DialogBody className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="project-name">Project Name *</Label>
              <Input 
                id="project-name"
                placeholder="e.g. Q3 Marketing Campaign" 
                value={newProject.name}
                onChange={e => setNewProject({...newProject, name: e.target.value})}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="project-desc">Description</Label>
              <Textarea 
                id="project-desc"
                placeholder="Describe the goals and scope of this project..." 
                value={newProject.description}
                onChange={e => setNewProject({...newProject, description: e.target.value})}
                rows={3}
              />
            </div>
          </DialogBody>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setIsCreateModalOpen(false)}>Cancel</Button>
            <Button onClick={handleCreateProject} disabled={!newProject.name || creating}>
              {creating ? <><RefreshCw className="w-4 h-4 mr-2 animate-spin" /> Creating...</> : "Create Project"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ─── Invite Modal ─────────────────────────────────────── */}
      <Dialog open={isInviteModalOpen} onOpenChange={setIsInviteModalOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <UserPlus className="h-5 w-5 text-blue-600" />
              Invite Member
            </DialogTitle>
            <DialogDescription>
              Invite an employee to <strong>{selectedProject?.name}</strong>. They will need to accept the invitation.
            </DialogDescription>
          </DialogHeader>
          <DialogBody className="space-y-4">
            <div className="space-y-2">
              <Label>Select Employee</Label>
              {isLoadingEmployees ? (
                <div className="text-center py-6 border-2 border-dashed rounded-lg bg-background/50">
                  <RefreshCw className="h-6 w-6 mx-auto animate-spin text-slate-300 mb-2" />
                  <p className="text-sm text-muted-foreground">Loading employees...</p>
                </div>
              ) : allEmployees.length === 0 ? (
                <div className="text-center py-6 border-2 border-dashed rounded-lg bg-background/50">
                  <Users className="h-8 w-8 mx-auto text-slate-300 mb-2" />
                  <p className="text-sm text-muted-foreground">No available employees found</p>
                  <p className="text-xs text-muted-foreground mt-1">All employees may already be in this project.</p>
                </div>
              ) : (
                <Select value={inviteData.targetUserId} onValueChange={(value) => setInviteData({ targetUserId: value })}>
                  <SelectTrigger>
                    <SelectValue placeholder="Choose an employee..." />
                  </SelectTrigger>
                  <SelectContent>
                    {allEmployees.map(emp => (
                      <SelectItem key={emp.id} value={emp.id}>
                        <div className="flex items-center gap-2">
                          <span className="font-medium">{emp.name}</span>
                          <span className="text-muted-foreground">({emp.email})</span>
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </div>
          </DialogBody>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setIsInviteModalOpen(false)}>Cancel</Button>
            <Button onClick={handleInvite} disabled={!inviteData.targetUserId || inviting}>
              {inviting ? <><RefreshCw className="w-4 h-4 mr-2 animate-spin" /> Sending...</> : "Send Invitation"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

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
            {/* Project Info */}
            <div className="flex flex-wrap gap-2">
              {selectedProject && getStatusBadge(selectedProject.status)}
              {selectedProject?.createdAt && (
                <span className="text-xs text-muted-foreground flex items-center gap-1">
                  <Calendar className="w-3 h-3" />
                  Created {new Date(selectedProject.createdAt).toLocaleDateString()}
                </span>
              )}
            </div>

            {/* Members List */}
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
                    {selectedProject.membersData?.[currentUser?.id]?.role === 'lead' && id !== currentUser?.id && (
                      <Button variant="ghost" size="sm" className="text-red-500 hover:text-red-700 hover:bg-red-50 h-8 gap-1" onClick={() => handleRemoveMember(selectedProject.id, id)}>
                        <Trash2 className="w-3.5 h-3.5" /> Remove
                      </Button>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </DialogBody>
          <DialogFooter className="gap-2 flex-wrap justify-end">
            <div className="flex gap-2 mr-auto">
              {selectedProject?.membersData?.[currentUser?.id]?.role === 'lead' ? (
                <>
                  <Button variant="outline" className="text-red-500 hover:text-red-700 hover:bg-red-50" onClick={() => handleDeleteProject(selectedProject.id)}>
                    <Trash2 className="w-4 h-4 mr-1" /> Delete
                  </Button>
                </>
              ) : (
                <Button variant="outline" className="text-red-500 hover:text-red-700 hover:bg-red-50" onClick={() => handleLeaveProject(selectedProject.id)}>
                  <LogOut className="w-4 h-4 mr-1" /> Leave Project
                </Button>
              )}
            </div>
            
            <div className="flex gap-2">
              {selectedProject?.membersData?.[currentUser?.id]?.role === 'lead' && (
                <>
                  <Button variant="outline" onClick={() => {
                    setEditProjectData({ name: selectedProject.name, description: selectedProject.description || "", status: selectedProject.status })
                    setIsDetailsModalOpen(false)
                    setTimeout(() => setIsEditModalOpen(true), 200)
                  }}>
                    <Edit className="w-4 h-4 mr-1" /> Edit
                  </Button>
                  <Button variant="outline" onClick={() => {
                    setIsDetailsModalOpen(false)
                    setTimeout(() => setIsInviteModalOpen(true), 200)
                  }}>
                    <UserPlus className="w-4 h-4 mr-1" /> Invite
                  </Button>
                </>
              )}
              <Button onClick={() => setIsDetailsModalOpen(false)}>Close</Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ─── Edit Project Modal ─────────────────────────────── */}
      <Dialog open={isEditModalOpen} onOpenChange={setIsEditModalOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Edit className="h-5 w-5 text-blue-600" />
              Edit Project
            </DialogTitle>
          </DialogHeader>
          <DialogBody className="space-y-4">
            <div className="space-y-2">
              <Label>Project Name *</Label>
              <Input 
                placeholder="e.g. Q3 Marketing Campaign" 
                value={editProjectData.name}
                onChange={e => setEditProjectData({...editProjectData, name: e.target.value})}
              />
            </div>
            <div className="space-y-2">
              <Label>Description</Label>
              <Textarea 
                placeholder="Describe the goals and scope of this project..." 
                value={editProjectData.description}
                onChange={e => setEditProjectData({...editProjectData, description: e.target.value})}
                rows={3}
              />
            </div>
            <div className="space-y-2">
              <Label>Status</Label>
              <Select value={editProjectData.status} onValueChange={(value) => setEditProjectData({ ...editProjectData, status: value })}>
                <SelectTrigger>
                  <SelectValue placeholder="Select Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="paused">Paused</SelectItem>
                  <SelectItem value="completed">Completed</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </DialogBody>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => {
              setIsEditModalOpen(false)
              setTimeout(() => setIsDetailsModalOpen(true), 200)
            }}>Cancel</Button>
            <Button onClick={handleEditProject} disabled={!editProjectData.name || editing}>
              {editing ? <><RefreshCw className="w-4 h-4 mr-2 animate-spin" /> Saving...</> : "Save Changes"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
