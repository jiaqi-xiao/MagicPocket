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
from typing import Annotated
from fastapi import FastAPI, Query
from fastapi.middleware.cors import CORSMiddleware
from langchain_openai import ChatOpenAI, OpenAIEmbeddings
import os
from utils import *
import json
import traceback
from fastapi import HTTPException
from pydantic import ValidationError

app = FastAPI()

# openai api key
if "OPENAI_API_KEY" in os.environ:
    os.environ["OPENAI_API_KEY"] = os.getenv("OPENAI_API_KEY", "")
else:
    os.environ["OPENAI_API_KEY"] = ""

modelName = "gpt-4o"
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
async def group_nodes(nodesList: NodesList, scenario: str="learn prompt engineering techniques"):
    """对nodes进行分组"""
    try:
        # 转换输入数据
        root = [node.model_dump() for node in nodesList.data]
        
        # 根据节点类型生成文本描述
        if isinstance(nodesList.data[0], Record):
            nodesTxt = [
                f"id: {i+1}\n- 选中文本: {node['content']}\n- 上下文: {node['context']}\n- 注释: {node['comment']}"
                for i, node in enumerate(root)
            ]
        else:
            nodesTxt = [
                f"id: {node['id']}\n- intent: {node['intent']}"
                for node in root
            ]

        # 调用分组模型
        groupsOfNodesIndex = await chain4Grouping.invoke(nodesTxt, scenario)
        
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
        try:
            standardized_groups = NodeGroups(
                item=[{
                    group_name: [
                        Record(**node) for node in nodes
                    ]
                } for group in groupsOfNodes["item"]
                for group_name, nodes in group.items()]
            )
        except Exception as e:
            print(f"Error: Failed to standardize groups - {str(e)}")
            raise HTTPException(
                status_code=422,
                detail=f"Error in standardizing groups: {str(e)}"
            )
        
        # 创建或转换意图树
        try:
            initial_tree = IntentTree(
                scenario=scenario,
                child=[Intent(**intent) for intent in intentTree.get("child", [])] if intentTree else []
            )
        except Exception as e:
            print(f"Error: Failed to create initial tree - {str(e)}")
            raise HTTPException(
                status_code=422,
                detail=f"Error in creating initial tree: {str(e)}"
            )

        # 获取不可变意图列表
        immutableIntents = []
        if intentTree:
            try:
                immutableIntents = filterNodes(
                    initial_tree.model_dump(), 
                    target_level,
                    key="immutable",
                    value=True
                )
            except Exception as e:
                print(f"Error: Failed to filter immutable intents - {str(e)}")
                raise HTTPException(
                    status_code=422,
                    detail=f"Error in filtering immutable intents: {str(e)}"
                )
        
        # 构建新的意图树
        max_retries = 3
        retry_count = 0
        last_error = None
        last_response = None
        
        while retry_count < max_retries:
            try:
                newIntentTreeIndex = await chain4Construct.invoke(
                    scenario,
                    standardized_groups.model_dump_json(),
                    str(immutableIntents)
                )
                last_response = newIntentTreeIndex  # 保存最后一次响应
                
                # 检查返回的是否是 JSON Schema 定义
                if isinstance(newIntentTreeIndex, dict):
                    if "properties" in newIntentTreeIndex:
                        print(f"Info: Attempt {retry_count + 1}/{max_retries} - Received schema instead of data")
                        retry_count += 1
                        if retry_count >= max_retries:
                            raise ValueError("Maximum retries reached, still receiving schema")
                        continue
                    
                    # 尝试规范化响应格式
                    if "item" not in newIntentTreeIndex:
                        if all(isinstance(key, str) for key in newIntentTreeIndex.keys()):
                            newIntentTreeIndex = {"item": newIntentTreeIndex}
                        else:
                            raise ValueError("Invalid response format (no item)")
                    
                    # 如果成功获取到正确格式的数据，跳出重试循环
                    break
                else:
                    raise ValueError("Response is not a dictionary")
                    
            except Exception as e:
                last_error = e
                retry_count += 1
                if retry_count >= max_retries:
                    if last_response:
                        print(f"Error: LLM raw response after {max_retries} attempts:")
                        print(json.dumps(last_response, indent=2))
                    print(f"Error: All {max_retries} attempts failed")
                    raise HTTPException(
                        status_code=422,
                        detail=f"Error in constructing new intent tree after {max_retries} attempts: {str(last_error)}"
                    )

        # 转换输出格式
        try:
            newIntentTree = newIntentTreeIndex["item"]
            for key, indices in newIntentTreeIndex["item"].items():
                if not isinstance(indices, dict):
                    continue
                    
                if "group" not in indices:
                    newIntentTree[key]["group"] = []
                    continue
                    
                if indices["group"] == "":
                    newIntentTree[key]["group"] = []
                else:
                    for group in standardized_groups.model_dump()["item"]:
                        if indices["group"] in group.keys():
                            newIntentTree[key]["group"] = group[indices["group"]]
                            break
                    else:
                        newIntentTree[key]["group"] = []
                        
        except Exception as e:
            if last_response:
                print(f"Error: LLM raw response:")
                print(json.dumps(last_response, indent=2))
            print(f"Error: Failed to convert output format - {str(e)}")
            raise HTTPException(
                status_code=422,
                detail=f"Error in converting output format: {str(e)}"
            )
                    
        return {"item": newIntentTree}

    except Exception as e:
        print(f"Error: Unexpected error in construct API - {str(e)}")
        raise HTTPException(
            status_code=422,
            detail=f"Error constructing intent tree: {str(e)}"
        )

