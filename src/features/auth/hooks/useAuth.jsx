import React, { createContext, useContext, useState, useEffect } from 'react';
import { useLocalStorage } from '@/hooks/useLocalStorage';
import { INITIAL_USERS } from '@/utils/dummyData';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  // Sync all system users with localStorage
  const [users, setUsers] = useLocalStorage('procureflow_users', INITIAL_USERS);
  
  // Sync current logged in user with localStorage
  const [currentUser, setCurrentUser] = useLocalStorage('procureflow_current_user', null);
  
  const [authError, setAuthError] = useState('');

  // Keep the currentUser session data fresh if the admin edits their user details in Settings
  useEffect(() => {
    if (currentUser) {
      const freshUserData = users.find(u => u.id === currentUser.id);
      if (freshUserData && JSON.stringify(freshUserData) !== JSON.stringify(currentUser)) {
        setCurrentUser(freshUserData);
      }
    }
  }, [users, currentUser, setCurrentUser]);

  // Seed default users if the localStorage array is empty, invalid, or lacks the admin profile
  useEffect(() => {
    const hasAdmin = Array.isArray(users) && users.some(u => u.username === 'admin');
    if (!users || !Array.isArray(users) || users.length === 0 || !hasAdmin) {
      setUsers(INITIAL_USERS);
    }
  }, [users, setUsers]);

  // Automatically grant all new pages access to existing admin user if not present
  useEffect(() => {
    if (Array.isArray(users)) {
      let updated = false;
      const requiredPages = [
        'Generate PO',
        'Create Bill',
        'Ready Product',
        'Check Transport',
        'Print Invoice',
        'Supply Check',
        'Approve Product',
        'Payment Processing'
      ];
      const nextUsers = users.map(u => {
        if (u.username === 'admin') {
          const missingPages = requiredPages.filter(p => !u.pageAccess.includes(p));
          if (missingPages.length > 0) {
            updated = true;
            return { ...u, pageAccess: [...u.pageAccess, ...missingPages] };
          }
        }
        return u;
      });
      if (updated) {
        setUsers(nextUsers);
      }
    }
  }, [users, setUsers]);

  const login = (username, password) => {
    setAuthError('');
    const user = users.find(
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
    setUsers(users.map(u => u.id === updatedUser.id ? updatedUser : u));
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
