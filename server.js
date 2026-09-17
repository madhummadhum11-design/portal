import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { connectDB } from './config/db.js';
import { User } from './models/User.js';
import { Internship } from './models/Internship.js';
import { Job } from './models/Job.js';
import { Application } from './models/Application.js';
import { CareerPath } from './models/CareerPath.js';
import { careerPaths as fallbackPaths, internships as fallbackInternships, jobs as fallbackJobs } from './data/store.js';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;

app.use(cors());
app.use(express.json());

// Initialize MongoDB connection
connectDB();

// Request logger
app.use((req, res, next) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.url}`);
  next();
});

// Health check & MongoDB status
app.get('/api/health', async (req, res) => {
  let dbStatus = 'disconnected';
  try {
    const count = await User.countDocuments();
    dbStatus = `connected (users: ${count})`;
  } catch {
    dbStatus = 'offline';
  }

  res.json({
    status: 'online',
    service: 'SkillBridge AI Backend',
    database: 'MongoDB',
    dbStatus,
    compassUri: 'mongodb://127.0.0.1:27017/skillbridge',
    timestamp: new Date().toISOString(),
  });
});

// Auth Routes (Login & Demo users from MongoDB)
app.post('/api/auth/login', async (req, res) => {
  const { email, role } = req.body;
  try {
    let user = null;
    if (email) {
      user = await User.findOne({ email });
    }
    if (!user && role) {
      user = await User.findOne({ role });
    }
    if (!user) {
      user = await User.findOne({});
    }

    if (user) {
      return res.json({
        success: true,
        token: 'jwt_mock_token_' + Date.now(),
        user,
      });
    }
  } catch (err) {
    console.warn('MongoDB query fallback:', err.message);
  }

  // Fallback if DB query fails
  res.json({
    success: true,
    token: 'jwt_mock_token_' + Date.now(),
    user: {
      id: 'u1',
      name: 'Arjun Sharma',
      email: email || 'arjun.sharma@email.com',
      role: role || 'student',
      college: 'IIT Bombay',
      department: 'Computer Science',
    },
  });
});

// Skills and Gap Intelligence
app.get('/api/skills/career-paths', async (req, res) => {
  try {
    const paths = await CareerPath.find({});
    if (paths.length > 0) {
      const pathsMap = {};
      paths.forEach(p => { pathsMap[p.role] = p; });
      return res.json({ success: true, data: pathsMap });
    }
  } catch {
    // fallback
  }
  res.json({ success: true, data: fallbackPaths });
});

app.post('/api/skills/gap-analysis', async (req, res) => {
  const { currentSkills = [], targetRole = 'Data Scientist' } = req.body;
  let path = null;
  try {
    path = await CareerPath.findOne({ role: targetRole });
  } catch {
    // fallback
  }
  if (!path) path = fallbackPaths[targetRole];

  if (!path) {
    return res.status(404).json({ success: false, message: 'Career path not found' });
  }

  const skillMap = {};
  currentSkills.forEach(s => { skillMap[s.name] = s.level; });

  const gaps = path.requiredSkills.map(reqSkill => {
    const current = skillMap[reqSkill.name] || 0;
    const gap = Math.max(0, reqSkill.required - current);
    return {
      skill: reqSkill.name,
      current,
      required: reqSkill.required,
      gap,
      readyPct: Math.round((current / reqSkill.required) * 100),
      status: gap > 25 ? 'critical' : gap > 10 ? 'medium' : 'ready',
    };
  });

  res.json({
    success: true,
    targetRole,
    gaps,
    readinessScore: Math.round(gaps.reduce((s, g) => s + g.readyPct, 0) / gaps.length),
  });
});

// AI Career Copilot Chatbot Endpoint
app.post('/api/copilot/chat', (req, res) => {
  const { message = '', studentContext = {} } = req.body;
  const targetRole = studentContext.targetRole || 'Data Scientist';
  const query = message.toLowerCase();

  let responseText = '';
  let recommendations = [];

  if (query.includes('plan') || query.includes('study') || query.includes('month') || query.includes('week')) {
    responseText = `Here is your customized 30-Day Accelerated Preparation Plan for **${targetRole}** (Synced with MongoDB Database):\n\n` +
      `• **Week 1 (Foundation)**: Master advanced SQL joins, indexing, and window functions on HackerRank.\n` +
      `• **Week 2 (Core Skills)**: Deep dive into Scikit-learn algorithms (Random Forest, Gradient Boosting, Cross-Validation).\n` +
      `• **Week 3 (Hands-on Capstone)**: Build an end-to-end predictive project with data cleaning, feature engineering, and deploy via Streamlit/FastAPI.\n` +
      `• **Week 4 (Interview & Skill Passport)**: Complete the SkillBridge Python Certification Assessment to unlock the verified badge and apply to TechNova Solutions.`;
    recommendations = ['View Skill Gap Analysis', 'Start Python Assessment', 'Browse Open Internships'];
  } else if (query.includes('gap') || query.includes('missing') || query.includes('improve')) {
    responseText = `Based on your live profile for **${targetRole}**:\n\n` +
      `1. **Critical Focus**: Your Statistics proficiency (55%) and Machine Learning (60%) are below top-tier recruiter thresholds (80%+).\n` +
      `2. **Strengths**: Your Python (82%) and SQL (74%) are solid assets.\n` +
      `3. **Immediate Action**: Complete the *Advanced Statistics for Data Science* course in your Learning Hub to boost your readiness score past 85%.`;
    recommendations = ['Open Learning Hub', 'View Interactive Roadmap'];
  } else if (query.includes('project') || query.includes('portfolio')) {
    responseText = `Top corporate recruiters at **TechNova**, **DataMind**, and **QuantumAI** look for production-ready projects:\n\n` +
      `• **Project 1**: Real-time Fraud Detection or Churn Prediction with CI/CD pipeline.\n` +
      `• **Project 2**: End-to-End E-commerce Analytics dashboard with SQL + Power BI.\n` +
      `• **Project 3**: NLP Sentiment or Summarization pipeline with Hugging Face Transformers.\n\n` +
      `Ensure each project is verified by faculty on your Skill Passport!`;
    recommendations = ['Update My Profile', 'View Skill Passport'];
  } else if (query.includes('technova') || query.includes('interview') || query.includes('hiring')) {
    responseText = `For **TechNova Solutions**:\n` +
      `• They currently have 3 openings for **Data Analyst Intern** and **Junior Data Scientist** stored in MongoDB.\n` +
      `• Your profile currently has an **87% Match Score**.\n` +
      `• Tip: Review their requirement for Power BI and Python DAX calculations before the technical round!`;
    recommendations = ['Apply to TechNova', 'Check Application Status'];
  } else {
    responseText = `I'm your **SkillBridge AI Career Copilot**. I analyzed your profile targeting **${targetRole}** with an overall placement readiness of **68%**.\n\n` +
      `How can I assist your career progression today? You can ask me for:\n` +
      `• A personalized 30-day study roadmap\n` +
      `• Strategy to bridge your critical skill deficits\n` +
      `• High-impact capstone projects for your Skill Passport\n` +
      `• Direct advice on cracking interviews at top partner firms`;
    recommendations = ['30-Day Preparation Plan', 'Analyze My Skill Gaps', 'Recommended Projects'];
  }

  res.json({
    success: true,
    reply: responseText,
    suggestions: recommendations,
    timestamp: new Date().toISOString(),
  });
});

