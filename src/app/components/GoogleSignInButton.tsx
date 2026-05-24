import { signIn } from "@/auth";

type GoogleSignInButtonProps = {
  callbackUrl?: string;
  className?: string;
  disabled?: boolean;
};

export function GoogleSignInButton({
  callbackUrl = "/",
  className = "ds-auth-btn ds-auth-btn--google",
  disabled = false
}: GoogleSignInButtonProps) {
  if (disabled) {
    return (
      <button className={`${className} ds-auth-btn--disabled`} type="button" disabled>
        Sign in with Google
      </button>
    );
  }

  return (
    <form
      action={async () => {
        "use server";
        await signIn("google", { redirectTo: callbackUrl });
      }}
    >
      <button className={className} type="submit">
        Sign in with Google
      </button>
    </form>
  );
}
