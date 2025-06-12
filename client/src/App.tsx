import { useState } from "react";
import { Switch, Route, Link, useLocation } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { useAuth } from "@/hooks/use-auth";
import { Sidebar } from "@/components/sidebar";
import { Header } from "@/components/header";
import { Skeleton } from "@/components/ui/skeleton";
import { Clock, User, X } from "lucide-react";

// Pages
import Dashboard from "@/pages/dashboard";
import Calendar from "@/pages/calendar";
import AddShift from "@/pages/add-shift";
import Reports from "@/pages/reports";
import Login from "@/pages/login";
import Admin from "@/pages/admin";
import NotFound from "@/pages/not-found";

const PAGE_TITLES = {
  "/": { title: "Dashboard", subtitle: "Welcome back! Here's your shift overview." },
  "/dashboard": { title: "Dashboard", subtitle: "Welcome back! Here's your shift overview." },
  "/calendar": { title: "Calendar", subtitle: "View and manage your shifts on the calendar." },
  "/add-shift": { title: "Add Shift", subtitle: "Log a new work shift." },
  "/reports": { title: "Reports", subtitle: "Generate and download shift reports." },
};

function MobileSidebar({ onClose }: { onClose: () => void }) {
  const [location] = useLocation();
  const { user, logout } = useAuth();

  const navItems = [
    { path: "/", label: "Dashboard", icon: "BarChart3" },
    { path: "/calendar", label: "Calendar", icon: "Calendar" },
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
            <div className="w-8 h-8 bg-primary rounded-lg flex items-center justify-center">
              <Clock className="h-4 w-4 text-primary-foreground" />
            </div>
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
    Plus: "➕",
    FileText: "📄"
  };
  return icons[iconName] || "📋";
}

function AppLayout({ children, location }: { children: React.ReactNode; location: string }) {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const pageInfo = PAGE_TITLES[location as keyof typeof PAGE_TITLES] || { 
    title: "ShiftMate", 
    subtitle: "Manage your work shifts" 
  };

  const toggleMobileMenu = () => {
    setIsMobileMenuOpen(!isMobileMenuOpen);
  };

  const closeMobileMenu = () => {
    setIsMobileMenuOpen(false);
  };

  return (
    <div className="min-h-screen flex bg-slate-50">
      <Sidebar />
      
      {/* Mobile Menu Overlay */}
      {isMobileMenuOpen && (
        <div 
          className="fixed inset-0 bg-black bg-opacity-50 z-40 lg:hidden"
          onClick={closeMobileMenu}
        />
      )}
      
      {/* Mobile Sidebar */}
      <div className={`fixed inset-y-0 left-0 z-50 w-64 bg-white shadow-lg transform transition-transform duration-300 ease-in-out lg:hidden ${
        isMobileMenuOpen ? 'translate-x-0' : '-translate-x-full'
      }`}>
        <MobileSidebar onClose={closeMobileMenu} />
      </div>
      
      <main className="flex-1 flex flex-col overflow-hidden">
        <Header 
          title={pageInfo.title}
          subtitle={pageInfo.subtitle}
          onMobileMenuToggle={toggleMobileMenu}
        />
        <div className="flex-1 overflow-auto">
          {children}
        </div>
      </main>
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
  const { isAuthenticated, isLoading } = useAuth();

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

  if (!isAuthenticated) {
    return (
      <Switch>
        <Route path="/login" component={Login} />
        <Route component={Login} />
      </Switch>
    );
  }

  return (
    <Switch>
      <Route path="/" component={() => <AppLayout location="/"><Dashboard /></AppLayout>} />
      <Route path="/dashboard" component={() => <AppLayout location="/dashboard"><Dashboard /></AppLayout>} />
      <Route path="/calendar" component={() => <AppLayout location="/calendar"><Calendar /></AppLayout>} />
      <Route path="/add-shift" component={() => <AppLayout location="/add-shift"><AddShift /></AppLayout>} />
      <Route path="/reports" component={() => <AppLayout location="/reports"><Reports /></AppLayout>} />
      <Route component={() => <AppLayout location="/404"><NotFound /></AppLayout>} />
    </Switch>
  );
}

function App() {
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
