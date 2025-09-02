import { Context, Schema, h, Logger, sleep, Session } from 'koishi'

export const name = 'lmarena'
export const inject = ['http', 'logger', 'i18n']

export const usage = `
---

此插件需要额外的后端服务。

请先前往 https://github.com/Lianues/LMarenaBridge 部署后端，并且确保后端可用。

部署流程可见本项目readme。

---

此项目所需的koishi服务： 'http', 'logger', 'i18n'

---
`;

const logger = new Logger(name)

interface CommandConfig {
  basename: string
  nested: {
    commands: {
      name: string
      prompt: string
      enabled: boolean
      custom: boolean
      maxImages: number
      waitTimeout: number
      defaultImageUrls: string[]
    }[]
  }
  defaultWaitTimeout: number
  baseUrl: string
  model: string
  maxRetries: number
  retryInterval: number
  enableFallback: boolean
  fallbackBaseUrl?: string
  fallbackModel?: string
  fallbackApiKey?: string
  fallbackMaxRetries?: number
  fallbackRetryInterval?: number
  fallbackErrorCodes?: number[]
  loggerinfo: boolean
}

const defaultCommands = [
  {
    name: '手办化',
    prompt: 'Your task is to create a photorealistic, masterpiece-quality image of a 1/7 scale commercialized figurine based on the user\'s character. The final image must be in a realistic style and environment.\n\n**Crucial Instruction on Face & Likeness:** The figurine\'s face is the most critical element. It must be a perfect, high-fidelity 3D translation of the character from the source image. The sculpt must be sharp, clean, and intricately detailed, accurately capturing the original artwork\'s facial structure, eye style, expression, and hair. The final result must be immediately recognizable as the same character, elevated to a premium physical product standard. Do NOT generate a generic or abstract face.\n\n**Scene Composition (Strictly follow these details):**\n1. **Figurine & Base:** Place the figure on a computer desk. It must stand on a simple, circular, transparent acrylic base WITHOUT any text or markings.\n2. **Computer Monitor:** In the background, a computer monitor must display 3D modeling software (like ZBrush or Blender) with the digital sculpt of the very same figurine visible on the screen.\n3. **Artwork Display:** Next to the computer screen, include a transparent acrylic board with a wooden base. This board holds a print of the original 2D artwork that the figurine is based on.\n4. **Environment:** The overall setting is a desk, with elements like a keyboard to enhance realism. The lighting should be natural and well-lit, as if in a room.',
    enabled: true,
    custom: false,
    maxImages: 1,
    waitTimeout: 50,
    defaultImageUrls: []
  },
  {
    name: '手办化2',
    prompt: 'Use the nano-banana model to create a 1/7 scale commercialized figure of thecharacter in the illustration, in a realistic styie and environment.Place the figure on a computer desk, using a circular transparent acrylic basewithout any text.On the computer screen, display the ZBrush modeling process of the figure.Next to the computer screen, place a BANDAl-style toy packaging box printedwith the original artwork.',
    enabled: true,
    custom: false,
    maxImages: 1,
    waitTimeout: 50,
    defaultImageUrls: []
  },
  {
    name: '手办化3',
    prompt: 'Your primary mission is to accurately convert the subject from the user\'s photo into a photorealistic, masterpiece quality, 1/7 scale PVC figurine, presented in its commercial packaging.\n\n**Crucial First Step: Analyze the image to identify the subject\'s key attributes (e.g., human male, human female, animal, specific creature) and defining features (hair style, clothing, expression). The generated figurine must strictly adhere to these identified attributes.** This is a mandatory instruction to avoid generating a generic female figure.\n\n**Top Priority - Character Likeness:** The figurine\'s face MUST maintain a strong likeness to the original character. Your task is to translate the 2D facial features into a 3D sculpt, preserving the identity, expression, and core characteristics. If the source is blurry, interpret the features to create a sharp, well-defined version that is clearly recognizable as the same character.\n\n**Scene Details:**\n1. **Figurine:** The figure version of the photo I gave you, with a clear representation of PVC material, placed on a round plastic base.\n2. **Packaging:** Behind the figure, there should be a partially transparent plastic and paper box, with the character from the photo printed on it.\n3. **Environment:** The entire scene should be in an indoor setting with good lighting.',
    enabled: true,
    custom: false,
    maxImages: 1,
    waitTimeout: 50,
    defaultImageUrls: []
  },
  {
    name: 'coser化',
    prompt: 'Create a realistic cosplay photograph of the character in the image. The cosplayer should be wearing a high-quality costume that accurately replicates the character\'s outfit. Include appropriate props and background setting that matches the character\'s universe. Focus on accurate representation of costume details and realistic materials. Draw the picture for me with the background of a comic convention. East-asian face.',
    enabled: true,
    custom: false,
    maxImages: 1,
    waitTimeout: 50,
    defaultImageUrls: []
  },
  {
    name: 'mc化',
    prompt: 'Transform the image into a Minecraft-style character. Create a blocky, pixelated version of the character using Minecraft\'s visual style. Include appropriate Minecraft environment and elements in the background. The generated entities must be Minecraft-style entities or blocks/structures.',
    enabled: true,
    custom: false,
    maxImages: 1,
    waitTimeout: 50,
    defaultImageUrls: []
  },
  {
    name: '合并图片',
    prompt: '将两张图片合并为一张',
    enabled: true,
    custom: true,
    maxImages: 2,
    waitTimeout: 60,
    defaultImageUrls: []
  },
  {
    name: '修图',
    prompt: '修复图片中的缺陷',
    enabled: true,
    custom: true,
    maxImages: 1,
    waitTimeout: 60,
    defaultImageUrls: []
  }
]

