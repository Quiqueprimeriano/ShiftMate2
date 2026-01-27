import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Users,
  UserPlus,
  Search,
  Settings,
  User,
  Mail,
  Shield,
  UserCheck,
  UserX,
  Clock,
  Send,
  Trash2,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { queryClient, apiRequest } from "@/lib/queryClient";

interface Employee {
  id: number;
  name: string;
  email: string;
  role: string | null;
  isActive: boolean;
  companyId: number;
}

interface Invitation {
  id: number;
  email: string;
  role: string;
  expiresAt: string;
  createdAt: string;
}

interface EmployeeManagementProps {
  companyId: number;
  onConfigureRates?: (employeeId: number) => void;
}

export function EmployeeManagement({ companyId, onConfigureRates }: EmployeeManagementProps) {
  const { toast } = useToast();
  const [searchQuery, setSearchQuery] = useState("");
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [newEmployeeEmail, setNewEmployeeEmail] = useState("");
  const [newEmployeeRole, setNewEmployeeRole] = useState("employee");

  // Fetch employees
  const { data: employees = [], isLoading } = useQuery<Employee[]>({
    queryKey: ['/api/companies', companyId, 'employees'],
    queryFn: async () => {
      const response = await apiRequest('GET', `/api/companies/${companyId}/employees`);
      return response.json();
    },
    enabled: !!companyId,
  });

  // Fetch pending invitations
  const { data: invitations = [], isLoading: isLoadingInvitations } = useQuery<Invitation[]>({
    queryKey: ['/api/companies', companyId, 'invitations'],
    queryFn: async () => {
      const response = await apiRequest('GET', `/api/companies/${companyId}/invitations`);
      return response.json();
    },
    enabled: !!companyId,
  });

  // Invite employee mutation
  const inviteEmployeeMutation = useMutation({
    mutationFn: async ({ email, role }: { email: string; role: string }) => {
      const response = await apiRequest('POST', `/api/companies/${companyId}/invite-employee`, {
        email,
        role,
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Failed to add employee');
      }
      return response.json();
    },
    onSuccess: (data) => {
      if (data.invitationSent) {
        toast({
          title: "Invitation sent",
          description: "An email invitation has been sent to the employee"
        });
        queryClient.invalidateQueries({ queryKey: ['/api/companies', companyId, 'invitations'] });
      } else {
        toast({ title: "Employee added successfully" });
        queryClient.invalidateQueries({ queryKey: ['/api/companies', companyId, 'employees'] });
      }
      setIsAddDialogOpen(false);
      setNewEmployeeEmail("");
      setNewEmployeeRole("employee");
    },
    onError: (error: any) => {
      toast({
        title: "Failed to add employee",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Toggle active mutation
  const toggleActiveMutation = useMutation({
    mutationFn: async ({ userId, isActive }: { userId: number; isActive: boolean }) => {
      const response = await apiRequest('PUT', `/api/companies/${companyId}/employees/${userId}/toggle-active`, {
        isActive,
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Failed to update employee status');
      }
      return response.json();
    },
    onSuccess: (data) => {
      toast({
        title: data.employee.isActive ? "Employee activated" : "Employee deactivated"
      });
      queryClient.invalidateQueries({ queryKey: ['/api/companies', companyId, 'employees'] });
    },
    onError: (error: any) => {
      toast({
        title: "Failed to update employee status",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Cancel invitation mutation
  const cancelInvitationMutation = useMutation({
    mutationFn: async (invitationId: number) => {
      const response = await apiRequest('DELETE', `/api/companies/${companyId}/invitations/${invitationId}`);
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Failed to cancel invitation');
      }
      return response.json();
    },
    onSuccess: () => {
      toast({ title: "Invitation cancelled" });
      queryClient.invalidateQueries({ queryKey: ['/api/companies', companyId, 'invitations'] });
    },
    onError: (error: any) => {
      toast({
        title: "Failed to cancel invitation",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Resend invitation mutation
  const resendInvitationMutation = useMutation({
    mutationFn: async ({ email, role }: { email: string; role: string }) => {
      const response = await apiRequest('POST', `/api/companies/${companyId}/invite-employee`, {
        email,
        role,
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Failed to resend invitation');
      }
      return response.json();
    },
    onSuccess: () => {
      toast({ title: "Invitation resent successfully" });
      queryClient.invalidateQueries({ queryKey: ['/api/companies', companyId, 'invitations'] });
    },
    onError: (error: any) => {
      toast({
        title: "Failed to resend invitation",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Filter employees based on search query
  const filteredEmployees = employees.filter((employee) => {
    const query = searchQuery.toLowerCase();
    return (
      employee.name?.toLowerCase().includes(query) ||
      employee.email?.toLowerCase().includes(query)
    );
  });

  // Filter invitations based on search query
  const filteredInvitations = invitations.filter((invitation) => {
    const query = searchQuery.toLowerCase();
    return invitation.email?.toLowerCase().includes(query);
  });

  const handleAddEmployee = () => {
    if (!newEmployeeEmail.trim()) {
      toast({
        title: "Email required",
        description: "Please enter the employee's email address",
        variant: "destructive",
      });
      return;
    }
    inviteEmployeeMutation.mutate({ email: newEmployeeEmail.trim(), role: newEmployeeRole });
  };

  const handleToggleActive = (employee: Employee) => {
    toggleActiveMutation.mutate({ userId: employee.id, isActive: !employee.isActive });
  };

  const getRoleBadge = (role: string | null) => {
    switch (role) {
      case 'manager':
        return <Badge variant="default" className="bg-purple-100 text-purple-800">Manager</Badge>;
      case 'owner':
        return <Badge variant="default" className="bg-blue-100 text-blue-800">Owner</Badge>;
      default:
        return <Badge variant="secondary">Employee</Badge>;
    }
  };

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" />
            Team Members
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {[1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-20 w-full" />
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Users className="h-5 w-5" />
              Team Members
            </CardTitle>
            <p className="text-sm text-muted-foreground mt-1">
              Manage your team and their access
            </p>
          </div>
          <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
            <DialogTrigger asChild>
              <Button>
                <UserPlus className="h-4 w-4 mr-2" />
                Add Employee
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Add Employee</DialogTitle>
                <DialogDescription>
                  Add an employee to your team. If they don't have an account, they'll receive an invitation email.
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <Label htmlFor="email">Email Address</Label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                    <Input
                      id="email"
                      type="email"
                      placeholder="employee@example.com"
                      value={newEmployeeEmail}
                      onChange={(e) => setNewEmployeeEmail(e.target.value)}
                      className="pl-10"
                    />
                  </div>
                  <p className="text-xs text-muted-foreground">
                    If the user doesn't have a ShiftMate account, they'll receive an email invitation
                  </p>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="role">Role</Label>
                  <Select value={newEmployeeRole} onValueChange={setNewEmployeeRole}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select role" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="employee">
                        <div className="flex items-center gap-2">
                          <User className="h-4 w-4" />
                          Employee
                        </div>
                      </SelectItem>
                      <SelectItem value="manager">
                        <div className="flex items-center gap-2">
                          <Shield className="h-4 w-4" />
                          Manager
                        </div>
                      </SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setIsAddDialogOpen(false)}>
                  Cancel
                </Button>
                <Button
                  onClick={handleAddEmployee}
                  disabled={inviteEmployeeMutation.isPending}
                >
                  {inviteEmployeeMutation.isPending ? "Adding..." : "Add Employee"}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Search Bar */}
        <div className="relative">
          <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search by name or email..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10"
          />
        </div>

        {/* Pending Invitations */}
        {filteredInvitations.length > 0 && (
          <div className="space-y-3 mb-6">
            <h3 className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <Clock className="h-4 w-4" />
              Pending Invitations ({filteredInvitations.length})
            </h3>
            {filteredInvitations.map((invitation) => (
              <div
                key={invitation.id}
                className="flex items-center justify-between p-4 border rounded-lg bg-amber-50 border-amber-200"
              >
                <div className="flex items-center gap-4">
                  {/* Avatar placeholder */}
                  <div className="w-12 h-12 rounded-full flex items-center justify-center bg-amber-100">
                    <Mail className="h-5 w-5 text-amber-600" />
                  </div>

                  {/* Info */}
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-medium">{invitation.email}</span>
                      <Badge variant="outline" className="bg-amber-100 text-amber-800 border-amber-300">
                        Pending
                      </Badge>
                      {getRoleBadge(invitation.role)}
                    </div>
                    <p className="text-sm text-muted-foreground">
                      Expires {new Date(invitation.expiresAt).toLocaleDateString()}
                    </p>
                  </div>
                </div>

                {/* Actions */}
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => resendInvitationMutation.mutate({ email: invitation.email, role: invitation.role })}
                    disabled={resendInvitationMutation.isPending}
                  >
                    <Send className="h-4 w-4 mr-1" />
                    Resend
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => cancelInvitationMutation.mutate(invitation.id)}
                    disabled={cancelInvitationMutation.isPending}
                    className="text-red-600 hover:text-red-700 hover:bg-red-50"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Employee List */}
        {filteredEmployees.length === 0 && filteredInvitations.length === 0 ? (
          <div className="text-center py-12">
            <Users className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            {searchQuery ? (
              <>
                <h3 className="text-lg font-medium">No employees found</h3>
                <p className="text-muted-foreground">
                  No employees match your search "{searchQuery}"
                </p>
              </>
            ) : (
              <>
                <h3 className="text-lg font-medium">No employees yet</h3>
                <p className="text-muted-foreground">
                  Add employees to your team to get started
                </p>
              </>
            )}
          </div>
        ) : filteredEmployees.length > 0 && (
          <div className="space-y-3">
            {filteredEmployees.map((employee) => (
              <div
                key={employee.id}
                className={`flex items-center justify-between p-4 border rounded-lg transition-colors ${
                  employee.isActive ? 'bg-white' : 'bg-gray-50 opacity-75'
                }`}
              >
                <div className="flex items-center gap-4">
                  {/* Avatar */}
                  <div className={`w-12 h-12 rounded-full flex items-center justify-center ${
                    employee.isActive ? 'bg-blue-100' : 'bg-gray-200'
                  }`}>
                    <span className={`text-lg font-semibold ${
                      employee.isActive ? 'text-blue-700' : 'text-gray-500'
                    }`}>
                      {employee.name?.charAt(0).toUpperCase() || 'U'}
                    </span>
                  </div>

                  {/* Info */}
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="font-medium">{employee.name || 'Unknown'}</h3>
                      {getRoleBadge(employee.role)}
                    </div>
                    <p className="text-sm text-muted-foreground">{employee.email}</p>
                  </div>
                </div>

                {/* Actions */}
                <div className="flex items-center gap-4">
                  {/* Status Badge */}
                  <div className="flex items-center gap-2">
                    {employee.isActive ? (
                      <UserCheck className="h-4 w-4 text-green-600" />
                    ) : (
                      <UserX className="h-4 w-4 text-gray-400" />
                    )}
                    <span className={`text-sm ${employee.isActive ? 'text-green-600' : 'text-gray-400'}`}>
                      {employee.isActive ? 'Active' : 'Inactive'}
                    </span>
                  </div>

                  {/* Toggle Switch */}
                  <Switch
                    checked={employee.isActive}
                    onCheckedChange={() => handleToggleActive(employee)}
                    disabled={toggleActiveMutation.isPending || employee.role === 'owner'}
                  />

                  {/* Configure Rates Button */}
                  {onConfigureRates && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => onConfigureRates(employee.id)}
                    >
                      <Settings className="h-4 w-4 mr-1" />
                      Rates
                    </Button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Summary */}
        <div className="flex items-center justify-between pt-4 border-t text-sm text-muted-foreground">
          <span>
            {filteredEmployees.length} employee{filteredEmployees.length !== 1 ? 's' : ''}
            {filteredInvitations.length > 0 && `, ${filteredInvitations.length} pending`}
            {searchQuery && ` matching "${searchQuery}"`}
          </span>
          <span>
            {filteredEmployees.filter(e => e.isActive).length} active
          </span>
        </div>
      </CardContent>
    </Card>
  );
}
