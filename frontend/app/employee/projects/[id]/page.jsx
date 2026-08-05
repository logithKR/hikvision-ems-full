import { useState } from "react"
import { useParams, useNavigate } from "react-router-dom"
import { useQuery } from "@tanstack/react-query"
import { projectApi } from "@/lib/api-projects"
import { getCurrentUser } from "@/lib/auth"
import { 
  FolderKanban, ArrowLeft, CheckCircle2, Clock, Check, Users, Shield, Calendar, Activity,
  Plus, Trash2, Edit, Circle, UserMinus, ShieldCheck
} from "lucide-react"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogBody } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { toast } from "sonner"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Progress } from "@/components/ui/progress"

export default function EmployeeProjectDetailsPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const currentUser = getCurrentUser()
  const [activeTab, setActiveTab] = useState("overview")
  const [isTaskModalOpen, setIsTaskModalOpen] = useState(false)
  const [editingTask, setEditingTask] = useState(null)
  const [taskForm, setTaskForm] = useState({ title: '', description: '', status: 'todo', deadline: '' })

  const { data: project, isLoading, refetch } = useQuery({
    queryKey: ['project-details', id],
    queryFn: async () => {
      // First try to get it from the full list if we are admin
      const isAdmin = window.location.pathname.startsWith('/admin')
      const isBO = window.location.pathname.startsWith('/business-owner')
      if (isAdmin || isBO) {
        const all = await projectApi.getAllProjects()
        return all.find(p => p.id === id)
      } else {
        const my = await projectApi.getMyProjects()
        return my.find(p => p.id === id)
      }
    }
  })

  const isLead = project?.membersData?.[currentUser?.id]?.role === 'lead'

  const { data: attendanceData = {}, isLoading: attendanceLoading } = useQuery({
    queryKey: ['project-attendance', project?.id],
    queryFn: () => projectApi.getProjectAttendance(project.id).then(res => res.data),
    enabled: !!project && isLead
  })

  // Progress calc
  const tasks = Object.values(project?.tasksData || {}).sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
  const totalTasks = tasks.length
  const completedTasks = tasks.filter(t => t.status === 'completed').length
  const progressPercent = totalTasks === 0 ? 0 : Math.round((completedTasks / totalTasks) * 100)

  if (isLoading) {
    return <div className="p-8 flex justify-center"><Clock className="animate-spin text-muted-foreground w-6 h-6" /></div>
  }

  if (!project) {
    return (
      <div className="p-8 text-center space-y-4">
        <h2 className="text-xl font-semibold">Project not found</h2>
        <p className="text-muted-foreground">The project may have been deleted or you don't have access.</p>
        <Button onClick={() => navigate('/employee/projects')}>Return to Projects</Button>
      </div>
    )
  }

  const getStatusBadge = (status) => {
    switch (status) {
      case 'active':
        return <Badge className="bg-emerald-100 text-emerald-800 hover:bg-emerald-200 border-none"><CheckCircle2 className="w-4 h-4 mr-1" /> Active</Badge>
      case 'completed':
        return <Badge className="bg-blue-100 text-blue-800 hover:bg-blue-200 border-none"><Check className="w-4 h-4 mr-1" /> Completed</Badge>
      case 'paused':
        return <Badge className="bg-amber-100 text-amber-800 hover:bg-amber-200 border-none"><Clock className="w-4 h-4 mr-1" /> Paused</Badge>
      default:
        return <Badge variant="secondary">{status}</Badge>
    }
  }

  const handleSaveTask = async () => {
    if (!taskForm.title) return toast.error("Task title is required")
    try {
      if (editingTask) {
        await projectApi.updateTask(project.id, editingTask.id, taskForm)
        toast.success("Task updated")
      } else {
        await projectApi.addTask(project.id, taskForm)
        toast.success("Task created")
      }
      setIsTaskModalOpen(false)
      refetch()
    } catch (error) {
      toast.error(error.message)
    }
  }

  const handleDeleteTask = async (taskId) => {
    if (!confirm("Are you sure you want to delete this task?")) return
    try {
      await projectApi.deleteTask(project.id, taskId)
      toast.success("Task deleted")
      refetch()
    } catch (error) {
      toast.error(error.message)
    }
  }

  const handleToggleTaskStatus = async (task) => {
    if (!isLead) return // only leads can toggle right now
    const newStatus = task.status === 'completed' ? 'todo' : 'completed'
    try {
      await projectApi.updateTask(project.id, task.id, { status: newStatus })
      refetch()
    } catch (error) {
      toast.error(error.message)
    }
  }

  const handleRemoveMember = async (memberId) => {
    if (!confirm("Are you sure you want to remove this member?")) return
    try {
      await projectApi.removeMember(project.id, memberId)
      toast.success("Member removed")
      refetch()
    } catch (error) {
      toast.error(error.message)
    }
  }

  const getInitials = (name) => {
    if (!name) return 'U'
    return name.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase()
  }

  return (
    <div className="space-y-6 animate-in fade-in-50 duration-500">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => {
            if (window.location.pathname.startsWith('/admin')) navigate('/admin/projects')
            else if (window.location.pathname.startsWith('/business-owner')) navigate('/business-owner/projects')
            else navigate('/employee/projects')
          }} className="shrink-0 -ml-2">
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-foreground dark:text-slate-50 flex items-center gap-2">
                {project.name}
              </h1>
              {getStatusBadge(project.status)}
            </div>
            <p className="text-muted-foreground mt-1 line-clamp-1">
              {project.description || "No description provided"}
            </p>
          </div>
        </div>
        <div className="flex gap-2">
          {/* Action buttons (Edit/Delete/Leave) will go here */}
        </div>
      </div>

      {/* Tabs Layout */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full space-y-4">
        <TabsList className="bg-background border h-auto p-1 overflow-x-auto flex w-full justify-start sm:w-auto sm:inline-flex">
          <TabsTrigger value="overview" className="gap-2 data-[state=active]:bg-primary/10 data-[state=active]:text-primary">
            <FolderKanban className="w-4 h-4" /> Overview
          </TabsTrigger>
          <TabsTrigger value="tasks" className="gap-2 data-[state=active]:bg-primary/10 data-[state=active]:text-primary">
            <CheckCircle2 className="w-4 h-4" /> Tasks
            {totalTasks > 0 && <Badge variant="secondary" className="ml-1 px-1.5 py-0.5 text-[10px]">{totalTasks}</Badge>}
          </TabsTrigger>
          <TabsTrigger value="team" className="gap-2 data-[state=active]:bg-primary/10 data-[state=active]:text-primary">
            <Users className="w-4 h-4" /> Team
          </TabsTrigger>
          {isLead && (
            <TabsTrigger value="attendance" className="gap-2 data-[state=active]:bg-primary/10 data-[state=active]:text-primary">
              <Calendar className="w-4 h-4" /> Attendance
            </TabsTrigger>
          )}
          <TabsTrigger value="analytics" className="gap-2 data-[state=active]:bg-primary/10 data-[state=active]:text-primary">
            <Activity className="w-4 h-4" /> Analytics
          </TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="mt-6 space-y-6">
          <div className="grid gap-6 md:grid-cols-3">
            <Card className="md:col-span-2">
              <CardHeader>
                <CardTitle>Project Details</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <h3 className="font-medium text-sm text-muted-foreground mb-1">Description</h3>
                  <p className="text-sm leading-relaxed">{project.description || "No description provided"}</p>
                </div>
                <div className="pt-4 border-t">
                  <h3 className="font-medium text-sm text-muted-foreground mb-2">Progress</h3>
                  <div className="flex items-center gap-4">
                    <Progress value={progressPercent} className="h-2 flex-1" />
                    <span className="text-sm font-medium">{progressPercent}%</span>
                  </div>
                  <p className="text-xs text-muted-foreground mt-2">{completedTasks} of {totalTasks} tasks completed</p>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Quick Stats</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Team Size</span>
                  <span className="font-medium flex items-center gap-1.5">
                    <Users className="w-4 h-4 text-blue-500" />
                    {Object.keys(project.membersData || {}).length}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Created</span>
                  <span className="font-medium flex items-center gap-1.5">
                    <Calendar className="w-4 h-4 text-purple-500" />
                    {new Date(project.createdAt).toLocaleDateString()}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Your Role</span>
                  <span className="font-medium flex items-center gap-1.5">
                    {isLead ? <Shield className="w-4 h-4 text-amber-500" /> : <Users className="w-4 h-4 text-emerald-500" />}
                    {isLead ? 'Lead' : 'Member'}
                  </span>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="tasks">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <div>
                <CardTitle>Project Tasks</CardTitle>
                <CardDescription>Manage your project to-do list here.</CardDescription>
              </div>
              {isLead && (
                <Button size="sm" className="gap-1" onClick={() => {
                  setEditingTask(null)
                  setTaskForm({ title: '', description: '', status: 'todo', deadline: '' })
                  setIsTaskModalOpen(true)
                }}>
                  <Plus className="w-4 h-4" /> Add Task
                </Button>
              )}
            </CardHeader>
            <CardContent>
              {tasks.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground bg-muted/20 rounded-lg border border-dashed mt-4">
                  <CheckCircle2 className="w-8 h-8 mx-auto mb-3 opacity-20" />
                  <p>No tasks created yet.</p>
                </div>
              ) : (
                <div className="space-y-3 mt-4">
                  {tasks.map(task => (
                    <div key={task.id} className="flex flex-col sm:flex-row sm:items-start justify-between p-4 rounded-lg border bg-card hover:bg-muted/30 transition-colors gap-4">
                      <div className="flex items-start gap-3 flex-1 min-w-0">
                        <Button 
                          variant="ghost" 
                          size="icon" 
                          className={`shrink-0 rounded-full w-6 h-6 mt-0.5 ${task.status === 'completed' ? 'text-blue-500 hover:text-blue-600 hover:bg-blue-50' : 'text-muted-foreground hover:bg-muted'}`}
                          onClick={() => handleToggleTaskStatus(task)}
                          disabled={!isLead}
                        >
                          {task.status === 'completed' ? <CheckCircle2 className="w-5 h-5" /> : <Circle className="w-5 h-5" />}
                        </Button>
                        <div className="space-y-1">
                          <p className={`font-medium ${task.status === 'completed' ? 'line-through text-muted-foreground' : ''}`}>
                            {task.title}
                          </p>
                          {task.description && (
                            <p className="text-sm text-muted-foreground">{task.description}</p>
                          )}
                          {task.deadline && (
                            <div className="flex items-center gap-1.5 text-xs font-medium text-amber-600 bg-amber-50 px-2 py-0.5 rounded-full w-max mt-2">
                              <Clock className="w-3 h-3" /> Due: {new Date(task.deadline).toLocaleDateString()}
                            </div>
                          )}
                        </div>
                      </div>
                      {isLead && (
                        <div className="flex items-center gap-1 shrink-0 justify-end mt-2 sm:mt-0">
                          <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground" onClick={() => {
                            setEditingTask(task)
                            setTaskForm({ title: task.title, description: task.description, status: task.status, deadline: task.deadline || '' })
                            setIsTaskModalOpen(true)
                          }}>
                            <Edit className="w-4 h-4" />
                          </Button>
                          <Button variant="ghost" size="icon" className="h-8 w-8 text-red-500 hover:bg-red-50 hover:text-red-600" onClick={() => handleDeleteTask(task.id)}>
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="team">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <div>
                <CardTitle>Team Members</CardTitle>
                <CardDescription>People collaborating on this project.</CardDescription>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-4 mt-4">
                {Object.entries(project.membersData || {}).map(([memberId, member]) => (
                  <div key={memberId} className="flex items-center justify-between p-3 rounded-lg border bg-card hover:bg-muted/30 transition-colors">
                    <div className="flex items-center gap-3">
                      <Avatar>
                        <AvatarFallback className="bg-primary/10 text-primary">{getInitials(member.name)}</AvatarFallback>
                      </Avatar>
                      <div className="min-w-0 flex-1">
                        <p className="font-medium flex flex-wrap items-center gap-2">
                          <span className="truncate">{member.name || 'Unknown User'}</span>
                          {member.role === 'lead' && <Badge className="bg-purple-100 text-purple-700 hover:bg-purple-200 border-none text-[10px] h-4 px-1.5 shrink-0"><Shield className="w-3 h-3 mr-1" /> Lead</Badge>}
                        </p>
                        <p className="text-xs text-muted-foreground flex flex-wrap items-center gap-2 mt-0.5">
                          <span className="truncate">{member.department || 'No Dept'}</span>
                          {member.status !== 'accepted' && member.role !== 'lead' && (
                            <Badge variant="outline" className="text-[10px] h-4 px-1.5 shrink-0">{member.status}</Badge>
                          )}
                        </p>
                      </div>
                    </div>
                    {isLead && memberId !== currentUser.id && (
                      <Button variant="ghost" size="icon" className="text-red-500 hover:text-red-600 hover:bg-red-50" onClick={() => handleRemoveMember(memberId)}>
                        <UserMinus className="w-4 h-4" />
                      </Button>
                    )}
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {isLead && (
          <TabsContent value="attendance">
            <Card>
              <CardHeader>
                <CardTitle>Team Attendance</CardTitle>
                <CardDescription>Today's attendance status for project members.</CardDescription>
              </CardHeader>
              <CardContent>
                {attendanceLoading ? (
                  <div className="flex justify-center py-8"><Clock className="animate-spin w-6 h-6 text-muted-foreground" /></div>
                ) : (
                  <div className="space-y-4 mt-4">
                    {Object.entries(project.membersData || {}).map(([memberId, member]) => {
                      const record = attendanceData[memberId]
                      
                      const getAttendanceStatus = () => {
                        if (!record) return { label: 'Not Logged In', color: 'bg-muted text-muted-foreground' }
                        if (record.isLeave) return { label: 'On Leave', color: 'bg-blue-100 text-blue-700' }
                        if (record.checkOutTime) return { label: 'Logged Out', color: 'bg-gray-100 text-gray-700' }
                        return { label: 'Working', color: 'bg-emerald-100 text-emerald-700' }
                      }

                      const status = getAttendanceStatus()

                      return (
                        <div key={memberId} className="flex items-center justify-between p-3 rounded-lg border bg-card">
                          <div className="flex items-center gap-3">
                            <Avatar>
                              <AvatarFallback className="bg-primary/10 text-primary">{getInitials(member.name)}</AvatarFallback>
                            </Avatar>
                            <div className="min-w-0 flex-1">
                              <p className="font-medium text-sm truncate">{member.name || 'Unknown User'}</p>
                              {record?.checkInTime && (
                                <p className="text-xs text-muted-foreground truncate">In: {new Date(record.checkInTime).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</p>
                              )}
                            </div>
                          </div>
                          <Badge className={`${status.color} hover:${status.color} border-none shrink-0 ml-2`}>
                            {status.label}
                          </Badge>
                        </div>
                      )
                    })}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        )}

        <TabsContent value="analytics">
          <Card>
            <CardHeader>
              <CardTitle>Analytics</CardTitle>
              <CardDescription>Visual metrics for project progress.</CardDescription>
            </CardHeader>
            <CardContent>
               <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                 <div className="p-4 border rounded-lg bg-card flex flex-col gap-2">
                   <h4 className="text-sm font-medium text-muted-foreground flex items-center gap-2"><CheckCircle2 className="w-4 h-4 text-emerald-500"/> Task Completion Rate</h4>
                   <p className="text-2xl font-bold">{progressPercent}%</p>
                   <Progress value={progressPercent} className="h-2 w-full mt-2" />
                 </div>
                 <div className="p-4 border rounded-lg bg-card flex flex-col gap-2">
                   <h4 className="text-sm font-medium text-muted-foreground flex items-center gap-2"><FolderKanban className="w-4 h-4 text-blue-500"/> Total Tasks</h4>
                   <p className="text-2xl font-bold">{totalTasks}</p>
                   <p className="text-xs text-muted-foreground">{completedTasks} completed, {totalTasks - completedTasks} remaining</p>
                 </div>
               </div>
            </CardContent>
          </Card>
        </TabsContent>

      </Tabs>

      {/* Task Modal */}
      <Dialog open={isTaskModalOpen} onOpenChange={setIsTaskModalOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{editingTask ? 'Edit Task' : 'Add New Task'}</DialogTitle>
          </DialogHeader>
          <DialogBody className="space-y-4">
            <div className="space-y-2">
              <Label>Task Title *</Label>
              <Input 
                placeholder="What needs to be done?" 
                value={taskForm.title}
                onChange={e => setTaskForm({...taskForm, title: e.target.value})}
              />
            </div>
            <div className="space-y-2">
              <Label>Description</Label>
              <Textarea 
                placeholder="Additional details..." 
                value={taskForm.description}
                onChange={e => setTaskForm({...taskForm, description: e.target.value})}
                rows={3}
              />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Deadline</Label>
                <Input 
                  type="date"
                  value={taskForm.deadline}
                  onChange={e => setTaskForm({...taskForm, deadline: e.target.value})}
                />
              </div>
              <div className="space-y-2">
                <Label>Status</Label>
                <Select value={taskForm.status} onValueChange={v => setTaskForm({...taskForm, status: v})}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="todo">To Do</SelectItem>
                    <SelectItem value="completed">Completed</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </DialogBody>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsTaskModalOpen(false)}>Cancel</Button>
            <Button onClick={handleSaveTask}>Save Task</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
