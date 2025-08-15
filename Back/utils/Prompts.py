class Prompts:
    GROUP = """
        You are a professional information foraging assistant. Based on the given scenario, analyze the user's potential intent and use it as a basis to group the nodes provided in the list. When grouping, ensure that inter-group differences are maximized while intra-group differences are minimized. Return a list of sublists, where each sublist represents a group, and the elements of the sublist are the nodes from the original list.
        
        # Output Format
        - The output should be structured in JSON format as following {format_instructions}.
        
        # User:
        Scenario: {scenario}
        List: {list}
        """

    GROUP_INDEX = """
        According to the Belief, Desire, Intention (BDI) model, the desire is the goal or objective someone want to achieve when forging information, and intents are different intermediate steps to approach the belief.

        Given the desire of the user, and a list of text the user has highlighted, please group the highlighted text into 1-4 groups based on the connection between these text and the intents of the user highlighting these infomration.
        Text from the same group are closely related to each other, and the user's intent of highlighting them is similar.
        Please also take the user's familiarity level into account: user unfamiliar to the scenario will have more general/coarse intents, while user familiar with the scenario will have more specific/fine intents.
        User's familiarity level with the scenario: {familiarity}
        Recommended specificity of the intent: {specificity}

        # Output Format
        - The output should be structured in JSON format as following {format_instructions}.


        Desire: {scenario}
        List of highlighted text:{highlight}
        """

    CONSTRUCT = """
        You will act as an assistant to help the user conduct research based on the given Scenario. Please extract a research intent for each dictionary element in Groups and return the results in dictionary format. Ensure that each intent is clearly described, non-repetitive, and consistent in granularity.

        # Steps
            1. **Confirm the number of groups**: Understand the structure of Groups and confirm the number of groups. The number of extracted intents should match the number of groups. A group is defined as a dictionary with group_x as the key and a list as the value.
            2. **Understand the scenario**: Analyze the meaning of the Scenario and infer the user's potential intent in this context.
            3. **Extract intents**: For each group, extract a corresponding intent. The intent should align with the commonalities among all Nodes in the group while incorporating user comments to refine and ensure relevance. Each intent must be closely related to the Scenario, logically distinct, and non-overlapping. Each intent should be a concise verb phrase of no more than 7 words. The description should clearly explain the theme behind the intent and the subtopics already covered in the group.
            4. **Create a new dictionary**: Following the Output Format, use the extracted intents as keys and the corresponding group dictionary keys as values.
            5. **Compare and replace**:
                - Compare the intents in IntentsList with the extracted intents in the dictionary to find the most similar intent.
                - Replace the dictionary intent with the most similar one from IntentsList if a match is found.
                - Retain the original intent if no sufficiently similar match is found.
            6. **Add remaining intents**: For unused intents in IntentsList, treat them as remaining_intent. Add them to the new dictionary created in step 4 with their values set as empty strings. Skip this step if all intents are used.
            7. **Add descriptions**: For every intent in the new dictionary, explain the reason why to construct the intent, and also provide a specific description of the subtopics covered in the group.
        
        # Output Format
            - The output should be structured in JSON format as following {format_instructions}.
            - example: 
                    {{'item': {{'generated_intent_1': {{"group": "group1", "description": "Reasons and theme for generated_intent_1. Existing sub-themes: sub_theme_1, sub_theme_2"}}, 'generated_intent_2': {{"group": "group2", "description": "Reasons and theme for generated_intent_2. Existing sub-themes: sub_theme_3, sub_theme_4"}}, 'remaining_intent_3': {{"group": "", "description": "Reasons and theme for generated_intent_1. Existing sub-themes:"}}}}}}
            - 'generated_intent_x', 'sub_theme_x' and 'remaining_intent_x' should be replaced with specific intent phrases.
            
        # Notes
            - Extract exactly one unique intent per group. The intent must summarize the commonalities of all Nodes in the group.
            - Each intent description must be logically independent and maintain diversity to the greatest extent, without exceeding 7 words.
            - When performing similarity replacement, ensure that replacement is only made if similarity is sufficiently high.
            - If no sufficiently similar intent exists, the original intent remains unchanged, and unused intents in IntentsList will not be forcibly replaced.
            - Verify the final generated dictionary to ensure all intents are at the same level of granularity. Adjust intent texts if necessary.
        
        # User:
            Scenario: {scenario}
            Groups: {groups}
            IntentsList: {intentsList}
        """

    CONSTRUCT_INDEX = (
        # """
        # 根据要求，将IntentsList和Groups进行匹配和映射，并为多余的Groups生成新的intents，。
        #     - 每个Intent和Group之间的匹配应尽可能准确。
        #     - 如果存在未被匹配的Groups，请参考给定的Scenario提取出适应的Intent。
        #     - 每个Intent的描述必须简短清晰，最多不超过7个词。
        #     - 务必确保生成的intents维持逻辑上的差异性，没有重复或重叠。
        # # Steps
        #     1. **初步匹配**: 将IntentsList中的现有intent与Groups列表中的每个group进行匹配，找到最相似的组合。
        #     2. **分析未匹配的Group**: 如果有多余的group，基于Scenario内容提炼出新的intent以确保每个group都有唯一的intent。
        #     3. **重命名与统一**: 确保每个intent保持简洁、统一的描述方式，长度不超过7个词语。
        #     4. **差异化检查**: 确保所有生成的intent之间存在差异性，尽量减少彼此的含义重叠。
        #     5. **构建意图树**: 根据Output Format将group中的内容添加到intent节点的child属性中。
        # # Output Format
        #     - The output should be structured in JSON format as following {format_instructions}.
        # # Notes
        # - 每个intent的描述不允许超过7个词，并尽量优化语言使表达简洁有力。
        # - 请注意每个生成的intent要有显著区别，避免重复以及同义描述。
        # - 生成的intent节点的immutable属性值为false，原有的intent节点为true
        # # User:
        # Scenario: {scenario}
        # Groups: {groups}
        # IntentsList: {intentsList}
        # """
    )

    RAG = """
        # System  
        You are tasked with assisting the user in conducting information research based on a specified scenario. Your goal is to filter sentences from a given SentenceList for each Intent provided in the IntentsDict.

        ## Steps  
        1. **Understand Input Structure:**  
            - **Scenario**:  Describes the research context, providing high-level guidance..  
            - **SentenceList**: A list of sentences.
            - **IntentsDict**: A dictionary structured as `{{"intent": "description"}}`
                - Each key represents an intent, and the value (description) summarizes the theme and relevant sub-themes of the intent. 

        2. **Filter and Match Sentences:**  
            For each `Intent` and its corresponding `Description` in IntentsDict:  
            - **Description Understanding**:
                - Understand the reason why user has the `Intent` and the collected sub-themes of `Intent` in `Description`.
                - If `Description` is empty, analyze the reason of the `Intent` based on the `Scenario`.
            - **Sentence Evaluation**: For each sentence in `SentenceList`:
                - If `Description` or the `Existing sub-themes` in `Description` is empty, skip the step `Align with Intent Reason and Sub-Themes`.
                - Align with Intent Reason and Sub-Themes:
                    - If the sentence aligns with both the reason in `Description` and collected sub-themes of the intent, add it to top_all[Intent].
                - Align with Intent Reason Only:
                    - If the sentence aligns only with the reason in `Description` and not with sub-themes, add it to bottom_all[Intent].

                


        3. **Relevance Check**:
            - Avoid including sentences in the output unless the sentences genuinely align with the intent's theme or sub-themes.
            - If no sentences match for a specific intent, return an empty list for top_all[Intent] or bottom_all[Intent] as applicable. If no sentences match the criteria, return an empty list for `top_all[Intent]` or `bottom_all[Intent]` as applicable.  

        ## Output Format  
        - The output should be a dictionary with two main keys: `top_all` and `bottom_all`.
            - {format_instructions}
            - `bottom_all`: Maps each Intent to a list of sentences corresponding to sentences aligned only with the reason.
            - `top_all`: Maps each Intent to a list of sentences corresponding to sentences aligned with both the intent's theme and sub-themes.  


        ## Notes  
            - Relevance Over Quantity: Only include sentences that fully meet the alignment criteria. Avoid adding sentences simply to increase the count.
            - Empty Description Handling: If the Description of Intent is empty, skip the step `Align with Intent Reason and Sub-Themes`.
            - Top_all vs. Bottom_all: Maintain a clear distinction between sentences qualifying for top_all (aligned with both the theme and sub-themes) and bottom_all (aligned only with the theme).
            - Exhaustive Intent Coverage: Ensure every intent in IntentsDict is represented in the output, even if no sentences align with it.
            - Avoid Duplication: Prevent any sentence from appearing multiple times across or within top_all and bottom_all lists.

        # User:
            Scenario: {scenario}
            IntentsDict: {intentsDict}
            SentenceList: {sentenceList}
        """

    RAG_INDEX = """  
        # System  
        You are tasked with assisting the user in conducting information research based on a specified scenario. Your goal is to filter sentences from a given SentenceList for each Intent provided in the IntentsDict.

        ## Steps  
        1. **Understand Input Structure:**  
            - **Scenario**:  Describes the research context, providing high-level guidance..  
            - **SentenceList**: A list of sentences.
            - **IntentsDict**: A dictionary structured as `{{"intent": "description"}}`
                - Each key represents an intent, and the value (description) summarizes the theme and relevant sub-themes of the intent. 

        2. **Filter and Match Sentences:**  
            For each `Intent` and its corresponding `Description` in IntentsDict:  
            - **Description Understanding**:
                - Understand the reason why user has the `Intent` and the collected sub-themes of `Intent` in `Description`.
                - If `Description` is empty, analyze the reason of the `Intent` based on the `Scenario`.
            - **Sentence Evaluation**: For each sentence in `SentenceList`:
                - If `Description` or the `Existing sub-themes` in `Description` is empty, skip the step `Align with Intent Reason and Sub-Themes`.
                - Align with Intent Reason and Sub-Themes:
                    - If the sentence aligns with both the reason in `Description` and collected sub-themes of the intent, add it to top_all[Intent].
                - Align with Intent Reason Only:
                    - If the sentence aligns only with the reason in `Description` and not with sub-themes, add it to bottom_all[Intent].

                


        3. **Relevance Check**:
            - Avoid including sentences in the output unless the sentences genuinely align with the intent's theme or sub-themes.
            - If no sentences match for a specific intent, return an empty list for top_all[Intent] or bottom_all[Intent] as applicable. If no sentences match the criteria, return an empty list for `top_all[Intent]` or `bottom_all[Intent]` as applicable.  

        ## Output Format  
        - The output should be a dictionary with two main keys: `top_all` and `bottom_all`.
            - {format_instructions}
            - `bottom_all`: Maps each Intent to a list of indices corresponding to sentences aligned only with the reason.
            - `top_all`: Maps each Intent to a list of indices corresponding to sentences aligned with both the intent's theme and sub-themes.  


        ## Notes  
            - Relevance Over Quantity: Only include sentences that fully meet the alignment criteria. Avoid adding sentences simply to increase the count.
            - Empty Description Handling: If the Description of Intent is empty, skip the step `Align with Intent Reason and Sub-Themes`.
            - Top_all vs. Bottom_all: Maintain a clear distinction between sentences qualifying for top_all (aligned with both the theme and sub-themes) and bottom_all (aligned only with the theme).
            - Exhaustive Intent Coverage: Ensure every intent in IntentsDict is represented in the output, even if no sentences align with it.
            - Avoid Duplication: Prevent any sentence from appearing multiple times across or within top_all and bottom_all lists.

        # User:
            Scenario: {scenario}
            IntentsDict: {intentsDict}
            SentenceList: {sentenceList}
        """

    RAG_TOP_BOTTOM_K = (
        # """
        # # ## System
        # # 你将作为协助用户围绕调研场景Scenario进行信息调研的助手。请基于Description从SentenceList中筛选最多k个最符合Intent的句子，并返回这些句子在SentenceList中的相应索引作为top-k。此外，根据RecordList，挑选出符合Intent的前提下最能提供新信息的k个句子，并返回这些句子在SentenceList中的相应索引作为bottom_k。
        # # # Steps
        # # 1. **理解场景和Intent和Description**：
        # #     - 如果Description为空字符串，根据Scenario和Intent进行推理，补全Description。
        # #     - 仔细阅读给定的场景和Description以理解Intent是什么，目标是理解用户需要哪些信息。
        # # 2. **筛选top_k句子**：
        # #    - 分析SentenceList中的每个句子，并评估其是否属于用户需要的信息。
        # #    - 选择用户最需要的k个句子。
        # #    - 记录这些句子在SentenceList中的索引，将其标识为top_k。
        # #    - 仅当句子与Intent高度相关时才选择，如果没有满足条件的句子则不选择。
        # # 3. **筛选bottom_k句子**：
        # #    - 分析RecordList中的内容。
        # #    - 评估top_k中筛选出的哪些句子的内容与RecordList中的内容存在明显差异。
        # #    - 选择最能提供新信息的k个句子。
        # #    - 记录这些句子在SentenceList中的索引，将其标识为bottom_k。
        # #    - 仅当句子与Intent高度相关时才选择，如果没有满足条件的句子则不选择。
        # # # Output Format
        # #     - 输出格式为JSON，包含两个字段：
        # #     - {format_instructions}
        # # # Notes
        # # - 评选top_k时，首先要考虑是否属于用户需要的信息，如果没有满足条件的句子则不筛选。
        # # - 评选bottom_k时，同样首先要考虑是否属于用户需要的信息，如果没有满足条件的句子则不筛选。
        # # - 如果RecordList不为空列表，正常返回结果。
        # # - 如果RecordList为空列表,将标识为top_k的句子标识为bottom_k返回，并且top_k在此时返回空列表，否则。
        # # - 比较top_k和bottom_k的索引，去除top_k中与bottom_k重复的索引。
        # # ## User:
        # #     Scenario: {scenario}
        # #     Intent: {intent}
        # #     Description: {description}
        # #     SentenceList: {sentenceList}
        # #     RecordList: {recordList}
        # #     k: {k}
        # """
    )

    RAG_TOP_BOTTOM_ALL = (
        # """
        # ## System
        # You are tasked with assisting the user in conducting information research based on a specified scenario. Your goal is to filter sentences from a given SentenceList for each Intent provided in the IntentsDict. Ensure all indices in the output start from 0 and are within the bounds of the SentenceList.
        # ### Steps
        # 1. **Understand Input Structure:**
        #     - **Scenario**:  Describes the research context, providing high-level guidance..
        #     - **SentenceList**: A list of sentences, indexed starting from 0.
        #         - The total number of sentences is N = len(SentenceList).
        #         - Ensure all indices are within [0, N-1].
        #     - **IntentsDict**: A dictionary structured as `{{"intent": "description"}}`
        #         - Each key represents an intent, and the value (description) summarizes the theme and relevant sub-themes of the intent.
        # 2. **Filter and Match Sentences:**
        #     For each `Intent` and its corresponding `Description` in IntentsDict:
        #     - **Theme Completion**: If `Description` is empty, infer the intent's theme based on the `Scenario` and `Intent`. Fill in the `Description`.
        #     - **Sentence Evaluation**: For each sentence in `SentenceList`:
        #         - Align with Intent Theme and Sub-Themes:
        #             - If the sentence aligns with both the theme and specified sub-themes of the intent, add its index to top_all[Intent].
        #         - Align with Intent Theme Only:
        #             -If the sentence aligns only with the theme (and not with sub-themes or no sub-themes are provided), add its index to bottom_all[Intent].
        # 3. **Relevance Check**:
        #     - Avoid including indices in the output unless the sentences genuinely align with the intent's theme or sub-themes. Do not merely list indices without context.
        #     - If no sentences match for a specific intent, return an empty list for top_all[Intent] or bottom_all[Intent] as applicable.If no sentences match the criteria, return an empty list for `top_all[Intent]` or `bottom_all[Intent]` as applicable.
        # ### Output Format
        # - The output should be a dictionary with two main keys: `top_all` and `bottom_all`.
        #   - {format_instructions}
        #   - `top_all`: Maps each Intent to a list of indices corresponding to sentences aligned with both the intent's theme and sub-themes.
        #   - `bottom_all`: Maps each Intent to a list of indices corresponding to sentences aligned only with the theme.
        # - Example output:
        #   ```json
        #   {{
        #     "top_all": {{
        #       "intent1": [0, 2, 3],
        #       "intent2": []
        #     }},
        #     "bottom_all": {{
        #       "intent1": [10],
        #       "intent2": [24, 27, 30]
        #     }}
        #   }}
        #   ```
        # ### Notes
        #     - Relevance Over Quantity: Do not include indices simply for the sake of completeness. Each index must correspond to a sentence that fully meets the alignment criteria.
        #     - Indexing Rules: Ensure all indices are within [0, N-1] and represent meaningful matches.
        #     - Theme vs. Sub-Themes: Clearly differentiate between sentences that align with the overall theme and those that align with sub-themes.
        #     - Exhaustive Intent Coverage: Include all intents from IntentsDict, even if no sentences are aligned with them.
        #     - No Placeholder Indices: Avoid adding indices arbitrarily; only include indices for sentences with a verifiable match.
        #     - Avoid Duplication: Ensure that indices do not appear more than once in the same or different lists.
        # ## User:
        #     Scenario: {scenario}
        #     IntentsDict: {intentsDict}
        #     SentenceList: {sentenceList}
        # """
    )

    GRANULARITY = """
        You are a reasoning assistant tasked with estimating a user's familiarity with a topic and the desired specificity of a response, based on their goal and their comments during an information-gathering process.

        Given:
        - A short description of the user's goal (scenario)
        - A list of comments made by the user while foraging for relevant information

        Infer:
        1. The user's familiarity with the topic based on the language, confidence, and depth of prior knowledge demonstrated in their comments.
        2. The ideal specificity when providing user information regarding this scenario: providing more general information is helpful when the user is unfamiliar with the subject, and providing specific information if the user is familiar and focusing on detailed information.

        If the comments are not sufficient to make a confident judgment, please use neutral as the default value for familiarity and moderate for specificity.
        Respond ONLY in the following JSON format:
        {format_instructions}

        SCENARIO: {scenario}

        COMMENTS:
        {comments}
        """

    EXTRACT_INTENT = """
        You are a reasoning assistant tasked with extracting and describing the user's intents for each group of the records based on the user's desire, the highlighted text, and the user's comments.
        According to the Belief, Desire, Intention (BDI) model, the desire is the goal or objective someone wants to achieve when foraging information, and intents are different intermediate steps to approach the desire.
        In other words, the user's behavior moves toward achieving the desire (i.e. the goal of information foraging task) by intending to commit to specific plans or actions, which can be considered as intents.

        # Instructions
        - A structure of the intent tree is provided in the JSON file below. For each group of records, fill in the missing intent name and intent description in the placeholders: ____.
        - When filling in the placeholders, you should FIRST consider the previously confirmed intents provided below. For each placeholder, if there is a suitable intent_name and intent_description in confirmedIntents that matches the group (based on content, parent, or semantic similarity), use that confirmed intent to fill the placeholder. 
        - IMPORTANT: When selecting a confirmed intent from confirmedIntents, you must ensure that the intent's level matches the group's level. For example, a level 1 intent can only be filled using a level 1 confirmed intent; do not use a confirmed intent of a different level.
        - Only create a new intent if no suitable confirmed intent with the correct level exists.
        - Ensure that each intent is clearly described, non-repetitive, and consistent in granularity.
        - Do NOT change the structure of the JSON file, and only return the JSON file except the 'records' attribute.
        - The intent names should be phrases starting with a verb's -ing form. The specificity and granularity should be consistent with the information provided below.
        - IMPORTANT: You must return ONLY valid JSON format. Do not use Python dictionary syntax (single quotes, no quotes for keys). Use proper JSON syntax with double quotes for all strings and keys.

        # Please also take the following into account:
        1. The user's familiarity level: users who are unfamiliar with the scenario will have more general/coarse intents, while users familiar with the scenario will have more specific/fine intents.
        User's familiarity level with the scenario: {familiarity}
        Recommended specificity of the intent: {specificity}

        2. The structure of the intent tree: intents with parent should be at the same level of granularity, and should be more specific than the parent intent.

        3. Previously confirmed intents: The user has already confirmed some intents that should be preserved and not changed. These confirmed intents are provided in the following format:
        {confirmedIntents}
        When filling in the intent_name and intent_description, always prioritize using the most appropriate confirmed intent from this list for each group, and ensure that the confirmed intent's level matches the group's level.

        Desire: {scenario}
        Json file: {groupsOfNodes}
        """

    RECOMMEND_INTENT = """
        You will receive a JSON object containing a scenario and an intent tree (item).  
Your task is to analyze the given scenario and the existing intents, then propose new recommended intents to fill important gaps.  
Follow these rules:

1. New intents must be comprehensive, relevant to the scenario, and avoid duplication with existing intents.  
2. The total number of new intents must not exceed 5, prioritizing the most important ones that cover missing knowledge or capabilities.  
3. Each new intent must be placed at the correct level:  
   - Level 1 (top-level) if it represents a key dimension for understanding the scenario.  
   - Level 2 if it is a subtopic or detail under an existing Level 1 intent.  
4. Each new intent must include the following fields:  
   - id (unique integer)  
   - intent (name of the intent)  
   - description (short description)  
   - priority (1–5)  
   - child_num (initially 0)  
   - group (empty array or containing leaf node info)  
   - level (hierarchy level)  
   - parent (parent id, null for Level 1)  
   - immutable (boolean, default is False)  
   - child (array, initially empty)  

Input example:
{{
    "scenario": "...",
    "item": {{
        ...
    }}
}}

Output: Return the **updated full intent tree JSON** including the newly added intents in the correct positions and respond ONLY in the following JSON format:
{format_instructions}

Input:
{user_input}
        """
