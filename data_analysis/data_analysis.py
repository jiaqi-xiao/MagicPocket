import pandas as pd
import matplotlib.pyplot as plt
import seaborn as sns
from datetime import datetime
import numpy as np

# Define abnormal data configuration
abnormal_data = {
    'I': [],  # Participants with abnormal data in In-depth task
    'B': ['P2']       # Participants with abnormal data in Broad task
}

def load_and_process_log(filename, threshold=1800, task_type=None):
    # file in logs/
    filename_full = f'../logs/{filename}'
    df = pd.read_csv(filename_full)
    df['timestamp'] = pd.to_datetime(df['Local Time'])
    
    # Filter actions
    action_mapping = {
        'new_task_description_create_btn_clicked': 'Task',
        'context_menu_save_btn_clicked': 'Record',
        'context_menu_comment_btn_clicked': 'Record',
        'side_panel_analyze_btn_clicked': 'IntentTree',
        'network_node_deleted': 'IntentTree',
        'network_node_edited': 'IntentTree',
        'network_node_added': 'IntentTree',
        'side_panel_highlight_text_btn_clicked': 'Highlight'
    }
    
    df = df[df['Action'].isin(action_mapping.keys())]
    df['category'] = df['Action'].map(action_mapping)
    
    # Special handling for P4_B and P1_I tasks
    if task_mapping.get(filename) in ['P4_B', 'P1_I']:
        task_creation_mask = df['Action'] == 'new_task_description_create_btn_clicked'
        task_creation_times = df[task_creation_mask].copy()
        
        print(f"\nProcessing {task_mapping.get(filename)} task:")
        print("All task creation times:")
        print(task_creation_times[['Local Time', 'timestamp', 'Action']])
        
        if len(task_creation_times) > 0:
            # Get the last task creation time
            last_task_time = task_creation_times.iloc[-1]['timestamp']
            # Filter data after the last task creation
            df = df[df['timestamp'] >= last_task_time].copy()
            df = df.reset_index(drop=True)
            
            print("\nAfter filtering to last task:")
            task_actions = df[df['Action'] == 'new_task_description_create_btn_clicked']
            print(task_actions[['Local Time', 'timestamp', 'Action']])
    
    # Normal processing for Broad task
    elif task_type == 'B':
        task_creation_mask = df['Action'] == 'new_task_description_create_btn_clicked'
        task_creation_times = df[task_creation_mask].copy()
        
        if len(task_creation_times) > 1:
            # Get the second task creation time
            second_task_time = task_creation_times.iloc[1]['timestamp']
            # Filter data after the second task creation
            df = df[df['timestamp'] >= second_task_time].copy()
            df = df.reset_index(drop=True)
    
    # Calculate time differences for segmentation
    df = df.sort_values('timestamp')
    df['time_diff'] = df['timestamp'].diff().dt.total_seconds()
    
    # Initialize variables for finding segments
    segments = []
    current_segment = []
    segment_start = None
    
    # Iterate through the dataframe to find valid segments
    for i, row in df.iterrows():
        time_diff = row['time_diff'] if not pd.isna(row['time_diff']) else 0
        
        if time_diff <= threshold:
            # Continue current segment
            if not current_segment:
                segment_start = row['timestamp']
            current_segment.append(i)
        else:
            # End current segment and start a new one
            if current_segment:
                segment_duration = (df.loc[current_segment[-1], 'timestamp'] - segment_start).total_seconds()
                segments.append({
                    'indices': current_segment.copy(),
                    'length': len(current_segment),
                    'duration': segment_duration
                })
            current_segment = [i]
            segment_start = row['timestamp']
    
    # Add the last segment if it exists
    if current_segment:
        segment_duration = (df.loc[current_segment[-1], 'timestamp'] - segment_start).total_seconds()
        segments.append({
            'indices': current_segment,
            'length': len(current_segment),
            'duration': segment_duration
        })
    
    # Select the segment with the most operations
    if segments:
        best_segment = max(segments, key=lambda x: x['length'])
        df = df.loc[best_segment['indices']].copy()
        
        if task_mapping.get(filename) in ['P4_B', 'P1_I']:
            print("\nAfter segment selection:")
            task_actions = df[df['Action'] == 'new_task_description_create_btn_clicked']
            print("Final task creation actions:")
            print(task_actions[['Local Time', 'timestamp', 'Action']])
    else:
        return pd.DataFrame()
    
    # Calculate relative time from first action
    if len(df) > 0:
        start_time = df['timestamp'].min()
        df['relative_time'] = (df['timestamp'] - start_time).dt.total_seconds()
    
    return df

