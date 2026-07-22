# Grok Radar VPS collector

第一版采集器按技术设计执行：

1. `POST /grok-runs/reserve` 预占本周额度并拉取博主/关键词/窗口/策略
2. 一次调用 `grok-4.5` + `--reasoning-effort medium` + `x_search`
3. 本地校验 URL / 作者 / 时间 / evidence
4. `POST /grok-ingest` HMAC 上传；失败进入 `pending-upload` 只重传不重跑模型

服务器路径：

- 程序：`/opt/grok-radar`
- 数据：`/var/lib/grok-radar`
- 环境：`/etc/grok-radar.env`

```dotenv
GROK_RADAR_API_URL="https://<production-domain>/api/trading-radar"
GROK_INGEST_SECRET="<same-as-vercel>"
GROK_BIN="/home/grok-runner/.grok/bin/grok"
GROK_RADAR_TIMEOUT="180"
```

Timer（北京时间周二/周五 08:30）：

```ini
OnCalendar=Tue,Fri *-*-* 00:30:00 UTC
```

常用命令：

```bash
sudo systemctl start grok-radar.service
sudo systemctl status grok-radar.service
sudo journalctl -u grok-radar.service -n 100 --no-pager
sudo systemctl list-timers grok-radar.timer
# 不调用模型，只重放 raw：
GROK_RADAR_REPLAY_RAW=/var/lib/grok-radar/raw/<runId>.json sudo -E -u grok-runner python3 /opt/grok-radar/collect.py
```

本地测试：

```bash
python3 -m unittest ops/grok-radar/test_collect.py
```

注意：

- 该采集器是语义发现工具，不是完整 Timeline。
- 不自动交易；页面以原推 URL 为最终核验入口。
- 同一生产环境只能启用 Grok 调度，不要并行开启官方 X 15 分钟 Cron。
