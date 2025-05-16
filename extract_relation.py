import json
import spacy
from collections import defaultdict
import en_core_web_sm
import faiss
from transformers import AutoTokenizer, AutoModel
import torch
import numpy as np
from tqdm import tqdm
import sys

class DocumentSimilaritySearch:
    def __init__(self):
        self.tokenizer = AutoTokenizer.from_pretrained('sentence-transformers/all-MiniLM-L12-v2')
        self.model = AutoModel.from_pretrained('sentence-transformers/all-MiniLM-L12-v2')
        self.model = AutoModel.from_pretrained('sentence-transformers/all-MiniLM-L12-v2')
        self.device = torch.device('cuda' if torch.cuda.is_available() else 'cpu')
        self.model.to(self.device)
    
    def __del__(self):
        # 清理资源，防止信号量泄漏
        self.model = None
        if torch.cuda.is_available():
            torch.cuda.empty_cache()
    
    def get_embedding(self, texts, batch_size=16):
        """生成文本嵌入向量
            Args:
                texts: 文本列表
                batch_size: 批处理大小
                
            Returns:
                numpy.ndarray: 文本嵌入向量矩阵
        """
        embeddings = []

        for i in range(0, len(texts), batch_size):
            batch_texts = texts[i:i+batch_size]
            encoded = self.tokenizer(
                batch_texts,
                padding=True,
                truncation=True,
                max_length=512,
                return_tensors='pt'
            )
            encoded.to(self.device)
            
            # 获取BERT输出
            with torch.no_grad():
                outputs = self.model(**encoded)
                # 获取注意力掩码
                attention_mask = encoded['attention_mask']

                # 使用平均池化获取文档表示
                # 最后一层隐藏状态: [batch_size, sequence_length, hidden_size]
                last_hidden = outputs.last_hidden_state

                # 扩展注意力掩码维度以匹配隐藏状态
                attention_mask_expanded = attention_mask.unsqueeze(-1).expand(last_hidden.size()).float()
                
                # 应用掩码并计算平均值
                sum_embeddings = torch.sum(last_hidden * attention_mask_expanded, 1)
                sum_mask = torch.clamp(attention_mask_expanded.sum(1), min=1e-9)
                batch_embeddings = (sum_embeddings / sum_mask).cpu().numpy()
                
                embeddings.append(batch_embeddings)
                
            # 手动清理GPU内存
            if self.device.type == 'cuda':
                del encoded, outputs, last_hidden, attention_mask, attention_mask_expanded
                torch.cuda.empty_cache()

        return np.vstack(embeddings)
    

