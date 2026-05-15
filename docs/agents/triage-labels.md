# Triage Labels

Skills 内部使用五个标准 triage 角色。这个文件把它们映射到本仓库本地 Markdown issue tracker 里的状态值。

| mattpocock/skills 中的标签 | 本仓库使用的状态 | 含义 |
| -------------------------- | ---------------- | ---- |
| `needs-triage`             | `needs-triage`   | 需要维护者评估 |
| `needs-info`               | `needs-info`     | 等待需求提出者补充信息 |
| `ready-for-agent`          | `ready-for-agent` | 需求已经足够明确，可以交给 agent 实现 |
| `ready-for-human`          | `ready-for-human` | 需要人类工程师实现 |
| `wontfix`                  | `wontfix`        | 不会处理 |

当 skill 提到某个角色时，把对应状态写入本地 issue 文件的 `Status:` 行。
