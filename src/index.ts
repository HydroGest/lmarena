import { Context, Schema, segment, h } from 'koishi';
import { promises as fs } from 'fs';
import path from 'path';
import axios from 'axios';
import sharp from 'sharp';

interface PromptMap {
  [key: string]: string;
}

interface Config {
  prefix: boolean;
  baseUrl: string;
  model: string;
  saveImage: boolean;
  retries: number;
}

// 从原 prompt.py 复制过来的提示词映射
const promptMap: PromptMap = {
  "bnn": "draw anything",
  "手办化": "Your task is to create a photorealistic, masterpiece-quality image of a 1/7 scale commercialized figurine based on the user's character. The final image must be in a realistic style and environment.\n\n**Crucial Instruction on Face & Likeness:** The figurine's face is the most critical element. It must be a perfect, high-fidelity 3D translation of the character from the source image. The sculpt must be sharp, clean, and intricately detailed, accurately capturing the original artwork's facial structure, eye style, expression, and hair. The final result must be immediately recognizable as the same character, elevated to a premium physical product standard. Do NOT generate a generic or abstract face.\n\n**Scene Composition (Strictly follow these details):**\n1. **Figurine & Base:** Place the figure on a computer desk. It must stand on a simple, circular, transparent acrylic base WITHOUT any text or markings.\n2. **Computer Monitor:** In the background, a computer monitor must display 3D modeling software (like ZBrush or Blender) with the digital sculpt of the very same figurine visible on the screen.\n3. **Artwork Display:** Next to the computer screen, include a transparent acrylic board with a wooden base. This board holds a print of the original 2D artwork that the figurine is based on.\n4. **Environment:** The overall setting is a desk, with elements like a keyboard to enhance realism. The lighting should be natural and well-lit, as if in a room.",
  "手办化2": "Use the nano-banana model to create a 1/7 scale commercialized figure of thecharacter in the illustration, in a realistic styie and environment.Place the figure on a computer desk, using a circular transparent acrylic basewithout any text.On the computer screen, display the ZBrush modeling process of the figure.Next to the computer screen, place a BANDAl-style toy packaging box printedwith the original artwork.",
  "手办化3": "Your primary mission is to accurately convert the subject from the user's photo into a photorealistic, masterpiece quality, 1/7 scale PVC figurine, presented in its commercial packaging.\n\n**Crucial First Step: Analyze the image to identify the subject's key attributes (e.g., human male, human female, animal, specific creature) and defining features (hair style, clothing, expression). The generated figurine must strictly adhere to these identified attributes.** This is a mandatory instruction to avoid generating a generic female figure.\n\n**Top Priority - Character Likeness:** The figurine's face MUST maintain a strong likeness to the original character. Your task is to translate the 2D facial features into a 3D sculpt, preserving the identity, expression, and core characteristics. If the source is blurry, interpret the features to create a sharp, well-defined version that is clearly recognizable as the same character.\n\n**Scene Details:**\n1. **Figurine:** The figure version of the photo I gave you, with a clear representation of PVC material, placed on a round plastic base.\n2. **Packaging:** Behind the figure, there should be a partially transparent plastic and paper box, with the character from the photo printed on it.\n3. **Environment:** The entire scene should be in an indoor setting with good lighting.",
};

class ImageWorkflow {
  private baseUrl: string;
  
  constructor(baseUrl: string) {
    this.baseUrl = baseUrl;
  }

  async downloadImage(url: string): Promise<Buffer> {
    const response = await axios.get(url, { responseType: 'arraybuffer' });
    return Buffer.from(response.data, 'binary');
  }

  async getAvatar(userId: string): Promise<Buffer> {
    const avatarUrl = `https://q4.qlogo.cn/headimg_dl?dst_uin=${userId}&spec=640`;
    return this.downloadImage(avatarUrl);
  }

  async extractFirstFrame(imageBuffer: Buffer): Promise<Buffer> {
    try {
      const image = sharp(imageBuffer);
      const metadata = await image.metadata();
      
      if (metadata.format === 'gif') {
        return image.png().toBuffer();
      }
      return imageBuffer;
    } catch (error) {
      return imageBuffer;
    }
  }

  async compressImage(imageBuffer: Buffer, maxBytes: number): Promise<Buffer> {
    try {
      let compressedImage = sharp(imageBuffer);
      const metadata = await compressedImage.metadata();
      
      if (metadata.size && metadata.size <= maxBytes) {
        return imageBuffer;
      }
      
      // 调整大小和质量
      compressedImage = compressedImage.resize(1024, 1024, { fit: 'inside' });
      
      let quality = 80;
      let result: Buffer;
      
      do {
        result = await compressedImage.jpeg({ quality }).toBuffer();
        quality -= 5;
      } while (result.length > maxBytes && quality > 10);
      
      return result;
    } catch (error) {
      return imageBuffer;
    }
  }

