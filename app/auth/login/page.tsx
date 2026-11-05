import { AuthShell } from "@/components/app/auth-shell";
import { LoginForm } from "@/components/login-form";

export default function Page() {
  return (
    <AuthShell>
        <LoginForm />
      </AuthShell>
  );
}
