import { Context, Schema, h, Logger, sleep } from 'koishi'
import { } from 'koishi-plugin-puppeteer'

export const name = 'lmarena-ai'
export const inject = ['http', 'logger', 'i18n', 'puppeteer']

export const Config: Schema = Schema.intersect([
  Schema.object({
    commandName: Schema.string().default('手办化').description('指令名称'),
    waitTimeout: Schema.number().default(50).max(120).min(10).step(1).description("等待输入图片的最大时间（秒）"),
  }).description('基础配置'),
  Schema.object({
    baseUrl: Schema.string().default('http://127.0.0.1:5102/v1/chat/completions').role('link').description('LMarenaBridge API 服务器地址'),
    model: Schema.string().default('flux-1-kontext-pro').description('使用的模型名称'),
    maxRetries: Schema.number().default(10).description('最大轮询次数'),
    retryInterval: Schema.number().default(5 * 1000).description('轮询间隔(毫秒)'),
    promptmap: Schema.union([
      Schema.const('1').description('1'),
      Schema.const('2').description('2'),
      Schema.const('3').description('3'),
      Schema.const('4').description('4'),
    ]).description('默认预设的提示词').default("1"),
  }).description('请求设置'),
  Schema.union([
    Schema.object({
      promptmap: Schema.const('1'),
      prompt: Schema.string().role('textarea', { rows: [6, 4] }).default('Please turn this photo into a figure. Behind it, there should be a partially transparent plastic paper box with the character from this photo printed on it. In front of the box, on a round plastic base, place the figure version of the photo I gave you. I\'d like the PVC material to be clearly represented. It would be even better if the background is indoors.')
        .description('AI 绘制提示词'),
    }),
    Schema.object({
      promptmap: Schema.const('2').required(),
      prompt: Schema.string().role('textarea', { rows: [6, 4] }).default("Your task is to create a photorealistic, masterpiece-quality image of a 1/7 scale commercialized figurine based on the user's character. The final image must be in a realistic style and environment.\n\n**Crucial Instruction on Face & Likeness:** The figurine's face is the most critical element. It must be a perfect, high-fidelity 3D translation of the character from the source image. The sculpt must be sharp, clean, and intricately detailed, accurately capturing the original artwork's facial structure, eye style, expression, and hair. The final result must be immediately recognizable as the same character, elevated to a premium physical product standard. Do NOT generate a generic or abstract face.\n\n**Scene Composition (Strictly follow these details):**\n1. **Figurine & Base:** Place the figure on a computer desk. It must stand on a simple, circular, transparent acrylic base WITHOUT any text or markings.\n2. **Computer Monitor:** In the background, a computer monitor must display 3D modeling software (like ZBrush or Blender) with the digital sculpt of the very same figurine visible on the screen.\n3. **Artwork Display:** Next to the computer screen, include a transparent acrylic board with a wooden base. This board holds a print of the original 2D artwork that the figurine is based on.\n4. **Environment:** The overall setting is a desk, with elements like a keyboard to enhance realism. The lighting should be natural and well-lit, as if in a room.")
        .description('AI 绘制提示词'),
    }),
    Schema.object({
      promptmap: Schema.const('3').required(),
      prompt: Schema.string().role('textarea', { rows: [6, 4] }).default("Use the nano-banana model to create a 1/7 scale commercialized figure of thecharacter in the illustration, in a realistic styie and environment.Place the figure on a computer desk, using a circular transparent acrylic basewithout any text.On the computer screen, display the ZBrush modeling process of the figure.Next to the computer screen, place a BANDAl-style toy packaging box printedwith the original artwork.")
        .description('AI 绘制提示词'),
    }),
    Schema.object({
      promptmap: Schema.const('4').required(),
      prompt: Schema.string().role('textarea', { rows: [6, 4] }).default("Your primary mission is to accurately convert the subject from the user's photo into a photorealistic, masterpiece quality, 1/7 scale PVC figurine, presented in its commercial packaging.\n\n**Crucial First Step: Analyze the image to identify the subject's key attributes (e.g., human male, human female, animal, specific creature) and defining features (hair style, clothing, expression). The generated figurine must strictly adhere to these identified attributes.** This is a mandatory instruction to avoid generating a generic female figure.\n\n**Top Priority - Character Likeness:** The figurine's face MUST maintain a strong likeness to the original character. Your task is to translate the 2D facial features into a 3D sculpt, preserving the identity, expression, and core characteristics. If the source is blurry, interpret the features to create a sharp, well-defined version that is clearly recognizable as the same character.\n\n**Scene Details:**\n1. **Figurine:** The figure version of the photo I gave you, with a clear representation of PVC material, placed on a round plastic base.\n2. **Packaging:** Behind the figure, there should be a partially transparent plastic and paper box, with the character from the photo printed on it.\n3. **Environment:** The entire scene should be in an indoor setting with good lighting.")
        .description('AI 绘制提示词'),
    }),
    Schema.object({}),
  ]),

  Schema.object({
    loggerinfo: Schema.boolean().default(false).description("日志调试模式"),
  }).description('调试设置'),
])

