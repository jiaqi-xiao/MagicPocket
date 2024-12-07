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
        result.append(intent)

    if current_level == target_level:
        return result

    # 如果有子节点，继续递归
    if isinstance(tree, dict) and "child" in tree and isinstance(tree["child"], list):
        for node in tree.get("child", []):
            if not node.get("isLeafNode", True):
                filterNodes(node, current_level + 1, target_level, result, key, value)

    return result


def split2Sentences(content):
    # 使用正则表达式分句
    sentence_endings = re.compile(r"(?<=[。！？!?.])")
    sentences = sentence_endings.split(content)
    # 去除空白句子
    sentences = [s.strip() for s in sentences if s.strip()]
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
        if not node.get("child", []):  # 如果没有子节点，说明是叶节点
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


if __name__ == "__main__":
    intentTree = {
        "scenario": "intent-based user interface",
        "child": [
            {
                "id": 953682,
                "isLeafNode": False,
                "immutable": False,
                "child": [
                    {
                        "id": 1733575992751,
                        "comment": "",
                        "content": "[PDF] Enhancing intent classification via zero-shot and few-shot ChatGPT prompting engineering: generating training data or directly detecting intents",
                        "context": "",
                        "isLeafNode": True,
                    },
                    {
                        "id": 1733576137113,
                        "comment": "",
                        "content": "Beyond Prompts: Learning from Human Communication for Enhanced AI Intent Alignment",
                        "context": "",
                        "isLeafNode": True,
                    },
                ],
                "child_num": 2,
                "priority": 5,
                "intent": "intent alignment strategies",
            },
            {
                "id": 262644,
                "isLeafNode": False,
                "immutable": False,
                "child": [
                    {
                        "id": 1733575946575,
                        "comment": "",
                        "content": "LLM-based Weak Supervision Framework for Query Intent Classification in Video Search",
                        "context": "",
                        "isLeafNode": True,
                    },
                    {
                        "id": 1733575967235,
                        "comment": "",
                        "content": "Using large language models to generate, validate, and apply user intent taxonomies",
                        "context": "",
                        "isLeafNode": True,
                    },
                ],
                "child_num": 2,
                "priority": 5,
                "intent": "intent classification framework",
            },
        ],
    }
    print(filterNodes(intentTree, target_level=1))
