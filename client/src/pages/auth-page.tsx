import { useEffect, useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/use-auth";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { insertUserSchema } from "@shared/schema";
import { useQuery } from "@tanstack/react-query";
import { Loader2, X } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Redirect } from "wouter";
import MainLayout from "@/components/MainLayout";
import { FileUpload } from "@/components/ui/file-upload";

// Login form schema
const loginSchema = z.object({
  email: z.string().email("Invalid email address"),
  password: z.string().min(1, "Password is required"),
});

// Registration form schema
const registerSchema = insertUserSchema
  .extend({
    confirmPassword: z.string().min(6, "Password must be at least 6 characters"),
    isServiceProvider: z.boolean().default(false),
    // Provider-specific fields
    categoryId: z.string().optional(),
    hourlyRate: z.string().optional(),
    bio: z.string().optional(),
    yearsOfExperience: z.string().optional(),
    availability: z.string().optional(),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "Passwords don't match",
    path: ["confirmPassword"],
  })
  .refine(
    (data) => {
      if (data.isServiceProvider) {
        return !!data.categoryId && !!data.hourlyRate;
      }
      return true;
    },
    {
      message: "Category and hourly rate are required for service providers",
      path: ["categoryId"],
    }
  );

type LoginFormValues = z.infer<typeof loginSchema>;
type RegisterFormValues = z.infer<typeof registerSchema>;

interface AuthPageProps {
  isModal?: boolean;
  onClose?: () => void;
  defaultToProvider?: boolean;
  defaultToRegister?: boolean;
}

