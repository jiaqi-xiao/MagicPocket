from langchain_core.prompts import PromptTemplate
from langchain_core.output_parsers import JsonOutputParser
import os
from pydantic import BaseModel

from utils import *


# direct
class ExtractModelDirect:
    def __init__(self, model):
        self.instruction = """
## System:
根据用户提供的List，提炼并总结用户在指定Scenario下产生的搜索意图。将List中每个Element分组，确保组间差异尽可能大，组内差异尽可能小。  
    - 意图的表述应尽量简洁，控制在7个词以内，并保持表述风格的统一。
    - 优先级必须为整数，数字越大代表优先级越低。
    - 确保组别的差异尽可能大，防止误将无关记录归于同一组。
            
# Definition of Intention
    - At the highest level, an intention is a situated pursuit of a goal that is attainable through the execution of a process of a certain sequence of actions conceived as leading towards a goal. An intention is an intermediate cognitive state that translates the abstract desire (goal) into concrete actions.
        
# Steps
    1. **Grouping Elements**: 
        - 根据每条Element的内容，将具有类似含义或相似关联的Element归类到同一组，确保组间的差异尽可能大，组内的差异尽可能小。
    2. **Summarizing Intentions for Each Group**: 
        - 为每一组提炼出一个代表该组搜索意图的简洁表述，不超过7个词。
    3. **Prioritizing Group Intentions**:
        - 为每组搜索意图设定优先级，数字越大表示优先级越低，且优先级为整数。
    4. **Structuring Output as a JSON Tree**:
        - 返回一个JSON对象，其中每个`Scenario`为树的根节点，`意图`为子节点，每个意图下包含所有属于该意图的Element。
            
# Output Format
    - 输出应该是一个JSON格式，结构如下：
        - `Scenario`: 树的根节点。
        - 包含一个或多个子节点，每个子节点为一个意图，每个子节点有两个布尔类型的属性，分别是isLeafNode和immutable，默认值是False。
        - 每个意图子节点内包含所有与之对应的Element，Element的id需与输入时保持一致。
        - 每个叶节点为一个Record，有一个布尔类型的属性isLeafNode，默认值为True。
        - {format_instructions}

# Notes
    - Ensure clarity and brevity in the intent extraction.
    - Maintain a unified style across all extracted intents and high-level summaries.
    - Consider edge cases where intents might not initially seem distinct and work to identify distinct themes.

## User:
Scenario: {scenario}
List: {list}
"""

        self.model = model
        self.parser = JsonOutputParser(pydantic_object=IntentTree)
        self.prompt_template = PromptTemplate(
            template=self.instruction,
            input_variables=["scenario", "list"],
            partial_variables={
                "format_instructions": self.parser.get_format_instructions()
            },
        )

        self.chain_direct = self.prompt_template | self.model | self.parser

    async def invoke(self, scenario, list):
        return self.chain_direct.invoke({"scenario": scenario, "list": list})


# class UpdateModelDirect:
#     def __init__(self, model):
#         self.instruction = """
#         """

#         self.model = model
#         self.parser = JsonOutputParser(pydantic_object=Output)
#         self.prompt_template = PromptTemplate(
#             template=self.instruction,
#             input_variables=["intentTree", "scenario", "records"],
#             partial_variables={
#                 "format_instructions": self.parser.get_format_instructions()
#             },
#         )

#         self.chain_direct = self.prompt_template | self.model | self.parser

#     async def invoke(self, intentTree, scenario, records):
#         return self.chain_direct.invoke(
#             {"intentTree": intentTree, "scenario": scenario, "records": records}
#         )


