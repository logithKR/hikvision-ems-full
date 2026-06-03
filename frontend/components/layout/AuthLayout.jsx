import { Building2, ArrowLeft } from"lucide-react";
import { useNavigate } from"react-router-dom";
import { Button } from"@/components/ui/button";

export default function AuthLayout({ children, title, subtitle, role ="employee" }) {
 const navigate = useNavigate();

 const getRoleBadge = () => {
 switch (role) {
 case"admin":
 return <span className="bg-blue-100 text-blue-700 text-xs px-3 py-1 rounded-full font-semibold uppercase tracking-wide">Admin Portal</span>;
 case"business_owner":
 return <span className="bg-blue-100 text-blue-700 text-xs px-3 py-1 rounded-full font-semibold uppercase tracking-wide">Business Owner</span>;
 case"system_admin":
 return <span className="bg-blue-100 text-blue-700 text-xs px-3 py-1 rounded-full font-semibold uppercase tracking-wide">System Admin</span>;
 default:
 return <span className="bg-blue-100 text-blue-700 text-xs px-3 py-1 rounded-full font-semibold uppercase tracking-wide">Employee Portal</span>;
 }
 };

 return (
 <div className="min-h-screen grid lg:grid-cols-2 bg-card">
 {/* Left Column - Branding (Hidden on Mobile) */}
 <div className="hidden lg:flex flex-col justify-between bg-blue-600 p-12 text-white relative overflow-hidden">
 {/* Abstract Background Pattern */}
 <div className="absolute inset-0 bg-blue-600">
 <div className="absolute top-0 left-0 w-full h-full opacity-10"
 style={{ backgroundImage: 'radial-gradient(circle at 2px 2px, white 1px, transparent 0)', backgroundSize: '40px 40px' }}>
 </div>
 <div className="absolute bottom-0 right-0 w-96 h-96 bg-blue-500 rounded-full blur-3xl opacity-50 translate-x-1/2 translate-y-1/2"></div>
 <div className="absolute top-0 left-0 w-64 h-64 bg-indigo-500 rounded-full blur-3xl opacity-50 -translate-x-1/2 -translate-y-1/2"></div>
 </div>

 {/* Content */}
 <div className="relative z-10">
 <div className="flex items-center gap-3 mb-8">
 <div className="p-2 bg-card/20 backdrop-blur-sm rounded-lg">
 <Building2 className="h-8 w-8 text-white" />
 </div>
 <span className="text-2xl font-bold tracking-tight">Employee Management System</span>
 </div>
 <h1 className="text-4xl font-bold leading-tight mb-6">
 Manage your workforce with precision.
 </h1>
 <p className="text-blue-100 text-lg max-w-md leading-relaxed">
 Streamline attendance, leave requests, and team management in one unified platform.
 </p>
 </div>

 <div className="relative z-10 text-sm text-blue-200">
 &copy; {new Date().getFullYear()} Employee Management System. All rights reserved.
 </div>
 </div>

 {/* Right Column - Auth Form */}
 <div className="flex flex-col h-full">
 {/* Back Button */}
 <div className="p-4 flex-shrink-0">
 <Button
 variant="ghost"
 size="sm"
 className="text-muted-foreground hover:text-blue-600 hover:bg-blue-50 transition-colors"
 onClick={() => navigate("/")}
 >
 <ArrowLeft className="mr-2 h-4 w-4" />
 Back to Home
 </Button>
 </div>

 <div className="flex-1 flex items-center justify-center px-6 sm:px-12 lg:px-16 overflow-auto">
 <div className="w-full max-w-md space-y-6">
 {/* Mobile Logo (Visible only on mobile) */}
 <div className="lg:hidden flex justify-center">
 <div className="p-3 bg-blue-600 rounded-xl shadow-lg">
 <Building2 className="h-8 w-8 text-white" />
 </div>
 </div>

 <div className="text-center space-y-2">
 <div className="flex justify-center mb-3">
 {getRoleBadge()}
 </div>
 <h2 className="text-2xl font-bold tracking-tight text-foreground">
 {title}
 </h2>
 <p className="text-muted-foreground text-sm">
 {subtitle}
 </p>
 </div>

 <div>
 {children}
 </div>
 </div>
 </div>
 </div>
 </div>
 );
}
