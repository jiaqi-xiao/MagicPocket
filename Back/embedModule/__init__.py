from langchain_community.vectorstores import FAISS
from langchain.schema import Document
from langchain_huggingface import HuggingFaceEmbeddings
import numpy as np
from typing import Literal, Optional

class EmbedModel:
    def __init__(self):
        self.index = None
        # 创建 Hugging Face 嵌入模型实例
        self.embeddingsModel = HuggingFaceEmbeddings(
            model_name="sentence-transformers/all-MiniLM-L6-v2"
        )

    def embedding(self, content: dict, keyList: list, vector_operation_mode: Optional[Literal["add", "minus"]] = None):

        if len(keyList) == 1:
            if not content[keyList[0]]:
                 raise ValueError(f"Invalid key value - {key}.")
            return np.array(self.embeddingsModel.embed_query(content[keyList[0]])).tolist()
        
        v_list = []
        for key in keyList:
            if content[key]:
                content_v = np.array(self.embeddingsModel.embed_query(content[key]))
            v_list.append(content_v)
        return self.vector_operation(v_list, vector_operation_mode)
    
    def vector_operation(self, v_list, vector_operation_mode: Literal["add", "minus"]):
        return np.sum(v_list, axis=0).tolist() if vector_operation_mode == "add" else (v_list[0] - np.sum(v_list[1:], axis=0)).tolist()

    def embeddingList(self, sentences: list):
        return self.embeddingsModel.embed_documents(sentences)

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

class EmbedGPTModel:
    def __init__(self, model) -> None:
        self.model = model
    
    async def embeddingList(self, documents: list) -> list:
        return self.model.embed_documents(documents)

if __name__ == "__main__":
    intent = {"intent": "想去拍照"}

    model = EmbedModel()
    vector = model.embedding(intent, ['intent'])

    print(vector)
