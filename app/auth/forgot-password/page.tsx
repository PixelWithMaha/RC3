import { AuthShell } from "@/components/app/auth-shell";
import { ForgotPasswordForm } from "@/components/forgot-password-form";

export default function Page() {
  return (
    <AuthShell>
        <ForgotPasswordForm />
      </AuthShell>
  );
}
