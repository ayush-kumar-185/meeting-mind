const path = require("path");

require("dotenv").config({
  path: path.resolve(__dirname, "../.env"),
});

const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const cookieParser = require('cookie-parser');

const connectMongo = require('./lib/mongo');
const passport = require('./lib/passport');
const authRoutes = require('./routes/auth');
const workspaceRoutes = require('./routes/workspaces');
const meetingRoutes = require('./routes/meetings');
const actionItemRoutes = require('./routes/actionItems');
const jiraAuthRoutes = require('./routes/jiraAuth');
const { scheduleDailyOverdueFlagging } = require('./jobs/flagOverdue');
const commitmentRoutes = require('./routes/commitments');
const patternRoutes = require('./routes/patterns');
const { scheduleWeeklyPatternDetection } = require('./jobs/detectPatterns');
require('./jobs/processMeeting');
require('./jobs/detectPatterns'); // starts the worker
require('./jobs/flagOverdue'); // starts the overdue worker




const app = express();

app.set('trust proxy', 1);

app.use(helmet());
app.use(cors({ origin: process.env.FRONTEND_URL, credentials: true }));
app.use(express.json());
app.use(cookieParser());
app.use(morgan('dev'));
app.use(passport.initialize());



app.get('/health', (req, res) => res.json({ status: 'ok' }));
app.use('/auth', authRoutes);
app.use('/workspaces', workspaceRoutes);
app.use('/meetings', meetingRoutes);
app.use('/action-items', actionItemRoutes);
app.use('/auth/jira', jiraAuthRoutes);
app.use('/commitments', commitmentRoutes);
app.use('/patterns', patternRoutes);

const PORT = process.env.PORT || 5000;

connectMongo().then(() => {
  app.listen(PORT, () =>{
    console.log(`Server running on port ${PORT}`)
  });
  scheduleDailyOverdueFlagging();
  scheduleWeeklyPatternDetection();
});