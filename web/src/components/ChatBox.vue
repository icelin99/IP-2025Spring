<template>
  <div class="chat-box">
    <div class="chat-messages" ref="messagesContainer">
      <div v-for="(message, index) in messages" :key="index" 
           :class="['message', message.type]">
        <div class="message-content" v-if="message.type === 'user'">{{ message.content }}</div>
        <div class="message-content markdown-content" v-else v-html="renderMarkdown(message.content)"></div>
      </div>
    </div>
    
    <div class="chat-input">
      <!-- 收藏内容显示区域（文章和论文合并显示） -->
      <div 
        v-if="userStore.userAddList.length > 0 || userStore.userAddedPapers.length > 0" 
        class="favorites-container"
        ref="favoritesContainerRef"
      >
        <div class="favorite-list">
          <!-- 文章项目 -->
          <div 
            v-for="item in userStore.userAddList" 
            :key="'article-'+item.id" 
            class="favorite-item"
            :title="item.title"
            :class="{ 'selected': selectedArticles.includes(item.id) }"
            @click="toggleArticleSelection(item.id)"
          >
            <span class="favorite-title">{{ item.title }}</span>
            <button 
              class="remove-favorite" 
              @click.stop="removeFromFavorite(item.id)"
              title="Remove from favorites"
            >×</button>
          </div>
          
          <!-- 论文项目 -->
          <div 
            v-for="paper in userStore.userAddedPapers" 
            :key="'paper-'+paper.arxiv_url" 
            class="favorite-item paper-item"
            :title="paper.paper_title"
            :class="{ 'selected': selectedPapers.includes(paper.arxiv_url) }"
            @click="togglePaperSelection(paper.arxiv_url)"
          >
            <span class="favorite-title">{{ paper.paper_title }}</span>
            <button 
              class="remove-favorite" 
              @click.stop="removeFromFavoritePapers(paper.arxiv_url)"
              title="Remove from favorites"
            >×</button>
          </div>
        </div>
        
        <!-- 合并的选择信息 -->
        <div v-if="selectedArticles.length > 0 || selectedPapers.length > 0" class="selected-info">
          <span v-if="selectedArticles.length > 0">Selected {{ selectedArticles.length }} article(s)</span>
          <span v-if="selectedArticles.length > 0 && selectedPapers.length > 0"> and </span>
          <span v-if="selectedPapers.length > 0">{{ selectedPapers.length }} paper(s)</span>
          <span> as reference</span>
        </div>
      </div>
      
      <div class="chat-mode">
        <button 
          :class="['mode-btn', { 'active': mode === 'chat' }]" 
          @click="mode = 'chat'">Chat Mode</button>
        <button 
          :class="['mode-btn', { 'active': mode === 'search' }]" 
          @click="mode = 'search'">Search Mode</button>
      </div>
      
      <div class="input-container">
        <input 
          v-model="userInput" 
          :placeholder="mode === 'search' ? 'Enter a domain or topic to search...' : 'Chat with AI assistant...'"
          type="text"
          @keyup.enter="sendMessage"
        >
        <button class="send-button" @click="sendMessage" title="Send">
          <span class="arrow-icon">➤</span>
        </button>
      </div>
    </div>
  </div>
</template>

<script setup>
/* eslint-disable no-undef */
/* eslint-disable no-unused-vars */
import { ref, watch, onMounted, computed } from 'vue';
import { searchArticles } from '../api/search';
import { parseArticle } from '@/utils/getArticle';
import { getAISummary } from '@/utils/aiSummary';
import { API_KEYS } from '@/config/api';
import { userStore } from '@/store/userStore';

const mode = ref('chat'); // 默认为对话模式
const messages = ref([
  { type: 'assistant', content: 'Hello! I am an AI assistant. I can help you find interesting tech articles (switch to Search Mode), or answer your questions (Chat Mode). Select saved articles or papers to use them as reference material.' }
]);
const userInput = ref('');
const messagesContainer = ref(null);
const favoritesContainerRef = ref(null);
const selectedArticles = ref([]); // 存储被选中的文章ID
const selectedPapers = ref([]); // 存储被选中的论文URL
const isProcessing = ref(false); // 是否正在处理请求

const emit = defineEmits(['updateArticles']);

