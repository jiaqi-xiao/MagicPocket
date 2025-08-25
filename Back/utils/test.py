from pydantic import BaseModel
from typing import Literal, Union
request = {'scenario': 'learn prompt engineering', 'item': {'Understanding Prompt Engineering': {'id': 1, 'intent': 'Understanding Prompt Engineering', 'description': 'Gather general information about what prompt engineering entails, its processes, and its significance in generative AI.', 'priority': 5, 'child_num': 1, 'group': [], 'level': '1', 'parent': None, 'immutable': False, 'child': [{'id': 2, 'intent': 'Exploring Definitions and Importance', 'description': 'Delve into the specifics of what prompt engineering is and why it is important, distinguishing the definition and significance of prompt engineering and prompts themselves.', 'priority': 5, 'child_num': 0, 'group': [{'id': 1754449568672, 'comment': 'definition', 'content': "What is Prompt Engineering?\nPrompt engineering is the process of crafting and refining prompts to improve the performance of [generative AI](https://learnprompting.org/docs/basics/generative_ai) models. It involves providing specific inputs to tools like ChatGPT, [Midjourney](https://learnprompting.org/docs/image_prompting/midjourney), or Gemini, guiding the AI to deliver more accurate and contextually relevant outputs.\nWhen an AI model doesn't produce the desired response, prompt engineering allows us to iterate and adjust the prompt to optimize the output. This method is particularly useful for overcoming limitations of generative models, such as logical errors or insufficient context in responses.", 'context': 'What is Prompt Engineering?', 'isLeafNode': True}, {'id': 1754449584272, 'comment': 'definition', 'content': "What is a Prompt?\nA prompt is the input or [instruction](https://learnprompting.org/docs/basics/instructions) given to an AI model to generate a response. Prompts can be simple (a question) or complex (detailed instructions with context, tone, style, and format specifications). The quality of the AI's response depends directly on how clear, detailed, and structured the prompt is.", 'context': 'What is a Prompt?', 'isLeafNode': True}, {'id': 1754449576479, 'comment': 'importance', 'content': 'Why Prompt Engineering is Important?\nGenerative AI models rely heavily on the input (or "prompt") provided by users. A well-structured prompt is key to leveraging the model\'s capabilities and ensuring it provides relevant, precise answers.\nPrompt engineering is important because:\n\nIt bridges the gap between vague, general queries and specific, actionable results.\nIt helps mitigate errors, such as generating irrelevant content or incorrect responses.\nIt ensures that the AI can handle tasks like creative writing, image generation, or even code development with minimal post-processing needed.', 'context': 'Why Prompt Engineering is Important?', 'isLeafNode': True}], 'level': '2', 'parent': 1, 'immutable': False, 'child': []}]}}}

class IntentNode(BaseModel):
    intent_id: int
    intent_name: str
    intent_description: str
    level: Literal['1', '2']
    parent: int | None

recommended_intents = [IntentNode(intent_id=1, intent_name='Understanding Prompt Engineering', intent_description='Gather general information about what prompt engineering entails, its processes, and its significance in generative AI.', level='1', parent=None), IntentNode(intent_id=2, intent_name='Exploring Definitions and Importance', intent_description='Delve into the specifics of what prompt engineering is and why it is important, distinguishing the definition and significance of prompt engineering and prompts themselves.', level='2', parent=1), IntentNode(intent_id=3, intent_name='Techniques and Best Practices', intent_description='Explore various techniques and best practices for effective prompt engineering, including examples and case studies.', level='2', parent=1), IntentNode(intent_id=4, intent_name='Tools and Platforms', intent_description='Identify and describe tools and platforms that support prompt engineering, including their features and use cases.', level='2', parent=1), IntentNode(intent_id=5, intent_name='Challenges and Solutions', intent_description='Discuss common challenges faced in prompt engineering and potential solutions or strategies to overcome them.', level='2', parent=1), IntentNode(intent_id=6, intent_name='Future Trends in Prompt Engineering', intent_description='Analyze emerging trends and future directions in prompt engineering, considering technological advancements and industry needs.', level='2', parent=1)]




# 将推荐的意图节点添加到原始request的intentTree中
if recommended_intents and ("item" in request):
    for intent_data in recommended_intents:
            if hasattr(intent_data, 'model_dump'):
                intent_dict = intent_data.model_dump()
            else:
                intent_dict = dict(intent_data) if not isinstance(intent_data, dict) else intent_data
            
            # 创建新的意图节点
            new_intent_node = {
                "id": intent_dict.get("intent_id", len(request["item"]) + 1),
                "intent": intent_dict.get("intent_name", ""),
                "description": intent_dict.get("intent_description", ""),
                "priority": intent_dict.get("priority", 5),
                "child_num": 0,
                "group": [],  # 新推荐的意图没有records
                "level": intent_dict.get("level", "1"),
                "parent": intent_dict.get("parent"),
                "immutable": False,  # 新推荐的意图默认是可变的
                "child": []
            }
            
            # 根据level和parent添加到正确的位置
            if intent_dict.get("level") == "1" or intent_dict.get("parent") is None:
                # 顶级意图，添加到item中
                intent_name = intent_dict.get("intent_name", f"Intent_{new_intent_node['id']}")
                request["item"][intent_name] = new_intent_node
            else:
                # 子级意图，需要找到父节点并添加到其child中
                parent_id = intent_dict.get("parent")
                for node_name, node_data in request["item"].items():
                    if node_data.get("id") == parent_id:
                        node_data["child"].append(new_intent_node)
                        node_data["child_num"] += 1
                        break

print(request)