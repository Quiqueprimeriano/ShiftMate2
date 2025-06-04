import { useState } from "react";
import { CalendarGrid } from "@/components/calendar-grid";
import { useShifts } from "@/hooks/use-shifts";

export default function Calendar() {
  const [currentDate, setCurrentDate] = useState(new Date());
  
  // Get shifts for the current month
  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();
  const startDate = new Date(year, month, 1).toISOString().split('T')[0];
  const endDate = new Date(year, month + 1, 0).toISOString().split('T')[0];
  
  const { data: shifts = [], isLoading } = useShifts(startDate, endDate);

  const handleDayClick = (date: string) => {
    console.log('Day clicked:', date);
    // Here you could open a modal to add/edit shifts for this date
  };

  if (isLoading) {
    return (
      <div className="p-4 lg:p-8">
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 h-96 flex items-center justify-center">
          <div className="text-slate-500">Loading calendar...</div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 lg:p-8">
      <CalendarGrid
        currentDate={currentDate}
        onDateChange={setCurrentDate}
        shifts={shifts}
        onDayClick={handleDayClick}
      />
    </div>
  );
}