// 计算并监听收藏文章列表的数量变化
watch(() => userStore.userAddList.length, (newVal, oldVal) => {
  // 当收藏列表变化，可能需要调整相关DOM元素
  console.log('收藏文章数量变化:', newVal);
  
  // 如果有文章被移除，也要从选中列表中移除
  selectedArticles.value = selectedArticles.value.filter(id => 
    userStore.userAddList.some(article => article.id === id)
  );
});

// 监听收藏论文列表的变化
watch(() => userStore.userAddedPapers.length, (newVal, oldVal) => {
  console.log('收藏论文数量变化:', newVal);
  
  // 如果有论文被移除，也要从选中列表中移除
  selectedPapers.value = selectedPapers.value.filter(url => 
    userStore.userAddedPapers.some(paper => paper.arxiv_url === url)
  );
});

// 切换文章选择状态
const toggleArticleSelection = (articleId) => {
  const index = selectedArticles.value.indexOf(articleId);
  if (index === -1) {
    selectedArticles.value.push(articleId);
  } else {
    selectedArticles.value.splice(index, 1);
  }
};

// 切换论文选择状态
const togglePaperSelection = (paperUrl) => {
  const index = selectedPapers.value.indexOf(paperUrl);
  if (index === -1) {
    selectedPapers.value.push(paperUrl);
  } else {
    selectedPapers.value.splice(index, 1);
  }
};

// 从收藏中移除文章
const removeFromFavorite = (articleId) => {
  // 如果文章被选中，先从选中列表中移除
  const index = selectedArticles.value.indexOf(articleId);
  if (index !== -1) {
    selectedArticles.value.splice(index, 1);
  }
  userStore.removeArticle(articleId);
};

// 从收藏中移除论文
const removeFromFavoritePapers = (paperUrl) => {
  // 如果论文被选中，先从选中列表中移除
  const index = selectedPapers.value.indexOf(paperUrl);
  if (index !== -1) {
    selectedPapers.value.splice(index, 1);
  }
  userStore.removePaper(paperUrl);
};

// 获取单个文章内容
const getArticleContent = async (article) => {
  console.log(`开始获取文章: ${article.title}`);
  try {
    const content = await parseArticle(article.url);
    console.log(`成功获取文章: ${article.title} (长度: ${content.length})`);
    return content;
  } catch (error) {
    console.error(`获取文章内容失败:`, error);
    return `Unable to retrieve content: ${error.message}`;
  }
};

// 获取单个论文内容
const getPaperContent = async (paper) => {
  console.log(`开始获取论文: ${paper.paper_title}`);
  try {
    const content = await parseArticle(paper.arxiv_url);
    console.log(`成功获取论文: ${paper.paper_title} (长度: ${content.length})`);
    return content;
  } catch (error) {
    console.error(`获取论文内容失败:`, error);
    return `Unable to retrieve paper content: ${error.message}`;
  }
};