export const Config: Schema = Schema.intersect([
  Schema.object({
    basename: Schema.string().default(name).description('父级指令名称'),
    nested: Schema.object({
      commands: Schema.array(
        Schema.object({
          name: Schema.string().required().description('指令名称'),
          prompt: Schema.string().role('textarea', { rows: [6, 4] }).description('该指令对应的提示词（自定义指令可留空）'),
          enabled: Schema.boolean().default(true).description('是否启用该指令'),
          custom: Schema.boolean().default(false).description('是否为自定义指令（允许用户输入提示词）'),
          maxImages: Schema.number().default(1).min(0).max(5).description('需要用户提供的最大图片数量（不包括默认图片）'),
          waitTimeout: Schema.number().default(30).max(120).min(10).step(1).description("等待输入图片的最大时间（秒）"),
          defaultImageUrls: Schema.array(Schema.string().role('link')).description('默认图片URL列表（不计入用户图片数量）').default([])
        })).description('指令配置').default(defaultCommands),
    }).collapse().description('指令配置项太长啦，这样折叠起来更方便哦~'),


    defaultWaitTimeout: Schema.number().default(50).max(120).min(10).step(1).description("默认等待输入图片的最大时间（秒）"),
  }).description('基础配置'),

  Schema.object({
    baseUrl: Schema.string().default('http://127.0.0.1:5102/v1/chat/completions').role('link').description('LMarenaBridge API 服务器地址'),
    model: Schema.string().default('flux-1-kontext-pro').description('使用的模型名称'),
    maxRetries: Schema.number().default(10).description('最大轮询次数'),
    retryInterval: Schema.number().default(5 * 1000).description('轮询间隔(毫秒)'),
  }).description('请求设置'),

  Schema.object({
    enableFallback: Schema.boolean().default(false).description('启用后备API方案（使用其他API）'),
  }).description('后备方案设置'),
  Schema.union([
    Schema.object({
      enableFallback: Schema.const(true).required(),
      fallbackBaseUrl: Schema.string().default('https://api.openai.com/v1/chat/completions').role('link').description('后备API服务器地址'),
      fallbackModel: Schema.string().default('gpt-4-vision-preview').description('后备方案使用的模型'),
      fallbackApiKey: Schema.string().description('后备API密钥').role('secret'),
      fallbackMaxRetries: Schema.number().default(3).description('后备方案的最大重试次数'),
      fallbackRetryInterval: Schema.number().default(1000).description('后备方案的轮询间隔(毫秒)'),
      fallbackErrorCodes: Schema.array(Schema.number()).default([500, 429]).description('触发后备方案的状态码'),
    }),
    Schema.object({
      enableFallback: Schema.const(false),
    }),
  ]),

  Schema.object({
    loggerinfo: Schema.boolean().default(false).description("日志调试模式"),
  }).description('调试设置'),
])