# cluster-based
class ExtractModelCluster:
    def __init__(self, model):
        # self.instruction_low_intent_extraction_cn = '从用户提供的多条记录中提取一个简明的意图，将其限制在7个词以内。每条记录包括选中的文本、对应的上下文和注释。基于这些信息，提取出最能反映意图的短语。\n\n# Steps\n\n1. 阅读并理解每条记录的选中的文本、上下文和注释。\n2. 将所有记录的主要意图归纳整理。\n3. 从归纳的结果中提取出一个简明的意图，限制在不超过7个词。\n\n# Output Format\n\n生成的意图应以不超过7个词的短语形式呈现，仅输出意图文本。\n\n# Examples\n\n**记录 1**\n- 选中文本: "请在下周五前提交报告"\n- 上下文: "公司正在收集今年的年度资料..."\n- 注释: "疑问：报告的截止日期是否可以延期？"\n\n**提取的意图**\n- "询问报告延期可能性"\n\n# Notes\n\n- 确保意图清晰明了，并能充分反映记录的核心信息。\n- 对于模棱两可的信息，请根据上下文和注释中的线索进行推测。'
        # self.instruction_high_intent_extraction_cn = '从提供的多个低级意图中提炼出一个高级意图，限制在7个词以内。\n\n# Steps\n\n1. 理解和分析所有提供的低级意图。\n2. 识别这些低级意图之间的共同主题或目的。\n3. 将这些共有的主题或目的浓缩成一个高级意图。\n4. 确保高级意图不超过7个词。\n\n# Output Format\n\n  生成的意图应以不超过7个词的短语形式呈现，仅输出高级意图文本\n\n# Examples\n\n- 低级意图: ["购买书籍", "在线订购", "寻找最佳价格"]\n  - 高级意图: "在线购买书籍"\n\n- 低级意图: ["预约医生", "查找最近诊所", "拨打医生电话"]\n  - 高级意图: "安排医生预约"\n\n# Notes\n\n- 高级意图应尽可能涵盖所有提供的低级意图。\n- 语言应简练且易于理解。'
        self.instruction = """
        ## System:
        根据用户提供的数据（record列表或intent列表），提取和总结用户在旅游场景下产生的意图或对意图进行分组和提炼。
            - 当用户提供record列表时，每个record包含选中文本、上下文及注释，所有records语义相似。
            - 从这些records中提取和总结一个且仅有一个意图，这个意图不超过7个词。
            - 当用户提供intent列表时，提炼出一个更高级别的意图。
        
        # Definition of Intention
            - At the highest level, an intention is a situated pursuit of a goal that is attainable through the execution of a process of a certain sequence of actions conceived as leading towards a goal. An intention is an intermediate cognitive state that translates the abstract desire (goal) into concrete actions.
        
        # Steps
            1. **理解意图定义**
            2. **Record列表处理**:
                - 阅读每个record内的选中文本、上下文及注释。
                - 理解这些record的共同意图。
                - 提取并用不超过7个词总结这个共同意图。
            3. **Intent列表处理**:
                - 为每个intent组提炼出一个更高级别的意图。
        
        # Output Format
            在处理record列表时，输出每个record列表中提取的意图，限制在不超过7个词。
            在处理intent列表时，为每个组提供一个提炼后的高级别意图。
            - The output should be structured in JSON format as following {format_instructions}.
        
        # Notes
            - 确保每个提取或提炼的意图表达明确且符合原意。
            - 在意图提炼时，注意使用简练的语言以保持表达简洁清晰。
        
        ## User:
        {records}
        """

        self.model = model
        self.parser = JsonOutputParser(pydantic_object=Intent)
        self.prompt_template = PromptTemplate(
            template=self.instruction,
            input_variables=["records"],
            partial_variables={
                "format_instructions": self.parser.get_format_instructions()
            },
        )

        # self.prompt_template_low_intent = ChatPromptTemplate.from_messages(
        #     [("system", self.instruction_low_intent_extraction_cn), ("user", "{records}")]
        # )
        # self.prompt_template_high_intent = ChatPromptTemplate.from_messages(
        #     [("system", self.instruction_high_intent_extraction_cn), ("user", "{records}")]
        # )

        # self.chain_low_intent = (
        #     self.prompt_template_low_intent | self.model | self.parser
        # )
        # self.chain_high_intent = (
        #     self.prompt_template_high_intent | self.model | self.parser
        # )
        self.chain = self.prompt_template | self.model | self.parser

    async def invoke(self, records):
        return (
            # self.chain_low_intent.invoke({"records": records})
            # if mode != "h"
            # else self.chain_high_intent.invoke({"records": records})
            self.chain.invoke({"records": records})
        )


class Chain4Grouping:
    def __init__(self, model):
        self.instruction = """
        你将作为协助用户进行信息调研的助手。请基于给定的Scenario分析用户的潜在意图，并以此为基础将用户提供的List，将List中每个Node分成多个组，确保组间差异尽可能大，组内差异尽可能小。返回一个列表，每个元素是一个子列表，代表一个组，子列表中是Node对应的索引。
        
        # Output Format
        - The output should be structured in JSON format as following {format_instructions}.
        - example: {{"item": [{{"group1": [0,1]}}, {{"group2": [2]}}]}}
        
        # User:
        Scenario: {scenario}
        List: {list}
        """

        self.model = model
        self.parser = JsonOutputParser(pydantic_object=NodeGroupsIndex)
        self.prompt_template = PromptTemplate(
            input_variables=["list"],
            template=self.instruction,
            partial_variables={
                "format_instructions": self.parser.get_format_instructions()
            },
        )

        self.chain = self.prompt_template | self.model | self.parser

    async def invoke(self, nodeList, scenario):
        return self.chain.invoke({"list": nodeList, "scenario": scenario})


