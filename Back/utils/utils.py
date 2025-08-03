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

if __name__ == "__main__":
    intentTree = {
        "scenario": "travel",
        "child": [
            {
                "id": 0,
                "intent": "探索巴塞罗那建筑风格",
                "child_num": 2,
                "priority": 1,
                "child": [
                    {
                        "id": 0,
                        "comment": "挑一个天气好的傍晚取圣家堂",
                        "content": "巴塞罗那三件套：圣家堂、米拉之家、巴特略之家尽量不要一天去，不然出片都是一样的，而且时间也会紧张 ⭐️圣家堂日落前两小时的光最好",
                        "context": "小tips:⭐️巴塞罗那三件套：圣家堂、米拉之家、巴特略之家尽量不要一天去，不然出片都是一样的，而且时间也会紧张 ⭐️圣家堂日落前两小时的光最好 ⭐️买90欧72h的3日联票🎫最划算p18，它包含了10个景点门票和公交地铁，可以直接去景点换票，官网：visit Barcelona tickets,（具体情况可以在小📕搜，有好多相关攻略） 以下标注🟢的表示用了这个联票 ⭐️小偷很多，注意钱包",
                        "isLeafNode": True
                    },
                    {
                        "id": 1,
                        "comment": "很奇幻的建筑风格，想去亲眼看看",
                        "content": "巴特罗之家外立面的波浪形曲线和五彩斑斓的瓷砖装饰，象征着大海的波涛和色彩斑斓的鳞片。其阳台和窗户的造型被认为像是动物的骨骼，尤其是龙的形象，反映了高迪从自然界中汲取的灵感。屋顶的龙脊设计和圣乔治屠龙的传说也有关联。",
                        "context": "巴特罗之家（Casa Batlló）是位于西班牙巴塞罗那的一座标志性建筑，由著名建筑师安东尼·高迪（Antoni Gaudí）于1904年设计改造。它是加泰罗尼亚现代主义的杰出代表，以其独特的外观和富有想象力的设计而闻名。 巴特罗之家外立面的波浪形曲线和五彩斑斓的瓷砖装饰，象征着大海的波涛和色彩斑斓的鳞片。其阳台和窗户的造型被认为像是动物的骨骼，尤其是龙的形象，反映了高迪从自然界中汲取的灵感。屋顶的龙脊设计和圣乔治屠龙的传说也有关联。 内部空间也充满创意和细节，每个房间都采用独特的设计理念，光线的运用和空气流通的考量令人称奇。如今，巴特罗之家是世界文化遗产之一，向公众开放，是巴塞罗那不可错过的文化与建筑地标。",
                        "isLeafNode": True
                    }
                ]
            },
            {
                "id": 1,
                "intent": "品尝当地特色美食",
                "child_num": 1,
                "priority": 1,
                "child": [
                    {
                        "id": 2,
                        "comment": "想尝试一些当地特色美食",
                        "content": "西班牙朋友的强推 tapas和海鲜饭是我吃下来综合实力第一名的！！ 不是网红店 非常低调的当地小店",
                        "context": "📝《综合实力第一名》🥇 Can Ramonet 图2-3 💰：40欧 📍：老城区里 西班牙朋友的强推 tapas和海鲜饭是我吃下来综合实力第一名的！！ 不是网红店 非常低调的当地小店 📝《海鲜 前两名》🦞🐟🦀🦑🐙 Puertecillo Born 图4-5 💰：30欧 📍：老城区 餐厅里有海鲜摊 买好现场加工 非常新鲜 价格便宜种类多 可以每种点一些 吃到好多种 Colom 图6-7 💰：30镑 📍：有两家 连锁店 海鲜拼盘种类很多很大量！海鲜饭也很好吃！ 两人点一个拼盘一个海鲜饭刚刚好 ps：波盖利亚市场 逛一下就行 很贵而且不好吃 梅西光顾的海鲜店 人均100欧 味道是不错 但性价比不高 📝《tapas 不分伯仲的前两名》🍖🍖 Vinitus 图8-9 （有两家） Cerveseria Catalana 图10 💰：30欧 📍：都在感恩大道（购物街）和巴特略之家附近 老网红了 我这五次 每次都会去吃的tapas店 ！ 哪家排队人少去哪家！都很好吃 时间有限选一家就可以，不用都去～ 《海鲜饭争霸赛》 都是💰40欧左右 我心里的前3名 🥇La fonda 图11 连锁店 很多家 我觉得海鲜饭里最好吃的一家 景点附近都有！量很大！ 🥈Taverna el glop 图12 天气好可以坐在室外吃 超级舒服！ 🥉El Glop Braseria 图13 当地人很喜欢的一家店！不是传统的味道 蕃茄味很浓郁",
                        "isLeafNode": True
                    }
                ]
            },
            {
                "id": 2,
                "intent": "在地中海晒日光浴",
                "child": [],
                "child_num": 0,
                "priority": 1

            }
        ]
    }
    # print(filterNodes(intentTree, target_level=1))
    print(get_intent_records(intentTree, '在地中海晒日光浴'))
