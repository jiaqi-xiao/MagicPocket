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
    intent: str,
    priority: int,
    child: [
        {
            id: 2,
            intent: str,
            priority: int,
            child: [
                id: 1,
                comment: XXXXX,
                context: XXXXXXXXXXXX,
                vector: [[]],
            ],
        },
        {
            id: 3,
            intent: str,
            priority: int,
            child: [...]
        }
    ]
}
"""
from fastapi import FastAPI
from pydantic import BaseModel
from fastapi.middleware.cors import CORSMiddleware

app = FastAPI()

# Add CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/")
async def root():
    return "Hello World!"


import embedModule as e

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


@app.post("/embed_single/", response_model=RecordwithVector)
async def embed_single_record(record: Record):
    # 对记录数据生成嵌入，并获取生成的嵌入向量
    vector = model.embedding(
        record.model_dump(), ["context", "comment"], vector_operation_mode="add"
    )

    # 返回带有向量的记录列表
    return RecordwithVector(
        id=record.id,
        comment=record.comment,
        context=record.context,
        vector=vector,
    )


class RecordsList(BaseModel):
    data: list[Record]


class RecordsListWithVector(BaseModel):
    data: list[RecordwithVector]


@app.post("/embed_all/", response_model=RecordsListWithVector)
async def embed_all_records(recordsList: RecordsList):
    recordsListWithVector = RecordsListWithVector(data=[])
    for record in recordsList.data:
        # 对记录数据生成嵌入，并获取生成的嵌入向量
        vector = model.embedding(
            record.model_dump(), ["context", "comment"], vector_operation_mode="add"
        )
        recordWithVector = RecordwithVector(
            id=record.id,
            comment=record.comment,
            context=record.context,
            vector=vector,
        )
        recordsListWithVector.data.append(recordWithVector)

    # 返回带有向量的记录列表
    return recordsListWithVector


import clusterGenerator
import extractModlue


@app.post("/cluster/")
async def hierarcy_cluster(
    recordsList: RecordsListWithVector,
    distance_threshold: float,
    level: int | None = 3,
    intent_num: int | None = 2,
):
    root = [record.model_dump() for record in recordsList.data]
    count = len(root)

    newRoot = []
    hc_tree = clusterGenerator.hierarcy_clustering(root, distance_threshold)
    for key, c in hc_tree.items():
        recordsCluster = [
            "Comment: {}, Context: {}".format(
                root[index]["comment"], root[index]["context"]
            )
            for index in c
        ]
        intent = extractModlue.invoke(recordsCluster)
        intent_v = model.embedding({"intent": intent}, ["intent"])
        newRoot.append(
            {
                "id": count + int(key),
                "intent": intent,
                "vector": intent_v,
                "child": [
                    {key: root[index][key] for key in root[index] if key != "vector"}
                    for index in c
                ],
            }
        )
    root = [*newRoot]
    count += len(root)

    i = 0
    while i < level:
        i += 1
        if len(root) == intent_num:
            return root
        newRoot = []
        hc_tree = clusterGenerator.hierarcy_clustering(root, distance_threshold)
        for key, c in hc_tree.items():
            intentsCluster = ["Intent: {}".format(root[index]["intent"]) for index in c]
            intent = extractModlue.invoke(intentsCluster)
            intent_v = model.embedding({"intent": intent}, ["intent"])
            newRoot.append(
                {
                    "id": count + int(key),
                    "intent": intent,
                    "vector": intent_v,
                    "child": [
                        {
                            key: root[index][key]
                            for key in root[index]
                            if key != "vector"
                        }
                        for index in c
                    ],
                }
            )
        root = [*newRoot]
        count += len(root)

    return root
