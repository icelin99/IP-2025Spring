<template>
  <div class="hn-card" @click="$emit('select')">
    <div class="card-header">
      <h3 class="title">
        <a :href="article.url" target="_blank" rel="noopener" @click.stop>
          {{ article.title }}
        </a>
      </h3>
      <button 
        class="add-button" 
        :class="{ 'added': isAdded }"
        @click.stop="toggleAddArticle" 
        title="Add to favorites"
      >
        {{ isAdded ? '✖️' : '+' }}
      </button>
    </div>
    <div class="card-content">
      <!-- Middle content area, can be empty or add other content -->
    </div>
    <div class="card-footer">
      <div class="meta">
        <span class="author">Author: {{ article.by }}</span>
        <span class="points">👍 {{ article.score }}</span>
      </div>
      <div class="stats">
        <span>💬 {{ article.descendants || 0 }}comments</span>
        <span><button @click.stop="handleClick">Get AI Analysis</button></span>
        <span>{{ formatDate(article.time) }}</span>
      </div>
    </div>
  </div>

  <!-- 弹窗 -->
  <div v-if="showModal" class="modal-overlay" @click="showModal = false">
    <div class="modal-content" @click.stop>
      <div class="modal-header">
        <h2>{{ article.title }}</h2>
        <button class="close-button" @click="showModal = false">×</button>
      </div>
      
      <div class="modal-body">
        <div class="article-info">
          <p><strong>Author:</strong> {{ article.by }}</p>
          <p><strong>URL:</strong> <a :href="article.url" target="_blank">{{ article.url }}</a></p>
        </div>

        <div v-if="isLoading" class="loading">AI is analyzing the article...</div>
        
        <div v-if="aiSummary" class="ai-summary">
          <h3>AI Analysis</h3>
          <div class="summary-text" v-html="renderMarkdown(aiSummary)"></div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
/* eslint-disable no-undef */
import { ref, watch } from 'vue';
import { parseArticle } from '@/utils/getArticle';
import { getAISummary } from '@/utils/aiSummary';
import { userStore } from '@/store/userStore';

const props = defineProps({
  article: {
    type: Object,
    required: true
  }
});

// 定义要发射的事件
// const emit = defineEmits(['select']);

const showModal = ref(false);
const isLoading = ref(false);
const aiSummary = ref('');
const isAdded = ref(userStore.isArticleAdded(props.article.id)); // 初始化时检查是否已添加

// 监听userStore的变化，更新isAdded状态
watch(() => [...userStore.userAddList], () => {
  isAdded.value = userStore.isArticleAdded(props.article.id);
}, { deep: true });

const formatDate = (timestamp) => {
  return new Date(timestamp * 1000).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric'
  });
};

// 添加到收藏的处理函数
const toggleAddArticle = () => {
  console.log('id',props.article.id)
  if (isAdded.value) {
    // 如果已添加，则移除
    userStore.removeArticle(props.article.id);
  } else {
    // 如果未添加，则添加
    userStore.addArticle(props.article);
  }
  // 更新状态
  isAdded.value = userStore.isArticleAdded(props.article.id);
  console.log('isAdded',userStore.userAddList)
};

