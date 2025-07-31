from langchain_core.prompts import PromptTemplate
from langchain_core.output_parsers import JsonOutputParser

from utils import *
    
class Chain4RAG:
    def __init__(self, model):
        ## 你将作为协助用户围绕调研场景Scenario进行信息调研的助手。请从SentenceList中为IntentsDict中的每一对Intent和Description各自筛选最多k个最相关的句子，并返回这些句子在SentenceList中的相应索性作为top-k。
        self.instruction = Prompts.RAG_INDEX

        self.model = model
        self.parser = JsonOutputParser(pydantic_object=sentenceGroupsIndex)
        # self.parser = JsonOutputParser(pydantic_object=sentenceGroups)
        self.prompt_template = PromptTemplate(
            # input_variables=["scenario", "intentList", "recordList", "sentenceList", "k", "description"],
            input_variables=["scenario", "intentsDict", "sentenceList"],
            template=self.instruction,
            partial_variables={
                "format_instructions": self.parser.get_format_instructions()
            },
        )

        self.chain = self.prompt_template | self.model | self.parser

    async def invoke(self, scenario, intentsDict, sentenceList):
        return self.chain.invoke(
            # {"scenario": scenario, "intent": intent, "sentenceList": sentenceList, "recordList": recordList, "k": k, "description": description}
            {"scenario": scenario, "intentsDict": intentsDict, "sentenceList": sentenceList}
        )

class Chain4Split:
    def __init__(self, model):
        ## 你将作为协助用户围绕调研场景Scenario进行信息调研的助手。请将WebContent按上下文语义分句，过滤掉无意义的乱码内容，并以列表形式返回。
        self.instruction = """
## System
Segment web content into meaningful sentences based on semantic context and return them as a list. Ensure that meaningless gibberish is removed while preserving all essential and meaningful information.

### Steps
    1. **Content Segmentation**: Segment the web content into sentences based on semantic context, ensuring each sentence is complete and meaningful.
    2. **Gibberish Filtering**: Identify and remove meaningless gibberish while retaining clear and valuable information.
    3. **Format Output**: Present the segmented content in a list format.

### Output Format
    - Provide the content as a list, where each item is a meaningful sentence.
    - {format_instructions}

### Notes
    - Recognizing gibberish may vary depending on the language or encoding format. Apply appropriate methods for identification.
    - Avoid excessive filtering to ensure meaningful information in parentheses or special characters is preserved.
    - Ensure all essential information is retained, not just removing obvious gibberish.

## User:
    Scenario: {scenario}
    WebContent: {webContent}
"""

        self.model = model
        self.parser = JsonOutputParser(pydantic_object=SplitContent)
        self.prompt_template = PromptTemplate(
            input_variables=["scenario", "webContent"],
            template=self.instruction,
            partial_variables={
                "format_instructions": self.parser.get_format_instructions()
            },
        )

        self.chain = self.prompt_template | self.model | self.parser
    
    async def invoke(self, scenario, webContent):
        return self.chain.invoke(
            {"scenario": scenario, "webContent": webContent}
        )