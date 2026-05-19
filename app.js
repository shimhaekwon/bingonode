require('dotenv').config();
var createError = require('http-errors');
var express = require('express');
var path = require('path');
const fs = require('fs');
var cookieParser = require('cookie-parser');
var morgan = require('morgan');
const nunjucks = require('nunjucks');
const logger = require('./utils/logger.js');

var indexRouter = require('@routes/index');
var calRouter  = require('@routes/calRouter');
var bingoRouter = require('@routes/bingoRouter');
var stockRouter2 = require('@routes/stockRouter2');

var app = express();

// view engine setup
app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'njk');
nunjucks.configure('views', {
  express: app,
  watch: process.env.NODE_ENV !== 'production',
});

app.use(morgan('dev'));
app.use(express.json());
app.use(express.urlencoded({ extended: false }));
app.use(cookieParser());
app.use(express.static(path.join(__dirname, 'public')));

function loggingMiddleware(req, res, next) {
  const reqQuery = JSON.stringify(req.query);
  const rawBody = JSON.stringify(req.body) || '';
  const reqBody = rawBody.length > 500
    ? rawBody.slice(0, 500) + `...(${rawBody.length} bytes)`
    : rawBody;

  logger.info(`req.method:[${req.method}]`);
  logger.info(`req.url:[${req.url}]`);
  logger.info(`req.headers.host:[${req.headers.host}]`);
  logger.info(`req.originalUrl:[${req.originalUrl}]`);
  logger.info(`from ip:[${req.ip}]`);
  logger.info(`req.query:[${reqQuery}]`);
  logger.info(`req.body:[${reqBody}]`);

  next(); // 다음 미들웨어 또는 라우터로 넘어간다
}
app.use(loggingMiddleware);

app.use('/', indexRouter);
app.use('/api/calc/', calRouter);
app.use('/api/bingo/', bingoRouter);
app.use('/api/stock2/', stockRouter2);

// [C 패턴] 부팅 시 백그라운드 sync — DB가 비어있거나 누락 회차가 있으면 자동 채움.
// await 안 함: 서버 시작을 차단하지 않음. 첫 사용자가 빈 DB를 만나면 controller가 폴백.
(async () => {
  try {
    const bingoService = require('@services/bingoService.js');
    const bingoModel   = require('@models/bingoModel.js');
    await bingoModel.ensureReady();   // 스키마 보장
    bingoService.syncLatest()
      .then((r) => logger.info('[boot] bingo syncLatest done', JSON.stringify(r)))
      .catch((e) => logger.warn('[boot] bingo syncLatest failed:', e?.message));
  } catch (e) {
    logger.warn('[boot] bingo init skipped:', e?.message);
  }
})();

// catch 404 and forward to error handler
app.use(function(req, res, next) {
  next(createError(404));
});

//const isDev = req.app.get('env') === 'development';
const isDev = process.env.NODE_ENV === 'development';
logger.info('Current Environment:', process.env.NODE_ENV);
logger.info('Current PORT:', process.env.PORT);

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
    status: err.status || 500,
    url: req.originalUrl,   // 요청된 경로 전달
    stack: isDev ? err.stack : null   // 개발환경에서만 statck 전달
  });
});

module.exports = app;
