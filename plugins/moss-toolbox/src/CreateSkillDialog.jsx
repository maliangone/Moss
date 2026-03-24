/**
 * Moss Skill Creation Dialog — Let users create personal skills
 *
 * Three creation methods:
 * 1. Describe workflow in natural language (uses /skill-creator)
 * 2. Install from community skill marketplace
 * 3. Save current conversation as a reusable skill
 */

import React, { useState } from 'react';
import { useTranslation } from './i18n.js';

export function CreateSkillDialog({ onClose, onActionClick }) {
  const { t } = useTranslation();
  const [selectedMethod, setSelectedMethod] = useState(null);

  const methods = [
    {
      id: 'describe',
      icon: '💬',
      title: t('dialog.describe.title'),
      description: t('dialog.describe.description'),
      prompt: t('dialog.describe.prompt'),
    },
    {
      id: 'community',
      icon: '📦',
      title: t('dialog.community.title'),
      description: t('dialog.community.description'),
      prompt: t('dialog.community.prompt'),
    },
    {
      id: 'from-chat',
      icon: '📝',
      title: t('dialog.from_chat.title'),
      description: t('dialog.from_chat.description'),
      prompt: t('dialog.from_chat.prompt'),
    },
  ];

  const handleMethodClick = (method) => {
    onActionClick(method.prompt);
    onClose();
  };

  return (
    <div className="skill-dialog-overlay" onClick={onClose}>
      <style>{dialogStyles}</style>
      <div className="skill-dialog" onClick={e => e.stopPropagation()}>
        <div className="skill-dialog-header">
          <h2>{t('dialog.title')}</h2>
          <button className="skill-dialog-close" onClick={onClose}>{t('dialog.close')}</button>
        </div>

        <p className="skill-dialog-subtitle">{t('dialog.subtitle')}</p>

        <div className="skill-dialog-methods">
          {methods.map(method => (
            <div
              key={method.id}
              className="skill-method-card"
              onClick={() => handleMethodClick(method)}
            >
              <span className="skill-method-icon">{method.icon}</span>
              <div className="skill-method-text">
                <strong>{method.title}</strong>
                <span>{method.description}</span>
              </div>
              <span className="skill-method-arrow">→</span>
            </div>
          ))}
        </div>

        <div className="skill-dialog-hint">
          {t('dialog.hint')}
        </div>
      </div>
    </div>
  );
}

/**
 * Save Skill Prompt — Shown after Claude creates a skill
 * Asks user whether to save as permanent or session-only
 */
export function SaveSkillPrompt({ skillName, onSavePermanent, onSaveTemp, onDismiss }) {
  const { t } = useTranslation();
  return (
    <div className="save-skill-prompt">
      <style>{dialogStyles}</style>
      <div className="save-skill-header">
        {t('save.success', { skillName })}
      </div>

      <p className="save-skill-label">{t('save.save_as')}</p>

      <div className="save-skill-options">
        <div
          className="save-skill-option recommended"
          onClick={onSavePermanent}
        >
          <div className="save-skill-option-header">
            <span>{t('save.permanent')}</span>
          </div>
          <span className="save-skill-option-desc">
            {t('save.permanent_desc')}
          </span>
        </div>

        <div
          className="save-skill-option"
          onClick={onSaveTemp}
        >
          <div className="save-skill-option-header">
            <span>{t('save.temp')}</span>
          </div>
          <span className="save-skill-option-desc">
            {t('save.temp_desc')}
          </span>
        </div>
      </div>
    </div>
  );
}

/**
 * Share Skill Button — Renders inline in personal skill cards
 */
export function ShareSkillButton({ skillId, onShare }) {
  const { t } = useTranslation();
  const [shared, setShared] = useState(false);

  const handleShare = async () => {
    await onShare(skillId);
    setShared(true);
  };

  if (shared) {
    return <span className="share-skill-done">{t('share_btn.submitted')}</span>;
  }

  return (
    <button className="share-skill-btn" onClick={handleShare} title={t('share_btn.share_title')}>
      {t('share_btn.share')}
    </button>
  );
}