// 调用AI进行对话，自动使用选中的文章和论文作为上下文
const chatWithAI = async (userMessage) => {
  if (isProcessing.value) {
    console.log("正在处理上一个请求，请稍候");
    return;
  }
  
  isProcessing.value = true;
  console.log("===开始处理AI对话请求===");
  
  try {
    // 显示loading状态
    messages.value.push({
      type: 'assistant',
      content: 'Thinking...'
    });
    
    // 准备发送给AI的消息
    const systemMessage = {
      role: "system",
      content: "You are a friendly AI assistant, specializing in technology and computer science. You can use Markdown format to format your responses, including headings, lists, code blocks, etc."
    };
    
    // 初始化用户消息为原始问题
    let finalUserMessage = userMessage;
    console.log("原始用户问题:", userMessage);
    
    // 准备资料内容
    let referenceContent = "";
    let hasReferences = false;
    
    // 如果有选中的文章，获取文章内容
    if (selectedArticles.value.length > 0) {
      try {
        // 更新loading消息
        messages.value[messages.value.length - 1].content = 'Retrieving article content...';
        
        // 创建文章内容部分
        referenceContent += "\n\nPlease answer my question based on the following article content:\n\n";
        
        // 获取每篇文章内容 - 确保顺序执行
        for (let i = 0; i < selectedArticles.value.length; i++) {
          const articleId = selectedArticles.value[i];
          const article = userStore.userAddList.find(item => item.id === articleId);
          
          if (article) {
            // 更新加载消息显示当前处理的文章
            messages.value[messages.value.length - 1].content = `Retrieving article content (${i+1}/${selectedArticles.value.length}): ${article.title}`;
            
            console.log(`开始获取第${i+1}篇文章: ${article.title}`);
            // 获取文章内容并等待完成
            try {
              const content = await getArticleContent(article);
              referenceContent += `--- Article: ${article.title} ---\n${content}\n\n`;
              hasReferences = true;
            } catch (error) {
              console.error(`获取文章内容失败:`, error);
              referenceContent += `--- Article: ${article.title} ---\nUnable to retrieve content: ${error.message}\n\n`;
            }
          }
        }
      } catch (articlesError) {
        console.error('获取文章过程中出错:', articlesError);
        messages.value[messages.value.length - 1].content = 'Failed to retrieve article content. I will answer your question directly.';
      }
    }
    
    // 如果有选中的论文，获取论文内容
    if (selectedPapers.value.length > 0) {
      try {
        // 更新loading消息
        messages.value[messages.value.length - 1].content = 'Retrieving paper content...';
        
        // 如果之前没有添加任何引用内容，添加引用标题
        if (!hasReferences) {
          referenceContent += "\n\nPlease answer my question based on the following papers:\n\n";
        }
        
        // 获取每篇论文内容 - 确保顺序执行
        for (let i = 0; i < selectedPapers.value.length; i++) {
          const paperUrl = selectedPapers.value[i];
          const paper = userStore.userAddedPapers.find(item => item.arxiv_url === paperUrl);
          
          if (paper) {
            // 更新加载消息显示当前处理的论文
            messages.value[messages.value.length - 1].content = `Retrieving paper content (${i+1}/${selectedPapers.value.length}): ${paper.paper_title}`;
            
            console.log(`开始获取第${i+1}篇论文: ${paper.paper_title}`);
            // 获取论文内容并等待完成
            try {
              const content = await getPaperContent(paper);
              referenceContent += `--- Paper: ${paper.paper_title} ---\n${content}\n\n`;
              hasReferences = true;
            } catch (error) {
              console.error(`获取论文内容失败:`, error);
              referenceContent += `--- Paper: ${paper.paper_title} ---\nUnable to retrieve content: ${error.message}\n\n`;
            }
          }
        }
      } catch (papersError) {
        console.error('获取论文过程中出错:', papersError);
        messages.value[messages.value.length - 1].content = 'Failed to retrieve paper content. I will answer your question directly.';
      }
    }
    
    // 合并用户问题和引用内容
    if (hasReferences) {
      finalUserMessage = `${userMessage}${referenceContent}`;
      
      // 更新系统消息，指导AI使用资料内容
      systemMessage.content = "You are a professional AI assistant skilled in analyzing and explaining technical content. Please answer the user's question based on the provided article and paper content. If the provided content doesn't address the question, please clearly state this. Use Markdown format for your response.";
      
      // 更新loading消息
      messages.value[messages.value.length - 1].content = 'Analyzing selected content...';
    }
    
    console.log("===验证最终消息===");
    console.log('最终消息长度:', finalUserMessage.length);
    console.log('最终消息前后片段:');
    console.log('- 开始:', finalUserMessage.substring(0, 100));
    console.log('- 结束:', finalUserMessage.substring(finalUserMessage.length - 100));
    
    // 构建完整的消息数组
    const fullMessages = [
      systemMessage,
      {
        role: "user",
        content: finalUserMessage
      }
    ];
    
    console.log('===准备发送到AI API===');
    console.log('消息数组长度:', fullMessages.length);
    
    // 发送请求到AI
    const response = await fetch('https://api.deepseek.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${API_KEYS.DEEPSEEK}`
      },
      body: JSON.stringify({
        model: "deepseek-chat",
        messages: fullMessages,
        temperature: 0.7
      })
    });

    if (!response.ok) {
      throw new Error(`AI response failed: ${response.status}`);
    }

    console.log('收到AI响应');
    const data = await response.json();
    // 更新最后一条消息
    messages.value[messages.value.length - 1].content = data.choices[0].message.content;
    
  } catch (error) {
    // 更新错误消息
    messages.value[messages.value.length - 1].content = 'Sorry, I cannot answer at the moment. Please try again later.';
    console.error('AI对话错误:', error);
  } finally {
    // 无论成功还是失败，都重置处理状态
    isProcessing.value = false;
    console.log("===AI对话请求处理完成===");
  }
};

