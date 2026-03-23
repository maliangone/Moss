/**
 * Moss Welcome Page — Empty state / onboarding for new conversations
 *
 * Shows quick-start action cards + personal skill shortcuts.
 * Designed for non-technical users who don't know what AI can do.
 */

import React, { useState, useEffect } from 'react';

const API_BASE = '/api/plugins/moss-toolbox/rpc';

export function WelcomePage({ onActionClick }) {
  const [data, setData] = useState(null);

  useEffect(() => {
    fetch(`${API_BASE}/welcome`)
      .then(res => res.json())
      .then(setData)
      .catch(err => console.error('[moss-welcome] Failed to load:', err));
  }, []);

  if (!data) return null;

  return (
    <div className="welcome-root">
      <style>{welcomeStyles}</style>

      <div className="welcome-hero">
        <h1>🤖 你好！我是你的 AI 分析助手</h1>
        <p>告诉我你想做什么，或者选择一个快速任务：</p>
      </div>

      {/* Quick Action Cards */}
      <div className="welcome-actions">
        {(data.actions || []).map((action, idx) => (
          <div
            key={idx}
            className="welcome-action-card"
            onClick={() => onActionClick(action.prompt)}
          >
            <span className="welcome-action-icon">{action.icon}</span>
            <div className="welcome-action-text">
              <strong>{action.title}</strong>
              <span>{action.description}</span>
            </div>
          </div>
        ))}
      </div>

      {/* Personal Skills Shortcuts */}
      {data.personalSkills && data.personalSkills.length > 0 && (
        <div className="welcome-personal">
          <h3>⭐ 我的技能 ({data.personalSkills.length}个)</h3>
          <div className="welcome-skill-chips">
            {data.personalSkills.map(skill => (
              <button
                key={skill.id}
                className="welcome-skill-chip"
                onClick={() => onActionClick(`使用我的"${skill.name}"技能`)}
              >
                {skill.name}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Skill Creation Hint */}
      <div className="welcome-hint">
        🛠 把你经常重复的工作告诉我，我帮你做成一键触发的专属工具
      </div>

      {/* Example Prompt */}
      <div className="welcome-example">
        💡 或者直接告诉我：
        <button
          className="welcome-example-prompt"
          onClick={() => onActionClick('帮我分析上个月的销售数据，找出下降最多的产品线')}
        >
          "帮我分析上个月的销售数据，找出下降最多的产品线"
        </button>
      </div>
    </div>
  );
}

const welcomeStyles = `
  .welcome-root {
    display: flex;
    flex-direction: column;
    align-items: center;
    padding: 40px 20px;
    max-width: 640px;
    margin: 0 auto;
    gap: 24px;
  }

  .welcome-hero {
    text-align: center;
  }

  .welcome-hero h1 {
    font-size: 22px;
    font-weight: 600;
    margin: 0 0 8px 0;
    color: var(--text-primary, #e4e4e7);
  }

  .welcome-hero p {
    font-size: 14px;
    color: var(--text-secondary, #a1a1aa);
    margin: 0;
  }

  .welcome-actions {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 12px;
    width: 100%;
  }

  .welcome-action-card {
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 16px;
    border: 1px solid var(--border-color, #3f3f46);
    border-radius: 10px;
    cursor: pointer;
    transition: all 0.15s;
    background: var(--bg-secondary, #27272a);
  }

  .welcome-action-card:hover {
    border-color: var(--accent-color, #8b5cf6);
    background: var(--bg-hover, #2e2e35);
    transform: translateY(-1px);
  }

  .welcome-action-icon {
    font-size: 28px;
    flex-shrink: 0;
  }

  .welcome-action-text {
    display: flex;
    flex-direction: column;
    gap: 4px;
  }

  .welcome-action-text strong {
    font-size: 14px;
    color: var(--text-primary, #e4e4e7);
  }

  .welcome-action-text span {
    font-size: 12px;
    color: var(--text-secondary, #a1a1aa);
  }

  .welcome-personal {
    width: 100%;
  }

  .welcome-personal h3 {
    font-size: 14px;
    font-weight: 500;
    margin: 0 0 8px 0;
    color: var(--text-secondary, #a1a1aa);
  }

  .welcome-skill-chips {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
  }

  .welcome-skill-chip {
    padding: 6px 14px;
    border: 1px solid var(--border-color, #3f3f46);
    border-radius: 16px;
    background: var(--bg-secondary, #27272a);
    color: var(--text-primary, #e4e4e7);
    font-size: 13px;
    cursor: pointer;
    transition: all 0.15s;
  }

  .welcome-skill-chip:hover {
    border-color: var(--accent-color, #8b5cf6);
    background: var(--bg-hover, #2e2e35);
  }

  .welcome-hint {
    font-size: 13px;
    color: var(--text-secondary, #a1a1aa);
    text-align: center;
    padding: 12px;
    background: var(--bg-secondary, #27272a);
    border-radius: 8px;
    width: 100%;
  }

  .welcome-example {
    font-size: 13px;
    color: var(--text-secondary, #a1a1aa);
    text-align: center;
  }

  .welcome-example-prompt {
    display: block;
    margin-top: 8px;
    padding: 10px 16px;
    background: none;
    border: 1px dashed var(--border-color, #3f3f46);
    border-radius: 8px;
    color: var(--accent-color, #8b5cf6);
    font-size: 13px;
    cursor: pointer;
    transition: all 0.15s;
  }

  .welcome-example-prompt:hover {
    border-color: var(--accent-color, #8b5cf6);
    background: rgba(139, 92, 246, 0.05);
  }
`;