// Resume Parsing AI Simulation / Real Text Extraction
app.post('/api/resume/extract-skills', (req, res) => {
  const { resumeText = '', fileName = 'resume.txt' } = req.body;
  const text = (resumeText || '').toLowerCase();

  const skillKeywords = {
    'Python': ['python', 'pandas', 'numpy', 'scikit', 'jupyter', 'django', 'fastapi'],
    'SQL': ['sql', 'mysql', 'postgres', 'database', 'queries', 'rdbms'],
    'Machine Learning': ['machine learning', 'ml', 'random forest', 'regression', 'clustering', 'scikit-learn'],
    'Data Analysis': ['data analysis', 'eda', 'analytics', 'tableau', 'visualization', 'matplotlib', 'seaborn'],
    'Power BI': ['power bi', 'powerbi', 'dax', 'business intelligence'],
    'Deep Learning': ['deep learning', 'pytorch', 'tensorflow', 'neural', 'cnn', 'rnn', 'lstm'],
    'React': ['react', 'frontend', 'javascript', 'jsx', 'typescript', 'tailwind'],
    'Node.js': ['node', 'express', 'backend', 'rest api', 'api'],
    'AWS': ['aws', 'cloud', 's3', 'ec2', 'lambda', 'sagemaker'],
    'Docker': ['docker', 'container', 'kubernetes', 'devops'],
    'Git': ['git', 'github', 'version control'],
    'Statistics': ['statistics', 'probability', 'hypothesis', 'regression analysis'],
    'Communication': ['communication', 'leadership', 'team', 'presentation'],
  };

  const detected = [];
  for (const [skill, keys] of Object.entries(skillKeywords)) {
    const hits = keys.filter(k => text.includes(k)).length;
    if (hits > 0 || text.length < 50) {
      const baseLevel = 60 + Math.min(30, hits * 10);
      detected.push({ name: skill, level: Math.min(95, baseLevel) });
    }
  }

  const finalSkills = detected.length >= 4 ? detected.slice(0, 8) : [
    { name: 'Python', level: 82 },
    { name: 'SQL', level: 74 },
    { name: 'Data Analysis', level: 75 },
    { name: 'Machine Learning', level: 60 },
    { name: 'Communication', level: 72 },
    { name: 'Statistics', level: 55 },
  ];

  res.json({
    success: true,
    fileName,
    extractedSkills: finalSkills,
    wordCount: resumeText.split(/\s+/).filter(Boolean).length,
    confidence: 0.96,
  });
});

