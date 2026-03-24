/**
 * Moss Admin Panel — Enterprise management interface
 *
 * Separate from user UI. Contains:
 * - Dashboard: active users, tasks, API cost overview
 * - Skill Manager: visibility, triggers, department config
 * - Skill Review Queue: approve/reject user submissions
 * - User Manager: provisioning, quotas, monitoring
 * - Policy Editor: skill creation policies
 * - System Health: service status
 */

import React, { useState, useEffect, useCallback } from 'react';
import { useTranslation } from './i18n.js';

const API_BASE = '/api/plugins/moss-admin/rpc';

export default function MossAdmin() {
  const { t } = useTranslation();
  const [activeTab, setActiveTab] = useState('dashboard');
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [dashRes, skillsRes, reviewRes, healthRes, policyRes] = await Promise.all([
        fetch(`${API_BASE}/dashboard`),
        fetch(`${API_BASE}/skills`),
        fetch(`${API_BASE}/skills/review`),
        fetch(`${API_BASE}/health`),
        fetch(`${API_BASE}/config/policy`),
      ]);

      setData({
        dashboard: await dashRes.json(),
        skills: (await skillsRes.json()).skills || [],
        submissions: (await reviewRes.json()).submissions || [],
        health: await healthRes.json(),
        policy: (await policyRes.json()).policy || {},
      });
    } catch (err) {
      console.error('[moss-admin] Failed to fetch data:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  const tabs = [
    { id: 'dashboard', icon: '📊', label: t('tabs.dashboard') },
    { id: 'users', icon: '👥', label: t('tabs.users') },
    { id: 'skills', icon: '🧰', label: t('tabs.skills') },
    { id: 'review', icon: '📋', label: t('tabs.review') },
    { id: 'policy', icon: '🔒', label: t('tabs.policy') },
    { id: 'health', icon: '💚', label: t('tabs.health') },
  ];

  return (
    <div className="admin-root">
      <style>{adminStyles}</style>

      {/* Tab Navigation */}
      <div className="admin-tabs">
        {tabs.map(tab => (
          <button
            key={tab.id}
            className={`admin-tab ${activeTab === tab.id ? 'active' : ''}`}
            onClick={() => setActiveTab(tab.id)}
          >
            {tab.icon} {tab.label}
            {tab.id === 'review' && data?.submissions?.filter(s => s.status === 'pending').length > 0 && (
              <span className="admin-badge">
                {data.submissions.filter(s => s.status === 'pending').length}
              </span>
            )}
          </button>
        ))}
        <button className="admin-refresh" onClick={fetchData} title={t('refresh')}>🔄</button>
      </div>

      {/* Content */}
      <div className="admin-content">
        {loading ? (
          <div className="admin-loading">{t('loading')}</div>
        ) : (
          <>
            {activeTab === 'dashboard' && <Dashboard data={data?.dashboard} />}
            {activeTab === 'users' && <UserManager data={data?.dashboard} onRefresh={fetchData} />}
            {activeTab === 'skills' && <SkillManager skills={data?.skills} onRefresh={fetchData} />}
            {activeTab === 'review' && <ReviewQueue submissions={data?.submissions} onRefresh={fetchData} />}
            {activeTab === 'policy' && <PolicyEditor policy={data?.policy} onRefresh={fetchData} />}
            {activeTab === 'health' && <SystemHealth health={data?.health} />}
          </>
        )}
      </div>
    </div>
  );
}

// ===== Dashboard =====

function Dashboard({ data }) {
  const { t } = useTranslation();
  if (!data) return null;

  return (
    <div className="admin-section">
      <h2>{t('dashboard.header')}</h2>
      <div className="admin-cards">
        <div className="admin-card">
          <div className="admin-card-value">{data.activeUsers || 0}</div>
          <div className="admin-card-label">{t('dashboard.active_users')}</div>
        </div>
        <div className="admin-card">
          <div className="admin-card-value">{data.totalSkills || 0}</div>
          <div className="admin-card-label">{t('dashboard.shared_skills')}</div>
        </div>
        <div className="admin-card">
          <div className="admin-card-value">{data.pendingReviews || 0}</div>
          <div className="admin-card-label">{t('dashboard.pending_review')}</div>
        </div>
      </div>
    </div>
  );
}

// ===== User Manager =====

