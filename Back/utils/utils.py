import re
import numpy as np


def filterNodes(
    tree, current_level=0, target_level=1, result=None, key=None, value=None
) -> list:
    """
    筛选出tree中所有层级中的immutable为True的nodes。

    :param tree: 目标树结构，通常是嵌套的字典或列表。
    :param current_level: 当前层级，从0开始
    :param result: 用于存储结果的列表
    :param key: 要检查的键，默认是 None
    :param value: 要匹配的值，默认为 True
    :return: 包含符合条件节点的列表。
    """
    if result is None:
        result = []

    # 检查当前层级的节点
    if (
        isinstance(tree, dict)
        and tree.get(key) == value
        and not tree.get("isLeafNode", True)
    ):
        intent = tree.get("intent")
        result.append({intent: tree.get("description")})

    if current_level == target_level:
        return result

    # 如果有子节点，继续递归
    if isinstance(tree, dict) and "child" in tree and isinstance(tree["child"], list):
        for node in tree.get("child", []):
            if not node.get("isLeafNode", True):
                filterNodes(node, current_level + 1, target_level, result, key, value)

    return result


def is_sentence_valid(s, min_length=3):
    # 检查是否包含中文字符
    chinese_chars = re.findall(r"[\u4e00-\u9fff]", s)
    if chinese_chars:  # 如果包含中文
        return len(chinese_chars) >= min_length
    else:  # 如果不包含中文，使用原来的英文单词判断逻辑
        return len(s.split()) > min_length


def split2Sentences(content):
    # 使用正则表达式分句
    sentence_endings = re.compile(r"(?<=[。！？!?.\n])")
    sentences = sentence_endings.split(content)
    # 去除空白句子
    sentences = [
        s.strip()
        for s in sentences
        if s.strip() and not all(c in "。！？!?.\n" for c in s)
    ]
    # 去除过短的句子
    sentences = [s for s in sentences if is_sentence_valid(s)]
    return sentences


def cosine_similarity(vec1, vec2):
    """
    计算两个向量之间的余弦相似度。
    """
    dot_product = np.dot(vec1, vec2)
    norm_vec1 = np.linalg.norm(vec1)
    norm_vec2 = np.linalg.norm(vec2)
    return dot_product / (norm_vec1 * norm_vec2 + 1e-8)  # 避免除以零


def get_intent_records(intentTree, intent):
    """
    获取指定 intent 的所有叶节点记录，递归遍历所有层级（除叶节点外）。

    :param intentTree: 树形结构的意图树
    :param intent: 目标 intent
    :return: 匹配 intent 的所有叶节点记录列表
    """

    def collect_leaf_nodes(node):
        """
        递归收集所有叶节点。
        :param node: 当前节点
        :return: 叶节点的列表
        """
        if node.get("isLeafNode") == True:  # 如果没有子节点，说明是叶节点
            return [node["content"]]
        leaf_nodes = []
        for child in node.get("child", []):
            leaf_nodes.extend(collect_leaf_nodes(child))
        return leaf_nodes

    def traverse_and_match(node):
        """
        递归遍历所有节点，匹配 intent 并收集叶节点。
        :param node: 当前节点
        :return: 匹配 intent 的叶节点列表
        """
        # 如果当前节点的 intent 匹配目标 intent，则收集其所有叶节点
        if node.get("intent") == intent:
            return collect_leaf_nodes(node)

        # 如果有子节点，递归遍历子节点
        results = []
        for child in node.get("child", []):
            results.extend(traverse_and_match(child))
        return results

    # 从根节点开始递归遍历
    return traverse_and_match(intentTree)


def merge_dicts(data):
    merged_dict = {"top_k": {}, "bottom_k": {}}

    for item in data:
        # 合并 top_k
        for key, value in item["top_k"].items():
            if key not in merged_dict["top_k"]:
                merged_dict["top_k"][key] = []
            merged_dict["top_k"][key].extend(value)
            merged_dict["top_k"][key] = list(set(merged_dict["top_k"][key]))

        # 合并 bottom_k
        for key, value in item["bottom_k"].items():
            if key not in merged_dict["bottom_k"]:
                merged_dict["bottom_k"][key] = []
            merged_dict["bottom_k"][key].extend(value)
            merged_dict["bottom_k"][key] = list(set(merged_dict["bottom_k"][key]))

    return merged_dict


