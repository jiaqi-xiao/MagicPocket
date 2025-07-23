from typing import Annotated
from fastapi import FastAPI, Query
from fastapi.middleware.cors import CORSMiddleware
from langchain_openai import ChatOpenAI, OpenAIEmbeddings
import os
from utils import *
import json
import traceback
from fastapi import HTTPException
from pydantic import ValidationError

from langchain_openai import ChatOpenAI
from chains import *
from utils import *
import json
import os

from langchain_core.prompts import PromptTemplate
from langchain_core.output_parsers import JsonOutputParser


def load_model(model_name = "gpt-4o",temperature = 0.05):
    if "OPENAI_API_KEY" in os.environ:
        os.environ["OPENAI_API_KEY"] = os.getenv("OPENAI_API_KEY", "")
    else:
        os.environ["OPENAI_API_KEY"] = ""
    model = ChatOpenAI(model=model_name, temperature = temperature)
    return model


app = FastAPI()

if "OPENAI_API_KEY" in os.environ:
    os.environ["OPENAI_API_KEY"] = os.getenv("OPENAI_API_KEY", "")
else:
    os.environ["OPENAI_API_KEY"] = ""

# Add CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

model = load_model()
granularity_chain = Chain4InferringGranularity(model, Prompts.GRANULARITY)
grouping_chain = Chain4Grouping(model, Prompts.GROUP)
extract_chain = Chain4Extract(model, Prompts.EXTRACT)


@app.get("/")
async def root():
    return "Hello World!"

@app.get("/analyze/")
async def analyze(scenario:str,payload:dict):

    # Unpack the payload
    contents = [i["content"] for i in payload['data']]
    comments = [i["comment"] for i in payload['data']]
    contexts = [i["context"] for i in payload['data']]
    assert len(contents) == len(comments) == len(contexts), "Contents, comments, and contexts must have the same length."

    # Use the global chains defined above
    global granularity_chain, grouping_chain, extract_chain

    # Step 1, Infer the Granularity
    granularity_result = granularity_chain.chain.invoke({"scenario": scenario, "comments": comments})
    
    # Step 2, infer groups

    # 2.1 Group once
    grouped = grouping_chain.chain.invoke({"scenario": scenario, "highlight":contents,"familiarity": granularity_result.familiarity,"specificity": granularity_result.specificity})
    first_level_groups = list(grouped['groups'].values())
    second_level_groups = {}
    # 2.2 Group again
    for index, group in enumerate(first_level_groups):
        if len(group) > 1:
            contents = [i["content"] for i in group]

    # Step 3, infer intents
    # 3.1 prepare the structured intent tree and use ___ as placeholders for intent names and descriptions
    json_file = []
    for index,group in enumerate(first_level_groups):
        json_file.append({
            "records": group,
            "intent_id":index+1,
            "intent_name": "____",
            "intent_description": "____",
            "level": "1",
            "parent": None
        })

    for index,keys in enumerate(second_level_groups.keys()):

        group = list(second_level_groups[keys].values())
        json_file.append({
            "records": group,
            "intent_id": len(first_level_groups)+index+1,
            "intent_name": "____",
            "intent_description": "____",
            "level": "2",
            "parent": keys+1 # keys are 0-indexes
        })
    
    # 3.2 feed it to the extract chain
    result = extract_chain.chain.invoke({"scenario": scenario, "json_file": json.dumps(json_file), "familiarity": granularity_result.familiarity, "specificity": granularity_result.specificity})
    return result
