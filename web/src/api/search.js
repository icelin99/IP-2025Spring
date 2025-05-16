// api.js
import axios from 'axios';

// 使用相对路径，这样会通过 Vite 代理
const API_BASE_URL = 'http://localhost:5001/api';

export async function searchArticles(query) {
    try {
        console.log('发送搜索请求到:', `${API_BASE_URL}/search`);
        const response = await axios.post(`${API_BASE_URL}/search`, { query }, {
            headers: {
                'Content-Type': 'application/json',
            }
        });
        return response.data;
    } catch (error) {
        console.error('搜索文章时出错:', error);
        throw error.response?.data?.error || '搜索请求失败';
    }
}