// 自动滚动到最新消息
watch(messages, () => {
  setTimeout(() => {
    if (messagesContainer.value) {
      messagesContainer.value.scrollTop = messagesContainer.value.scrollHeight;
    }
  }, 50); // 增加延迟，确保DOM更新完成
}, { deep: true });

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

// 搜索文章
const searchForArticles = async (query) => {
  try {
    console.log('开始搜索文章，查询词:', query);
    
    // 添加系统消息
    messages.value.push({
      type: 'assistant',
      content: 'Searching for relevant articles...'
    });
    
    const response = await searchArticles(query);
    console.log('搜索API返回结果:', response);
    
    const results = response.results || [];
    
    // 更新最后的系统消息
    messages.value[messages.value.length - 1].content = 
      `Found ${results.length} relevant articles`;
    
    // 发送事件更新文章列表
    console.log('更新文章列表，结果数量:', results.length);
    emit('updateArticles', results);
  } catch (error) {
    console.error('搜索错误详情:', error);
    messages.value[messages.value.length - 1].content = 'An error occurred during search. Please try again later.';
  }
};

const sendMessage = async () => {
  if (!userInput.value.trim() || isProcessing.value) return;
  
  console.log('发送消息，当前模式:', mode.value);
  
  // 添加用户消息
  messages.value.push({
    type: 'user',
    content: userInput.value
  });

  const userMessage = userInput.value;
  
  // 清空输入 - 提前清空以改善用户体验
  userInput.value = '';
  
  // 根据当前模式选择处理方式
  if (mode.value === 'search') {
    console.log('使用搜索模式处理:', userMessage);
    await searchForArticles(userMessage);
  } else {
    console.log('使用对话模式处理:', userMessage);
    await chatWithAI(userMessage);
  }
};
</script>

<style scoped>
.chat-box {
  display: flex;
  flex-direction: column;
  height: 100%;
  max-height: 100%;
  overflow: hidden;
  position: relative;
}

.chat-messages {
  flex: 1;
  overflow-y: auto;
  padding: 20px;
  display: flex;
  flex-direction: column;
  gap: 12px;
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 190px; /* 为底部区域留出空间，如果合并后高度变化，可能需要调整 */
  transition: bottom 0.3s ease;
}

.message {
  max-width: 85%;
  padding: 10px 15px;
  border-radius: 12px;
  word-wrap: break-word;
}

.message.user {
  align-self: flex-end;
  background-color: #42b883;
  color: white;
}

.message.assistant {
  align-self: flex-start;
  background-color: #f0f0f0;
  color: #333;
}

/* 收藏内容区域样式 */
.favorites-container {
  margin-bottom: 10px;
  background-color: #f5f7f9;
  border-radius: 8px;
  padding: 8px 12px;
  border: 1px solid #e8e8e8;
}

.favorite-list {
  display: flex;
  flex-wrap: nowrap;
  overflow-x: auto;
  gap: 8px;
  padding-bottom: 4px;
  scrollbar-width: thin;
}

.favorite-list::-webkit-scrollbar {
  height: 3px;
}

.favorite-list::-webkit-scrollbar-track {
  background: #f1f1f1;
}

.favorite-list::-webkit-scrollbar-thumb {
  background: #ccc;
  border-radius: 1.5px;
}

.favorite-item {
  background-color: #e8f4f0;
  border: 1px solid #d3e5df;
  border-radius: 4px;
  padding: 3px 6px;
  display: flex;
  align-items: center;
  max-width: 100px; /* 减小最大宽度 */
  flex-shrink: 0;
  cursor: pointer;
  transition: background-color 0.2s;
}

.favorite-item.paper-item {
  background-color: #f0e8f4;
  border-color: #e3d6eb;
}

.favorite-item.selected {
  background-color: #42b883;
}

.favorite-item.paper-item.selected {
  background-color: #7b42b8;
}

