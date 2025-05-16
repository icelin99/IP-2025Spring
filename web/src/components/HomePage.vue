<template>
    <div class="container">
        <div v-if="loading" class="loading">
            加载中...
        </div>
        <div v-else class="main-layout">
            <!-- 左侧对话框 -->
            <div class="chat-section">
                <div class="chat-container">
                    <ChatBox @updateArticles="updateArticles" />
                </div>
            </div>

            <!-- 中间文章列表 -->
            <div class="articles-section">
                <div class="articles-grid">
                    <HNCard v-for="article in displayedArticles" :key="article.id" :article="article"
                        @select="selectArticle(article)" :class="{ 'selected': selectedArticle?.id === article.id }" />
                </div>

               
            </div>

            <!-- 右侧推荐论文 -->
            <div class="recommendations-section">
                <RecommendedPapers :selected-article="selectedArticle" :related-papers="relatedPapers"
                    :loading="loadingRecommendations" />
            </div>
        </div>
        <div class="pagination">
                    <button :disabled="currentPage === 1" @click="currentPage--">
                        上一页
                    </button>
                    <span>{{ currentPage }} / {{ totalPages }}</span>
                    <button :disabled="currentPage === totalPages" @click="currentPage++">
                        下一页
                    </button>
                </div>
    </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue';
import HNCard from '../components/HNCard.vue';
import RecommendedPapers from '../components/RecommendPaper.vue';
import ChatBox from './ChatBox.vue';
import { getArticles, getRelatedPapers } from '../api/articles';


const articles = ref([]);
const loading = ref(true);
const loadingRecommendations = ref(false);
const currentPage = ref(1);
const itemsPerPage = 6;
const selectedArticle = ref(null);
const relatedPapers = ref([]);

// 计算总页数
const totalPages = computed(() => Math.ceil(articles.value.length / itemsPerPage));

// 计算当前页显示的文章
const displayedArticles = computed(() => {
    const start = (currentPage.value - 1) * itemsPerPage;
    const end = start + itemsPerPage;
    return articles.value.slice(start, end);
});

const selectArticle = async (article) => {
  selectedArticle.value = article;
  loadingRecommendations.value = true;
  try {
    console.log("article", article.id)
    const papers = await getRelatedPapers(article.id);
    relatedPapers.value = papers;
    console.log("relatedPapers", relatedPapers.value)
  } catch (error) {
    console.error('Failed to fetch related papers:', error);
    relatedPapers.value = [];
  } finally {
    loadingRecommendations.value = false;
  }
};

// 模拟获取数据
const fetchArticles = async () => {
    try {
        loading.value = true;
        const data = await getArticles();
        articles.value = data;
    } catch (error) {
        console.error('Failed to fetch articles:', error);
    } finally {
        loading.value = false;
    }
};

// 更新文章列表
const updateArticles = (searchResults) => {
    console.log('收到搜索结果:', searchResults);
    if (Array.isArray(searchResults)) {
        articles.value = searchResults;
        currentPage.value = 1;  // 重置页码
        selectedArticle.value = null;  // 清除选中的文章
        relatedPapers.value = [];  // 清除相关论文
        console.log(articles.value[0].title)
    } else {
        console.error('搜索结果不是数组:', searchResults);
    }
};

onMounted(fetchArticles);
</script>

<style scoped>
.container {
    max-width: 1600px;
    margin: 0 auto;
    padding: 20px;
    height: calc(100vh - 85px); /* 减去padding的高度 */
    display: flex;
    flex-direction: column;
}

.main-layout {
    display: grid;
    grid-template-columns: 300px 1fr 350px;
    gap: 20px;
    height: calc(100% - 80px); /* 减去分页的高度 */
}

.chat-section {
    background: white;
    border-radius: 8px;
    box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
    height: 100%;
    display: flex;
    flex-direction: column;
}

.chat-container {
    height: 100%;
}

.articles-section {
    height: 100%;
    display: flex;
    flex-direction: column;
}

.articles-grid {
    height: 100%;
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
    gap: 20px;
    overflow-y: auto;
    padding-right: 10px;
}

.recommendations-section {
    height: 100%;
    min-width: 350px;
    overflow-y: auto;
}

.pagination {
    height: 40px;
    margin-top: 20px;
    display: flex;
    justify-content: center;
    align-items: center;
    gap: 16px;
    background: white;
    border-radius: 8px;
    box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
}

button {
    padding: 8px 16px;
    border: none;
    border-radius: 4px;
    background: #42b883;
    color: white;
    cursor: pointer;
}

button:disabled {
    background: #ccc;
    cursor: not-allowed;
}

.loading {
    text-align: center;
    padding: 20px;
    font-size: 1.2em;
    color: #666;
}

/* 响应式设计 */
@media (max-width: 1400px) {
    .main-layout {
        grid-template-columns: 250px 1fr 300px;
    }
    
    .recommendations-section {
        min-width: 300px;
    }
}

@media (max-width: 1200px) {
    .main-layout {
        grid-template-columns: 200px 1fr 250px;
    }
    
    .recommendations-section {
        min-width: 250px;
    }
}

@media (max-width: 1000px) {
    .main-layout {
        grid-template-columns: 1fr;
    }
    
    .chat-section, .recommendations-section {
        display: none;
    }
}
</style>