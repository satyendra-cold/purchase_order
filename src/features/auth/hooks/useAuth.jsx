import React, { createContext, useContext, useState, useEffect } from 'react';
import { useLocalStorage } from '@/hooks/useLocalStorage';
import { useSheetData } from '@/hooks/useSheetData';
import { useToast } from '@/hooks/useToast';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const { toast } = useToast();

  // Users live in Google Sheets
  const [users, setUsers] = useSheetData('Login', 'id', {
    onError: (msg) => toast(msg, 'error'),
  });

  // Session persists in localStorage only
  const [currentUser, setCurrentUser] = useLocalStorage('procureflow_current_user', null);

  const [authError, setAuthError] = useState('');

  // Keep the currentUser session data fresh if the admin edits their user details in Settings
  useEffect(() => {
    if (currentUser && Array.isArray(users) && users.length > 0) {
      const freshUserData = users.find(u => u.id === currentUser.id);
      if (freshUserData && JSON.stringify(freshUserData) !== JSON.stringify(currentUser)) {
        setCurrentUser(freshUserData);
      }
    }
  }, [users, currentUser, setCurrentUser]);

  const DEFAULT_ADMIN = {
    id: 'default-admin',
    username: 'admin',
    password: 'admin123',
    name: 'Admin',
    role: 'Admin',
    status: 'Active',
    pageAccess: [
      'Dashboard', 'Settings', 'Generate PO', 'Create Bill',
      'Ready Product', 'Check Transport', 'Print Invoice',
      'Supply Check', 'Approve Product', 'Payment Processing'
    ],
  };

  const login = (username, password) => {
    setAuthError('');

    // Check DEFAULT_ADMIN first — always works regardless of sheet contents
    if (
      username.toLowerCase() === DEFAULT_ADMIN.username.toLowerCase() &&
      password === DEFAULT_ADMIN.password
    ) {
      // Only use DEFAULT_ADMIN if sheet has no active user with same credentials
      const sheetMatch = Array.isArray(users) && users.find(
        u => u.username.toLowerCase() === username.toLowerCase() && u.password === password
      );
      if (!sheetMatch || sheetMatch.status !== 'Active') {
        setCurrentUser(DEFAULT_ADMIN);
        return true;
      }
    }

    const user = Array.isArray(users) && users.find(
      u => u.username.toLowerCase() === username.toLowerCase() && u.password === password
    );

    if (user) {
      if (user.status !== 'Active') {
        setAuthError('Your account has been deactivated. Please contact an administrator.');
        return false;
      }
      setCurrentUser(user);
      return true;
    } else {
      setAuthError('Invalid username or password.');
      return false;
    }
  };

  const logout = () => {
    setCurrentUser(null);
    setAuthError('');
  };

  const addUser = (newUser) => {
    const id = Date.now().toString();
    const formattedUser = {
      ...newUser,
      id,
      dateJoined: new Date().toISOString().split('T')[0],
      status: newUser.status || 'Active'
    };
    setUsers([...users, formattedUser]);
    return true;
  };

  const updateUser = (updatedUser) => {
    setUsers(users.map(u => u.id === updatedUser.id ? { ...u, ...updatedUser } : u));
    return true;
  };

  const deleteUser = (userId) => {
    // Prevent deleting the currently logged in admin user
    if (currentUser && currentUser.id === userId) {
      return { success: false, message: 'You cannot delete yourself.' };
    }
    setUsers(users.filter(u => u.id !== userId));
    return { success: true };
  };

  return (
    <AuthContext.Provider value={{
      currentUser,
      users,
      authError,
      setAuthError,
      login,
      logout,
      addUser,
      updateUser,
      deleteUser
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
