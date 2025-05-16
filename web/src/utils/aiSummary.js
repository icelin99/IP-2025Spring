import { API_KEYS } from '@/config/api';

export async function getAISummary(content) {
    try {
        const response = await fetch('https://api.deepseek.com/v1/chat/completions', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${API_KEYS.DEEPSEEK}`
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
        console.log('AI 总结结果:', data.choices[0].message.content);
        return data.choices[0].message.content;
    } catch (error) {
        console.error('AI 总结错误:', error);
        throw error;
    }
} 