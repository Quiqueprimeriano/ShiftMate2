import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { useAuth } from "@/hooks/use-auth";
import { Sidebar } from "@/components/sidebar";
import { Header } from "@/components/header";
import { Skeleton } from "@/components/ui/skeleton";

// Pages
import Dashboard from "@/pages/dashboard";
import Calendar from "@/pages/calendar";
import AddShift from "@/pages/add-shift";
import Reports from "@/pages/reports";
import Login from "@/pages/login";
import NotFound from "@/pages/not-found";

const PAGE_TITLES = {
  "/": { title: "Dashboard", subtitle: "Welcome back! Here's your shift overview." },
  "/dashboard": { title: "Dashboard", subtitle: "Welcome back! Here's your shift overview." },
  "/calendar": { title: "Calendar", subtitle: "View and manage your shifts on the calendar." },
  "/add-shift": { title: "Add Shift", subtitle: "Log a new work shift." },
  "/reports": { title: "Reports", subtitle: "Generate and download shift reports." },
};

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
    return <Login />;
  }

  return (
    <Switch>
      {(params) => (
        <AppLayout location={params.location}>
          <AuthenticatedApp />
        </AppLayout>
      )}
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
