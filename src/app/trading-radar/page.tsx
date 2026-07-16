import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { SiteNav } from "@/app/components/SiteNav";
import { TradingRadarClient } from "./TradingRadarClient";
import styles from "./trading-radar.module.css";

export const dynamic = "force-dynamic";

export default async function TradingRadarPage() {
  const session = await auth();
  if (!session?.user?.email) {
    redirect("/login?callbackUrl=/trading-radar");
  }

  return (
    <main className={styles.shell} lang="zh-CN">
      <header className={styles.header}>
        <div>
          <p className={styles.eyebrow}>Personal trading intelligence</p>
          <h1>交易博主雷达</h1>
          <p>只整理原文明确表达的交易信号，不替你生成交易计划。</p>
        </div>
        <SiteNav active="trading" />
      </header>
      <TradingRadarClient />
    </main>
  );
}
