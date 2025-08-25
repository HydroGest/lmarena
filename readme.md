# koishi-plugin-lmarena

[![npm](https://img.shields.io/npm/v/koishi-plugin-lmarena?style=flat-square)](https://www.npmjs.com/package/koishi-plugin-lmarena)

🎯 **一键将图片转换为手办风格！**

基于 LMArena Bridge API，支持多种 AI 绘图模型，让你的图片瞬间变成精美手办。

## 🚀 后端部署教程

> **重要提示**：这里以【flux-1-kontext-pro】模型为例。
> 
> 需要有桌面环境和 Python 环境。

### 第一步：安装浏览器插件

1. 访问：https://github.com/Lianues/LMArenaBridge/blob/main/TampermonkeyScript/LMArenaApiBridge.js
2. 打开 Tampermonkey 扩展的管理面板
3. 点击"添加新脚本"或"Create a new script"
4. 将 `TampermonkeyScript/LMArenaApiBridge.js` 文件中的所有代码复制并粘贴到编辑器中
5. 保存脚本
6. **注意：** 请按照 [tampermonkey#Q209](https://www.tampermonkey.net/faq.php#Q209) 操作，开启开发者模式。

### 第二步：部署 Python 后端

```bash
# 克隆项目
git clone https://github.com/Lianues/LMarenaBridge
cd LMarenaBridge

# 安装依赖
pip install -r requirements.txt

# 启动 API 服务器（保持运行）
python api_server.py
```

**注意**：这个项目必须先运行 `python api_server.py` 才能运行其他附属 py 文件。

### 第三步：开始部署服务

#### 3.1 更新模型列表
1. 保持第一个 cmd 窗口运行的 `python api_server.py`。
2. 使用安装了脚本的浏览器，打开：https://lmarena.ai/?mode=direct&chat-modality=image
3. 在网页上方选择模型为【flux-1-kontext-pro】
4. 新开一个 cmd 窗口，运行：`python model_updater.py`
5. 运行完成后关闭这个窗口

#### 3.2 获取模型 Session ID
3. 使用安装了脚本的浏览器，打开：https://lmarena.ai/?mode=direct&chat-modality=image
2. 新开一个 cmd 终端，运行：`python id_updater.py`（**保持运行状态**）
4. 在网页上方选择模型为【flux-1-kontext-pro】
5. 输入任意提示词，进行交互生成图片
6. 等待模型返回图片后，**点击图片右上角的重试按钮**
7. 这样就算是完成了【python id_updater.py】的配置
8. 关掉运行 `id_updater.py` 的 cmd 窗口
9. 现在仅剩下第一个cmd 窗口运行的 `python api_server.py`。

#### 3.3 编辑配置文件

**步骤一：查找模型 ID**
1. 打开项目文件夹中的 `available_models.json` 文件
2. 搜索模型名称【flux-1-kontext-pro】
3. 找到类似这样的数据：
```json
{
    "id": "43390b9c-cf16-4e4e-a1be-3355bb5b6d5e",
    "publicName": "flux-1-kontext-pro",
    "organization": "bfl",
    "provider": "fal",
    "capabilities": {
        "inputCapabilities": {
            "text": true,
            "image": {
                "multipleImages": false
            }
        },
        "outputCapabilities": {
            "image": {
                "aspectRatios": [
                    "1:1"
                ]
            }
        }
    }
}
```
4. 记下这个 `id` 值：`43390b9c-cf16-4e4e-a1be-3355bb5b6d5e`

**步骤二：处理 ID**
把 id 后面加上一个 `:image`，变成：
```
43390b9c-cf16-4e4e-a1be-3355bb5b6d5e:image
```

**步骤三：编辑 models.json**
1. 打开项目文件夹中的 `models.json` 文件
2. 这个 json 文件默认内容是：
```json
{
    "gemini-2.5-pro": "e2d9d353-6dbe-4414-bf87-bd289d523726",
    "gpt-5": "983bc566-b783-4d28-b24c-3c8b08eb1086",
    "nano-banana": "e4e58f18-c04f-47cd-8d11-4b2ece7b617e:image"
}
```
3. 编辑文件为：
```json
{
    "gemini-2.5-pro": "e2d9d353-6dbe-4414-bf87-bd289d523726",
    "gpt-5": "983bc566-b783-4d28-b24c-3c8b08eb1086",
    "nano-banana": "e4e58f18-c04f-47cd-8d11-4b2ece7b617e:image",
    "flux-1-kontext-pro": "43390b9c-cf16-4e4e-a1be-3355bb5b6d5e:image"
}
```
> 注意：末尾有 `:image` 的表示这是图像模型
4. 保存文件

### 第四步：重启服务

1. 关闭所有刚才打开的 python 后端
2. 重新运行：`python api_server.py`
3. 不出意外，你就可以直接调用 API 了！


## ⚠️ 重要注意事项

1. **保持浏览器页面开启**：在运行过程中，需要保持浏览器页面一直开着，否则会报错
2. **Cloudflare 验证**：浏览器页面可能会遇到 CF 拦截，需要手动完成 CF 的验证，以保持后端正常运行
3. **Request Entity Too Large 错误**：有时候 python 后端报错 `Request Entity Too Large`，可能就是因为遇到了 CF 验证，需要手动过验证

## 🔧 常见问题

### Q: 提示 "Internal Server Error"
**A:** 通常是图片格式问题，插件会自动处理 GIF 转换，请稍后重试。

### Q: 提示 "Request Entity Too Large"
**A:** 
- 如果图片小于 5MB：检查浏览器是否遇到 Cloudflare 验证
- 如果图片大于 5MB：请使用更小的图片

### Q: 生成失败
**A:** 
1. 确保浏览器页面保持打开
2. 检查 Python 后端是否正常运行
3. 完成 Cloudflare 人机验证（如有）
