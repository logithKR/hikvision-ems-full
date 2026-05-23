import { useEffect, useState, useCallback } from "react"
import { useNavigate } from "react-router-dom"
import { useQuery, useQueryClient } from "@tanstack/react-query"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import {
  Clock, Calendar, CheckCircle, Coffee, LogOut,
  AlertCircle, RefreshCw, MapPin
} from "lucide-react"
import { format } from "date-fns"
import { safeRedirect } from "@/lib/redirectUtils"
import { getValidIdToken } from "@/lib/firebaseClient"
import { toast } from "sonner"

const getApiBase = () => {
  const url = import.meta.env.VITE_API_URL || ''
  // Ensure we always have /api suffix
  return url.endsWith('/api') ? url : `${url}/api`
}

const fetchAttendanceData = async () => {
  const token = await getValidIdToken()
  if (!token) throw new Error("Not authenticated")
  const base = getApiBase()

  const [historyRes, todayRes] = await Promise.all([
    fetch(`${base}/attendance/my-records`, { headers: { 'Authorization': `Bearer ${token}` } }),
    fetch(`${base}/attendance/today`, { headers: { 'Authorization': `Bearer ${token}` } })
  ])

  const result = {}

  if (historyRes.ok) {
    const data = await historyRes.json()
    result.records = processRecords(data)
  } else {
    result.records = []
  }

  if (todayRes.ok) {
    result.today = await todayRes.json()
  }

  return result
}

// Helper to process/clean records (fix NaN hours etc)
const processRecords = (data) => {
  if (!Array.isArray(data)) return []
  return data.map(r => {
    if (r.totalHours && String(r.totalHours).includes('NaN')) {
      return { ...r, totalHours: 'Pending' }
    }
    return r
  })
}

/**
 * Multi-strategy location acquisition with automatic fallbacks.
 * 
 * Strategy order:
 *   1. GPS (high accuracy, enableHighAccuracy: true) — most precise (~5-15m)
 *   2. Network/WiFi (low accuracy fallback) — moderate precision (~20-100m)
 *   3. IP Geolocation API — coarse fallback (~1-50km)
 * 
 * Also handles permission prompts and provides source info.
 * 
 * @param {Function} onStatusUpdate - callback for real-time status updates
 * @returns {Promise<{lat, lng, accuracy, source, timestamp} | null>}
 */
const getAccurateLocation = async (onStatusUpdate) => {
  const updateStatus = (msg) => {
    console.log(`📍 Location: ${msg}`)
    if (onStatusUpdate) onStatusUpdate(msg)
  }

  // Check if Geolocation API is available
  if (!navigator.geolocation) {
    updateStatus('Geolocation not supported, trying IP fallback...')
    return await getIPLocation(updateStatus)
  }

  // Step 1: Check and request permission
  if (navigator.permissions) {
    try {
      const permission = await navigator.permissions.query({ name: 'geolocation' })
      if (permission.state === 'denied') {
        updateStatus('Location permission denied. Please enable location in browser settings.')
        return await getIPLocation(updateStatus)
      }
      if (permission.state === 'prompt') {
        updateStatus('Requesting location permission...')
      }
    } catch (e) {
      // permissions API not supported, proceed anyway
    }
  }

  // Step 2: Try GPS (high accuracy)
  updateStatus('Acquiring GPS location...')
  const gpsResult = await getPositionWithOptions({
    enableHighAccuracy: true,
    timeout: 5000,
    maximumAge: 0
  })

  if (gpsResult) {
    updateStatus(`GPS location acquired (±${Math.round(gpsResult.accuracy)}m)`)
    return { ...gpsResult, source: 'gps' }
  }

  // Step 3: Fallback to network/WiFi (low accuracy)
  updateStatus('GPS unavailable, trying network location...')
  const networkResult = await getPositionWithOptions({
    enableHighAccuracy: false,
    timeout: 4000,
    maximumAge: 60000 // accept cached position up to 1 min old
  })

  if (networkResult) {
    updateStatus(`Network location acquired (±${Math.round(networkResult.accuracy)}m)`)
    return { ...networkResult, source: 'network' }
  }

  // Step 4: Final fallback — IP-based geolocation
  updateStatus('Network location unavailable, trying IP geolocation...')
  return await getIPLocation(updateStatus)
}

/**
 * Get position using the Geolocation API with specified options.
 * @returns {Promise<{lat, lng, accuracy, timestamp} | null>}
 */