export function apply(ctx: Context, config: CommandConfig) {
  let isActive = true

  ctx.on('dispose', () => {
    isActive = false
  })

  ctx.on('ready', () => {

    ctx.i18n.define("zh-CN", {
      [name]: {
        description: '将图片转换为特定风格',
        messages: {
          waitprompt: '请在{0}秒内发送一张图片...',
          waitpromptmultiple: '请在{0}秒内发送{1}张图片...',
          customprompt: '请在{0}秒内输入自定义提示词...',
          invalidimage: '未检测到有效的图片，请重新发送带图片的消息',
          processing: '正在处理图片，请稍候...',
          failed: '图片生成失败，请稍后重试',
          error: '处理过程中发生错误，请稍后重试',
          fallback: '原始方案失败，正在尝试后备方案...',
          needprompt: '请提供自定义提示词',
          needimages: '请提供至少一张图片'
        },
      }
    })

    ctx.command(config.basename)

    for (const cmdConfig of config.nested.commands) {
      if (!cmdConfig.enabled) continue;

      ctx.command(`${config.basename}/${cmdConfig.name} [message:text]`)
        .usage(`使用 ${cmdConfig.name} 风格处理图片`)
        .action(async ({ session }, message) => {
          if (!isActive || !ctx.scope.isActive) {
            return
          }
          if (!session) return

          const quote = h.quote(session.messageId)
          const customCommand = cmdConfig.custom || false
          const maxImages = cmdConfig.maxImages || 0 // 用户需要提供的图片数量
          const waitTimeout = cmdConfig.waitTimeout || config.defaultWaitTimeout
          const defaultImageUrls = cmdConfig.defaultImageUrls || [] // 多个默认图片URL

          let promptText = cmdConfig.prompt
          let images: string[] = []

          // 添加所有默认图片
          if (defaultImageUrls.length > 0) {
            images.push(...defaultImageUrls)
            logInfo(`添加 ${defaultImageUrls.length} 张默认图片`)
          }

          // 自定义指令处理逻辑
          if (customCommand) {
            let textContent: string | undefined

            if (message) {
              const textElements = h.select(session.stripped.content, 'text')
              if (textElements.length > 0) {
                // 合并所有文本内容
                textContent = textElements.map(el => el.attrs.content || '').join(' ').trim()
              }
            }

            if (textContent) {
              // 合并系统提示词和用户输入
              promptText = cmdConfig.prompt ? `${cmdConfig.prompt}\n\n${textContent}` : textContent
            }

            // 如果没有提示词，要求用户输入
            if (!promptText) {
              const [msgId] = await session.send(session.text("lmarena.messages.customprompt", [waitTimeout]))
              const userPrompt = await session.prompt(waitTimeout * 1000)

              try {
                await session.bot.deleteMessage(session.channelId, msgId)
              } catch {
                ctx.logger.warn(`在频道 ${session.channelId} 尝试撤回消息ID ${msgId} 失败。`)
              }

              if (userPrompt) {
                // 合并系统提示词和用户输入
                promptText = cmdConfig.prompt ? `${cmdConfig.prompt}\n\n${userPrompt}` : userPrompt
              } else {
                await session.send(`${quote}${session.text("lmarena.messages.needprompt")}`)
                return
              }
            }
          }

          // 收集用户提供的图片（不包括默认图片）
          const extractedImages = extractImagesFromSession(session)
          images.push(...extractedImages)

          // 计算还需要用户提供的图片数量
          const remainingImages = Math.max(0, maxImages - extractedImages.length)

          // 如果还需要用户提供图片，等待用户发送
          if (remainingImages > 0) {
            const [msgId] = await session.send(
              session.text("lmarena.messages.waitpromptmultiple", [waitTimeout, remainingImages])
            )

            try {
              for (let i = 0; i < remainingImages; i++) {
                const promptContent = await session.prompt(waitTimeout * 1000)
                if (promptContent !== undefined) {
                  const newImages = extractImagesFromMessage(promptContent)
                  images.push(...newImages)
                } else {
                  break
                }
              }
            } finally {
              try {
                await session.bot.deleteMessage(session.channelId, msgId)
              } catch {
                ctx.logger.warn(`在频道 ${session.channelId} 尝试撤回消息ID ${msgId} 失败。`)
              }
            }
          }

          // 检查是否有图片
          if (images.length === 0) {
            await session.send(`${quote}${session.text("lmarena.messages.needimages")}`)
            return
          }

          logInfo(images)

          try {
            await session.send(quote + session.text('lmarena.messages.processing'))

            // 下载所有图片
            const files = await Promise.all(
              images.map(src => ctx.http.file(src).catch(err => {
                ctx.logger.error(`下载图片失败: ${src}`, err)
                return null
              }))
            ).then(results => results.filter(Boolean))

            if (files.length === 0) {
              await session.send(`${quote}${session.text("lmarena.messages.invalidimage")}`)
              return
            }

            const result = await generateFigureImage(files, promptText)

            if (result) {
              return h.image(result)
            } else {
              return session.text('lmarena.messages.failed')
            }
          } catch (error) {
            ctx.logger.error(`[${cmdConfig.name}] 处理图片时发生错误:`, error)
            return session.text('lmarena.messages.error')
          }
        })
    }

    function extractImagesFromSession(session: Session): string[] {
      const images: string[] = []

      // 从当前消息中提取
      const currentImages = extractImagesFromMessage(session.stripped.content)
      images.push(...currentImages)

      // 从引用消息中提取
      if (session.quote) {
        const quoteImages = extractImagesFromMessage(session.quote.content)
        images.push(...quoteImages)
      }

      return images
    }

    function extractImagesFromMessage(content: string): string[] {
      const images: string[] = []

      // 提取<img>标签中的图片
      const imgElements = h.select(content, 'img')
      for (const img of imgElements) {
        if (img.attrs.src) {
          images.push(img.attrs.src)
        }
      }

      // 提取<mface>标签中的图片
      const mfaceElements = h.select(content, 'mface')
      for (const mface of mfaceElements) {
        if (mface.attrs.url) {
          images.push(mface.attrs.url)
        }
      }

      return images
    }

    async function generateFigureImage(files: any[], prompt: string): Promise<string | null> {
      try {
        const dataUrls: string[] = []

        for (const file of files) {
          let processedImageData = file.data
          let originalMimeType = file.mime || 'image/jpeg'
          let finalMimeType = originalMimeType // 最终的MIME类型

          let base64Image: string
          if (Buffer.isBuffer(processedImageData)) {
            base64Image = processedImageData.toString('base64')
          } else if (processedImageData instanceof ArrayBuffer) {
            base64Image = Buffer.from(processedImageData).toString('base64')
          } else {
            base64Image = Buffer.from(processedImageData).toString('base64')
          }

          // 使用最终的MIME类型
          dataUrls.push(`data:${finalMimeType};base64,${base64Image}`)
        }

        // 请求体
        const contentArray: any[] = [
          {
            type: "text",
            text: prompt
          }
        ]

        // 添加所有图片
        for (const dataUrl of dataUrls) {
          contentArray.push({
            type: "image_url",
            image_url: {
              url: dataUrl
            }
          })
        }

        const requestBody = {
          model: config.model,
          messages: [
            {
              role: "user",
              content: contentArray
            }
          ],
          max_tokens: 300,
          n: 1
        }

        logInfo('请求体结构:', JSON.stringify({
          ...requestBody,
          messages: [
            {
              ...requestBody.messages[0],
              content: [
                requestBody.messages[0].content[0],
                ...requestBody.messages[0].content.slice(1).map((item: any, index: number) => {
                  const originalUrl = item.image_url.url
                  const mimeMatch = originalUrl.match(/^data:([^;]+);base64,/)
                  const mimeType = mimeMatch ? mimeMatch[1] : 'image'
                  return {
                    type: "image_url",
                    image_url: {
                      url: `data:${mimeType};base64,[${originalUrl.length} chars]`
                    }
                  }
                })
              ]
            }
          ]
        }, null, 2))

        // 发送请求到 LMArena Bridge API
        let retryCount = 0
        let errorMsg = null
        let lastStatusCode = 0

        while (retryCount <= config.maxRetries) {
          // 在每次重试前检查上下文状态
          if (!isActive || !ctx.scope.isActive) {
            ctx.logger.info('插件已卸载，停止重试')
            return null
          }

          try {
            logInfo(`发送请求到 ${config.baseUrl}，第 ${retryCount + 1} 次尝试`)

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
                  logInfo(`成功获取图片URL: ${imageUrl}`)
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
            lastStatusCode = error.response?.status || 0

            logInfo(`请求失败 (${retryCount}/${config.maxRetries}): ${errorMessage}`)

            // 检查是否为 Internal Server Error，如果是则停止重试
            if (errorMessage.includes('Internal Server Error')) {
              ctx.logger.error('遇到 Internal Server Error，停止重试')
              break
            }

            // 检查是否为 Request Entity Too Large 错误
            if (errorMessage.includes('Request Entity Too Large')) {
              const totalSize = files.reduce((sum, file) => {
                const size = file.data.length || 0
                return sum + size
              }, 0)
              const totalSizeMB = totalSize / (1024 * 1024)

              ctx.logger.error(`遇到 Request Entity Too Large 错误，总图片大小: ${totalSizeMB.toFixed(2)} MB`)

              if (totalSizeMB <= 5) {
                ctx.logger.error('图片总大小未超过5MB，可能是后端浏览器服务异常')
                throw new Error('图片大小正常但请求被拒绝，请检查后端浏览器服务是否正常运行')
              } else {
                ctx.logger.error('图片总大小超过5MB限制')
                throw new Error(`图片过大 (${totalSizeMB.toFixed(2)} MB)，请使用小于5MB的图片`)
              }
            }

            if (retryCount <= config.maxRetries) {
              logInfo(`等待 ${config.retryInterval}ms 后重试`)
              await sleep(config.retryInterval)
              if (!isActive || !ctx.scope.isActive) {
                ctx.logger.info('插件已卸载，停止重试')
                return null
              }
            } else {
              errorMsg = errorMessage
            }
          }
        }

        // 原始方案失败后尝试后备方案
        if (config.enableFallback &&
          (config.fallbackErrorCodes.includes(lastStatusCode) || retryCount > config.maxRetries)) {
          ctx.logger.info('原始方案失败，尝试使用后备方案...')
          return tryFallbackApi(requestBody, prompt)
        }

        ctx.logger.error(`达到最大重试次数 (${config.maxRetries})，最后错误: ${errorMsg}`)
        return null
      } catch (error) {
        ctx.logger.error(`生成图片时发生错误: ${error}`)
        return null
      }
    }

    async function tryFallbackApi(requestBody: any, prompt: string): Promise<string | null> {
      let fallbackRetryCount = 0
      const fallbackConfig = {
        baseUrl: config.fallbackBaseUrl,
        model: config.fallbackModel,
        apiKey: config.fallbackApiKey,
        maxRetries: config.fallbackMaxRetries,
        retryInterval: config.fallbackRetryInterval
      }

      // 更新请求体使用后备模型
      const fallbackRequestBody = {
        ...requestBody,
        model: fallbackConfig.model
      }

      while (fallbackRetryCount <= fallbackConfig.maxRetries) {
        if (!isActive || !ctx.scope.isActive) {
          ctx.logger.info('插件已卸载，停止后备方案重试')
          return null
        }

        try {
          logInfo(`使用后备方案发送请求到 ${fallbackConfig.baseUrl}，第 ${fallbackRetryCount + 1} 次尝试`)

          const response = await ctx.http.post(fallbackConfig.baseUrl, fallbackRequestBody, {
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${fallbackConfig.apiKey}`
            }
          })

          // 处理响应
          if (response && response.choices && response.choices[0] && response.choices[0].message) {
            const message = response.choices[0].message

            logInfo(`响应：${JSON.stringify(response)}`)
            if (message.content) {
              const markdownMatch = message.content.match(/!\[.*?\]\((https?:\/\/[^)]+)\)/)
              if (markdownMatch && markdownMatch[1]) {
                const imageUrl = markdownMatch[1]
                logInfo(`后备方案成功获取图片URL: ${imageUrl}`)
                return imageUrl
              }
            }
          }

          const errorMsg = '后备方案响应中未找到图片URL'
          throw new Error(errorMsg)
        } catch (error) {
          fallbackRetryCount++
          const errorMessage = error.message || error.toString()
          const statusCode = error.response?.status || 0
          logInfo(`后备方案请求失败 (${fallbackRetryCount}/${fallbackConfig.maxRetries}): ${errorMessage}`)

          // 检查是否为配额不足错误
          if (errorMessage.includes('insufficient_quota') || statusCode === 429) {
            ctx.logger.error('后备方案API配额不足，停止重试')
            return null
          }

          if (fallbackRetryCount <= fallbackConfig.maxRetries) {
            logInfo(`等待 ${fallbackConfig.retryInterval}ms 后重试后备方案`)
            await sleep(fallbackConfig.retryInterval)
            if (!isActive || !ctx.scope.isActive) {
              ctx.logger.info('插件已卸载，停止后备方案重试')
              return null
            }
          } else {
            ctx.logger.error('后备方案达到最大重试次数，放弃')
            return null
          }
        }
      }
      return null
    }

    function logInfo(...args: any[]) {
      if (config.loggerinfo) {
        (logger.info as (...args: any[]) => void)(...args);
      }
    }
  })
}
