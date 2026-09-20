# open-boost

> 面向主流开源终端 Coding Harness（Pi、OpenCode、OMP）的通用对抗式深度推理多 Agent 插件。
>
> 专为高性价比 Flash 系列模型（`gemini-3.8-flash`、`deepseek-v4.1-flash`、`qwen-2.5-coder-32b`）深度优化。

[English](./README.md) | [简体中文](./README_CN.md)

[![License: Apache-2.0](https://img.shields.io/badge/License-Apache_2.0-blue.svg)](https://opensource.org/licenses/Apache-2.0)
[![Node.js](https://img.shields.io/badge/Node.js-%3E%3D18.0.0-green.svg)](https://nodejs.org/)
[![NPM Version](https://img.shields.io/npm/v/open-boost.svg)](https://www.npmjs.com/package/open-boost)
[![Tests](https://img.shields.io/badge/Tests-Passing-brightgreen.svg)]()

---

## 项目概述

### 核心命题
**深度推理源于对抗式交互协议与严格的认知契约，而非单纯堆砌模型参数。**

`open-boost` 将源自 Google Antigravity 的 `/boost` 深度推理机制进行开源实现与生态适配，首期完整支持三大主流开源终端 Coding Harness：

- **Pi Coding Agent** (`pi`)
- **OpenCode** (`opencode`)
- **Oh My Pi** (`omp`)

通过物理级工具隔离、双阶段对抗式执行（**L0 Worker 从零实现** ➔ **Improvement Worker 破坏性验证**）以及怀疑论报告契约，`open-boost` 使得极低成本的 Flash 梯队模型能够稳健解决并发竞态条件、复杂跨文件重构以及深层代码根因排查等高难度任务。

```mermaid
flowchart TD
    User["用户输入: /boost &lt;task&gt;"] --> Orchestrator["Orchestrator 主会话编排层<br/>声明路由: Solo / Delegation<br/>铁律: No Pre-work | Verbatim 透传"]
    
    Orchestrator -->|"简单任务/快速答疑"| Solo["Solo 快速响应"]
    Orchestrator -->|"代码实现 / Bug 修复"| CoderCoord["boost-coder-coordinator<br/>空壳协调员 (tools: [])"]
    Orchestrator -->|"排查调查 / 只读分析"| InvestCoord["boost-investigator-coordinator<br/>空壳协调员 (tools: [])"]
    
    subgraph CoderPipeline ["编码流水线 (DeepCoder Pipeline)"]
        CoderCoord -->|"Step 1: &lt;original_task&gt;"| CoderL0["boost-coder-l0 (全量工具)<br/>从零实现 + 真实测试执行"]
        CoderL0 -->|"Step 2: &lt;original_task&gt; + &lt;prior_attempt&gt;"| CoderImp["boost-coder-improvement (全量工具)<br/>对抗式破坏(Break-It) ➔ 修复 ➔ 复验"]
        CoderImp -->|"Step 3: 回传完整报告"| CoderCoord
    end
    
    subgraph InvestPipeline ["调查流水线 (DeepInvestigator Pipeline)"]
        InvestCoord -->|"Step 1: &lt;original_task&gt;"| InvestL0["boost-investigator-l0 (只读白名单)<br/>端到端调用链追踪 + 行号锚定证据"]
        InvestL0 -->|"Step 2: &lt;original_task&gt; + &lt;prior_attempt&gt;"| InvestImp["boost-investigator-improvement (只读)<br/>质疑既有结论 + 补全盲区 + 终审判决"]
        InvestImp -->|"Step 3: 回传调查结论"| InvestCoord
    end
    
    CoderCoord -->|"DeepCoder completed"| Orchestrator
    InvestCoord -->|"DeepInvestigator completed"| Orchestrator
    
    Orchestrator -.->|"独立抽查发现剩余缺口:<br/>重新调用同一 coordinator 附带 &lt;prior_attempt&gt;"| CoderCoord
    Orchestrator -.->|"调查同理保持会话延续性"| InvestCoord
```

---

## 安装指引

运行环境要求：Node.js `>= 18.0.0`。全平台支持（Linux、macOS、Windows），零原生编译依赖（Zero Native Dependencies）。

### 方式一：通过 npm / npx（推荐，无需克隆代码）

```bash
# 直接免安装执行安装器
npx open-boost install

# 或作为全局 CLI 工具安装
npm install -g open-boost
open-boost status
open-boost install
```

### 方式二：源码安装

```bash
git clone https://github.com/YunhaoFu/open-boost.git
cd open-boost

# 检查当前环境检测到的 harness 状态
node install.js status

# 一键安装至所有检测到的 harness
node install.js install
```

### 定向安装到指定 Harness

```bash
# 仅安装至指定目标
open-boost install --target pi
open-boost install --target opencode
open-boost install --target omp
open-boost install --target pi,omp
```

---

## 使用说明

在您习惯的终端 Coding Harness 中直接输入 `/boost`：

### 1. Pi Coding Agent (`pi`)
```bash
pi
> /boost 修复 connection_pool.py 中的高并发死锁问题，确保无连接泄漏
```
或非交互单轮模式：
```bash
pi -p "/boost 修复 connection_pool.py 中的高并发死锁问题"
```

### 2. OpenCode (`opencode`)
```bash
opencode
> /boost 深入排查请求负载超过 2MB 时超时激增的原因，保持只读不改代码
```
或通过注册命令执行：
```bash
opencode run "/boost 调查批处理任务中的内存泄漏点"
```

### 3. Oh My Pi (`omp`)
```bash
omp
> /boost 修复 moving_avg.py 滑窗浮点累积误差 bug，pytest 必须全绿，严禁修改测试
```

---

## 架构与核心守恒量 (Invariants)

系统在跨平台与不同模型下严格恪守 7 项行为守恒量：

1. **声明式路由 (Declarative Routing)**：编排者在采取任何行动前，必须在控制台显式声明 `Solo` 或 `Delegation` 模式。
2. **No Pre-work 铁律**：主会话编排层在首次委派前，禁止私自检索代码库或读取编辑文件，职责严格限定为“只路由、不解题”。
3. **高保真原样传话 (Verbatim Forwarding)**：发送给协调员的 `<original_task>` 必须与用户原始输入逐字一致。
4. **会话延续不另起 (Continuity)**：编排层抽查若发现缺口追加下一轮，必须向同一个 Coordinator 发起，并完整携带上一轮报告。
5. **宁多勿少 (Aggressive Continuation)**：凡存在未覆盖要求、模糊范围、潜在 Bug 或 Worker 自认未测盲区，强制追加改进轮次。
6. **怀疑论报告协议 (Skepticism Protocol)**：
   - 必须包含 `Skepticism Disclaimer` 置信度声明。
   - 三级验证体系：`Deep`（必须附带真实执行命令及原始控制台输出）、`Shallow`（仅人工审视）、`Unverified`（明确盲区）。
   - 结构化已知问题分类：`Fatal Functional Bug`、`Shallow Verification`、`Minor Robustness Risk`。
   - 改进轮必须包含具象复现用例：`input → expected → actual → root cause → fix`。
7. **单次原子交付 (Single Atomic Delivery)**：子 Agent 运行全程静默，禁止零散中间状态消息，执行完毕一次性交付结构化成果。

---

## Flash 模型认知防御体系

针对轻量级 Flash 模型（如 Gemini-3.8-Flash、DeepSeek-v4.1-Flash）常见认知缺陷施加的针对性防线：

- **防谄媚预承诺 (Anti-Sycophancy)**：改进轮 Worker 必须在**不阅读**上一轮报告的前提下，首先独立阐述对任务的理解与攻击切入点，且必须找到至少一个缺陷用例才允许通过。
- **防浅度验证 (Anti-Shallow-Verification)**：强制要求真实的终端执行输出；并在代码修改前后比对测试文件哈希，防范模型私自弱化或删除测试用例。
- **物理阻断角色漂移 (Anti-Drift)**：Coordinator 在配置层物理移除修改工具（`tools: []`），从底层彻底切断协调员直接修改代码的可能性。
- **自愈输出解析器 (Auto-Healing Parser)**：底层集成自愈解析机制，自动剔除网关层意外包装的 JSON 外壳或冗余代码围栏。

---

## 仓库结构

```
open-boost/
├── install.js                     # 顶层极简启动脚本 (支持 npx / node 直接运行)
├── package.json                   # NPM 包规范定义及 CLI 映射
├── README.md                      # 英文说明文档
├── README_CN.md                   # 中文说明文档
├── packages/
│   ├── core/                      # SSOT 核心提示词与契约规格
│   │   ├── prompts/               # 7 个核心 Agent 提示词原型
│   │   │   ├── orchestrator.md
│   │   │   ├── boost-coder-coordinator.md
│   │   │   ├── boost-coder-l0.md
│   │   │   ├── boost-coder-improvement.md
│   │   │   ├── boost-investigator-coordinator.md
│   │   │   ├── boost-investigator-l0.md
│   │   │   └── boost-investigator-improvement.md
│   │   └── specs/                 # 输出结构 JSON Schema
│   ├── compiler/                  # 跨端转译编译器 (根据目标 Harness 格式生成产物)
│   │   └── src/index.js
│   ├── adapters/                  # 各 Harness 专用配置打补丁与扩展
│   │   ├── omp/index.js           # OMP 递归深度配置与文件分发
│   │   ├── pi/index.js            # Pi 扩展包注册与 slash 命令对接
│   │   └── opencode/index.js      # OpenCode JSONC 配置注入与 Agent 规则
│   └── cli/                       # CLI 自动探测与安装逻辑
│       ├── bin/open-boost.js
│       └── src/installer.js
├── dist/                          # 预编译生成的即用插件分发包
│   ├── omp/
│   ├── pi/
│   └── opencode/
└── test/
    └── open-boost.test.js         # Node.js 原生自动化单元测试套件
```

---

## 开发与测试

```bash
# 执行自动化单元测试
npm test

# 检查当前环境各大 Harness 的安装就绪状态
npm run status

# 从 core/prompts 重新编译各 Harness 分发产物
npm run build
```

---

## 开源许可证

本项目基于 [Apache License 2.0](./LICENSE) 协议开源。
