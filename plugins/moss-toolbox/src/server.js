/**
 * Moss Toolbox Plugin — Backend Server
 *
 * Provides API endpoints for:
 * - Toolbox configuration (categories, skills, mappings)
 * - Smart suggestion rules
 * - User personal skills management
 * - Skill sharing/submission
 * - Welcome page data
 */

const express = require('express');
const fs = require('fs');
const path = require('path');
const yaml = require('js-yaml');

const app = express();
app.use(express.json());

const PERSISTENT_DIR = process.env.PERSISTENT_DIR || '/persistent';
const CONFIG_DIR = process.env.CONFIG_DIR || '/persistent/shared/config';
const TOOLBOX_CONFIG_PATH = path.join(CONFIG_DIR, 'toolbox-config.yaml');

// Cache parsed config
let toolboxConfig = null;
let configLastModified = 0;

/**
 * Load and cache toolbox configuration from YAML
 */
function loadToolboxConfig() {
  try {
    const configPath = fs.existsSync(TOOLBOX_CONFIG_PATH)
      ? TOOLBOX_CONFIG_PATH
      : path.join(__dirname, '..', '..', '..', 'config', 'toolbox-config.yaml');

    const stat = fs.statSync(configPath);
    if (stat.mtimeMs !== configLastModified) {
      const raw = fs.readFileSync(configPath, 'utf8');
      toolboxConfig = yaml.load(raw);
      configLastModified = stat.mtimeMs;
    }
  } catch (err) {
    console.error('[moss-toolbox] Failed to load toolbox config:', err.message);
    if (!toolboxConfig) {
      toolboxConfig = { categories: [], suggestion_rules: [], welcome_actions: [] };
    }
  }
  return toolboxConfig;
}

/**
 * Get user's personal skills from their workspace
 */
