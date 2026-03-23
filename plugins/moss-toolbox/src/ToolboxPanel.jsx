/**
 * Moss Toolbox Panel — Browsable skill catalog
 *
 * Organized by business scenario (not technical concepts).
 * Users see "数据分析", "趋势预测", etc. — never slash commands.
 */

import React, { useState, useMemo } from 'react';

export function ToolboxPanel({
  categories,
  personalSkills,
  onActionClick,
  onDeleteSkill,
  onShareSkill,
  onCreateSkill,
  onRefresh,
}) {
  const [searchQuery, setSearchQuery] = useState('');
  const [expandedCategories, setExpandedCategories] = useState(
    new Set(categories.map(c => c.id))
  );

  // Fuzzy search across all skills
  const filteredCategories = useMemo(() => {
    if (!searchQuery.trim()) return categories;

    const query = searchQuery.toLowerCase();
    return categories
      .map(cat => ({
        ...cat,
        items: cat.items.filter(item =>
          item.display_name.toLowerCase().includes(query) ||
          item.description.toLowerCase().includes(query) ||
          (item.suggest_keywords || []).some(kw => kw.toLowerCase().includes(query))
        ),
      }))
      .filter(cat => cat.items.length > 0);
  }, [categories, searchQuery]);

  const filteredPersonalSkills = useMemo(() => {
    if (!searchQuery.trim()) return personalSkills;
    const query = searchQuery.toLowerCase();
    return personalSkills.filter(s =>
      s.name.toLowerCase().includes(query) ||
      (s.description || '').toLowerCase().includes(query)
    );
  }, [personalSkills, searchQuery]);

  const toggleCategory = (catId) => {
    setExpandedCategories(prev => {
      const next = new Set(prev);
      if (next.has(catId)) next.delete(catId);
      else next.add(catId);
      return next;
    });
  };

  return (
    <div className="toolbox-panel">
      <style>{toolboxStyles}</style>

      {/* Header */}
      <div className="toolbox-header">
        <h2>🧰 工具箱</h2>
        <button className="toolbox-refresh" onClick={onRefresh} title="刷新">
          🔄
        </button>
      </div>

      {/* Search */}
      <div className="toolbox-search">
        <input
          type="text"
          placeholder="🔍 搜索工具..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
        />
      </div>

      {/* Personal Skills Section */}
      {(filteredPersonalSkills.length > 0 || !searchQuery) && (
        <div className="toolbox-section">
          <div
            className="toolbox-section-header personal"
            onClick={() => toggleCategory('__personal__')}
          >
            <span>⭐ 我的技能 ({personalSkills.length})</span>
            <button
              className="toolbox-create-btn"
              onClick={(e) => { e.stopPropagation(); onCreateSkill(); }}
              title="创建新技能"
            >
              + 创建
            </button>
          </div>

          {expandedCategories.has('__personal__') !== false && (
            <div className="toolbox-items-grid">
              {filteredPersonalSkills.map(skill => (
                <div key={skill.id} className="toolbox-item personal-skill">
                  <div
                    className="toolbox-item-main"
                    onClick={() => onActionClick(`使用我的"${skill.name}"技能来处理`)}
                  >
                    <span className="toolbox-item-icon">⭐</span>
                    <div className="toolbox-item-text">
                      <span className="toolbox-item-name">{skill.name}</span>
                      {skill.description && (
                        <span className="toolbox-item-desc">{skill.description}</span>
                      )}
                    </div>
                  </div>
                  <div className="toolbox-item-actions">
                    <button
                      onClick={(e) => { e.stopPropagation(); onShareSkill(skill.id); }}
                      title="分享给团队"
                    >
                      📤
                    </button>
                    <button
                      onClick={(e) => { e.stopPropagation(); onDeleteSkill(skill.id); }}
                      title="删除"
                    >
                      🗑
                    </button>
                  </div>
                </div>
              ))}

              {filteredPersonalSkills.length === 0 && !searchQuery && (
                <div className="toolbox-empty-personal">
                  💡 告诉 AI "帮我把这个分析流程做成一个可重复的工具" 就能创建你自己的技能
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Shared Skill Categories */}
      {filteredCategories.map(category => (
        <div key={category.id} className="toolbox-section">
          <div
            className="toolbox-section-header"
            onClick={() => toggleCategory(category.id)}
          >
            <span>{category.icon} {category.name}</span>
            <span className="toolbox-chevron">
              {expandedCategories.has(category.id) ? '▼' : '▶'}
            </span>
          </div>

          {expandedCategories.has(category.id) && (
            <div className="toolbox-items-list">
              {category.items.map(item => (
                <div
                  key={item.skill}
                  className="toolbox-item"
                  onClick={() => onActionClick(item.prompt_template)}
                  title={item.description}
                >
                  <span className="toolbox-item-icon">{item.icon}</span>
                  <div className="toolbox-item-text">
                    <span className="toolbox-item-name">{item.display_name}</span>
                    <span className="toolbox-item-desc">{item.description}</span>
                  </div>
                  {item.trigger === 'auto+manual' && (
                    <span className="toolbox-auto-badge" title="可自动触发">⚡</span>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

const toolboxStyles = `
  .toolbox-panel {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

  .toolbox-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding-bottom: 8px;
    border-bottom: 1px solid var(--border-color, #3f3f46);
  }

  .toolbox-header h2 {
    font-size: 16px;
    font-weight: 600;
    margin: 0;
  }

  .toolbox-refresh {
    background: none;
    border: none;
    cursor: pointer;
    font-size: 14px;
    padding: 4px;
    border-radius: 4px;
    opacity: 0.6;
  }

  .toolbox-refresh:hover {
    opacity: 1;
    background: var(--bg-hover, #27272a);
  }

  .toolbox-search input {
    width: 100%;
    padding: 8px 12px;
    border: 1px solid var(--border-color, #3f3f46);
    border-radius: 6px;
    background: var(--bg-secondary, #27272a);
    color: var(--text-primary, #e4e4e7);
    font-size: 13px;
    outline: none;
  }

  .toolbox-search input:focus {
    border-color: var(--accent-color, #8b5cf6);
  }

  .toolbox-section {
    border: 1px solid var(--border-color, #3f3f46);
    border-radius: 8px;
    overflow: hidden;
  }

  .toolbox-section-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 10px 12px;
    background: var(--bg-secondary, #27272a);
    cursor: pointer;
    font-size: 14px;
    font-weight: 500;
    user-select: none;
  }

  .toolbox-section-header:hover {
    background: var(--bg-hover, #3f3f46);
  }

  .toolbox-section-header.personal {
    background: linear-gradient(135deg, #27272a, #1e1b4b);
  }

  .toolbox-chevron {
    font-size: 10px;
    color: var(--text-secondary, #a1a1aa);
  }

  .toolbox-create-btn {
    background: var(--accent-color, #8b5cf6);
    color: white;
    border: none;
    padding: 4px 10px;
    border-radius: 4px;
    font-size: 12px;
    cursor: pointer;
  }

  .toolbox-create-btn:hover {
    opacity: 0.9;
  }

  .toolbox-items-list,
  .toolbox-items-grid {
    padding: 4px;
  }

  .toolbox-item {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 8px 12px;
    border-radius: 6px;
    cursor: pointer;
    transition: background 0.15s;
  }

  .toolbox-item:hover {
    background: var(--bg-hover, #27272a);
  }

  .toolbox-item.personal-skill {
    justify-content: space-between;
  }

  .toolbox-item-main {
    display: flex;
    align-items: center;
    gap: 10px;
    flex: 1;
    cursor: pointer;
  }

  .toolbox-item-icon {
    font-size: 20px;
    flex-shrink: 0;
    width: 28px;
    text-align: center;
  }

  .toolbox-item-text {
    display: flex;
    flex-direction: column;
    gap: 2px;
    min-width: 0;
  }

  .toolbox-item-name {
    font-size: 13px;
    font-weight: 500;
    color: var(--text-primary, #e4e4e7);
  }

  .toolbox-item-desc {
    font-size: 11px;
    color: var(--text-secondary, #a1a1aa);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .toolbox-auto-badge {
    font-size: 12px;
    opacity: 0.5;
  }

  .toolbox-item-actions {
    display: flex;
    gap: 4px;
    opacity: 0;
    transition: opacity 0.15s;
  }

  .toolbox-item:hover .toolbox-item-actions {
    opacity: 1;
  }

  .toolbox-item-actions button {
    background: none;
    border: none;
    cursor: pointer;
    font-size: 12px;
    padding: 2px 4px;
    border-radius: 3px;
  }

  .toolbox-item-actions button:hover {
    background: var(--bg-hover, #3f3f46);
  }

  .toolbox-empty-personal {
    padding: 12px;
    font-size: 12px;
    color: var(--text-secondary, #a1a1aa);
    text-align: center;
    line-height: 1.5;
  }
`;
