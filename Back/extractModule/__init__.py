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
    os.environ["OPENAI_API_KEY"] = (
        ""
    )
    
model = "gpt-4o-mini"

# Define a Pydantic model for individual intents
class Intent(BaseModel):
    id: int
    intent: str

# Define a Pydantic model for grouped intents
class GroupedIntents(BaseModel):
    id: int
    child: list[Intent]
    child_num: int
    priority: int
    intent: str

# Define the main Pydantic model
class ExtractIntents(BaseModel):
    extractIntens: list[Intent]
    groupedIntents: list[GroupedIntents]

# direct
class ExtractModelDirect:
    def __init__(self):
        self.instruction = '''
        ## System:
        根据提供的record列表，提取并总结用户用户在旅游场景下产生的意图。  
            - 提取每个record中的意图，保证表述风格统一，每个意图不超过7个词。
            - 将所有意图分组，确保组间差异尽可能大。
            - 从每个组中提炼出一个更高级的意图。
            - 推理出用户对每组意图的优先级（数字越大代表优先级越低，用整数表示）
            
        # Definition of Intention
            - At the highest level, an intention is a situated pursuit of a goal that is attainable through the execution of a process [14, 70] of a certain sequence of actions conceived as leading towards a goal. An intention is an intermediate cognitive state that translates the abstract desire (goal) into concrete actions.
        
        # Steps
        1. **Understand the definition of intention**
        2.. **Analyze Each Record:** 
            - Review each record individually, noting the selected text, context, and user's comment.
        3. **Extract Intent:**
            - Summarize the user's intent from each record in a concise manner, ensuring each intent description is no longer than 7 words and maintains a uniform style.
        4. **Group Intents:**
            - Organize the extracted intents into distinct groups where the differences between the groups are maximized.
        5. **Derive High-level Intents:**
            - For each group, derive a higher-level intent that encompasses the primary theme or objective of that group.
        6. **Deduce the user's priority:**
            - Consider all groups and deduce the user's priority for each group and rank them according to the priority
            
        # Output Format
            - The output should be structured in JSON format as following {format_instructions}.
        
        # Notes
            - Ensure clarity and brevity in the intent extraction.
            - Maintain a unified style across all extracted intents and high-level summaries.
            - Consider edge cases where intents might not initially seem distinct and work to identify distinct themes.
        
        ## User:
        {records}
        '''

        self.model = ChatOpenAI(model=model)
        self.parser = JsonOutputParser(pydantic_object=ExtractIntents)
        self.prompt_template = PromptTemplate(
            template=self.instruction,
            input_variables=['records'],
            partial_variables={"format_instructions": self.parser.get_format_instructions()},
        )

        self.chain_direct = (
            self.prompt_template | self.model | self.parser
        )

    async def invoke(self, records):
        return (
            self.chain_direct.invoke({"records": records})
        )


# cluster-based
class ExtractModelCluster:
    def __init__(self):
        # self.instruction_low_intent_extraction_cn = '从用户提供的多条记录中提取一个简明的意图，将其限制在7个词以内。每条记录包括选中的文本、对应的上下文和注释。基于这些信息，提取出最能反映意图的短语。\n\n# Steps\n\n1. 阅读并理解每条记录的选中的文本、上下文和注释。\n2. 将所有记录的主要意图归纳整理。\n3. 从归纳的结果中提取出一个简明的意图，限制在不超过7个词。\n\n# Output Format\n\n生成的意图应以不超过7个词的短语形式呈现，仅输出意图文本。\n\n# Examples\n\n**记录 1**\n- 选中文本: "请在下周五前提交报告"\n- 上下文: "公司正在收集今年的年度资料..."\n- 注释: "疑问：报告的截止日期是否可以延期？"\n\n**提取的意图**\n- "询问报告延期可能性"\n\n# Notes\n\n- 确保意图清晰明了，并能充分反映记录的核心信息。\n- 对于模棱两可的信息，请根据上下文和注释中的线索进行推测。'
        # self.instruction_high_intent_extraction_cn = '从提供的多个低级意图中提炼出一个高级意图，限制在7个词以内。\n\n# Steps\n\n1. 理解和分析所有提供的低级意图。\n2. 识别这些低级意图之间的共同主题或目的。\n3. 将这些共有的主题或目的浓缩成一个高级意图。\n4. 确保高级意图不超过7个词。\n\n# Output Format\n\n  生成的意图应以不超过7个词的短语形式呈现，仅输出高级意图文本\n\n# Examples\n\n- 低级意图: ["购买书籍", "在线订购", "寻找最佳价格"]\n  - 高级意图: "在线购买书籍"\n\n- 低级意图: ["预约医生", "查找最近诊所", "拨打医生电话"]\n  - 高级意图: "安排医生预约"\n\n# Notes\n\n- 高级意图应尽可能涵盖所有提供的低级意图。\n- 语言应简练且易于理解。'
        self.instruction = '''
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
        '''


        self.model = ChatOpenAI(model=model)
        self.parser = JsonOutputParser(pydantic_object=Intent)
        self.prompt_template = PromptTemplate(
            template=self.instruction,
            input_variables=['records'],
            partial_variables={"format_instructions": self.parser.get_format_instructions()},
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
        self.chain = (
            self.prompt_template | self.model | self.parser
        )

    async def invoke(self, records):
        return (
            # self.chain_low_intent.invoke({"records": records})
            # if mode != "h"
            # else self.chain_high_intent.invoke({"records": records})
            self.chain.invoke({"records": records})
        )