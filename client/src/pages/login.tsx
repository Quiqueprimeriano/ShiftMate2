import { useState } from "react";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Clock } from "lucide-react";
import { FcGoogle } from "react-icons/fc";

export default function Login() {
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [rememberMe, setRememberMe] = useState(false);
  const { login, isLoggingIn } = useAuth();

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (email && name) {
      login({ email, name, rememberMe });
    }
  };

  const handleGoogleLogin = () => {
    window.location.href = "/api/auth/google?intent=login";
  };

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="mx-auto w-12 h-12 mb-4 flex items-center justify-center">
            <Clock className="w-12 h-12 text-blue-600" />
          </div>
          <CardTitle className="text-2xl font-bold">Welcome to ShiftMate</CardTitle>
          <CardDescription>
            Sign in to manage your work shifts
          </CardDescription>
        </CardHeader>
        <CardContent>
          {/* Google OAuth Button */}
          <Button
            variant="outline"
            className="w-full h-12"
            onClick={handleGoogleLogin}
            type="button"
            data-testid="button-google-signin"
          >
            <FcGoogle className="mr-2 h-5 w-5" />
            Sign in with Google
          </Button>
          
          {/* Separator */}
          <div className="relative my-6">
            <div className="absolute inset-0 flex items-center">
              <Separator className="w-full" />
            </div>
            <div className="relative flex justify-center text-xs uppercase">
              <span className="bg-white px-2 text-slate-500">
                Or continue with email
              </span>
            </div>
          </div>

          {/* Email/Name Login Form */}
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                placeholder="your@email.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>
            <div>
              <Label htmlFor="name">Full Name</Label>
              <Input
                id="name"
                type="text"
                placeholder="John Doe"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
              />
            </div>
            <div className="flex items-center space-x-2">
              <Checkbox 
                id="rememberMe" 
                checked={rememberMe}
                onCheckedChange={(checked) => setRememberMe(checked as boolean)}
              />
              <Label 
                htmlFor="rememberMe" 
                className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
              >
                Remember me for 30 days
              </Label>
            </div>
            <Button 
              type="submit" 
              className="w-full" 
              disabled={isLoggingIn || !email || !name}
            >
              {isLoggingIn ? "Signing in..." : "Sign In"}
            </Button>
          </form>
          
          <div className="mt-6 text-center">
            <p className="text-sm text-slate-500">
              New users will be automatically registered
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