def plot_session_timeline(processed_logs, task_type=None, mapping=None):
    plt.figure(figsize=(20, 8))
    
    # Define marker styles for different categories
    category_styles = {
        'Task': {'color': '#f08c00', 'marker': 'X', 'size': 120},
        'Record': {'color': '#0c8599', 'marker': 's', 'size': 100},
        'IntentTree': {'color': '#e03131', 'marker': 'o', 'size': 100},
        'Highlight': {'color': '#602e9e', 'marker': '^', 'size': 100}
    }
    
    # Add grid background
    plt.grid(True, alpha=0.2, linestyle='--', color='gray')
    plt.gca().set_facecolor('#f8f8f8')
    
    # Filter logs based on task type and remove abnormal data if specified
    if task_type and mapping:
        valid_logs = {}
        for k, v in processed_logs.items():
            if len(v) > 0 and mapping.get(k, '').endswith(task_type):
                participant = mapping[k].split('_')[0]
                # Skip if participant is in abnormal data list for this task type
                if participant not in abnormal_data.get(task_type, []):
                    valid_logs[k] = v
    else:
        valid_logs = {k: v for k, v in processed_logs.items() if len(v) > 0}
    
    # First plot empty points for legend with larger font
    legend_elements = []
    for category, style in category_styles.items():
        legend_elements.append(plt.scatter([], [], 
                   c=style['color'],
                   marker=style['marker'],
                   s=style['size'],
                   alpha=0.7,
                   label=category))
    
    for i, (filename, df) in enumerate(valid_logs.items()):
        # Plot points for each category
        for category, style in category_styles.items():
            mask = df['category'] == category
            if mask.sum() > 0:  # Only plot if there's data
                plt.scatter(df[mask]['relative_time'], 
                          [i] * mask.sum(),
                          c=style['color'],
                          marker=style['marker'],
                          s=style['size'],
                          alpha=0.7)
                
                # Add connecting lines
                if mask.sum() > 1:
                    plt.plot(df[mask]['relative_time'], 
                           [i] * mask.sum(),
                           color=style['color'],
                           alpha=0.2,
                           linewidth=1.5)
    
    # Set y-axis labels and range with larger font
    if mapping:
        labels = [mapping[filename].split('_')[0] for filename in valid_logs.keys()]
    else:
        labels = [f'P{i+1}' for i in range(len(valid_logs))]
    
    plt.yticks(range(len(valid_logs)), labels, fontsize=14)
    plt.ylim(-0.5, len(valid_logs) - 0.5)
    
    # Set x-axis label and ticks with larger font
    plt.xlabel('Relative Time (seconds)', fontsize=14, labelpad=10)
    plt.ylabel('Participant', fontsize=14, labelpad=10)
    plt.xticks(fontsize=12)
    
    # Set title with full task name and larger font
    title = 'User Activity Timeline\n'
    # if task_type == 'B':
    #     title += 'Broad Expansion Task'
    #     legend_loc = 'lower right'  # 宽泛任务图例放在右下角
    # elif task_type == 'I':
    #     title += 'In-depth Exploration Task'
    #     legend_loc = 'upper right'  # 深入任务图例放在右上角
    # else:
    #     legend_loc = 'upper right'  # 默认放在右上角
    legend_loc = 'upper right'
    # plt.title(title, fontsize=16, pad=20)
    
    # Optimize legend display - position based on task type
    plt.legend(handles=legend_elements, 
              loc=legend_loc,
              fontsize=12,
              framealpha=0.9,
              edgecolor='gray',
              facecolor='white',
              borderpad=1)
    
    # Adjust layout to prevent text cutoff
    plt.tight_layout()
    
    return plt

