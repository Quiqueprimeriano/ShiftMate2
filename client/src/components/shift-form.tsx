import { useState, useMemo } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { useCreateShift, useUpdateShift, useDeleteShift } from "@/hooks/use-shifts";
import type { Shift } from "@shared/schema";
import { generateTimeOptions } from "@/lib/time-utils";
import { useToast } from "@/hooks/use-toast";

const shiftFormSchema = z.object({
  date: z.string().min(1, "Date is required"),
  shiftType: z.string().min(1, "Shift type is required"),
  startTime: z.string().min(1, "Start time is required"),
  endTime: z.string().min(1, "End time is required"),
  notes: z.string().optional(),
  isRecurring: z.boolean().default(false),
  recurringPattern: z.string().optional(),
  recurringEndDate: z.string().optional(),
});

type ShiftFormData = z.infer<typeof shiftFormSchema>;

const shiftTypes = [
  { value: "morning", label: "Morning Shift" },
  { value: "evening", label: "Evening Shift" },
  { value: "night", label: "Night Shift" },
  { value: "double", label: "Double Shift" },
  { value: "custom", label: "Custom" },
];

const recurringOptions = [
  { value: "none", label: "One-time shift" },
  { value: "daily", label: "Daily (same time every day)" },
  { value: "weekly", label: "Weekly (same day and time every week)" },
  { value: "custom", label: "Custom pattern" },
];

interface ShiftFormProps {
  onSuccess?: () => void;
  editingShift?: Shift;
  isEditing?: boolean;
}

export function ShiftForm({ onSuccess, editingShift, isEditing }: ShiftFormProps) {
  const { toast } = useToast();
  const createShift = useCreateShift();
  const updateShift = useUpdateShift();
  const deleteShift = useDeleteShift();
  const timeOptions = generateTimeOptions();
  
  const form = useForm<ShiftFormData>({
    resolver: zodResolver(shiftFormSchema),
    defaultValues: {
      date: editingShift?.date || new Date().toISOString().split('T')[0],
      shiftType: editingShift?.shiftType || "",
      startTime: editingShift?.startTime || "",
      endTime: editingShift?.endTime || "",
      notes: editingShift?.notes || "",
      isRecurring: editingShift?.isRecurring || false,
      recurringPattern: editingShift?.recurringPattern || "none",
    },
  });

  const [recurringType, setRecurringType] = useState("none");
  
  // Watch start time to filter end time options
  const startTime = form.watch("startTime");
  
  // Generate filtered end time options based on start time
  const endTimeOptions = useMemo(() => {
    if (!startTime) {
      return timeOptions;
    }
    
    // Find the index of the selected start time
    const startIndex = timeOptions.findIndex(option => option.value === startTime);
    
    if (startIndex === -1) {
      return timeOptions;
    }
    
    // Return all times after the start time, plus times from the next day for overnight shifts
    const afterStartTime = timeOptions.slice(startIndex + 1);
    const nextDayTimes = timeOptions.slice(0, startIndex + 1).map(option => ({
      ...option,
      label: `${option.label} (+1 day)`
    }));
    
    return [...afterStartTime, ...nextDayTimes];
  }, [startTime, timeOptions]);
  
  // Reset end time when start time changes
  const handleStartTimeChange = (value: string) => {
    form.setValue("startTime", value);
    form.setValue("endTime", ""); // Clear end time when start time changes
  };

  const onSubmit = async (data: ShiftFormData) => {
    try {
      const shiftData = {
        date: data.date,
        shiftType: data.shiftType,
        startTime: data.startTime,
        endTime: data.endTime,
        notes: data.notes || null,
        isRecurring: recurringType !== "none",
        recurringPattern: recurringType !== "none" ? recurringType : null,
        recurringEndDate: data.recurringEndDate || null,
      };

      if (isEditing && editingShift) {
        await updateShift.mutateAsync({ id: editingShift.id, ...shiftData });
        toast({
          title: "Success",
          description: "Shift updated successfully!",
        });
      } else {
        await createShift.mutateAsync(shiftData);
        toast({
          title: "Success",
          description: "Shift added successfully!",
        });
      }
      
      form.reset();
      onSuccess?.();
    } catch (error) {
      toast({
        title: "Error",
        description: `Failed to ${isEditing ? 'update' : 'add'} shift. Please try again.`,
        variant: "destructive",
      });
    }
  };

  const handleDelete = async () => {
    if (!editingShift) return;
    
    try {
      await deleteShift.mutateAsync(editingShift.id);
      toast({
        title: "Success",
        description: "Shift deleted successfully!",
      });
      onSuccess?.();
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to delete shift. Please try again.",
        variant: "destructive",
      });
    }
  };

  return (
    <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
      <div className="flex items-center justify-between mb-6">
        <h3 className="text-lg font-semibold text-slate-900">
          {isEditing ? 'Edit Shift' : 'Add New Shift'}
        </h3>
        {isEditing && (
          <Button
            type="button"
            variant="destructive"
            onClick={handleDelete}
            disabled={deleteShift.isPending}
            className="flex items-center gap-2"
          >
            {deleteShift.isPending ? 'Deleting...' : 'Delete Shift'}
          </Button>
        )}
      </div>
      
      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <FormField
              control={form.control}
              name="date"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Shift Date</FormLabel>
                  <FormControl>
                    <Input type="date" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            
            <FormField
              control={form.control}
              name="shiftType"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Shift Type</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Select shift type" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {shiftTypes.map((type) => (
                        <SelectItem key={type.value} value={type.value}>
                          {type.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <FormField
              control={form.control}
              name="startTime"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Start Time</FormLabel>
                  <Select onValueChange={handleStartTimeChange} value={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Select start time" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent className="max-h-60">
                      {timeOptions.map((time) => (
                        <SelectItem key={time.value} value={time.value}>
                          {time.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />
            
            <FormField
              control={form.control}
              name="endTime"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>End Time</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder={startTime ? "Select end time" : "Select start time first"} />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent className="max-h-60">
                      {endTimeOptions.map((time) => (
                        <SelectItem key={time.value} value={time.value}>
                          {time.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>

          <FormField
            control={form.control}
            name="notes"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Notes (Optional)</FormLabel>
                <FormControl>
                  <Textarea
                    placeholder="Add any additional notes about this shift..."
                    className="resize-none"
                    rows={3}
                    {...field}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          {/* Recurring Options */}
          <div className="border-t border-slate-200 pt-6">
            <h4 className="text-md font-medium text-slate-900 mb-4">Recurring Options</h4>
            <RadioGroup
              value={recurringType}
              onValueChange={setRecurringType}
              className="space-y-4"
            >
              {recurringOptions.map((option) => (
                <div key={option.value} className="flex items-center space-x-2">
                  <RadioGroupItem value={option.value} id={option.value} />
                  <Label htmlFor={option.value} className="text-sm">
                    {option.label}
                  </Label>
                </div>
              ))}
            </RadioGroup>
          </div>

          <div className="flex items-center justify-between pt-6">
            <Button 
              type="button" 
              variant="outline"
              onClick={() => form.reset()}
            >
              Cancel
            </Button>
            <Button 
              type="submit" 
              disabled={createShift.isPending || updateShift.isPending}
            >
              {isEditing 
                ? (updateShift.isPending ? "Updating..." : "Update Shift")
                : (createShift.isPending ? "Adding..." : "Add Shift")
              }
            </Button>
          </div>
        </form>
      </Form>
    </div>
  );
}
