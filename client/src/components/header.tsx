import { Bell, Clock, LogOut } from "lucide-react";
import { Button } from "@/components/ui/button";
import { formatDateRange, getWeekDates } from "@/lib/time-utils";
import { useAuth } from "@/hooks/use-auth";

interface HeaderProps {
  title: string;
  subtitle: string;
}

export function Header({ title, subtitle }: HeaderProps) {
  const currentWeek = getWeekDates(new Date());
  const weekRange = formatDateRange(currentWeek.start, currentWeek.end);
  const { logout } = useAuth();

  return (
    <header className="bg-white border-b border-slate-200 px-4 py-3 lg:px-8 lg:py-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <Clock className="w-8 h-8 lg:w-10 lg:h-10 text-blue-600" />
          <div>
            <h2 className="text-xl lg:text-2xl font-bold text-slate-900">{title}</h2>
            <p className="text-xs lg:text-sm text-slate-500 hidden sm:block">{subtitle}</p>
          </div>
        </div>

        <div className="flex items-center space-x-3">
          <Button variant="ghost" size="sm" className="relative">
            <Bell className="h-5 w-5" />
            <span className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-red-500 rounded-full"></span>
          </Button>
          <div className="hidden md:block text-right">
            <p className="text-sm font-medium text-slate-900">Current Week</p>
            <p className="text-xs text-slate-500">{weekRange}</p>
          </div>
          <Button
            variant="ghost"
            size="sm"
            className="lg:hidden text-slate-500 hover:text-slate-900"
            onClick={() => logout()}
          >
            <LogOut className="h-5 w-5" />
          </Button>
        </div>
      </div>
    </header>
  );
}