export default function AuthPage({ 
  isModal = false, 
  onClose, 
  defaultToProvider = false,
  defaultToRegister = false 
}: AuthPageProps) {
  const { user, loginMutation, registerMutation } = useAuth();
  const [activeTab, setActiveTab] = useState<string>(defaultToRegister ? "register" : "login");
  const [accountType, setAccountType] = useState<string>(defaultToProvider ? "provider" : "client");
  const [resendingVerification, setResendingVerification] = useState(false);
  const [profilePicture, setProfilePicture] = useState<File | null>(null);
  const { toast } = useToast();
  
  // Fetch service categories for provider signup
  const { data: categories } = useQuery({
    queryKey: ["/api/categories"],
    enabled: activeTab === "register" && accountType === "provider",
  });

  // Login form
  const loginForm = useForm<LoginFormValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      email: "",
      password: "",
    },
  });

  // Register form
  const registerForm = useForm<RegisterFormValues>({
    resolver: zodResolver(registerSchema),
    defaultValues: {
      username: "",
      email: "",
      password: "",
      confirmPassword: "",
      firstName: "",
      lastName: "",
      isServiceProvider: defaultToProvider,
      categoryId: "",
      hourlyRate: "",
      bio: "",
      yearsOfExperience: "",
      availability: "",
    },
    mode: "onBlur"
  });

  // Watch form values for debugging
  const formValues = registerForm.watch();
  useEffect(() => {
    console.log('Form values changed:', formValues);
  }, [formValues]);

  // Handle resend verification
  const handleResendVerification = async (email: string) => {
    try {
      setResendingVerification(true);
      const response = await fetch("/api/resend-verification", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || "Failed to resend verification email");
      }

      toast({
        title: "Verification email sent",
        description: "Please check your email for the verification link.",
      });
    } catch (err) {
      toast({
        title: "Error",
        description: err instanceof Error ? err.message : "Failed to resend verification email",
        variant: "destructive",
      });
    } finally {
      setResendingVerification(false);
    }
  };

  // Handle login form submission
  function onLoginSubmit(values: LoginFormValues) {
    loginMutation.mutate(values, {
      onError: (error) => {
        if (error.message?.includes("verify your email")) {
          toast({
            title: "Email not verified",
            description: (
              <div className="space-y-2">
                <p>{error.message}</p>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={resendingVerification}
                  onClick={() => handleResendVerification(values.email)}
                >
                  {resendingVerification ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Sending...
                    </>
                  ) : (
                    "Resend verification email"
                  )}
                </Button>
              </div>
            ),
          });
        } else {
          toast({
            title: "Error",
            description: error.message,
            variant: "destructive",
          });
        }
      },
    });
  }

  // Handle register form submission
  async function onRegisterSubmit(values: RegisterFormValues) {
    console.log('Starting registration submission with raw values:', values);
    
    try {
      // Create form data for multipart/form-data submission
      const formData = new FormData();
      
      // Add all required fields
      const requiredFields = {
        username: values.username,
        email: values.email,
        password: values.password,
        firstName: values.firstName,
        lastName: values.lastName,
        confirmPassword: values.confirmPassword,
        isServiceProvider: accountType === "provider"
      };
      
      console.log('Required fields:', requiredFields);
      
      // Validate required fields
      for (const [key, value] of Object.entries(requiredFields)) {
        if (value === undefined || value === '') {
          throw new Error(`${key} is required`);
        }
        formData.append(key, value.toString());
      }
      
      // Add provider-specific fields if this is a provider account
      if (accountType === "provider") {
        const providerFields = {
          categoryId: values.categoryId,
          hourlyRate: values.hourlyRate,
          bio: values.bio || '',
          yearsOfExperience: values.yearsOfExperience || '0',
          availability: values.availability || ''
        };
        
        console.log('Provider fields:', providerFields);
        
        for (const [key, value] of Object.entries(providerFields)) {
          if (value !== undefined) {
            formData.append(key, value.toString());
          }
        }
      }
      
      // Add profile picture if selected
      if (profilePicture) {
        formData.append('profilePicture', profilePicture);
        console.log('Added profile picture to form data');
      }
      
      // Log final form data for debugging
      console.log('Final form data entries:');
      for (const [key, value] of formData.entries()) {
        console.log(`${key} = ${value}`);
      }
      
      registerMutation.mutate(formData, {
        onSuccess: (data) => {
          console.log('Registration successful:', data);
          toast({
            title: "Registration successful",
            description: "Please check your email to verify your account.",
          });
        },
        onError: (error) => {
          console.error('Registration failed:', error);
          toast({
            title: "Registration failed",
            description: error.message,
            variant: "destructive",
          });
        }
      });
    } catch (error) {
      console.error('Form validation error:', error);
      toast({
        title: "Validation Error",
        description: error instanceof Error ? error.message : "Please fill in all required fields",
        variant: "destructive",
      });
    }
  }

  // Handle account type change
  const handleAccountTypeChange = (value: string) => {
    setAccountType(value);
    registerForm.setValue("isServiceProvider", value === "provider");
  };

  // If user is already logged in and this is not a modal, redirect to home
  if (user && !isModal) {
    return <Redirect to="/" />;
  }
  // Render the auth page content
  const authContent = (
    <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
      <TabsList className="grid w-full grid-cols-2">
        <TabsTrigger value="login">Login</TabsTrigger>
        <TabsTrigger value="register">Register</TabsTrigger>
      </TabsList>

      {/* Login Form */}
      <TabsContent value="login" className="p-6">
        <div className="space-y-6">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Welcome back</h1>
            <p className="text-sm text-muted-foreground mt-1">
              Enter your email below to login to your account
            </p>
          </div>

          <Form {...loginForm}>
            <form onSubmit={loginForm.handleSubmit(onLoginSubmit)} className="space-y-4">
              <FormField
                control={loginForm.control}
                name="email"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Email</FormLabel>
                    <FormControl>
                      <Input 
                        type="email" 
                        placeholder="youremail@example.com" 
                        {...field} 
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={loginForm.control}
                name="password"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Password</FormLabel>
                    <FormControl>
                      <Input 
                        type="password" 
                        placeholder="••••••••" 
                        {...field} 
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <Button 
                type="submit" 
                className="w-full"
                disabled={loginMutation.isPending}
              >
                {loginMutation.isPending ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Logging in...
                  </>
                ) : (
                  "Login"
                )}
              </Button>
            </form>
          </Form>
        </div>
      </TabsContent>

      {/* Register Form */}
      <TabsContent value="register" className="p-6">
        <div className="space-y-6">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Create an account</h1>
            <p className="text-sm text-muted-foreground mt-1">
              Enter your details below to create your account
            </p>
          </div>

          {/* Account Type Selection */}
          <div>
            <Label>Account Type</Label>
            <RadioGroup
              value={accountType}
              onValueChange={handleAccountTypeChange}
              className="grid grid-cols-2 gap-4 mt-2"
            >
              <Label
                htmlFor="client"
                className={`flex flex-col items-center justify-between rounded-md border-2 p-4 cursor-pointer hover:border-primary ${
                  accountType === "client" ? "border-primary" : "border-neutral-200"
                }`}
              >
                <RadioGroupItem value="client" id="client" className="sr-only" />
                <div className="w-12 h-12 rounded-full bg-primary-light flex items-center justify-center mb-2">
                  <i className="fas fa-user text-primary text-xl"></i>
                </div>
                <span className="font-medium">I need services</span>
                <p className="text-sm text-neutral-500 mt-1">Hire skilled professionals</p>
              </Label>
              <Label
                htmlFor="provider"
                className={`flex flex-col items-center justify-between rounded-md border-2 p-4 cursor-pointer hover:border-primary ${
                  accountType === "provider" ? "border-primary" : "border-neutral-200"
                }`}
              >
                <RadioGroupItem value="provider" id="provider" className="sr-only" />
                <div className="w-12 h-12 rounded-full bg-secondary-light flex items-center justify-center mb-2">
                  <i className="fas fa-briefcase text-secondary text-xl"></i>
                </div>
                <span className="font-medium">I provide services</span>
                <p className="text-sm text-neutral-500 mt-1">Offer skills & earn money</p>
              </Label>
            </RadioGroup>
          </div>

          <Form {...registerForm}>
            <form onSubmit={registerForm.handleSubmit(onRegisterSubmit)} className="space-y-4">
              <div className="space-y-4">
                <FileUpload
                  onChange={setProfilePicture}
                  value={profilePicture}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={registerForm.control}
                  name="firstName"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>First Name</FormLabel>
                      <FormControl>
                        <Input placeholder="John" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={registerForm.control}
                  name="lastName"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Last Name</FormLabel>
                      <FormControl>
                        <Input placeholder="Doe" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <FormField
                control={registerForm.control}
                name="username"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Username</FormLabel>
                    <FormControl>
                      <Input placeholder="johndoe" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={registerForm.control}
                name="email"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Email</FormLabel>
                    <FormControl>
                      <Input type="email" placeholder="youremail@example.com" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={registerForm.control}
                name="password"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Password</FormLabel>
                    <FormControl>
                      <Input type="password" placeholder="••••••••" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={registerForm.control}
                name="confirmPassword"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Confirm Password</FormLabel>
                    <FormControl>
                      <Input type="password" placeholder="••••••••" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Provider-specific fields */}
              {accountType === "provider" && (
                <div className="space-y-4 border-t pt-4 mt-4">
                  <h3 className="font-medium">Service provider details</h3>

                  <FormField
                    control={registerForm.control}
                    name="categoryId"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Service Category</FormLabel>
                        <Select
                          onValueChange={field.onChange}
                          defaultValue={field.value}
                        >
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Select your main service" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {categories?.map((category) => (
                              <SelectItem
                                key={category.id}
                                value={category.id.toString()}
                              >
                                {category.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={registerForm.control}
                    name="hourlyRate"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Hourly Rate ($)</FormLabel>
                        <FormControl>
                          <Input
                            type="number"
                            min="1"
                            placeholder="25"
                            {...field}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={registerForm.control}
                    name="bio"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>About Your Services</FormLabel>
                        <FormControl>
                          <Textarea
                            placeholder="Describe your experience, skills, and the services you offer..."
                            className="min-h-20"
                            {...field}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <div className="grid grid-cols-2 gap-4">
                    <FormField
                      control={registerForm.control}
                      name="yearsOfExperience"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Years of Experience</FormLabel>
                          <FormControl>
                            <Input
                              type="number"
                              min="0"
                              placeholder="5"
                              {...field}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={registerForm.control}
                      name="availability"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Availability</FormLabel>
                          <FormControl>
                            <Input
                              placeholder="Weekdays, 9AM-5PM"
                              {...field}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                </div>
              )}

              <Button 
                type="submit" 
                className="w-full"
                disabled={registerMutation.isPending}
              >
                {registerMutation.isPending ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Creating Account...
                  </>
                ) : (
                  "Create Account"
                )}
              </Button>

              <p className="text-sm text-neutral-600 text-center mt-4">
                By signing up, you agree to our{" "}
                <a href="#" className="text-primary hover:underline">
                  Terms of Service
                </a>{" "}
                and{" "}
                <a href="#" className="text-primary hover:underline">
                  Privacy Policy
                </a>
              </p>
            </form>
          </Form>
        </div>
      </TabsContent>
    </Tabs>
  );

  // If it's a modal, just return the content
  if (isModal) {
    return (
      <div className="relative max-h-[80vh] overflow-y-auto scrollbar-hide pt-8">
        {authContent}
      </div>
    );
  }

  // Otherwise, wrap it in the main layout
  return (
    <MainLayout>
      <div className="flex min-h-screen bg-neutral-50">
        <div className="flex flex-col justify-center flex-1 px-4 py-12 sm:px-6 lg:flex-none lg:px-20 xl:px-24">
          <div className="w-full max-w-md mx-auto lg:w-96">
            {authContent}
          </div>
        </div>
        <div className="relative hidden w-0 flex-1 lg:block">
          <div className="absolute inset-0 bg-gradient-to-r from-primary to-blue-700 flex flex-col justify-center items-center text-white p-12">
            <div className="max-w-xl">
              <h2 className="text-3xl font-bold mb-4">Connect with local service professionals</h2>
              <p className="text-xl mb-6">
                Find My Helper connects you with skilled professionals for all your service needs.
              </p>
              <div className="space-y-4">
                <div className="flex items-center">
                  <div className="w-10 h-10 rounded-full bg-white/20 flex items-center justify-center mr-3">
                    <i className="fas fa-check text-white"></i>
                  </div>
                  <span className="text-lg">Quick and reliable service</span>
                </div>
                <div className="flex items-center">
                  <div className="w-10 h-10 rounded-full bg-white/20 flex items-center justify-center mr-3">
                    <i className="fas fa-check text-white"></i>
                  </div>
                  <span className="text-lg">Verified professionals</span>
                </div>
                <div className="flex items-center">
                  <div className="w-10 h-10 rounded-full bg-white/20 flex items-center justify-center mr-3">
                    <i className="fas fa-check text-white"></i>
                  </div>
                  <span className="text-lg">Secure transactions</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </MainLayout>
  );
}
