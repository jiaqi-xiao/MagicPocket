import re
import numpy as np

def filterNodes(tree, target_level, current_level=0, result=None, key=None, value=True) -> list:
    """
    筛选出tree中指定层中的immutable为True的nodes。

    :param tree: 目标树结构，通常是嵌套的字典或列表。
    :param key: 要检查的键，默认是 None。
    :param value: 要匹配的值，默认为 True。
    :return: 包含符合条件节点的列表。
    """
    if result is None:
        result = []

    # 如果下一层是目标层，收集所有该层的 "text"
    if current_level == target_level - 1:
        for item in tree["child"]:
            if not item["isLeafNode"]:
                if (key is None) or (item[key] == value):
                    result.append(item["intent"])

    # 遍历子节点，继续递归
    for node in tree["child"]:
        filterNodes(node, target_level, current_level + 1, result)

    return result

def split2Sentences(content):
    # 使用正则表达式分句
    sentence_endings = re.compile(r'(?<!\w\.\w.)(?<![A-Z][a-z]\.)(?<=\.|\?|\!|\。|\！|\？)\s')
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

if __name__ == "__main__":
    intentTree = {
        "scenario": "travel",
        "child": [
            {
                "id": 1,
                "intent": "巴特罗之家建筑风格",
                "child": [
                    {
                        "id": 2,
                        "content": "巴特罗之家外立面的波浪形曲线和五彩斑斓的瓷砖装饰，象征着大海的波涛和色彩斑斓的鳞片。其阳台和窗户的造型被认为像是动物的骨骼，尤其是龙的形象，反映了高迪从自然界中汲取的灵感。屋顶的龙脊设计和圣乔治屠龙的传说也有关联。",
                        "isLeafNode": True,
                    }
                ],
                "child_num": 1,
                "priority": 1,
                "isLeafNode": False,
                "immutable": False,
            },
            {
                "id": 2,
                "intent": "圣家堂游览建议",
                "child": [
                    {
                        "id": 1,
                        "content": "巴塞罗那三件套：圣家堂、米拉之家、巴特略之家尽量不要一天去，不然出片都是一样的，而且时间也会紧张 ⭐️圣家堂日落前两小时的光最好 ⭐️买90欧72h的3日联票🎫最划算p18，它包含了10个景点门票和公交地铁，可以直接去景点换票，官网：visit Barcelona tickets,（具体情况可以在小📕搜，有好多相关攻略）以下标注🟢的表示用了这个联票 ⭐️小偷很多，注意钱包",
                        "isLeafNode": True,
                    }
                ],
                "child_num": 1,
                "priority": 2,
                "isLeafNode": False,
                "immutable": False,
            },
            {
                "id": 3,
                "intent": "当地美食推荐",
                "child": [
                    {
                        "id": 3,
                        "content": "西班牙朋友的强推 tapas和海鲜饭是我吃下来综合实力第一名的！！ 不是网红店 非常低调的当地小店",
                        "isLeafNode": True,
                    }
                ],
                "child_num": 1,
                "priority": 3,
                "isLeafNode": False,
                "immutable": True,
            },
        ],
    }
    print(filterNodes(intentTree, 1))
