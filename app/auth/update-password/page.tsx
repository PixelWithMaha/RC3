import { AuthShell } from "@/components/app/auth-shell";
import { UpdatePasswordForm } from "@/components/update-password-form";

export default function Page() {
  return (
    <AuthShell>
        <UpdatePasswordForm />
      </AuthShell>
  );
}