def getIntentsByLevel(intentTree, level_control="all"):
    """
    根据参数控制返回intentTree中不同层级的意图
    
    :param intentTree: 意图树结构
    :param level_control: 控制返回的层级类型
        - "all": 返回所有意图（所有层级）
        - "first": 只返回第一层意图
        - "prefer_second": 优先返回第二层意图，如果第一层意图没有子节点则返回第一层
    :return: 包含意图的列表，每个元素为 {intent: description} 格式
    """
    result = []
    
    def collect_all_intents(node, level=0):
        """递归收集所有层级的意图"""
        # 处理根节点的item字段
        if level == 0 and isinstance(node, dict) and "item" in node:
            for key, value in node["item"].items():
                collect_all_intents(value, level + 1)
        else:
            # 检查当前节点是否是意图节点
            if isinstance(node, dict) and node.get("isLeafNode") != True:
                intent = node.get("intent")
                description = node.get("description")
                if intent and description:
                    result.append({intent: description})
            
            # 递归处理子节点
            if isinstance(node, dict) and "child" in node and isinstance(node["child"], list):
                for child in node.get("child", []):
                    if child.get("isLeafNode") != True:  # 只处理非叶节点
                        collect_all_intents(child, level + 1)
    
    def collect_first_level_intents(node, level=0):
        """只收集第一层意图"""
        if level == 0 and isinstance(node, dict) and "item" in node:
            # 处理根节点的item字段
            for key, value in node["item"].items():
                if isinstance(value, dict) and value.get("isLeafNode") != True:
                    intent = value.get("intent")
                    description = value.get("description")
                    if intent and description:
                        result.append({intent: description})
        elif level == 0:
            # 如果直接是意图节点
            if isinstance(node, dict) and node.get("isLeafNode") != True:
                intent = node.get("intent")
                description = node.get("description")
                if intent and description:
                    result.append({intent: description})
    
    def collect_prefer_second_intents(node, level=0):
        """优先收集第二层意图，如果没有子节点则收集第一层"""
        if level == 0 and isinstance(node, dict) and "item" in node:
            # 处理根节点的item字段
            for key, value in node["item"].items():
                if isinstance(value, dict) and value.get("isLeafNode") != True:
                    # 检查是否有子节点
                    has_children = (value.get("child") and 
                                  isinstance(value["child"], list) and 
                                  len(value["child"]) > 0)
                    
                    if has_children:
                        # 有子节点，收集第二层意图
                        for child in value["child"]:
                            if isinstance(child, dict) and child.get("isLeafNode") != True:
                                intent = child.get("intent")
                                description = child.get("description")
                                if intent and description:
                                    result.append({intent: description})
                    else:
                        # 没有子节点，收集第一层意图
                        intent = value.get("intent")
                        description = value.get("description")
                        if intent and description:
                            result.append({intent: description})
        elif level == 0:
            # 如果直接是意图节点
            if isinstance(node, dict) and node.get("isLeafNode") != True:
                intent = node.get("intent")
                description = node.get("description")
                if intent and description:
                    result.append({intent: description})
    
    # 根据level_control参数选择相应的收集函数
    if level_control == "all":
        collect_all_intents(intentTree)
    elif level_control == "first":
        collect_first_level_intents(intentTree)
    elif level_control == "prefer_second":
        collect_prefer_second_intents(intentTree)
    else:
        raise ValueError("level_control must be one of: 'all', 'first', 'prefer_second'")
    
    return result


