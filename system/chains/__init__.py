from utils import *
from langchain_core.prompts import PromptTemplate
from langchain_core.output_parsers import JsonOutputParser,PydanticOutputParser
import os
from pydantic import BaseModel


class Chain4Grouping:
    def __init__(self, model,prompt):
        self.instruction = prompt

        self.model = model
        # self.parser = JsonOutputParser(pydantic_object=NodeGroupsIndex)
        self.parser = JsonOutputParser(pydantic_object=RecordGroups)
        self.prompt_template = PromptTemplate(
            input_variables=["highlight", "scenario","familiarity", "specificity"],
            template=self.instruction,
            partial_variables={
                "format_instructions": self.parser.get_format_instructions()
            },
        )

        self.chain = self.prompt_template | self.model | self.parser

    async def invoke(self, content, scenario,familiarity, specificity):
        return self.chain.invoke({"highlight": content, "scenario": scenario,"familiarity": familiarity,"specificity": specificity})

class Chain4Construct:
    def __init__(self, model,prompt):
        self.instruction = prompt

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

class Chain4InferringGranularity:
    def __init__(self,model,prompt):
        self.instruction = prompt
        self.model = model
        self.parser = PydanticOutputParser(pydantic_object=GranularityOutput)
        self.prompt_template = PromptTemplate(
            input_variables=["scenario", "comments"],
            template=self.instruction,
            partial_variables={
                "format_instructions": self.parser.get_format_instructions()
            },
        )
        self.chain = self.prompt_template | self.model | self.parser

    async def invoke(self, scenario, comments):
        return self.chain.invoke(
            {"scenario": scenario, "commets": comments}
        )

class Chain4Extract:
    def __init__(self, model, prompt):
        self.instruction = prompt

        self.model = model
        self.parser = JsonOutputParser()
        self.prompt_template = PromptTemplate(
            input_variables=["familiarity", "specificity", "scenario","json_file"],
            template=self.instruction)
        self.chain = self.prompt_template | self.model | self.parser

    async def invoke(self, familiarity, specificity, scenario, json_file):
        return self.chain.invoke(
            {"familiarity": familiarity, "specificity": specificity, "scenario": scenario, "json_file": json_file}
        )