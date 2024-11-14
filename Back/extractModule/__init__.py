from langchain_core.prompts import ChatPromptTemplate, PromptTemplate
from langchain_core.output_parsers import StrOutputParser, JsonOutputParser
import os
from langchain_openai import ChatOpenAI
from pydantic import BaseModel
from typing import Union

# openai api key
if "OPENAI_API_KEY" in os.environ:
    os.environ["OPENAI_API_KEY"] = os.getenv("OPENAI_API_KEY", "")
else:
    os.environ["OPENAI_API_KEY"] = ""

model = "gpt-4o-mini"


# Define a Pydantic model for individual intents
class RecordRef(BaseModel):
    id: int


# Define a Pydantic model for grouped intents
class Intents(BaseModel):
    id: int
    child: list[RecordRef]
    child_num: int
    priority: int
    intent: str


# Define the main Pydantic model
class Output(BaseModel):
    scenario: str
    intents: list[Intents]


# direct
class ExtractModelDirect:
    def __init__(self):
        self.instruction = """
        ## System:
        根据用户提供的RecordList，提炼并总结用户在指定Scenario下产生的搜索意图。将每个Record分组，确保组间差异尽可能大，组内差异尽可能小。  
            - 意图的表述应尽量简洁，控制在7个词以内，并保持表述风格的统一。
            - 优先级必须为整数，数字越大代表优先级越低。
            - 确保组别的差异尽可能大，防止误将无关记录归于同一组。
            
        # Definition of Intention
            - At the highest level, an intention is a situated pursuit of a goal that is attainable through the execution of a process of a certain sequence of actions conceived as leading towards a goal. An intention is an intermediate cognitive state that translates the abstract desire (goal) into concrete actions.
        
        # Steps
        1. **Grouping Records**: 
            - 根据每条Record的内容，将具有类似含义或相似关联的Record归类到同一组，确保组间的差异尽可能大，组内的差异尽可能小。
        2. **Summarizing Intentions for Each Group**: 
            - 为每一组提炼出一个代表该组搜索意图的简洁表述，不超过7个词。
        3. **Prioritizing Group Intentions**:
            - 为每组搜索意图设定优先级，数字越大表示优先级越低，且优先级为整数。
        4. **Structuring Output as a JSON Tree**:
            - 返回一个JSON对象，其中每个`Scenario`为树的根节点，`意图`为子节点，每个意图下包含所有属于该意图的Record。
            
        # Output Format
            - 输出应该是一个JSON格式，结构如下：
                - `Scenario`: 树的根节点。
                - 包含一个或多个子节点，每个子节点为一个意图。
                - 每个意图子节点内包含所有与之对应的Record。
                - {format_instructions}
        
        # Notes
            - Ensure clarity and brevity in the intent extraction.
            - Maintain a unified style across all extracted intents and high-level summaries.
            - Consider edge cases where intents might not initially seem distinct and work to identify distinct themes.
        
        ## User:
        Scenario: {scenario}
        RecordList: {records}
        """

        self.model = ChatOpenAI(model=model)
        self.parser = JsonOutputParser(pydantic_object=Output)
        self.prompt_template = PromptTemplate(
            template=self.instruction,
            input_variables=["scenario","records"],
            partial_variables={
                "format_instructions": self.parser.get_format_instructions()
            },
        )

        self.chain_direct = self.prompt_template | self.model | self.parser

    async def invoke(self, scenario, records):
        return self.chain_direct.invoke({"scenario": scenario, "records": records})


# cluster-based
class ExtractModelCluster:
    def __init__(self):
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

        self.model = ChatOpenAI(model=model)
        self.parser = JsonOutputParser(pydantic_object=Intents)
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
