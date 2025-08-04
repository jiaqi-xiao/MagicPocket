# TODO Back-end
"""
数据结构

每条record
{
    id: 1,
    comment: XXXXX,
    content: XXXXX,
    context: XXXXXXXXXXXX.
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
import time
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

from dotenv import load_dotenv
load_dotenv()
import logging

# 设置 logger
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s",
    handlers=[
        logging.FileHandler("app.log"),  # 输出到文件
        logging.StreamHandler()          # 同时输出到控制台
    ]
)
logger = logging.getLogger(__name__)

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
# embedModel = embedModule.EmbedModel()

# @app.post("/embed_single/", response_model=RecordwithVector)
# async def embed_single_record(record: Record):
#     # 对记录数据生成嵌入，并获取生成的嵌入向量
#     vector = embedModel.embedding(
#         record.model_dump(),
#         ["context", "content", "comment"],
#         vector_operation_mode="add",
#     )

#     # 返回带有向量的记录列表
#     return RecordwithVector(
#         id=record.id,
#         comment=record.comment,
#         content=record.content,
#         context=record.context,
#         vector=vector,
#     )

# @app.post("/embed_all/", response_model=RecordsListWithVector)
# async def embed_all_records(recordsList: NodesList):
#     recordsListWithVector = RecordsListWithVector(data=[])
#     for record in recordsList.data:
#         # 对记录数据生成嵌入，并获取生成的嵌入向量
#         vector = embedModel.embedding(
#             record.model_dump(),
#             ["context", "content", "comment"],
#             vector_operation_mode="add",
#         )
#         recordWithVector = RecordwithVector(
#             id=record.id,
#             comment=record.comment,
#             context=record.context,
#             content=record.content,
#             vector=vector,
#         )
#         recordsListWithVector.data.append(recordWithVector)

#     # 返回带有向量的记录列表
#     return recordsListWithVector


# import clusterGenerator
import extractModule

# extractModelCluster = extractModule.ExtractModelCluster(model)

# @app.post("/extract/cluster/")
# async def hierarcy_cluster(
#     recordsList: RecordsListWithVector,
#     distance_threshold: float = 0.5,
#     level: int = Query(ge=1),
#     intent_num: int = Query(ge=1),
# ):
#     root = [record.model_dump() for record in recordsList.data]
#     count = len(root)

#     newRoot = []
#     if count < 2:
#         recordsCluster = "[**记录1**\n- 选中文本: {}\n- 上下文: {}\n- 注释: {}]".format(
#             root[0]["content"], root[0]["context"], root[0]["comment"]
#         )
#         intent = await extractModelCluster.invoke(recordsCluster)
#         return [
#             {
#                 "id": 0,
#                 "intent": intent,
#                 "priority": 5,
#                 "child_num": len(c),
#                 "child": [
#                     {key: root[index][key] for key in root[index] if key != "vector"}
#                     for index in c
#                 ],
#             }
#         ]
#     hc_tree = clusterGenerator.hierarcy_clustering(root, distance_threshold)
#     for key, c in hc_tree.items():
#         recordsCluster = [
#             "**记录{}**\n- 选中文本: {}\n- 上下文: {}\n- 注释: {}".format(
#                 index + 1,
#                 root[index]["comment"],
#                 root[index]["content"],
#                 root[index]["context"],
#             )
#             for index in c
#         ]
#         intent = await extractModelCluster.invoke(recordsCluster)
#         intent_v = model.embedding(intent, ["intent"])
#         newRoot.append(
#             {
#                 "id": count + int(key),
#                 "intent": intent["intent"],
#                 "vector": intent_v,
#                 "priority": 5,
#                 "child_num": len(c),
#                 "child": [
#                     {key: root[index][key] for key in root[index] if key != "vector"}
#                     for index in c
#                 ],
#             }
#         )
#     root = [*newRoot]
#     count += len(root)

#     i = 0
#     while i < level:
#         i += 1
#         if len(root) <= intent_num:
#             return [
#                 {key: node[key] for key in node if key != "vector"} for node in root
#             ]
#         newRoot = []
#         hc_tree = clusterGenerator.hierarcy_clustering(root, distance_threshold)
#         for key, c in hc_tree.items():
#             if len(c) == 1:
#                 newRoot.append(root[c[0]])
#             else:
#                 intentsCluster = [root[index]["intent"] for index in c]
#                 intent = await extractModelCluster.invoke(intentsCluster)
#                 intent_v = model.embedding(intent, ["intent"])
#                 newRoot.append(
#                     {
#                         "id": count + int(key),
#                         "intent": intent["intent"],
#                         "vector": intent_v,
#                         "priority": 1,
#                         "child_num": len(c),
#                         "child": [
#                             {
#                                 key: root[index][key]
#                                 for key in root[index]
#                                 if key != "vector"
#                             }
#                             for index in c
#                         ],
#                     }
#                 )
#         root = [*newRoot]
#         count += len(root)

#     return [{key: node[key] for key in node if key != "vector"} for node in root]


# extractModelDirect = extractModule.ExtractModelDirect(model)

# @app.post("/extract/direct/")
# async def direct_extract_intent(
#     scenario: str,
#     recordsList: NodesList,
# ):
#     root = [record.model_dump() for record in recordsList.data]

#     if isinstance(recordsList.data[0], Record):
#         recordsCluster = "\n\n".join(
#             [
#                 "id: {}\n- 选中文本: {}\n- 上下文: {}\n- 注释: {}".format(
#                     index + 1,
#                     root[index]["content"],
#                     root[index]["context"],
#                     root[index]["comment"],
#                 )
#                 for index in range(len(root))
#             ]
#         )
#     else:
#         recordsCluster = "\n\n".join(
#             [
#                 "id: {}\n- intent: {}".format(root[index]["id"], root[index]["text"])
#                 for index in range(len(root))
#             ]
#         )
#     output = await extractModelDirect.invoke(scenario, recordsCluster)
#     return output

chain4Granularity = extractModule.Chain4InferringGranularity(model)

@app.post("/granularity/")
async def infer_granularity(scenario: str, nodesList:NodesList):
    try:
    # 转换输入数据
        root = [node.model_dump() for node in nodesList.data]

        # Unpack the payload
        contents = [{"id": idx, "content": item["content"]} for idx, item in enumerate(root)]
        comments = [i["comment"] for i in root]
        contexts = [i["context"] for i in root]
        assert len(contents) == len(comments) == len(contexts), "Contents, comments, and contexts must have the same length."
        
        # Step 1, Infer the Granularity
        start_time = time.time()
        granularity_result = await chain4Granularity.invoke(scenario=scenario, comments=comments)
        print(f"Finished inferring granularity, spent {time.time() - start_time:.2f} seconds.")
        return granularity_result
    except Exception as e:
        raise HTTPException(status_code=422, detail=f"Error processing granularity: {str(e)}")


chain4Grouping = extractModule.Chain4Grouping(model)

@app.post("/group/")
async def group_nodes(nodesList: NodesList, scenario: str):
    """对nodes进行分组"""
    try:
        # 转换输入数据
        root = [node.model_dump() for node in nodesList.data]

        # Unpack the payload
        contents = [{"id": idx, "content": item["content"]} for idx, item in enumerate(root)]
        comments = [i["comment"] for i in root]
        contexts = [i["context"] for i in root]
        assert len(contents) == len(comments) == len(contexts), "Contents, comments, and contexts must have the same length."
        
        # Step 1, Infer the Granularity
        start_time = time.time()
        granularity_result = await chain4Granularity.invoke(scenario=scenario, comments=comments)
        print("granularity_result", granularity_result)
        print(f"Finished inferring granularity, spent {time.time() - start_time:.2f} seconds.")
        
        # Step 2, infer groups
        start_time = time.time()

        # 2.1 Group once
        grouped = await chain4Grouping.invoke(scenario=scenario, content=contents, familiarity=granularity_result.familiarity, specificity=granularity_result.specificity)
        print("grouped", grouped)
        # 将grouped中每个列表中的index替换成root对应的真实数据
        grouped_with_data = {}
        for group_key, indices in grouped['groups'].items():
            grouped_with_data[group_key] = [root[idx] for idx in indices]
        grouped['groups'] = grouped_with_data

        first_level_groups = list(grouped['groups'].values())
        second_level_groups = {}
        # 2.2 Group again
        for index, group in enumerate(first_level_groups):
            if len(group) > 1:
                contents = [{"id": idx, "content": item["content"]} for idx, item in enumerate(group)]
                second_level_groups[index] = await chain4Grouping.invoke(scenario=scenario, content=contents, familiarity=granularity_result.familiarity, specificity=granularity_result.specificity)
                grouped_with_data = {}
                print("second_level_groups", second_level_groups)
                for group_key, indices in second_level_groups[index]['groups'].items():
                    grouped_with_data[group_key] = [group[idx] for idx in indices]
                second_level_groups[index]['groups'] = grouped_with_data

        
        groupsOfNodes = []
        for index, group in enumerate(first_level_groups):
            groupsOfNodes.append({
                "records": group,
                "intent_id": index + 1,
                "intent_name": "____",
                "intent_description": "____",
                "level": "1",
                "parent": None
            })

        for index, keys in enumerate(second_level_groups.keys()):
            group = list(second_level_groups[keys]['groups'].values())
            
            groupsOfNodes.append({
                "records": group,
                "intent_id": len(first_level_groups) + index + 1,
                "intent_name": "____",
                "intent_description": "____",
                "level": "2",
                "parent": keys + 1  # keys are 0-indexes
            })

        
        print(f"Finished grouping and constructing tree, spent {time.time() - start_time:.2f} seconds.")

        return {"groupsOfNodes": groupsOfNodes, "granularity": granularity_result}


    except Exception as e:
        raise HTTPException(status_code=422, detail=f"Error processing nodes: {str(e)}")

chain4ExtractIntent = extractModule.Chain4ExtractIntent(model)

@app.post("/extract/")
async def extract_intent(request: dict):
    try:
        start_time = time.time()

        scenario = request.get("scenario")
        groupsOfNodes = request.get("groupsOfNodes")
        familiarity = request.get("familiarity")
        specificity = request.get("specificity")
        intentTree = request.get("intentTree")

        # 过滤出用户确认的节点
        # 根据 intentTree 的结构递归提取所有 immutable 或 confirmed 的节点，构建 confirmedIntents
        confirmedIntents = []

        def extract_confirmed_intents(children, parent_level="1", parent_id=None):
            for child in children:
                # 只处理有 intent 字段的节点（非叶子节点）
                if "intent" in child and (child.get("immutable") or child.get("confirmed")):
                    confirmedIntents.append({
                        "intent_id": child.get("id"),
                        "intent_name": child.get("intent"),
                        "intent_description": child.get("description", ""),
                        "level": child.get("level", parent_level),
                        "parent": child.get("parent", parent_id)
                    })
                # 递归处理子节点
                if "child" in child and isinstance(child["child"], list) and child["child"]:
                    # 传递当前节点的 level+1 作为子节点的 level，parent 传当前节点 id
                    next_level = str(int(child.get("level", parent_level)) + 1) if child.get("level", parent_level).isdigit() else parent_level
                    extract_confirmed_intents(child["child"], parent_level=next_level, parent_id=child.get("id"))

        if intentTree and intentTree.get("child"):
            extract_confirmed_intents(intentTree["child"])

        print("Confirmed intents:", confirmedIntents)

        try:
            result = await chain4ExtractIntent.invoke(scenario=scenario, groupsOfNodes=groupsOfNodes, familiarity=familiarity, specificity=specificity, confirmedIntents=confirmedIntents)
            # 兼容 Pydantic RootModel、list、tuple 等多种返回类型，并确保 result_list 可 item assignment
            if hasattr(result, 'root'):
                # Pydantic RootModel
                result_list = result.root
            elif isinstance(result, dict) and "root" in result:
                result_list = result["root"]
            elif isinstance(result, (list, tuple)):
                result_list = list(result)
            else:
                raise TypeError(f"Unexpected result type: {type(result)}")
        except Exception as e:
            print(f"Error in Chain4ExtractIntent: {str(e)}")
            # Fallback: create basic intent structure from groupsOfNodes
            result_list = []
            for i, group in enumerate(groupsOfNodes):
                result_list.append({
                    "intent_id": group.get("intent_id", i + 1),
                    "intent_name": f"Intent {i + 1}",
                    "intent_description": f"Basic intent for group {i + 1}",
                    "level": group.get("level", "1"),
                    "parent": group.get("parent")
                })
            print(f"Using fallback result_list: {result_list}")

        # 确保 result_list 是 list of dicts
        result_list = [item.model_dump() if hasattr(item, 'model_dump') else dict(item) if not isinstance(item, dict) else item for item in result_list]

        for i, item in enumerate(result_list):
            if i < len(groupsOfNodes):
                item["records"] = groupsOfNodes[i]["records"]
        
        # 转换为嵌套的 intentTree 格式
        intentTree = {
            "scenario": scenario,
            "item": {}
        }
        
        # 首先创建所有节点的映射
        nodes_map = {}
        for item in result_list:
            intent_name = item.get("intent_name", f"Intent_{item.get('intent_id', 'unknown')}")
            # 处理嵌套的记录数组
            def flatten_records(records):
                flattened = []
                for record in records:
                    if isinstance(record, list):
                        flattened.extend(flatten_records(record))
                    else:
                        flattened.append(record)
                return flattened
            
            nodes_map[item.get("intent_id")] = {
                "name": intent_name,
                "id": item.get("intent_id"),
                "intent": item.get("intent_name", ""),
                "description": item.get("intent_description", ""),
                "priority": 5,  # 默认优先级
                "child_num": 0,
                "group": flatten_records(item.get("records", [])),
                "level": item.get("level", "1"),
                "parent": item.get("parent"),
                "immutable": False,  # 默认不是不可变的
                "child": []  # 初始化子节点列表
            }
        
        # 构建嵌套结构
        root_nodes = []
        for item in result_list:
            intent_id = item.get("intent_id")
            parent_id = item.get("parent")
            
            if parent_id is None:
                # 这是根节点
                root_nodes.append(intent_id)
            else:
                # 这是子节点，添加到父节点的child中
                if parent_id in nodes_map:
                    nodes_map[parent_id]["child"].append(intent_id)
        
        # 将根节点添加到intentTree中
        for root_id in root_nodes:
            node_data = nodes_map[root_id]
            intentTree["item"][node_data["name"]] = {
                "id": node_data["id"],
                "intent": node_data["intent"],
                "description": node_data["description"],
                "priority": node_data["priority"],
                "child_num": node_data["child_num"],
                "group": node_data["group"],
                "level": node_data["level"],
                "parent": node_data["parent"],
                "immutable": node_data["immutable"],
                "child": []  # 初始化子节点列表
            }
            
            # 递归添加子节点
            def add_children(parent_node, child_ids):
                for child_id in child_ids:
                    if child_id in nodes_map:
                        child_data = nodes_map[child_id]
                        child_node = {
                            "id": child_data["id"],
                            "intent": child_data["intent"],
                            "description": child_data["description"],
                            "priority": child_data["priority"],
                            "child_num": child_data["child_num"],
                            "group": child_data["group"],
                            "level": child_data["level"],
                            "parent": child_data["parent"],
                            "immutable": child_data["immutable"],
                            "child": []
                        }
                        parent_node["child"].append(child_node)
                        parent_node["child_num"] += 1
                        parent_node["group"] = []  # 父节点有子节点时，清空group
                        
                        # 递归添加子节点的子节点
                        if child_data["child"]:
                            add_children(child_node, child_data["child"])
            
            # 添加子节点到根节点
            add_children(intentTree["item"][node_data["name"]], nodes_map[root_id]["child"])
        
        print(f"Finished extracting intents, spent {time.time() - start_time:.2f} seconds.")
        return intentTree

    except Exception as e:
        raise HTTPException(status_code=422, detail=f"Error processing extract intent: {str(e)}")

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
        chunk_num=1
        # 先验证并转换请求数据为RAGRequest对象
        # try:
        #     ragRequest = RAGRequest(**request_dict)

        # except ValidationError as e:
        #     raise HTTPException(
        #         status_code=422,
        #         detail=f"Invalid request format: {str(e)}"
        #     )

        ragRequest = request_dict

        # 以下是原有逻辑
        intentTree = ragRequest['intentTree']

        webContent = ragRequest['webContent']
        # k = ragRequest.k
        # top_threshold = ragRequest.top_threshold
        # bottom_threshold = ragRequest.bottom_threshold
        scenario = ragRequest['scenario']

        # intentTree = IntentTree(
        #         scenario = scenario,
        #         child=[Intent(**intent) for intent in intentTree.get("item", [])] if intentTree else []
        #     ).model_dump()
        

        # Step 1: 将 webContent 分句
        # sentences = await model4Split.invoke(scenario, webContent)
        # sentences = [sentence for sentence in sentences["data"] if len(sentence.split(" "))  > 3]
        sentences = split2Sentences(webContent)
        print("该网页句子数量：", len(sentences))

        contentChunks = np.array_split(sentences, chunk_num)

        result = []

        for chunk in contentChunks:
            print("chunk len:", len(chunk))
            # # Step 2: 向量化 webContent 的句子
            # sentences_embeddings = await embedModel.embeddingList(chunk)

            # Step 3: 筛选意图并向量化它们
            intentsDict = getIntentsByLevel(
                intentTree['item'],  # 转换 IntentTree 为字典
                level_control="second"
            )

            print("intentsDict", intentsDict)
            # combinedIntents_embeddings = await embedModel.embeddingList(combinedIntents)

            # Step 4: 计算每个意图的 top-k 相关句子
            intent_to_top_k_sentences = {}
            intent_to_bottom_k_sentences = {}

            print("call LLM")
            
            # 将chunk转换为字典格式
            chunk_dict = [{"id": idx, "content": sentence} for idx, sentence in enumerate(chunk)]
            
            # 调用LLM
            response = await model4RAG.invoke(
                    scenario,
                    intentsDict=intentsDict,
                    sentenceList=chunk_dict
                )
            # 重构响应，替换索引
            print("response", response)
            for intent in response['top_all'].keys():
                if intent not in intent_to_top_k_sentences:
                    intent_to_top_k_sentences[intent] = []
                if intent not in intent_to_bottom_k_sentences:
                    intent_to_bottom_k_sentences[intent] = []
                # 从chunk_dict中根据id获取对应的content
                intent_to_top_k_sentences[intent].extend([chunk_dict[i]["content"] for i in response["top_all"][intent]])
                intent_to_bottom_k_sentences[intent].extend([chunk_dict[i]["content"] for i in response["bottom_all"][intent]])
            # for item in response["data"]:
            #     intent = item["intent"]
            #     intent_to_top_k_sentences[intent] = [chunk[i] for i in item["topKIndices"]]

            #     intent_records = get_intent_records(intentTree, intent)  # 获取当前意图的记录

            #     # 如果intent没有records，直接返回top-k
            #     if len(intent_records) == 0:
            #         intent_to_bottom_k_sentences[intent] = intent_to_top_k_sentences[intent][:k]
            #         intent_to_top_k_sentences[intent]= []
            #     else:
            #         intent_records_embeddings = await embedModel.embeddingList(intent_records)
            #         # 对超过top_threshold的每个句子计算与每个 record 的最小相似度
            #         record_max_similarities = []
            #         top_sentences_embeddings = [sentences_embeddings[i] for i in item["topKIndices"]]
            #         if top_sentences_embeddings:
            #             for sentence_e in top_sentences_embeddings:
            #                 max_sim = max(
            #                     cosine_similarity(record_e, sentence_e)
            #                     for record_e in intent_records_embeddings
            #                 )
            #                 record_max_similarities.append(max_sim)

            #             # 筛选低于 bottom_k_threshold 的句子及其索引
            #             bottom_filtered_indices = [
            #                 i for i, sim in enumerate(record_max_similarities) if sim <= bottom_threshold
            #             ]
            #             bottom_filtered_similarities = [
            #                 (i, record_max_similarities[i]) for i in bottom_filtered_indices
            #             ]
            #             bottom_k_indices = sorted(bottom_filtered_similarities, key=lambda x: x[1])[:k]
            #             bottom_k_sentences = [chunk[i[0]] for i in bottom_k_indices]

            #             intent_to_bottom_k_sentences[intent] = bottom_k_sentences
            #         else:
            #             intent_to_bottom_k_sentences[intent] = []
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

# @app.post("/cluster/")
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


# async def hierarcy_cluster(
#     recordsList: RecordsListWithVector,
#     distance_threshold: float = 0.5,
#     level: int = Query(ge=1),
#     intent_num: int = Query(ge=1),
# ):
    # root = [record.model_dump() for record in recordsList.data]
    # count = len(root)

    # newRoot = []
    # if count < 2:
    #     recordsCluster = "[**记录1**\n- 选中文本: {}\n- 上下文: {}\n- 注释: {}]".format(
    #         root[0]["content"], root[0]["context"], root[0]["comment"]
    #     )
    #     intent = await extractModelCluster.invoke(recordsCluster)
    #     return [
    #         {
    #             "id": 0,
    #             "intent": intent,
    #             "priority": 5,
    #             "child_num": len(c),
    #             "child": [
    #                 {key: root[index][key] for key in root[index] if key != "vector"}
    #                 for index in c
    #             ],
    #         }
    #     ]
    # hc_tree = clusterGenerator.hierarcy_clustering(root, distance_threshold)
    # for key, c in hc_tree.items():
    #     recordsCluster = [
    #         "**记录{}**\n- 选中文本: {}\n- 上下文: {}\n- 注释: {}".format(
    #             index + 1,
    #             root[index]["comment"],
    #             root[index]["content"],
    #             root[index]["context"],
    #         )
    #         for index in c
    #     ]
    #     intent = await extractModelCluster.invoke(recordsCluster)
    #     intent_v = model.embedding(intent, ["intent"])
    #     newRoot.append(
    #         {
    #             "id": count + int(key),
    #             "intent": intent["intent"],
    #             "vector": intent_v,
    #             "priority": 5,
    #             "child_num": len(c),
    #             "child": [
    #                 {key: root[index][key] for key in root[index] if key != "vector"}
    #                 for index in c
    #             ],
    #         }
    #     )
    # root = [*newRoot]
    # count += len(root)

    # i = 0
    # while i < level:
    #     i += 1
    #     if len(root) <= intent_num:
    #         return [
    #             {key: node[key] for key in node if key != "vector"} for node in root
    #         ]
    #     newRoot = []
    #     hc_tree = clusterGenerator.hierarcy_clustering(root, distance_threshold)
    #     for key, c in hc_tree.items():
    #         if len(c) == 1:
    #             newRoot.append(root[c[0]])
    #         else:
    #             intentsCluster = [root[index]["intent"] for index in c]
    #             intent = await extractModelCluster.invoke(intentsCluster)
    #             intent_v = model.embedding(intent, ["intent"])
    #             newRoot.append(
    #                 {
    #                     "id": count + int(key),
    #                     "intent": intent["intent"],
    #                     "vector": intent_v,
    #                     "priority": 1,
    #                     "child_num": len(c),
    #                     "child": [
    #                         {
    #                             key: root[index][key]
    #                             for key in root[index]
    #                             if key != "vector"
    #                         }
    #                         for index in c
    #                     ],
    #                 }
    #             )
    #     root = [*newRoot]
    #     count += len(root)

    # return [{key: node[key] for key in node if key != "vector"} for node in root]