def plot_transition_heatmap(processed_logs):
    all_transitions = []
    categories = ['Task', 'Record', 'IntentTree', 'Highlight']
    
    for df in processed_logs.values():
        if len(df) < 2:
            continue
        transitions = list(zip(df['category'].iloc[:-1], df['category'].iloc[1:]))
        all_transitions.extend(transitions)
    
    transition_matrix = pd.DataFrame(0, 
                                   index=categories, 
                                   columns=categories)
    
    for from_cat, to_cat in all_transitions:
        transition_matrix.loc[from_cat, to_cat] += 1
    
    plt.figure(figsize=(8, 6))
    sns.heatmap(transition_matrix, annot=True, fmt='g', cmap='YlOrRd')
    plt.title('Action Transition Heatmap')
    
    return plt

def plot_combined_timeline(processed_logs, mapping):
    plt.figure(figsize=(20, 12))
    
    # Define marker styles for different categories
    category_styles = {
        'Task': {'color': '#f08c00', 'marker': 'X', 'size': 120},
        'Record': {'color': '#0c8599', 'marker': 's', 'size': 100},
        'IntentTree': {'color': '#e03131', 'marker': 'o', 'size': 100},
        'Highlight': {'color': '#602e9e', 'marker': '^', 'size': 100}
    }
    
    # Add grid background
    plt.grid(True, alpha=0.2, linestyle='--', color='gray')
    plt.gca().set_facecolor('#f8f8f8')
    
    # Prepare data for both task types
    task_data = {'I': {}, 'B': {}}
    max_time = 0
    
    for task_type in ['I', 'B']:
        valid_logs = {}
        for k, v in processed_logs.items():
            if len(v) > 0 and mapping.get(k, '').endswith(task_type):
                participant = mapping[k].split('_')[0]
                if participant not in abnormal_data.get(task_type, []):
                    valid_logs[k] = v
                    max_time = max(max_time, v['relative_time'].max())
        task_data[task_type] = valid_logs
    
    # First plot empty points for legend
    legend_elements = []
    for category, style in category_styles.items():
        legend_elements.append(plt.scatter([], [], 
                   c=style['color'],
                   marker=style['marker'],
                   s=style['size'],
                   alpha=0.7,
                   label=category))
    
    # Plot data for each task type
    total_participants = len(set([p.split('_')[0] for p in mapping.values()]))
    y_offset = {'I': total_participants + 0.5, 'B': 0}  # Reduce gap between tasks from 1 to 0.5
    
    for task_type, valid_logs in task_data.items():
        for i, (filename, df) in enumerate(valid_logs.items()):
            # Plot points for each category
            for category, style in category_styles.items():
                mask = df['category'] == category
                if mask.sum() > 0:  # Only plot if there's data
                    plt.scatter(df[mask]['relative_time'], 
                              [i + y_offset[task_type]] * mask.sum(),
                              c=style['color'],
                              marker=style['marker'],
                              s=style['size'],
                              alpha=0.7)
                    
                    # Add connecting lines
                    if mask.sum() > 1:
                        plt.plot(df[mask]['relative_time'], 
                               [i + y_offset[task_type]] * mask.sum(),
                               color=style['color'],
                               alpha=0.2,
                               linewidth=1.5)
    
    # Set y-axis labels
    y_ticks = []
    y_labels = []
    
    # Add labels for In-depth task
    for i, (filename, _) in enumerate(task_data['I'].items()):
        y_ticks.append(i + y_offset['I'])
        y_labels.append(f"{mapping[filename].split('_')[0]} (I)")
    
    # Add labels for Broad task
    for i, (filename, _) in enumerate(task_data['B'].items()):
        y_ticks.append(i + y_offset['B'])
        y_labels.append(f"{mapping[filename].split('_')[0]} (B)")
    
    plt.yticks(y_ticks, y_labels, fontsize=14)
    plt.ylim(-0.5, total_participants * 2)  # Adjust y-axis limit to match new gap
    
    # Set x-axis label and ticks
    plt.xlabel('Relative Time (seconds)', fontsize=14, labelpad=10)
    plt.ylabel('Participant (Task Type)', fontsize=14, labelpad=10)
    plt.xticks(fontsize=12)
    
    # Set title
    # plt.title('Combined User Activity Timeline\nIn-depth and Broad Tasks Comparison', 
            #  fontsize=16, pad=20)
    
    # Add legend
    plt.legend(handles=legend_elements, 
              loc='upper right',
              fontsize=12,
              framealpha=0.9,
              edgecolor='gray',
              facecolor='white',
              borderpad=1)
    
    # Add horizontal lines to separate task types
    plt.axhline(y=total_participants + 0.25, color='gray',  # Adjust separator line position
                linestyle='--', alpha=0.5, linewidth=2)
    
    # Adjust layout
    plt.tight_layout()
    
    return plt

