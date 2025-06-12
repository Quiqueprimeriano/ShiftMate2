import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Database, Users, Clock, Bell, RefreshCw } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

export default function Admin() {
  const [sqlQuery, setSqlQuery] = useState("");
  const [queryResult, setQueryResult] = useState<any>(null);
  const [isExecuting, setIsExecuting] = useState(false);
  const { toast } = useToast();

  // Fetch database stats
  const { data: dbStats, refetch: refetchStats } = useQuery({
    queryKey: ['/api/admin/stats'],
    queryFn: () => apiRequest('/api/admin/stats'),
  });

  // Fetch all users
  const { data: allUsers, refetch: refetchUsers } = useQuery({
    queryKey: ['/api/admin/users'],
    queryFn: () => apiRequest('/api/admin/users'),
  });

  // Fetch recent shifts
  const { data: recentShifts, refetch: refetchShifts } = useQuery({
    queryKey: ['/api/admin/shifts'],
    queryFn: () => apiRequest('/api/admin/shifts'),
  });

  const executeSqlQuery = async () => {
    if (!sqlQuery.trim()) {
      toast({
        title: "Error",
        description: "Please enter a SQL query",
        variant: "destructive",
      });
      return;
    }

    setIsExecuting(true);
    try {
      const result = await apiRequest('/api/admin/sql', {
        method: 'POST',
        body: JSON.stringify({ query: sqlQuery }),
        headers: {
          'Content-Type': 'application/json',
        },
      });
      setQueryResult(result);
      toast({
        title: "Success",
        description: "Query executed successfully",
      });
    } catch (error) {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to execute query",
        variant: "destructive",
      });
    } finally {
      setIsExecuting(false);
    }
  };

  const refreshAllData = () => {
    refetchStats();
    refetchUsers();
    refetchShifts();
    toast({
      title: "Data Refreshed",
      description: "All data has been refreshed from the database",
    });
  };

  return (
    <div className="p-4 lg:p-8 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Database Management</h1>
          <p className="text-slate-600">Manage users, shifts, and database operations</p>
        </div>
        <Button onClick={refreshAllData} variant="outline" className="flex items-center gap-2">
          <RefreshCw className="h-4 w-4" />
          Refresh Data
        </Button>
      </div>

      {/* Database Statistics */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-slate-600">Total Users</p>
                <p className="text-3xl font-bold text-blue-600">
                  {dbStats?.userCount || 0}
                </p>
              </div>
              <Users className="h-8 w-8 text-blue-600" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-slate-600">Total Shifts</p>
                <p className="text-3xl font-bold text-green-600">
                  {dbStats?.shiftCount || 0}
                </p>
              </div>
              <Clock className="h-8 w-8 text-green-600" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-slate-600">Total Hours</p>
                <p className="text-3xl font-bold text-purple-600">
                  {dbStats?.totalHours?.toFixed(1) || 0}h
                </p>
              </div>
              <Clock className="h-8 w-8 text-purple-600" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-slate-600">Notifications</p>
                <p className="text-3xl font-bold text-orange-600">
                  {dbStats?.notificationCount || 0}
                </p>
              </div>
              <Bell className="h-8 w-8 text-orange-600" />
            </div>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="users" className="space-y-6">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="users">Users</TabsTrigger>
          <TabsTrigger value="shifts">Recent Shifts</TabsTrigger>
          <TabsTrigger value="sql">SQL Console</TabsTrigger>
          <TabsTrigger value="schema">Database Schema</TabsTrigger>
        </TabsList>

        <TabsContent value="users">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Users className="h-5 w-5" />
                All Users
              </CardTitle>
            </CardHeader>
            <CardContent>
              {allUsers && allUsers.length > 0 ? (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>ID</TableHead>
                      <TableHead>Name</TableHead>
                      <TableHead>Email</TableHead>
                      <TableHead>Created</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {allUsers.map((user: any) => (
                      <TableRow key={user.id}>
                        <TableCell>{user.id}</TableCell>
                        <TableCell className="font-medium">{user.name}</TableCell>
                        <TableCell>{user.email}</TableCell>
                        <TableCell>{new Date(user.createdAt).toLocaleDateString()}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              ) : (
                <p className="text-slate-500 text-center py-8">No users found</p>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="shifts">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Clock className="h-5 w-5" />
                Recent Shifts
              </CardTitle>
            </CardHeader>
            <CardContent>
              {recentShifts && recentShifts.length > 0 ? (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>ID</TableHead>
                      <TableHead>User</TableHead>
                      <TableHead>Date</TableHead>
                      <TableHead>Time</TableHead>
                      <TableHead>Type</TableHead>
                      <TableHead>Duration</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {recentShifts.slice(0, 20).map((shift: any) => (
                      <TableRow key={shift.id}>
                        <TableCell>{shift.id}</TableCell>
                        <TableCell>{shift.userName || `User ${shift.userId}`}</TableCell>
                        <TableCell>{shift.date}</TableCell>
                        <TableCell>{shift.startTime} - {shift.endTime}</TableCell>
                        <TableCell>
                          <Badge variant="outline" className="capitalize">
                            {shift.shiftType}
                          </Badge>
                        </TableCell>
                        <TableCell>{shift.duration?.toFixed(2)}h</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              ) : (
                <p className="text-slate-500 text-center py-8">No shifts found</p>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="sql">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Database className="h-5 w-5" />
                SQL Console
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <label className="text-sm font-medium text-slate-700 mb-2 block">
                  SQL Query
                </label>
                <Textarea
                  placeholder="SELECT * FROM shiftmate_users LIMIT 10;"
                  value={sqlQuery}
                  onChange={(e) => setSqlQuery(e.target.value)}
                  rows={6}
                  className="font-mono text-sm"
                />
              </div>
              <Button 
                onClick={executeSqlQuery} 
                disabled={isExecuting}
                className="w-full"
              >
                {isExecuting ? "Executing..." : "Execute Query"}
              </Button>
              
              {queryResult && (
                <div className="mt-4">
                  <h4 className="text-sm font-medium text-slate-700 mb-2">Query Result:</h4>
                  <div className="bg-slate-50 p-4 rounded-lg overflow-auto max-h-96">
                    <pre className="text-sm font-mono">
                      {JSON.stringify(queryResult, null, 2)}
                    </pre>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="schema">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Database className="h-5 w-5" />
                Database Schema
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div>
                  <h4 className="font-semibold text-slate-900 mb-2">shiftmate_users</h4>
                  <div className="bg-slate-50 p-3 rounded-lg text-sm font-mono">
                    id (serial, primary key)<br/>
                    email (text, unique, not null)<br/>
                    name (text, not null)<br/>
                    created_at (timestamp, default now)
                  </div>
                </div>
                
                <div>
                  <h4 className="font-semibold text-slate-900 mb-2">shiftmate_shifts</h4>
                  <div className="bg-slate-50 p-3 rounded-lg text-sm font-mono">
                    id (serial, primary key)<br/>
                    user_id (integer, references users.id)<br/>
                    date (date, not null)<br/>
                    start_time (time, not null)<br/>
                    end_time (time, not null)<br/>
                    shift_type (text, not null)<br/>
                    notes (text)<br/>
                    is_recurring (boolean, default false)<br/>
                    recurring_pattern (text)<br/>
                    recurring_end_date (date)<br/>
                    created_at (timestamp, default now)
                  </div>
                </div>
                
                <div>
                  <h4 className="font-semibold text-slate-900 mb-2">shiftmate_notifications</h4>
                  <div className="bg-slate-50 p-3 rounded-lg text-sm font-mono">
                    id (serial, primary key)<br/>
                    user_id (integer, references users.id)<br/>
                    type (text, not null)<br/>
                    message (text, not null)<br/>
                    is_read (boolean, default false)<br/>
                    created_at (timestamp, default now)
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}