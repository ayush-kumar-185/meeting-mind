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

const app = express();

app.use(helmet());
app.use(cors({ origin: process.env.FRONTEND_URL, credentials: true }));
app.use(express.json());
app.use(cookieParser());
app.use(morgan('dev'));
app.use(passport.initialize());


app.get('/health', (req, res) => res.json({ status: 'ok' }));
app.use('/auth', authRoutes);
app.use('/workspaces', workspaceRoutes);

const PORT = process.env.PORT || 5000;

connectMongo().then(() => {
  app.listen(PORT, () =>{
    console.log(`Server running on port ${PORT}`)
  });
});