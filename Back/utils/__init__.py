from pydantic import BaseModel, field_validator
from typing import Union
from .utils import *

# Define a Pydantic model for individual intents
class RecordRef(BaseModel):
    id: int
    content: str
    isLeafNode: bool = True
    
# Define a Pydantic model for grouped intents
class Intent(BaseModel):
    id: int
    isLeafNode: bool = False
    immutable: bool = False
    child: list[RecordRef]
    child_num: int
    priority: int
    intent: str


# Define the main Pydantic model
class IntentTree(BaseModel):
    scenario: str
    child: list[Intent]
    
    def __getattr__(self, name):
        # 如果访问的属性不存在，返回一个空列表
        return []
    
class Record(BaseModel):
    id: int
    comment: str | None = None
    content: str
    context: str

class RecordwithVector(BaseModel):
    id: int
    comment: str | None = None
    content: str
    context: str
    vector: list[float]
    
class RecordsListWithVector(BaseModel):
    data: list[RecordwithVector]
    

class NodesList(BaseModel):
    data: list[Union[Record, Intent]]

    # 自定义验证器：检查列表中所有元素是否是同一类型
    @field_validator("data")
    def check_items_type(cls, v):
        if not v:
            return v

        # 获取列表中的第一个元素的类型
        first_type = type(v[0])

        # 确保所有元素的类型与第一个元素相同
        if not all(isinstance(item, first_type) for item in v):
            raise ValueError("All items in the list must be of the same type.")

        return v

class NodeGroups(BaseModel):
    item: list[Union[Record, Intent]]