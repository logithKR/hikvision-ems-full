import { useEffect, useState } from "react"
import { useNavigate } from "react-router-dom"
import { useQueryClient } from "@tanstack/react-query"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import {
  User,
  Mail,
  Building2,
  Calendar,
  Shield,
  Edit,
  Save,
  X,
  Lock,
  Phone,
  Briefcase,
  ArrowLeft,
  RefreshCw,
  Users,
  Eye,
  EyeOff
} from "lucide-react"
import { format } from "date-fns"
import { getCurrentUser, isAuthenticated } from "@/lib/auth"
import { getValidIdToken } from "@/lib/firebaseClient"

export default function AdminProfilePage() {
  const navigate = useNavigate()
  // eslint-disable-next-line no-unused-vars
  const queryClient = useQueryClient()

  const [currentUser, setCurrentUser] = useState(null)
  const [organization, setOrganization] = useState(null)
  const [loading, setLoading] = useState(false) // Fixed: Added missing state

  const [editMode, setEditMode] = useState(false)
  const [editedProfile, setEditedProfile] = useState({
    name: "",
    phone: "",
    department: "",
    position: "",
  })

  const [showPasswordChange, setShowPasswordChange] = useState(false)
  const [showCurrentPassword, setShowCurrentPassword] = useState(false)
  const [showNewPassword, setShowNewPassword] = useState(false)
  const [passwordData, setPasswordData] = useState({
    currentPassword: "",
    newPassword: "",
    confirmPassword: "",
  })

  // Auth Check
  useEffect(() => {
    if (!isAuthenticated()) {
      navigate("/admin/login")
      return
    }

    const emp = getCurrentUser()
    if (!emp || (emp.role !== "admin" && emp.role !== "system_admin")) {
      navigate("/admin/login")
      return
    }

    setCurrentUser(emp)
    setEditedProfile({
      name: emp.name || "",
      phone: emp.phone || "",
      department: emp.department || "",
      position: emp.position || "Admin",
    })

    loadOrganizationDetails(emp)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [navigate])

  const getApiBase = () => {
    return import.meta.env.VITE_API_URL || ""
  }

  const loadOrganizationDetails = async () => {
    setLoading(true)
    const token = await getValidIdToken()
    const base = getApiBase()

    if (!token) {
      setLoading(false)
      return
    }

    try {
      const orgRes = await fetch(`${base}/api/admin/organization`, {
        headers: { Authorization: `Bearer ${token}` },
      })

      if (orgRes.ok) {
        const data = await orgRes.json()
        setOrganization(data)
      }
    } catch (error) {
      console.error("Failed to load organization:", error)
    } finally {
      setLoading(false)
    }
  }

  const handleSaveProfile = async () => {
    const token = await getValidIdToken()
    const base = getApiBase()

    try {
      const response = await fetch(`${base}/api/auth/profile`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(editedProfile),
      })

      if (response.ok) {
        const data = await response.json()
        const updatedEmployee = data.employee
        const updatedUser = { ...currentUser, ...updatedEmployee }
        // Update both session storage and state
        sessionStorage.setItem("currentUser", JSON.stringify(updatedUser))
        setCurrentUser(updatedUser)
        setEditMode(false)
        alert("Profile updated successfully!")
      } else {
        alert("Failed to update profile")
      }
    } catch (error) {
      console.error("Save profile error:", error)
      alert("Network error")
    }
  }

  const handleCancelEdit = () => {
    setEditedProfile({
      name: currentUser.name || "",
      phone: currentUser.phone || "",
      department: currentUser.department || "",
      position: currentUser.position || "Admin",
    })
    setEditMode(false)
  }

  const handleChangePassword = async (e) => {
    e.preventDefault()

    if (passwordData.newPassword !== passwordData.confirmPassword) {
      alert("New passwords don't match!")
      return
    }

    if (passwordData.newPassword.length < 6) {
      alert("Password must be at least 6 characters")
      return
    }

    const token = await getValidIdToken()
    const base = getApiBase()

    try {
      const response = await fetch(`${base}/api/auth/change-password`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          oldPassword: passwordData.currentPassword,
          newPassword: passwordData.newPassword,
        }),
      })

      if (response.ok) {
        alert("Password changed successfully!")
        setShowPasswordChange(false)
        setPasswordData({
          currentPassword: "",
          newPassword: "",
          confirmPassword: "",
        })
      } else {
        const data = await response.json()
        alert(`${data.error || "Failed to change password"}`)
      }
    } catch (error) {
      console.error("Change password error:", error)
      alert("Network error")
    }
  }

  const getInitials = (name) => {
    if (!name) return "AD"
    return name
      .split(" ")
      .map((n) => n[0])
      .join("")
      .toUpperCase()
      .slice(0, 2)
  }

  const formatDate = (dateString) => {
    try {
      return format(new Date(dateString), "MMMM dd, yyyy")
    } catch {
      return "N/A"
    }
  }

  if (!currentUser) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50">
        <RefreshCw className="h-8 w-8 animate-spin text-blue-600" />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-slate-50 animate-in fade-in-50 duration-500">
      <div className="mx-auto max-w-5xl px-4 py-8 space-y-6">
        {/* ── Page Header ─────────────────────────────────── */}
        <div className="bg-white border border-slate-200 rounded-xl px-4 sm:px-6 py-6 sm:py-8 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-5 sm:gap-6 shadow-sm">
          <div className="flex flex-col sm:flex-row items-center sm:items-center gap-4 sm:gap-5">
            <Avatar className="h-16 w-16 sm:h-20 sm:w-20 border-4 border-slate-50 shadow-sm">
              <AvatarFallback className="bg-blue-600 text-white text-2xl font-bold">
                {getInitials(currentUser.name)}
              </AvatarFallback>
            </Avatar>
            <div className="text-center sm:text-left">
              <h1 className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight">{currentUser.name}</h1>
              <p className="text-slate-500 font-medium">{currentUser.email}</p>
              <div className="flex gap-2 mt-2">
                <Badge className="bg-blue-50 text-blue-700 border-blue-100 hover:bg-blue-100 shadow-none">
                  <Shield className="mr-1 h-3 w-3" />
                  {currentUser.role === 'admin' ? 'Administrator' : 'System Admin'}
                </Badge>
              </div>
            </div>
          </div>
          <Button
            onClick={() => navigate("/admin/dashboard")}
            variant="outline"
            className="border-slate-200 text-slate-600 hover:bg-slate-50"
          >
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Dashboard
          </Button>
        </div>

        <div className="grid gap-6 md:grid-cols-3">
          {/* Left Column - Quick Info */}
          <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden h-fit">
            <div className="p-6 space-y-4">
              <h3 className="font-semibold text-slate-900 mb-4">Account Details</h3>
              <div className="space-y-4 text-sm">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-slate-100 rounded-lg">
                    <Calendar className="h-4 w-4 text-slate-600" />
                  </div>
                  <div>
                    <p className="text-xs text-slate-400">Member since</p>
                    <p className="font-medium text-slate-700">{formatDate(currentUser.createdAt)}</p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-slate-100 rounded-lg">
                    <Building2 className="h-4 w-4 text-slate-600" />
                  </div>
                  <div>
                    <p className="text-xs text-slate-400">Organization</p>
                    <p className="font-medium text-slate-700">{organization?.name || "Loading..."}</p>
                  </div>
                </div>
                {organization && (
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-slate-100 rounded-lg">
                      <Users className="h-4 w-4 text-slate-600" />
                    </div>
                    <div>
                      <p className="text-xs text-slate-400">Total Staff</p>
                      <p className="font-medium text-slate-700">{organization.employeeCount || 0} employees</p>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Right Column */}
          <div className="md:col-span-2 space-y-6">
            {/* Profile Information */}
            <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
              <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
                <div className="flex items-center gap-3">
                  <div className="p-1.5 bg-blue-50 border border-blue-100 rounded-lg">
                    <User className="h-4 w-4 text-blue-600" />
                  </div>
                  <div>
                    <h2 className="text-sm font-semibold text-slate-800">Profile Information</h2>
                    <p className="text-xs text-slate-400">Update your personal details</p>
                  </div>
                </div>
                {!editMode ? (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setEditMode(true)}
                    className="text-blue-600 hover:text-blue-700 hover:bg-blue-50"
                  >
                    <Edit className="mr-2 h-3.5 w-3.5" />
                    Edit
                  </Button>
                ) : (
                  <div className="flex gap-2">
                    <Button variant="ghost" size="sm" onClick={handleCancelEdit} className="text-slate-500">
                      Cancel
                    </Button>
                    <Button size="sm" onClick={handleSaveProfile} className="bg-blue-600 hover:bg-blue-700 text-white">
                      <Save className="mr-2 h-3.5 w-3.5" />
                      Save
                    </Button>
                  </div>
                )}
              </div>
              <div className="p-6">
                <div className="grid gap-5 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="name" className="text-xs font-medium text-slate-500 uppercase">Full Name</Label>
                    {editMode ? (
                      <div className="relative">
                        <User className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                        <Input
                          id="name"
                          value={editedProfile.name}
                          onChange={(e) => setEditedProfile((s) => ({ ...s, name: e.target.value }))}
                          className="pl-10 border-slate-200 focus:border-blue-500 focus:ring-blue-500"
                        />
                      </div>
                    ) : (
                      <div className="text-sm font-medium text-slate-900 border-b border-slate-100 pb-2">
                        {currentUser.name}
                      </div>
                    )}
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="email" className="text-xs font-medium text-slate-500 uppercase">Email Address</Label>
                    <div className="flex items-center gap-2 text-sm text-slate-900 border-b border-slate-100 pb-2 opacity-75">
                      <Mail className="h-3.5 w-3.5 text-slate-400" />
                      {currentUser.email}
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="phone" className="text-xs font-medium text-slate-500 uppercase">Phone Number</Label>
                    {editMode ? (
                      <div className="relative">
                        <Phone className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                        <Input
                          id="phone"
                          type="tel"
                          placeholder="Enter phone number"
                          value={editedProfile.phone}
                          onChange={(e) => setEditedProfile((s) => ({ ...s, phone: e.target.value }))}
                          className="pl-10 border-slate-200"
                        />
                      </div>
                    ) : (
                      <div className="text-sm font-medium text-slate-900 border-b border-slate-100 pb-2">
                        {currentUser.phone || "Not provided"}
                      </div>
                    )}
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="position" className="text-xs font-medium text-slate-500 uppercase">Position</Label>
                    {editMode ? (
                      <div className="relative">
                        <Briefcase className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                        <Input
                          id="position"
                          placeholder="Your position"
                          value={editedProfile.position}
                          onChange={(e) => setEditedProfile((s) => ({ ...s, position: e.target.value }))}
                          className="pl-10 border-slate-200"
                        />
                      </div>
                    ) : (
                      <div className="text-sm font-medium text-slate-900 border-b border-slate-100 pb-2">
                        {currentUser.position || "Admin"}
                      </div>
                    )}
                  </div>

                  <div className="space-y-2 md:col-span-2">
                    <Label htmlFor="department" className="text-xs font-medium text-slate-500 uppercase">Department</Label>
                    {editMode ? (
                      <div className="relative">
                        <Building2 className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                        <Input
                          id="department"
                          placeholder="Department"
                          value={editedProfile.department}
                          onChange={(e) => setEditedProfile((s) => ({ ...s, department: e.target.value }))}
                          className="pl-10 border-slate-200"
                        />
                      </div>
                    ) : (
                      <div className="text-sm font-medium text-slate-900 border-b border-slate-100 pb-2">
                        {currentUser.department || "Not specified"}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* Security Section */}
            <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
              <div className="flex items-center gap-3 px-6 py-4 border-b border-slate-100 bg-slate-50/50">
                <div className="p-1.5 bg-red-50 border border-red-100 rounded-lg">
                  <Lock className="h-4 w-4 text-red-600" />
                </div>
                <div>
                  <h2 className="text-sm font-semibold text-slate-800">Security</h2>
                  <p className="text-xs text-slate-400">Manage your password</p>
                </div>
              </div>
              <div className="p-6">
                {!showPasswordChange ? (
                  <Button
                    variant="outline"
                    onClick={() => setShowPasswordChange(true)}
                    className="border-slate-200 text-slate-700 hover:bg-slate-50 hover:text-red-600 hover:border-red-100 transition-colors"
                  >
                    Change Password
                  </Button>
                ) : (
                  <form onSubmit={handleChangePassword} className="space-y-4 max-w-md">
                    <div className="space-y-2">
                      <Label htmlFor="currentPassword">Current Password</Label>
                      <div className="relative">
                        <Input
                          id="currentPassword"
                          type={showCurrentPassword ? "text" : "password"}
                          value={passwordData.currentPassword}
                          onChange={(e) => setPasswordData((s) => ({ ...s, currentPassword: e.target.value }))}
                          required
                          className="pr-10 border-slate-200"
                        />
                        <button
                          type="button"
                          onClick={() => setShowCurrentPassword(!showCurrentPassword)}
                          className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                        >
                          {showCurrentPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                        </button>
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="newPassword">New Password</Label>
                      <div className="relative">
                        <Input
                          id="newPassword"
                          type={showNewPassword ? "text" : "password"}
                          value={passwordData.newPassword}
                          onChange={(e) => setPasswordData((s) => ({ ...s, newPassword: e.target.value }))}
                          required
                          className="pr-10 border-slate-200"
                        />
                        <button
                          type="button"
                          onClick={() => setShowNewPassword(!showNewPassword)}
                          className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                        >
                          {showNewPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                        </button>
                      </div>
                      <p className="text-xs text-slate-500">Must be at least 6 characters long</p>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="confirmPassword">Confirm New Password</Label>
                      <Input
                        id="confirmPassword"
                        type="password"
                        value={passwordData.confirmPassword}
                        onChange={(e) => setPasswordData((s) => ({ ...s, confirmPassword: e.target.value }))}
                        required
                        className="border-slate-200"
                      />
                    </div>
                    <div className="flex gap-3 pt-2">
                      <Button
                        type="button"
                        variant="ghost"
                        onClick={() => {
                          setShowPasswordChange(false)
                          setPasswordData({ currentPassword: "", newPassword: "", confirmPassword: "" })
                        }}
                        className="text-slate-500 hover:text-slate-700"
                      >
                        Cancel
                      </Button>
                      <Button type="submit" className="bg-red-600 hover:bg-red-700 text-white">
                        Update Password
                      </Button>
                    </div>
                  </form>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}