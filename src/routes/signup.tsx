import { zodResolver } from "@hookform/resolvers/zod";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { Loader2 } from "lucide-react";
import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";

import { AuthLayout } from "@/components/auth/auth-layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { useSession } from "@/lib/auth/use-session";

export const Route = createFileRoute("/signup")({
  head: () => ({ meta: [{ title: "Sign up — AccountAI" }] }),
  component: SignupPage,
});

const schema = z.object({
  fullName: z.string().min(1, "Your name is required").max(120),
  companyName: z.string().min(1, "Company name is required").max(120),
  email: z.string().min(1, "Email is required").email("Enter a valid email address"),
  password: z.string().min(8, "Use at least 8 characters"),
});
type FormValues = z.infer<typeof schema>;

function SignupPage() {
  const { session, loading } = useSession();
  const navigate = useNavigate();
  const [submitting, setSubmitting] = useState(false);
  const [checkEmail, setCheckEmail] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<FormValues>({ resolver: zodResolver(schema) });

  useEffect(() => {
    if (!loading && session) void navigate({ to: "/app" });
  }, [loading, session, navigate]);

  const onSubmit = async (values: FormValues) => {
    setSubmitting(true);
    const { data, error } = await supabase.auth.signUp({
      email: values.email,
      password: values.password,
      options: {
        data: { full_name: values.fullName, company_name: values.companyName },
      },
    });
    setSubmitting(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    if (data.session) {
      await navigate({ to: "/app" });
      return;
    }
    setCheckEmail(true);
  };

  if (checkEmail) {
    return (
      <AuthLayout title="Check your email" description="We sent you a confirmation link.">
        <div className="space-y-4 rounded-xl border bg-muted/40 p-4 text-sm text-muted-foreground">
          <p>
            Confirm your address to activate your workspace — a demo company with sample
            transactions, invoices and VAT data will be ready as soon as you log in.
          </p>
          <Link to="/login" className="font-medium text-foreground underline underline-offset-4">
            Back to login
          </Link>
        </div>
      </AuthLayout>
    );
  }

  return (
    <AuthLayout
      title="Create your workspace"
      description="Set up your company and start asking your books questions."
      footer={
        <p className="text-center text-sm text-muted-foreground">
          Already have an account?{" "}
          <Link to="/login" className="font-medium text-foreground underline underline-offset-4">
            Log in
          </Link>
        </p>
      }
    >
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
        <div className="space-y-2">
          <Label htmlFor="fullName">Your name</Label>
          <Input
            id="fullName"
            autoComplete="name"
            placeholder="Jane Doe"
            {...register("fullName")}
          />
          {errors.fullName && <p className="text-xs text-destructive">{errors.fullName.message}</p>}
        </div>
        <div className="space-y-2">
          <Label htmlFor="companyName">Company name</Label>
          <Input id="companyName" placeholder="Nordic Consulting AB" {...register("companyName")} />
          {errors.companyName && (
            <p className="text-xs text-destructive">{errors.companyName.message}</p>
          )}
        </div>
        <div className="space-y-2">
          <Label htmlFor="email">Email</Label>
          <Input
            id="email"
            type="email"
            autoComplete="email"
            placeholder="you@company.com"
            {...register("email")}
          />
          {errors.email && <p className="text-xs text-destructive">{errors.email.message}</p>}
        </div>
        <div className="space-y-2">
          <Label htmlFor="password">Password</Label>
          <Input
            id="password"
            type="password"
            autoComplete="new-password"
            {...register("password")}
          />
          {errors.password && <p className="text-xs text-destructive">{errors.password.message}</p>}
        </div>
        <Button type="submit" className="w-full" disabled={submitting}>
          {submitting && <Loader2 className="animate-spin" />}
          Create account
        </Button>
      </form>
    </AuthLayout>
  );
}
