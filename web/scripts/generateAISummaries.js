// 导入所需的模块
import fs from 'fs/promises';
import path from 'path';
import puppeteer from 'puppeteer';
import { DOMParser } from 'dom-parser';
import fetch from 'node-fetch';
import { fileURLToPath } from 'url';

// API Key
const DEEPSEEK_API_KEY = 'sk-814ac6e28a2a4e609523c78c122dd7df';

// 获取当前文件的目录
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// 文件路径
const HN_DATA_PATH = path.join(__dirname, '../src/api/HackerNews_top500.json');
const OUTPUT_PATH = path.join(__dirname, '../src/api/HackerNewsSummaries.json');

// 延迟函数
const delay = ms => new Promise(resolve => setTimeout(resolve, ms));

/**
 * 解析文章内容
 * @param {string} url - 文章URL
 * @returns {Promise<string>} - 文章内容
 */
async function parseArticle(url) {
    if (!url) return '无法获取文章内容：URL不存在';
    
    const browser = await puppeteer.launch({
        headless: 'new',
        args: ['--no-sandbox', '--disable-setuid-sandbox']
    });
    
    try {
        const page = await browser.newPage();
        
        // 设置超时时间为30秒
        await page.setDefaultNavigationTimeout(30000);
        
        // 访问页面
        await page.goto(url, { waitUntil: 'domcontentloaded' });
        
        // 获取页面标题
        const title = await page.title();
        
        // 尝试识别并提取文章主体内容
        const articleContent = await page.evaluate(() => {
            // 常见的文章容器选择器
            const articleSelectors = [
                'article',
                '[role="article"]',
                '.article',
                '.post',
                '.post-content',
                '.entry-content',
                '.content',
                '.main-content',
                'main',
                '#content',
                '#main'
            ];
            
            // 移除不相关的元素
            const elementsToRemove = [
                'script', 'style', 'nav', 'header', 'footer',
                'aside', 'iframe', '.ads', '.advertisement',
                '.sidebar', '.comments', '.nav', '.menu'
            ];
            
            // 移除不需要的元素
            elementsToRemove.forEach(selector => {
                document.querySelectorAll(selector).forEach(el => el.remove());
            });
            
            // 尝试找到文章元素
            let articleElement = null;
            for (const selector of articleSelectors) {
                const element = document.querySelector(selector);
                if (element) {
                    articleElement = element;
                    break;
                }
            }
            
            // 提取文章内容
            let content = '';
            if (articleElement) {
                // 提取段落
                const paragraphs = articleElement.querySelectorAll('p');
                if (paragraphs.length > 0) {
                    content = Array.from(paragraphs)
                        .map(p => p.textContent.trim())
                        .filter(text => text.length > 0)
                        .join('\n\n');
                } else {
                    content = articleElement.textContent.trim();
                }
            } else {
                // 如果没有找到文章元素，使用body的文本
                content = document.body.textContent.trim();
            }
            
            // 清理文本 - 替换多个空格为单个空格
            content = content.replace(/\s+/g, ' ');
            // 替换多个换行为双换行
            content = content.replace(/\n{3,}/g, '\n\n');
            // 修剪开头和结尾的空白
            content = content.trim();
            
            return { title, content };
        });
        
        // 组合最终结果
        const result = `
标题: ${articleContent.title}
URL: ${url}

${articleContent.content}
        `.trim();
        
        return result;
    } catch (error) {
        console.error(`解析文章失败 [${url}]:`, error.message);
        return `无法获取文章内容：${error.message}`;
    } finally {
        await browser.close();
    }
}

/**
 * 获取AI分析
 * @param {string} content - 文章内容
 * @returns {Promise<string>} - AI分析结果
 */
async function getAISummary(content) {
    try {
        const response = await fetch('https://api.deepseek.com/v1/chat/completions', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${DEEPSEEK_API_KEY}`
            },
            body: JSON.stringify({
                model: "deepseek-chat",
                messages: [
                    {
                        role: "system",
                        content: "你是一个专业的技术文章分析专家。请用中文分析以下HackerNews文章，提供以下信息：1. 主要话题和技术领域 2. 创新点或重要发现 3. 与AI相关的关键技术 4. 潜在的应用场景"
                    },
                    {
                        role: "user",
                        content: content
                    }
                ],
                temperature: 0.7
            })
        });

        if (!response.ok) {
            throw new Error(`AI 总结失败: ${response.status} ${response.statusText}`);
        }

        const data = await response.json();
        return data.choices[0].message.content;
    } catch (error) {
        console.error('AI 总结错误:', error.message);
        return `无法获取AI分析：${error.message}`;
    }
}

/**
 * 主函数
 */
async function main() {
    try {
        // 读取HackerNews数据
        console.log('正在读取HackerNews数据...');
        const data = JSON.parse(await fs.readFile(HN_DATA_PATH, 'utf8'));
        
        // 创建结果数组
        const summaries = [];
        
        // 处理每篇文章
        console.log(`开始处理${data.length}篇文章...`);
        
        // 限制处理的文章数量，可以调整或注释掉这一行以处理所有文章
        const articlesToProcess = data.slice(0, 500); 
        
        for (let i = 0; i < articlesToProcess.length; i++) {
            const article = articlesToProcess[i];
            console.log(`[${i+1}/${articlesToProcess.length}] 处理文章: ${article.title}`);
            
            try {
                // 只处理有URL的文章
                if (!article.url) {
                    console.log(`  跳过: 文章没有URL`);
                    continue;
                }
                
                // 解析文章
                console.log(`  获取文章内容...`);
                const content = await parseArticle(article.url);
                
                // AI分析
                console.log(`  获取AI分析...`);
                const aiSummary = await getAISummary(content);
                
                // 添加到结果
                summaries.push({
                    id: article.id,
                    title: article.title,
                    url: article.url,
                    aiSummary: aiSummary
                });
                
                console.log(`  完成!`);
                
                // 每处理10篇文章保存一次结果，防止中断导致数据丢失
                if (summaries.length % 10 === 0) {
                    await fs.writeFile(OUTPUT_PATH, JSON.stringify(summaries, null, 2), 'utf8');
                    console.log(`已保存${summaries.length}篇文章的分析结果`);
                }
                
                // 延迟一段时间，避免API限制
                await delay(2000);
            } catch (error) {
                console.error(`处理文章出错 [${article.title}]:`, error);
                // 即使出错也继续处理下一篇
            }
        }
        
        // 保存最终结果
        await fs.writeFile(OUTPUT_PATH, JSON.stringify(summaries, null, 2), 'utf8');
        console.log(`所有处理完成! 共保存了${summaries.length}篇文章的分析结果`);
        
    } catch (error) {
        console.error('处理过程中出错:', error);
    }
}

// 执行主函数
main().catch(console.error); 