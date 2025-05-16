<template>
    <div class="recommendations" v-if="selectedArticle">
      <div class="recommendations-header">
        <h3>Recommended Papers</h3>
        <p class="selected-title">Based on: {{ selectedArticle.title }}</p>
      </div>
      <div class="papers-list">
        <div v-if="loading" class="loading">Loading recommendations...</div>
        <div v-else-if="relatedPapers.length === 0" class="no-papers">
          No recommended papers available
        </div>
        <div 
          v-else
          v-for="paper in relatedPapers" 
          :key="paper.arxiv_url"
          class="paper-item"
        >
          <div class="paper-header">
            <a 
              :href="paper.arxiv_url"
              target="_blank"
              class="paper-title"
            >
              {{ paper.paper_title }}
            </a>
            <button 
              class="add-button" 
              :class="{ 'added': isPaperAdded(paper.arxiv_url) }"
              @click="toggleAddPaper(paper)" 
              title="Add to favorites"
            >
              {{ isPaperAdded(paper.arxiv_url) ? '✖️' : '+' }}
            </button>
          </div>
          <span class="similarity">Similarity: {{ (paper.similarity * 100).toFixed(1) }}%</span>
        </div>
      </div>
    </div>
  </template>
  
  <script setup>
  /* eslint-disable no-undef */
  // import { ref, computed } from 'vue';
  import { userStore } from '@/store/userStore';
  
  defineProps({
    selectedArticle: {
      type: Object,
      default: null
    },
    relatedPapers: {
      type: Array,
      default: () => []
    },
    loading: {
      type: Boolean,
      default: false
    }
  });
  
  // 检查论文是否已被添加到收藏
  const isPaperAdded = (paperUrl) => {
    return userStore.isPaperAdded(paperUrl);
  };
  
  // 切换收藏状态
  const toggleAddPaper = (paper) => {
    console.log('toggleAddPaper', paper);
    if (isPaperAdded(paper.arxiv_url)) {
      // 如果已添加，则移除
      userStore.removePaper(paper.arxiv_url);
    } else {
      // 如果未添加，则添加
      userStore.addPaper(paper);
    }
  };
  </script>
  
  <style scoped>
  .recommendations {
    background: white;
    border-radius: 8px;
    padding: 20px;
    box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
    height: fit-content;
    position: sticky;
    top: 20px;
  }
  
  .recommendations-header {
    margin-bottom: 20px;
    padding-bottom: 15px;
    border-bottom: 1px solid #eee;
  }
  
  .recommendations-header h3 {
    margin: 0 0 10px 0;
    color: #2c3e50;
  }
  
  .selected-title {
    margin: 0;
    font-size: 0.9em;
    color: #666;
  }
  
  .papers-list {
    display: flex;
    flex-direction: column;
    gap: 12px;
  }
  
  .paper-item {
    display: flex;
    flex-direction: column;
    gap: 4px;
    padding: 12px;
    border: 1px solid #eee;
    border-radius: 6px;
    color: inherit;
    transition: all 0.2s;
  }
  
  .paper-item:hover {
    background: #f9f9f9;
    transform: translateY(-2px);
  }
  
  .paper-header {
    display: flex;
    position: relative;
    margin-bottom: 8px;
  }
  
  .paper-title {
    font-size: 0.95em;
    color: #2c3e50;
    text-decoration: none;
    padding-right: 30px; /* 为加号按钮留出空间 */
    display: block;
  }
  
  .paper-title:hover {
    color: #42b883;
    text-decoration: underline;
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
    font-size: 16px;
    line-height: 1;
    padding: 0;
    border: none;
    outline: none;
    border-radius: 50%;
    background: #42b883;
    color: white;
    cursor: pointer;
    transition: background-color 0.3s, transform 0.2s;
  }
  
  .add-button:focus {
    outline: none;
  }
  
  .add-button:hover {
    transform: scale(1.1);
  }
  
  .add-button.added {
    background-color: #d3d3d3;
    color: #fff;
  }
  
  .similarity {
    font-size: 0.85em;
    color: #666;
  }
  
  .no-papers {
    text-align: center;
    padding: 20px;
    color: #666;
  }
  
  .loading {
    text-align: center;
    padding: 20px;
    color: #666;
  }
  </style>