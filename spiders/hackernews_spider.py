# spiders/hackernews_spider.py
import scrapy
from bs4 import BeautifulSoup
import json
from datetime import datetime
import uuid

class HackerNewsSpider(scrapy.Spider):
    name = 'hackernews'
    
    def __init__(self, url=None, *args, **kwargs):
        super(HackerNewsSpider, self).__init__(*args, **kwargs)
        self.start_url = url or "https://ericdraken.com/pfsense-decrypt-ad-traffic/"
    
    def start_requests(self):
        yield scrapy.Request(self.start_url, callback=self.parse_article)

    def parse_article(self, response):
        soup = BeautifulSoup(response.text, 'html.parser')
        
        # 移除script和style标签
        for script in soup(['script', 'style']):
            script.decompose()
            
        # 获取文本内容
        text = soup.get_text(separator='\n', strip=True)
        
        # 获取标题
        title = soup.title.string if soup.title else "无标题"
        
        # 整理数据
        yield {
            'id': str(uuid.uuid4()),  # 生成随机ID
            'title': title,
            'url': response.url,
            'time': datetime.now().isoformat(),
            'content': text
        }