# Course Autoplay

> **This project is for learning purposes only.**

A Chrome Extension (Manifest V3) that automatically advances to the next chapter when a course video ends on an online learning platform.

## What it does

When watching course videos, this extension detects when a video finishes and clicks the "next chapter" button for you.

## How to use

1. Open Chrome → `chrome://extensions/`
2. Enable "Developer mode"
3. Click "Load unpacked" and select this folder
4. On a course page, click the extension icon and toggle **ON**
5. The extension stays active until you toggle **OFF**

## Files

- `manifest.json` — Extension configuration
- `content.js` — Detects video end and clicks next
- `background.js` — Manages toggle state
- `popup.html/js/css` — Toggle UI
- `test/` — Local test pages for development

## Learning goals

This project demonstrates:
- Chrome Extension Manifest V3 architecture
- Content scripts, background service workers, and popup communication
- Cross-frame DOM access and MutationObservers
- Message passing between extension components

## Disclaimer

This is an educational project created for learning browser extension development.

---

# 课程自动播放

> **本项目仅供学习使用。**

一个 Chrome 扩展程序（Manifest V3），在在线学习平台观看课程视频时，当视频结束自动点击"下一章"按钮。

## 功能

观看课程视频时，此扩展程序会在视频结束时自动点击"下一节"按钮。

## 使用方法

1. 打开 Chrome → `chrome://extensions/`
2. 开启"开发者模式"
3. 点击"加载已解压的扩展程序"，选择本文件夹
4. 在课程页面，点击扩展图标并将开关切换为**开启**
5. 扩展程序将保持活跃状态，直到你手动切换为**关闭**

## 文件说明

- `manifest.json` — 扩展配置
- `content.js` — 检测视频结束并点击下一节
- `background.js` — 管理开关状态
- `popup.html/js/css` — 开关界面
- `test/` — 本地测试页面，用于开发调试

## 学习目标

本项目展示了：
- Chrome 扩展 Manifest V3 架构
- 内容脚本、后台服务工作者和弹出窗口通信
- 跨 iframe DOM 访问和 MutationObserver
- 扩展组件之间的消息传递

## 声明

这是一个为学习浏览器扩展开发而创建的教育项目。
