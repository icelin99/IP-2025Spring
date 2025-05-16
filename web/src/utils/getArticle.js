// articleParser.js

/**
 * 解析文章 URL 并提取内容
 * @param {string} url - 文章的 URL
 * @returns {Promise<string>} - 提取的文章内容
 */
export async function parseArticle(url) {
    try {
        // 使用 api.codetabs.com 作为 CORS 代理
        console.log('开始解析文章:', url);
        const proxyUrl = `https://api.codetabs.com/v1/proxy?quest=${encodeURIComponent(url)}`;
        const response = await fetch(proxyUrl);

        if (!response.ok) {
            throw new Error(`获取页面失败: ${response.status} ${response.statusText}`);
        }

        const html = await response.text();

        // 创建 DOM 解析器
        const parser = new DOMParser();
        const doc = parser.parseFromString(html, 'text/html');

        // 提取标题
        const title = doc.querySelector('title')?.textContent ||
            doc.querySelector('h1')?.textContent ||
            '无标题';

        // 移除不需要的元素
        const elementsToRemove = [
            'script', 'style', 'nav', 'header', 'footer',
            'aside', 'iframe', '.ads', '.advertisement',
            '.sidebar', '.comments', '.nav', '.menu'
        ];

        elementsToRemove.forEach(selector => {
            doc.querySelectorAll(selector).forEach(el => el.remove());
        });

        // 尝试找到文章主体
        let articleContent = '';
        let articleElement = null;

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

        // 尝试找到文章元素
        for (const selector of articleSelectors) {
            const element = doc.querySelector(selector);
            if (element) {
                articleElement = element;
                break;
            }
        }

        if (articleElement) {
            // 提取段落
            const paragraphs = articleElement.querySelectorAll('p');
            if (paragraphs.length > 0) {
                articleContent = Array.from(paragraphs)
                    .map(p => p.textContent.trim())
                    .filter(text => text.length > 0)
                    .join('\n\n');
            } else {
                articleContent = articleElement.textContent.trim();
            }
        } else {
            // 如果没有找到文章元素，使用body的文本
                articleContent = doc.body.textContent.trim();
        }

        // 清理文本
        articleContent = cleanText(articleContent);

        // 获取元数据
        const metaDescription = doc.querySelector('meta[name="description"]')?.getAttribute('content') || '';
        const author = doc.querySelector('meta[name="author"]')?.getAttribute('content') ||
            doc.querySelector('.author')?.textContent ||
            doc.querySelector('.byline')?.textContent || '';

        // 组合最终结果
        const result = `
  标题: ${title.trim()}
  ${author ? `作者: ${author.trim()}\n` : ''}
  ${metaDescription ? `描述: ${metaDescription.trim()}\n` : ''}
  URL: ${url}
  
  ${articleContent}
      `.trim();

        return result;

    } catch (error) {
        console.error('解析文章失败:', error);
        throw new Error(`解析文章失败: ${error.message}`);
    }
}

/**
 * 清理提取的文本
 * @param {string} text - 原始文本
 * @returns {string} - 清理后的文本
 */
function cleanText(text) {
    if (!text) return '';

    return text
        // 替换多个空格为单个空格
        .replace(/\s+/g, ' ')
        // 替换多个换行为双换行
        .replace(/\n{3,}/g, '\n\n')
        // 修剪开头和结尾的空白
        .trim();
}
