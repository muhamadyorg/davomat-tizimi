import React, { createContext, useContext, useEffect } from "react";
import { useLocation } from "wouter";
import { useGetMe, User } from "@workspace/api-client-react";

interface AuthContextType {
  user: User | null;
  isLoading: boolean;
  isAuthenticated: boolean;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  isLoading: true,
  isAuthenticated: false,
});

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [, setLocation] = useLocation();
  const { data: user, isLoading, error } = useGetMe({
    query: {
      retry: false,
      staleTime: 5 * 60 * 1000,
    }
  });

  useEffect(() => {
    if (!isLoading && error) {
      // If we're not already on the login page, redirect
      if (window.location.pathname !== "/login") {
        setLocation("/login");
      }
    }
  }, [isLoading, error, setLocation]);

  return (
    <AuthContext.Provider value={{ 
      user: user || null, 
      isLoading,
      isAuthenticated: !!user 
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
