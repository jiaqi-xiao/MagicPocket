# TODO Back-end
"""
数据结构

每条record
{
    id: 1,
    comment: XXXXX,
    content: XXXXX,
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
from fastapi import FastAPI, Query
from pydantic import BaseModel, field_validator
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


import embedModule

# 初始化嵌入模型
model = embedModule.EmbedModel()


class Record(BaseModel):
    id: int
    comment: str | None = None
    content: str
    context: str


class RecordwithVector(BaseModel):
    id: int
    comment: str | None = None
    content: str
    context: str
    vector: list[float]


@app.post("/embed_single/", response_model=RecordwithVector)
async def embed_single_record(record: Record):
    # 对记录数据生成嵌入，并获取生成的嵌入向量
    vector = model.embedding(
        record.model_dump(),
        ["context", "content", "comment"],
        vector_operation_mode="add",
    )

    # 返回带有向量的记录列表
    return RecordwithVector(
        id=record.id,
        comment=record.comment,
        content=record.content,
        context=record.context,
        vector=vector,
    )


class RecordsList(BaseModel):
    data: list[Record]


class RecordsListWithVector(BaseModel):
    data: list[RecordwithVector]

    # @field_validator("data")
    # def validate__length(cls, data):
    #     min_length = 2
    #     if len(data) < min_length:
    #         raise ValueError(f"Record list should be more than {min_length} elements")
    #     return data


@app.post("/embed_all/", response_model=RecordsListWithVector)
async def embed_all_records(recordsList: RecordsList):
    recordsListWithVector = RecordsListWithVector(data=[])
    for record in recordsList.data:
        # 对记录数据生成嵌入，并获取生成的嵌入向量
        vector = model.embedding(
            record.model_dump(),
            ["context", "content", "comment"],
            vector_operation_mode="add",
        )
        recordWithVector = RecordwithVector(
            id=record.id,
            comment=record.comment,
            context=record.context,
            content=record.content,
            vector=vector,
        )
        recordsListWithVector.data.append(recordWithVector)

    # 返回带有向量的记录列表
    return recordsListWithVector


import clusterGenerator
import extractModule

extractModelCluster = extractModule.ExtractModelCluster()

@app.post("/cluster/")
async def hierarcy_cluster(
    recordsList: RecordsListWithVector,
    distance_threshold: float = 0.5,
    level: int | None = Query(ge=1),
    intent_num: int | None = Query(ge=1),
):
    root = [record.model_dump() for record in recordsList.data]
    count = len(root)

    newRoot = []
    if count < 2:
        recordsCluster = "**记录1**\n- 选中文本: {}\n- 上下文: {}\n- 注释: {}".format(
            root[0]["content"], root[0]["context"], root[0]["comment"]
        )
        intent = await extractModelCluster.invoke(recordsCluster)
        return [
            {
                "id": 0,
                "intent": intent,
                "priority": 5,
                "child_num": len(c),
                "child": [
                    {key: root[index][key] for key in root[index] if key != "vector"}
                    for index in c
                ],
            }
        ]
    hc_tree = clusterGenerator.hierarcy_clustering(root, distance_threshold)
    for key, c in hc_tree.items():
        recordsCluster = "\n\n".join(
            [
                "**记录{}**\n- 选中文本: {}\n- 上下文: {}\n- 注释: {}".format(
                    index + 1,
                    root[index]["comment"],
                    root[index]["content"],
                    root[index]["context"],
                )
                for index in c
            ]
        )
        intent = await extractModelCluster.invoke(recordsCluster)
        intent_v = model.embedding({"intent": intent}, ["intent"])
        newRoot.append(
            {
                "id": count + int(key),
                "intent": intent,
                "vector": intent_v,
                "priority": 5,
                "child_num": len(c),
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
        if len(root) <= intent_num:
            return root
        newRoot = []
        hc_tree = clusterGenerator.hierarcy_clustering(root, distance_threshold)
        for key, c in hc_tree.items():
            if len(c) == 1:
                newRoot.append(root[c[0]])
            else:
                intentsCluster = "- 意图: {}".format(
                    [root[index]["intent"] for index in c]
                )
                intent = await extractModelCluster.invoke(intentsCluster)
                intent_v = model.embedding({"intent": intent}, ["intent"])
                newRoot.append(
                    {
                        "id": count + int(key),
                        "intent": intent,
                        "vector": intent_v,
                        "priority": 5,
                        "child_num": len(c),
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

    return [{key: node[key] for key in node if key != "vector"} for node in root]

extractModelDirect = extractModule.ExtractModelDirect()

@app.post("/extract_direct/")
async def direct_extract_intent(
    recordsList: RecordsList,
):
    root = [record.model_dump() for record in recordsList.data]

    recordsCluster = "\n\n".join(
            [
                "**记录{}**\n- 选中文本: {}\n- 上下文: {}\n- 注释: {}".format(
                    index + 1,
                    root[index]["content"],
                    root[index]["content"],
                    root[index]["comment"],
                )
                for index in range(len(root))
            ]
        )
    
    return await extractModelDirect.invoke(recordsCluster)