import { useState, useEffect } from "react";
import { Switch, Route, Link, useLocation } from "wouter";
import { queryClient, setAccessToken } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { useAuth } from "@/hooks/use-auth";
import { Sidebar } from "@/components/sidebar";
import { Header } from "@/components/header";
import { Skeleton } from "@/components/ui/skeleton";
import { Clock, User, X, LayoutDashboard, Calendar as CalendarIcon, CalendarDays, Plus, FileText, List, DollarSign } from "lucide-react";

// Pages
import Dashboard from "@/pages/dashboard";
import Calendar from "@/pages/calendar";
import MyRoster from "@/pages/my-roster";
import AddShift from "@/pages/add-shift";
import Shifts from "@/pages/shifts";
import Reports from "@/pages/reports";
import Login from "@/pages/login";
import Admin from "@/pages/admin";
import NotFound from "@/pages/not-found";
import Landing from "@/pages/landing";
import BusinessDashboard from "@/pages/business-dashboard";
import MyEarnings from "@/pages/my-earnings";
import AcceptInvitation from "@/pages/accept-invitation";

const PAGE_TITLES = {
  "/": { title: "Dashboard", subtitle: "Welcome back! Here's your business overview." },
  "/dashboard": { title: "Dashboard", subtitle: "Welcome back! Here's your business overview." },
  "/business-dashboard": { title: "Dashboard", subtitle: "Welcome back! Here's your business overview." },
  "/employees": { title: "Employees", subtitle: "Manage your team members and their information." },
  "/roster": { title: "Roster Planner", subtitle: "Plan and assign shifts to your team." },
  "/billing": { title: "Billing", subtitle: "Manage employee rates and view reports." },
  "/calendar": { title: "Calendar", subtitle: "View and manage your shifts on the calendar." },
  "/my-roster": { title: "My Roster", subtitle: "View your assigned shifts in mobile-optimized agenda format." },
  "/add-shift": { title: "Add Shift", subtitle: "Log a new work shift." },
  "/shifts": { title: "All Shifts", subtitle: "View, edit, and manage your shift history." },
  "/reports": { title: "Reports", subtitle: "Generate and download shift reports." },
  "/my-earnings": { title: "My Earnings", subtitle: "View your rates and track earnings." },
};

