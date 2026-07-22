import {
  AUTH_CONFIG_ISSUE_MESSAGES,
  type AuthConfigStatus
} from "@/lib/auth-config";

type AuthConfigNoticeProps = {
  status: AuthConfigStatus;
  showNetworkHint?: boolean;
};

export function AuthConfigNotice({
  status,
  showNetworkHint = false
}: AuthConfigNoticeProps) {
  if (status.ready && !showNetworkHint) {
    return null;
  }

  return (
    <div className="ds-auth-config-notice" role="status">
      {!status.ready ? (
        <>
          <p className="ds-auth-config-title">Google 登录尚未就绪</p>
          <p className="ds-auth-config-lead">
            请在项目根目录的 <code>.env.local</code> 中补齐以下配置，然后重启{" "}
            <code>npm run dev</code>：
          </p>
          <ul className="ds-auth-config-list">
            {status.issues.map((issue) => (
              <li key={issue}>{AUTH_CONFIG_ISSUE_MESSAGES[issue]}</li>
            ))}
          </ul>
          <p className="ds-auth-config-lead">
            Redirect URI 必须为{" "}
            <code>http://localhost:3003/api/auth/callback/google</code>
          </p>
        </>
      ) : null}

      {showNetworkHint ? (
        <p className="ds-auth-config-network">
          开发环境需能访问 <code>accounts.google.com</code>。若出现{" "}
          <code>fetch failed</code>，请检查 VPN/代理或网络策略。
        </p>
      ) : null}
    </div>
  );
}
