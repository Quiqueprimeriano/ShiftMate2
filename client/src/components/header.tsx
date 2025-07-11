import { Menu, Bell } from "lucide-react";
import { Button } from "@/components/ui/button";
import { formatDateRange, getWeekDates } from "@/lib/time-utils";
import shiftMateLogo from "@assets/ShiftMate Logo_1752270032351.png";

interface HeaderProps {
  title: string;
  subtitle: string;
  onMobileMenuToggle?: () => void;
}

export function Header({ title, subtitle, onMobileMenuToggle }: HeaderProps) {
  const currentWeek = getWeekDates(new Date());
  const weekRange = formatDateRange(currentWeek.start, currentWeek.end);

  return (
    <header className="bg-white border-b border-slate-200 px-4 py-4 lg:px-8">
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-4">
          <Button
            variant="ghost"
            size="sm"
            className="lg:hidden"
            onClick={onMobileMenuToggle}
          >
            <Menu className="h-5 w-5" />
          </Button>
          <div className="flex items-center space-x-3">
            {/* ShiftMate Logo */}
            <img 
              src={shiftMateLogo} 
              alt="ShiftMate Logo" 
              className="w-10 h-10 object-contain"
            />
            <div>
              <h2 className="text-2xl font-bold text-slate-900">{title}</h2>
              <p className="text-sm text-slate-500">{subtitle}</p>
            </div>
          </div>
        </div>
        
        <div className="flex items-center space-x-4">
          <Button variant="ghost" size="sm" className="relative">
            <Bell className="h-5 w-5" />
            <span className="absolute -top-1 -right-1 w-3 h-3 bg-red-500 rounded-full"></span>
          </Button>
          <div className="hidden sm:block text-right">
            <p className="text-sm font-medium text-slate-900">Current Week</p>
            <p className="text-xs text-slate-500">{weekRange}</p>
          </div>
        </div>
      </div>
    </header>
  );
}
