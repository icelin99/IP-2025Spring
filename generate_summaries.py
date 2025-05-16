#!/usr/bin/env python3
import json
import os
import time
import requests
from tqdm import tqdm
import traceback
from extract_relation import search_articles_with_cached_embeddings

# API Key
DEEPSEEK_API_KEY = 'sk-814ac6e28a2a4e609523c78c122dd7df'

# 文件路径
HN_DATA_PATH = 'HackerNews_top500.json'
OUTPUT_PATH = '/data2/HackerNewsAISummaries.json'

# 使用parseArticle函数从web项目中导入
def parse_article(url):
    """使用请求代理服务获取文章内容"""
    if not url:
        return '无法获取文章内容：URL不存在'
    
    try:
        # 使用proxy服务
        proxy_url = f"https://api.codetabs.com/v1/proxy?quest={url}"
        headers = {
            'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/96.0.4664.93 Safari/537.36'
        }
        
        response = requests.get(proxy_url, headers=headers, timeout=30)
        response.raise_for_status()
        
        # 提取文本内容 (简单提取方式)
        html_content = response.text
        
        # 提取标题 (简单方式)
        start_title = html_content.find('<title>') 
        end_title = html_content.find('</title>')
        title = "无标题"
        if start_title != -1 and end_title != -1:
            title = html_content[start_title+7:end_title].strip()
        
        # 简单文本清理
        for tag in ['<script', '</script>', '<style', '</style>', '<nav', '</nav>']:
            html_content = html_content.replace(tag, " ")
        
        # 组合最终结果
        result = f"""
标题: {title}
URL: {url}

{html_content[:10000]}  # 限制内容长度以避免过大的请求
        """.strip()
        
        return result
    except Exception as e:
        print(f"解析文章失败 [{url}]: {str(e)}")
        return f"无法获取文章内容：{str(e)}"

def get_ai_summary(content):
    """获取AI对文章的分析"""
    try:
        response = requests.post(
            'https://api.deepseek.com/v1/chat/completions',
            headers={
                'Content-Type': 'application/json',
                'Authorization': f'Bearer {DEEPSEEK_API_KEY}'
            },
            json={
                "model": "deepseek-chat",
                "messages": [
                    {
                        "role": "system",
                        "content": "你是一个专业的技术文章分析专家。请用中文分析以下HackerNews文章，提供以下信息：1. 主要话题和技术领域 2. 创新点或重要发现 3. 与AI相关的关键技术 4. 潜在的应用场景"
                    },
                    {
                        "role": "user",
                        "content": content
                    }
                ],
                "temperature": 0.7
            },
            timeout=60  # 增加超时时间
        )
        
        response.raise_for_status()
        data = response.json()
        return data['choices'][0]['message']['content']
    except Exception as e:
        print(f"AI 总结错误: {str(e)}")
        traceback.print_exc()
        return f"无法获取AI分析：{str(e)}"

def main():
    try:
        # 读取HackerNews数据
        print('正在读取HackerNews数据...')
        with open(HN_DATA_PATH, 'r', encoding='utf-8') as f:
            data = json.load(f)
        
        # 创建结果数组
        summaries = []
        
        # 检查是否存在已保存的结果
        if os.path.exists(OUTPUT_PATH):
            try:
                with open(OUTPUT_PATH, 'r', encoding='utf-8') as f:
                    summaries = json.load(f)
                print(f"已加载{len(summaries)}篇已处理的文章")
            except json.JSONDecodeError:
                print("现有的结果文件格式无效，将从头开始")
        
        # 处理的文章ID集合
        processed_ids = set(item['id'] for item in summaries)
        
        # 处理每篇文章
        articles_to_process = [article for article in data if article['id'] not in processed_ids]
        print(f"开始处理{len(articles_to_process)}篇新文章...")
        
        for i, article in enumerate(tqdm(articles_to_process)):
            try:
                # 只处理有URL的文章
                if not article.get('url'):
                    print(f"  跳过: 文章没有URL - {article['title']}")
                    continue
                
                # 解析文章
                content = parse_article(article['url'])
                
                # AI分析
                ai_summary = get_ai_summary(content)
                
                # 添加到结果
                summaries.append({
                    'id': article['id'],
                    'title': article['title'],
                    'url': article['url'],
                    'aiSummary': ai_summary
                })
                
                # 每处理10篇文章保存一次结果，防止中断导致数据丢失
                if (i + 1) % 10 == 0:
                    with open(OUTPUT_PATH, 'w', encoding='utf-8') as f:
                        json.dump(summaries, f, ensure_ascii=False, indent=2)
                    print(f"已保存{len(summaries)}篇文章的分析结果")
                
                # 延迟一段时间，避免API限制
                time.sleep(2)
            except Exception as e:
                print(f"处理文章出错 [{article['title']}]: {str(e)}")
                traceback.print_exc()
                # 即使出错也继续处理下一篇
        
        # 保存最终结果
        with open(OUTPUT_PATH, 'w', encoding='utf-8') as f:
            json.dump(summaries, f, ensure_ascii=False, indent=2)
        print(f"所有处理完成! 共保存了{len(summaries)}篇文章的分析结果")
        
    except Exception as e:
        print(f"处理过程中出错: {str(e)}")
        traceback.print_exc()

if __name__ == "__main__":
    main() 