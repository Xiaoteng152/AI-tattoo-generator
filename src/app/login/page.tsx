import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { AuthConfigNotice } from "../components/AuthConfigNotice";
import { GoogleSignInButton } from "../components/GoogleSignInButton";
import { getAuthConfigStatus } from "@/lib/auth-config";

const AUTH_ERROR_MESSAGES: Record<string, string> = {
  Configuration:
    "Google OAuth 配置或网络异常。请检查 Client ID/Secret、Redirect URI，以及是否能访问 Google。",
  AccessDenied: "你已取消 Google 授权，或当前账号不在 OAuth 测试用户列表中。",
  OAuthSignin: "无法启动 Google 登录，请检查网络或代理设置。",
  OAuthCallback: "Google 回调失败，请确认 Redirect URI 与网络可访问 oauth2.googleapis.com。",
  Default: "登录失败，请稍后重试。"
};

type LoginPageProps = {
  searchParams: Promise<{ callbackUrl?: string; error?: string }>;
};

export default async function LoginPage({ searchParams }: LoginPageProps) {
  const session = await auth();
  const { callbackUrl, error } = await searchParams;
  const authErrorMessage = error
    ? (AUTH_ERROR_MESSAGES[error] ?? AUTH_ERROR_MESSAGES.Default)
    : null;
  const redirectTo = callbackUrl?.startsWith("/") ? callbackUrl : "/deepsearch";
  const authConfig = getAuthConfigStatus();

  if (session) {
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
            <p className="ds-small-label">Account</p>
            <h1 className="ds-section-title">Sign in to continue</h1>
            <p className="ds-empty">
              DeepSearch 与相关 API 需要 Google 账号登录。Dashboard 首页可匿名浏览。
            </p>

            <AuthConfigNotice status={authConfig} showNetworkHint />

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
