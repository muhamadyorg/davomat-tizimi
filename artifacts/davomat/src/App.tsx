import { Switch, Route, Router as WouterRouter, useLocation } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/not-found";

import { AuthProvider, useAuth } from "@/lib/auth";
import { ThemeProvider } from "@/lib/theme";
import { AppLayout } from "@/components/layout/AppLayout";

// Pages
import Login from "@/pages/login";
import Dashboard from "@/pages/dashboard";
import CheckIn from "@/pages/attendance/checkin";
import AttendanceList from "@/pages/attendance/index";
import Employees from "@/pages/employees/index";
import Departments from "@/pages/departments/index";
import Shifts from "@/pages/shifts/index";
import Leave from "@/pages/leave/index";
import Reports from "@/pages/reports/index";
import Profile from "@/pages/profile/index";

const queryClient = new QueryClient();

// Auth Guard Wrapper
function ProtectedRoute({ component: Component }: { component: React.ComponentType }) {
  const { isAuthenticated, isLoading } = useAuth();
  
  if (isLoading) {
    return <div className="min-h-screen flex items-center justify-center bg-background"><div className="w-10 h-10 border-4 border-primary border-t-transparent rounded-full animate-spin"></div></div>;
  }
  
  if (!isAuthenticated) return null; // Redirect handled by AuthProvider

  return (
    <AppLayout>
      <Component />
    </AppLayout>
  );
}

function Router() {
  return (
    <Switch>
      <Route path="/login" component={Login} />
      
      <Route path="/" component={() => <ProtectedRoute component={Dashboard} />} />
      <Route path="/attendance/checkin" component={() => <ProtectedRoute component={CheckIn} />} />
      <Route path="/attendance" component={() => <ProtectedRoute component={AttendanceList} />} />
      <Route path="/employees" component={() => <ProtectedRoute component={Employees} />} />
      <Route path="/departments" component={() => <ProtectedRoute component={Departments} />} />
      <Route path="/shifts" component={() => <ProtectedRoute component={Shifts} />} />
      <Route path="/leave" component={() => <ProtectedRoute component={Leave} />} />
      <Route path="/reports" component={() => <ProtectedRoute component={Reports} />} />
      <Route path="/profile" component={() => <ProtectedRoute component={Profile} />} />
      
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider>
        <TooltipProvider>
          <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, "")}>
            <AuthProvider>
              <Router />
            </AuthProvider>
          </WouterRouter>
          <Toaster />
        </TooltipProvider>
      </ThemeProvider>
    </QueryClientProvider>
  );
}

export default App;
