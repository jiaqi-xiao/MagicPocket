from langchain_openai import ChatOpenAI
from chains import *
from utils import *
import json
import os

from langchain_core.prompts import PromptTemplate
from langchain_core.output_parsers import JsonOutputParser
import time


   
def load_model(model_name = "gpt-4o",temperature = 0.05):
    if "OPENAI_API_KEY" in os.environ:
        os.environ["OPENAI_API_KEY"] = os.getenv("OPENAI_API_KEY", "")
    else:
        os.environ["OPENAI_API_KEY"] = ""
    model = ChatOpenAI(model=model_name, temperature = temperature)
    return model

def analyze(scenario:str,payload:dict,granularity_chain,grouping_chain,extract_chain):

    # Unpack the payload
    contents = [i["content"] for i in payload['data']]
    comments = [i["comment"] for i in payload['data']]
    contexts = [i["context"] for i in payload['data']]
    assert len(contents) == len(comments) == len(contexts), "Contents, comments, and contexts must have the same length."
    
    # Step 1, Infer the Granularity
    start_time = time.time()
    granularity_result = granularity_chain.chain.invoke({"scenario": scenario, "comments": comments})
    print(f"Finished inferring granularity, spent {time.time() - start_time:.2f} seconds.")
    
    # Step 2, infer groups
    start_time = time.time()

    # 2.1 Group once
    grouped = grouping_chain.chain.invoke({"scenario": scenario, "highlight":contents,"familiarity": granularity_result.familiarity,"specificity": granularity_result.specificity})
    first_level_groups = list(grouped['groups'].values())
    second_level_groups = {}
    # 2.2 Group again
    for index, group in enumerate(first_level_groups):
        if len(group) > 1:
           contents = [i["content"] for i in group]
           second_level_groups[index] = grouping_chain.chain.invoke({"scenario": scenario, "highlight":contents,"familiarity": granularity_result.familiarity,"specificity": granularity_result.specificity})
    print(f"Finished grouping and constructing tree, spent {time.time() - start_time:.2f} seconds.")

    # Step 3, infer intents
    start_time = time.time()
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
    print(f"Finished extracting intents, spent {time.time() - start_time:.2f} seconds.")
    return result
    

if __name__ == "__main__":
    model = load_model()
    granularity_chain = Chain4InferringGranularity(model, Prompts.GRANULARITY)
    grouping_chain = Chain4Grouping(model, Prompts.GROUP)
    extract_chain = Chain4Extract(model, Prompts.EXTRACT)

    # load scenario and payload
    scenario = None
    with open("test_scenario.json", "r") as f:
        scenario = json.load(f)["scenario"]
    if not scenario:
        raise ValueError("Scenario is empty, please provide a valid scenario in test_scenario.json.")
    with open("test_payload.json", "r") as f:
        payload = json.load(f)
    
    ## analyze
    result= analyze(scenario, payload, granularity_chain, grouping_chain, extract_chain)
    with open("visualization/result.json", "w") as f:
        json.dump(result, f, indent=4)
    print("Analysis complete. Results saved to visualization/result.json.")

    print("automatically starting the server to visualize the results, use ctrl+C to terminate...")

    # not the best way to start the server, but it works for now...
    os.system("python -m http.server --directory visualization 8800")
    print("Please open http://127.0.0.1:8800/ in your browser to visualize the results. Use ctrl+C to terminate...")
