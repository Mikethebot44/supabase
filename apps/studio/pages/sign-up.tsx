import { useState } from "react";
import { signUp } from "lib/auth-client";
import { Button, Input, Card, CardContent, CardHeader, CardTitle } from "ui";
import { AuthenticationLayout } from 'components/layouts/AuthenticationLayout';
import type { NextPageWithLayout } from 'types';
import { useRouter } from 'next/router';
import { toast } from 'sonner';

const SignUpPage: NextPageWithLayout = () => {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    
    // Add loading toast
    const loadingToast = toast.loading("Creating your account...");
    
    try {
      console.log("Attempting signup with:", { email, name, passwordLength: password.length });
      
      const result = await signUp.email({
        email,
        password,
        name,
      });
      
      console.log("Signup result:", result);
      
      // Dismiss loading toast
      toast.dismiss(loadingToast);
      
      if (result.error) {
        console.error("Signup error:", result.error);
        toast.error(result.error.message || "Sign up failed");
      } else {
        toast.success("Account created successfully!");
        router.push('/sign-in');
      }
    } catch (error: any) {
      console.error("Signup exception:", error);
      toast.dismiss(loadingToast);
      toast.error(error.message || "Sign up failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex items-center justify-center min-h-screen p-4">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>Sign Up</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSignUp} className="space-y-4">
            <div>
              <label htmlFor="name" className="block text-sm font-medium mb-1">
                Name
              </label>
              <Input
                id="name"
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Enter your name"
                required
              />
            </div>
            
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
                minLength={6}
              />
            </div>
            
            <Button 
              type="submit" 
              className="w-full" 
              disabled={loading}
            >
              {loading ? "Creating account..." : "Sign Up"}
            </Button>
          </form>
          
          <div className="mt-4 text-center">
            <p className="text-sm text-gray-600">
              Already have an account?{" "}
              <button 
                onClick={() => router.push('/sign-in')}
                className="text-blue-600 hover:underline"
              >
                Sign in
              </button>
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

SignUpPage.getLayout = (page) => (
  <AuthenticationLayout title="Sign Up">
    {page}
  </AuthenticationLayout>
);

export default SignUpPage;