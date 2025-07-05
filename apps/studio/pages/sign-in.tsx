import { useState } from "react";
import { signIn } from "lib/auth-client";
import { Button, Input, Card, CardContent, CardHeader, CardTitle } from "ui";
import { AuthenticationLayout } from 'components/layouts/AuthenticationLayout';
import type { NextPageWithLayout } from 'types';
import { useRouter } from 'next/router';
import { toast } from 'sonner';

const SignInPage: NextPageWithLayout = () => {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    
    // Add loading toast
    const loadingToast = toast.loading("Signing you in...");
    
    try {
      console.log("Attempting signin with:", { email });
      
      const result = await signIn.email({
        email,
        password,
      });
      
      console.log("Signin result:", result);
      
      // Dismiss loading toast
      toast.dismiss(loadingToast);
      
      if (result.error) {
        console.error("Signin error:", result.error);
        if (result.error.message?.includes("email not verified")) {
          toast.error("Please verify your email before signing in. Check your inbox!");
        } else {
          toast.error(result.error.message || "Sign in failed");
        }
      } else {
        toast.success("Welcome back!");
        router.push('/');
      }
    } catch (error: any) {
      console.error("Signin exception:", error);
      toast.dismiss(loadingToast);
      toast.error(error.message || "Sign in failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex items-center justify-center min-h-screen p-4">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>Sign In</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSignIn} className="space-y-4">
            <div>
              <label htmlFor="email" className="block text-sm font-medium mb-1">
                Email
              </label>
              <Input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="Enter your email"
                required
              />
            </div>
            
            <div>
              <label htmlFor="password" className="block text-sm font-medium mb-1">
                Password
              </label>
              <Input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Enter your password"
                required
              />
            </div>
            
            <Button 
              type="submit" 
              className="w-full" 
              disabled={loading}
            >
              {loading ? "Signing in..." : "Sign In"}
            </Button>
          </form>
          
          <div className="mt-4 text-center">
            <p className="text-sm text-gray-600">
              Don't have an account?{" "}
              <button 
                onClick={() => router.push('/sign-up')}
                className="text-blue-600 hover:underline"
              >
                Sign up
              </button>
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

SignInPage.getLayout = (page) => (
  <AuthenticationLayout title="Sign In">
    {page}
  </AuthenticationLayout>
);

export default SignInPage;