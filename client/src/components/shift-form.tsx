import { useMemo, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
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
});

type ShiftFormData = z.infer<typeof shiftFormSchema>;

const shiftTypes = [
  { value: "morning", label: "Morning" },
  { value: "afternoon", label: "Afternoon" },
  { value: "night", label: "Night" },
];

interface ShiftFormProps {
  onSuccess?: () => void;
  editingShift?: Shift;
  isEditing?: boolean;
}

export function ShiftForm({ onSuccess, editingShift, isEditing }: ShiftFormProps) {
  const { toast } = useToast();
  const createShiftMutation = useCreateShift();
  const updateShiftMutation = useUpdateShift();
  const deleteShiftMutation = useDeleteShift();

  const timeOptions = generateTimeOptions();
  
  const form = useForm<ShiftFormData>({
    resolver: zodResolver(shiftFormSchema),
    defaultValues: {
      date: editingShift?.date || new Date().toISOString().split('T')[0],
      shiftType: editingShift?.shiftType || "",
      startTime: editingShift?.startTime || "",
      endTime: editingShift?.endTime || "",
      notes: editingShift?.notes || "",
    },
  });

  // Reset form when editing shift changes
  useEffect(() => {
    if (editingShift && isEditing) {
      form.reset({
        date: editingShift.date,
        shiftType: editingShift.shiftType,
        startTime: editingShift.startTime,
        endTime: editingShift.endTime,
        notes: editingShift.notes || "",
      });
    }
  }, [editingShift, isEditing, form]);
  
  // Watch shift type to automatically set times
  const shiftType = form.watch("shiftType");
  
  // Automatically set start and end times based on shift type
  useEffect(() => {
    if (shiftType && !isEditing) {
      switch (shiftType) {
        case "morning":
          form.setValue("startTime", "08:00");
          form.setValue("endTime", "11:00");
          break;
        case "afternoon":
          form.setValue("startTime", "12:30");
          form.setValue("endTime", "17:00");
          break;
        case "night":
          form.setValue("startTime", "17:30");
          form.setValue("endTime", "23:00");
          break;
      }
    }
  }, [shiftType, isEditing, form]);
  
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

  const onSubmit = async (data: ShiftFormData) => {
    try {
      if (isEditing && editingShift) {
        // Update existing shift
        await updateShiftMutation.mutateAsync({ 
          id: editingShift.id, 
          ...data 
        });
        toast({
          title: "Shift updated",
          description: "Your shift has been updated successfully.",
        });
      } else {
        // Create new shift
        await createShiftMutation.mutateAsync(data);
        toast({
          title: "Shift created",
          description: "Your shift has been created successfully.",
        });
      }
      
      onSuccess?.();
      form.reset();
    } catch (error) {
      toast({
        title: "Error",
        description: isEditing ? "Failed to update shift." : "Failed to create shift.",
        variant: "destructive",
      });
    }
  };

  const handleDelete = async () => {
    if (!editingShift) return;
    
    try {
      await deleteShiftMutation.mutateAsync(editingShift.id);
      toast({
        title: "Shift deleted",
        description: "Your shift has been deleted successfully.",
      });
      onSuccess?.();
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to delete shift.",
        variant: "destructive",
      });
    }
  };

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
        <FormField
          control={form.control}
          name="date"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Date</FormLabel>
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

        <FormField
          control={form.control}
          name="startTime"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Start Time</FormLabel>
              <Select onValueChange={field.onChange} value={field.value}>
                <FormControl>
                  <SelectTrigger>
                    <SelectValue placeholder="Select start time" />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  {timeOptions.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
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
                    <SelectValue placeholder="Select end time" />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  {endTimeOptions.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
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
          name="notes"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Notes (Optional)</FormLabel>
              <FormControl>
                <Textarea 
                  placeholder="Add any notes about this shift..."
                  {...field}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <div className="flex gap-2 pt-4">
          <Button 
            type="submit" 
            disabled={createShiftMutation.isPending || updateShiftMutation.isPending}
            className="flex-1"
          >
            {createShiftMutation.isPending || updateShiftMutation.isPending 
              ? "Saving..." 
              : isEditing ? "Update Shift" : "Add Shift"
            }
          </Button>
          
          {isEditing && editingShift && (
            <Button 
              type="button" 
              variant="destructive" 
              onClick={handleDelete}
              disabled={deleteShiftMutation.isPending}
            >
              {deleteShiftMutation.isPending ? "Deleting..." : "Delete"}
            </Button>
          )}
        </div>
      </form>
    </Form>
  );
}