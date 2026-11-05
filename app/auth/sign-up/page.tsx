import { AuthShell } from "@/components/app/auth-shell";
import { SignUpForm } from "@/components/sign-up-form";

export default function Page() {
  return (
    <AuthShell>
        <SignUpForm />
      </AuthShell>
  );
}