def find_related_documents(data_source):
    """使用FAISS查找相关文档"""
    similarity_search = DocumentSimilaritySearch()

    arxiv_texts = []
    arxiv_papers = []
    # 创建id到索引的映射
    id_to_idx = {}
    for idx, paper in enumerate(tqdm(data_source['arxiv'], desc="处理arXiv文档")):
        arxiv_texts.append(paper['title'] + ". " + paper['summary'])
        arxiv_papers.append({
            'url': str(paper['id']),  # 论文URL
            'title': paper['title']
        })
        id_to_idx[str(paper['id'])] = idx
    # 获取embeddings
    arxiv_embeddings = similarity_search.get_embedding(arxiv_texts)

    # 构建FAISS索引
    dimension = arxiv_embeddings.shape[1]
    index = faiss.IndexFlatL2(dimension)
    index.add(arxiv_embeddings.astype('float32'))

    document_relations = []
    batch_size = 16

    # 批量处理HackerNews
    hn_articles = [(article['id'], article['title'], article.get('aiSummary', '')) for article in data_source['hackernews']]
    for i in tqdm(range(0, len(hn_articles), batch_size), 
                 desc="计算文档相似度", 
                 total=(len(hn_articles) + batch_size - 1) // batch_size):
        batch_articles = hn_articles[i:i+batch_size]
        # 组合标题和AI摘要作为文本输入
        batch_texts = [f"{article[1]} {article[2]}" for article in batch_articles]

        query_embeddings = similarity_search.get_embedding(batch_texts)
        k = 5 # 返回最相似的5个文档
        distances, indices = index.search(query_embeddings.astype('float32'), k)

        for j, (article_id, article_title, article_summary) in enumerate(batch_articles):
            top_related = [
                {
                    'arxiv_url': arxiv_papers[idx]['url'],
                    'similarity': float(1 / (1 + distances[j][i])),
                    'paper_title': arxiv_papers[idx]['title']
                }
                for i, idx in enumerate(indices[j])
                if idx < len(arxiv_papers)
            ]
            document_relations.append({
                'hackernews_id': str(article_id),
                'hackernews_title': article_title,
                'related_arxiv': top_related
            })
    return document_relations


def load_data(arxiv_file, hackernews_file):
    data = {'arxiv': [], 'hackernews': []}
    with open(arxiv_file, 'r', encoding='utf-8') as f:
        data['arxiv'] = json.load(f)
    with open(hackernews_file, 'r', encoding='utf-8') as f:
        data['hackernews'] = json.load(f)
    return data


def save_document_relations(document_relations, output_file):
    output = {
        'document_relations': document_relations,
        'statistics': {
            'total_relations': len(document_relations),
            'average_similarity': sum(
                sum(paper['similarity'] for paper in rel['related_arxiv']) 
                for rel in document_relations
            ) / sum(len(rel['related_arxiv']) for rel in document_relations)
        }
    }
    with open(output_file, 'w', encoding='utf-8') as f:
        json.dump(output, f, ensure_ascii=False, indent=4)
    
    print(f"文档关系已保存到: {output_file}")
    print(f"总关系数: {output['statistics']['total_relations']}")
    print(f"平均相似度: {output['statistics']['average_similarity']:.3f}")

def calculate_and_save_embeddings(data_source, output_file):
    similarity_search = DocumentSimilaritySearch()
    hn_texts = [f"{article['title']} {article.get('aiSummary', '')}" for article in data_source['hackernews']]
    hn_embeddings = similarity_search.get_embedding(hn_texts)
    embeddings_data = {
        'articles': data_source['hackernews'],
        'embeddings': hn_embeddings.tolist()  # numpy array 转换为 list
    }
    with open(output_file, 'w') as f:
        json.dump(embeddings_data, f)
    
    print(f"已保存 {len(hn_texts)} 篇文章的 embeddings")

def search_articles_with_cached_embeddings(query, top_k=10):
    """使用缓存的 embeddings 进行搜索"""
    similarity_search = DocumentSimilaritySearch()
    
    # 加载缓存的 embeddings
    with open('article_embeddings.json', 'r') as f:
        cached_data = json.load(f)
    
    articles = cached_data['articles']
    embeddings = np.array(cached_data['embeddings'])
    
    # 计算查询文本的 embedding
    query_embedding = similarity_search.get_embedding([query])[0]
    # 将查询向量重塑为2D数组
    query_embedding = query_embedding.reshape(1, -1)  # 添加这行


    # 创建 FAISS 索引
    dimension = embeddings.shape[1]
    index = faiss.IndexFlatL2(dimension)
    index.add(embeddings.astype('float32'))

    # 使用 FAISS 搜索最相似的文章
    distances, indices = index.search(query_embedding.astype('float32'), top_k)
    
    
    # 整理结果
    results = []
    for i, idx in enumerate(indices[0]):
        if idx < len(articles):  # 确保索引有效
            results.append({
                **articles[idx],
                'similarity': float(1 / (1 + distances[0][i]))  # 转换距离为相似度
            })
    
    return results
    

def main():
    data = load_data('arxiv_papers_clear.json', 'data2/HackerNewsAISummaries.json')
    if len(sys.argv) > 1:
        if sys.argv[1] == 'cache_embeddings':
            # 预计算并缓存 embeddings
            calculate_and_save_embeddings(data, 'data2/article_embeddings.json')
        
        elif sys.argv[1] == 'search':
            # 使用缓存的 embeddings 进行搜索
            query = sys.argv[2]
            sorted_articles = search_articles_with_cached_embeddings(query)
            with open('sorted_hackernews.json', 'w', encoding='utf-8') as f:
                json.dump(sorted_articles, f, ensure_ascii=False, indent=2)
            print(f"搜索结果已保存到 sorted_hackernews.json")
    else:
        # 原有的文档关系处理
        relations = find_related_documents(data)
        save_document_relations(relations, 'data2/document_relations.json')
    
    # 清理资源
    import gc
    gc.collect()
    if torch.cuda.is_available():
        torch.cuda.empty_cache()
    
    # 如果使用了FAISS，显式释放FAISS资源
    import faiss
    if hasattr(faiss, 'reset_seed'):
        faiss.reset_seed()

if __name__ == "__main__":
    main()
