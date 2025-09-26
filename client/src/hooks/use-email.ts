import { useMutation } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

export function useSendRosterEmail(companyId: number) {
  const { toast } = useToast();
  
  return useMutation({
    mutationFn: async (data: {
      employeeId: number;
      weekStart: string;
      weekEnd: string;
    }) => {
      console.log('Sending roster email for employee:', data.employeeId);
      const response = await apiRequest('POST', `/api/companies/${companyId}/send-roster-email`, data);
      return response.json();
    },
    onSuccess: (data: any) => {
      console.log('Roster email sent successfully:', data);
      toast({
        title: "Email Sent",
        description: `Roster email sent successfully to ${data.employee}`,
      });
    },
    onError: (error) => {
      console.error('Failed to send roster email:', error);
      toast({
        title: "Email Failed",
        description: "Failed to send roster email. Please try again.",
        variant: "destructive",
      });
    },
  });
}

export function useSendAllRosterEmails(companyId: number) {
  const { toast } = useToast();
  
  return useMutation({
    mutationFn: async (data: {
      weekStart: string;
      weekEnd: string;
    }) => {
      console.log('Sending roster emails to all employees for week:', data.weekStart, 'to', data.weekEnd);
      const response = await apiRequest('POST', `/api/companies/${companyId}/send-all-roster-emails`, data);
      return response.json();
    },
    onSuccess: (data: any) => {
      console.log('Roster emails sent:', data);
      toast({
        title: "Emails Sent",
        description: `${data.summary.successful}/${data.summary.total} roster emails sent successfully`,
      });
    },
    onError: (error) => {
      console.error('Failed to send roster emails:', error);
      toast({
        title: "Email Failed",
        description: "Failed to send roster emails. Please try again.",
        variant: "destructive",
      });
    },
  });
}