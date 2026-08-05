import { useState, useEffect } from "react"
import { Bell, Check, Circle, ExternalLink } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Badge } from "@/components/ui/badge"
import { notificationApi } from "@/lib/api-notifications"
import { formatDistanceToNow } from "date-fns"
import { toast } from "sonner"
import { useNavigate } from "react-router-dom"
import { io } from "socket.io-client"

export function NotificationDrawer() {
  const [notifications, setNotifications] = useState([])
  const [isOpen, setIsOpen] = useState(false)
  const navigate = useNavigate()

  const fetchNotifications = async () => {
    try {
      const res = await notificationApi.getNotifications()
      if (res.data) setNotifications(res.data)
    } catch (error) {
      console.error("Failed to fetch notifications:", error)
    }
  }

  useEffect(() => {
    fetchNotifications()

    // Setup socket listener
    const currentUser = JSON.parse(localStorage.getItem('currentUser')) || JSON.parse(localStorage.getItem('currentEmployee'))
    if (!currentUser) return

    const socketUrl = import.meta.env.VITE_API_URL || 'http://localhost:3000'
    const socket = io(socketUrl, { withCredentials: true })

    socket.on('connect', () => {
      socket.emit('authenticate', { 
        userId: currentUser.id || currentUser.uid, 
        organizationId: currentUser.organizationId 
      })
    })

    socket.on('notification', (newNotification) => {
      // Don't toast if it's just a background sync unless it's important
      if (newNotification.type === 'project_invite' || newNotification.type === 'task_added') {
        toast.info(newNotification.title, { description: newNotification.message })
      }
      setNotifications(prev => [newNotification, ...prev])
    })

    return () => {
      socket.disconnect()
    }
  }, [])

  const unreadCount = notifications.filter(n => !n.read).length

  const handleMarkAsRead = async (id) => {
    try {
      await notificationApi.markAsRead(id)
      setNotifications(prev => prev.map(n => n.id === id ? { ...n, read: true } : n))
    } catch (error) {
      console.error("Failed to mark as read", error)
    }
  }

  const handleMarkAllAsRead = async () => {
    try {
      await notificationApi.markAllAsRead()
      setNotifications(prev => prev.map(n => ({ ...n, read: true })))
      toast.success("All notifications marked as read")
    } catch (error) {
      console.error("Failed to mark all as read", error)
    }
  }

  const handleNotificationClick = (notification) => {
    if (!notification.read) {
      handleMarkAsRead(notification.id)
    }

    if (notification.data?.projectId) {
      setIsOpen(false)
      // Navigate to project details
      const isEmployee = window.location.pathname.startsWith('/employee')
      const isAdmin = window.location.pathname.startsWith('/admin')
      const isBO = window.location.pathname.startsWith('/business-owner')
      
      const basePath = isEmployee ? '/employee' : isAdmin ? '/admin' : isBO ? '/business-owner' : ''
      if (basePath) {
         navigate(`${basePath}/projects/${notification.data.projectId}`)
      }
    }
  }

  return (
    <Sheet open={isOpen} onOpenChange={setIsOpen}>
      <SheetTrigger asChild>
        <Button variant="ghost" size="icon" className="relative text-foreground hover:bg-muted">
          <Bell className="h-5 w-5" />
          {unreadCount > 0 && (
            <Badge 
              variant="destructive" 
              className="absolute -top-1 -right-1 h-5 w-5 flex items-center justify-center rounded-full p-0 text-[10px]"
            >
              {unreadCount > 99 ? '99+' : unreadCount}
            </Badge>
          )}
        </Button>
      </SheetTrigger>
      <SheetContent className="w-full sm:max-w-md flex flex-col p-0">
        <SheetHeader className="p-4 border-b">
          <div className="flex items-center justify-between">
            <SheetTitle>Notifications</SheetTitle>
            {unreadCount > 0 && (
              <Button variant="ghost" size="sm" onClick={handleMarkAllAsRead} className="h-8 text-xs">
                Mark all as read
              </Button>
            )}
          </div>
          <SheetDescription className="hidden">Recent alerts and updates</SheetDescription>
        </SheetHeader>
        
        <ScrollArea className="flex-1">
          {notifications.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-40 text-muted-foreground">
              <Bell className="h-8 w-8 mb-2 opacity-20" />
              <p className="text-sm">No notifications yet</p>
            </div>
          ) : (
            <div className="flex flex-col">
              {notifications.map((notification) => (
                <div 
                  key={notification.id}
                  onClick={() => handleNotificationClick(notification)}
                  className={`p-4 border-b hover:bg-muted/50 cursor-pointer transition-colors relative flex gap-3 ${!notification.read ? 'bg-primary/5' : ''}`}
                >
                  {!notification.read && (
                    <div className="absolute left-2 top-1/2 -translate-y-1/2 w-1.5 h-1.5 bg-primary rounded-full" />
                  )}
                  <div className="flex-1 pl-2">
                    <div className="flex items-start justify-between gap-2">
                      <p className={`text-sm ${!notification.read ? 'font-medium text-foreground' : 'text-muted-foreground'}`}>
                        {notification.title}
                      </p>
                      <span className="text-[10px] text-muted-foreground whitespace-nowrap">
                        {notification.createdAt ? formatDistanceToNow(new Date(notification.createdAt), { addSuffix: true }) : 'Just now'}
                      </span>
                    </div>
                    <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
                      {notification.message}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </ScrollArea>
      </SheetContent>
    </Sheet>
  )
}
