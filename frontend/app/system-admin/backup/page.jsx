import React, { useState, useEffect } from "react"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { format } from "date-fns"
import { Database, Plus, RefreshCw, Download, Trash2, ShieldAlert, AlertTriangle, PlayCircle } from "lucide-react"
import { getValidIdToken } from "@/lib/firebaseClient"

const getApiBase = () => {
  const url = import.meta.env.VITE_API_URL || ""
  return url.endsWith('/api') ? url : `${url}/api`
}
import { toast } from "sonner"
import { cn } from "@/lib/utils"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { Skeleton } from "@/components/ui/skeleton"

export default function SystemAdminBackupPage() {
  const queryClient = useQueryClient()
  const [isRestoreDialogOpen, setIsRestoreDialogOpen] = useState(false)
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false)
  const [selectedBackup, setSelectedBackup] = useState(null)
  const [restoreConfirmation, setRestoreConfirmation] = useState("")
  const [pollingInterval, setPollingInterval] = useState(0) // 0 means disabled

  // Fetch Backups
  const { data: backupData, isLoading, refetch } = useQuery({
    queryKey: ['system-backups'],
    queryFn: async () => {
      const token = await getValidIdToken()
      const res = await fetch(`${getApiBase()}/system-admin/backups`, {
        headers: { Authorization: `Bearer ${token}` }
      })
      if (!res.ok) throw new Error("Failed to fetch backups")
      const json = await res.json()
      
      // Check if any backup is in 'creating' state to start polling
      const hasPending = json.backups?.some(b => b.status === 'creating')
      setPollingInterval(hasPending ? 3000 : 0)
      
      return json
    },
    refetchInterval: pollingInterval
  })

  // Create Backup Mutation
  const createBackupMutation = useMutation({
    mutationFn: async () => {
      const token = await getValidIdToken()
      const res = await fetch(`${getApiBase()}/system-admin/backups`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` }
      })
      if (!res.ok) {
        const err = await res.json()
        throw new Error(err.error || "Failed to create backup")
      }
      return res.json()
    },
    onSuccess: () => {
      toast.success("Backup started successfully")
      queryClient.invalidateQueries({ queryKey: ['system-backups'] })
      setPollingInterval(3000) // Start polling
    },
    onError: (error) => {
      toast.error(error.message)
    }
  })

  // Restore Backup Mutation
  const restoreBackupMutation = useMutation({
    mutationFn: async ({ backupId, confirmationText }) => {
      const token = await getValidIdToken()
      const res = await fetch(`${getApiBase()}/system-admin/backups/${backupId}/restore`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}` 
        },
        body: JSON.stringify({ confirmationText })
      })
      if (!res.ok) {
        const err = await res.json()
        throw new Error(err.error || "Failed to restore backup")
      }
      return res.json()
    },
    onSuccess: () => {
      toast.success("Database restored successfully")
      setIsRestoreDialogOpen(false)
      setRestoreConfirmation("")
      queryClient.invalidateQueries()
    },
    onError: (error) => {
      toast.error(error.message)
    }
  })

  // Delete Backup Mutation
  const deleteBackupMutation = useMutation({
    mutationFn: async (backupId) => {
      const token = await getValidIdToken()
      const res = await fetch(`${getApiBase()}/system-admin/backups/${backupId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` }
      })
      if (!res.ok) throw new Error("Failed to delete backup")
      return res.json()
    },
    onSuccess: () => {
      toast.success("Backup deleted")
      setIsDeleteDialogOpen(false)
      queryClient.invalidateQueries({ queryKey: ['system-backups'] })
    },
    onError: (error) => {
      toast.error(error.message)
    }
  })

  const backups = backupData?.backups || []
  const latestBackup = backups.length > 0 ? backups[0] : null
  const isCreating = createBackupMutation.isPending || backups.some(b => b.status === 'creating')

  const handleDownload = async (backupId) => {
    try {
      const token = await getValidIdToken()
      // Create a temporary link to download the file, passing the token in the query string is bad practice for production,
      // but fetch doesn't support file downloads directly via blob easily if the file is massive.
      // We will do blob fetch:
      const res = await fetch(`${getApiBase()}/system-admin/backups/${backupId}/download`, {
        headers: { Authorization: `Bearer ${token}` }
      })
      
      if (!res.ok) throw new Error("Download failed")
      
      const blob = await res.blob()
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `${backupId}.json`
      document.body.appendChild(a)
      a.click()
      a.remove()
      window.URL.revokeObjectURL(url)
    } catch (error) {
      toast.error("Failed to download backup")
    }
  }

  const formatSize = (bytes) => {
    if (!bytes || bytes === 0) return '0 B'
    const k = 1024
    const sizes = ['B', 'KB', 'MB', 'GB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
  }

  const getStatusBadge = (status) => {
    switch (status) {
      case 'ready':
        return <Badge variant="outline" className="bg-emerald-500/10 text-emerald-500 border-emerald-500/20">Ready</Badge>
      case 'creating':
        return <Badge variant="outline" className="bg-amber-500/10 text-amber-500 border-amber-500/20 animate-pulse">Creating...</Badge>
      case 'failed':
        return <Badge variant="outline" className="bg-red-500/10 text-red-500 border-red-500/20">Failed</Badge>
      default:
        return <Badge variant="outline">{status}</Badge>
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight text-foreground">Backup & Recovery</h1>
        <p className="text-muted-foreground mt-2">
          Manage system-wide database backups. Create snapshots and restore data in case of emergency.
        </p>
      </div>

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        {/* Latest Backup Card */}
        <Card className="col-span-full lg:col-span-1 shadow-sm border-border bg-card">
          <CardHeader className="pb-3">
            <CardTitle className="text-lg font-semibold flex items-center gap-2">
              <Database className="h-5 w-5 text-blue-500" />
              Latest Backup
            </CardTitle>
            <CardDescription>The most recent database snapshot</CardDescription>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="space-y-2">
                <Skeleton className="h-4 w-[250px]" />
                <Skeleton className="h-4 w-[200px]" />
              </div>
            ) : latestBackup ? (
              <div className="space-y-4">
                <div>
                  <p className="text-sm text-muted-foreground">Created At</p>
                  <p className="font-medium text-foreground">
                    {format(new Date(latestBackup.createdAt), "dd MMM yyyy — hh:mm a")}
                  </p>
                </div>
                <div className="flex gap-4">
                  <div>
                    <p className="text-sm text-muted-foreground">Status</p>
                    <div className="mt-1">{getStatusBadge(latestBackup.status)}</div>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Size</p>
                    <p className="font-medium text-foreground mt-1">{formatSize(latestBackup.fileSize)}</p>
                  </div>
                </div>
              </div>
            ) : (
              <div className="text-muted-foreground text-sm flex items-center gap-2 py-4">
                <AlertTriangle className="h-4 w-4" />
                No backups exist. Create one now.
              </div>
            )}
          </CardContent>
          <CardFooter className="pt-4 border-t border-border/50">
            <Button 
              className="w-full bg-blue-600 hover:bg-blue-700 text-white" 
              onClick={() => createBackupMutation.mutate()}
              disabled={isCreating}
            >
              {isCreating ? (
                <>
                  <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                  Creating Backup...
                </>
              ) : (
                <>
                  <Plus className="mr-2 h-4 w-4" />
                  Create Backup
                </>
              )}
            </Button>
          </CardFooter>
        </Card>

        {/* Info Card */}
        <Card className="col-span-full lg:col-span-2 shadow-sm border-border bg-card">
          <CardHeader>
            <CardTitle className="text-lg font-semibold flex items-center gap-2">
              <ShieldAlert className="h-5 w-5 text-amber-500" />
              Important Guidelines
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4 text-sm text-muted-foreground">
            <p>
              <strong className="text-foreground">System-wide Backup:</strong> A backup includes all organizations, users, departments, attendance, and leave records.
            </p>
            <p>
              <strong className="text-foreground">Retention Policy:</strong> The system automatically keeps the last 10 backups. Older backups are deleted to preserve storage.
            </p>
            <div className="bg-destructive/10 text-destructive p-3 rounded-md border border-destructive/20 flex items-start gap-3 mt-4">
              <AlertTriangle className="h-5 w-5 shrink-0 mt-0.5" />
              <div>
                <strong className="block mb-1">Warning: Restoration is Destructive</strong>
                Restoring a backup will completely overwrite all existing database collections. Any changes made after the backup was created will be permanently lost.
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* History Table */}
      <Card className="shadow-sm border-border bg-card">
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle>Backup History</CardTitle>
            <CardDescription>View and manage previous backups</CardDescription>
          </div>
          <Button variant="outline" size="sm" onClick={() => refetch()} disabled={isLoading || isCreating}>
            <RefreshCw className={cn("h-4 w-4 mr-2", (isLoading || isCreating) && "animate-spin")} />
            Refresh
          </Button>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-2">
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
            </div>
          ) : (
            <div className="rounded-md border border-border">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/50 hover:bg-muted/50">
                    <TableHead>Created At</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Documents</TableHead>
                    <TableHead>Size</TableHead>
                    <TableHead>Created By</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {backups.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                        No backup history found.
                      </TableCell>
                    </TableRow>
                  ) : (
                    backups.map((backup) => (
                      <TableRow key={backup.id}>
                        <TableCell className="font-medium">
                          {format(new Date(backup.createdAt), "dd MMM yyyy — hh:mm a")}
                        </TableCell>
                        <TableCell>{getStatusBadge(backup.status)}</TableCell>
                        <TableCell>{backup.stats?.totalDocuments?.toLocaleString() || '-'}</TableCell>
                        <TableCell>{formatSize(backup.fileSize)}</TableCell>
                        <TableCell>{backup.createdBy?.name || 'System'}</TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-2">
                            <Button 
                              variant="outline" 
                              size="sm" 
                              disabled={backup.status !== 'ready'}
                              onClick={() => handleDownload(backup.id)}
                            >
                              <Download className="h-4 w-4" />
                            </Button>
                            <Button 
                              variant="destructive" 
                              size="sm"
                              className="bg-red-500/10 text-red-500 hover:bg-red-500 hover:text-white border-0"
                              disabled={backup.status !== 'ready'}
                              onClick={() => {
                                setSelectedBackup(backup)
                                setIsRestoreDialogOpen(true)
                              }}
                            >
                              <PlayCircle className="h-4 w-4 mr-1" />
                              Restore
                            </Button>
                            <Button 
                              variant="ghost" 
                              size="sm"
                              className="text-muted-foreground hover:text-destructive"
                              disabled={backup.status === 'creating'}
                              onClick={() => {
                                setSelectedBackup(backup)
                                setIsDeleteDialogOpen(true)
                              }}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Restore Dialog */}
      <Dialog open={isRestoreDialogOpen} onOpenChange={setIsRestoreDialogOpen}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle className="text-destructive flex items-center gap-2">
              <AlertTriangle className="h-5 w-5" />
              Restore Database?
            </DialogTitle>
            <DialogDescription className="pt-3 space-y-3">
              <p>
                This operation will replace current database data using the selected backup from:
              </p>
              <div className="p-3 bg-muted rounded-md text-foreground font-medium">
                {selectedBackup && format(new Date(selectedBackup.createdAt), "dd MMM yyyy — hh:mm a")}
                <br />
                <span className="text-sm text-muted-foreground font-normal">
                  {selectedBackup?.stats?.totalDocuments} documents ({formatSize(selectedBackup?.fileSize)})
                </span>
              </div>
              <p className="font-semibold text-destructive">
                Current changes made after this backup will be permanently lost.
              </p>
              <div className="pt-2">
                <Label htmlFor="confirmText" className="text-foreground">
                  Type <strong className="select-all">RESTORE</strong> to continue.
                </Label>
                <Input
                  id="confirmText"
                  value={restoreConfirmation}
                  onChange={(e) => setRestoreConfirmation(e.target.value)}
                  placeholder="RESTORE"
                  className="mt-2"
                  autoComplete="off"
                />
              </div>
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2 mt-4">
            <Button variant="outline" onClick={() => {
              setIsRestoreDialogOpen(false)
              setRestoreConfirmation("")
            }}>
              Cancel
            </Button>
            <Button 
              variant="destructive"
              disabled={restoreConfirmation !== "RESTORE" || restoreBackupMutation.isPending}
              onClick={() => restoreBackupMutation.mutate({ 
                backupId: selectedBackup.id, 
                confirmationText: restoreConfirmation 
              })}
            >
              {restoreBackupMutation.isPending ? (
                <>
                  <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                  Restoring...
                </>
              ) : (
                "Restore Database"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Dialog */}
      <Dialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Backup</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete this backup? This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="mt-4">
            <Button variant="outline" onClick={() => setIsDeleteDialogOpen(false)}>
              Cancel
            </Button>
            <Button 
              variant="destructive"
              disabled={deleteBackupMutation.isPending}
              onClick={() => deleteBackupMutation.mutate(selectedBackup?.id)}
            >
              {deleteBackupMutation.isPending ? (
                <RefreshCw className="h-4 w-4 animate-spin" />
              ) : (
                "Delete"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
