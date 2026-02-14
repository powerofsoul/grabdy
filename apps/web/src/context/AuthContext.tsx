import { createContext, type ReactNode, useCallback, useContext, useEffect, useState } from 'react';

import { type DbId,dbIdSchema } from '@grabdy/common';

import { api } from '../lib/api';
import { STORAGE_KEYS } from '../lib/storage-keys';

interface OrgMembership {
  id: string;
  orgId: DbId<'Org'>;
  orgName: string;
  roles: string[];
}

interface User {
  id: string;
  email: string;
  name: string;
  status: string;
  memberships: OrgMembership[];
}

interface AuthContextType {
  user: User | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  selectedOrgId: DbId<'Org'> | undefined;
  isAdmin: boolean;
  isOwner: boolean;
  selectOrg: (orgId: DbId<'Org'>) => void;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  forgotPassword: (email: string) => Promise<void>;
  resetPassword: (email: string, otp: string, newPassword: string) => Promise<void>;
  refetch: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedOrgId, setSelectedOrgId] = useState<DbId<'Org'> | undefined>(() => {
    const stored = localStorage.getItem(STORAGE_KEYS.SELECTED_ORG_ID);
    if (!stored) return undefined;
    const parsed = dbIdSchema('Org').safeParse(stored);
    return parsed.success ? parsed.data : undefined;
  });

  const fetchUserProfile = useCallback(async () => {
    try {
      const res = await api.auth.me();
      if (res.status === 200 && res.body.success) {
        setUser(res.body.data);
        return true;
      }
      return false;
    } catch (err) {
      console.error('Error fetching user profile:', err);
      return false;
    }
  }, []);

  useEffect(() => {
    const initAuth = async () => {
      await fetchUserProfile();
      setIsLoading(false);
    };
    initAuth();
  }, [fetchUserProfile]);

  useEffect(() => {
    if (!user) return;
    const memberships = user.memberships;
    if (memberships.length === 0) return;
    const isValid = selectedOrgId && memberships.some((m) => m.orgId === selectedOrgId);
    if (!isValid) {
      const firstOrgId = memberships[0].orgId;
      queueMicrotask(() => setSelectedOrgId(firstOrgId));
    }
  }, [user, selectedOrgId]);

  const selectOrg = useCallback((orgId: DbId<'Org'>) => {
    setSelectedOrgId(orgId);
    localStorage.setItem(STORAGE_KEYS.SELECTED_ORG_ID, orgId);
  }, []);

  const login = async (email: string, password: string) => {
    const res = await api.auth.login({ body: { email, password } });

    if (res.status === 200 && res.body.success) {
      setUser(res.body.data);
      return;
    }

    if (res.status === 401) {
      throw new Error(res.body.error || 'Invalid email or password');
    }

    throw new Error('Login failed');
  };

  const logout = async () => {
    await api.auth.logout({ body: {} });
    localStorage.removeItem(STORAGE_KEYS.SELECTED_ORG_ID);
    setUser(null);
    setSelectedOrgId(undefined);
    window.location.href = '/';
  };

  const forgotPassword = async (email: string) => {
    const res = await api.auth.forgotPassword({ body: { email } });
    if (res.status !== 200) {
      throw new Error('Failed to send password reset email');
    }
  };

  const resetPassword = async (email: string, otp: string, newPassword: string) => {
    const res = await api.auth.resetPassword({ body: { email, otp, newPassword } });

    if (res.status === 200 && res.body.success) {
      return;
    }

    if (res.status === 400) {
      throw new Error(res.body.error || 'Failed to reset password');
    }

    throw new Error('Failed to reset password');
  };

  const refetch = async () => {
    await fetchUserProfile();
  };

  const selectedMembership = user?.memberships.find((m) => m.orgId === selectedOrgId);
  const isOwner = selectedMembership ? selectedMembership.roles.includes('OWNER') : false;
  const isAdmin = selectedMembership
    ? selectedMembership.roles.includes('OWNER') || selectedMembership.roles.includes('ADMIN')
    : false;

  return (
    <AuthContext.Provider
      value={{
        user,
        isLoading,
        isAuthenticated: !!user,
        selectedOrgId,
        isAdmin,
        isOwner,
        selectOrg,
        login,
        logout,
        forgotPassword,
        resetPassword,
        refetch,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return context;
}
