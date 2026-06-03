import { Button } from"@/components/ui/button"
import { Card, CardContent } from"@/components/ui/card"
import { Building2, Users, Clock, BarChart3, Shield, CheckCircle2 } from"lucide-react"
import { useNavigate } from"react-router-dom"
import { safeRedirect } from"@/lib/redirectUtils"

export default function LandingPage() {
 const navigate = useNavigate()

 return (
 <div className="min-h-screen bg-background font-sans selection:bg-blue-100">
 {/* Navigation */}
 <nav className="border-b border-border bg-card/80 backdrop-blur-md sticky top-0 z-50">
 <div className="container mx-auto px-4 h-14 sm:h-16 flex items-center justify-between">
 <div className="flex items-center gap-2">
 <div className="bg-blue-600 p-1.5 rounded-lg">
 <Building2 className="h-5 w-5 sm:h-6 sm:w-6 text-white" />
 </div>
 <span className="font-bold text-base sm:text-xl tracking-tight text-foreground">EMS</span>
 </div>
 <div className="flex items-center gap-2 sm:gap-4">
 <Button variant="ghost" size="sm" className="text-slate-600 hover:text-blue-600 text-sm" onClick={() => safeRedirect(navigate,"/login")}>
 Login
 </Button>
 <Button size="sm" className="bg-blue-600 hover:bg-blue-700 text-white shadow-sm shadow-blue-200 text-sm" onClick={() => safeRedirect(navigate,"/business-owner/register")}>
 Get Started
 </Button>
 </div>
 </div>
 </nav>

 {/* Hero Section */}
 <div className="relative overflow-hidden pt-10 pb-16 sm:pt-16 sm:pb-24 lg:pt-32 lg:pb-40">
 <div className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[500px] bg-blue-100/50 rounded-full blur-3xl -z-10" />

 <div className="container mx-auto px-4 text-center max-w-4xl">
 <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-50 border border-blue-100 text-blue-700 text-xs sm:text-sm font-medium mb-6 sm:mb-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
 <span className="relative flex h-2 w-2">
 <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75"></span>
 <span className="relative inline-flex rounded-full h-2 w-2 bg-blue-500"></span>
 </span>
 New: Enhanced Location Tracking
 </div>

 <h1 className="text-3xl sm:text-5xl lg:text-7xl font-bold tracking-tight text-foreground mb-6 sm:mb-8 animate-in fade-in slide-in-from-bottom-6 duration-700 delay-100">
 Smart Attendance for the <br className="hidden sm:block" />
 <span className="text-blue-600">Modern Workforce</span>
 </h1>

 <p className="text-base sm:text-xl text-slate-600 mb-8 sm:mb-10 max-w-2xl mx-auto leading-relaxed animate-in fade-in slide-in-from-bottom-6 duration-700 delay-200">
 Streamline employee management with precise attendance tracking,
 automated leave handling, and real-time location insights.
 </p>

 <div className="flex flex-col sm:flex-row items-center justify-center gap-3 sm:gap-4 animate-in fade-in slide-in-from-bottom-6 duration-700 delay-300 px-4 sm:px-0">
 <Button size="lg" className="w-full sm:w-auto h-12 sm:h-14 px-8 text-base sm:text-lg bg-blue-600 hover:bg-blue-700 text-white shadow-lg shadow-blue-500/20" onClick={() => safeRedirect(navigate,"/login")}>
 Start for Free
 </Button>
 </div>
 </div>
 </div>

 {/* Features Grid */}
 <div className="bg-card py-24 border-t border-border">
 <div className="container mx-auto px-4">
 <div className="text-center max-w-3xl mx-auto mb-10 sm:mb-16">
 <h2 className="text-2xl sm:text-3xl font-bold text-foreground mb-4">Everything you need to manage your team</h2>
 <p className="text-slate-600 text-base sm:text-lg">Powerful features designed to increase productivity and simplify HR operations.</p>
 </div>

 <div className="grid grid-cols-1 md:grid-cols-3 gap-8 max-w-6xl mx-auto">
 <Card className="border-0 shadow-lg shadow-slate-200/50 hover:shadow-xl hover:shadow-blue-500/5 transition-all duration-300 group">
 <CardContent className="pt-8 px-8 pb-8 text-center space-y-4">
 <div className="inline-flex p-4 rounded-2xl bg-blue-50 text-blue-600 group-hover:bg-blue-600 group-hover:text-white transition-colors duration-300">
 <Users className="w-8 h-8" />
 </div>
 <h3 className="font-bold text-xl text-foreground">Employee Management</h3>
 <p className="text-slate-600 leading-relaxed">
 Centralized database for all employee records, documents, and contact information.
 </p>
 </CardContent>
 </Card>

 <Card className="border-0 shadow-lg shadow-slate-200/50 hover:shadow-xl hover:shadow-blue-500/5 transition-all duration-300 group">
 <CardContent className="pt-8 px-8 pb-8 text-center space-y-4">
 <div className="inline-flex p-4 rounded-2xl bg-blue-50 text-blue-600 group-hover:bg-blue-600 group-hover:text-white transition-colors duration-300">
 <Clock className="w-8 h-8" />
 </div>
 <h3 className="font-bold text-xl text-foreground">Real-time Attendance</h3>
 <p className="text-slate-600 leading-relaxed">
 GPS-enabled check-ins and check-outs with geofencing capabilities for verified attendance.
 </p>
 </CardContent>
 </Card>

 <Card className="border-0 shadow-lg shadow-slate-200/50 hover:shadow-xl hover:shadow-blue-500/5 transition-all duration-300 group">
 <CardContent className="pt-8 px-8 pb-8 text-center space-y-4">
 <div className="inline-flex p-4 rounded-2xl bg-blue-50 text-blue-600 group-hover:bg-blue-600 group-hover:text-white transition-colors duration-300">
 <BarChart3 className="w-8 h-8" />
 </div>
 <h3 className="font-bold text-xl text-foreground">Analytics & Reports</h3>
 <p className="text-slate-600 leading-relaxed">
 Comprehensive insights into workforce productivity, overtime, and leave trends.
 </p>
 </CardContent>
 </Card>
 </div>
 </div>
 </div>

 {/* Footer */}
 <footer className="bg-background border-t border-border py-12">
 <div className="container mx-auto px-4 text-center text-muted-foreground">
 <p>© {new Date().getFullYear()} Employee Management System. All rights reserved.</p>
 </div>
 </footer>
 </div>
 )
}
