#!/usr/bin/env python3
"""
merge_tasks.py

Appends tasks from .taskmaster/tasks/tasks-temp.json into
.taskmaster/tasks/tasks.json and updates metadata.

Usage:
  python scripts/merge_tasks.py
"""

import json
import sys
from datetime import datetime, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
TASKS_FILE = ROOT / ".taskmaster/tasks/tasks.json"
TEMP_FILE  = ROOT / ".taskmaster/tasks/tasks-temp.json"
DONE_FILE  = ROOT / ".taskmaster/tasks/tasks-temp.merged.json"

if not TEMP_FILE.exists():
    sys.exit(f"ERROR: {TEMP_FILE} not found.")

main_data = json.loads(TASKS_FILE.read_text(encoding="utf-8"))
temp_data = json.loads(TEMP_FILE.read_text(encoding="utf-8"))

# Support both {"master": {"tasks": [...]}} and {"tasks": [...]} formats
if "master" in main_data:
    existing = main_data["master"]["tasks"]
else:
    # Wrap flat format into master structure
    main_data = {"master": {"tasks": main_data.get("tasks", []), "metadata": {}}}
    existing = main_data["master"]["tasks"]

incoming = temp_data.get("master", temp_data).get("tasks", temp_data.get("tasks", []))

merged = existing + incoming
completed = sum(1 for t in merged if t.get("status") == "done")

main_data["master"]["tasks"] = merged
main_data["master"].setdefault("metadata", {}).update({
    "lastModified":   datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%S.000Z"),
    "taskCount":      len(merged),
    "completedCount": completed,
})

TASKS_FILE.write_text(json.dumps(main_data, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
TEMP_FILE.rename(DONE_FILE)

print(f"Merged {len(incoming)} tasks. Total: {len(merged)} ({completed} done).")