class Chain4Construct:
    def __init__(self, model):
        ## 对Groups中的每一组提炼一个符合Scenario语境下的意图，以字典形式返回，key为意图，value为group的索引。务必确保生成的intents维持逻辑上的差异性，没有重复或重叠。每个Intent的描述必须简短清晰，最多不超过7个词。
        ## 比较所有生成的意图与IntentsList中的意图，用IntentsList中的意图替换字典中最相似的意图，如果不够相似则不需要替换。如果IntentsList中还有未替换的Intent，则对每个剩余的Intent在字典中创建以该Intent为key，None为value的键值对。
        self.instruction = """
        你将作为协助用户围绕调研场景Scenario进行信息调研的助手。请对Groups中的每一个字典元素提炼一个符合Scenario的调研意图，以字典形式返回。确保每个意图描述清晰、不重复，并且保证每个intent处于相同颗粒度下。

        # Steps
            1. **确认group数量**: 理解Groups的结构，确认group的数量，后续提取的意图数量需与group的数量一致。一个group是以group_x为key,一个列表为value的字典。
            2. **理解场景**: 理解Scenario的含义，分析该场景下用户的潜在意图。
            3. **提取意图**: 对每个group提炼出一个相应的意图描述，该意图需要与group中列表里所有Node的共性相符。提取时，确保每个意图与场景紧密相关，在逻辑上具备差异性，不可重叠或重复。每个意图描述应该为动词短语形式且不超过7个词，确保简短精炼。
            4. **创建新字典**: 根据Output Format，用提取的意图作为key，对应的group字典中的键作为value。
            5. **比较替换**:
                - 使用`IntentsList`中的意图与提取出的字典键进行比较，寻找最相似的意图。
                - 找到最相似意图时，将字典中的意图替换为`IntentsList`中的意图。
                - 如果某个意图没有足够相似的替换项，则保留不变。
            6. **添加剩余意图**: 对于`IntentsList`中未使用的意图，视为remaining_intent。将这些剩余意图作为key添加到第四步中构建的新字典中，其对应值为空字符串。如果没未替换的意图则跳过这一步。
            7. **添加描述**： 对于新字典中的每一个意图，给出一个具体的描述，解释为了满足意图用户需要哪些后续信息。
        
        # Output Format
            - The output should be structured in JSON format as following {format_instructions}.
            - example: 
                    {{'item': {{'generated_intent_1': {{"group": "group1", "description": "Reasons for generated_intent_1 and required further information"}}, 'generated_intent_2': {{"group": "group2", "description": "Reasons for generated_intent_2 and required further information"}}, 'remaining_intent_3': {{"group": "", "description": "Reasons for remaining_intent_3 and required further information"}}}}}}
            - 'generated_intent_x'以及'remaining_intent_x'应该用具体的意图文字替换
            
        # Notes
            - 对每个group提炼唯一一个意图，不可以超过一个。意图是对group中列表的所有Node的共性的抽象概括。
            - 每个意图描述必须具备逻辑独立性，最大程度维持多样性, 且不超过7个词。
            - 当进行相似度替换时，务必保证只有在相似度足够高的情况下才进行替换。
            - 如果不存在足够相似的意图，则原意图保持不变，且`IntentsList`中的意图不会被强行替换。
            - 新字典中的'generated_intent_x'以及'remaining_intent_x'应该用具体的意图文字替换
            - 检查最终生成的新字典，确保每个intent处于相同颗粒度下，否则调整intent文本。
        
        # User:
            Scenario: {scenario}
            Groups: {groups}
            IntentsList: {intentsList}
        """

        # self.instruction1 = """
        # 根据要求，将IntentsList和Groups进行匹配和映射，并为多余的Groups生成新的intents，。
        #     - 每个Intent和Group之间的匹配应尽可能准确。
        #     - 如果存在未被匹配的Groups，请参考给定的Scenario提取出适应的Intent。
        #     - 每个Intent的描述必须简短清晰，最多不超过7个词。
        #     - 务必确保生成的intents维持逻辑上的差异性，没有重复或重叠。

        # # Steps
        #     1. **初步匹配**: 将IntentsList中的现有intent与Groups列表中的每个group进行匹配，找到最相似的组合。
        #     2. **分析未匹配的Group**: 如果有多余的group，基于Scenario内容提炼出新的intent以确保每个group都有唯一的intent。
        #     3. **重命名与统一**: 确保每个intent保持简洁、统一的描述方式，长度不超过7个词语。
        #     4. **差异化检查**: 确保所有生成的intent之间存在差异性，尽量减少彼此的含义重叠。
        #     5. **构建意图树**: 根据Output Format将group中的内容添加到intent节点的child属性中。

        # # Output Format
        #     - The output should be structured in JSON format as following {format_instructions}.

        # # Notes
        # - 每个intent的描述不允许超过7个词，并尽量优化语言使表达简洁有力。
        # - 请注意每个生成的intent要有显著区别，避免重复以及同义描述。
        # - 生成的intent节点的immutable属性值为false，原有的intent节点为true

        # # User:
        # Scenario: {scenario}
        # Groups: {groups}
        # IntentsList: {intentsList}
        # """

        self.model = model
        self.parser = JsonOutputParser(pydantic_object=IntentTreeIndex)
        self.prompt_template = PromptTemplate(
            input_variables=["scenario", "groups", "intentsList"],
            template=self.instruction,
            partial_variables={
                "format_instructions": self.parser.get_format_instructions()
            },
        )

        self.chain = self.prompt_template | self.model | self.parser

    async def invoke(self, scenario, groups, intentsList):
        return self.chain.invoke(
            {"scenario": scenario, "groups": groups, "intentsList": intentsList}
        )
