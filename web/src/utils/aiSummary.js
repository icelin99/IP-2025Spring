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
                        content: "You are a professional technical article analysis expert. Please analyze the following HackerNews article in English, providing the following information: 1. Main topic and technical domain 2. Innovation points or important findings 3. Key AI-related technologies 4. Potential application scenarios"
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
            throw new Error(`AI analysis failed: ${response.status} ${response.statusText}`);
        }

        const data = await response.json();
        console.log('AI analysis result:', data.choices[0].message.content);
        return data.choices[0].message.content;
    } catch (error) {
        console.error('AI analysis error:', error);
        throw error;
    }
} 