const getPositionWithOptions = (options) => {
  return new Promise((resolve) => {
    navigator.geolocation.getCurrentPosition(
      (position) => {
        resolve({
          lat: position.coords.latitude,
          lng: position.coords.longitude,
          accuracy: position.coords.accuracy,
          timestamp: position.timestamp
        })
      },
      (err) => {
        console.warn(`Geolocation error (highAccuracy=${options.enableHighAccuracy}):`, err.message)
        resolve(null)
      },
      options
    )
  })
}

/**
 * IP-based geolocation fallback using free API.
 * Returns approximate location based on IP address (~city level accuracy).
 * @returns {Promise<{lat, lng, accuracy, source, timestamp} | null>}
 */
const getIPLocation = async (updateStatus) => {
  try {
    // Try ipapi.co (free, no API key needed, 1000 req/day)
    const response = await fetch('https://ipapi.co/json/', {
      signal: AbortSignal.timeout(5000)
    })
    if (response.ok) {
      const data = await response.json()
      if (data.latitude && data.longitude) {
        const result = {
          lat: data.latitude,
          lng: data.longitude,
          accuracy: 5000, // ~5km city-level accuracy
          source: 'ip',
          timestamp: Date.now(),
          city: data.city,
          region: data.region
        }
        if (updateStatus) updateStatus(`IP location acquired (${data.city || 'approximate'})`)
        return result
      }
    }
  } catch (e) {
    console.warn('IP geolocation failed:', e.message)
  }

  if (updateStatus) updateStatus('All location methods failed')
  return null
}

