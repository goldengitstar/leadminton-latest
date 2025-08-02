import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { useAuth } from './AuthContext';
import { AdminUser, checkAdminPermissions, logAdminActivity } from '../middleware/adminAuth';

interface AdminContextType {
  adminUser: AdminUser | null;
  isAdmin: boolean;
  loading: boolean;
  hasPermission: (permission: keyof AdminUser['permissions']) => boolean;
  logActivity: (actionType: string, targetType?: string, targetId?: string, details?: any) => Promise<void>;
  refreshAdminStatus: () => Promise<void>;
}

const AdminContext = createContext<AdminContextType | undefined>(undefined);

export const AdminProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [adminUser, setAdminUser] = useState<AdminUser | null>(null);
  const [loading, setLoading] = useState(true);
  const { user } = useAuth();

  const checkAdminStatus = useCallback(async () => {
    if (!user?.id) {
      setAdminUser(null);
      return;
    }

    setLoading(true);

    try {
      const admin = await checkAdminPermissions(user.id);
      setAdminUser(admin);
    } catch (error) {
      console.error('Error checking admin status:', error);
      setAdminUser(null);
    } finally {
      setLoading(false);
    }
  }, [user?.id]);

  const refreshAdminStatus = useCallback(async () => {
    setLoading(true);
    await checkAdminStatus();
  }, [checkAdminStatus]);

  const hasPermission = useCallback((permission: keyof AdminUser['permissions']): boolean => {
    if (!adminUser) return false;
    return adminUser.permissions[permission] || false;
  }, [adminUser]);

  const logActivity = useCallback(async (
    actionType: string,
    targetType?: string,
    targetId?: string,
    details?: any
  ): Promise<void> => {
    if (adminUser) {
      await logAdminActivity(adminUser.id, actionType, targetType, targetId, details);
    }
  }, [adminUser]);

  useEffect(() => {
    checkAdminStatus();
  }, [checkAdminStatus]); // Now properly memoized

  const value: AdminContextType = {
    adminUser,
    isAdmin: !!adminUser,
    loading,
    hasPermission,
    logActivity,
    refreshAdminStatus,
  };

  return <AdminContext.Provider value={value}>{children}</AdminContext.Provider>;
};

export const useAdmin = (): AdminContextType => {
  const context = useContext(AdminContext);
  if (context === undefined) {
    throw new Error('useAdmin must be used within an AdminProvider');
  }
  return context;
}; 