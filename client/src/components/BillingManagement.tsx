import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Calendar, Plus } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";

interface PublicHoliday {
  id: number;
  date: string;
  description: string;
}

interface BillingManagementProps {
  companyId: number;
}

export function BillingManagement({ companyId }: BillingManagementProps) {
  const { toast } = useToast();
  const [showHolidayDialog, setShowHolidayDialog] = useState(false);

  const { data: holidays = [], isLoading, refetch } = useQuery<PublicHoliday[]>({
    queryKey: ['/api/public-holidays'],
  });

  const createHolidayMutation = useMutation({
    mutationFn: (data: Partial<PublicHoliday>) => apiRequest('POST', '/api/public-holidays', data),
    onSuccess: () => {
      toast({ title: "Holiday added successfully" });
      setShowHolidayDialog(false);
      refetch();
    },
    onError: () => {
      toast({ title: "Failed to add holiday", variant: "destructive" });
    },
  });

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold">Public Holidays</h3>
        <Dialog open={showHolidayDialog} onOpenChange={setShowHolidayDialog}>
          <DialogTrigger asChild>
            <Button size="sm">
              <Plus className="h-4 w-4 mr-2" />
              Add Holiday
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Add Public Holiday</DialogTitle>
            </DialogHeader>
            <HolidayForm
              onSubmit={(data) => createHolidayMutation.mutate(data)}
              isLoading={createHolidayMutation.isPending}
            />
          </DialogContent>
        </Dialog>
      </div>

      {isLoading ? (
        <div className="space-y-3">
          {[1, 2].map(i => <Skeleton key={i} className="h-16 w-full" />)}
        </div>
      ) : holidays.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-10">
            <Calendar className="h-10 w-10 text-slate-400 mb-3" />
            <p className="text-slate-500 mb-3">No holidays configured</p>
            <Button size="sm" onClick={() => setShowHolidayDialog(true)}>
              <Plus className="h-4 w-4 mr-2" />
              Add Holiday
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          {holidays.map((holiday) => (
            <Card key={holiday.id}>
              <CardContent className="flex items-center gap-3 p-4">
                <Calendar className="h-5 w-5 text-blue-600 flex-shrink-0" />
                <div>
                  <div className="font-medium">{holiday.description}</div>
                  <div className="text-sm text-slate-500">
                    {new Date(holiday.date).toLocaleDateString('en-US', {
                      weekday: 'long', year: 'numeric', month: 'long', day: 'numeric'
                    })}
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

function HolidayForm({ onSubmit, isLoading }: { onSubmit: (data: any) => void; isLoading: boolean }) {
  const [formData, setFormData] = useState({ date: '', description: '' });

  return (
    <form onSubmit={(e) => { e.preventDefault(); onSubmit(formData); }} className="space-y-4">
      <div>
        <Label>Date</Label>
        <Input type="date" value={formData.date} onChange={(e) => setFormData({ ...formData, date: e.target.value })} required />
      </div>
      <div>
        <Label>Description</Label>
        <Input value={formData.description} onChange={(e) => setFormData({ ...formData, description: e.target.value })} placeholder="e.g., New Year's Day" required />
      </div>
      <DialogFooter>
        <Button type="submit" disabled={isLoading}>{isLoading ? "Saving..." : "Add Holiday"}</Button>
      </DialogFooter>
    </form>
  );
}
