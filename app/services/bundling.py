"""
app/services/bundling.py

This module provides logic to bundle maintenance tasks that occur in the same section
and around the same time.

It contains two methods:
1. find_bundle_candidates (Pairwise): The baseline gap-check that finds bundle candidates 
   two tasks at a time. It works but doesn't naturally group 3+ tasks that are all close 
   together into one combined bundle — it only ever returns pairs.
2. find_bundle_candidates_dbscan (DBSCAN): A machine-learning approach using DBSCAN.
   DBSCAN correctly groups chains of 3+ nearby tasks in one pass, where the pairwise 
   check only finds overlapping pairs.
"""

from typing import List, Dict, Any
from collections import defaultdict
import numpy as np
from sklearn.cluster import DBSCAN

def find_bundle_candidates(tasks: List[Dict[str, Any]], gap_threshold: int = 30) -> List[Dict[str, Any]]:
    """
    Baseline pairwise gap-check algorithm.
    Input format: list of {task_id, section, start_minute, end_minute}
    Returns list of dicts: {section, task_ids: [...], bundle_duration_minutes, downtime_saved_minutes}
    """
    bundles = []
    
    # Group by section
    by_section = defaultdict(list)
    for t in tasks:
        by_section[t["section"]].append(t)
        
    for section, sec_tasks in by_section.items():
        # Sort tasks by start_minute
        sec_tasks.sort(key=lambda x: x["start_minute"])
        
        # Check adjacent pairs
        for i in range(len(sec_tasks) - 1):
            t1 = sec_tasks[i]
            t2 = sec_tasks[i+1]
            
            # If distance between start times <= threshold, form a pair
            if abs(t2["start_minute"] - t1["start_minute"]) <= gap_threshold:
                dur1 = t1["end_minute"] - t1["start_minute"]
                dur2 = t2["end_minute"] - t2["start_minute"]
                
                bundle_duration = max(dur1, dur2)
                downtime_saved = (dur1 + dur2) - bundle_duration
                
                bundles.append({
                    "section": section,
                    "task_ids": [t1["task_id"], t2["task_id"]],
                    "bundle_duration_minutes": bundle_duration,
                    "downtime_saved_minutes": downtime_saved
                })
                
    return bundles


def find_bundle_candidates_dbscan(tasks: List[Dict[str, Any]], eps: int = 30, min_samples: int = 2) -> List[Dict[str, Any]]:
    """
    DBSCAN clustering algorithm for finding 3+ task bundles in one pass.
    Input format: list of {task_id, section, start_minute, end_minute}
    Returns list of dicts: {section, task_ids: [...], bundle_duration_minutes, downtime_saved_minutes}
    """
    if not tasks:
        return []
        
    bundles = []
    
    # Group by section
    by_section = defaultdict(list)
    for t in tasks:
        by_section[t["section"]].append(t)
        
    for section, sec_tasks in by_section.items():
        if len(sec_tasks) < min_samples:
            continue
            
        # Extract 1D features (start_minute)
        # Reshape to 2D array (N, 1) as required by sklearn
        X = np.array([t["start_minute"] for t in sec_tasks]).reshape(-1, 1)
        
        # Run DBSCAN
        db = DBSCAN(eps=eps, min_samples=min_samples).fit(X)
        labels = db.labels_
        
        # Group tasks by their assigned cluster label
        clusters = defaultdict(list)
        for i, label in enumerate(labels):
            if label != -1: # Ignore noise
                clusters[label].append(sec_tasks[i])
                
        # Process each cluster
        for label, cluster_tasks in clusters.items():
            durations = [t["end_minute"] - t["start_minute"] for t in cluster_tasks]
            
            bundle_duration = max(durations)
            downtime_saved = sum(durations) - bundle_duration
            
            bundles.append({
                "section": section,
                "task_ids": [t["task_id"] for t in cluster_tasks],
                "bundle_duration_minutes": bundle_duration,
                "downtime_saved_minutes": downtime_saved
            })
            
    return bundles