function UserManager({ data, onRefresh }) {
  const { t } = useTranslation();
  const [newUser, setNewUser] = useState('');
  const [newDept, setNewDept] = useState('general');

  const handleCreateUser = async () => {
    if (!newUser.trim()) return;
    try {
      const res = await fetch(`${API_BASE}/users`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: newUser.trim(), department: newDept }),
      });
      if (res.ok) {
        setNewUser('');
        onRefresh();
      } else {
        const err = await res.json();
        alert(err.error || t('users.error_create'));
      }
    } catch (err) {
      alert(t('users.error_create_msg', { message: err.message }));
    }
  };

  const handleDeleteUser = async (username) => {
    if (!confirm(t('users.confirm_archive', { username }))) return;
    try {
      await fetch(`${API_BASE}/users/${username}`, { method: 'DELETE' });
      onRefresh();
    } catch (err) {
      alert(t('users.error_action', { message: err.message }));
    }
  };

  return (
    <div className="admin-section">
      <h2>{t('users.header')}</h2>

      {/* Create User Form */}
      <div className="admin-form-row">
        <input
          type="text"
          placeholder={t('users.username_placeholder')}
          value={newUser}
          onChange={e => setNewUser(e.target.value)}
          className="admin-input"
        />
        <select value={newDept} onChange={e => setNewDept(e.target.value)} className="admin-select">
          <option value="general">{t('users.dept_general')}</option>
          <option value="it">{t('users.dept_it')}</option>
          <option value="marketing">{t('users.dept_marketing')}</option>
          <option value="finance">{t('users.dept_finance')}</option>
          <option value="legal">{t('users.dept_legal')}</option>
          <option value="operations">{t('users.dept_operations')}</option>
          <option value="production">{t('users.dept_production')}</option>
        </select>
        <button onClick={handleCreateUser} className="admin-btn primary">{t('users.create_btn')}</button>
      </div>

      {/* User Table */}
      <table className="admin-table">
        <thead>
          <tr>
            <th>{t('users.col_username')}</th>
            <th>{t('users.col_department')}</th>
            <th>{t('users.col_skills')}</th>
            <th>{t('users.col_last_active')}</th>
            <th>{t('users.col_actions')}</th>
          </tr>
        </thead>
        <tbody>
          {(data?.users || []).map(user => (
            <tr key={user.username}>
              <td>{user.username}</td>
              <td>{user.department}</td>
              <td>{user.personalSkillCount}</td>
              <td>{user.lastActive ? new Date(user.lastActive).toLocaleDateString() : '-'}</td>
              <td>
                <button
                  className="admin-btn danger small"
                  onClick={() => handleDeleteUser(user.username)}
                >
                  {t('users.archive_btn')}
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ===== Skill Manager =====

function SkillManager({ skills, onRefresh }) {
  const { t } = useTranslation();

  const handleDelete = async (skillId) => {
    if (!confirm(t('skills.confirm_delete', { skillId }))) return;
    try {
      await fetch(`${API_BASE}/skills/${skillId}`, { method: 'DELETE' });
      onRefresh();
    } catch (err) {
      alert(t('skills.error_delete', { message: err.message }));
    }
  };

  return (
    <div className="admin-section">
      <h2>{t('skills.header')}</h2>
      <table className="admin-table">
        <thead>
          <tr>
            <th>{t('skills.col_id')}</th>
            <th>{t('skills.col_name')}</th>
            <th>{t('skills.col_description')}</th>
            <th>{t('skills.col_actions')}</th>
          </tr>
        </thead>
        <tbody>
          {(skills || []).map(skill => (
            <tr key={skill.id}>
              <td><code>{skill.id}</code></td>
              <td>{skill.name}</td>
              <td>{skill.description || '-'}</td>
              <td>
                <button
                  className="admin-btn danger small"
                  onClick={() => handleDelete(skill.id)}
                >
                  {t('skills.delete_btn')}
                </button>
              </td>
            </tr>
          ))}
          {(!skills || skills.length === 0) && (
            <tr><td colSpan="4" className="admin-empty">{t('skills.empty')}</td></tr>
          )}
        </tbody>
      </table>
    </div>
  );
}

// ===== Review Queue =====

function ReviewQueue({ submissions, onRefresh }) {
  const { t } = useTranslation();
  const pending = (submissions || []).filter(s => s.status === 'pending');

  const handleAction = async (id, action, feedback) => {
    try {
      const body = action === 'reject' ? { feedback: feedback || '' } : {};
      await fetch(`${API_BASE}/skills/review/${id}/${action}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      onRefresh();
    } catch (err) {
      alert(t('review.error_action', { message: err.message }));
    }
  };

  return (
    <div className="admin-section">
      <h2>{t('review.header', { count: pending.length })}</h2>

      {pending.length === 0 ? (
        <div className="admin-empty-state">{t('review.empty')}</div>
      ) : (
        <div className="review-list">
          {pending.map(sub => (
            <div key={sub.id} className="review-item">
              <div className="review-header">
                <strong>{sub.skillId}</strong>
                <span className="review-meta">{t('review.submitted_by', { username: sub.username })}</span>
                <span className="review-meta">{new Date(sub.submittedAt).toLocaleDateString()}</span>
              </div>
              <div className="review-actions">
                <button
                  className="admin-btn primary small"
                  onClick={() => handleAction(sub.id, 'approve')}
                >
                  {t('review.approve_btn')}
                </button>
                <button
                  className="admin-btn danger small"
                  onClick={() => {
                    const feedback = prompt(t('review.reject_reason'));
                    handleAction(sub.id, 'reject', feedback);
                  }}
                >
                  {t('review.reject_btn')}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ===== Policy Editor =====

function PolicyEditor({ policy, onRefresh }) {
  const { t } = useTranslation();
  const [localPolicy, setLocalPolicy] = useState(policy || {});

  const handleSave = async () => {
    try {
      await fetch(`${API_BASE}/config/policy`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ policy: localPolicy }),
      });
      alert(t('policy.saved'));
      onRefresh();
    } catch (err) {
      alert(t('policy.error_save', { message: err.message }));
    }
  };

  const toggle = (path) => {
    setLocalPolicy(prev => {
      const next = JSON.parse(JSON.stringify(prev));
      const keys = path.split('.');
      let obj = next;
      for (let i = 0; i < keys.length - 1; i++) {
        if (!obj[keys[i]]) obj[keys[i]] = {};
        obj = obj[keys[i]];
      }
      obj[keys[keys.length - 1]] = !obj[keys[keys.length - 1]];
      return next;
    });
  };

  const creation = localPolicy.user_skill_creation || {};
  const community = localPolicy.community_install || {};
  const share = localPolicy.share_to_team || {};

  return (
    <div className="admin-section">
      <h2>{t('policy.header')}</h2>

      <div className="policy-group">
        <h3>{t('policy.group_user_creation')}</h3>
        <label className="policy-toggle">
          <input type="checkbox" checked={creation.enabled !== false} onChange={() => toggle('user_skill_creation.enabled')} />
          {t('policy.allow_user_creation')}
        </label>
      </div>

      <div className="policy-group">
        <h3>{t('policy.group_community')}</h3>
        <label className="policy-toggle">
          <input type="checkbox" checked={community.enabled !== false} onChange={() => toggle('community_install.enabled')} />
          {t('policy.allow_community')}
        </label>
      </div>

      <div className="policy-group">
        <h3>{t('policy.group_sharing')}</h3>
        <label className="policy-toggle">
          <input type="checkbox" checked={share.enabled !== false} onChange={() => toggle('share_to_team.enabled')} />
          {t('policy.allow_sharing')}
        </label>
        <label className="policy-toggle">
          <input type="checkbox" checked={share.require_admin_review !== false} onChange={() => toggle('share_to_team.require_admin_review')} />
          {t('policy.require_review')}
        </label>
      </div>

      <button className="admin-btn primary" onClick={handleSave}>{t('policy.save_btn')}</button>
    </div>
  );
}

// ===== System Health =====

function SystemHealth({ health }) {
  const { t } = useTranslation();
  if (!health) return null;

  return (
    <div className="admin-section">
      <h2>{t('health.header')}</h2>
      <div className="health-grid">
        <div className="health-item">
          <span className="health-label">{t('health.label_status')}</span>
          <span className={`health-value ${health.status === 'ok' ? 'ok' : 'error'}`}>
            {health.status === 'ok' ? t('health.status_ok') : t('health.status_error')}
          </span>
        </div>
        {health.services && Object.entries(health.services).map(([key, value]) => (
          <div key={key} className="health-item">
            <span className="health-label">{key}</span>
            <span className="health-value">{value}</span>
          </div>
        ))}
        <div className="health-item">
          <span className="health-label">{t('health.label_disk')}</span>
          <span className="health-value">{health.diskUsage || 'unknown'}</span>
        </div>
        <div className="health-item">
          <span className="health-label">{t('health.label_time')}</span>
          <span className="health-value">{new Date(health.timestamp).toLocaleString()}</span>
        </div>
      </div>
    </div>
  );
}

const adminStyles = `
  .admin-root {
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    height: 100%;
    overflow-y: auto;
    color: var(--text-primary, #e4e4e7);
    background: var(--bg-primary, #18181b);
  }

  .admin-tabs {
    display: flex;
    gap: 2px;
    padding: 8px 12px;
    border-bottom: 1px solid var(--border-color, #3f3f46);
    flex-wrap: wrap;
  }

  .admin-tab {
    padding: 6px 12px;
    border: none;
    background: none;
    color: var(--text-secondary, #a1a1aa);
    font-size: 13px;
    cursor: pointer;
    border-radius: 6px;
    transition: all 0.15s;
    position: relative;
  }

  .admin-tab:hover { background: var(--bg-hover, #27272a); }
  .admin-tab.active {
    background: var(--bg-secondary, #27272a);
    color: var(--text-primary, #e4e4e7);
    font-weight: 500;
  }

  .admin-badge {
    position: absolute;
    top: 2px;
    right: 2px;
    background: #ef4444;
    color: white;
    font-size: 10px;
    padding: 1px 5px;
    border-radius: 8px;
    font-weight: 600;
  }

  .admin-refresh {
    margin-left: auto;
    background: none;
    border: none;
    cursor: pointer;
    font-size: 14px;
    opacity: 0.6;
  }
  .admin-refresh:hover { opacity: 1; }

  .admin-content { padding: 16px; }
  .admin-loading { text-align: center; padding: 40px; color: var(--text-secondary, #a1a1aa); }

  .admin-section { margin-bottom: 24px; }
  .admin-section h2 { font-size: 16px; margin: 0 0 16px 0; }
  .admin-section h3 { font-size: 14px; margin: 12px 0 8px 0; color: var(--text-secondary, #a1a1aa); }

  .admin-cards {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 12px;
    margin-bottom: 16px;
  }

  .admin-card {
    padding: 16px;
    background: var(--bg-secondary, #27272a);
    border: 1px solid var(--border-color, #3f3f46);
    border-radius: 10px;
    text-align: center;
  }

  .admin-card-value { font-size: 28px; font-weight: 700; color: var(--accent-color, #8b5cf6); }
  .admin-card-label { font-size: 12px; color: var(--text-secondary, #a1a1aa); margin-top: 4px; }

  .admin-form-row {
    display: flex;
    gap: 8px;
    margin-bottom: 16px;
    flex-wrap: wrap;
  }

  .admin-input, .admin-select {
    padding: 8px 12px;
    border: 1px solid var(--border-color, #3f3f46);
    border-radius: 6px;
    background: var(--bg-secondary, #27272a);
    color: var(--text-primary, #e4e4e7);
    font-size: 13px;
  }

  .admin-input { flex: 1; min-width: 150px; }

  .admin-btn {
    padding: 8px 16px;
    border: 1px solid var(--border-color, #3f3f46);
    border-radius: 6px;
    background: var(--bg-secondary, #27272a);
    color: var(--text-primary, #e4e4e7);
    font-size: 13px;
    cursor: pointer;
    transition: all 0.15s;
    white-space: nowrap;
  }

  .admin-btn:hover { background: var(--bg-hover, #3f3f46); }
  .admin-btn.primary { background: var(--accent-color, #8b5cf6); color: white; border-color: transparent; }
  .admin-btn.primary:hover { opacity: 0.9; }
  .admin-btn.danger { color: #ef4444; }
  .admin-btn.danger:hover { background: rgba(239, 68, 68, 0.1); }
  .admin-btn.small { padding: 4px 10px; font-size: 12px; }

  .admin-table {
    width: 100%;
    border-collapse: collapse;
    font-size: 13px;
  }

  .admin-table th, .admin-table td {
    padding: 10px 12px;
    text-align: left;
    border-bottom: 1px solid var(--border-color, #3f3f46);
  }

  .admin-table th {
    font-weight: 500;
    color: var(--text-secondary, #a1a1aa);
    font-size: 12px;
    text-transform: uppercase;
  }

  .admin-table code {
    font-size: 12px;
    padding: 2px 6px;
    background: var(--bg-secondary, #27272a);
    border-radius: 3px;
  }

  .admin-empty, .admin-empty-state {
    text-align: center;
    color: var(--text-secondary, #a1a1aa);
    padding: 24px;
  }

  .review-list { display: flex; flex-direction: column; gap: 8px; }

  .review-item {
    padding: 12px 16px;
    border: 1px solid var(--border-color, #3f3f46);
    border-radius: 8px;
    display: flex;
    justify-content: space-between;
    align-items: center;
  }

  .review-header { display: flex; gap: 12px; align-items: center; }
  .review-meta { font-size: 12px; color: var(--text-secondary, #a1a1aa); }
  .review-actions { display: flex; gap: 8px; }

  .policy-group {
    padding: 12px;
    border: 1px solid var(--border-color, #3f3f46);
    border-radius: 8px;
    margin-bottom: 12px;
  }

  .policy-toggle {
    display: flex;
    align-items: center;
    gap: 8px;
    font-size: 13px;
    padding: 6px 0;
    cursor: pointer;
  }

  .policy-toggle input[type="checkbox"] {
    width: 16px;
    height: 16px;
    accent-color: var(--accent-color, #8b5cf6);
  }

  .health-grid {
    display: grid;
    grid-template-columns: repeat(2, 1fr);
    gap: 8px;
  }

  .health-item {
    padding: 12px;
    background: var(--bg-secondary, #27272a);
    border-radius: 6px;
    display: flex;
    justify-content: space-between;
    align-items: center;
  }

  .health-label { font-size: 13px; color: var(--text-secondary, #a1a1aa); }
  .health-value { font-size: 13px; font-weight: 500; }
  .health-value.ok { color: #4ade80; }
  .health-value.error { color: #ef4444; }
`;