  async getImageFromSession(session: any): Promise<Buffer> {
    // 1. 检查回复消息中的图片
    if (session.quote?.elements) {
      for (const element of session.quote.elements) {
        if (element.type === 'image') {
          const url = element.attrs?.url || element.attrs?.src;
          if (url) {
            const img = await this.downloadImage(url);
            return this.extractFirstFrame(img);
          }
        }
      }
    }

    // 2. 检查当前消息中的图片
    for (const element of session.elements) {
      if (element.type === 'image') {
        const url = element.attrs?.url || element.attrs?.src;
        if (url) {
          const img = await this.downloadImage(url);
          return this.extractFirstFrame(img);
        }
      } 
      // 3. 检查@消息
      else if (element.type === 'at') {
        const userId = element.attrs?.id;
        if (userId && userId !== session.selfId) {
          return this.getAvatar(userId);
        }
      }
    }

    // 4. 使用发送者的头像作为兜底
    return this.getAvatar(session.userId);
  }

  async generateImage(
    imageBuffer: Buffer,
    prompt: string,
    model: string,
    retries: number
  ): Promise<Buffer | string> {
    const compressedImg = await this.compressImage(imageBuffer, 3_500_000);
    const imgBase64 = compressedImg.toString('base64');
    
    const url = `${this.baseUrl}/v1/chat/completions`;
    const content = [
      { type: "text", text: prompt },
      { type: "image_url", image_url: { url: `data:image/jpeg;base64,${imgBase64}` } }
    ];
    
    const data = {
      model,
      messages: [{ role: "user", content }],
      n: 1
    };

    for (let attempt = 0; attempt <= retries; attempt++) {
      try {
        const response = await axios.post(url, data, {
          headers: { "Content-Type": "application/json" }
        });

        const contentMsg = response.data.choices?.[0]?.message?.content;
        if (!contentMsg) return "响应为空";

        const imgUrlMatch = /!\[.*?\]\((.*?)\)/.exec(contentMsg);
        if (!imgUrlMatch || !imgUrlMatch[1]) return "未找到图片URL";

        return this.downloadImage(imgUrlMatch[1]);
      } catch (error) {
        if (attempt >= retries) {
          return error.response?.data?.error?.message || "生成失败";
        }
        await new Promise(resolve => setTimeout(resolve, 2000));
      }
    }

    return "生成失败";
  }
}

export const name = 'lmarena';

export const Config: Schema<Config> = Schema.object({
  prefix: Schema.boolean().default(true).description('启用触发前缀'),
  baseUrl: Schema.string().default('http://127.0.0.1:5102').description('生图服务器URL'),
  model: Schema.string().default('nano-banana').description('生图模型'),
  saveImage: Schema.boolean().default(false).description('保存生成的图片'),
  retries: Schema.number().default(2).description('生图失败重试次数')
});

export function apply(ctx: Context, config: Config) {
  const workflow = new ImageWorkflow(config.baseUrl);
  const pluginDataDir = path.join(ctx.baseDir, 'data/lmarena-plugin');
  
  ctx.middleware(async (session, next) => {
    if (session.elements.length === 0) return next();
    
    const message = session.elements.map(e => {
      if (e.type === 'text') return e.attrs.content;
      if (e.type === 'at') return `@${e.attrs.id}`;
      return '';
    }).join('').trim();
    
    // 检查是否满足触发条件
    if (config.prefix && !session.parsed.appel) return next();
    
    const [command, ...rest] = message.split(/\s+/);
    const promptText = rest.join(' ');
    
    if (!(command in promptMap)) return next();
    
    // 获取提示词
    let prompt = promptMap[command];
    if (command === 'bnn' && promptText) {
      prompt = promptText;
    }
    
    // 获取图片
    let imageBuffer: Buffer;
    try {
      imageBuffer = await workflow.getImageFromSession(session);
    } catch (error) {
      return '获取图片失败';
    }
    
    // 生成图片
    const result = await workflow.generateImage(
      imageBuffer,
      prompt,
      config.model,
      config.retries
    );
    
    if (typeof result === 'string') {
      return result;
    }
    
    // 保存图片
    if (config.saveImage) {
      try {
        await fs.mkdir(pluginDataDir, { recursive: true });
        const timestamp = Date.now();
        const savePath = path.join(pluginDataDir, `${config.model}_${timestamp}.png`);
        await fs.writeFile(savePath, result);
      } catch (error) {
        ctx.logger('lmarena-plugin').warn('保存图片失败', error);
      }
    }
    
    return segment.image(result);
  });
}
