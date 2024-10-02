from langchain_core.prompts import ChatPromptTemplate
from langchain_core.output_parsers import StrOutputParser
import os
from langchain_openai import ChatOpenAI

# openai api key
os.environ["OPENAI_API_KEY"] = "MyOpenAIAPI"


class ExtractModel:
    def __init__(self):
        self.model = ChatOpenAI(model="gpt-4o-mini")
        self.parser = StrOutputParser()
        self.system_template_cn = """从以下所有记录中提取出唯一的主要需求作为用户意图
            记录：
            ['评论: 想要拍照打卡。内容: 西湖风光秀丽，被誉为诗人之湖。上下文: 西湖位于浙江省杭州市西侧，是中国十大风景名胜之一，风光秀丽，被誉为“诗人之湖”。', '评论: 想去祈福。内容: 灵隐寺是国内最负盛名的佛家寺院之一。上下文: 灵隐寺建于公元326年，拥有约1700年的历史，是杭州最古老的佛教寺院之一。']
            用户意图：
            寻求在著名景点进行独特体验

            记录：{records}
            用户意图：
        """
        self.prompt_template = ChatPromptTemplate.from_messages(
            [("system", self.system_template_cn), ("user", "{records}")]
        )

        self.chain = self.prompt_template | self.model | self.parser

    async def invoke(self, records):
        print(records)
        return self.chain.invoke({"records": records})