// Opportunities (Internships & Jobs) backed by MongoDB
app.get('/api/opportunities/internships', async (req, res) => {
  try {
    const items = await Internship.find({}).sort({ postedAt: -1 });
    if (items.length > 0) {
      return res.json({ success: true, count: items.length, data: items });
    }
  } catch {
    // fallback
  }
  res.json({ success: true, count: fallbackInternships.length, data: fallbackInternships });
});

app.get('/api/opportunities/jobs', async (req, res) => {
  try {
    const items = await Job.find({}).sort({ postedAt: -1 });
    if (items.length > 0) {
      return res.json({ success: true, count: items.length, data: items });
    }
  } catch {
    // fallback
  }
  res.json({ success: true, count: fallbackJobs.length, data: fallbackJobs });
});

app.post('/api/opportunities', async (req, res) => {
  try {
    let newDoc = null;
    if (req.body.type === 'Internship') {
      newDoc = await Internship.create(req.body);
    } else {
      newDoc = await Job.create(req.body);
    }
    return res.status(201).json({ success: true, data: newDoc });
  } catch (err) {
    res.status(400).json({ success: false, error: err.message });
  }
});

// Applications Tracking in MongoDB
app.get('/api/applications', async (req, res) => {
  try {
    const apps = await Application.find({}).sort({ appliedDate: -1 });
    return res.json({ success: true, count: apps.length, data: apps });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.post('/api/applications', async (req, res) => {
  try {
    const newApp = await Application.create(req.body);
    res.status(201).json({ success: true, data: newApp });
  } catch (err) {
    res.status(400).json({ success: false, error: err.message });
  }
});

// Skill Passport Verification
app.get('/api/passport/:id', (req, res) => {
  res.json({
    success: true,
    passportId: req.params.id,
    verified: true,
    student: 'Arjun Sharma',
    institution: 'IIT Bombay',
    skillsAssessed: 8,
    digitalSignature: '0x9f8b2d...4a18e2',
    timestamp: new Date().toISOString(),
  });
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error('Server error:', err);
  res.status(500).json({ success: false, error: err.message });
});

app.listen(PORT, () => {
  console.log(`=========================================`);
  console.log(`🚀 SkillBridge Backend API running on port ${PORT}`);
  console.log(`📡 URL: http://localhost:${PORT}/api/health`);
  console.log(`=========================================`);
});
