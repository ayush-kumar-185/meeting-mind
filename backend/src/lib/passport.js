const passport = require('passport');
const GoogleStrategy = require('passport-google-oauth20').Strategy;
const User  = require('../models/user');
const Workspace = require('../models/workspace');

passport.use(new GoogleStrategy({
  clientID: process.env.GOOGLE_CLIENT_ID,
  clientSecret: process.env.GOOGLE_CLIENT_SECRET,
  callbackURL: process.env.GOOGLE_CALLBACK_URL,
}, async (accessToken, refreshToken, profile, done) => {
  try {
    let user = await User.findOne({ googleId: profile.id });

    if (!user) {
      user = await User.create({
        googleId: profile.id,
        name: profile.displayName,
        email: profile.emails[0].value,
        avatarUrl: profile.photos?.[0]?.value,
      });
    }

    // Backfill userId for workspaces where they were invited by email before signing up
    await Workspace.updateMany(
      { 'members.email': user.email, 'members.userId': null },
      { $set: { 'members.$.userId': user._id } }
    );

    return done(null, user);
  } catch (err) {
    return done(err, null);
  }
}));

module.exports = passport;