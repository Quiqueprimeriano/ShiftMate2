import { ShiftForm } from "@/components/shift-form";
import { useLocation } from "wouter";

export default function AddShift() {
  const [, setLocation] = useLocation();

  const handleSuccess = () => {
    setLocation("/dashboard");
  };

  return (
    <div className="p-4 lg:p-8">
      <div className="max-w-2xl mx-auto">
        <ShiftForm onSuccess={handleSuccess} />
      </div>
    </div>
  );
}
