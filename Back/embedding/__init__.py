from langchain_community.vectorstores import FAISS
from langchain.schema import Document
from langchain_huggingface import HuggingFaceEmbeddings


class Model:
    def __init__(self):
        self.index = None
        # 创建 Hugging Face 嵌入模型实例
        self.embeddings = HuggingFaceEmbeddings(
            model_name="sentence-transformers/all-MiniLM-L6-v2"
        )

    def embedding(self, recordsList: list):

        # 将文本转换为 Document 对象
        documents = [Document(page_content=record["context"]) for record in recordsList]

        # 使用 FAISS 存储嵌入向量，使用 from_documents 方法
        self.index = FAISS.from_documents(documents, self.embeddings)

    # 获取索引中所有嵌入的向量
    def get_all_vectors(self):
        n_vectors = self.index.index.ntotal  # 获取索引中向量的总数
        vectors = self.index.index.reconstruct_n(0, n_vectors)  # 获取所有嵌入向量
        return vectors

    def RAG(self, query: str, k: int = 3):
        # 定义查询文本

        # 执行相似性搜索，返回最相似的前 k 个结果
        results = self.index.similarity_search(query, k=k)

        # 输出结果
        for result in results:
            print("相似文本：", result.page_content)

        return results


if __name__ == "__main__":
    # 定义文本列表
    recordsList = {
        "data": [
            {"id": 0, "comment": "string", "context": "string"},
            {"id": 1, "comment": "string1", "context": "string1"},
        ]
    }

    model = Model()
    model.embedding(recordsList["data"])
    vectors = model.get_all_vectors()

    print(vectors)
