from langchain_community.vectorstores import FAISS
from langchain.schema import Document
from langchain_huggingface import HuggingFaceEmbeddings
import numpy as np


class Model:
    def __init__(self):
        self.index = None
        # 创建 Hugging Face 嵌入模型实例
        self.embeddingsModel = HuggingFaceEmbeddings(
            model_name="sentence-transformers/all-MiniLM-L6-v2"
        )

    def embedding(self, record):

        context_v = np.array(self.embeddingsModel.embed_query(record.context))
        if record.comment:
            comment_v = np.array(self.embeddingsModel.embed_query(record.comment))
        return (
            self.vector_operation(context_v, comment_v)
            if record.comment
            else context_v
        )

    def vector_operation(self, context_v, comment_v):
        return (context_v + comment_v).tolist()

    # # 获取索引中所有嵌入的向量
    # def get_all_vectors(self):
    #     n_vectors = self.index.index.ntotal  # 获取索引中向量的总数
    #     vectors = self.index.index.reconstruct_n(0, n_vectors)  # 获取所有嵌入向量
    #     return vectors

    # def RAG(self, query: str, k: int = 3):
    #     # 定义查询文本

    #     # 执行相似性搜索，返回最相似的前 k 个结果
    #     results = self.index.similarity_search(query, k=k)

    #     # 输出结果
    #     for result in results:
    #         print("相似文本：", result.page_content)

    #     return results


if __name__ == "__main__":
    record = {"id": 0, "comment": "", "context": "string"}

    model = Model()
    vector = model.embedding(record)

    print(vector)
