/**
 * Moss Toolbox Plugin — Main Entry Point
 *
 * Renders the toolbox tab in CloudCLI's sidebar.
 * Contains: Toolbox panel, Smart suggestions, Welcome page, Skill creation.
 */

import React, { useState, useEffect, useCallback } from 'react';
import { ToolboxPanel } from './ToolboxPanel.jsx';
import { WelcomePage } from './WelcomePage.jsx';
import { SuggestionBar } from './SuggestionBar.jsx';
import { CreateSkillDialog } from './CreateSkillDialog.jsx';

const API_BASE = '/api/plugins/moss-toolbox/rpc';

export default function MossToolbox({ context }) {
  const [toolboxData, setToolboxData] = useState(null);
  const [showToolbox, setShowToolbox] = useState(false);
  const [showCreateSkill, setShowCreateSkill] = useState(false);
  const [loading, setLoading] = useState(true);

  // Fetch toolbox data on mount
  useEffect(() => {
    fetchToolboxData();
  }, []);

  const fetchToolboxData = useCallback(async () => {
    try {
      setLoading(true);
      const res = await fetch(`${API_BASE}/toolbox`);
      if (res.ok) {
        const data = await res.json();
        setToolboxData(data);
      }
    } catch (err) {
      console.error('[moss-toolbox] Failed to fetch toolbox data:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  // Handle skill/action click — inject prompt into chat
  const handleActionClick = useCallback((prompt) => {
    if (context && context.sendMessage) {
      context.sendMessage(prompt);
    } else {
      // Fallback: dispatch custom event for CloudCLI to handle
      window.dispatchEvent(new CustomEvent('moss-inject-prompt', {
        detail: { prompt },
      }));
    }
  }, [context]);

  const handleDeleteSkill = useCallback(async (skillId) => {
    try {
      const res = await fetch(`${API_BASE}/skills/personal/${skillId}`, {
        method: 'DELETE',
      });
      if (res.ok) {
        fetchToolboxData(); // Refresh
      }
    } catch (err) {
      console.error('[moss-toolbox] Failed to delete skill:', err);
    }
  }, [fetchToolboxData]);

  const handleShareSkill = useCallback(async (skillId) => {
    try {
      const res = await fetch(`${API_BASE}/skills/share`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ skillId }),
      });
      if (res.ok) {
        alert('技能已提交审核，管理员审核通过后将对全公司开放。');
      }
    } catch (err) {
      console.error('[moss-toolbox] Failed to share skill:', err);
    }
  }, []);

  if (loading) {
    return (
      <div className="moss-loading">
        <div className="moss-spinner" />
        <p>加载工具箱...</p>
      </div>
    );
  }

  return (
    <div className="moss-toolbox-root">
      <style>{styles}</style>

      {/* Toolbox Panel */}
      <ToolboxPanel
        categories={toolboxData?.categories || []}
        personalSkills={toolboxData?.personalSkills || []}
        onActionClick={handleActionClick}
        onDeleteSkill={handleDeleteSkill}
        onShareSkill={handleShareSkill}
        onCreateSkill={() => setShowCreateSkill(true)}
        onRefresh={fetchToolboxData}
      />

      {/* Create Skill Dialog */}
      {showCreateSkill && (
        <CreateSkillDialog
          onClose={() => setShowCreateSkill(false)}
          onActionClick={handleActionClick}
        />
      )}
    </div>
  );
}

const styles = `
  .moss-toolbox-root {
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    height: 100%;
    overflow-y: auto;
    padding: 12px;
    color: var(--text-primary, #e4e4e7);
    background: var(--bg-primary, #18181b);
  }

  .moss-loading {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    height: 200px;
    color: var(--text-secondary, #a1a1aa);
  }

  .moss-spinner {
    width: 24px;
    height: 24px;
    border: 2px solid var(--border-color, #3f3f46);
    border-top-color: var(--accent-color, #8b5cf6);
    border-radius: 50%;
    animation: spin 0.6s linear infinite;
    margin-bottom: 8px;
  }

  @keyframes spin {
    to { transform: rotate(360deg); }
  }
`;
