# pi-web

[pi 编程智能体](https://github.com/badlogic/pi-mono) 的网页界面。在浏览器中浏览会话、与智能体对话、分叉对话、切换消息分支。

## 快速开始

**无需安装，直接运行：**

```bash
npx @agegr/pi-web@latest
```

**或全局安装后使用：**

```bash
npm install -g @agegr/pi-web
pi-web
```

启动后打开 [http://localhost:30141](http://localhost:30141)。

**可选参数：**

```bash
pi-web --port 8080               # 自定义端口
pi-web --hostname 127.0.0.1      # 仅本机访问
pi-web -p 8080 -H 127.0.0.1     # 组合使用

PORT=8080 pi-web                 # 也支持环境变量
```

## 功能介绍

- **会话浏览器** — 按工作目录分组展示所有 pi 会话
- **实时对话** — 通过 SSE 流式输出与智能体实时交互
- **会话分叉** — 从任意用户消息创建独立的新会话分支
- **会话内分支** — 回退到任意节点继续对话，在同一文件内创建分支
- **分支导航器** — 可视化切换同一会话内的各个分支
- **模型切换** — 对话中途随时切换模型
- **LLM Router** — 在 Manual / Auto 模式之间切换，按任务复杂度动态选择模型
- **工具面板** — 控制智能体可使用的工具
- **压缩会话** — 对长会话进行摘要，节省上下文窗口
- **引导 / 追加** — 打断正在运行的智能体，或在其完成后追加消息

## LLM Router

pi-web 内置轻量 LLM Router，用于在多个 provider / model 之间进行动态调度。它不会依赖固定的 provider 名称或模型显示名，而是从当前 `models.json` / model registry 动态读取可用模型，因此用户后续新增、删除、重命名 provider 或修改模型显示名后，仍可正常工作。

### 模式

- **Manual** — 手动选择模型。用户选择某个模型后，Auto Router 会关闭，后续请求严格使用该模型。
- **Auto** — 自动选择模型。发送消息前根据任务复杂度、当前 profile、模型能力和 provider 地址动态决定是否切换模型。

Manual 模式下，界面会高亮 `Manual` 和当前选中的模型；Auto 模式下，界面会高亮 `Auto` / profile，并将模型选择区灰化，表示当前模型只是参考状态，实际模型由 router 决策。

### Profiles

- **Cost saver** — 优先使用本地 / 免费模型；当本地模型失败或需要更高质量时，可升级到云端强模型。
- **Balanced** — 简单和标准任务优先本地模型；复杂、推理、视觉任务可按策略切换到更强模型。
- **Best quality** — 标准以上任务优先选择云端 / 强模型。

### 动态识别规则

Router 会优先使用显式配置；没有配置时会根据运行时信息推断：

- `provider + modelId` 是稳定身份，`model.name` 仅作为展示名。
- 本地 / 内网 `baseUrl`（如 `localhost`、`127.*`、`10.*`、`192.168.*`、`172.16-31.*`）倾向识别为 `local/free`。
- 公开 HTTPS `baseUrl` 倾向识别为 `cloud/paid`。
- 支持图片输入的模型会识别为 `vision`。
- 可识别的强模型名称（如 Kimi、Claude、GPT、DeepSeek 等）会作为能力加权信号。

### 配置文件

- 模型列表来自 `~/.pi/agent/models.json`，可在侧边栏「Models」面板编辑。
- Router 配置可保存在 `~/.pi/agent/router.json`，用于覆盖默认 profile、模型元数据或路由偏好。
- `auth.json`、`models.json`、`router.json`、`settings.json` 等本地配置不会提交到仓库。

## 注意事项

- **数据目录** — 默认读取 `~/.pi/agent/sessions` 下的会话文件。可通过环境变量 `PI_CODING_AGENT_DIR` 指定其他目录。
- **模型配置** — 从智能体数据目录下的 `models.json` 读取可用模型，可在侧边栏的「Models」面板中编辑。
- **文件浏览** — 侧边栏内置文件浏览器，可在标签页中查看当前工作目录下的文件。

## 开发

```bash
npm install
npm run dev   # 端口 30141
```

## 项目结构

```
app/
  api/
    sessions/      # 读写会话文件
    agent/         # 发送命令、SSE 事件流
    files/         # 文件内容读取
    models/        # 可用模型列表与默认模型
    models-config/ # 读写 models.json
    router/        # 读写 router.json 与执行路由决策
components/        # UI 组件
lib/
  llm-router.ts      # LLM Router 决策逻辑
  session-reader.ts  # 解析 .jsonl 会话文件
  rpc-manager.ts     # 管理 AgentSession 生命周期
  normalize.ts       # 规范化 toolCall 字段名
  types.ts
```

会话文件存储路径：`~/.pi/agent/sessions/<编码后的工作目录>/<时间戳>_<uuid>.jsonl`
