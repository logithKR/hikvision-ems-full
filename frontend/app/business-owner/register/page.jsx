import { useState } from "react"
import { Link } from "react-router-dom"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Building2, ArrowLeft, Loader2, CheckCircle2, AlertCircle, LogIn, Eye, EyeOff, Mail, Lock, User, Phone, Building } from "lucide-react"
import { useNavigate } from "react-router-dom"
import { registerOrganization } from "@/lib/auth"
import AuthLayout from "@/components/layout/AuthLayout"

export default function BusinessRegisterPage() {
  const navigate = useNavigate()
  const [formData, setFormData] = useState({
    organizationName: "",
    name: "",
    email: "",
    phone: "",
    password: "",
    confirmPassword: "",
  })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")
  const [success, setSuccess] = useState(false)
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value })
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError("")
    setSuccess(false)

    // Validation
    if (formData.password !== formData.confirmPassword) {
      setError("Passwords do not match")
      return
    }

    if (formData.password.length < 6) {
      setError("Password must be at least 6 characters")
      return
    }

    setLoading(true)

    try {
      const result = await registerOrganization({
        organizationName: formData.organizationName,
        ownerName: formData.name,
        ownerEmail: formData.email,
        phone: formData.phone,
        ownerPassword: formData.password,
      })

      if (result.success) {
        setSuccess(true)
        setTimeout(() => {
          navigate("/login")
        }, 2000)
      } else {
        setError(result.error || "Registration failed. Please try again.")
        setLoading(false)
      }
    } catch (error) {
      console.error("Registration error:", error)
      setError("Network error. Please check if the server is running.")
      setLoading(false)
    }
  }

  return (
    <AuthLayout
      title="Create Account"
      subtitle="Register your organization to get started"
      role="business_owner"
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Success Alert */}
        {success && (
          <Alert className="bg-green-50 text-green-900 border-green-200 dark:bg-green-950/30 dark:text-green-100 dark:border-green-800 animate-in slide-in-from-top-2">
            <CheckCircle2 className="h-4 w-4" />
            <AlertDescription>
              Registration successful! Redirecting to login...
            </AlertDescription>
          </Alert>
        )}

        {/* Error Alert */}
        {error && (
          <Alert variant="destructive" className="animate-in slide-in-from-top-2 duration-300 border-red-200 bg-red-50 dark:bg-red-950/30">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {/* Organization Name */}
        <div className="space-y-2">
          <Label htmlFor="organizationName" className="text-sm font-medium">Organization Name <span className="text-red-500">*</span></Label>
          <div className="relative">
            <Building className="absolute left-3 top-3.5 h-4 w-4 text-slate-400" />
            <Input
              id="organizationName"
              name="organizationName"
              placeholder="Acme Corporation"
              value={formData.organizationName}
              onChange={handleChange}
              disabled={loading}
              required
              className="pl-10 h-11 border-slate-200 focus:border-blue-500 focus:ring-blue-500"
            />
          </div>
        </div>

        {/* Owner Name */}
        <div className="space-y-2">
          <Label htmlFor="name" className="text-sm font-medium">Your Full Name <span className="text-red-500">*</span></Label>
          <div className="relative">
            <User className="absolute left-3 top-3.5 h-4 w-4 text-slate-400" />
            <Input
              id="name"
              name="name"
              placeholder="John Doe"
              value={formData.name}
              onChange={handleChange}
              disabled={loading}
              required
              className="pl-10 h-11 border-slate-200 focus:border-blue-500 focus:ring-blue-500"
            />
          </div>
        </div>

        {/* Email & Phone Row */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {/* Email */}
          <div className="space-y-2">
            <Label htmlFor="email" className="text-sm font-medium">Email <span className="text-red-500">*</span></Label>
            <div className="relative">
              <Mail className="absolute left-3 top-3.5 h-4 w-4 text-slate-400" />
              <Input
                id="email"
                name="email"
                type="email"
                placeholder="owner@company.com"
                value={formData.email}
                onChange={handleChange}
                disabled={loading}
                required
                className="pl-10 h-11 border-slate-200 focus:border-blue-500 focus:ring-blue-500"
              />
            </div>
          </div>

          {/* Phone */}
          <div className="space-y-2">
            <Label htmlFor="phone" className="text-sm font-medium">Phone</Label>
            <div className="relative">
              <Phone className="absolute left-3 top-3.5 h-4 w-4 text-slate-400" />
              <Input
                id="phone"
                name="phone"
                type="tel"
                placeholder="+1 (555) 123-4567"
                value={formData.phone}
                onChange={handleChange}
                disabled={loading}
                className="pl-10 h-11 border-slate-200 focus:border-blue-500 focus:ring-blue-500"
              />
            </div>
          </div>
        </div>

        {/* Password & Confirm Password Row */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {/* Password */}
          <div className="space-y-2">
            <Label htmlFor="password" className="text-sm font-medium">Password <span className="text-red-500">*</span></Label>
            <div className="relative">
              <Lock className="absolute left-3 top-3.5 h-4 w-4 text-slate-400" />
              <Input
                id="password"
                name="password"
                type={showPassword ? "text" : "password"}
                placeholder="Min. 6 characters"
                value={formData.password}
                onChange={handleChange}
                disabled={loading}
                required
                className="pl-10 pr-10 h-11 border-slate-200 focus:border-blue-500 focus:ring-blue-500"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors"
              >
                {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          </div>

          {/* Confirm Password */}
          <div className="space-y-2">
            <Label htmlFor="confirmPassword" className="text-sm font-medium">Confirm <span className="text-red-500">*</span></Label>
            <div className="relative">
              <Lock className="absolute left-3 top-3.5 h-4 w-4 text-slate-400" />
              <Input
                id="confirmPassword"
                name="confirmPassword"
                type={showConfirmPassword ? "text" : "password"}
                placeholder="Re-enter password"
                value={formData.confirmPassword}
                onChange={handleChange}
                disabled={loading}
                required
                className="pl-10 pr-10 h-11 border-slate-200 focus:border-blue-500 focus:ring-blue-500"
              />
              <button
                type="button"
                onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors"
              >
                {showConfirmPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          </div>
        </div>

        {/* Register Button */}
        <Button
          type="submit"
          className="w-full h-11 bg-blue-600 hover:bg-blue-700 text-white font-medium shadow-sm transition-all mt-4"
          disabled={loading || success}
        >
          {loading ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Creating Organization...
            </>
          ) : success ? (
            <>
              <CheckCircle2 className="mr-2 h-4 w-4" />
              Success!
            </>
          ) : (
            "Create Organization"
          )}
        </Button>
      </form>

      {/* Login Link */}
      <div className="mt-8 text-center space-y-4">
        <div className="relative">
          <div className="absolute inset-0 flex items-center">
            <span className="w-full border-t border-slate-200" />
          </div>
          <div className="relative flex justify-center text-xs uppercase">
            <span className="bg-white px-2 text-slate-500">
              Already have an account?
            </span>
          </div>
        </div>

        <Link to="/login">
          <Button
            variant="outline"
            className="w-full h-11 text-slate-600 hover:bg-slate-50 transition-all font-medium border-slate-200"
            type="button"
          >
            <LogIn className="mr-2 h-4 w-4" />
            Sign In
          </Button>
        </Link>
      </div>
    </AuthLayout>
  )
}
