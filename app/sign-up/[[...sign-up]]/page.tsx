import { SignUp } from "@clerk/nextjs";

export default function SignUpPage() {
  return (
    <div className="flex items-center justify-center h-screen">
      <SignUp 
        fallbackRedirectUrl="/pricing"
        signInFallbackRedirectUrl="/chat"
      />
    </div>
  );
}
