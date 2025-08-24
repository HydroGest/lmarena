# LMarena 手办化插件

一个 Koishi 插件，用于对接 LMarena 服务调用 nano-banana 等模型进行图片生成，特别适用于手办化效果。

灵感来源：https://github.com/Zhalslar/astrbot_plugin_lmarena/

## 功能特性

- 🖼️ 支持多种图片输入方式：直接发送、回复消息、@用户头像
- ✨ 内置多种手办化风格："手办化"、"手办化2"、"手办化3"
- 🎨 支持自定义描述词生成（bnn 命令）
- 🔄 自动处理 GIF 图片（提取第一帧）
- 📦 可选的图片保存功能
- ⚙️ 高度可配置的服务器参数

## 安装指南

### 前置要求

1. 确保已安装 "Koishi" (https://koishi.chat/) 机器人框架
2. 已部署 "LMarenaBridge" (https://github.com/Lianues/LMarenaBridge) 服务
3. Node.js 16+ 环境

### 安装插件

通过 Koishi 控制台界面安装

### 配置说明

```yml
plugins:
  lmarena:
    prefix: true          # 是否启用触发前缀
    baseUrl: http://127.0.0.1:5102  # LMarena 服务地址
    model: nano-banana    # 使用的模型
    saveImage: false      # 是否保存生成的图片
    retries: 2            # 失败重试次数
```

## 使用说明

### 基本命令

| 命令 | 描述 |
|------|------|
| `手办化` + 图片 | 使用默认手办化风格处理图片 |
| `手办化2` + 图片 | 使用第二种手办化风格 |
| `手办化3` + 图片 | 使用第三种手办化风格 |
| `bnn 描述词` + 图片 | 使用自定义描述词生成图片 |
| `手办化@用户` | 使用用户头像生成手办化图片 |

## 常见问题

### 图片生成失败怎么办？

1. 检查 LMarena 服务是否正常运行
2. 确认配置中的 
"baseUrl" 正确
3. 尝试增加 
"retries" 配置值
4. 检查网络连接是否正常

## 许可证

本项目采用 "MIT 许可证" (LICENSE)。