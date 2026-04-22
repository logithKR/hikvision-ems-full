import { useEffect, useState, useMemo } from "react"
import { useNavigate } from "react-router-dom"
import { useQuery, useQueryClient } from "@tanstack/react-query"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import {
    User, Mail, Phone, Shield, Building2, Calendar,
    RefreshCw, Briefcase, Hash, Clock
} from "lucide-react"
import { getCurrentUser, isAuthenticated } from "@/lib/auth"
import { getValidIdToken } from "@/lib/firebaseClient"

export default function SystemAdminProfilePage() {
    const navigate = useNavigate()
    const queryClient = useQueryClient()
    const [currentUser, setCurrentUser] = useState(null)
    const [profileData, setProfileData] = useState(null)
    const [loading, setLoading] = useState(true)

    useEffect(() => {
        if (!isAuthenticated()) {
            navigate("/system-admin/login")
            return
        }

        const user = getCurrentUser()
        if (!user || user.role !== "system_admin") {
            alert("Unauthorized. System Admin access required.")
            navigate("/system-admin/login")
            return
        }

        setCurrentUser(user)
        loadProfile()
    }, [navigate])

    const getApiBase = () => {
        const url = import.meta.env.VITE_API_URL || ""
        return url.endsWith('/api') ? url : `${url}/api`
    }

    const loadProfile = async () => {
        setLoading(true)
        const token = await getValidIdToken()
        const base = getApiBase()

        try {
            const response = await fetch(`${base}/auth/profile`, {
                headers: { Authorization: `Bearer ${token}` }
            })

            if (response.ok) {
                const data = await response.json()
                const user = data.user || data.data || data
                setProfileData(user)
            } else {
                // Fallback to currentUser data
                const user = getCurrentUser()
                setProfileData(user)
            }
        } catch (error) {
            console.error("Failed to load profile:", error)
            const user = getCurrentUser()
            setProfileData(user)
        } finally {
            setLoading(false)
        }
    }

    const getInitials = (name) => {
        if (!name) return "SA"
        return name
            .split(" ")
            .map((n) => n[0])
            .join("")
            .toUpperCase()
            .slice(0, 2)
    }

    const formatDate = (dateString) => {
        if (!dateString) return "N/A"
        try {
            return new Date(dateString).toLocaleDateString("en-US", {
                year: "numeric",
                month: "long",
                day: "numeric"
            })
        } catch {
            return dateString
        }
    }

    // Profile info item component
    const ProfileItem = ({ icon: Icon, label, value, iconColor = "text-blue-500" }) => (
        <div className="flex items-start gap-3 py-2">
            <div className={`mt-0.5 ${iconColor}`}>
                <Icon className="h-5 w-5" />
            </div>
            <div className="flex-1 min-w-0">
                <p className="text-sm text-muted-foreground">{label}</p>
                <p className="font-medium text-slate-900 dark:text-slate-100 break-words">
                    {value || "Not available"}
                </p>
            </div>
        </div>
    )

    if (loading) {
        return (
            <div className="flex items-center justify-center min-h-[400px]">
                <div className="text-center">
                    <RefreshCw className="h-8 w-8 animate-spin mx-auto mb-2 text-blue-500" />
                    <p className="text-muted-foreground">Loading profile...</p>
                </div>
            </div>
        )
    }

    return (
        <div className="space-y-6">
            {/* Header */}
            <div>
                <h1 className="text-2xl md:text-3xl font-bold text-slate-900 dark:text-slate-100">
                    My Profile
                </h1>
                <p className="text-muted-foreground mt-1">
                    View your account information
                </p>
            </div>

            {/* Profile Card */}
            <Card className="overflow-hidden">
                {/* Header with gradient */}
                <div className="h-32 bg-gradient-to-r from-blue-500 to-blue-500 relative">
                    <div className="absolute -bottom-16 left-6">
                        <Avatar className="h-32 w-32 border-4 border-white shadow-lg">
                            <AvatarFallback className="bg-blue-100 text-blue-700 text-3xl font-bold">
                                {getInitials(profileData?.name)}
                            </AvatarFallback>
                        </Avatar>
                    </div>
                </div>

                <CardContent className="pt-20 pb-6">
                    <div className="flex flex-col gap-2">
                        <h2 className="text-2xl font-bold text-slate-900 dark:text-slate-100">
                            {profileData?.name || "System Admin"}
                        </h2>
                        <div className="flex flex-wrap items-center gap-2">
                            <Badge className="bg-gradient-to-r from-blue-500 to-blue-500">
                                <Shield className="h-3 w-3 mr-1" />
                                System Admin
                            </Badge>
                            {profileData?.isActive !== false && (
                                <Badge variant="outline" className="border-green-500 text-green-600">
                                    Active
                                </Badge>
                            )}
                        </div>
                    </div>
                </CardContent>
            </Card>

            {/* Profile Details Grid */}
            <div className="grid gap-6 md:grid-cols-2">
                {/* Personal Information */}
                <Card>
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                            <User className="h-5 w-5 text-blue-500" />
                            Personal Information
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-1">
                        <ProfileItem
                            icon={User}
                            label="Full Name"
                            value={profileData?.name}
                        />
                        <Separator />
                        <ProfileItem
                            icon={Mail}
                            label="Email Address"
                            value={profileData?.email}
                        />
                        <Separator />
                        <ProfileItem
                            icon={Phone}
                            label="Phone Number"
                            value={profileData?.phone}
                        />
                    </CardContent>
                </Card>

                {/* Account Information */}
                <Card>
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                            <Shield className="h-5 w-5 text-blue-500" />
                            Account Information
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-1">
                        <ProfileItem
                            icon={Hash}
                            label="User ID"
                            value={profileData?.id || currentUser?.uid}
                        />
                        <Separator />
                        <ProfileItem
                            icon={Shield}
                            label="Role"
                            value={
                                <Badge className="bg-blue-100 text-blue-700 dark:bg-blue-950/30 dark:text-blue-400">
                                    {profileData?.role?.replace("_", " ").toUpperCase() || "SYSTEM ADMIN"}
                                </Badge>
                            }
                        />
                        <Separator />
                        <ProfileItem
                            icon={Briefcase}
                            label="Department"
                            value={profileData?.department || "System Administration"}
                        />
                    </CardContent>
                </Card>
            </div>

            {/* Additional Info Note */}
            <Card className="border-blue-200 bg-blue-50/50 dark:bg-blue-950/10 dark:border-blue-800">
                <CardContent className="py-4">
                    <div className="flex items-start gap-3">
                        <Shield className="h-5 w-5 text-blue-500 mt-0.5" />
                        <div>
                            <p className="font-medium text-blue-800 dark:text-blue-300">
                                System Admin Account
                            </p>
                            <p className="text-sm text-blue-600 dark:text-blue-400">
                                As a system admin, your profile is managed at the system level.
                                Changes made here affect your global system access.
                            </p>
                        </div>
                    </div>
                </CardContent>
            </Card>
        </div>
    )
}