export default function EmployeeAttendancePage() {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [actionLoading, setActionLoading] = useState(false)
  const [locationStatus, setLocationStatus] = useState('') // '', 'fetching', 'success', 'error'
  const [locationMessage, setLocationMessage] = useState('') // real-time progress message
  const [locationSource, setLocationSource] = useState('') // 'gps', 'network', 'ip'
  const [locationError, setLocationError] = useState(null)

  useEffect(() => {
    if (!sessionStorage.getItem("currentUser")) {
      safeRedirect(navigate, "/login")
    }
  }, [])

  const { data, isLoading: loading, isFetching } = useQuery({
    queryKey: ['emp-attendance'],
    queryFn: fetchAttendanceData,
  })

  const attendanceRecords = data?.records || []
  const todayRecord = data?.today || null

  const handleAction = useCallback(async (action) => {
    setActionLoading(true)
    setLocationStatus('fetching')
    setLocationMessage('Initializing location...')
    setLocationSource('')
    setLocationError(null)

    try {
      let freshLocation = null

      // Only fetch location for Check In and Check Out
      if (action === 'checkIn' || action === 'checkOut') {
        // Get location with real-time status updates
        freshLocation = await getAccurateLocation((statusMsg) => {
          setLocationMessage(statusMsg)
        })

        if (!freshLocation) {
          setLocationStatus('error')
          setLocationError('Could not get location via any method. The action will proceed without location data.')
        } else {
          setLocationStatus('success')
          setLocationSource(freshLocation.source || 'unknown')
        }
      } else {
        // For Break actions, just show a loading state without location
        setLocationMessage('Processing...')
      }

      const token = await getValidIdToken()
      if (!token) {
        setActionLoading(false)
        return
      }

      const base = getApiBase()
      const response = await fetch(`${base}/attendance/record`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          action,
          location: freshLocation
        })
      })

      if (response.ok) {
        queryClient.invalidateQueries({ queryKey: ['emp-attendance'] })
        queryClient.invalidateQueries({ queryKey: ['emp-dashboard'] })
        // Keep success status visible for 3 seconds
        setTimeout(() => {
          setLocationStatus('')
          setLocationMessage('')
          setLocationSource('')
          setLocationError(null)
        }, 3000)
      } else {
        const err = await response.json()
        toast.error(`Failed to ${action}: ${err.error}`)
      }
    } catch (error) {
      console.error('Action error:', error)
      toast.error('Network error')
    } finally {
      setActionLoading(false)
    }
  }, [queryClient])

  const isWorking = todayRecord?.checkIn && !todayRecord?.checkOut
  const isOnBreak = todayRecord?.breakIn && !todayRecord?.breakOut

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <RefreshCw className="h-8 w-8 animate-spin text-blue-600" />
      </div>
    )
  }

  return (
    <div className="space-y-6 animate-in fade-in-50 duration-500">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-slate-900 dark:text-slate-100">
            My Attendance
          </h1>
          <p className="text-muted-foreground mt-1">
            Track your work hours and history
          </p>
        </div>
        <div className="flex items-center gap-2 px-4 py-2 bg-slate-100 dark:bg-slate-800 rounded-lg">
          <Calendar className="h-5 w-5 text-blue-600" />
          <span className="font-medium">{format(new Date(), "MMMM yyyy")}</span>
        </div>
      </div>

      {/* Today's Status Card */}
      <Card className="border-t-4 border-t-blue-500 shadow-sm">
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg flex items-center gap-2">
              <Clock className="h-5 w-5 text-blue-600" />
              Today's Status
            </CardTitle>
            <Badge variant={isWorking ? "default" : "secondary"} className={isWorking ? "bg-blue-600" : "bg-slate-200 text-slate-700"}>
              {todayRecord?.checkOut ? "Completed" : isWorking ? (isOnBreak ? "On Break" : "Checked In") : "Not Started"}
            </Badge>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 py-4">
            {/* Timeline Items */}
            <div className="flex flex-col gap-1 p-3 rounded-lg bg-slate-50 dark:bg-slate-900/50">
              <span className="text-xs text-muted-foreground uppercase tracking-wider font-semibold">Check In</span>
              <div className="flex items-center gap-2">
                <CheckCircle className={`h-4 w-4 ${todayRecord?.checkIn ? 'text-blue-500' : 'text-slate-300'}`} />
                <span className="text-lg font-mono font-medium">{todayRecord?.checkIn || "--:--"}</span>
              </div>
            </div>
            <div className="flex flex-col gap-1 p-3 rounded-lg bg-slate-50 dark:bg-slate-900/50">
              <span className="text-xs text-muted-foreground uppercase tracking-wider font-semibold">Break Start</span>
              <div className="flex items-center gap-2">
                <Coffee className={`h-4 w-4 ${todayRecord?.breakIn ? 'text-amber-500' : 'text-slate-300'}`} />
                <span className="text-lg font-mono font-medium">{todayRecord?.breakIn || "--:--"}</span>
              </div>
            </div>
            <div className="flex flex-col gap-1 p-3 rounded-lg bg-slate-50 dark:bg-slate-900/50">
              <span className="text-xs text-muted-foreground uppercase tracking-wider font-semibold">Break End</span>
              <div className="flex items-center gap-2">
                <Coffee className={`h-4 w-4 ${todayRecord?.breakOut ? 'text-blue-500' : 'text-slate-300'}`} />
                <span className="text-lg font-mono font-medium">{todayRecord?.breakOut || "--:--"}</span>
              </div>
            </div>
            <div className="flex flex-col gap-1 p-3 rounded-lg bg-slate-50 dark:bg-slate-900/50">
              <span className="text-xs text-muted-foreground uppercase tracking-wider font-semibold">Check Out</span>
              <div className="flex items-center gap-2">
                <LogOut className={`h-4 w-4 ${todayRecord?.checkOut ? 'text-red-500' : 'text-slate-300'}`} />
                <span className="text-lg font-mono font-medium">{todayRecord?.checkOut || "--:--"}</span>
              </div>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex flex-col gap-2 mt-4 pt-4 border-t">
            {locationStatus === 'fetching' && (
              <p className="text-sm text-yellow-600 flex items-center gap-2">
                <RefreshCw className="h-3 w-3 animate-spin" /> {locationMessage || 'Acquiring location...'}
              </p>
            )}
            {locationStatus === 'success' && (
              <div className="text-sm text-blue-600 flex items-center gap-2">
                <MapPin className="h-3 w-3" />
                <span>Location captured</span>
                {locationSource && (
                  <Badge variant="outline" className={`text-[10px] px-1.5 py-0 ${locationSource === 'gps' ? 'border-blue-400 text-blue-700 bg-blue-50' :
                    locationSource === 'network' ? 'border-blue-400 text-blue-700 bg-blue-50' :
                      'border-amber-400 text-amber-700 bg-amber-50'
                    }`}>
                    {locationSource === 'gps' ? '📡 GPS' : locationSource === 'network' ? '📶 Network' : '🌐 IP'}
                  </Badge>
                )}
              </div>
            )}
            {locationError && (
              <p className="text-sm text-amber-600 flex items-center gap-2">
                <AlertCircle className="h-3 w-3" /> {locationError}
              </p>
            )}

            <div className="flex flex-wrap gap-4">
              {!todayRecord?.checkIn ? (
                <Button onClick={() => handleAction('checkIn')} disabled={actionLoading || isFetching} className="bg-blue-600 hover:bg-blue-700 w-full sm:w-auto sm:min-w-[150px]">
                  {actionLoading ? <RefreshCw className="mr-2 h-4 w-4 animate-spin" /> : <CheckCircle className="mr-2 h-4 w-4" />}
                  Check In
                </Button>
              ) : !todayRecord?.checkOut ? (
                <>
                  {(!todayRecord?.breakIn || (todayRecord?.breakIn && !todayRecord?.breakOut)) && (
                    <Button
                      onClick={() => handleAction(isOnBreak ? 'breakOut' : 'breakIn')}
                      disabled={actionLoading || isFetching}
                      variant="outline"
                      className={`w-full sm:w-auto sm:min-w-[150px] ${isOnBreak ? 'border-amber-500 text-amber-700' : 'border-blue-500 text-blue-700'}`}
                    >
                      <Coffee className="mr-2 h-4 w-4" />
                      {isOnBreak ? "End Break" : "Start Break"}
                    </Button>
                  )}
                  <Button
                    onClick={() => handleAction('checkOut')}
                    disabled={actionLoading || isFetching}
                    variant="destructive"
                    className="w-full sm:w-auto sm:min-w-[150px]"
                  >
                    <LogOut className="mr-2 h-4 w-4" />
                    Check Out
                  </Button>
                </>
              ) : (
                <p className="text-sm text-muted-foreground flex items-center gap-2">
                  <CheckCircle className="h-4 w-4 text-blue-500" />
                  Shift completed for today
                </p>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* History Table */}
      <Card>
        <CardHeader>
          <CardTitle>Attendance History</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto mobile-table-scroll rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Check In</TableHead>
                  <TableHead>Break</TableHead>
                  <TableHead>Check Out</TableHead>
                  <TableHead>Total Hours</TableHead>
                  <TableHead>Location</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {attendanceRecords.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                      No attendance records found
                    </TableCell>
                  </TableRow>
                ) : (
                  attendanceRecords.map((record) => (
                    <TableRow key={record.id}>
                      <TableCell className="font-medium">
                        {format(new Date(record.date), "MMM d, yyyy")}
                      </TableCell>
                      <TableCell>
                        {record.checkIn ? (
                          <span className="text-sm font-mono bg-gray-100 dark:bg-gray-800 px-2 py-1 rounded">{record.checkIn}</span>
                        ) : "-"}
                      </TableCell>
                      <TableCell>
                        {record.breakIn ? (
                          <div className="text-xs">
                            <span className="text-amber-600">{record.breakIn}</span> - <span className="text-blue-600">{record.breakOut || '...'}</span>
                          </div>
                        ) : '-'}
                      </TableCell>
                      <TableCell>
                        {record.checkOut ? (
                          <span className="text-sm font-mono bg-gray-100 dark:bg-gray-800 px-2 py-1 rounded">{record.checkOut}</span>
                        ) : "-"}
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className="font-mono">
                          {record.totalHours || '0h'}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {/* Location Cell - show both Check In and Check Out locations */}
                        {(() => {
                          // Helper: render one location entry
                          const renderLoc = (loc, label, colorClass) => {
                            if (!loc) return null;
                            // String label (e.g. from Hikvision)
                            if (typeof loc === 'string') {
                              return (
                                <div className={`flex items-center gap-1 text-xs ${colorClass}`}>
                                  <MapPin className="h-3 w-3 shrink-0" />
                                  <span>{label}: {loc}</span>
                                </div>
                              );
                            }
                            // GPS coords object { lat, lng, accuracy }
                            if (loc.lat && loc.lng) {
                              return (
                                <a
                                  href={`https://www.google.com/maps?q=${loc.lat},${loc.lng}`}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className={`inline-flex items-center gap-1 text-xs ${colorClass} hover:underline`}
                                  title={`Lat: ${loc.lat.toFixed(6)}, Lng: ${loc.lng.toFixed(6)}${loc.accuracy ? `, ±${Math.round(loc.accuracy)}m` : ''}`}
                                >
                                  <MapPin className="h-3 w-3 shrink-0" />
                                  {label}: View Map
                                </a>
                              );
                            }
                            return null;
                          };

                          // Extract locations — check events[] first, then fallback fields
                          const inEvent = record.events?.find(e => e.type === 'checkIn' && e.location);
                          const outEvent = record.events?.find(e => e.type === 'checkOut' && e.location);
                          const inLoc = inEvent?.location || record.checkInLocation || null;
                          const outLoc = outEvent?.location || record.checkOutLocation || null;

                          if (!inLoc && !outLoc) return <span className="text-muted-foreground text-xs">-</span>;

                          return (
                            <div className="flex flex-col gap-1">
                              {renderLoc(inLoc, 'In', 'text-emerald-600')}
                              {renderLoc(outLoc, 'Out', 'text-red-600')}
                            </div>
                          );
                        })()}
                      </TableCell>
                      <TableCell>
                        <Badge variant={record.checkOut ? "default" : "secondary"} className={record.checkOut ? "bg-blue-100 text-blue-800 hover:bg-blue-100" : "bg-slate-100 text-slate-800 hover:bg-slate-100"}>
                          {record.checkOut ? "Present" : "In Progress"}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
