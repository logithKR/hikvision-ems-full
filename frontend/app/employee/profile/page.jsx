import { useEffect, useState } from "react"
import { useNavigate } from "react-router-dom"
import { useQueryClient } from "@tanstack/react-query"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
  User, Mail, Building, Calendar,
  Save, Loader2, UserCog
} from "lucide-react"
import { format } from "date-fns"
import { safeRedirect } from "@/lib/redirectUtils"
import { isAuthenticated } from "@/lib/auth"
import { getValidIdToken } from "@/lib/firebaseClient"

export default function EmployeeProfilePage() {
  const navigate = useNavigate()
  // eslint-disable-next-line no-unused-vars
  const queryClient = useQueryClient()
  // eslint-disable-next-line no-unused-vars
  const [currentUser, setCurrentUser] = useState(null)
  const [saving, setSaving] = useState(false)
  const [activeTab, setActiveTab] = useState("details")
  const [loading, setLoading] = useState(true)

  // Profile Data
  const [profileData, setProfileData] = useState({
    name: "",
    email: "",
    phone: "",
    address: "",
    position: "",
    department: "",
    hireDate: "",
    salary: "",
    managerName: "",
    managerEmail: ""
  })

  // Password Change
  const [passData, setPassData] = useState({
    currentPassword: "",
    newPassword: "",
    confirmPassword: ""
  })

  useEffect(() => {
    if (!isAuthenticated()) {
      safeRedirect(navigate, "/employee/login")
      return
    }
    loadProfile()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const getApiBase = () => {
    const url = import.meta.env.VITE_API_URL || ''
    return url.endsWith('/api') ? url : `${url}/api`
  }

  const loadProfile = async () => {
    setLoading(true)
    const token = await getValidIdToken()
    if (!token) return

    try {
      // Get expanded profile info
      const response = await fetch(`${getApiBase()}/auth/profile`, {
        headers: { 'Authorization': `Bearer ${token}` }
      })

      if (response.ok) {
        const data = await response.json()
        const user = data.user || {}
        setCurrentUser(user)
        setProfileData({
          name: user.name || "",
          email: user.email || "",
          phone: user.phone || "",
          address: user.address || "",
          position: user.position || "Employee",
          department: user.department || "General",
          hireDate: user.createdAt || "",
          salary: user.salary ? `₹${user.salary.toLocaleString()}` : "Not specified",
          managerName: user.managerName || "",
          managerEmail: user.managerEmail || ""
        })
      }
    } catch (error) {
      console.error('Error loading profile:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleProfileUpdate = async (e) => {
    e.preventDefault()
    setSaving(true)
    const token = await getValidIdToken()

    try {
      const response = await fetch(`${getApiBase()}/auth/profile`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          phone: profileData.phone,
          address: profileData.address,
          // Employees typically can't change their own Name/Email/Position without HR approval
          // So we restrict edits to contact info
        })
      })

      if (response.ok) {
        const data = await response.json()
        const updatedEmployee = data.employee || {}

        // Update local state directly instead of full reload
        setProfileData(prev => ({
          ...prev,
          phone: updatedEmployee.phone || prev.phone,
          address: updatedEmployee.address || prev.address
        }))

        // Also update sessionStorage for persistence across navigation
        const storedUser = JSON.parse(sessionStorage.getItem('currentUser') || '{}')
        sessionStorage.setItem('currentUser', JSON.stringify({
          ...storedUser,
          phone: updatedEmployee.phone,
          address: updatedEmployee.address
        }))

        alert('Profile updated successfully')
      } else {
        const err = await response.json()
        alert(`Failed to update: ${err.error}`)
      }
    } catch (error) {
      console.error('Update error:', error)
      alert('Network error')
    } finally {
      setSaving(false)
    }
  }

  const handlePasswordChange = async (e) => {
    e.preventDefault()
    if (passData.newPassword !== passData.confirmPassword) {
      alert("New passwords do not match")
      return
    }

    if (passData.newPassword.length < 6) {
      alert("Password must be at least 6 characters")
      return
    }

    setSaving(true)
    const token = await getValidIdToken()

    try {
      const response = await fetch(`${getApiBase()}/auth/change-password`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          oldPassword: passData.currentPassword,
          newPassword: passData.newPassword
        })
      })

      if (response.ok) {
        alert('Password changed successfully')
        setPassData({ currentPassword: "", newPassword: "", confirmPassword: "" })
      } else {
        const err = await response.json()
        alert(`Failed to change password: ${err.error}`)
      }
    } catch (error) {
      console.error('Password error:', error)
      alert('Network error')
    } finally {
      setSaving(false)
    }
  }

  const getInitials = (name) => {
    if (!name) return "EM"
    return name.split(" ").map(n => n[0]).join("").toUpperCase().slice(0, 2)
  }

  if (loading) {
    return <div className="min-h-screen flex items-center justify-center bg-slate-50">
      <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
    </div>
  }

  return (
    <div className="space-y-6 animate-in fade-in-50 duration-500">
      <div className="flex flex-col md:flex-row gap-6 items-start">
        {/* Sidebar / User Card */}
        <Card className="w-full md:w-80 shadow-sm border-slate-200 shrink-0">
          <CardContent className="pt-6 flex flex-col items-center">
            <Avatar className="h-24 w-24 sm:h-32 sm:w-32 border-4 border-blue-50 mb-4 shadow-sm">
              <AvatarFallback className="bg-blue-600 text-white text-3xl font-bold">
                {getInitials(profileData.name)}
              </AvatarFallback>
            </Avatar>
            <h2 className="text-xl sm:text-2xl font-bold text-center text-slate-900">{profileData.name}</h2>
            <p className="text-slate-500 text-center mb-4 font-medium">{profileData.position}</p>

            <div className="w-full space-y-3 mt-4 pt-4 border-t border-slate-100">
              <div className="flex items-center gap-3 text-sm">
                <div className="p-2 bg-blue-50 rounded-lg text-blue-600">
                  <Mail className="h-4 w-4" />
                </div>
                <span className="truncate text-slate-700">{profileData.email}</span>
              </div>
              <div className="flex items-center gap-3 text-sm">
                <div className="p-2 bg-blue-50 rounded-lg text-blue-600">
                  <Building className="h-4 w-4" />
                </div>
                <span className="text-slate-700">{profileData.department}</span>
              </div>
              <div className="flex items-center gap-3 text-sm">
                <div className="p-2 bg-blue-50 rounded-lg text-blue-600">
                  <Calendar className="h-4 w-4" />
                </div>
                <span className="text-slate-700">Joined {profileData.hireDate && !isNaN(new Date(profileData.hireDate).getTime()) ? format(new Date(profileData.hireDate), "MMM yyyy") : "N/A"}</span>
              </div>
              {profileData.managerName && (
                <div className="flex flex-col space-y-2 mt-4 pt-4 border-t border-slate-100">
                  <div className="flex items-center gap-3 text-sm">
                    <div className="p-2 bg-blue-50 rounded-lg text-blue-600">
                      <UserCog className="h-4 w-4" />
                    </div>
                    <span className="text-slate-700">Manager: <strong>{profileData.managerName}</strong></span>
                  </div>
                  {profileData.managerEmail && (
                    <div className="flex items-center gap-3 text-sm ml-1">
                      <div className="w-8 flex justify-center">
                        <Mail className="h-3.5 w-3.5 text-slate-400" />
                      </div>
                      <span className="text-xs text-slate-500 truncate">{profileData.managerEmail}</span>
                    </div>
                  )}
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Main Content Area */}
        <div className="flex-1 w-full space-y-6">
          <div className="flex items-center justify-between">
            <h1 className="text-2xl font-bold text-slate-900">My Profile</h1>
          </div>

          <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
            <TabsList className="grid w-full grid-cols-2 mb-6 bg-slate-100 p-1">
              <TabsTrigger
                value="details"
                className="data-[state=active]:bg-white data-[state=active]:text-blue-700 data-[state=active]:shadow-sm"
              >
                Personal Details
              </TabsTrigger>
              <TabsTrigger
                value="security"
                className="data-[state=active]:bg-white data-[state=active]:text-blue-700 data-[state=active]:shadow-sm"
              >
                Security
              </TabsTrigger>
            </TabsList>

            <TabsContent value="details">
              <Card className="border-slate-200 shadow-sm">
                <CardHeader>
                  <CardTitle className="text-lg font-bold text-slate-900">Personal Information</CardTitle>
                  <CardDescription>
                    Manage your contact information. Some fields are read-only.
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <form onSubmit={handleProfileUpdate} className="space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label>Full Name (Read-Only)</Label>
                        <div className="flex items-center px-3 py-2 border border-slate-200 rounded-md bg-slate-50 text-slate-500">
                          <User className="h-4 w-4 mr-2" />
                          {profileData.name}
                        </div>
                      </div>
                      <div className="space-y-2">
                        <Label>Email (Read-Only)</Label>
                        <div className="flex items-center px-3 py-2 border border-slate-200 rounded-md bg-slate-50 text-slate-500">
                          <Mail className="h-4 w-4 mr-2" />
                          {profileData.email}
                        </div>
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="phone">Phone Number</Label>
                        <Input
                          id="phone"
                          value={profileData.phone}
                          onChange={(e) => setProfileData({ ...profileData, phone: e.target.value })}
                          placeholder="Enter phone number"
                          className="border-slate-200 focus:border-blue-500 focus:ring-blue-500"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="address">Address</Label>
                        <Input
                          id="address"
                          value={profileData.address}
                          onChange={(e) => setProfileData({ ...profileData, address: e.target.value })}
                          placeholder="Enter your address"
                          className="border-slate-200 focus:border-blue-500 focus:ring-blue-500"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>Department</Label>
                        <div className="flex items-center px-3 py-2 border border-slate-200 rounded-md bg-slate-50 text-slate-500">
                          <Building className="h-4 w-4 mr-2" />
                          {profileData.department}
                        </div>
                      </div>
                      <div className="space-y-2">
                        <Label>Designation</Label>
                        <div className="flex items-center px-3 py-2 border border-slate-200 rounded-md bg-slate-50 text-slate-500">
                          <Building className="h-4 w-4 mr-2" />
                          {profileData.position}
                        </div>
                      </div>
                      {profileData.managerName && (
                        <div className="space-y-4 md:col-span-2">
                          <Label>Reporting Manager</Label>
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <div className="flex items-center px-3 py-2 border border-slate-200 rounded-md bg-slate-50 text-slate-500">
                              <UserCog className="h-4 w-4 mr-2" />
                              <span className="truncate">{profileData.managerName}</span>
                            </div>
                            {profileData.managerEmail && (
                              <div className="flex items-center px-3 py-2 border border-slate-200 rounded-md bg-slate-50 text-slate-500">
                                <Mail className="h-4 w-4 mr-2" />
                                <span className="truncate">{profileData.managerEmail}</span>
                              </div>
                            )}
                          </div>
                        </div>
                      )}
                    </div>

                    <div className="flex justify-end pt-4">
                      <Button type="submit" disabled={saving} className="bg-blue-600 hover:bg-blue-700 text-white shadow-sm">
                        {saving ? (
                          <>
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                            Saving...
                          </>
                        ) : (
                          <>
                            <Save className="mr-2 h-4 w-4" />
                            Save Changes
                          </>
                        )}
                      </Button>
                    </div>
                  </form>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="security">
              <Card className="border-slate-200 shadow-sm">
                <CardHeader>
                  <CardTitle className="text-lg font-bold text-slate-900">Security Settings</CardTitle>
                  <CardDescription>
                    Update your password and manage account security
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <form onSubmit={handlePasswordChange} className="space-y-4 max-w-md">
                    <div className="space-y-2">
                      <Label htmlFor="currentPassword">Current Password</Label>
                      <Input
                        id="currentPassword"
                        type="password"
                        value={passData.currentPassword}
                        onChange={(e) => setPassData({ ...passData, currentPassword: e.target.value })}
                        required
                        className="border-slate-200 focus:border-blue-500"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="newPassword">New Password</Label>
                      <Input
                        id="newPassword"
                        type="password"
                        value={passData.newPassword}
                        onChange={(e) => setPassData({ ...passData, newPassword: e.target.value })}
                        required
                        className="border-slate-200 focus:border-blue-500"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="confirmPassword">Confirm New Password</Label>
                      <Input
                        id="confirmPassword"
                        type="password"
                        value={passData.confirmPassword}
                        onChange={(e) => setPassData({ ...passData, confirmPassword: e.target.value })}
                        required
                        className="border-slate-200 focus:border-blue-500"
                      />
                    </div>

                    <div className="pt-4">
                      <Button type="submit" disabled={saving} variant="destructive" className="bg-red-600 hover:bg-red-700 shadow-sm">
                        {saving ? "Updating..." : "Update Password"}
                      </Button>
                    </div>
                  </form>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </div>
  )
}