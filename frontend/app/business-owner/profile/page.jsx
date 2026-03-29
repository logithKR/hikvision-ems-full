import { useEffect, useState } from "react"
import { useNavigate } from "react-router-dom"
import { useQuery } from "@tanstack/react-query"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
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
import { safeRedirect } from "@/lib/redirectUtils"
import { format } from "date-fns"

const getApiBase = () => import.meta.env.VITE_API_URL || "http://localhost:3000"

const fetchOrgDetails = async () => {
  const token = sessionStorage.getItem("firebaseToken")
  const base = getApiBase()
  const orgRes = await fetch(`${base}/api/admin/organization`, {
    headers: { Authorization: `Bearer ${token}` },
  })
  if (!orgRes.ok) throw new Error("Failed to load organization")
  return orgRes.json()
}

export default function BusinessOwnerProfilePage() {
  const navigate = useNavigate()

  const [currentUser, setCurrentUser] = useState(null)

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

  useEffect(() => {
    const current = sessionStorage.getItem("currentUser")
    if (!current) {
      safeRedirect(navigate, "/business-owner/login")
      return
    }
    const emp = JSON.parse(current)
    if (emp.role !== "business_owner") {
      alert("Unauthorized. Business Owner access required.")
      safeRedirect(navigate, "/role-selection")
      return
    }
    setCurrentUser(emp)
    setEditedProfile({
      name: emp.name || "",
      phone: emp.phone || "",
      department: emp.department || "",
      position: emp.position || "Business Owner",
    })
  }, [navigate])

  const { data: organization = null, isLoading: loading } = useQuery({
    queryKey: ['bo-organization'],
    queryFn: fetchOrgDetails,
    enabled: !!currentUser,
  })

  const handleSaveProfile = async () => {
    const token = sessionStorage.getItem("firebaseToken")
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
      position: currentUser.position || "Business Owner",
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

    const token = sessionStorage.getItem("firebaseToken")
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
    if (!name) return "BO"
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

  if (loading || !currentUser) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <RefreshCw className="h-8 w-8 animate-spin text-blue-600" />
      </div>
    )
  }

  return (
    <div className="space-y-6 animate-in fade-in-50 duration-500">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex items-center gap-4">
          <Avatar className="h-16 w-16 border-4 border-white shadow-sm">
            <AvatarFallback className="bg-blue-100 text-blue-600 text-xl font-bold">
              {getInitials(currentUser.name)}
            </AvatarFallback>
          </Avatar>
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-50">{currentUser.name}</h1>
            <p className="text-slate-500">{currentUser.email}</p>
            <Badge variant="outline" className="mt-2 bg-blue-50 text-blue-700 border-blue-200">
              <Shield className="mr-1 h-3 w-3" />
              Business Owner
            </Badge>
          </div>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => navigate("/business-owner/dashboard")}
          className="gap-2 border-blue-200 text-blue-600 hover:bg-blue-50 hover:text-blue-700"
        >
          <ArrowLeft className="h-4 w-4" />
          Dashboard
        </Button>
      </div>

      <div className="grid gap-6 md:grid-cols-3">
        {/* Left Column - Quick Info */}
        <Card className="border-slate-200 shadow-sm h-fit">
          <CardContent className="pt-6 space-y-4">
            <div className="space-y-3 text-sm">
              <div className="flex items-center gap-3 p-3 bg-slate-50 dark:bg-slate-800/50 rounded-lg">
                <div className="p-2 bg-slate-100 dark:bg-slate-800 rounded-lg">
                  <Calendar className="h-4 w-4 text-slate-600 dark:text-slate-400" />
                </div>
                <div>
                  <p className="text-xs text-slate-500">Member since</p>
                  <p className="font-medium text-slate-900 dark:text-slate-100">{formatDate(currentUser.createdAt)}</p>
                </div>
              </div>
              <div className="flex items-center gap-3 p-3 bg-slate-50 dark:bg-slate-800/50 rounded-lg">
                <div className="p-2 bg-blue-50 dark:bg-blue-900/30 rounded-lg">
                  <Building2 className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                </div>
                <div>
                  <p className="text-xs text-slate-500">Organization</p>
                  <p className="font-medium text-slate-900 dark:text-slate-100">{organization?.name || "Loading..."}</p>
                </div>
              </div>
              <div className="flex items-center gap-3 p-3 bg-slate-50 dark:bg-slate-800/50 rounded-lg">
                <div className="p-2 bg-emerald-50 dark:bg-emerald-900/30 rounded-lg">
                  <Users className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
                </div>
                <div>
                  <p className="text-xs text-slate-500">Team size</p>
                  <p className="font-medium text-slate-900 dark:text-slate-100">{organization?.employeeCount || 0} employees</p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Right Column */}
        <div className="md:col-span-2 space-y-6">
          {/* Profile Information */}
          <Card className="border-slate-200 shadow-sm overflow-hidden">
            <CardHeader className="flex flex-row items-center justify-between bg-slate-50/50 border-b border-slate-200">
              <div>
                <CardTitle className="flex items-center gap-2 text-base text-slate-800">
                  <User className="h-4 w-4 text-slate-500" />
                  Profile Information
                </CardTitle>
                <CardDescription>Update your personal details</CardDescription>
              </div>
              {!editMode ? (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setEditMode(true)}
                  className="bg-white border-blue-200 text-blue-600 hover:bg-blue-50"
                >
                  <Edit className="mr-2 h-4 w-4" />
                  Edit
                </Button>
              ) : (
                <div className="flex gap-2">
                  <Button variant="ghost" size="sm" onClick={handleCancelEdit} className="text-slate-600 hover:bg-slate-100">
                    <X className="mr-2 h-4 w-4" />
                    Cancel
                  </Button>
                  <Button size="sm" onClick={handleSaveProfile} className="bg-blue-600 hover:bg-blue-700 text-white shadow-sm">
                    <Save className="mr-2 h-4 w-4" />
                    Save
                  </Button>
                </div>
              )}
            </CardHeader>
            <CardContent className="pt-6 space-y-4">
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="name" className="text-slate-600">Full Name</Label>
                  {editMode ? (
                    <div className="relative">
                      <User className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                      <Input
                        id="name"
                        value={editedProfile.name}
                        onChange={(e) => setEditedProfile((s) => ({ ...s, name: e.target.value }))}
                        className="pl-10 border-slate-200 focus-visible:ring-blue-500"
                      />
                    </div>
                  ) : (
                    <div className="flex items-center gap-3 rounded-lg border border-slate-100 bg-slate-50/50 px-4 py-3">
                      <User className="h-4 w-4 text-slate-400" />
                      <span className="text-slate-700">{currentUser.name}</span>
                    </div>
                  )}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="email" className="text-slate-600">Email Address</Label>
                  <div className="flex items-center gap-3 rounded-lg border border-slate-100 bg-slate-100 dark:bg-slate-800 px-4 py-3">
                    <Mail className="h-4 w-4 text-slate-400" />
                    <span className="text-slate-500">{currentUser.email}</span>
                  </div>
                  <p className="text-xs text-slate-400">Email cannot be changed</p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="phone" className="text-slate-600">Phone Number</Label>
                  {editMode ? (
                    <div className="relative">
                      <Phone className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                      <Input
                        id="phone"
                        type="tel"
                        placeholder="Enter phone number"
                        value={editedProfile.phone}
                        onChange={(e) => setEditedProfile((s) => ({ ...s, phone: e.target.value }))}
                        className="pl-10 border-slate-200 focus-visible:ring-blue-500"
                      />
                    </div>
                  ) : (
                    <div className="flex items-center gap-3 rounded-lg border border-slate-100 bg-slate-50/50 px-4 py-3">
                      <Phone className="h-4 w-4 text-slate-400" />
                      <span className="text-slate-700">{currentUser.phone || "Not provided"}</span>
                    </div>
                  )}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="position" className="text-slate-600">Position</Label>
                  {editMode ? (
                    <div className="relative">
                      <Briefcase className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                      <Input
                        id="position"
                        placeholder="Your position"
                        value={editedProfile.position}
                        onChange={(e) => setEditedProfile((s) => ({ ...s, position: e.target.value }))}
                        className="pl-10 border-slate-200 focus-visible:ring-blue-500"
                      />
                    </div>
                  ) : (
                    <div className="flex items-center gap-3 rounded-lg border border-slate-100 bg-slate-50/50 px-4 py-3">
                      <Briefcase className="h-4 w-4 text-slate-400" />
                      <span className="text-slate-700">{currentUser.position || "Business Owner"}</span>
                    </div>
                  )}
                </div>

                <div className="space-y-2 md:col-span-2">
                  <Label htmlFor="department" className="text-slate-600">Department</Label>
                  {editMode ? (
                    <div className="relative">
                      <Building2 className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                      <Input
                        id="department"
                        placeholder="Department"
                        value={editedProfile.department}
                        onChange={(e) => setEditedProfile((s) => ({ ...s, department: e.target.value }))}
                        className="pl-10 border-slate-200 focus-visible:ring-blue-500"
                      />
                    </div>
                  ) : (
                    <div className="flex items-center gap-3 rounded-lg border border-slate-100 bg-slate-50/50 px-4 py-3">
                      <Building2 className="h-4 w-4 text-slate-400" />
                      <span className="text-slate-700">{currentUser.department || "Not specified"}</span>
                    </div>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Organization Details */}
          {organization && (
            <Card className="border-slate-200 shadow-sm overflow-hidden">
              <CardHeader className="bg-slate-50/50 border-b border-slate-200">
                <CardTitle className="flex items-center gap-2 text-base text-slate-800">
                  <Building2 className="h-4 w-4 text-slate-500" />
                  Organization Details
                </CardTitle>
                <CardDescription>Information about your organization</CardDescription>
              </CardHeader>
              <CardContent className="pt-6">
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="flex items-center justify-between p-3 bg-slate-50 dark:bg-slate-800/50 rounded-lg">
                    <span className="text-sm text-slate-500">Organization Name</span>
                    <span className="font-medium text-slate-900">{organization.name}</span>
                  </div>
                  <div className="flex items-center justify-between p-3 bg-slate-50 dark:bg-slate-800/50 rounded-lg">
                    <span className="text-sm text-slate-500">Status</span>
                    <Badge className={organization.isActive ? "bg-emerald-100 text-emerald-700 hover:bg-emerald-100 dark:bg-emerald-900/30 dark:text-emerald-400" : "bg-blue-100 text-blue-700"}>
                      {organization.isActive ? "Active" : "Pending"}
                    </Badge>
                  </div>
                  <div className="flex items-center justify-between p-3 bg-slate-50 dark:bg-slate-800/50 rounded-lg">
                    <span className="text-sm text-slate-500">Total Admins</span>
                    <Badge className="bg-blue-100 text-blue-700 hover:bg-blue-100 dark:bg-blue-900/30 dark:text-blue-400 border-0">
                      {organization.adminCount}
                    </Badge>
                  </div>
                  <div className="flex items-center justify-between p-3 bg-slate-50 dark:bg-slate-800/50 rounded-lg">
                    <span className="text-sm text-slate-500">Total Employees</span>
                    <Badge className="bg-slate-200 text-slate-700 hover:bg-slate-200 dark:bg-slate-700 dark:text-slate-300 border-0">
                      {organization.employeeCount}
                    </Badge>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Security Section */}
          <Card className="border-slate-200 shadow-sm overflow-hidden">
            <CardHeader className="bg-slate-50/50 border-b border-slate-200">
              <CardTitle className="flex items-center gap-2 text-base text-slate-800">
                <Lock className="h-4 w-4 text-slate-500" />
                Security
              </CardTitle>
              <CardDescription>Manage your password and security settings</CardDescription>
            </CardHeader>
            <CardContent className="pt-6">
              {!showPasswordChange ? (
                <Button
                  variant="outline"
                  onClick={() => setShowPasswordChange(true)}
                  className="border-blue-200 text-blue-600 hover:bg-blue-50"
                >
                  <Lock className="mr-2 h-4 w-4 text-blue-600" />
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
                        className="pr-10 border-slate-200 focus-visible:ring-blue-500"
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
                        className="pr-10 border-slate-200 focus-visible:ring-blue-500"
                      />
                      <button
                        type="button"
                        onClick={() => setShowNewPassword(!showNewPassword)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                      >
                        {showNewPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </button>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="confirmPassword">Confirm New Password</Label>
                    <Input
                      id="confirmPassword"
                      type="password"
                      value={passwordData.confirmPassword}
                      onChange={(e) => setPasswordData((s) => ({ ...s, confirmPassword: e.target.value }))}
                      required
                      className="border-slate-200 focus-visible:ring-blue-500"
                    />
                  </div>
                  <div className="flex gap-2 pt-2">
                    <Button
                      type="button"
                      variant="ghost"
                      onClick={() => {
                        setShowPasswordChange(false)
                        setPasswordData({ currentPassword: "", newPassword: "", confirmPassword: "" })
                      }}
                      className="text-slate-600 hover:bg-slate-100"
                    >
                      Cancel
                    </Button>
                    <Button type="submit" className="bg-blue-600 hover:bg-blue-700 text-white shadow-sm">
                      Update Password
                    </Button>
                  </div>
                </form>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