export const usage = `
---

此插件需要额外的后端服务。

请先前往 https://github.com/Lianues/LMarenaBridge 部署后端，并且确保后端可用。

部署流程可见本项目readme。

---

此项目所需的koishi服务： 'http', 'logger', 'i18n', 'puppeteer'

---
`;

const logger = new Logger('DEV:lmarena-ai')

export function apply(ctx: Context, config) {
  let isActive = true

  ctx.on('dispose', () => {
    isActive = false
  })

  ctx.i18n.define("zh-CN", {
    commands: {
      [config.commandName]: {
        description: "将图片转换为手办风格",
        messages: {
          waitprompt: '请在{0}秒内发送一张图片...',
          invalidimage: '未检测到有效的图片，请重新发送带图片的消息',
          processing: '正在处理图片，请稍候...',
          failed: '图片生成失败，请稍后重试',
          error: '处理过程中发生错误，请稍后重试'
        },
      },
    }
  })

  ctx.command(`${config.commandName} [...args]`)
    .action(async ({ session, args }) => {
      if (!isActive || !ctx.scope.isActive) {
        return
      }
      if (!session) return

      let src: string | undefined;

      for (const arg of args) {
        if (arg && typeof arg === 'string') {
          const imgSrc = h.select(arg, 'img').map(item => item.attrs.src)[0] ||
            h.select(arg, 'mface').map(item => item.attrs.url)[0];
          if (imgSrc) {
            src = imgSrc;
            break;
          }
        }
      }

      // 检查消息内容中是否有图片
      if (!src) {
        src = h.select(session.content, 'img').map(item => item.attrs.src)[0] ||
          h.select(session.content, 'mface').map(item => item.attrs.url)[0];
      }

      // 检查引用消息中是否有图片
      if (!src && session.quote) {
        src = h.select(session.quote.content, 'img').map(item => item.attrs.src)[0] ||
          h.select(session.quote.content, 'mface').map(item => item.attrs.url)[0];
      }

      if (!src) {
        // 再次检查上下文状态
        if (!isActive || !ctx.scope.isActive) {
          return
        }

        const [msgId] = await session.send(session.text(".waitprompt", [config.waitTimeout]))
        const promptcontent = await session.prompt(config.waitTimeout * 1000)
        if (promptcontent !== undefined) {
          src = h.select(promptcontent, 'img')[0]?.attrs.src || h.select(promptcontent, 'mface')[0]?.attrs.url
        }
        try {
          await session.bot.deleteMessage(session.channelId, msgId)
        } catch {
          ctx.logger.warn(`在频道 ${session.channelId} 尝试撤回消息ID ${msgId} 失败。`)
        }
      }

      const quote = h.quote(session.messageId)

      if (!src) {
        await session.send(`${quote}${session.text(".invalidimage")}`);
        return
      } else {
        logInfo(src);
      }

      try {
        await session.send(quote + session.text('.processing'))
        const file = await ctx.http.file(src)
        logInfo(file)
        const result = await generateFigureImage(file)

        if (result) {
          return h.image(result)
        } else {
          return session.text('.failed')
        }
      } catch (error) {
        ctx.logger.error('处理图片时发生错误:', error)
        return session.text('.error')
      }
    })

  async function generateFigureImage(file: any): Promise<string | null> {
    try {
      let processedImageData = file.data
      let mimeType = file.mime || 'image/jpeg'

      if (mimeType === 'image/gif') {
        if (config.loggerinfo) {
          logger.info('检测到GIF格式，正在提取第一帧...')
        }

        try {
          const page = await ctx.puppeteer.page()

          const base64Gif = file.data.toString('base64')
          const htmlContent = `
            <!DOCTYPE html>
            <html>
            <head>
              <style>
                body { margin: 0; padding: 0; }
                img { display: block; }
              </style>
            </head>
            <body>
              <img id="gif" src="data:image/gif;base64,${base64Gif}" />
            </body>
            </html>
          `

          await page.setContent(htmlContent)

          await page.waitForSelector('#gif')

          const imgElement = await page.$('#gif')

          const screenshot = await imgElement.screenshot({
            type: 'png',
            omitBackground: true
          })

          await page.close()

          processedImageData = screenshot
          mimeType = 'image/png'

          if (config.loggerinfo) {
            logger.info('GIF第一帧提取成功，转换为PNG格式')
          }
        } catch (error) {
          logger.error('GIF第一帧提取失败，使用原始GIF:', error)
          // 如果提取失败，继续使用原始GIF
        }
      }

      // 将图片转换为base64
      let base64Image: string
      if (Buffer.isBuffer(processedImageData)) {
        base64Image = processedImageData.toString('base64')
      } else if (processedImageData instanceof ArrayBuffer) {
        base64Image = Buffer.from(processedImageData).toString('base64')
      } else {
        // 如果是其他类型，尝试转换为Buffer
        base64Image = Buffer.from(processedImageData).toString('base64')
      }

      const dataUrl = `data:${mimeType};base64,${base64Image}`

      if (config.loggerinfo) {
        logger.info(`最终使用图片类型: ${mimeType}`)
        const imageSize = Buffer.isBuffer(processedImageData)
          ? processedImageData.length
          : processedImageData instanceof ArrayBuffer
            ? processedImageData.byteLength
            : processedImageData.length || 0
        logger.info(`图片大小: ${Math.round(imageSize / 1024)} KB`)
        logger.info(`Base64长度: ${base64Image.length}`)
      }

      // 请求体
      const requestBody = {
        model: config.model,
        messages: [
          {
            role: "user",
            content: [
              {
                type: "text",
                text: config.prompt
              },
              {
                type: "image_url",
                image_url: {
                  url: dataUrl
                }
              }
            ]
          }
        ],
        max_tokens: 300,
        n: 1
      }

      if (config.loggerinfo) {
        const debugBody = {
          ...requestBody,
          messages: [
            {
              ...requestBody.messages[0],
              content: [
                requestBody.messages[0].content[0],
                {
                  type: "image_url",
                  image_url: {
                    url: `data:${mimeType};base64,[${base64Image.length} chars]`
                  }
                }
              ]
            }
          ]
        }
        logger.info('请求体结构:', JSON.stringify(debugBody, null, 2))
      }

      // 发送请求到 LMArena Bridge API
      let retryCount = 0
      let errorMsg = null

      while (retryCount <= config.maxRetries) {
        // 在每次重试前检查上下文状态
        if (!isActive || !ctx.scope.isActive) {
          logger.info('插件已卸载，停止重试')
          return null
        }

        try {
          if (config.loggerinfo) {
            logger.info(`发送请求到 ${config.baseUrl}，第 ${retryCount + 1} 次尝试`)
          }

          const response = await ctx.http.post(config.baseUrl, requestBody, {
            headers: { 'Content-Type': 'application/json' }
          })

          // 处理示例中的响应格式
          if (response && response.choices && response.choices[0] && response.choices[0].message) {
            const message = response.choices[0].message

            // 直接从消息内容中提取图片URL
            if (message.content) {
              // 尝试匹配Markdown格式的图片链接
              const markdownMatch = message.content.match(/!\[.*?\]\((https?:\/\/[^)]+)\)/)
              if (markdownMatch && markdownMatch[1]) {
                const imageUrl = markdownMatch[1]
                if (config.loggerinfo) {
                  logger.info(`成功获取图片URL: ${imageUrl}`)
                }
                return imageUrl
              }
            }
          }

          // 如果没有找到图片URL，抛出错误
          errorMsg = '响应中未找到图片URL'
          throw new Error(errorMsg)
        } catch (error) {
          retryCount++
          const errorMessage = error.message || error.toString()

          if (config.loggerinfo) {
            logger.error(`请求失败 (${retryCount}/${config.maxRetries}): ${errorMessage}`)
          }

          // 检查是否为 Internal Server Error，如果是则停止重试
          if (errorMessage.includes('Internal Server Error')) {
            logger.error('遇到 Internal Server Error，停止重试')
            return null
          }

          // 检查是否为 Request Entity Too Large 错误
          if (errorMessage.includes('Request Entity Too Large')) {
            const imageSize = Buffer.isBuffer(processedImageData)
              ? processedImageData.length
              : processedImageData instanceof ArrayBuffer
                ? processedImageData.byteLength
                : processedImageData.length || 0
            const imageSizeMB = imageSize / (1024 * 1024)

            logger.error(`遇到 Request Entity Too Large 错误，图片大小: ${imageSizeMB.toFixed(2)} MB`)

            if (imageSizeMB <= 5) {
              logger.error('图片大小未超过5MB，可能是后端浏览器服务异常')
              throw new Error('图片大小正常但请求被拒绝，请检查后端浏览器服务是否正常运行')
            } else {
              logger.error('图片大小超过5MB限制')
              throw new Error(`图片过大 (${imageSizeMB.toFixed(2)} MB)，请使用小于5MB的图片`)
            }
          }

          if (retryCount <= config.maxRetries) {
            if (config.loggerinfo) {
              logger.info(`等待 ${config.retryInterval}ms 后重试`)
            }
            await sleep(config.retryInterval)
            if (!isActive || !ctx.scope.isActive) {
              logger.info('插件已卸载，停止重试')
              return null
            }
          } else {
            errorMsg = errorMessage
          }
        }
      }

      logger.error(`达到最大重试次数 (${config.maxRetries})，最后错误: ${errorMsg}`)
      return null
    } catch (error) {
      logger.error(`生成图片时发生错误: ${error}`)
      return null
    }
  }

  function logInfo(...args: any[]) {
    if (config.loggerinfo) {
      (logger.info as (...args: any[]) => void)(...args);
    }
  }

}