.favorite-item.selected .favorite-title {
  color: white;
}

.favorite-title {
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  font-size: 0.8em;
  color: #333;
  margin-right: 4px;
}

.remove-favorite {
  background: #42b883;
  color: #ffffff;
  border: none;
  border-radius: 10%;
  padding: 0 4px !important;
  font-size: 12px;
  cursor: pointer;
  line-height: 1;
  width: 20px;
  height: 20px;
}

.favorite-item.paper-item .remove-favorite {
  background: #7b42b8;
}

.remove-favorite:hover {
  color: #ff4757;
  background-color: #cccccc !important;
}

.selected-info {
  font-size: 0.8em;
  color: #666;
  margin-top: 6px;
  text-align: right;
}

.chat-input {
  position: absolute;
  bottom: 0;
  left: 0;
  right: 0;
  padding: 15px;
  border-top: 1px solid #eee;
  display: flex;
  flex-direction: column;
  background: white;
}

.chat-mode {
  display: flex;
  gap: 10px;
  margin-bottom: 10px;
}

.mode-btn {
  flex: 1;
  padding: 6px 12px;
  background: #f5f5f5;
  color: #666;
  border: 1px solid #ddd;
  border-radius: 4px;
  cursor: pointer;
  transition: all 0.2s;
  font-weight: normal;
  opacity: 0.7;
}

.mode-btn.active {
  background: #42b883;
  color: white;
  border-color: #42b883;
  font-weight: bold;
  opacity: 1;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
}

.mode-btn:hover:not(.active) {
  background: #e8e8e8;
  opacity: 0.9;
}

.input-container {
  display: flex;
  position: relative;
  width: 100%;
}

.input-container input {
  flex: 1;
  padding: 8px 12px;
  padding-right: 40px; /* 为按钮留出空间 */
  border: 1px solid #ddd;
  border-radius: 4px;
  outline: none;
}

.input-container input:focus {
  border-color: #42b883;
}

.send-button {
  position: absolute;
  right: 5px;
  top: 50%;
  transform: translateY(-50%);
  width: 30px;
  height: 30px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: #42b883;
  color: white;
  border: none;
  border-radius: 6px;
  cursor: pointer;
  padding: 0;
  font-size: 12px;
}

.send-button:hover {
  background: #3aa876;
}

.arrow-icon {
  display: inline-block;
  margin-left: 2px; /* 微调箭头位置 */
}

/* Markdown 样式 */
.markdown-content {
  line-height: 1.6;
}

.markdown-content :deep(h1),
.markdown-content :deep(h2),
.markdown-content :deep(h3) {
  margin-top: 0.5em;
  margin-bottom: 0.5em;
  color: #333;
}

.markdown-content :deep(h1) {
  font-size: 1.4em;
}

.markdown-content :deep(h2) {
  font-size: 1.3em;
}

.markdown-content :deep(h3) {
  font-size: 1.1em;
}

.markdown-content :deep(p) {
  margin-bottom: 0.8em;
}

.markdown-content :deep(ul),
.markdown-content :deep(ol) {
  margin: 0.5em 0;
  padding-left: 2em;
}

.markdown-content :deep(li) {
  margin-bottom: 0.3em;
}

.markdown-content :deep(code) {
  background-color: #f5f5f5;
  padding: 0.2em 0.4em;
  border-radius: 3px;
  font-family: monospace;
  font-size: 0.9em;
  color: #d63384;
}

.markdown-content :deep(pre) {
  background-color: #f5f5f5;
  padding: 0.8em;
  border-radius: 5px;
  overflow-x: auto;
  margin: 0.8em 0;
}

.markdown-content :deep(pre code) {
  background-color: transparent;
  padding: 0;
  color: #333;
}

.markdown-content :deep(a) {
  color: #42b883;
  text-decoration: none;
}

.markdown-content :deep(a:hover) {
  text-decoration: underline;
}

.markdown-content :deep(blockquote) {
  border-left: 3px solid #ddd;
  padding-left: 1em;
  margin-left: 0;
  color: #666;
  font-style: italic;
}

.markdown-content :deep(strong) {
  font-weight: bold;
  color: #222;
}

.markdown-content :deep(em) {
  font-style: italic;
}
</style> 