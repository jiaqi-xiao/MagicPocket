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
import traceback
from fastapi import HTTPException

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
async def group_nodes(nodesList: NodesList):
    """对nodes进行分组"""
    try:
        # 转换输入数据
        root = [node.model_dump() for node in nodesList.data]
        
        # 根据节点类型生成文本描述
        if isinstance(nodesList.data[0], Record):
            nodesTxt = "\n\n".join([
                f"id: {i+1}\n- 选中文本: {node['content']}\n- 上下文: {node['context']}\n- 注释: {node['comment']}"
                for i, node in enumerate(root)
            ])
        else:
            nodesTxt = "\n\n".join([
                f"id: {node['id']}\n- intent: {node['intent']}"
                for node in root
            ])

        # 调用分组模型
        groupsOfNodesIndex = await chain4Grouping.invoke(nodesTxt)
        
        # 转换输出格式
        groupsOfNodes = {
            "item": [
                {group_name: [root[i-1] for i in indices]}
                for group in groupsOfNodesIndex["item"]
                for group_name, indices in group.items()
            ]
        }
        
        return groupsOfNodes

    except Exception as e:
        raise HTTPException(status_code=422, detail=f"Error processing nodes: {str(e)}")


chain4Construct = extractModule.Chain4Construct(model)


@app.post("/construct/")
async def incremental_construct_intent(request: dict):
    """增量构建意图树"""
    try:
        # 验证输入参数
        scenario = request.get("scenario")
        groupsOfNodes = request.get("groupsOfNodes")
        intentTree = request.get("intentTree")
        target_level = request.get("target_level", 1)
        
        if not all([scenario, groupsOfNodes]):
            raise HTTPException(status_code=422, detail="Missing required parameters")
            
        # 标准化分组数据
        standardized_groups = NodeGroups(
            item=[{
                group_name: [
                    Record(**node) for node in nodes
                ]
            } for group in groupsOfNodes["item"]
            for group_name, nodes in group.items()]
        )
        
        # 创建或转换意图树
        initial_tree = IntentTree(
            scenario=scenario,
            child=[Intent(**intent) for intent in intentTree.get("child", [])] if intentTree else []
        )

        # 获取不可变意图列表
        immutableIntents = []
        if intentTree:
            immutableIntents = extractModule.filterNodes(
                initial_tree.model_dump(), 
                target_level,
                key="immutable",
                value=True
            )
        
        # 构建新的意图树
        newIntentTreeIndex = await chain4Construct.invoke(
            scenario,
            standardized_groups.model_dump_json(),
            str(immutableIntents)
        )
        
        # 转换输出格式
        newIntentTree = newIntentTreeIndex["item"]
        for key, indices in newIntentTreeIndex["item"].items():
            for group in standardized_groups.model_dump()["item"]:
                if indices in group.keys():
                    newIntentTree[key] = group[indices]
                    
        return {"item": newIntentTree}

    except Exception as e:
        raise HTTPException(
            status_code=422,
            detail=f"Error constructing intent tree: {str(e)}"
        )


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
