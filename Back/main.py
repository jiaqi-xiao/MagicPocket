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
from fastapi.middleware.cors import CORSMiddleware
from langchain_openai import ChatOpenAI
import os
from utils import *
import json

app = FastAPI()

# openai api key
if "OPENAI_API_KEY" in os.environ:
    os.environ["OPENAI_API_KEY"] = os.getenv("OPENAI_API_KEY", "")
else:
    os.environ["OPENAI_API_KEY"] = ""

modelName = "gpt-4o-mini"
model = ChatOpenAI(model=modelName)

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
embedModel = embedModule.EmbedModel()


@app.post("/embed_single/", response_model=RecordwithVector)
async def embed_single_record(record: Record):
    # 对记录数据生成嵌入，并获取生成的嵌入向量
    vector = embedModel.embedding(
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


@app.post("/embed_all/", response_model=RecordsListWithVector)
async def embed_all_records(recordsList: NodesList):
    recordsListWithVector = RecordsListWithVector(data=[])
    for record in recordsList.data:
        # 对记录数据生成嵌入，并获取生成的嵌入向量
        vector = embedModel.embedding(
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

extractModelCluster = extractModule.ExtractModelCluster(model)


@app.post("/extract/cluster/")
async def hierarcy_cluster(
    recordsList: RecordsListWithVector,
    distance_threshold: float = 0.5,
    level: int = Query(ge=1),
    intent_num: int = Query(ge=1),
):
    root = [record.model_dump() for record in recordsList.data]
    count = len(root)

    newRoot = []
    if count < 2:
        recordsCluster = "[**记录1**\n- 选中文本: {}\n- 上下文: {}\n- 注释: {}]".format(
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
        recordsCluster = [
            "**记录{}**\n- 选中文本: {}\n- 上下文: {}\n- 注释: {}".format(
                index + 1,
                root[index]["comment"],
                root[index]["content"],
                root[index]["context"],
            )
            for index in c
        ]
        intent = await extractModelCluster.invoke(recordsCluster)
        intent_v = model.embedding(intent, ["intent"])
        newRoot.append(
            {
                "id": count + int(key),
                "intent": intent["intent"],
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
            return [
                {key: node[key] for key in node if key != "vector"} for node in root
            ]
        newRoot = []
        hc_tree = clusterGenerator.hierarcy_clustering(root, distance_threshold)
        for key, c in hc_tree.items():
            if len(c) == 1:
                newRoot.append(root[c[0]])
            else:
                intentsCluster = [root[index]["intent"] for index in c]
                intent = await extractModelCluster.invoke(intentsCluster)
                intent_v = model.embedding(intent, ["intent"])
                newRoot.append(
                    {
                        "id": count + int(key),
                        "intent": intent["intent"],
                        "vector": intent_v,
                        "priority": 1,
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


extractModelDirect = extractModule.ExtractModelDirect(model)


@app.post("/extract/direct/")
async def direct_extract_intent(
    scenario: str,
    recordsList: NodesList,
):
    root = [record.model_dump() for record in recordsList.data]

    if isinstance(recordsList.data[0], Record):
        recordsCluster = "\n\n".join(
            [
                "id: {}\n- 选中文本: {}\n- 上下文: {}\n- 注释: {}".format(
                    index + 1,
                    root[index]["content"],
                    root[index]["context"],
                    root[index]["comment"],
                )
                for index in range(len(root))
            ]
        )
    else:
        recordsCluster = "\n\n".join(
            [
                "id: {}\n- intent: {}".format(root[index]["id"], root[index]["text"])
                for index in range(len(root))
            ]
        )
    output = await extractModelDirect.invoke(scenario, recordsCluster)
    return output


chain4Grouping = extractModule.Chain4Grouping(model)


@app.post("/group/")
async def group_nodes(
    nodesList: NodesList,
):
    ### 对nodes分组

    root = [node.model_dump() for node in nodesList.data]

    if isinstance(nodesList.data[0], Record):
        nodesTxt = "\n\n".join(
            [
                "id: {}\n- 选中文本: {}\n- 上下文: {}\n- 注释: {}".format(
                    index + 1,
                    root[index]["content"],
                    root[index]["context"],
                    root[index]["comment"],
                )
                for index in range(len(root))
            ]
        )
    else:
        nodesTxt = "\n\n".join(
            [
                "id: {}\n- intent: {}".format(root[index]["id"], root[index]["intent"])
                for index in range(len(root))
            ]
        )
    groupsOfNodesIndex = await chain4Grouping.invoke(nodesTxt)

    groupsOfNodes = []
    for group in groupsOfNodesIndex["item"]:
        for group_name, indices in group.items():
            # 根据索引获取对应的节点
            nodes = [root[i - 1] for i in indices]
            # 构造输出的分组
            groupsOfNodes.append({group_name: nodes})
    return {"item": groupsOfNodes}


chain4Construct = extractModule.Chain4Construct(model)


@app.post("/construct/")
async def incremental_construct_intent(
    scenario: str,
    groupsOfNodes: NodeGroups,
    intentTree: IntentTree,
    target_level: int = Query(ge=1),
):
    # 筛选出immutable的Node
    immutableIntentsList = extractModule.filterNodes(
        intentTree.model_dump(), target_level, key="immutable", value=True
    )

    # # 映射group到intent，对多余的组提取新意图
    newIntentTreeIndex = await chain4Construct.invoke(
        scenario, groupsOfNodes.model_dump_json(), str(immutableIntentsList)
    )
    newIntentTree = newIntentTreeIndex["item"]
    for key, indices in newIntentTreeIndex["item"].items():
        # 根据索引替换为对应的值
        for group in groupsOfNodes.model_dump()["item"]:
            if indices in group.keys():
                newIntentTree[key] = group[indices]
    return {"item": newIntentTree}


@app.post("/cluster/")
# async def direct_extract_intent(
#     recordsList: RecordsListWithVector,
#     distance_threshold: float = 0.5,
#     level: int = Query(ge=1),
#     intent_num: int = Query(ge=1),
# ):
#     root = [record.model_dump() for record in recordsList.data]

#     recordsCluster = "\n\n".join(
#             [
#                 "**记录{}**\n- 选中文本: {}\n- 上下文: {}\n- 注释: {}".format(
#                     index + 1,
#                     root[index]["content"],
#                     root[index]["content"],
#                     root[index]["comment"],
#                 )
#                 for index in range(len(root))
#             ]
#         )
#     groupedIntents = await extractModelDirect.invoke(recordsCluster)
#     return groupedIntents["groupedIntents"]


async def hierarcy_cluster(
    recordsList: RecordsListWithVector,
    distance_threshold: float = 0.5,
    level: int = Query(ge=1),
    intent_num: int = Query(ge=1),
):
    root = [record.model_dump() for record in recordsList.data]
    count = len(root)

    newRoot = []
    if count < 2:
        recordsCluster = "[**记录1**\n- 选中文本: {}\n- 上下文: {}\n- 注释: {}]".format(
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
        recordsCluster = [
            "**记录{}**\n- 选中文本: {}\n- 上下文: {}\n- 注释: {}".format(
                index + 1,
                root[index]["comment"],
                root[index]["content"],
                root[index]["context"],
            )
            for index in c
        ]
        intent = await extractModelCluster.invoke(recordsCluster)
        intent_v = model.embedding(intent, ["intent"])
        newRoot.append(
            {
                "id": count + int(key),
                "intent": intent["intent"],
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
            return [
                {key: node[key] for key in node if key != "vector"} for node in root
            ]
        newRoot = []
        hc_tree = clusterGenerator.hierarcy_clustering(root, distance_threshold)
        for key, c in hc_tree.items():
            if len(c) == 1:
                newRoot.append(root[c[0]])
            else:
                intentsCluster = [root[index]["intent"] for index in c]
                intent = await extractModelCluster.invoke(intentsCluster)
                intent_v = model.embedding(intent, ["intent"])
                newRoot.append(
                    {
                        "id": count + int(key),
                        "intent": intent["intent"],
                        "vector": intent_v,
                        "priority": 1,
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