const dialogStyles = `
  .skill-dialog-overlay {
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background: rgba(0, 0, 0, 0.6);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 1000;
    animation: fadeIn 0.15s ease-out;
  }

  @keyframes fadeIn {
    from { opacity: 0; }
    to { opacity: 1; }
  }

  .skill-dialog {
    background: var(--bg-primary, #18181b);
    border: 1px solid var(--border-color, #3f3f46);
    border-radius: 12px;
    padding: 24px;
    max-width: 420px;
    width: 90%;
    animation: scaleIn 0.15s ease-out;
  }

  @keyframes scaleIn {
    from { transform: scale(0.95); opacity: 0; }
    to { transform: scale(1); opacity: 1; }
  }

  .skill-dialog-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 8px;
  }

  .skill-dialog-header h2 {
    font-size: 18px;
    font-weight: 600;
    margin: 0;
  }

  .skill-dialog-close {
    background: none;
    border: none;
    color: var(--text-secondary, #a1a1aa);
    font-size: 18px;
    cursor: pointer;
    padding: 4px 8px;
    border-radius: 4px;
  }

  .skill-dialog-close:hover {
    background: var(--bg-hover, #27272a);
  }

  .skill-dialog-subtitle {
    font-size: 14px;
    color: var(--text-secondary, #a1a1aa);
    margin: 0 0 16px 0;
  }

  .skill-dialog-methods {
    display: flex;
    flex-direction: column;
    gap: 10px;
  }

  .skill-method-card {
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 14px 16px;
    border: 1px solid var(--border-color, #3f3f46);
    border-radius: 10px;
    cursor: pointer;
    transition: all 0.15s;
    background: var(--bg-secondary, #27272a);
  }

  .skill-method-card:hover {
    border-color: var(--accent-color, #8b5cf6);
    background: var(--bg-hover, #2e2e35);
  }

  .skill-method-icon {
    font-size: 24px;
    flex-shrink: 0;
  }

  .skill-method-text {
    display: flex;
    flex-direction: column;
    gap: 4px;
    flex: 1;
  }

  .skill-method-text strong {
    font-size: 14px;
    color: var(--text-primary, #e4e4e7);
  }

  .skill-method-text span {
    font-size: 12px;
    color: var(--text-secondary, #a1a1aa);
  }

  .skill-method-arrow {
    color: var(--text-secondary, #a1a1aa);
    font-size: 16px;
  }

  .skill-dialog-hint {
    margin-top: 16px;
    padding: 10px 12px;
    font-size: 12px;
    color: var(--text-secondary, #a1a1aa);
    background: var(--bg-secondary, #27272a);
    border-radius: 6px;
    text-align: center;
  }

  /* Save Skill Prompt */
  .save-skill-prompt {
    padding: 16px;
    border: 1px solid var(--border-color, #3f3f46);
    border-radius: 10px;
    background: var(--bg-secondary, #27272a);
    margin: 12px 0;
  }

  .save-skill-header {
    font-size: 14px;
    font-weight: 500;
    margin-bottom: 12px;
    color: #4ade80;
  }

  .save-skill-label {
    font-size: 13px;
    color: var(--text-secondary, #a1a1aa);
    margin: 0 0 8px 0;
  }

  .save-skill-options {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

  .save-skill-option {
    padding: 12px;
    border: 1px solid var(--border-color, #3f3f46);
    border-radius: 8px;
    cursor: pointer;
    transition: all 0.15s;
  }

  .save-skill-option:hover {
    border-color: var(--accent-color, #8b5cf6);
  }

  .save-skill-option.recommended {
    border-color: var(--accent-color, #8b5cf6);
    background: rgba(139, 92, 246, 0.05);
  }

  .save-skill-option-header {
    font-size: 14px;
    font-weight: 500;
    margin-bottom: 4px;
  }

  .save-skill-option-desc {
    font-size: 12px;
    color: var(--text-secondary, #a1a1aa);
  }

  .share-skill-btn {
    padding: 4px 10px;
    border: 1px solid var(--border-color, #3f3f46);
    border-radius: 4px;
    background: none;
    color: var(--text-primary, #e4e4e7);
    font-size: 12px;
    cursor: pointer;
  }

  .share-skill-btn:hover {
    border-color: var(--accent-color, #8b5cf6);
  }

  .share-skill-done {
    font-size: 12px;
    color: #4ade80;
  }
`;
