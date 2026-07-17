import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { AuthConfigNotice } from "@/app/components/AuthConfigNotice";
import { GoogleSignInButton } from "@/app/components/GoogleSignInButton";
import { getAuthConfigStatus } from "@/lib/auth-config";
import { getSafeAuthRedirect } from "@/lib/auth-redirect";

const AUTH_ERROR_MESSAGES: Record<string, string> = {
  Configuration:
    "Google OAuth 配置异常，请检查 Client ID、Client Secret 和生产回调地址。",
  AccessDenied: "你已取消 Google 授权，或当前账号没有访问权限。",
  OAuthSignin: "无法启动 Google 登录，请稍后重试。",
  OAuthCallback: "Google 登录回调失败，请确认生产回调地址配置正确。",
  Default: "登录失败，请稍后重试。"
};

type LoginPageProps = {
  searchParams: Promise<{
    callbackUrl?: string | string[];
    error?: string | string[];
  }>;
};

export default async function LoginPage({ searchParams }: LoginPageProps) {
  const session = await auth();
  const params = await searchParams;
  const redirectTo = getSafeAuthRedirect(params.callbackUrl);
  const error = typeof params.error === "string" ? params.error : undefined;
  const authErrorMessage = error
    ? (AUTH_ERROR_MESSAGES[error] ?? AUTH_ERROR_MESSAGES.Default)
    : null;
  const authConfig = getAuthConfigStatus();

  if (session?.user) {
    redirect(redirectTo);
  }

  return (
    <main className="ds-page">
      <div className="ds-frame">
        <header className="ds-top">
          <Link className="ds-logo" href="/">
            <span aria-hidden className="ds-logo-dot" />
            Automnic TT
          </Link>
        </header>

        <div className="ds-body">
          <section className="ds-panel ds-login-panel">
            <p className="ds-small-label">Trading Radar</p>
            <h1 className="ds-section-title">Sign in to continue</h1>
            <p className="ds-empty">
              使用 Google 账号登录后查看交易博主、最新推文和 AI 交易摘要。
            </p>

            <AuthConfigNotice status={authConfig} />

            {authErrorMessage ? (
              <p className="ds-auth-config-notice" role="alert">
                {authErrorMessage}
              </p>
            ) : null}

            <GoogleSignInButton
              callbackUrl={redirectTo}
              className="ds-auth-btn ds-auth-btn--google ds-auth-btn--block"
              disabled={!authConfig.ready}
            />

            <Link className="ds-secondary-link" href="/">
              Back to Dashboard
            </Link>
          </section>
        </div>
      </div>
    </main>
  );
}
