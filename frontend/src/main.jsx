import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import App from './App'
import { AuthProvider } from '@/contexts/AuthContext'
import { SocketProvider } from '@/app/components/providers/SocketProvider'
import { ThemeProvider } from '@/components/theme-provider'
import '@/app/globals.css'

const queryClient = new QueryClient({
 defaultOptions: {
 queries: {
 staleTime: 30 * 1000, // Data is fresh for 30 seconds
 gcTime: 5 * 60 * 1000, // Cache kept for 5 minutes after unmount
 refetchOnWindowFocus: false, // Don't refetch when tab regains focus
 retry: 1, // Retry failed requests once
 },
 },
})

ReactDOM.createRoot(document.getElementById('root')).render(
 <React.StrictMode>
 <BrowserRouter>
 <QueryClientProvider client={queryClient}>
 <AuthProvider>
 <SocketProvider>
 <ThemeProvider defaultTheme="system" storageKey="ems-ui-theme">
 <App />
 </ThemeProvider>
 </SocketProvider>
 </AuthProvider>
 </QueryClientProvider>
 </BrowserRouter>
 </React.StrictMode>
)