model4Embed = OpenAIEmbeddings(model="text-embedding-ada-002")
embedModel = embedModule.EmbedGPTModel(model4Embed)
import RAGModule
model4RAG = RAGModule.Chain4RAG(model)
model4Split = RAGModule.Chain4Split(model)
@app.post("/rag/")
async def retrieve_top_k_relevant_sentence_based_on_intent(request_dict: dict):
    """
    从 intentTree 和 webContent 中筛选出每个 intent 对应的 top-k 和 bottom-k 相关句子。

    :param intentTree: 意图树，包含嵌套的意图结构。
    :param webContent: Web 内容，字符串形式。
    :param k: 每个意图返回的最相关句子数。
    :param top_threshold: top-k 相似度阈值，只有相似度高于该值的句子才会被纳入 top-k。
    :param bottom_threshold: bottom-k 筛选的相似度阈值，低于该值的句子才会被考虑。
    :return: 每个意图对应的 top-k 和 bottom-k 最相关句子的结果。
    """
    try:
        chunk_num=3
        # 先验证并转换请求数据为RAGRequest对象
        try:
            ragRequest = RAGRequest(**request_dict)
        except ValidationError as e:
            raise HTTPException(
                status_code=422,
                detail=f"Invalid request format: {str(e)}"
            )

        # 以下是原有逻辑
        intentTree = ragRequest.intentTree
        webContent = ragRequest.webContent
        k = ragRequest.k
        top_threshold = ragRequest.top_threshold
        bottom_threshold = ragRequest.bottom_threshold
        scenario = ragRequest.scenario

        intentTree = IntentTree(
                scenario = scenario,
                child=[Intent(**intent) for intent in intentTree.get("child", [])] if intentTree else []
            ).model_dump()
        
        # Step 1: 将 webContent 分句
        # sentences = await model4Split.invoke(scenario, webContent)
        # sentences = [sentence for sentence in sentences["data"] if len(sentence.split(" "))  > 3]
        sentences = split2Sentences(webContent)
        print("该网页句子数量：", len(sentences))

        contentChunks = np.array_split(sentences, chunk_num)

        result = []

        for chunk in contentChunks:
            # Step 2: 向量化 webContent 的句子
            sentences_embeddings = await embedModel.embeddingList(chunk)

            # Step 3: 筛选意图并向量化它们
            intentsDict = filterNodes(
                intentTree,  # 转换 IntentTree 为字典
                target_level=1
            )

            # combinedIntents_embeddings = await embedModel.embeddingList(combinedIntents)

            # Step 4: 计算每个意图的 top-k 相关句子
            intent_to_top_k_sentences = {}
            intent_to_bottom_k_sentences = {}

            print("call LLM")
            
            # 调用LLM
            response = await model4RAG.invoke(
                    scenario,
                    intentsDict=intentsDict,
                    sentenceList=chunk,
                    top_threshold=top_threshold,
                )
            # 重构响应，替换索引
            print("response", response)
            intent_to_top_k_sentences = {}
            for item in response["data"]:
                intent = item["intent"]
                intent_to_top_k_sentences[intent] = [chunk[i] for i in item["topKIndices"]]

                intent_records = get_intent_records(intentTree, intent)  # 获取当前意图的记录

                # 如果intent没有records，直接返回top-k
                if len(intent_records) == 0:
                    intent_to_bottom_k_sentences[intent] = intent_to_top_k_sentences[intent][:k]
                    intent_to_top_k_sentences[intent]= []
                else:
                    intent_records_embeddings = await embedModel.embeddingList(intent_records)
                    # 对超过top_threshold的每个句子计算与每个 record 的最小相似度
                    record_max_similarities = []
                    top_sentences_embeddings = [sentences_embeddings[i] for i in item["topKIndices"]]
                    if top_sentences_embeddings:
                        for sentence_e in top_sentences_embeddings:
                            max_sim = max(
                                cosine_similarity(record_e, sentence_e)
                                for record_e in intent_records_embeddings
                            )
                            record_max_similarities.append(max_sim)

                        # 筛选低于 bottom_k_threshold 的句子及其索引
                        bottom_filtered_indices = [
                            i for i, sim in enumerate(record_max_similarities) if sim <= bottom_threshold
                        ]
                        bottom_filtered_similarities = [
                            (i, record_max_similarities[i]) for i in bottom_filtered_indices
                        ]
                        bottom_k_indices = sorted(bottom_filtered_similarities, key=lambda x: x[1])[:k]
                        bottom_k_sentences = [chunk[i[0]] for i in bottom_k_indices]

                        intent_to_bottom_k_sentences[intent] = bottom_k_sentences
                    else:
                        intent_to_bottom_k_sentences[intent] = []
            result.append({
                "top_k": intent_to_top_k_sentences,
                "bottom_k": intent_to_bottom_k_sentences
            })
                        
        # Step 6: 返回每个意图的 top-k 和 bottom-k 最相关句子
        return merge_dicts(result)
        # for combinedIntent, conbinedIntent_e in zip(combinedIntents, combinedIntents_embeddings):
        #     [intent, description] = combinedIntent.split("-")
        #     # 计算意图向量和所有句子向量之间的余弦相似度
        #     similarities = [
        #         cosine_similarity(conbinedIntent_e, sentence_e)
        #         for sentence_e in sentences_embeddings
        #     ]
        #     # 筛选相似度高于阈值的句子及其索引
        #     filtered_indices = [
        #         i for i, sim in enumerate(similarities) if sim >= top_threshold
        #     ]
        #     filtered_sentences = [sentences[i] for i in filtered_indices]

        #     # # Step 5: 计算意图的记录向量（如果有记录）与句子相似度
        #     intent_records = get_intent_records(intentTree, intent)  # 获取当前意图的记录
        #     print("records num: ", len(intent_records))

            # indicesDict = await model4RAG.invoke(
            #     scenario,
            #     intent=intent,
            #     description=description,
            #     recordList=intent_records,
            #     sentenceList=filtered_sentences,
            #     k=k,
            # )
            # top_k_indices = indicesDict["top_k"]
            # bottom_k_indices = indicesDict["bottom_k"]

            # top_k_sentences = [filtered_sentences[i] for i in top_k_indices]
            # bottom_k_sentences = [filtered_sentences[i] for i in bottom_k_indices]
            # print("top-k", top_k_sentences)
            # print("bottom-k",bottom_k_sentences)

            # # 保存结果
            # intent_to_top_k_sentences[intent]= top_k_sentences
            # intent_to_bottom_k_sentences[intent] = bottom_k_sentences

            #### 原逻辑
        
            # # 从筛选结果中选取 top-k
            # filtered_similarities = [(i, similarities[i]) for i in filtered_indices]
            # top_k_indices = sorted(filtered_similarities, key=lambda x: x[1], reverse=True)[:k]
            # top_k_sentences = [sentences[i[0]] for i in top_k_indices]

            # print(f"意图：{intent}\ntop-k预览：{top_k_indices}")
            # print(top_k_sentences)

            # # Step 5: 计算意图的记录向量（如果有记录）与句子相似度
            # intent_records = get_intent_records(intentTree, intent)  # 获取当前意图的记录
            # print("records num: ", len(intent_records))

            # # 如果intent没有records，直接返回top-k
            # if len(intent_records) == 0:
            #     intent_to_top_k_sentences[intent]= []
            #     intent_to_bottom_k_sentences[intent] = top_k_sentences
            # else:
            #     intent_records_embeddings = await embedModel.embeddingList(intent_records)
            #     # 对超过top_threshold的每个句子计算与每个 record 的最小相似度
            #     record_max_similarities = []
            #     for sentence_e in filtered_sentences_embeddings:
            #         max_sim = max(
            #             cosine_similarity(record_e, sentence_e)
            #             for record_e in intent_records_embeddings
            #         )
            #         record_max_similarities.append(max_sim)
            #     print("min record sim: ", min(record_max_similarities))
            #     # 筛选低于 bottom_k_threshold 的句子及其索引
            #     bottom_filtered_indices = [
            #         i for i, sim in enumerate(record_max_similarities) if sim <= bottom_threshold
            #     ]
            #     bottom_filtered_similarities = [
            #         (i, record_max_similarities[i]) for i in bottom_filtered_indices
            #     ]
            #     bottom_k_indices = sorted(bottom_filtered_similarities, key=lambda x: x[1])[:k]
            #     bottom_k_sentences = [filtered_sentences[i[0]] for i in bottom_k_indices]

            #     print("bottom-k预览：",bottom_filtered_indices)
            #     print(bottom_k_sentences)

            #   # 保存结果
            #    intent_to_top_k_sentences[intent]= top_k_sentences
            #    intent_to_bottom_k_sentences[intent] = bottom_k_sentences
    
    except Exception as e:
        raise HTTPException(
            status_code=422,
            detail=f"Error RAG: {str(e)}"
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
