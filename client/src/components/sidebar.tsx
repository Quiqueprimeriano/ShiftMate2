import { Link, useLocation } from "wouter";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { 
  Clock, 
  BarChart3, 
  Calendar, 
  Plus, 
  FileText, 
  User 
} from "lucide-react";
import shiftMateLogo from "@assets/ShiftMate Logo_1752270032351.png";

const navItems = [
  { path: "/", label: "Dashboard", icon: BarChart3 },
  { path: "/calendar", label: "Calendar", icon: Calendar },
  { path: "/add-shift", label: "Add Shift", icon: Plus },
  { path: "/reports", label: "Reports", icon: FileText },
];

export function Sidebar() {
  const [location] = useLocation();
  const { user, logout } = useAuth();

  return (
    <aside className="w-64 bg-white shadow-sm border-r border-slate-200 hidden lg:block">
      <div className="p-6">
        <div className="flex items-center space-x-3">
          <img 
            src={shiftMateLogo} 
            alt="ShiftMate Logo" 
            className="w-8 h-8 object-contain"
          />
          <h1 className="text-xl font-bold text-slate-900">ShiftMate</h1>
        </div>
      </div>
      
      <nav className="px-6 pb-6">
        <ul className="space-y-2">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = location === item.path;
            
            return (
              <li key={item.path}>
                <Link href={item.path}>
                  <button
                    className={`w-full flex items-center space-x-3 px-4 py-4 rounded-lg text-base font-medium transition-colors text-left touch-target ${
                      isActive
                        ? "bg-primary/10 text-primary border border-primary/20"
                        : "text-slate-600 hover:bg-slate-50 hover:text-slate-900 active:bg-slate-100"
                    }`}
                  >
                    <Icon className="w-5 h-5" />
                    <span>{item.label}</span>
                  </button>
                </Link>
              </li>
            );
          })}
        </ul>
        
        <div className="mt-8 pt-6 border-t border-slate-200">
          <div className="flex items-center space-x-3 px-3 py-2 mb-4">
            <div className="w-8 h-8 bg-primary/10 rounded-full flex items-center justify-center">
              <User className="h-4 w-4 text-primary" />
            </div>
            <div>
              <p className="text-sm font-medium text-slate-900">{user?.name}</p>
              <p className="text-xs text-slate-500">{user?.email}</p>
            </div>
          </div>
          <Button 
            variant="outline" 
            size="sm" 
            onClick={() => logout()}
            className="w-full"
          >
            Sign Out
          </Button>
        </div>
      </nav>
    </aside>
  );
}
