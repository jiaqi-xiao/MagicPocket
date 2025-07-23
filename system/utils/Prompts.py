class Prompts:

    GRANULARITY = '''
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
        '''
    GROUP = '''
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
        '''

    EXTRACT = '''
        You are a reasoning assistant tasked with extracting and describing the user's intents for each group of the records based on the user's desire, the highlighted text, and the user's comments.
        According to the Belief, Desire, Intention (BDI) model, the desire is the goal or objective someone want to achieve when forging information, and intents are different intermediate steps to approach the desire.

        # Instructions
        - A structure of the intent tree is provided in the json file below. Given the user's desire, please extract a intent for each groups of records by filling the missing intent name and intent description in the place holders: ___ . Ensure that each intent is clearly described, non-repetitive, and consistent in granularity.
        - Please only fill in the blank, do not change the structure of the json file, and only return the json file.
        - The intent names should be phrases starting with a verb's -ing form. The specificity and granularity should be consistent with the information provided below.

        # Please also take the following in to account:
        1. The user's familiarity level: users who are unfamiliar with the scenario will have more general/coarse intents, while user familiar with the scenario will have more specific/fine intents.
        User's familiarity level with the scenario: {familiarity}
        Recommended specificity of the intent: {specificity}

        2. The structure of the intent tree: intents with parent should be at the same level of granularity, and should be more specific than the parent intent.

        Desire: {scenario}
        Json file: {json_file}
    '''

    # CONSTRUCT = """
    #     You will act as an assistant to help the user conduct research based on the given Scenario. Please extract a research intent for each dictionary element in Groups and return the results in dictionary format. Ensure that each intent is clearly described, non-repetitive, and consistent in granularity.
    #     According to the Belief, Desire, Intention (BDI) model, the desire is the goal or objective someone want to achieve when forging information, and intents are differnent intermediate steps to approach the beief. In this case, the scenario is the desire, you need to extract the intents.

    #     # Steps
    #         1. **Confirm the number of groups**: Understand the structure of Groups and confirm the number of groups. The number of extracted intents should match the number of groups. A group is defined as a dictionary with group_x as the key and a list as the value.
    #         2. **Understand the scenario**: Analyze the meaning of the Scenario and infer the user's potential intent in this context.
    #         3. **Extract intents**: For each group, extract a corresponding intent. The intent should align with the commonalities among all Nodes in the group while incorporating user comments to refine and ensure relevance. Each intent must be closely related to the Scenario, logically distinct, and non-overlapping. Each intent should be a concise verb phrase of no more than 7 words. The description should clearly explain the theme behind the intent and the subtopics already covered in the group.
    #         4. **Create a new dictionary**: Following the Output Format, use the extracted intents as keys and the corresponding group dictionary keys as values.
    #         5. **Add descriptions**: For every intent in the new dictionary, explain the reason why to construct the intent, and also provide a specific description of the subtopics covered in the group.

    #     # Output Format
    #         - The output should be structured in JSON format as following {format_instructions}.
    #         - example: 
    #                 {{'item': {{'generated_intent_1': {{"group": "group1", "description": "Reasons and theme for generated_intent_1. Existing sub-themes: sub_theme_1, sub_theme_2"}}, 'generated_intent_2': {{"group": "group2", "description": "Reasons and theme for generated_intent_2. Existing sub-themes: sub_theme_3, sub_theme_4"}}, 'remaining_intent_3': {{"group": "", "description": "Reasons and theme for generated_intent_1. Existing sub-themes:"}}}}}}
    #         - 'generated_intent_x', 'sub_theme_x' and 'remaining_intent_x' should be replaced with specific intent phrases.
            
    #     # Notes
    #         - Extract exactly one unique intent per group. The intent must summarize the commonalities of all Nodes in the group.
    #         - Each intent description must be logically independent and maintain diversity to the greatest extent, without exceeding 7 words.
    #         - Verify the final generated dictionary to ensure all intents are at the same level of granularity. Adjust intent texts if necessary.

    #     # User:
    #         Scenario: {scenario}
    #         Groups: {groups}
    #         IntentsList: {intentsList}
    #     """
    
    _bdi_definition ="" # Not being used right now, but can be injected into different prompts in the future
