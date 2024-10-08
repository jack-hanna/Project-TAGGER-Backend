//Initial setup
const express = require("express");
const app = express();
const port = process.env.PORT || 3000;

app.set("view engine", "ejs");

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static("public"));

var hash = require('pbkdf2-password')()
var path = require('path');
var session = require('express-session');
const { equal } = require("assert");

app.use(session({
  resave: false, // don't save session if unmodified
  saveUninitialized: false, // don't create session until something stored
  secret: 'shhhh, very secret'
}));

app.use(function(req, res, next){
  var err = req.session.error;
  var msg = req.session.success;
  delete req.session.error;
  delete req.session.success;
  res.locals.message = '';
  if (err) res.locals.message = '<p class="msg error">' + err + '</p>';
  if (msg) res.locals.message = '<p class="msg success">' + msg + '</p>';
  next();
});

//Backend Data
//User list
var users = {
  p1: { name: 'p1' },
  p2: { name: 'p2' },
  s: { name: 's' }
};
//User access list
var access = {
  p1: { pages: '/p1' },
  p2: { pages: '/p2' },
  s: { pages: '/s' }
}

//Salting and hashing for user passwords
hash({ password: 'pass1' }, function (err, pass, salt, hash) {
  if (err) throw err;
  users.p1.salt = salt;
  users.p1.hash = hash;
});
hash({ password: 'pass2' }, function (err, pass, salt, hash) {
  if (err) throw err;
  users.p2.salt = salt;
  users.p2.hash = hash;
});
hash({ password: 'pass3' }, function (err, pass, salt, hash) {
  if (err) throw err;
  users.s.salt = salt;
  users.s.hash = hash;
});

//User Authentication
function authenticate(name, pass, fn) {
  if (!module.parent) console.log('authenticating %s:%s', name, pass);
  var user = users[name];
  // query the db for the given username
  if (!user) return fn(null, null)
  // apply the same algorithm to the POSTed password, applying
  // the hash against the pass / salt, if there is a match we
  // found the user
  hash({ password: pass, salt: user.salt }, function (err, pass, salt, hash) {
    if (err) return fn(err);
    if (hash === user.hash) return fn(null, user)
    fn(null, null)
  });
}

//Checks if user has a valid session for the page
function isValidUser(req, res, next){
  if(req.session.user){
    if(access[req.session.user.name].pages == req.route.path){
      return true;
    }
    return false;
  }
  return false;
}

//Prevent invalid users from accessing pages
function restrictPage(req, res, next){
  if(isValidUser(req, res, next)){
    next();
  } else {
    res.redirect('/');
  }
}

app.get('/logout', function(req, res){
  // destroy the user's session to log them out
  // will be re-created next request
  req.session.destroy(function(){
    res.redirect('/');
  });
});

//Routing
app.get('/', function(req, res){
  res.render('login');
});

app.get('/login', function(req, res){
  res.render('login');
});

app.get('/p1', restrictPage, function(req, res){
  res.render('player1');
});

app.get('/p2', restrictPage, function(req, res){
  res.render('player2');
});

app.get('/s', restrictPage, function(req, res){
  res.render('spectator');
});

app.post('/login', function (req, res, next) {
  if (!req.body) return res.sendStatus(400)
  authenticate(req.body.username, req.body.password, function(err, user){
    if (err) return next(err)
    if (user) {
      // Regenerate session when signing in
      // to prevent fixation
      req.session.regenerate(function(){
        // Store the user's primary key
        // in the session store to be retrieved,
        // or in this case the entire user object
        req.session.user = user;
        req.session.success = 'Authenticated as ' + user.name
          + ' click to <a href="/logout">logout</a>. '
          + ' You may now access <a href="/restricted">/restricted</a>.';
        //Redirect to user page
        res.redirect('/' + user.name);
      });
    } else {
      req.session.error = 'Authentication failed, please check your '
        + ' username and password.'
        + ' (use "tj" and "foobar")';
      res.redirect('/login');
    }
  });
});
  
app.listen(port, () => {
    console.log(`Example app listening on port ${port}`)
})