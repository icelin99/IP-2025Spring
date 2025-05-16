import json
import os
import requests

class ArticleAnalyzer:
    def __init__(self):
        self.api_key = os.getenv("DEEPSEEK_API_KEY")
        self.api_base = "https://api.deepseek.com/v1"  # DeepSeek API 的基础URL
        
    
    def analyze_articles(self, article):
        """使用LLM分析文章内容，提取关键信息和见解"""
        analysis_prompt = """分析以下HackerNews文章，提供以下信息：
        1. 主要话题和技术领域
        2. 创新点或重要发现
        3. 与AI相关的关键技术
        4. 潜在的应用场景
        
        文章内容：{article_text}
        """
        headers = {
            "Authorization": f"Bearer {self.api_key}",
            "Content-Type": "application/json"
        }
        results = []
        try:
            payload = {
                "model": "deepseek-chat",  # 或其他可用的模型ID
                "messages": [
                    {"role": "system", "content": "你是一个专业的技术文章分析专家。"},
                    {"role": "user", "content": analysis_prompt.format(article_text=article['text'])}
                ],
                "temperature": 0.7,
                "max_tokens": 1000
            }
            
            response = requests.post(
                f"{self.api_base}/chat/completions",
                headers=headers,
                json=payload
            )
            
            if response.status_code == 200:
                analysis = response.json()['choices'][0]['message']['content']
                article['ai_analysis'] = analysis
                results.append(article)
            else:
                print(f"API调用失败，状态码: {response.status_code}")
                print(f"错误信息: {response.text}")
                
        except Exception as e:
            print(f"分析文章时出错: {e}")
    
        return results
    
    def save_analysis_to_file(self, analysis_results, filename):
        with open(filename, 'w', encoding='utf-8') as f:
            json.dump(analysis_results, f, ensure_ascii=False, indent=2)
        print(f"分析结果已保存到 {filename}")
    
def get_articles_url():
    with open('HackerNews_top500.json', 'r', encoding='utf-8') as f:
        articles = json.load(f)
    id_list = [article['id'] for article in articles]
    id_list = id_list[:2]
    url_list = []
    for id in id_list:
        url = f"https://hacker-news.firebaseio.com/v0/item/{id}.json"
        url_list.append({
            "id": id,
            "url": url
        })
    return url_list

def get_article_text(url):
    response = requests.get(url)
    # get news detail
    attributes = ['by', 'descendants', 'id', 'score', 'time', 'title', 'type','url','text']
    
    submission_json = requests.get(url)
    submission_data = submission_json.json()
    print(submission_data)
    for attribute in attributes:
        submission_data[attribute] = submission_data.get(attribute, "None")
    return submission_data


def main():
    analyzer = ArticleAnalyzer()
    articles = get_articles_url()
    results = []
    for article in articles:
        url = article['url']
        print(f"Getting article {article['id']}, {url}")
        data_ = get_article_text(url)
        result = analyzer.analyze_articles(data_)
        results.append(result)
    analyzer.save_analysis_to_file(results, "AI_analysis_results_20.json")

main()