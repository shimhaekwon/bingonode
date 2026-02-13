var createError = require('http-errors');
var express = require('express');
var path = require('path');
const fs = require('fs');
var cookieParser = require('cookie-parser');
var logger = require('morgan');
const nunjucks = require('nunjucks');

var indexRouter = require('@routes/index');
var calRouter  = require('@routes/calRouter');
var bingoRouter = require('@routes/bingoRouter');

var app = express();

// view engine setup
app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'njk');
nunjucks.configure('views', { 
  express: app,
  watch: true,
});

app.use(logger('dev'));
app.use(express.json());
app.use(express.urlencoded({ extended: false }));
app.use(cookieParser());
app.use(express.static(path.join(__dirname, 'public')));

function loggingMiddleware(req, res, next) {
  const reqQuery = JSON.stringify(req.query);
  const reqBody = JSON.stringify(req.body);

  console.log(`[${new Date().toISOString()}]`);
  console.log(`req.method:[${req.method}]`);
  console.log(`req.url:[${req.url}]`);
  console.log(`req.headers.host:[${req.headers.host}]`);
  console.log(`req.originalUrl:[${req.originalUrl}]`);
  console.log(`from ip:[${req.ip}]`);
  console.log(`req.query:[${reqQuery}]`);
  console.log(`req.body:[${reqBody}]`);

  next(); // 다음 미들웨어 또는 라우터로 넘어간다
}
app.use(loggingMiddleware);

app.use('/', indexRouter);
app.use('/api/calc/', calRouter);
app.use('/api/bingo/', bingoRouter);

// catch 404 and forward to error handler
app.use(function(req, res, next) {
  next(createError(404));
});

require('dotenv').config();

//const isDev = req.app.get('env') === 'development';
const isDev = process.env.NODE_ENV === 'development';
console.log('Current Environment:',process.env.NODE_ENV);

// error handler
app.use(function(err, req, res, next) {
  // set locals, only providing error in development
  // res.locals.message = err.message;
  //res.locals.error = req.app.get('env') === 'development' ? err : {};

  // render the error page
  res.status(err.status || 500);

  //res.render('error'); >> 아래로 대체
  res.render('error', {
    message: err.message,
    status : err.status || 500,
    url: req.originalUrl,   // 요청된 경로 전달
    stack: isDev ? err.stack : null   // 개발환경에서만 statck 전달
  });


/////// api 자동 loader


});

module.exports = app;
