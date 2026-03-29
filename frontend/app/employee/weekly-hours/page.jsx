import { useEffect, useState, useMemo } from "react"
import { useNavigate } from "react-router-dom"
import { useQuery, useQueryClient } from "@tanstack/react-query"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts"
import { Calendar, RefreshCw } from "lucide-react"
import { safeRedirect } from "@/lib/redirectUtils"
import { getValidIdToken } from "@/lib/firebaseClient"

const fetchWeeklyHours = async () => {
  const token = await getValidIdToken()
  if (!token) throw new Error("Not authenticated")
  const response = await fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:3000'}/api/attendance/weekly-hours`, {
    headers: { 'Authorization': `Bearer ${token}` }
  })
  if (response.status === 401) throw new Error("SESSION_EXPIRED")
  if (!response.ok) throw new Error(`Failed: ${response.status}`)
  return response.json()
}

export default function WeeklyHoursPage() {
  const navigate = useNavigate()
  const queryClient = useQueryClient()

  useEffect(() => {
    if (!sessionStorage.getItem("employeeLoggedIn")) {
      safeRedirect(navigate, "/employee/login")
    }
  }, [navigate])

  const { data, isLoading: loading, error: queryError } = useQuery({
    queryKey: ['emp-weekly-hours'],
    queryFn: fetchWeeklyHours,
  })

  const weeklyData = data?.weekly || []
  const totals = useMemo(() => ({
    total: data?.stats?.totalHours || 0,
    longest: data?.stats?.longestDay || 0,
    average: data?.stats?.averagePerDay || 0
  }), [data])

  if (queryError?.message === "SESSION_EXPIRED") {
    sessionStorage.removeItem("employeeLoggedIn")
    sessionStorage.removeItem("firebaseToken")
    safeRedirect(navigate, "/employee/login")
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <RefreshCw className="h-8 w-8 animate-spin text-blue-600" />
      </div>
    )
  }

  return (
    <div className="space-y-6 animate-in fade-in-50 duration-500">
      <div className="mb-8">
        <h2 className="text-2xl sm:text-3xl font-bold text-foreground">Weekly Hours</h2>
        <p className="text-muted-foreground mt-1">Track your working hours throughout the week</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Calendar className="w-5 h-5" />
            This Week's Hours
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-60 sm:h-80">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={weeklyData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="day" />
                <YAxis />
                <Tooltip />
                <Bar dataKey="hours" fill="#3b82f6" />
              </BarChart>
            </ResponsiveContainer>
          </div>
          <div className="mt-8 grid grid-cols-1 md:grid-cols-3 gap-4">
            <Card>
              <CardContent className="pt-6 text-center">
                <p className="text-2xl font-bold text-foreground">{totals.total}</p>
                <p className="text-sm text-muted-foreground">Total Hours</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6 text-center">
                <p className="text-2xl font-bold text-foreground">{totals.longest}</p>
                <p className="text-sm text-muted-foreground">Longest Day</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6 text-center">
                <p className="text-2xl font-bold text-foreground">{totals.average}</p>
                <p className="text-sm text-muted-foreground">Average/Day</p>
              </CardContent>
            </Card>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
