# 河图世界构建

> 维护虚构历法、制度规则与资源假设，解释推演如何从固定前提得出。

## 简介

世界构建是独立TypeScript／React河图插件。外部Agent通过河图稳定CLI/MCP发现并调用，作者在工作面阅读、比较、反馈；作品正文和正式决定由宿主管理。

## 快速上手

安装河图插件中心提供的固定运行包，再向当前Agent说明本次作品与目标。先发现当前安装版能力，再读取包内`hetu-world-studio`方法和已有工程。

读取固定正文与设定→建立明确历法与制度假设→核对日期和依赖→在固定情景计算资源→解释不足及影响→交给规划或宿主候选→按新依据继续。

## 开发

Node.js 25，固定依赖见`package-lock.json`。

```bash
npm ci
npm run build
npm run check
npm run test:unit
npm run test:machine
npm run test:ui
npm run package
```

机器与界面验收使用`acceptance-lock.json`固定的正式宿主；完整步骤见[开发与发布](docs/07-开发发布与维护.md)。

## 边界

正式正典归宿主；历史与经济判断归作者和外部Agent。本包只计算明确声明的虚构历法及整数资源，不推断真实地理、社会科学结论或自动修改正典。地图及行程投影复用小说图鉴，故事事件偏序复用小说规划。

## 文档

[功能清单](CAPABILITIES.md) · [产品与开发文档](docs/README.md) · [验收记录](docs/08-实施计划与验收记录.md)。

从[GitHub v0.1.0开发预览](https://github.com/wordflowlab/hetu-world-studio/releases/tag/v0.1.0)获取固定运行包；[发行验收](docs/research/release-acceptance.json)说明正式宿主、平台及证据边界。
