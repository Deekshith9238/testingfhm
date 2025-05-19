import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Loader2 } from "lucide-react";
import MainLayout from "@/components/MainLayout";

export default function VerifyEmailPage() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const [isVerifying, setIsVerifying] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const verifyEmail = async () => {
      try {
        const searchParams = new URLSearchParams(window.location.search);
        const token = searchParams.get("token");

        if (!token) {
          setError("Invalid verification link");
          setIsVerifying(false);
          return;
        }

        const response = await fetch(`/api/verify-email?token=${token}`);
        const data = await response.json();

        if (!response.ok) {
          throw new Error(data.message || "Verification failed");
        }

        toast({
          title: "Email verified",
          description: "Your email has been verified successfully. You can now log in.",
        });

        // Redirect to home page after successful verification
        setTimeout(() => setLocation("/"), 2000);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Verification failed");
      } finally {
        setIsVerifying(false);
      }
    };

    verifyEmail();
  }, [setLocation, toast]);

  return (
    <MainLayout>
      <div className="flex min-h-screen bg-neutral-50">
        <div className="flex flex-col justify-center flex-1 px-4 py-12">
          <div className="w-full max-w-md mx-auto text-center">
            {isVerifying ? (
              <div className="space-y-4">
                <Loader2 className="h-8 w-8 animate-spin mx-auto text-primary" />
                <h1 className="text-2xl font-bold">Verifying your email...</h1>
                <p className="text-neutral-600">Please wait while we verify your email address.</p>
              </div>
            ) : error ? (
              <div className="space-y-6">
                <div className="rounded-full w-16 h-16 bg-red-100 flex items-center justify-center mx-auto">
                  <i className="fas fa-times text-red-500 text-2xl" />
                </div>
                <h1 className="text-2xl font-bold text-red-500">Verification Failed</h1>
                <p className="text-neutral-600">{error}</p>
                <div className="space-y-4">
                  <Button
                    variant="outline"
                    onClick={() => setLocation("/")}
                    className="mx-auto"
                  >
                    Return to Home
                  </Button>
                  <p className="text-sm text-neutral-500">
                    If you're having trouble verifying your email,{" "}
                    <button
                      onClick={() => setLocation("/contact")}
                      className="text-primary hover:underline"
                    >
                      contact support
                    </button>
                  </p>
                </div>
              </div>
            ) : (
              <div className="space-y-6">
                <div className="rounded-full w-16 h-16 bg-green-100 flex items-center justify-center mx-auto">
                  <i className="fas fa-check text-green-500 text-2xl" />
                </div>
                <h1 className="text-2xl font-bold text-green-500">Email Verified</h1>
                <p className="text-neutral-600">
                  Your email has been verified successfully. You will be redirected to the home page.
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    </MainLayout>
  );
} 