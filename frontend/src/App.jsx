import { Routes, Route, Navigate } from 'react-router-dom'
import { Toaster } from '@/components/ui/sonner'

// Layouts
import AdminLayout from '@/app/admin/layout'
import EmployeeLayout from '@/app/employee/layout'
import BusinessOwnerLayout from '@/app/business-owner/layout'
import SystemAdminLayout from '@/app/system-admin/layout'

// Root Pages
import LandingPage from '@/app/page'
import UnifiedLoginPage from '@/app/login/page'

// Admin Pages
import AdminDashboardPage from '@/app/admin/dashboard/page'
import AdminEmployeesPage from '@/app/admin/employees/page'
import AdminAttendancePage from '@/app/admin/attendance/page'
import AdminLeaveRequestsPage from '@/app/admin/leave-requests/page'
import AdminProfilePage from '@/app/admin/profile/page'
import AdminOrgChartPage from '@/app/admin/org-chart/page'

// Employee Pages
import EmployeeDashboardPage from '@/app/employee/dashboard/page'
import EmployeeAttendancePage from '@/app/employee/attendance/page'
import EmployeeLeaveRequestsPage from '@/app/employee/leave-requests/page'
import EmployeeWeeklyHoursPage from '@/app/employee/weekly-hours/page'
import EmployeeProfilePage from '@/app/employee/profile/page'
import EmployeeTeamPage from '@/app/employee/team/page'
import EmployeeTeamAttendancePage from '@/app/employee/team/attendance/page'
import EmployeeTeamLeavesPage from '@/app/employee/team/leaves/page'

// Business Owner Pages
import BORegisterPage from '@/app/business-owner/register/page'
import BODashboardPage from '@/app/business-owner/dashboard/page'
import BOEmployeesPage from '@/app/business-owner/employees/page'
import BOAttendancePage from '@/app/business-owner/attendance/page'
import BOLeaveRequestsPage from '@/app/business-owner/leave-requests/page'
import BOProfilePage from '@/app/business-owner/profile/page'

// System Admin Pages
import SADashboardPage from '@/app/system-admin/dashboard/page'
import SAOrganizationsPage from '@/app/system-admin/organizations/page'
import SAProfilePage from '@/app/system-admin/profile/page'

export default function App() {
    return (
        <>
            <Routes>
                {/* Public Routes */}
                <Route path="/" element={<LandingPage />} />
                <Route path="/login" element={<UnifiedLoginPage />} />

                {/* Admin Routes */}
                <Route path="/admin" element={<AdminLayout />}>
                    <Route path="dashboard" element={<AdminDashboardPage />} />
                    <Route path="org-chart" element={<AdminOrgChartPage />} />
                    <Route path="employees" element={<AdminEmployeesPage />} />
                    <Route path="attendance" element={<AdminAttendancePage />} />
                    <Route path="leave-requests" element={<AdminLeaveRequestsPage />} />
                    <Route path="profile" element={<AdminProfilePage />} />
                    <Route index element={<Navigate to="dashboard" replace />} />
                </Route>

                {/* Employee Routes */}
                <Route path="/employee" element={<EmployeeLayout />}>
                    <Route path="dashboard" element={<EmployeeDashboardPage />} />
                    <Route path="attendance" element={<EmployeeAttendancePage />} />
                    <Route path="leave-requests" element={<EmployeeLeaveRequestsPage />} />
                    <Route path="weekly-hours" element={<EmployeeWeeklyHoursPage />} />
                    <Route path="profile" element={<EmployeeProfilePage />} />
                    <Route path="team" element={<EmployeeTeamPage />} />
                    <Route path="team/attendance" element={<EmployeeTeamAttendancePage />} />
                    <Route path="team/leaves" element={<EmployeeTeamLeavesPage />} />
                    <Route index element={<Navigate to="dashboard" replace />} />
                </Route>

                {/* Business Owner Routes */}
                <Route path="/business-owner/register" element={<BORegisterPage />} />
                <Route path="/business-owner" element={<BusinessOwnerLayout />}>
                    <Route path="dashboard" element={<BODashboardPage />} />
                    <Route path="employees" element={<BOEmployeesPage />} />
                    <Route path="attendance" element={<BOAttendancePage />} />
                    <Route path="leave-requests" element={<BOLeaveRequestsPage />} />
                    <Route path="profile" element={<BOProfilePage />} />
                    <Route index element={<Navigate to="dashboard" replace />} />
                </Route>

                {/* System Admin Routes */}
                <Route path="/system-admin" element={<SystemAdminLayout />}>
                    <Route path="dashboard" element={<SADashboardPage />} />
                    <Route path="organizations" element={<SAOrganizationsPage />} />
                    <Route path="profile" element={<SAProfilePage />} />
                    <Route index element={<Navigate to="dashboard" replace />} />
                </Route>

                {/* Catch all */}
                <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
            <Toaster richColors position="top-right" />
        </>
    )
}
