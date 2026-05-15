# Issue Tracker：本地 Markdown

本仓库的 PRD 和任务都保存在 `.scratch/` 下。

## 约定

- 每个功能一个目录：`.scratch/<feature-slug>/`
- PRD 文件：`.scratch/<feature-slug>/PRD.md`
- 实现任务文件：`.scratch/<feature-slug>/issues/<NN>-<slug>.md`，从 `01` 开始编号。
- 任务状态写在文件顶部附近的 `Status:` 行。
- 评论和对话历史追加到文件底部的 `## Comments` 区域。

## 当 Skill 说“发布到 issue tracker”

在 `.scratch/<feature-slug>/` 下创建新文件，目录不存在时先创建目录。

## 当 Skill 说“读取相关 ticket”

读取用户提供的路径或 issue 编号对应的 Markdown 文件。
