

import { createContext, useContext, useEffect, useState } from 'react';
import { io } from 'socket.io-client';
import { useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';

const SocketContext = createContext(null);

export function useSocket() {
 return useContext(SocketContext);
}

export function SocketProvider({ children }) {
 const [socket, setSocket] = useState(null);
 const { user } = useAuth();
 const queryClient = useQueryClient();

 useEffect(() => {
 // Only connect if user is authenticated
 if (!user) {
 if (socket) {
 console.log('🔌 Disconnecting socket (no user)');
 socket.disconnect();
 setSocket(null);
 }
 return;
 }

 // const SOCKET_URL = import.meta.env.VITE_API_URL || '';
 const SOCKET_URL = import.meta.env.VITE_API_URL || window.location.origin;

 console.log(`🔌 Connecting to socket server at ${SOCKET_URL}...`);
 const newSocket = io(SOCKET_URL);

 newSocket.on('connect', () => {
 console.log('✅ Connected to socket server:', newSocket.id);

 // Authenticate with user details
 if (user.uid && user.organizationId) {
 newSocket.emit('authenticate', {
 userId: user.uid,
 organizationId: user.organizationId
 });
 console.log(`👤 Authenticated socket for user ${user.uid} in org ${user.organizationId}`);
 } else {
 console.warn('⚠️ User details missing for socket authentication', user);
 }
 });

 // ========================================
 // 🔴 REAL-TIME: Global Query Invalidation
 // These run regardless of which page is active
 // ========================================

 newSocket.on('realtime:attendance', (data) => {
 console.log('📡 Real-time attendance update received');
 queryClient.invalidateQueries({ queryKey: ['admin-dashboard'] });
 queryClient.invalidateQueries({ queryKey: ['admin-attendance'] });
 queryClient.invalidateQueries({ queryKey: ['bo-dashboard'] });
 queryClient.invalidateQueries({ queryKey: ['bo-attendance'] });
 queryClient.invalidateQueries({ queryKey: ['emp-dashboard'] });
 queryClient.invalidateQueries({ queryKey: ['emp-attendance'] });
 queryClient.invalidateQueries({ queryKey: ['emp-weekly-hours'] });
 queryClient.invalidateQueries({ queryKey: ['team-dashboard'] });
 queryClient.invalidateQueries({ queryKey: ['team-attendance'] });
 });

 newSocket.on('realtime:leaves', (data) => {
 console.log('📡 Real-time leaves update received');
 queryClient.invalidateQueries({ queryKey: ['admin-dashboard'] });
 queryClient.invalidateQueries({ queryKey: ['admin-leave-requests'] });
 queryClient.invalidateQueries({ queryKey: ['bo-dashboard'] });
 queryClient.invalidateQueries({ queryKey: ['bo-leave-requests'] });
 queryClient.invalidateQueries({ queryKey: ['emp-dashboard'] });
 queryClient.invalidateQueries({ queryKey: ['emp-my-leaves'] });
 queryClient.invalidateQueries({ queryKey: ['team-dashboard'] });
 queryClient.invalidateQueries({ queryKey: ['team-leaves'] });
 });

 newSocket.on('realtime:employees', (data) => {
 console.log('📡 Real-time employees update received');
 queryClient.invalidateQueries({ queryKey: ['admin-dashboard'] });
 queryClient.invalidateQueries({ queryKey: ['admin-employees'] });
 queryClient.invalidateQueries({ queryKey: ['bo-dashboard'] });
 queryClient.invalidateQueries({ queryKey: ['bo-employees'] });
 queryClient.invalidateQueries({ queryKey: ['sa-dashboard'] });
 queryClient.invalidateQueries({ queryKey: ['sa-organizations'] });
 });

 newSocket.on('realtime:projects', (data) => {
 console.log('📡 Real-time projects update received');
 queryClient.invalidateQueries({ queryKey: ['admin-projects-all'] });
 queryClient.invalidateQueries({ queryKey: ['bo-projects-all'] });
 queryClient.invalidateQueries({ queryKey: ['employee-projects'] });
 queryClient.invalidateQueries({ queryKey: ['project-stats'] });
 queryClient.invalidateQueries({ queryKey: ['admin-dashboard'] });
 queryClient.invalidateQueries({ queryKey: ['bo-dashboard'] });
 queryClient.invalidateQueries({ queryKey: ['emp-dashboard'] });
 queryClient.invalidateQueries({ queryKey: ['team-dashboard'] });
 });

 // ========================================
 // TOAST NOTIFICATIONS (user-facing)
 // ========================================

 newSocket.on('attendance:update', (data) => {
 console.log('📨 Attendance update:', data);
 if (data.userId !== user.uid) {
 toast.info(`Attendance: ${data.userName} ${data.action} at ${data.time}`);
 }
 });

 newSocket.on('leave:created', (data) => {
 console.log('📨 Leave created:', data);
 toast.info(`New Leave Request: ${data.userName} applied for ${data.type}`);
 });

 newSocket.on('leave:approved', (data) => {
 console.log('📨 Leave approved:', data);
 toast.success(`Your leave request was APPROVED by ${data.reviewerName}`);
 });

 newSocket.on('leave:rejected', (data) => {
 console.log('📨 Leave rejected:', data);
 toast.error(`Your leave request was REJECTED by ${data.reviewerName}`);
 });

 setSocket(newSocket);

 // Cleanup on unmount or user change
 return () => {
 console.log('🔌 Cleaning up socket connection');
 newSocket.disconnect();
 };
 }, [user]);

 return (
 <SocketContext.Provider value={socket}>
 {children}
 </SocketContext.Provider>
 );
}
