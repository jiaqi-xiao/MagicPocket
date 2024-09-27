# TODO Back-end
"""
数据结构

每条record
{
    id: 1,
    comment: XXXXX,
    context: XXXXXXXXXXXX.
    vector: [[]],
}

层次聚类的树结构
{
    id: 1,
    child: [
        {
            id: 2,
            child: [...],
        },
        {
            id: 3,
            child: [...]
        }
    ]
}
"""
from fastapi import FastAPI
from pydantic import BaseModel

app = FastAPI()


@app.get("/")
async def root():
    return "Hello World!"


import embedding as e

# 初始化大模型
model = e.Model()

class Record(BaseModel):
    id: int
    comment: str | None = None
    context: str


class RecordwithVector(BaseModel):
    id: int
    comment: str | None = None
    context: str
    vector: list[float]


@app.post("/embedding/")
async def embedding_single_record(record: Record):
    # 对记录数据生成嵌入，并获取生成的嵌入向量
    vector = model.embedding(record)

    # 返回带有向量的记录列表
    return RecordwithVector(
        id=record.id,
        comment=record.comment,
        context=record.context,
        vector=vector,
    )

import cluster

class RecordsListWithVector(BaseModel):
    data: list[RecordwithVector]

@app.post("/cluster/")
async def hierarcy_cluster(recordsList: RecordsListWithVector):
    cluster_tree = cluster.hierarcy_clustering(recordsList.data)
    return cluster_tree