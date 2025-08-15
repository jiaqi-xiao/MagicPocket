from fastapi import Query
from pydantic import BaseModel, Field, RootModel, field_validator
from typing import Literal, Union
from .utils import *
from .Prompts import Prompts

# Define a Pydantic model for individual intents
class RecordRef(BaseModel):
    id: int
    content: str
    isLeafNode: bool = True

class Record(BaseModel):
    id: int
    comment: str | None = None
    content: str
    context: str
    isLeafNode: bool = True

# Define a Pydantic model for grouped intents
class Intent(BaseModel):
    id: int
    isLeafNode: bool = False
    immutable: bool = False
    child: list[Union[RecordRef, Record]]
    child_num: int
    priority: int
    intent: str
    description: str


# Define the main Pydantic model
class IntentTree(BaseModel):
    scenario: str
    child: list[Intent] = []
    
    def __getattr__(self, name):
        if name not in self.model_fields:
            return []
        return super().__getattr__(name)

class IntentTreeIndexItem(BaseModel):
    group: str
    description: str

class IntentTreeIndex(BaseModel):
    item: dict[str, IntentTreeIndexItem]    

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

class NodeGroupsIndex(BaseModel):
    groups: dict[str, list[int]]


class sentenceGroupsIndex(BaseModel):
    top_all: dict[str, list[int]]
    bottom_all: dict[str, list[int]]

class sentenceGroups(BaseModel):
    top_all: dict[str, list[str]]
    bottom_all: dict[str, list[str]]

# 定义子模型
class DataItem(BaseModel):
    intent: str
    topKIndices: list[int]

# 定义主模型
class TopKIndexList(BaseModel):
    data: list[DataItem]
    
class NodeGroups(BaseModel):
    item: list[dict[str, list[Union[Record, Intent]]]]
    
    @field_validator("item")
    def validate_item_structure(cls, v):
        if not isinstance(v, list):
            raise ValueError("item must be a list")
        
        for group in v:
            if not isinstance(group, dict):
                raise ValueError("Each item must be a dictionary")
            
            if len(group) != 1:
                raise ValueError("Each group must have exactly one key-value pair")
            
            group_name, nodes = next(iter(group.items()))
            if not isinstance(nodes, list):
                raise ValueError(f"Value for group '{group_name}' must be a list")
            
            for node in nodes:
                if not isinstance(node, (Record, Intent)):
                    raise ValueError(f"Node in group '{group_name}' must be either Record or Intent")
        
        return v


class RAGRequest(BaseModel):
    scenario: str
    k: int = 9
    top_threshold: float = Query(default=0.5, ge=0.0, le=1.0)
    bottom_threshold: float = Query(default=0.5, ge=0.0, le=1.0)
    intentTree: dict
    webContent: str = Field(..., description="The web content to process")

class SplitContent(BaseModel):
    data: list[str]


class GranularityOutput(BaseModel):
    familiarity: Literal["very unfamiliar", "unfamiliar", "neutral", "familiar", "very familiar"]
    specificity: Literal["very general", "general", "moderate", "specific", "very specific"]

class RecordGroups(BaseModel):
    groups: dict[str, list[Record]]

class IntentNode(BaseModel):
    intent_id: int
    intent_name: str
    intent_description: str
    level: Literal['1', '2']
    parent: int | None

class ExtractResult(RootModel[list[IntentNode]]):
    pass

class UpdatedIntentNode(BaseModel):
    id: int
    intent: str
    description: str
    priority: int
    child_num: int
    group: list[Union[RecordRef, Record]] = []
    level: Literal['1', '2']
    parent: int | None
    immutable: bool
    child: list["UpdatedIntentNode"] = []

class UpdatedIntentTree(BaseModel):
    scenario: str
    item: dict[str, UpdatedIntentNode]