if __name__ == "__main__":
    intentTree = {
        "scenario": "learn prompt engineering",
        "item": {
            "Understanding prompt engineering": {
                "id": 1,
                "intent": "Understanding prompt engineering",
                "description": "Gaining a fundamental understanding of what prompt engineering is and its significance in the performance of generative AI models.",
                "priority": 5,
                "child_num": 1,
                "group": [],
                "level": "1",
                "parent": None,
                "immutable": False,
                "child": [
                    {
                        "id": 4,
                        "intent": "Learning about concepts of prompt engineering",
                        "description": "Delving into the basic concepts and importance of prompt engineering, understanding the structure and components that make effective prompts.",
                        "priority": 5,
                        "child_num": 0,
                        "group": [
                            {
                                "id": 1753966535397,
                                "comment": "definition",
                                "content": "Prompt engineering is the process of crafting and refining prompts to improve the performance of [generative AI](https://learnprompting.org/docs/basics/generative_ai) models. It involves providing specific inputs to tools like ChatGPT, [Midjourney](https://learnprompting.org/docs/image_prompting/midjourney), or Gemini, guiding the AI to deliver more accurate and contextually relevant outputs.",
                                "context": "Prompt engineering is the process of crafting and refining prompts to improve the performance of generative AI models. It involves providing specific inputs to tools like ChatGPT, Midjourney, or Gemini, guiding the AI to deliver more accurate and contextually relevant outputs.",
                                "isLeafNode": True,
                            },
                            {
                                "id": 1753966549298,
                                "comment": "importance",
                                "content": "Prompt engineering is important because:\n\nIt bridges the gap between vague, general queries and specific, actionable results.\nIt helps mitigate errors, such as generating irrelevant content or incorrect responses.\nIt ensures that the AI can handle tasks like creative writing, image generation, or even code development with minimal post-processing needed.",
                                "context": "It ensures that the AI can handle tasks like creative writing, image generation, or even code development with minimal post-processing needed.",
                                "isLeafNode": True,
                            },
                            {
                                "id": 1753966568081,
                                "comment": "definition",
                                "content": "A prompt is the input or [instruction](https://learnprompting.org/docs/basics/instructions) given to an AI model to generate a response. Prompts can be simple (a question) or complex (detailed instructions with context, tone, style, and format specifications). The quality of the AI's response depends directly on how clear, detailed, and structured the prompt is.",
                                "context": "A prompt is the input or instruction given to an AI model to generate a response. Prompts can be simple (a question) or complex (detailed instructions with context, tone, style, and format specifications). The quality of the AI's response depends directly on how clear, detailed, and structured the prompt is.",
                                "isLeafNode": True,
                            },
                        ],
                        "level": "2",
                        "parent": 1,
                        "immutable": False,
                        "child": [],
                    }
                ],
            },
            "Identifying limitations of LLMs": {
                "id": 2,
                "intent": "Identifying limitations of LLMs",
                "description": "Learning about the challenges and limitations faced by large language models (LLMs), such as hallucinations, limited reasoning skills, and bias.",
                "priority": 5,
                "child_num": 0,
                "group": [
                    {
                        "id": 1753966585610,
                        "comment": "limitations",
                        "content": "1. Hallucinations (Making Up Information)\nOne weird thing about LLMs is that when they don't know the answer, they often won't admit it. Instead, they'll confidently make up something that sounds believable. This is called a \"hallucination.\" For example, if you ask for a fact about a historical event that wasn't in the data it was trained on, the LLM might invent details or events that never happened.\n2. Limited Reasoning Skills\nEven though LLMs can seem very smart, they often struggle with basic math. This is because they weren't really designed to solve math problems. While LLMs are good at understanding and generating sentences, they're not great at solving complex problems. For example, if you ask an LLM to solve a multi-step math problem or a puzzle, it might get confused and make mistakes along the way.\n3. Limited Long-Term Memory\nEach time you use an LLM, it starts with a blank slate—it doesn't remember your previous conversations unless you remind it in the current session. This can be frustrating if you're trying to have an ongoing discussion or work on a project over time.\n4. Limited Knowledge\nLLMs are trained on data from the past. It means that if LLMs don't have access to the internet or any way to look up information in real time, they don't know anything that happened after their training data was collected. If you ask about recent events, they won't be able to provide accurate answers.\n5. Bias\nLLMs learn from the text they're trained on, and that text comes from the internet, a place that can contain biased, harmful, or prejudiced content. As a result, LLMs can sometimes reflect the same biases in their responses. For example, they might produce content that is sexist, racist, or otherwise problematic.\n6. Prompt Hacking\nLLMs can be tricked or \"hacked\" by clever users who know how to manipulate prompts. This is called [prompt hacking](https://learnprompting.org/docs/category/-prompt-hacking). For example, someone might be able to word a prompt in such a way that it gets the LLM to generate inappropriate or harmful content, even if the system is supposed to block such responses.\nHow to handle it: When using LLMs in public or for others to interact with, make sure there are filters and safety measures in place to prevent inappropriate use.",
                        "context": "1. Hallucinations (Making Up Information)",
                        "isLeafNode": True,
                    }
                ],
                "level": "1",
                "parent": None,
                "immutable": False,
                "child": [],
            },
            "Exploring different prompting techniques": {
                "id": 3,
                "intent": "Exploring different prompting techniques",
                "description": "Exploring various techniques used in prompt engineering to improve AI responses, such as role prompting and few-shot prompting.",
                "priority": 5,
                "child_num": 1,
                "group": [],
                "level": "1",
                "parent": None,
                "immutable": False,
                "child": [
                    {
                        "id": 5,
                        "intent": "Understanding applications of prompting techniques",
                        "description": "Gaining knowledge about specific techniques in prompting, such as role prompting and few-shot prompting, and their applications.",
                        "priority": 5,
                        "child_num": 0,
                        "group": [
                            {
                                "id": 1753966609987,
                                "comment": "role prompting",
                                "content": 'Role prompting is a technique that involves assigning a role or persona to an [AI model](https://learnprompting.org/docs/basics/generative_ai), such as "food critic" or "mathematician," to control the style[1](https://learnprompting.org/docs/basics/roles#footnote-label)Shanahan, M., McDonell, K., & Reynolds, L. (2023). Role-Play with Large Language Models.\n [2](https://learnprompting.org/docs/basics/roles#footnote-label)Li, G., Hammoud, H. A. A. K., Itani, H., Khizbullin, D., & Ghanem, B. (2023). CAMEL: Communicative Agents for "Mind" Exploration of Large Scale Language Model Society.\n [3](https://learnprompting.org/docs/basics/roles#footnote-label)Santu, S. K. K., & Feng, D. (2023). TELeR: A General Taxonomy of LLM Prompts for Benchmarking Complex Tasks.\n  or accuracy of its responses.',
                                "context": "Role prompting",
                                "isLeafNode": True,
                            },
                            {
                                "id": 1753966624337,
                                "comment": "in-context learning",
                                "content": "Few-shot prompting is a direct application of ICL, where multiple examples (or \"shots\") are provided to guide the model's output. The more examples (or shots) we give, the better the model typically performs, as it can learn from these examples and generalize them to new, similar tasks.\nHere's a breakdown of the common shot-based methods:\n\n[Zero-Shot Prompting](https://learnprompting.org/docs/basics/few_shot#what-is-zero-shot-prompting): No examples are provided, and the model must rely entirely on its pre-trained knowledge.\n[One-Shot Prompting](https://learnprompting.org/docs/basics/few_shot#what-is-one-shot-prompting): A single example is given to clarify the task for the model.\n[Few-Shot Prompting](https://learnprompting.org/docs/basics/few_shot#what-is-few-shot-prompting): Two or more examples are included, allowing the model to recognize patterns and deliver more accurate responses.",
                                "context": "Few-shot prompting",
                                "isLeafNode": True,
                            },
                        ],
                        "level": "2",
                        "parent": 3,
                        "immutable": False,
                        "child": [],
                    }
                ],
            },
        },
    }

    # 测试新函数
    print("=== 测试 getIntentsByLevel 函数 ===")
    
    # 调试信息
    print(f"intentTree keys: {list(intentTree.keys())}")
    if "item" in intentTree:
        print(f"item keys: {list(intentTree['item'].keys())}")
        # 检查第一个节点的结构
        first_key = list(intentTree['item'].keys())[0]
        first_node = intentTree['item'][first_key]
        print(f"第一个节点结构: {list(first_node.keys())}")
        print(f"isLeafNode: {first_node.get('isLeafNode')}")
        print(f"intent: {first_node.get('intent')}")
        print(f"description: {first_node.get('description')}")
    
    # 测试返回所有意图
    print("\n1. 返回所有意图:")
    all_intents = getIntentsByLevel(intentTree, "all")
    print(f"找到 {len(all_intents)} 个意图")
    for intent in all_intents:
        for key, value in intent.items():
            print(f"  - {key}: {value}")
    
    # 测试返回第一层意图
    print("\n2. 返回第一层意图:")
    first_intents = getIntentsByLevel(intentTree, "first")
    print(f"找到 {len(first_intents)} 个第一层意图")
    for intent in first_intents:
        for key, value in intent.items():
            print(f"  - {key}: {value}")
    
    # 测试优先返回第二层意图
    print("\n3. 优先返回第二层意图:")
    prefer_second_intents = getIntentsByLevel(intentTree, "prefer_second")
    print(f"找到 {len(prefer_second_intents)} 个优先第二层意图")
    for intent in prefer_second_intents:
        for key, value in intent.items():
            print(f"  - {key}: {value}")
