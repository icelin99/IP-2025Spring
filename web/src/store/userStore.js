// userStore.js
import { reactive } from 'vue';

// 使用reactive创建响应式状态
export const userStore = reactive({
  // 用户收藏的文章列表
  userAddList: [],
  
  // 用户收藏的论文列表
  userAddedPapers: [],
  
  // 添加文章到收藏列表
  addArticle(article) {
    // 检查文章是否已存在
    const exists = this.userAddList.some(item => item.id === article.id);
    if (!exists) {
      this.userAddList.push({
        id: article.id,
        title: article.title,
        url: article.url,
        addTime: new Date().toISOString()
      });
      // 可选：存储到localStorage
      this.saveToLocalStorage();
      return true;
    }
    return false;
  },
  
  // 从收藏列表中移除文章
  removeArticle(articleId) {
    const index = this.userAddList.findIndex(item => item.id === articleId);
    if (index !== -1) {
      this.userAddList.splice(index, 1);
      // 可选：更新localStorage
      this.saveToLocalStorage();
      return true;
    }
    return false;
  },
  
  // 检查文章是否已收藏
  isArticleAdded(articleId) {
    return this.userAddList.some(item => item.id === articleId);
  },
  
  // 添加论文到收藏列表
  addPaper(paper) {
    // 使用arxiv_url作为唯一标识
    const exists = this.userAddedPapers.some(item => item.arxiv_url === paper.arxiv_url);
    if (!exists) {
      this.userAddedPapers.push({
        ...paper,
        addTime: new Date().toISOString()
      });
      // 存储到localStorage
      this.saveToLocalStorage();
      return true;
    }
    return false;
  },
  
  // 从收藏列表中移除论文
  removePaper(paperUrl) {
    const index = this.userAddedPapers.findIndex(item => item.arxiv_url === paperUrl);
    if (index !== -1) {
      this.userAddedPapers.splice(index, 1);
      // 更新localStorage
      this.saveToLocalStorage();
      return true;
    }
    return false;
  },
  
  // 检查论文是否已收藏
  isPaperAdded(paperUrl) {
    return this.userAddedPapers.some(item => item.arxiv_url === paperUrl);
  },
  
  // 将收藏列表保存到localStorage
  saveToLocalStorage() {
    localStorage.setItem('userAddList', JSON.stringify(this.userAddList));
    localStorage.setItem('userAddedPapers', JSON.stringify(this.userAddedPapers));
  },
  
  // 从localStorage加载收藏列表
  loadFromLocalStorage() {
    const savedArticles = localStorage.getItem('userAddList');
    if (savedArticles) {
      try {
        const parsed = JSON.parse(savedArticles);
        this.userAddList = parsed;
      } catch (e) {
        console.error('Failed to parse saved articles', e);
      }
    }
    
    const savedPapers = localStorage.getItem('userAddedPapers');
    if (savedPapers) {
      try {
        const parsed = JSON.parse(savedPapers);
        this.userAddedPapers = parsed;
      } catch (e) {
        console.error('Failed to parse saved papers', e);
      }
    }
  }
});

// 初始化时从localStorage加载数据
if (typeof window !== 'undefined') {
  userStore.loadFromLocalStorage();
}