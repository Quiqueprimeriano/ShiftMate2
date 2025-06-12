import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Database } from "lucide-react";

export default function Admin() {
  return (
    <div className="p-4 lg:p-8 space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Database Management</h1>
        <p className="text-slate-600">View database schema and execute SQL queries</p>
      </div>

      <div className="grid grid-cols-1 gap-6">
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

        <Card>
          <CardHeader>
            <CardTitle>Database Management Commands</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              <div className="bg-slate-50 p-3 rounded-lg">
                <h5 className="font-medium text-slate-900 mb-1">Push Schema Changes</h5>
                <code className="text-sm text-slate-600">npm run db:push</code>
                <p className="text-xs text-slate-500 mt-1">Applies schema changes to the database</p>
              </div>
              
              <div className="bg-slate-50 p-3 rounded-lg">
                <h5 className="font-medium text-slate-900 mb-1">SQL Queries</h5>
                <p className="text-sm text-slate-600">Use the SQL execution tool to run direct queries</p>
                <p className="text-xs text-slate-500 mt-1">Access database tables and perform operations</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}