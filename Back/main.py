# TODO Back-end
'''
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
'''
from fastapi import FastAPI
from pydantic import BaseModel


class Record(BaseModel):
    id: int
    comment: str | None = None
    context: str

class RecordsList(BaseModel):
    data: list[Record]

class RecordwithVector(BaseModel):
    id: int
    comment: str | None = None
    context: str
    vector: list[float]

class RecordsListwithVector(BaseModel):
    data: list[RecordwithVector]

app = FastAPI()

import embedding as e

@app.get("/")
async def root():
    return "Hello World!"

@app.post("/embedding/")
async def generate(recordsList: RecordsList):
    recordsList_dict = recordsList.model_dump()
    model = e.Model()

    # 对记录数据生成嵌入
    model.embedding(recordsList_dict["data"])

    # 获取生成的嵌入向量
    vectors = model.get_all_vectors()

    # 确保记录数和向量数匹配
    if len(vectors) != len(recordsList_dict["data"]):
        return {"error": "向量数与记录数不匹配"}

    # 更新 recordsList 中每条 record，添加 vector
    updated_records = []
    for record, vector in zip(recordsList_dict["data"], vectors):
        updated_record = RecordwithVector(
            id=record['id'],
            comment=record.get('comment'),
            context=record['context'],
            vector=vector
        )
        updated_records.append(updated_record)

    # 返回带有向量的记录列表
    return RecordsListwithVector(data=updated_records)
