from langchain_core.prompts import ChatPromptTemplate
from langchain_core.output_parsers import StrOutputParser
import os
from langchain_openai import ChatOpenAI

# openai api key
os.environ["OPENAI_API_KEY"] = (
    "MyOpenAIAPIKey"
)


model = ChatOpenAI(model="gpt-4")

parser = StrOutputParser()

system_template_cn = "从后续所有条目中，总结出唯一一条主要需求作为用户意图：\nRecords: \n['Comment: 想要拍照打卡。 Context: 西湖风光秀丽，被誉为诗人之湖。', 'Comment: 想去祈福, Context: 灵隐寺是国内最负盛名的佛家寺院之一.']\nIntent:寻求在著名景点进行独特体验\nRecords:{records}\nIntent:"

prompt_template = ChatPromptTemplate.from_messages(
    [("system", system_template_cn), ("user", "{records}")]
)

chain = prompt_template | model | parser

def invoke(records):
    return chain.invoke(
        {
            "records": records
        }
    )

if __name__ == "__main__":
    records = "['Comment: , Context: 千岛湖群适合家庭度假。']"
    intent = invoke(records)
    print(intent)