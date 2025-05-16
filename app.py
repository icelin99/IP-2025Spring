from flask import Flask, request, jsonify
from flask_cors import CORS
import sys
import os

# 添加项目根目录到Python路径
current_dir = os.path.dirname(os.path.abspath(__file__))
project_root = os.path.dirname(os.path.dirname(current_dir))
sys.path.append(project_root)

from extract_relation import search_articles_with_cached_embeddings

app = Flask(__name__)

# 配置CORS
CORS(app, resources={
    r"/*": {
        "origins": ["http://localhost:8080"],
        "methods": ["GET", "POST", "OPTIONS"],
        "allow_headers": ["Content-Type", "Accept"],
        "supports_credentials": True
    }
})

@app.route('/', methods=['GET'])
def home():
    print("收到根路径请求")  # 添加调试信息
    return jsonify({
        'status': 'ok',
        'message': 'Flask API 服务正在运行'
    })

@app.route('/api/search', methods=['POST'])
def search():
    print("收到搜索请求")  # 添加调试信息
    try:
        data = request.get_json()
        print(f"请求数据: {data}")  # 添加调试信息
        query = data.get('query')
        if not query:
            return jsonify({'error': '查询内容不能为空'}), 400
            
        # 调用搜索函数
        results = search_articles_with_cached_embeddings(query)
        return jsonify({'results': results})
        
    except Exception as e:
        print(f"搜索出错: {str(e)}")  # 添加错误日志
        return jsonify({'error': str(e)}), 500

if __name__ == '__main__':
    print("API服务启动在 http://localhost:5001")
    print("按 Ctrl+C 停止服务")
    app.run(debug=True, host='0.0.0.0', port=5001)