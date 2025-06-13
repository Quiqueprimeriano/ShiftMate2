import { useState, useMemo } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Edit, Trash2, Check, Clock, Filter, Search } from "lucide-react";
import { useShifts, useUpdateShift, useDeleteShift } from "@/hooks/use-shifts";
import { generateTimeOptions, formatTime, calculateDuration } from "@/lib/time-utils";
import { useToast } from "@/hooks/use-toast";
import type { Shift } from "@shared/schema";

export default function Shifts() {
  const [searchTerm, setSearchTerm] = useState("");
  const [filterType, setFilterType] = useState("all");
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [shiftToEdit, setShiftToEdit] = useState<Shift | null>(null);
  
  const { data: allShifts, isLoading: shiftsLoading } = useShifts();
  const updateShiftMutation = useUpdateShift();
  const deleteShiftMutation = useDeleteShift();
  const { toast } = useToast();

  const timeOptions = generateTimeOptions();

  // Filter and search shifts
  const filteredShifts = useMemo(() => {
    if (!allShifts) return [];

    let filtered = allShifts;

    // Filter by shift type
    if (filterType !== "all") {
      filtered = filtered.filter(shift => shift.shiftType === filterType);
    }

    // Search filter
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      filtered = filtered.filter(shift => 
        shift.shiftType.toLowerCase().includes(term) ||
        shift.date.includes(term) ||
        shift.notes?.toLowerCase().includes(term) ||
        formatTime(shift.startTime).toLowerCase().includes(term) ||
        formatTime(shift.endTime).toLowerCase().includes(term)
      );
    }

    return filtered.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }, [allShifts, filterType, searchTerm]);

  const handleEditShift = (shift: Shift) => {
    setShiftToEdit(shift);
    setShowEditDialog(true);
  };

  const handleUpdateShift = async (shiftData: any) => {
    if (!shiftToEdit) return;

    try {
      await updateShiftMutation.mutateAsync({ 
        id: shiftToEdit.id, 
        ...shiftData 
      });
      
      toast({
        title: "Success",
        description: "Shift updated successfully!",
      });
      
      setShowEditDialog(false);
      setShiftToEdit(null);
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to update shift. Please try again.",
        variant: "destructive",
      });
    }
  };

  const handleDeleteShift = async (shiftId: number) => {
    try {
      await deleteShiftMutation.mutateAsync(shiftId);
      toast({
        title: "Success",
        description: "Shift deleted successfully!",
      });
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to delete shift. Please try again.",
        variant: "destructive",
      });
    }
  };

  const shiftTypeColors = {
    morning: 'bg-emerald-500',
    evening: 'bg-amber-500',
    night: 'bg-indigo-500',
    double: 'bg-red-500',
    custom: 'bg-violet-500'
  };

  const getShiftTypeVariant = (type: string) => {
    const variants: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
      morning: "default",
      evening: "secondary", 
      night: "outline",
      double: "destructive",
      custom: "secondary"
    };
    return variants[type] || "outline";
  };

  return (
    <div className="p-4 lg:p-8 space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">All Shifts</h1>
        <p className="text-slate-600">View, edit, and manage your shift history</p>
      </div>

      {/* Search and Filter Controls */}
      <Card>
        <CardContent className="p-6">
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="flex-1">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400 h-4 w-4" />
                <Input
                  placeholder="Search shifts by type, date, notes, or time..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>
            <div className="sm:w-48">
              <Select value={filterType} onValueChange={setFilterType}>
                <SelectTrigger>
                  <Filter className="h-4 w-4 mr-2" />
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Types</SelectItem>
                  <SelectItem value="morning">Morning</SelectItem>
                  <SelectItem value="evening">Evening</SelectItem>
                  <SelectItem value="night">Night</SelectItem>
                  <SelectItem value="double">Double</SelectItem>
                  <SelectItem value="custom">Custom</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Shifts List */}
      <Card>
        <CardContent className="p-0">
          {shiftsLoading ? (
            <div className="divide-y divide-slate-200">
              {Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="p-6 flex items-center justify-between">
                  <div className="flex items-center space-x-4">
                    <Skeleton className="w-3 h-3 rounded-full" />
                    <div>
                      <Skeleton className="h-4 w-32 mb-1" />
                      <Skeleton className="h-3 w-24" />
                    </div>
                  </div>
                  <div className="text-right">
                    <Skeleton className="h-4 w-40 mb-1" />
                    <Skeleton className="h-3 w-20" />
                  </div>
                  <div className="flex gap-2">
                    <Skeleton className="h-8 w-8" />
                    <Skeleton className="h-8 w-8" />
                  </div>
                </div>
              ))}
            </div>
          ) : filteredShifts.length > 0 ? (
            <div className="divide-y divide-slate-200">
              {filteredShifts.map((shift) => (
                <div key={shift.id} className="p-6 flex items-center justify-between hover:bg-slate-50 transition-colors">
                  <div className="flex items-center space-x-4">
                    <div className={`w-3 h-3 rounded-full ${
                      shiftTypeColors[shift.shiftType as keyof typeof shiftTypeColors] || 'bg-gray-500'
                    }`}></div>
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <p className="font-medium text-slate-900 capitalize">
                          {shift.shiftType} Shift
                        </p>
                        <Badge variant={getShiftTypeVariant(shift.shiftType)} className="text-xs">
                          {shift.shiftType}
                        </Badge>
                      </div>
                      <p className="text-sm text-slate-500">
                        {new Date(shift.date).toLocaleDateString('en-US', { 
                          weekday: 'short',
                          month: 'short', 
                          day: 'numeric', 
                          year: 'numeric' 
                        })}
                      </p>
                      {shift.notes && (
                        <p className="text-xs text-slate-400 mt-1 max-w-xs truncate">
                          {shift.notes}
                        </p>
                      )}
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="font-medium text-slate-900">
                      {formatTime(shift.startTime)} - {formatTime(shift.endTime)}
                    </p>
                    <p className="text-sm text-slate-500">
                      {calculateDuration(shift.startTime, shift.endTime).toFixed(2)} hours
                    </p>
                  </div>
                  <div className="flex items-center gap-2 ml-4">
                    <Button 
                      variant="ghost" 
                      size="sm" 
                      className="touch-target h-8 w-8 p-0"
                      onClick={() => handleEditShift(shift)}
                    >
                      <Edit className="h-4 w-4" />
                    </Button>
                    <Button 
                      variant="ghost" 
                      size="sm" 
                      className="touch-target h-8 w-8 p-0 text-red-600 hover:text-red-700 hover:bg-red-50"
                      onClick={() => handleDeleteShift(shift.id)}
                      disabled={deleteShiftMutation.isPending}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="p-12 text-center">
              <Clock className="h-12 w-12 text-slate-300 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-slate-900 mb-2">No shifts found</h3>
              <p className="text-slate-500">
                {searchTerm || filterType !== "all" 
                  ? "Try adjusting your search or filter criteria" 
                  : "Start tracking your shifts to see them here"
                }
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Edit Shift Modal */}
      <Dialog open={showEditDialog} onOpenChange={setShowEditDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Edit Shift</DialogTitle>
          </DialogHeader>
          
          {shiftToEdit && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="edit-shift-date">Date</Label>
                  <Input
                    id="edit-shift-date"
                    type="date"
                    defaultValue={shiftToEdit.date}
                    onChange={(e) => setShiftToEdit({...shiftToEdit, date: e.target.value})}
                  />
                </div>
                <div>
                  <Label htmlFor="edit-shift-type">Shift Type</Label>
                  <Select
                    value={shiftToEdit.shiftType}
                    onValueChange={(value) => setShiftToEdit({...shiftToEdit, shiftType: value})}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="morning">Morning</SelectItem>
                      <SelectItem value="evening">Evening</SelectItem>
                      <SelectItem value="night">Night</SelectItem>
                      <SelectItem value="double">Double</SelectItem>
                      <SelectItem value="custom">Custom</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="edit-start-time">Start Time</Label>
                  <Select
                    value={shiftToEdit.startTime}
                    onValueChange={(value) => setShiftToEdit({...shiftToEdit, startTime: value})}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {timeOptions.map((option) => (
                        <SelectItem key={option.value} value={option.value}>
                          {option.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label htmlFor="edit-end-time">End Time</Label>
                  <Select
                    value={shiftToEdit.endTime}
                    onValueChange={(value) => setShiftToEdit({...shiftToEdit, endTime: value})}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {timeOptions.map((option) => (
                        <SelectItem key={option.value} value={option.value}>
                          {option.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div>
                <Label htmlFor="edit-shift-notes">Notes</Label>
                <Textarea
                  id="edit-shift-notes"
                  placeholder="Add notes about this shift..."
                  defaultValue={shiftToEdit.notes || ''}
                  onChange={(e) => setShiftToEdit({...shiftToEdit, notes: e.target.value})}
                  rows={3}
                />
              </div>

              <div className="p-3 bg-slate-50 rounded-lg">
                <div className="text-sm text-slate-600">
                  Duration: <span className="font-semibold">{calculateDuration(shiftToEdit.startTime, shiftToEdit.endTime).toFixed(2)} hours</span>
                </div>
                <div className="text-sm text-slate-600">
                  Type: <span className="font-semibold capitalize">{shiftToEdit.shiftType}</span>
                </div>
              </div>
            </div>
          )}

          <DialogFooter className="gap-2">
            <Button
              variant="outline"
              onClick={() => setShowEditDialog(false)}
            >
              Cancel
            </Button>
            <Button
              onClick={() => {
                if (shiftToEdit) {
                  const { id, userId, createdAt, ...updateData } = shiftToEdit;
                  handleUpdateShift(updateData);
                }
              }}
              disabled={updateShiftMutation.isPending}
              className="flex items-center gap-2"
            >
              <Check className="h-4 w-4" />
              {updateShiftMutation.isPending ? "Updating..." : "Update"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}