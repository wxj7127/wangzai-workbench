# 旺仔学习工作台

> 个人学习 + 旺仔教育 + 健康管理，支持手机/iPad/电脑多设备同步

## 功能模块

- **个人学习**：招标竞赛每日120题（8.22考试）、税法复习（8.29考试）
- **旺仔教育**：二上语文预习（35课）、必背内容、口算、练字、阅读（19本）、运动、新概念英语A
- **其他事项**：每日维D

## 技术架构

- 前端：HTML + CSS + 原生 JS（无框架，零构建）
- 后端：Node.js + Express（提供静态文件服务 + 数据同步 API）
- 数据库：PostgreSQL（Render 免费版，存储打卡/进度/成绩）
- 同步机制：localStorage 本地缓存 + 远程 API 双向同步

## 本地运行

```bash
npm install
node server.js
# 打开 http://localhost:3000
```

无 DATABASE_URL 时自动降级为纯本地模式（仅 localStorage，不跨设备同步）。

## 部署到 Render（免费版）

### 方式一：Blueprint 一键部署（推荐）

1. 把代码推到 GitHub 仓库
2. 登录 https://dashboard.render.com
3. 点击 **New** → **Blueprint**
4. 选择你的 GitHub 仓库，Render 会自动读取 `render.yaml`
5. 点击 **Apply**，等待构建完成
6. 部署成功后会得到一个 `https://xxx.onrender.com` 地址
7. 手机/iPad/电脑打开同一个地址即可同步

### 方式二：手动创建

1. **创建 PostgreSQL 数据库**
   - Dashboard → New → PostgreSQL
   - Name: `workbench-db`
   - Plan: Free
   - 保存内部连接字符串

2. **创建 Web Service**
   - Dashboard → New → Web Service
   - 连接 GitHub 仓库
   - Runtime: Node
   - Build Command: `npm install`
   - Start Command: `node server.js`
   - 环境变量：
     - `DATABASE_URL` = PostgreSQL 连接字符串
     - `DATABASE_SSL` = `true`

3. 部署完成后访问分配的 URL

## 文件结构

```
├── index.html              # 主页（仪表盘 + 任务卡片）
├── server.js               # Express 后端（静态文件 + API）
├── package.json            # Node.js 依赖
├── render.yaml             # Render Blueprint 配置
├── assets/
│   ├── style.css           # 粉色系样式
│   ├── app.js              # 前端逻辑（打卡/倒计时/渲染）
│   ├── sync.js             # 多设备同步模块
│   └── practice.js         # 招标120题练习逻辑
├── data/
│   ├── app.js              # 考试/背诵/阅读/招标主题数据
│   ├── lessons.js          # 35课语文知识点
│   └── questions.js        # 120道招标题库
└── pages/
    ├── practice.html       # 招标每日120题
    ├── yuwen.html          # 语文预习详情
    ├── reading.html        # 阅读进度
    └── tax.html            # 税法复习
```

## API 接口

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/api/state` | 获取最新同步状态 |
| POST | `/api/state` | 保存同步状态 |
| POST | `/api/score` | 保存练习成绩 |
| GET | `/api/scores` | 获取历史成绩 |
| GET | `/api/health` | 健康检查 |

## 注意事项

- Render 免费版 Web Service 15分钟无访问会休眠，首次唤醒约需30秒
- Render 免费版 PostgreSQL 90天后过期，需升级或迁移
- 所有数据在本地 localStorage 有备份，后端不可用不影响基本使用