# Load and process logs
filenames = [
    'user-behavior-logs-2025-01-17-16-57-46.csv',  # P1_B
    'user-behavior-logs-2025-01-17-17-15-59.csv',  # P1_I
    'user-behavior-logs-2025-01-17-18-04-16.csv',  # P2_I
    'user-behavior-logs-2025-01-17-18-41-38.csv',  # P2_B
    'user-behavior-logs-2025-01-19-10-49-06.csv',  # P3_I
    'user-behavior-logs-2025-01-19-11-34-35.csv',  # P3_B
    'user-behavior-logs-2025-01-19-16-35-44.csv',  # P4_I
    'user-behavior-logs-2025-01-19-17-12-26.csv',  # P4_B
    'user-behavior-logs-2025-01-19-22-03-42.csv',  # P5_I
    'user-behavior-logs-2025-01-19-22-28-55.csv'   # P5_B
]

# Define mapping for task types
task_mapping = {
    'user-behavior-logs-2025-01-17-16-57-46.csv': 'P1_B',
    'user-behavior-logs-2025-01-17-17-15-59.csv': 'P1_I',
    'user-behavior-logs-2025-01-17-18-04-16.csv': 'P2_I',
    'user-behavior-logs-2025-01-17-18-41-38.csv': 'P2_B',
    'user-behavior-logs-2025-01-19-10-49-06.csv': 'P3_I',
    'user-behavior-logs-2025-01-19-11-34-35.csv': 'P3_B',
    'user-behavior-logs-2025-01-19-16-35-44.csv': 'P4_I',
    'user-behavior-logs-2025-01-19-17-12-26.csv': 'P4_B',
    'user-behavior-logs-2025-01-19-22-03-42.csv': 'P5_I',
    'user-behavior-logs-2025-01-19-22-28-55.csv': 'P5_B'
}

processed_logs = {}
for filename in filenames:
    task_type = task_mapping[filename].split('_')[1]  # Get task type (B or I)
    if task_mapping.get(filename) == 'P4_B':
        print(f"\nStarting to process P4 Broad task file: {filename}")
    processed_logs[filename] = load_and_process_log(filename, task_type=task_type)
    if task_mapping.get(filename) == 'P4_B':
        print("\nP4 Broad task data after processing:")
        df = processed_logs[filename]
        task_actions = df[df['Action'] == 'new_task_description_create_btn_clicked']
        print("Task creation actions in final processed data:")
        print(task_actions[['Local Time', 'timestamp', 'Action', 'relative_time']])
        print("\n" + "="*50 + "\n")

# Generate visualizations
timeline_plt_B = plot_session_timeline(processed_logs, 'B', task_mapping)
timeline_plt_B.savefig('timeline_broad.png')
plt.close()

timeline_plt_I = plot_session_timeline(processed_logs, 'I', task_mapping)
timeline_plt_I.savefig('timeline_indepth.png')
plt.close()

# Generate combined timeline
timeline_plt_all = plot_combined_timeline(processed_logs, task_mapping)
timeline_plt_all.savefig('timeline_all.png')
plt.close()

# Generate overall transition heatmap
heatmap_plt = plot_transition_heatmap(processed_logs)
heatmap_plt.savefig('transition_heatmap.png')
plt.close()
plt.close()