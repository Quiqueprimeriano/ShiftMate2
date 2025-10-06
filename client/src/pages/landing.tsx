import { useState } from "react";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Building2, User, Clock, BarChart3, Shield, Users, Timer, FileText, Calendar, TrendingUp } from "lucide-react";

export default function Landing() {
  const [selectedPlan, setSelectedPlan] = useState<'individual' | 'business' | null>(null);

  const individualFeatures = [
    { icon: Timer, title: "Personal Timer", desc: "Track your own shifts with precision" },
    { icon: Calendar, title: "Personal Calendar", desc: "View and manage your schedule" },
    { icon: FileText, title: "Reports & Export", desc: "Generate detailed shift reports" },
    { icon: BarChart3, title: "Analytics", desc: "Track your productivity trends" },
  ];

  const businessFeatures = [
    { icon: Users, title: "Team Management", desc: "Manage multiple employees and shifts" },
    { icon: Shield, title: "Shift Approval", desc: "Review and approve employee timesheets" },
    { icon: TrendingUp, title: "Advanced Analytics", desc: "Business insights and reporting" },
    { icon: Building2, title: "Multi-location", desc: "Handle multiple business locations" },
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-100">
      {/* Header */}
      <header className="bg-white/80 backdrop-blur-sm border-b border-slate-200/50 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center space-x-3">
              <Clock className="w-8 h-8 text-blue-600" />
              <h1 className="text-xl font-bold text-slate-900">ShiftMate</h1>
            </div>
            <div className="flex items-center space-x-4">
              <Link href="/login?type=individual">
                <Button variant="ghost" size="sm">Sign In</Button>
              </Link>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        {/* Hero Section */}
        <div className="text-center mb-16">
          <h1 className="text-4xl md:text-6xl font-bold text-slate-900 mb-6">
            Everything in one place
          </h1>
          <p className="text-xl text-slate-600 max-w-3xl mx-auto mb-8">
            No more manual spreadsheets or outdated paper schedules. ShiftMate works seamlessly across desktop and mobile.
          </p>
          <div className="flex justify-center">
            <Badge variant="secondary" className="px-4 py-2 text-sm">
              Try ShiftMate Premium for free, find the right plan later
            </Badge>
          </div>
        </div>

        {/* Plan Selection */}
        <div className="grid md:grid-cols-2 gap-8 max-w-5xl mx-auto mb-16">
          {/* Individual Plan */}
          <Card className={`relative transition-all duration-300 hover:shadow-xl cursor-pointer ${
            selectedPlan === 'individual' ? 'ring-2 ring-blue-500 shadow-lg' : ''
          }`} onClick={() => setSelectedPlan('individual')}>
            <CardContent className="p-8">
              <div className="text-center mb-6">
                <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-4">
                  <User className="h-8 w-8 text-blue-600" />
                </div>
                <h3 className="text-2xl font-bold text-slate-900 mb-2">For Individuals</h3>
                <p className="text-slate-600">Perfect for freelancers and shift workers</p>
              </div>

              <div className="space-y-4 mb-8">
                {individualFeatures.map((feature, index) => (
                  <div key={index} className="flex items-start space-x-3">
                    <feature.icon className="h-5 w-5 text-blue-600 mt-0.5 flex-shrink-0" />
                    <div>
                      <p className="font-medium text-slate-900">{feature.title}</p>
                      <p className="text-sm text-slate-600">{feature.desc}</p>
                    </div>
                  </div>
                ))}
              </div>

              <div className="text-center">
                <div className="mb-4">
                  <span className="text-3xl font-bold text-slate-900">Free</span>
                  <span className="text-slate-600 ml-2">to start</span>
                </div>
                <Link href="/login?type=individual">
                  <Button 
                    className="w-full bg-blue-600 hover:bg-blue-700" 
                    size="lg"
                  >
                    Join team on ShiftMate
                  </Button>
                </Link>
              </div>
            </CardContent>
          </Card>

          {/* Business Plan */}
          <Card className={`relative transition-all duration-300 hover:shadow-xl cursor-pointer ${
            selectedPlan === 'business' ? 'ring-2 ring-indigo-500 shadow-lg' : ''
          }`} onClick={() => setSelectedPlan('business')}>
            <CardContent className="p-8">
              <div className="text-center mb-6">
                <div className="w-16 h-16 bg-indigo-100 rounded-full flex items-center justify-center mx-auto mb-4">
                  <Building2 className="h-8 w-8 text-indigo-600" />
                </div>
                <h3 className="text-2xl font-bold text-slate-900 mb-2">For Business</h3>
                <p className="text-slate-600">Manage teams and streamline operations</p>
              </div>

              <div className="space-y-4 mb-8">
                {businessFeatures.map((feature, index) => (
                  <div key={index} className="flex items-start space-x-3">
                    <feature.icon className="h-5 w-5 text-indigo-600 mt-0.5 flex-shrink-0" />
                    <div>
                      <p className="font-medium text-slate-900">{feature.title}</p>
                      <p className="text-sm text-slate-600">{feature.desc}</p>
                    </div>
                  </div>
                ))}
              </div>

              <div className="text-center">
                <div className="mb-4">
                  <span className="text-3xl font-bold text-slate-900">$29</span>
                  <span className="text-slate-600 ml-2">per month</span>
                </div>
                <Link href="/login?type=business">
                  <Button 
                    className="w-full bg-indigo-600 hover:bg-indigo-700" 
                    size="lg"
                  >
                    Create business on ShiftMate
                  </Button>
                </Link>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Footer CTA */}
        <div className="text-center">
          <p className="text-slate-600 mb-4">Already have an account?</p>
          <Link href="/login">
            <Button variant="outline" size="lg">Log in</Button>
          </Link>
        </div>
      </main>
    </div>
  );
}