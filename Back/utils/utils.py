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
        result.append({intent: tree.get('description')})

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
    chinese_chars = re.findall(r'[\u4e00-\u9fff]', s)
    if chinese_chars:  # 如果包含中文
        return len(chinese_chars) >= min_length
    else:  # 如果不包含中文，使用原来的英文单词判断逻辑
        return len(s.split()) > min_length


def split2Sentences(content):
    # 使用正则表达式分句
    sentence_endings = re.compile(r"(?<=[。！？!?.\n])")
    sentences = sentence_endings.split(content)
    # 去除空白句子
    sentences = [s.strip() for s in sentences if s.strip() and not all(c in "。！？!?.\n" for c in s)]
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


def getIntentsByLevel(intentTreeItem, level_control="all"):
    intentsDict = []
    if level_control == "first":
        for k, v in intentTreeItem.items():
            intentsDict.append({"intent": k, "description": v["description"]})
    elif level_control == "second":
        for k, v in intentTreeItem.items():
            if len(v["child"]) > 0:
                for second_intent in v["child"]:
                    intentsDict.append({"intent": second_intent["intent"], "description": second_intent["description"]})
            else:
                intentsDict.append({"intent": k, "description": v["description"]})
    else:
        for k, v in intentTreeItem.items():
            intentsDict.append({"intent": k, "description": v["description"]})
            if len(v["child"]) > 0:
                for second_intent in v["child"]:
                    intentsDict.append({"intent": second_intent["intent"], "description": second_intent["description"]})
    return intentsDict

if __name__ == "__main__":
    intentTree = {
        "scenario": "learn prompt engineering",
        "child": [
            {
                "id": 505867,
                "isLeafNode": False,
                "immutable": False,
                "child": [],
                "child_num": 0,
                "priority": 5,
                "intent": "Learning Techniques in Prompt Engineering",
                "description": "Exploring different techniques and strategies used in prompt engineering to enhance AI model outputs.",
            },
            {
                "id": 853398,
                "isLeafNode": False,
                "immutable": False,
                "child": [],
                "child_num": 0,
                "priority": 5,
                "intent": "Understanding Prompt Engineering",
                "description": "Gaining foundational knowledge about what prompt engineering is and its significance in AI model interactions.",
            },
        ],
    }
    # print(filterNodes(intentTree, target_level=1))
    print(get_intent_records(intentTree, "在地中海晒日光浴"))
