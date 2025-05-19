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

/**
 * 从 PDF URL 提取文本内容。
 * 由于PDF处理复杂且容易出错，我们直接获取arxiv的摘要页面内容作为替代
 * @param {string} pdfUrl - PDF 文件的 URL
 * @returns {Promise<string>} - 提取的文本内容或提示信息
 */
export async function getTextFromPdf(pdfUrl) {
    console.log('获取论文内容:', pdfUrl);
    try {
        // 使用代理方式解决可能的 CORS 问题
        const proxyUrl = `https://api.codetabs.com/v1/proxy?quest=${encodeURIComponent(pdfUrl)}`;
        const response = await fetch(proxyUrl);

        if (!response.ok) {
            throw new Error(`获取 PDF 文件失败: ${response.status} ${response.statusText}`);
        }

        const pdfData = await response.arrayBuffer(); // 获取 ArrayBuffer
        console.log('成功获取 PDF 数据 (ArrayBuffer)，大小:', pdfData.byteLength);
        
        // 提取 arxiv ID 用于摘要回退
        // const arxivMatch = pdfUrl.match(/\/(\d+\.\d+)/);
        // const arxivId = arxivMatch ? arxivMatch[1] : '';
        
        // 我们首先尝试获取摘要信息，以防 PDF 处理失败时有备选内容
        let backupContent = '';
        try {
            const absUrl = pdfUrl.replace('/pdf/', '/abs/');
            console.log('同时获取摘要页面作为备份:', absUrl);
            backupContent = await parseArticle(absUrl);
            console.log('成功获取摘要备份，长度:', backupContent.length);
        } catch (backupError) {
            console.warn('获取摘要备份失败，继续处理 PDF:', backupError);
        }

        try {
            // 动态导入 PDF.js
            const pdfjsLib = await import('pdfjs-dist/build/pdf');
            console.log('成功导入 PDF.js 库');
            
            // 设置 worker 路径为公共目录中的文件
            pdfjsLib.GlobalWorkerOptions.workerSrc = '/pdf.worker.mjs';
            console.log('PDF.js worker 设置为:', pdfjsLib.GlobalWorkerOptions.workerSrc);
            
            // 设置处理超时
            const pdfProcessingPromise = (async () => {
                try {
                    // 配置 PDF 加载选项，注重性能
                    const loadingTask = pdfjsLib.getDocument({
                        data: pdfData,
                        cMapUrl: 'https://cdn.jsdelivr.net/npm/pdfjs-dist/cmaps/',
                        cMapPacked: true,
                        useSystemFonts: true,
                        disableFontFace: true,  // 禁用字体渲染，提高性能
                        useWorkerFetch: false,  // 禁用 Worker 中的 fetch
                        rangeChunkSize: 65536,  // 增加块大小，减少请求次数
                    });
                    
                    // 获取 PDF 文档
                    console.log('开始加载 PDF 文档...');
                    const pdf = await loadingTask.promise;
                    console.log(`PDF 加载成功，页数: ${pdf.numPages}`);
                    
                    let fullText = `PDF 标题: ${pdfUrl.split('/').pop()}\n`;
                    fullText += `页数: ${pdf.numPages}\n\n`;
                    
                    // 只处理前 5 页，获取论文的关键内容
                    const pageLimit = Math.min(pdf.numPages, 5);
                    fullText += `注意: 为了提高处理效率，仅提取前 ${pageLimit} 页内容。\n\n`;
                    
                    // 并行处理多页 - 但限制并发数量避免过载
                    const pagePromises = [];
                    for (let pageNum = 1; pageNum <= pageLimit; pageNum++) {
                        // 处理单页的函数
                        const processPage = async (pageIndex) => {
                            try {
                                console.log(`开始处理第 ${pageIndex} 页...`);
                                const page = await pdf.getPage(pageIndex);
                                const textContent = await page.getTextContent();
                                const pageText = textContent.items
                                    .map(item => item.str)
                                    .join(' ');
                                
                                return {
                                    pageIndex,
                                    text: `--- 第 ${pageIndex} 页 ---\n${pageText}\n\n`,
                                    success: true
                                };
                            } catch (pageError) {
                                console.error(`处理第 ${pageIndex} 页失败:`, pageError);
                                return {
                                    pageIndex,
                                    text: `--- 第 ${pageIndex} 页 (处理失败) ---\n\n`,
                                    success: false
                                };
                            }
                        };
                        
                        pagePromises.push(processPage(pageNum));
                    }
                    
                    // 等待所有页面处理完成
                    const pageResults = await Promise.all(pagePromises);
                    
                    // 按顺序添加页面内容
                    pageResults.sort((a, b) => a.pageIndex - b.pageIndex);
                    for (const result of pageResults) {
                        fullText += result.text;
                    }
                    
                    // 检查处理成功率
                    const successPages = pageResults.filter(p => p.success).length;
                    if (successPages === 0) {
                        throw new Error('所有页面处理都失败，可能 PDF 格式不兼容');
                    }
                    
                    console.log(`PDF 处理完成，成功提取 ${successPages}/${pageLimit} 页`);
                    return fullText;
                } catch (error) {
                    console.error('PDF 处理过程中出错:', error);
                    throw error;
                }
            })();
            
            // 处理超时控制
            const timeoutPromise = new Promise((_, reject) => {
                setTimeout(() => {
                    reject(new Error('PDF 处理超时'));
                }, 30000); // 30秒超时
            });
            
            // 竞争 PDF 处理和超时
            const pdfText = await Promise.race([pdfProcessingPromise, timeoutPromise])
                .catch(error => {
                    console.error('PDF 处理失败:', error.message);
                    
                    // 如果我们有备用的摘要内容，使用它
                    if (backupContent) {
                        console.log('使用备用摘要内容替代 PDF');
                        return `无法提取 PDF 内容: ${error.message}\n\n论文摘要信息:\n\n${backupContent}\n\n完整 PDF 请访问: ${pdfUrl}`;
                    }
                    
                    return `无法提取 PDF 内容: ${error.message}. 请访问原始页面查看: ${pdfUrl.replace('/pdf/', '/abs/')}`;
                });
            
            // 清理提取的文本并返回
            return cleanText(pdfText);
        } catch (pdfLibError) {
            // 如果 PDF.js 库加载失败，回退到备用方案
            console.error('PDF.js 库加载或初始化失败:', pdfLibError);
            
            if (backupContent) {
                return `PDF 处理组件加载失败，但已获取论文摘要信息:\n\n${backupContent}\n\n完整 PDF 请访问: ${pdfUrl}`;
            }
            
            return `PDF 处理失败且无法获取摘要。错误: ${pdfLibError.message}`;
        }
    } catch (error) {
        console.error('从 PDF URL 获取内容失败:', error);
        return `获取 PDF 内容失败: ${error.message}. URL: ${pdfUrl}`;
    }
}