// 自定义简单的Markdown渲染函数
const renderMarkdown = (text) => {
  if (!text) return '';
  
  // 处理标题
  let html = text
    .replace(/^### (.*$)/gim, '<h3>$1</h3>')
    .replace(/^## (.*$)/gim, '<h2>$1</h2>')
    .replace(/^# (.*$)/gim, '<h1>$1</h1>');
  
  // 处理加粗和斜体
  html = html
    .replace(/\*\*(.*?)\*\*/gim, '<strong>$1</strong>')
    .replace(/\*(.*?)\*/gim, '<em>$1</em>');
  
  // 处理列表
  html = html
    .replace(/^\d+\.\s+(.*$)/gim, '<ol><li>$1</li></ol>')
    .replace(/^-\s+(.*$)/gim, '<ul><li>$1</li></ul>');
  
  // 处理链接
  html = html.replace(/\[([^\]]+)\]\(([^)]+)\)/gim, '<a href="$2" target="_blank">$1</a>');
  
  // 处理代码块
  html = html.replace(/```([\s\S]*?)```/gm, '<pre><code>$1</code></pre>');
  
  // 处理行内代码
  html = html.replace(/`([^`]+)`/gim, '<code>$1</code>');
  
  // 处理段落和换行
  html = html.replace(/\n\s*\n/gim, '</p><p>');
  html = '<p>' + html + '</p>';
  
  // 修复嵌套标签问题
  html = html.replace(/<\/p><p><h([1-3])>/gim, '</p><h$1>');
  html = html.replace(/<\/h([1-3])><\/p>/gim, '</h$1><p>');
  
  return html;
};

const handleClick = async () => {
  try {
    showModal.value = true;
    isLoading.value = true;
    const content = await parseArticle(props.article.url);
    aiSummary.value = await getAISummary(content);
  } catch (error) {
    console.error('处理文章失败:', error);
  } finally {
    isLoading.value = false;
  }
};
</script>

<style scoped>
.hn-card {
  border: 1px solid #eee;
  border-radius: 8px;
  padding: 16px;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
  background: white;
  transition: transform 0.2s;
  cursor: pointer;
  display: flex;
  flex-direction: column;
  height: 180px; /* 固定卡片高度 */
  position: relative; /* 为绝对定位的子元素提供参考 */
}

.hn-card:hover {
  transform: translateY(-2px);
  box-shadow: 0 4px 8px rgba(0, 0, 0, 0.1);
}

.card-header {
  display: flex;
  position: relative;
  margin-bottom: 12px;
}

.title {
  margin: 0;
  font-size: 1.1em;
  line-height: 1.4;
  padding-right: 30px; /* 为加号按钮留出空间 */
}

.title a {
  color: #2c3e50;
  text-decoration: none;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.title a:hover {
  color: #42b883;
}

.add-button {
  position: absolute;
  top: 0;
  right: 0;
  width: 24px;
  height: 24px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 18px;
  line-height: 1;
  padding: 0;
  border-radius: 50%;
  background: #42b883;
  color: white;
  cursor: pointer;
  transition: background-color 0.3s, transform 0.2s;
}

.add-button:hover {
  transform: scale(1.1);
}

.add-button.added {
  background-color: #d3d3d3;
  color: #fff;
}

.card-content {
  flex: 1; /* 占据中间所有空间 */
}

.card-footer {
  margin-top: auto; /* 推到底部 */
}

.meta {
  display: flex;
  justify-content: space-between;
  color: #666;
  margin-bottom: 8px;
  font-size: 0.9em;
}

.stats {
  display: flex;
  justify-content: space-between;
  align-items: center;
  color: #666;
  font-size: 0.9em;
  padding-top: 12px;
  border-top: 1px solid #eee;
}

button {
  padding: 4px 12px;
  border: none;
  border-radius: 4px;
  background: #42b883;
  color: white;
  cursor: pointer;
  font-size: 0.9em;
  line-height: 1.5;
}

button:hover {
  background: #3aa876;
}

.stats span {
  display: flex;
  align-items: center;
}

/* 弹窗样式 */
.modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background-color: rgba(0, 0, 0, 0.5);
  display: flex;
  justify-content: center;
  align-items: center;
  z-index: 1000;
}

.modal-content {
  background: white;
  border-radius: 8px;
  width: 80%;
  max-width: 800px;
  max-height: 80vh;
  overflow-y: auto;
  box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
}

.modal-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 20px;
  border-bottom: 1px solid #eee;
}

.modal-header h2 {
  margin: 0;
  font-size: 1.5em;
  color: #2c3e50;
}

.close-button {
  background: none;
  border: none;
  font-size: 1.5em;
  color: #666;
  cursor: pointer;
  padding: 5px;
}

.close-button:hover {
  color: #333;
}

.modal-body {
  padding: 20px;
}

.article-info {
  margin-bottom: 20px;
  padding: 15px;
  background: #f8f9fa;
  border-radius: 4px;
}

.article-info p {
  margin: 8px 0;
  color: #666;
}

.article-info a {
  color: #42b883;
  text-decoration: none;
  word-break: break-all;
}

.article-info a:hover {
  text-decoration: underline;
}

.loading {
  text-align: center;
  padding: 20px;
  color: #666;
}

.ai-summary {
  background: #f8f9fa;
  padding: 20px;
  border-radius: 8px;
  border-left: 4px solid #42b883;
}

.ai-summary h3 {
  margin: 0 0 15px 0;
  color: #2c3e50;
}

.summary-text {
  color: #666;
  line-height: 1.6;
}

/* Markdown 样式 */
.summary-text :deep(h1),
.summary-text :deep(h2),
.summary-text :deep(h3) {
  margin-top: 1em;
  margin-bottom: 0.5em;
  color: #2c3e50;
}

.summary-text :deep(h1) {
  font-size: 1.6em;
}

.summary-text :deep(h2) {
  font-size: 1.4em;
}

.summary-text :deep(h3) {
  font-size: 1.2em;
}

.summary-text :deep(p) {
  margin-bottom: 1em;
}

.summary-text :deep(ul),
.summary-text :deep(ol) {
  margin-bottom: 1em;
  padding-left: 2em;
}

.summary-text :deep(li) {
  margin-bottom: 0.5em;
}

.summary-text :deep(code) {
  background-color: #f5f5f5;
  padding: 0.2em 0.4em;
  border-radius: 3px;
  font-family: monospace;
  font-size: 0.9em;
}

.summary-text :deep(pre) {
  background-color: #f5f5f5;
  padding: 1em;
  border-radius: 5px;
  overflow-x: auto;
  margin-bottom: 1em;
}

.summary-text :deep(pre code) {
  background-color: transparent;
  padding: 0;
}

.summary-text :deep(a) {
  color: #42b883;
  text-decoration: none;
}

.summary-text :deep(a:hover) {
  text-decoration: underline;
}

.summary-text :deep(blockquote) {
  border-left: 4px solid #ddd;
  padding-left: 1em;
  margin-left: 0;
  color: #777;
}
</style> 