function MobileSidebar({ onClose }: { onClose: () => void }) {
  const [location] = useLocation();
  const { user, logout } = useAuth();

  const navItems = [
    { path: "/", label: "Dashboard", icon: "BarChart3" },
    { path: "/calendar", label: "Calendar", icon: "Calendar" },
    { path: "/my-roster", label: "My Roster", icon: "CalendarDays" },
    { path: "/add-shift", label: "Add Shift", icon: "Plus" },
    { path: "/reports", label: "Reports", icon: "FileText" },
  ];

  const handleNavClick = () => {
    onClose();
  };

  return (
    <div className="flex flex-col h-full">
      <div className="p-6 border-b border-slate-200">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <Clock className="w-8 h-8 text-blue-600" />
            <h1 className="text-xl font-bold text-slate-900">ShiftMate</h1>
          </div>
          <button 
            onClick={onClose}
            className="p-2 hover:bg-slate-100 rounded-lg"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
      </div>
      
      <nav className="flex-1 px-6 py-6">
        <ul className="space-y-2">
          {navItems.map((item) => {
            const isActive = location === item.path;
            
            return (
              <li key={item.path}>
                <Link href={item.path}>
                  <button
                    onClick={handleNavClick}
                    className={`w-full flex items-center space-x-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors text-left ${
                      isActive
                        ? "bg-primary/10 text-primary border border-primary/20"
                        : "text-slate-600 hover:bg-slate-50 hover:text-slate-900"
                    }`}
                  >
                    <span className="text-lg">{getIconForNavItem(item.icon)}</span>
                    <span>{item.label}</span>
                  </button>
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>

      <div className="p-6 border-t border-slate-200">
        {user && (
          <div className="mb-4">
            <div className="flex items-center space-x-3 mb-3">
              <div className="w-8 h-8 bg-slate-200 rounded-full flex items-center justify-center">
                <User className="h-4 w-4 text-slate-600" />
              </div>
              <div>
                <p className="text-sm font-medium text-slate-900">{user.name}</p>
                <p className="text-xs text-slate-500">{user.email}</p>
              </div>
            </div>
            <button
              onClick={() => {
                logout();
                onClose();
              }}
              className="w-full px-3 py-2 text-sm text-slate-600 hover:text-slate-900 hover:bg-slate-50 rounded-lg transition-colors text-left"
            >
              Sign out
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

function getIconForNavItem(iconName: string) {
  const icons: Record<string, string> = {
    BarChart3: "📊",
    Calendar: "📅",
    CalendarDays: "🗓️",
    Plus: "➕",
    FileText: "📄"
  };
  return icons[iconName] || "📋";
}

// Bottom Navigation for Mobile
function BottomNav() {
  const [location] = useLocation();

  const navItems = [
    { path: "/", icon: LayoutDashboard, label: "Home" },
    { path: "/shifts", icon: List, label: "Shifts" },
    { path: "/add-shift", icon: Plus, label: "Add", isMain: true },
    { path: "/my-roster", icon: CalendarDays, label: "Roster" },
    { path: "/my-earnings", icon: DollarSign, label: "Earnings" },
  ];

  return (
    <nav className="fixed bottom-0 left-0 right-0 bg-white border-t border-neutral-200 lg:hidden z-50 safe-area-bottom">
      <div className="flex items-center justify-around h-16 px-2">
        {navItems.map((item) => {
          const isActive = location === item.path || (item.path === "/" && location === "/dashboard");
          const Icon = item.icon;

          if (item.isMain) {
            return (
              <Link key={item.path} href={item.path}>
                <button className="flex flex-col items-center justify-center -mt-4">
                  <div className="w-14 h-14 bg-black rounded-full flex items-center justify-center shadow-lg">
                    <Icon className="h-6 w-6 text-white" />
                  </div>
                </button>
              </Link>
            );
          }

          return (
            <Link key={item.path} href={item.path}>
              <button className="flex flex-col items-center justify-center py-2 px-3 min-w-[64px]">
                <Icon className={`h-6 w-6 ${isActive ? 'text-black' : 'text-neutral-400'}`} />
                <span className={`text-xs mt-1 ${isActive ? 'text-black font-medium' : 'text-neutral-400'}`}>
                  {item.label}
                </span>
              </button>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}

function AppLayout({ children, location }: { children: React.ReactNode; location: string }) {
  const pageInfo = PAGE_TITLES[location as keyof typeof PAGE_TITLES] || {
    title: "ShiftMate",
    subtitle: "Manage your work shifts"
  };

  return (
    <div className="min-h-screen flex bg-slate-50">
      <Sidebar />

      <main className="flex-1 flex flex-col overflow-hidden">
        <Header
          title={pageInfo.title}
          subtitle={pageInfo.subtitle}
        />
        <div className="flex-1 overflow-auto pb-20 lg:pb-0">
          {children}
        </div>
      </main>

      {/* Bottom Navigation for Mobile */}
      <BottomNav />
    </div>
  );
}

function AuthenticatedApp() {
  return (
    <Switch>
      <Route path="/" component={Dashboard} />
      <Route path="/dashboard" component={Dashboard} />
      <Route path="/calendar" component={Calendar} />
      <Route path="/add-shift" component={AddShift} />
      <Route path="/reports" component={Reports} />
      <Route component={NotFound} />
    </Switch>
  );
}

function Router() {
  const { isAuthenticated, isLoading, user } = useAuth();
  const [location] = useLocation();

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="space-y-4 w-full max-w-md">
          <Skeleton className="h-12 w-12 rounded-lg mx-auto" />
          <Skeleton className="h-4 w-32 mx-auto" />
          <Skeleton className="h-3 w-48 mx-auto" />
        </div>
      </div>
    );
  }

  // Public routes that should be accessible regardless of auth status
  if (location.startsWith('/invite/')) {
    return (
      <Switch>
        <Route path="/invite/:token" component={AcceptInvitation} />
      </Switch>
    );
  }

  if (!isAuthenticated) {
    return (
      <Switch>
        <Route path="/login" component={Login} />
        <Route path="/landing" component={Landing} />
        <Route component={Landing} />
      </Switch>
    );
  }

  // Determine which interface to show based on user type
  const userType = (user as any)?.userType || 'individual';
  const isBusinessUser = userType === 'business';

  if (isBusinessUser) {
    return (
      <Switch>
        <Route path="/" component={() => <AppLayout location="/"><BusinessDashboard defaultTab="overview" /></AppLayout>} />
        <Route path="/dashboard" component={() => <AppLayout location="/dashboard"><BusinessDashboard defaultTab="overview" /></AppLayout>} />
        <Route path="/employees" component={() => <AppLayout location="/employees"><BusinessDashboard defaultTab="employees" /></AppLayout>} />
        <Route path="/roster" component={() => <AppLayout location="/roster"><BusinessDashboard defaultTab="roster" /></AppLayout>} />
        <Route path="/billing" component={() => <AppLayout location="/billing"><BusinessDashboard defaultTab="billing" /></AppLayout>} />
        <Route path="*" component={() => <AppLayout location="/"><BusinessDashboard defaultTab="overview" /></AppLayout>} />
      </Switch>
    );
  }

  return (
    <Switch>
      <Route path="/" component={() => <AppLayout location="/"><Dashboard /></AppLayout>} />
      <Route path="/dashboard" component={() => <AppLayout location="/dashboard"><Dashboard /></AppLayout>} />
      <Route path="/calendar" component={() => <AppLayout location="/calendar"><Calendar /></AppLayout>} />
      <Route path="/my-roster" component={() => <AppLayout location="/my-roster"><MyRoster /></AppLayout>} />
      <Route path="/add-shift" component={() => <AppLayout location="/add-shift"><AddShift /></AppLayout>} />
      <Route path="/shifts" component={() => <AppLayout location="/shifts"><Shifts /></AppLayout>} />
      <Route path="/reports" component={() => <AppLayout location="/reports"><Reports /></AppLayout>} />
      <Route path="/my-earnings" component={() => <AppLayout location="/my-earnings"><MyEarnings /></AppLayout>} />
      <Route path="*" component={() => <AppLayout location="/"><Dashboard /></AppLayout>} />
    </Switch>
  );
}

function App() {
  useEffect(() => {
    // Extract token from URL after Google OAuth callback
    const urlParams = new URLSearchParams(window.location.search);
    const token = urlParams.get('token');
    
    if (token) {
      // Store the access token
      setAccessToken(token);
      
      // Remove token from URL without page reload
      const newUrl = window.location.pathname;
      window.history.replaceState({}, '', newUrl);
      
      // Invalidate auth query to trigger refresh with new token
      queryClient.invalidateQueries({ queryKey: ['/api/auth/me'] });
    }
  }, []);

  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <Router />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
