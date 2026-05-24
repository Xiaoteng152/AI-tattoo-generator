import { auth, signOut } from "@/auth";
import { getAuthConfigStatus } from "@/lib/auth-config";
import { GoogleSignInButton } from "./GoogleSignInButton";

type AuthControlsProps = {
  callbackUrl?: string;
};

export async function AuthControls({ callbackUrl = "/" }: AuthControlsProps) {
  const session = await auth();
  const authConfig = getAuthConfigStatus();

  if (session?.user) {
    const label = session.user.name ?? session.user.email ?? "Signed in";

    return (
      <div className="ds-auth">
        <span className="ds-auth-user">{label}</span>
        <form
          action={async () => {
            "use server";
            await signOut({ redirectTo: "/" });
          }}
        >
          <button className="ds-auth-btn" type="submit">
            Sign out
          </button>
        </form>
      </div>
    );
  }

  return (
    <div className="ds-auth">
      <GoogleSignInButton
        callbackUrl={callbackUrl}
        disabled={!authConfig.ready}
      />
    </div>
  );
}