function getUserSkills(username) {
  const skillsDir = path.join(PERSISTENT_DIR, 'users', username, '.claude', 'skills');
  const skills = [];

  try {
    if (!fs.existsSync(skillsDir)) return skills;

    const entries = fs.readdirSync(skillsDir, { withFileTypes: true });
    for (const entry of entries) {
      if (entry.isDirectory()) {
        const skillMdPath = path.join(skillsDir, entry.name, 'SKILL.md');
        if (fs.existsSync(skillMdPath)) {
          const content = fs.readFileSync(skillMdPath, 'utf8');
          const nameLine = content.split('\n').find(l => l.startsWith('#'));
          const descLine = content.split('\n').find(l => l.startsWith('Description:') || l.startsWith('> '));

          skills.push({
            id: entry.name,
            name: nameLine ? nameLine.replace(/^#+\s*/, '') : entry.name,
            description: descLine ? descLine.replace(/^(Description:\s*|>\s*)/, '') : '',
            path: path.join(skillsDir, entry.name),
            source: 'personal',
          });
        }
      }
    }
  } catch (err) {
    console.error('[moss-toolbox] Failed to read user skills:', err.message);
  }

  return skills;
}

/**
 * Get shared enterprise skills
 */
function getSharedSkills() {
  const skillsDir = path.join(PERSISTENT_DIR, 'shared', '.claude', 'skills');
  const skills = [];

  try {
    if (!fs.existsSync(skillsDir)) return skills;

    const entries = fs.readdirSync(skillsDir, { withFileTypes: true });
    for (const entry of entries) {
      if (entry.isDirectory()) {
        const skillMdPath = path.join(skillsDir, entry.name, 'SKILL.md');
        if (fs.existsSync(skillMdPath)) {
          const content = fs.readFileSync(skillMdPath, 'utf8');
          const nameLine = content.split('\n').find(l => l.startsWith('#'));
          skills.push({
            id: entry.name,
            name: nameLine ? nameLine.replace(/^#+\s*/, '') : entry.name,
            path: path.join(skillsDir, entry.name),
            source: 'shared',
          });
        }
      }
    }
  } catch (err) {
    console.error('[moss-toolbox] Failed to read shared skills:', err.message);
  }

  return skills;
}

// ===== API Routes =====

/**
 * GET /toolbox — Full toolbox data (categories + items + user skills)
 */
app.get('/toolbox', (req, res) => {
  const config = loadToolboxConfig();
  const username = req.headers['x-remote-user'] || 'default';
  const userDept = req.headers['x-user-department'] || '*';

  // Filter categories/items by department
  const categories = (config.categories || []).map(cat => ({
    ...cat,
    items: (cat.items || []).filter(item => {
      const depts = item.departments || ['*'];
      return depts.includes('*') || depts.includes(userDept);
    }),
  })).filter(cat => cat.items.length > 0);

  const personalSkills = getUserSkills(username);

  res.json({
    categories,
    personalSkills,
    welcomeActions: config.welcome_actions || [],
  });
});

/**
 * GET /suggestions — Smart suggestion rules
 */
app.get('/suggestions', (req, res) => {
  const config = loadToolboxConfig();
  res.json({
    rules: config.suggestion_rules || [],
  });
});

/**
 * GET /welcome — Welcome page data
 */
app.get('/welcome', (req, res) => {
  const config = loadToolboxConfig();
  const username = req.headers['x-remote-user'] || 'default';
  const personalSkills = getUserSkills(username);

  res.json({
    actions: config.welcome_actions || [],
    personalSkills,
  });
});

/**
 * GET /skills/personal — List user's personal skills
 */
app.get('/skills/personal', (req, res) => {
  const username = req.headers['x-remote-user'] || 'default';
  res.json({ skills: getUserSkills(username) });
});

/**
 * GET /skills/shared — List shared enterprise skills
 */
app.get('/skills/shared', (req, res) => {
  res.json({ skills: getSharedSkills() });
});

/**
 * DELETE /skills/personal/:skillId — Delete a personal skill
 */
app.delete('/skills/personal/:skillId', (req, res) => {
  const username = req.headers['x-remote-user'] || 'default';
  const skillId = req.params.skillId;

  // Validate skill ID
  if (!/^[a-zA-Z0-9_-]+$/.test(skillId)) {
    return res.status(400).json({ error: 'Invalid skill ID' });
  }

  const skillDir = path.join(PERSISTENT_DIR, 'users', username, '.claude', 'skills', skillId);

  try {
    if (!fs.existsSync(skillDir)) {
      return res.status(404).json({ error: 'Skill not found' });
    }
    fs.rmSync(skillDir, { recursive: true });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * POST /skills/share — Submit a personal skill for admin review
 */
app.post('/skills/share', (req, res) => {
  const username = req.headers['x-remote-user'] || 'default';
  const { skillId } = req.body;

  if (!skillId || !/^[a-zA-Z0-9_-]+$/.test(skillId)) {
    return res.status(400).json({ error: 'Invalid skill ID' });
  }

  const skillDir = path.join(PERSISTENT_DIR, 'users', username, '.claude', 'skills', skillId);
  if (!fs.existsSync(skillDir)) {
    return res.status(404).json({ error: 'Skill not found' });
  }

  // Create a submission record
  const submissionsDir = path.join(PERSISTENT_DIR, 'shared', 'skill-submissions');
  try {
    fs.mkdirSync(submissionsDir, { recursive: true });

    const submission = {
      skillId,
      username,
      sourcePath: skillDir,
      submittedAt: new Date().toISOString(),
      status: 'pending',
    };

    const submissionPath = path.join(submissionsDir, `${username}-${skillId}.json`);
    fs.writeFileSync(submissionPath, JSON.stringify(submission, null, 2));

    res.json({ success: true, message: 'Skill submitted for admin review' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Start server — pick a free port and signal readiness to CloudCLI
const server = app.listen(0, '127.0.0.1', () => {
  const port = server.address().port;
  // CloudCLI plugin protocol: print JSON ready line to stdout
  console.log(JSON.stringify({ ready: true, port }));
});

module.exports = app;
