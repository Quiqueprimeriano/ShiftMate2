import { ShiftForm } from "@/components/shift-form";
import { useLocation, useSearch } from "wouter";
import { useShifts } from "@/hooks/use-shifts";

export default function AddShift() {
  const [, setLocation] = useLocation();
  const search = useSearch();
  
  // Check if we're editing an existing shift
  const editId = new URLSearchParams(search).get('edit');
  const { data: shifts } = useShifts();
  const shiftToEdit = editId ? shifts?.find(shift => shift.id === parseInt(editId)) : undefined;

  const handleSuccess = () => {
    setLocation("/dashboard");
  };

  return (
    <div className="p-4 lg:p-8">
      <div className="max-w-2xl mx-auto">
        <ShiftForm 
          onSuccess={handleSuccess} 
          editingShift={shiftToEdit}
          isEditing={!!shiftToEdit}
        />
      </div>
    </div>
  );
}
