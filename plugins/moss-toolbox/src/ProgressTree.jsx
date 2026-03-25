/**
 * Moss Progress Tree — Execution progress visualization
 *
 * Renders a nested task tree showing what the agent is doing.
 * Users see "数据清洗 ✅" instead of raw terminal output.
 * Sub-agent spawns show as parallel branches.
 */

import React, { useState } from 'react';
import { useTranslation } from './i18n.js';

/**
 * Task node statuses
 */
const STATUS = {
  PENDING: 'pending',
  RUNNING: 'running',
  COMPLETE: 'complete',
  ERROR: 'error',
};

const STATUS_ICONS = {
  [STATUS.PENDING]: '⏳',
  [STATUS.RUNNING]: '⏳',
  [STATUS.COMPLETE]: '✅',
  [STATUS.ERROR]: '❌',
};

/**
 * Single task node in the progress tree
 */
function TaskNode({ task, depth = 0 }) {
  const [expanded, setExpanded] = useState(true);
  const hasChildren = task.children && task.children.length > 0;

  return (
    <div className="task-node" style={{ marginLeft: depth * 16 }}>
      <div className="task-node-header" onClick={() => hasChildren && setExpanded(!expanded)}>
        <span className="task-node-connector">
          {depth > 0 ? '├─ ' : ''}
        </span>
        <span className="task-node-status">
          {task.status === STATUS.RUNNING ? (
            <span className="task-spinner" />
          ) : (
            STATUS_ICONS[task.status] || '⏳'
          )}
        </span>
        <span className="task-node-name">{task.name}</span>
        {task.duration && (
          <span className="task-node-duration">({task.duration})</span>
        )}
        {hasChildren && (
          <span className="task-node-toggle">{expanded ? '▼' : '▶'}</span>
        )}
      </div>

      {task.detail && (
        <div className="task-node-detail">
          └─ {task.detail}
        </div>
      )}

      {task.status === STATUS.RUNNING && task.progress != null && (
        <div className="task-progress-bar">
          <div
            className="task-progress-fill"
            style={{ width: `${task.progress}%` }}
          />
        </div>
      )}

      {expanded && hasChildren && (
        <div className="task-children">
          {task.children.map((child, idx) => (
            <TaskNode key={idx} task={child} depth={depth + 1} />
          ))}
        </div>
      )}
    </div>
  );
}

/**
 * Task tree container with header
 */
export function TaskTree({ title, tasks, skills }) {
  const { t } = useTranslation();
  const [collapsed, setCollapsed] = useState(false);

  if (!tasks || tasks.length === 0) return null;

  return (
    <div className="task-tree">
      <style>{treeStyles}</style>

      <div className="task-tree-header" onClick={() => setCollapsed(!collapsed)}>
        <span>🔄 {title || t('progress.running_default')}</span>
        <span className="task-tree-toggle">{collapsed ? '▶' : '▼'}</span>
      </div>

      {!collapsed && (
        <>
          <div className="task-tree-body">
            {tasks.map((task, idx) => (
              <TaskNode key={idx} task={task} />
            ))}
          </div>

          {skills && skills.length > 0 && (
            <SkillBadges skills={skills} />
          )}
        </>
      )}
    </div>
  );
}

/**
 * Skill badges — shows which skills are being used (collapsible)
 */
export function SkillBadges({ skills }) {
  const { t } = useTranslation();
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="skill-badges">
      <div
        className="skill-badges-header"
        onClick={() => setExpanded(!expanded)}
      >
        {t('progress.skills_used', { count: skills.length })} {expanded ? '▼' : '▶'}
      </div>

      {expanded && (
        <div className="skill-badges-list">
          {skills.map((skill, idx) => (
            <div key={idx} className="skill-badge-item">
              <span className="skill-badge-icon">{skill.icon || '⚙'}</span>
              <span className="skill-badge-name">{skill.name}</span>
              <span className="skill-badge-trigger">
                {skill.autoTriggered ? t('progress.auto_triggered') : t('progress.user_selected')}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

const treeStyles = `
  .task-tree {
    border: 1px solid var(--border-color, #3f3f46);
    border-radius: 10px;
    overflow: hidden;
    margin: 8px 0;
    font-size: 13px;
  }

  .task-tree-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 10px 14px;
    background: var(--bg-secondary, #27272a);
    cursor: pointer;
    font-weight: 500;
    user-select: none;
  }

  .task-tree-toggle {
    font-size: 10px;
    color: var(--text-secondary, #a1a1aa);
  }

  .task-tree-body {
    padding: 8px 14px;
  }

  .task-node {
    margin: 4px 0;
  }

  .task-node-header {
    display: flex;
    align-items: center;
    gap: 6px;
    cursor: default;
  }

  .task-node-connector {
    color: var(--text-secondary, #a1a1aa);
    font-family: monospace;
    font-size: 12px;
  }

  .task-node-status {
    flex-shrink: 0;
    font-size: 12px;
  }

  .task-spinner {
    display: inline-block;
    width: 12px;
    height: 12px;
    border: 2px solid var(--border-color, #3f3f46);
    border-top-color: var(--accent-color, #8b5cf6);
    border-radius: 50%;
    animation: spin 0.6s linear infinite;
  }

  .task-node-name {
    color: var(--text-primary, #e4e4e7);
  }

  .task-node-duration {
    color: var(--text-secondary, #a1a1aa);
    font-size: 12px;
  }

  .task-node-toggle {
    font-size: 10px;
    color: var(--text-secondary, #a1a1aa);
    cursor: pointer;
  }

  .task-node-detail {
    margin-left: 32px;
    font-size: 12px;
    color: var(--text-secondary, #a1a1aa);
    font-family: monospace;
  }

  .task-progress-bar {
    margin-left: 32px;
    margin-top: 4px;
    height: 4px;
    background: var(--border-color, #3f3f46);
    border-radius: 2px;
    overflow: hidden;
    max-width: 200px;
  }

  .task-progress-fill {
    height: 100%;
    background: var(--accent-color, #8b5cf6);
    border-radius: 2px;
    transition: width 0.3s ease;
  }

  .task-children {
    margin-left: 8px;
  }

  /* Skill Badges */
  .skill-badges {
    border-top: 1px solid var(--border-color, #3f3f46);
    font-size: 12px;
  }

  .skill-badges-header {
    padding: 8px 14px;
    color: var(--text-secondary, #a1a1aa);
    cursor: pointer;
    user-select: none;
  }

  .skill-badges-header:hover {
    color: var(--text-primary, #e4e4e7);
  }

  .skill-badges-list {
    padding: 0 14px 8px;
  }

  .skill-badge-item {
    display: flex;
    align-items: center;
    gap: 6px;
    padding: 4px 0;
  }

  .skill-badge-icon {
    font-size: 14px;
  }

  .skill-badge-name {
    color: var(--text-primary, #e4e4e7);
  }

  .skill-badge-trigger {
    color: var(--text-secondary, #a1a1aa);
    font-size: 11px;
  }
`;
