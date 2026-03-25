/**
 * Moss Admin Plugin — Backend Server
 *
 * Provides API endpoints for:
 * - Dashboard metrics (active users, tasks, API cost)
 * - User management (list, provision, quotas)
 * - Skill management (visibility, triggers, departments)
 * - Skill review queue (approve/reject user submissions)
 * - Skill policy configuration
 * - System health monitoring
 */

const express = require('express');
const fs = require('fs');
const path = require('path');
const yaml = require('js-yaml');
const { execSync } = require('child_process');

const app = express();
app.use(express.json());

const PERSISTENT_DIR = process.env.PERSISTENT_DIR || '/persistent';
const CONFIG_DIR = path.join(PERSISTENT_DIR, 'shared', 'config');
const USERS_DIR = path.join(PERSISTENT_DIR, 'users');
const SHARED_SKILLS_DIR = path.join(PERSISTENT_DIR, 'shared', '.claude', 'skills');
const SUBMISSIONS_DIR = path.join(PERSISTENT_DIR, 'shared', 'skill-submissions');

// ===== Dashboard =====

/**
 * GET /dashboard — Overview metrics
 */
app.get('/dashboard', (req, res) => {
  try {
    const users = listUsers();
    const sharedSkills = listSharedSkills();
    const submissions = listSubmissions();

    res.json({
      activeUsers: users.length,
      totalSkills: sharedSkills.length,
      pendingReviews: submissions.filter(s => s.status === 'pending').length,
      users: users.map(u => ({
        username: u.username,
        department: u.department,
        workspaceSize: u.workspaceSize,
        personalSkillCount: u.personalSkillCount,
        lastActive: u.lastActive,
      })),
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ===== User Management =====

/**
 * GET /users — List all users with metadata
 */
app.get('/users', (req, res) => {
  try {
    res.json({ users: listUsers() });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * POST /users — Provision a new user
 */
app.post('/users', (req, res) => {
  const { username, department } = req.body;

  if (!username || !/^[a-zA-Z0-9_-]+$/.test(username)) {
    return res.status(400).json({ error: 'Invalid username' });
  }

  // Validate department to prevent command injection
  const VALID_DEPARTMENTS = ['marketing', 'finance', 'legal', 'operations', 'production', 'it', 'general'];
  const safeDept = VALID_DEPARTMENTS.includes(department) ? department : 'general';

  const userDir = path.join(USERS_DIR, username);
  if (fs.existsSync(userDir)) {
    return res.status(409).json({ error: 'User already exists' });
  }

  try {
    // Use create-user.sh if available, otherwise create manually
    const createScript = '/app/scripts/create-user.sh';
    if (fs.existsSync(createScript)) {
      execSync(`bash ${createScript} ${username} ${safeDept}`, {
        timeout: 10000,
      });
    } else {
      // Manual creation
      fs.mkdirSync(path.join(userDir, 'data'), { recursive: true });
      fs.mkdirSync(path.join(userDir, 'output'), { recursive: true });
      fs.mkdirSync(path.join(userDir, '.claude', 'skills'), { recursive: true });
      fs.mkdirSync(path.join(userDir, '.claude', 'projects'), { recursive: true });
      fs.chmodSync(userDir, 0o700);
    }

    res.json({ success: true, username, workspace: userDir });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * DELETE /users/:username — Remove a user workspace
 */
app.delete('/users/:username', (req, res) => {
  const { username } = req.params;
  if (!/^[a-zA-Z0-9_-]+$/.test(username)) {
    return res.status(400).json({ error: 'Invalid username' });
  }

  const userDir = path.join(USERS_DIR, username);
  if (!fs.existsSync(userDir)) {
    return res.status(404).json({ error: 'User not found' });
  }

  try {
    // Archive instead of delete — safety first
    const archiveDir = path.join(PERSISTENT_DIR, 'archived-users');
    fs.mkdirSync(archiveDir, { recursive: true });
    const archivePath = path.join(archiveDir, `${username}-${Date.now()}`);
    fs.renameSync(userDir, archivePath);
    res.json({ success: true, archived: archivePath });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ===== Skill Management =====

/**
 * GET /skills — List all shared skills with metadata
 */
app.get('/skills', (req, res) => {
  try {
    res.json({ skills: listSharedSkills() });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * GET /skills/review — List pending skill submissions
 */
app.get('/skills/review', (req, res) => {
  try {
    res.json({ submissions: listSubmissions() });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * POST /skills/review/:submissionId/approve — Approve a skill submission
 */
app.post('/skills/review/:submissionId/approve', (req, res) => {
  const { submissionId } = req.params;

  try {
    const submissionPath = findSubmission(submissionId);
    if (!submissionPath) {
      return res.status(404).json({ error: 'Submission not found' });
    }

    const submission = JSON.parse(fs.readFileSync(submissionPath, 'utf8'));

    // Copy skill to shared directory
    const targetDir = path.join(SHARED_SKILLS_DIR, submission.skillId);
    if (fs.existsSync(submission.sourcePath)) {
      copyDirSync(submission.sourcePath, targetDir);
    }

    // Update submission status
    submission.status = 'approved';
    submission.reviewedAt = new Date().toISOString();
    fs.writeFileSync(submissionPath, JSON.stringify(submission, null, 2));

    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * POST /skills/review/:submissionId/reject — Reject a skill submission
 */
app.post('/skills/review/:submissionId/reject', (req, res) => {
  const { submissionId } = req.params;
  const { feedback } = req.body;

  try {
    const submissionPath = findSubmission(submissionId);
    if (!submissionPath) {
      return res.status(404).json({ error: 'Submission not found' });
    }

    const submission = JSON.parse(fs.readFileSync(submissionPath, 'utf8'));
    submission.status = 'rejected';
    submission.feedback = feedback || '';
    submission.reviewedAt = new Date().toISOString();
    fs.writeFileSync(submissionPath, JSON.stringify(submission, null, 2));

    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * DELETE /skills/:skillId — Remove a shared skill
 */
app.delete('/skills/:skillId', (req, res) => {
  const { skillId } = req.params;
  if (!/^[a-zA-Z0-9_-]+$/.test(skillId)) {
    return res.status(400).json({ error: 'Invalid skill ID' });
  }

  const skillDir = path.join(SHARED_SKILLS_DIR, skillId);
  if (!fs.existsSync(skillDir)) {
    return res.status(404).json({ error: 'Skill not found' });
  }

  try {
    fs.rmSync(skillDir, { recursive: true });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ===== Toolbox Config Management =====

/**
 * GET /config/toolbox — Get current toolbox configuration
 */
app.get('/config/toolbox', (req, res) => {
  try {
    const configPath = path.join(CONFIG_DIR, 'toolbox-config.yaml');
    if (!fs.existsSync(configPath)) {
      return res.json({ config: null });
    }
    const raw = fs.readFileSync(configPath, 'utf8');
    const config = yaml.load(raw);
    res.json({ config });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * PUT /config/toolbox — Update toolbox configuration
 */
app.put('/config/toolbox', (req, res) => {
  const { config } = req.body;
  try {
    fs.mkdirSync(CONFIG_DIR, { recursive: true });
    const configPath = path.join(CONFIG_DIR, 'toolbox-config.yaml');

    // Backup current config
    if (fs.existsSync(configPath)) {
      const backup = `${configPath}.backup.${Date.now()}`;
      fs.copyFileSync(configPath, backup);
    }

    fs.writeFileSync(configPath, yaml.dump(config, { lineWidth: -1 }));
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ===== Skill Policy =====

/**
 * GET /config/policy — Get skill creation policy
 */
app.get('/config/policy', (req, res) => {
  try {
    const policyPath = path.join(CONFIG_DIR, 'skill-policy.yaml');
    if (!fs.existsSync(policyPath)) {
      return res.json({
        policy: {
          user_skill_creation: { enabled: true },
          community_install: { enabled: true, allowed_sources: ['anthropics/skills'] },
          share_to_team: { enabled: true, require_admin_review: true },
        },
      });
    }
    const raw = fs.readFileSync(policyPath, 'utf8');
    res.json({ policy: yaml.load(raw) });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * PUT /config/policy — Update skill creation policy
 */
app.put('/config/policy', (req, res) => {
  const { policy } = req.body;
  try {
    fs.mkdirSync(CONFIG_DIR, { recursive: true });
    const policyPath = path.join(CONFIG_DIR, 'skill-policy.yaml');
    fs.writeFileSync(policyPath, yaml.dump(policy, { lineWidth: -1 }));
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ===== System Health =====

/**
 * GET /health — System health status
 */
app.get('/health', (req, res) => {
  const health = {
    status: 'ok',
    timestamp: new Date().toISOString(),
    services: {},
  };

  // Check Claude Code CLI
  try {
    execSync('which claude', { timeout: 5000 });
    health.services.claudeCode = 'available';
  } catch {
    health.services.claudeCode = 'not found';
  }

  // Check Python
  try {
    const pyVersion = execSync('python3 --version', { timeout: 5000 }).toString().trim();
    health.services.python = pyVersion;
  } catch {
    health.services.python = 'not found';
  }

  // Disk usage
  try {
    const du = execSync(`du -sh ${PERSISTENT_DIR} 2>/dev/null || echo "unknown"`, {
      timeout: 10000,
    }).toString().trim();
    health.diskUsage = du.split('\t')[0];
  } catch {
    health.diskUsage = 'unknown';
  }

  res.json(health);
});

// ===== Helper Functions =====

function listUsers() {
  const users = [];
  try {
    if (!fs.existsSync(USERS_DIR)) return users;

    const entries = fs.readdirSync(USERS_DIR, { withFileTypes: true });
    for (const entry of entries) {
      if (!entry.isDirectory()) continue;

      const userDir = path.join(USERS_DIR, entry.name);
      const claudeMd = path.join(userDir, '.claude', 'CLAUDE.md');
      const skillsDir = path.join(userDir, '.claude', 'skills');

      let department = 'general';
      try {
        if (fs.existsSync(claudeMd)) {
          const content = fs.readFileSync(claudeMd, 'utf8');
          const deptLine = content.split('\n').find(l => l.startsWith('## Department'));
          if (deptLine) {
            const nextLine = content.split('\n')[content.split('\n').indexOf(deptLine) + 1];
            if (nextLine) department = nextLine.trim();
          }
        }
      } catch { /* ignore */ }

      let personalSkillCount = 0;
      try {
        if (fs.existsSync(skillsDir)) {
          personalSkillCount = fs.readdirSync(skillsDir).filter(f =>
            fs.statSync(path.join(skillsDir, f)).isDirectory()
          ).length;
        }
      } catch { /* ignore */ }

      let workspaceSize = 'unknown';
      let lastActive = null;
      try {
        const stat = fs.statSync(userDir);
        lastActive = stat.mtime.toISOString();
      } catch { /* ignore */ }

      users.push({
        username: entry.name,
        department,
        personalSkillCount,
        workspaceSize,
        lastActive,
      });
    }
  } catch (err) {
    console.error('[moss-admin] Failed to list users:', err.message);
  }
  return users;
}

function listSharedSkills() {
  const skills = [];
  try {
    if (!fs.existsSync(SHARED_SKILLS_DIR)) return skills;

    const entries = fs.readdirSync(SHARED_SKILLS_DIR, { withFileTypes: true });
    for (const entry of entries) {
      if (!entry.isDirectory()) continue;

      const skillMdPath = path.join(SHARED_SKILLS_DIR, entry.name, 'SKILL.md');
      let name = entry.name;
      let description = '';

      try {
        if (fs.existsSync(skillMdPath)) {
          const content = fs.readFileSync(skillMdPath, 'utf8');
          const nameLine = content.split('\n').find(l => l.startsWith('#'));
          if (nameLine) name = nameLine.replace(/^#+\s*/, '');
          const descLine = content.split('\n').find(l => l.startsWith('Description:') || l.startsWith('> '));
          if (descLine) description = descLine.replace(/^(Description:\s*|>\s*)/, '');
        }
      } catch { /* ignore */ }

      skills.push({ id: entry.name, name, description });
    }
  } catch (err) {
    console.error('[moss-admin] Failed to list shared skills:', err.message);
  }
  return skills;
}

function listSubmissions() {
  const submissions = [];
  try {
    if (!fs.existsSync(SUBMISSIONS_DIR)) return submissions;

    const files = fs.readdirSync(SUBMISSIONS_DIR).filter(f => f.endsWith('.json'));
    for (const file of files) {
      try {
        const content = fs.readFileSync(path.join(SUBMISSIONS_DIR, file), 'utf8');
        const submission = JSON.parse(content);
        submission.id = file.replace('.json', '');
        submissions.push(submission);
      } catch { /* ignore */ }
    }
  } catch (err) {
    console.error('[moss-admin] Failed to list submissions:', err.message);
  }
  return submissions;
}

function findSubmission(submissionId) {
  const fileName = `${submissionId}.json`;
  const filePath = path.join(SUBMISSIONS_DIR, fileName);
  if (fs.existsSync(filePath)) return filePath;

  // Search by partial match
  try {
    const files = fs.readdirSync(SUBMISSIONS_DIR);
    const match = files.find(f => f.includes(submissionId));
    if (match) return path.join(SUBMISSIONS_DIR, match);
  } catch { /* ignore */ }

  return null;
}

function copyDirSync(src, dest) {
  fs.mkdirSync(dest, { recursive: true });
  const entries = fs.readdirSync(src, { withFileTypes: true });
  for (const entry of entries) {
    const srcPath = path.join(src, entry.name);
    const destPath = path.join(dest, entry.name);
    if (entry.isDirectory()) {
      copyDirSync(srcPath, destPath);
    } else {
      fs.copyFileSync(srcPath, destPath);
    }
  }
}

// Start server — pick a free port and signal readiness to CloudCLI
const server = app.listen(0, '127.0.0.1', () => {
  const port = server.address().port;
  // CloudCLI plugin protocol: print JSON ready line to stdout
  console.log(JSON.stringify({ ready: true, port }));
});

module.exports = app;
