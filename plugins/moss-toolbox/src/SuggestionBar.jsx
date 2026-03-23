/**
 * Moss Smart Suggestion Bar — Context-aware floating suggestions
 *
 * Appears between the last message and the chat input.
 * Shows 3-4 suggestion chips based on:
 * - File upload events (.xlsx/.csv → suggest analysis)
 * - User message keywords (预测/趋势 → suggest forecast)
 * - Agent completion (analysis done → suggest export/report)
 * - Conversation context
 */

import React, { useState, useEffect, useMemo } from 'react';

const API_BASE = '/api/plugins/moss-toolbox/rpc';

/**
 * Suggestion engine — matches rules against current context
 */
function matchSuggestions(rules, context) {
  const matched = [];

  for (const rule of rules) {
    if (rule.trigger === 'file_upload' && context.uploadedFileType) {
      const ext = context.uploadedFileType.toLowerCase();
      if ((rule.file_types || []).some(ft => ext.endsWith(ft))) {
        matched.push(...(rule.suggestions || []));
      }
    }

    if (rule.trigger === 'keywords' && context.lastUserMessage) {
      const msg = context.lastUserMessage.toLowerCase();
      if ((rule.keywords || []).some(kw => msg.includes(kw.toLowerCase()))) {
        matched.push(...(rule.suggestions || []));
      }
    }

    if (rule.trigger === 'analysis_complete' && context.analysisComplete) {
      matched.push(...(rule.suggestions || []));
    }
  }

  // Deduplicate by skill name, limit to 4
  const seen = new Set();
  return matched.filter(s => {
    if (seen.has(s.skill)) return false;
    seen.add(s.skill);
    return true;
  }).slice(0, 4);
}

export function SuggestionBar({ context, onActionClick }) {
  const [rules, setRules] = useState([]);
  const [chatContext, setChatContext] = useState({
    lastUserMessage: '',
    uploadedFileType: null,
    analysisComplete: false,
  });

  // Load suggestion rules
  useEffect(() => {
    fetch(`${API_BASE}/suggestions`)
      .then(res => res.json())
      .then(data => setRules(data.rules || []))
      .catch(err => console.error('[moss-suggestions] Failed to load rules:', err));
  }, []);

  // Listen for context changes
  useEffect(() => {
    const handleMessage = (event) => {
      const { type, data } = event.detail || {};

      if (type === 'user_message') {
        setChatContext(prev => ({
          ...prev,
          lastUserMessage: data.content || '',
          analysisComplete: false,
        }));
      }

      if (type === 'file_upload') {
        setChatContext(prev => ({
          ...prev,
          uploadedFileType: data.fileName || '',
        }));
      }

      if (type === 'agent_complete') {
        setChatContext(prev => ({
          ...prev,
          analysisComplete: true,
        }));
      }
    };

    window.addEventListener('moss-chat-context', handleMessage);
    return () => window.removeEventListener('moss-chat-context', handleMessage);
  }, []);

  const suggestions = useMemo(
    () => matchSuggestions(rules, chatContext),
    [rules, chatContext]
  );

  if (suggestions.length === 0) return null;

  return (
    <div className="suggestion-bar">
      <style>{suggestionStyles}</style>
      <span className="suggestion-label">💡 你可能想要:</span>
      <div className="suggestion-chips">
        {suggestions.map((suggestion, idx) => (
          <button
            key={idx}
            className="suggestion-chip"
            onClick={() => {
              // Find the corresponding toolbox item for this skill
              onActionClick(suggestion.label);
              // Clear suggestions after click
              setChatContext(prev => ({
                ...prev,
                lastUserMessage: '',
                uploadedFileType: null,
                analysisComplete: false,
              }));
            }}
          >
            {suggestion.icon} {suggestion.label}
          </button>
        ))}
      </div>
    </div>
  );
}

const suggestionStyles = `
  .suggestion-bar {
    display: flex;
    flex-direction: column;
    gap: 8px;
    padding: 12px 16px;
    background: var(--bg-secondary, #27272a);
    border: 1px solid var(--border-color, #3f3f46);
    border-radius: 10px;
    margin: 8px 0;
    animation: slideUp 0.2s ease-out;
  }

  @keyframes slideUp {
    from {
      opacity: 0;
      transform: translateY(8px);
    }
    to {
      opacity: 1;
      transform: translateY(0);
    }
  }

  .suggestion-label {
    font-size: 12px;
    color: var(--text-secondary, #a1a1aa);
  }

  .suggestion-chips {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
  }

  .suggestion-chip {
    padding: 6px 14px;
    border: 1px solid var(--border-color, #3f3f46);
    border-radius: 16px;
    background: var(--bg-primary, #18181b);
    color: var(--text-primary, #e4e4e7);
    font-size: 13px;
    cursor: pointer;
    transition: all 0.15s;
    white-space: nowrap;
  }

  .suggestion-chip:hover {
    border-color: var(--accent-color, #8b5cf6);
    background: rgba(139, 92, 246, 0.1);
    color: var(--accent-color, #8b5cf6);
  }
`;
