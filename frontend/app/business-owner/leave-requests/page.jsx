import { useState, useMemo } from"react"
import { useNavigate } from"react-router-dom"
import { useQuery, useMutation, useQueryClient } from"@tanstack/react-query"
import {
 FileText,
 CheckCircle2,
 XCircle,
 AlertCircle,
 Clock,
 Search,
 Filter,
 ArrowLeft,
 RefreshCw,
 Briefcase,
 Crown,
 ArrowUpDown
} from"lucide-react"
import {
 Card,
 CardContent,
 CardDescription,
 CardHeader,
 CardTitle,
 CardFooter
} from"@/components/ui/card"
import { Button } from"@/components/ui/button"
import { Input } from"@/components/ui/input"
import { Badge } from"@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from"@/components/ui/tabs"
import {
 Dialog,
 DialogContent,
 DialogDescription,
 DialogFooter,
 DialogHeader,
 DialogTitle,
 DialogTrigger,
 DialogBody,
} from"@/components/ui/dialog"
import { Label } from"@/components/ui/label"
import { Textarea } from"@/components/ui/textarea"
import {
 Table,
 TableBody,
 TableCell,
 TableHead,
 TableHeader,
 TableRow,
} from"@/components/ui/table"
import { getValidIdToken } from"@/lib/firebaseClient"
import { toast } from"sonner"
import { format } from"date-fns"
import { Avatar, AvatarFallback } from"@/components/ui/avatar"

const getApiBase = () => import.meta.env.VITE_API_URL || ''

export default function BusinessOwnerLeaveRequestsPage() {
 const navigate = useNavigate()
 const queryClient = useQueryClient()
 const [activeTab, setActiveTab] = useState("approvals")
 <span className="text-muted-foreground">{formatDate(leave.endDate)}</span>
 </TableCell>
 <TableCell>{leave.days}</TableCell>
 <TableCell>{getStatusBadge(leave.status)}</TableCell>
 <TableCell className="text-xs">
 {leave.reviewedByName || '—'}
 {leave.reviewComments && <p className="text-muted-foreground italic">"{leave.reviewComments}"</p>}
 </TableCell>
 <TableCell className="text-xs text-muted-foreground">{formatDate(leave.createdAt)}</TableCell>
 </TableRow>
 ))
 )}
 </TableBody>
 </Table>
 </div>
 </CardContent>
 </Card>
 </TabsContent>
 </Tabs>

 {/* Action Dialog */}
 <Dialog open={actionDialog.open} onOpenChange={(open) => !open && setActionDialog({ open: false, type: null, leave: null })}>
 <DialogContent className="">
 <DialogHeader>
 <DialogTitle>
 {actionDialog.type === 'approve' ? 'Approve Leave Request' : 'Reject Leave Request'}
 </DialogTitle>
 <DialogDescription>
 {actionDialog.leave?.userName} - {actionDialog.leave?.days} days ({actionDialog.leave?.leaveType})
 </DialogDescription>
 </DialogHeader>
 <DialogBody>
 <div className="space-y-4 py-4">
 <div className="space-y-2">
 <Label>Comments (Optional)</Label>
 <Textarea
 placeholder={actionDialog.type === 'reject' ?"Please provide a reason for rejection (optional)..." :"Add a note (optional)..."}
 value={comments}
 onChange={(e) => setComments(e.target.value)}
 />
 </div>
 </div>
 </DialogBody>
 <DialogFooter>
 <Button variant="outline" onClick={() => setActionDialog({ open: false, type: null, leave: null })}>Cancel</Button>
 <Button
 className={actionDialog.type === 'approve' ?"bg-emerald-600 hover:bg-emerald-700" :"bg-red-600 hover:bg-red-700"}
 disabled={processLeave.isPending}
 onClick={() => processLeave.mutate({
 leaveId: actionDialog.leave.id,
 type: actionDialog.type,
 comment: comments
 })}
 >
 {processLeave.isPending && <RefreshCw className="mr-2 h-4 w-4 animate-spin" />}
 {actionDialog.type === 'approve' ? 'Confirm Approval' : 'Confirm Rejection'}
 </Button>
 </DialogFooter>
 </DialogContent>
 </Dialog>
 </div>
 )
}
