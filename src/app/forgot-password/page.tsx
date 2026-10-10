import type { Metadata } from "next";
import { ForgotPasswordForm } from "@/components/password-reset-forms";

export const metadata: Metadata = {
  title: "Forgot password | Manpost",
  robots: { index: false, follow: false },
  referrer: "no-referrer",
};

export default function ForgotPasswordPage() {
  return <ForgotPasswordForm />;
}
