var createError = require('http-errors');
var express = require('express');
var path = require('path');
const fs = require('fs');
var cookieParser = require('cookie-parser');
var logger = require('morgan');
const nunjucks = require('nunjucks');

// api-auto-loader 적용하면서 주석 처리
// var indexRouter = require('./routes/index');
// var calcRouter  = require('./routes/myapi/calc');
// var callCalcRouter  = require('./routes/myapi/callCalc');
// var usersRouter = require('./routes/users');
// api-auto-loader 적용하면서 주석 처리


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

// api-auto-loader 적용하면서 주석 처리
// app.use('/', indexRouter);
// app.use('/myapi/calc', calcRouter);
// app.use('/myapi/callCalc', callCalcRouter);
// app.use('/users', usersRouter);
// api-auto-loader 적용하면서 주석 처리


/////// api-auto-loader
// // app.js (중요 부분)
// const express = require('express');
// const path = require('path');
// const fs = require('fs');

// const app = express();

// 기존 미들웨어들 (express.json 등) 선언 후에 자동로더 호출 권장
// 예: app.use(express.json()); app.use(express.urlencoded({ extended: false }));

const ROUTES_DIR = path.join(__dirname, 'routes');

// function autoLoadRoutes(dir) {
//   const entries = fs.readdirSync(dir, { withFileTypes: true });

//   entries.forEach(entry => {
//     const fullPath = path.join(dir, entry.name);

//     // 디렉토리면 재귀
//     if (entry.isDirectory()) {
//       autoLoadRoutes(fullPath);
//       return;
//     }

//     // .js 파일만 처리, 언더스코어로 시작하는 파일은 무시
//     if (!entry.isFile() || !entry.name.endsWith('.js') || entry.name.startsWith('_')) return;

//     try {
//       const mod = require(fullPath);

//       // 패턴 A: 파일이 { basePath, router } 형태로 export 한 경우 (권장)
//       if (mod && mod.basePath && mod.router) {
//         app.use(mod.basePath, mod.router);
//         console.log(`[route-loader] Mounted ${mod.basePath} -> ${fullPath}`);
//         return;
//       }

//       // 패턴 B: 모듈이 express.Router만 export 한 경우, 파일 경로로 자동 유추
//       if (mod && mod.stack && typeof mod === 'function' || (mod && mod.stack)) {
//         // 예: routes/myapi/calc.js -> /myapi/calc
//         const rel = path.relative(ROUTES_DIR, fullPath); // myapi/calc.js
//         const routePath = '/' + rel.replace(/\\/g, '/').replace(/\.js$/, '');
//         app.use(routePath, mod);
//         console.log(`[route-loader] Mounted ${routePath} -> ${fullPath}`);
//         return;
//       }

//       console.warn(`[route-loader] Skipped ${fullPath} (no router/basePath found)`);
//     } catch (err) {
//       console.error(`[route-loader] Error loading ${fullPath}:`, err.message);
//     }
//   });
// }
// ====== [추가] 라우트 탐색/로깅 유틸 ======
function getHandlerName(fn) {
  if (!fn) return '(anonymous)';
  return fn.name && fn.name.length > 0 ? fn.name : '(anonymous)';
}

/**
 * 라우터로부터 모든 라우트 정보를 수집.
 * @param {express.Router|Function} router - express Router 또는 앱
 * @param {string} basePath - 상위 mount 경로 (예: /myapi)
 * @returns {Array<{ method: string, path: string, handlers: string[] }>}
 */
function collectRoutes(router, basePath = '') {
  const routes = [];
  // router는 함수이면서 stack을 가지는 구조
  const stack = router && router.stack ? router.stack : [];

  stack.forEach((layer) => {
    if (layer.route) {
      // 실제 라우트
      const routePath = basePath + (layer.route.path === '/' ? '' : layer.route.path);
      const methods = Object.keys(layer.route.methods)
        .filter((m) => layer.route.methods[m])
        .map((m) => m.toUpperCase());

      // 핸들러 함수명 수집
      const handlers = [];
      (layer.route.stack || []).forEach((h) => {
        // h.handle이 함수
        const fn = h.handle || h;
        handlers.push(getHandlerName(fn));
      });

      methods.forEach((method) => {
        routes.push({ method, path: routePath || '/' , handlers });
      });
    } else if (layer.name === 'router' && layer.handle && layer.handle.stack) {
      // 하위 라우터(mergeParams된 서브 라우터)
      const layerPaths = layer.regexp && layer.regexp.fast_slash
        ? [''] // 빠른 경로일 때
        : (layer.regexp && layer.regexp.toString().includes('^\\/')
            ? [''] // 루트
            : (layer.path ? [layer.path] : []) );

      // 위 방식은 환경에 따라 빈 배열이 될 수 있으므로, 가장 안전하게 path를 추론
      const pathFromLayer = layer.path || (layer.regexp && layer.regexp.fast_slash ? '' : '');
      const childBase = basePath + (pathFromLayer && pathFromLayer !== '/' ? pathFromLayer : '');

      // 재귀적으로 수집
      routes.push(...collectRoutes(layer.handle, childBase));
    }
  });

  return routes;
}

/**
 * 라우터 mount 후, 해당 라우터가 제공하는 모든 라우트를 콘솔에 보기 좋게 출력
 */
function logMountedRoutes(fileFullPath, mountPath, routerOrApp) {
  const routes = collectRoutes(routerOrApp, mountPath);
  if (routes.length === 0) {
    console.log(`[route-loader] Mounted ${mountPath} -> ${fileFullPath} (no routes found)`);
    return;
  }

  console.log(`[route-loader] Mounted ${mountPath} -> ${fileFullPath}`);
  routes.forEach((r) => {
    const handlerList = r.handlers && r.handlers.length ? ` [handlers: ${r.handlers.join(', ')}]` : '';
    console.log(`  • ${r.method.padEnd(6)} ${r.path}${handlerList}`);
  });
}
// ====== [추가 끝] ======


function autoLoadRoutes(dir) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });

  entries.forEach(entry => {
    const fullPath = path.join(dir, entry.name);

    if (entry.isDirectory()) {
      autoLoadRoutes(fullPath);
      return;
    }

    // .js 파일만 처리, 언더스코어 시작 제외
    if (!entry.isFile() || !entry.name.endsWith('.js') || entry.name.startsWith('_')) return;

    try {
      const mod = require(fullPath);

      // 패턴 A: { basePath, router }
      if (mod && mod.basePath && mod.router) {
        app.use(mod.basePath, mod.router);
        // ==== 변경: 상세 라우트 로깅 ====
        logMountedRoutes(fullPath, mod.basePath, mod.router);
        return;
      }

      // 패턴 B: 라우터만 export
      const isRouter =
        (typeof mod === 'function' && mod.stack && Array.isArray(mod.stack)) ||
        (mod && mod.stack && Array.isArray(mod.stack));

      if (isRouter) {
        const rel = path.relative(ROUTES_DIR, fullPath); // myapi/calc.js
        const routePath = '/' + rel.replace(/\\/g, '/').replace(/\.js$/, '');
        app.use(routePath, mod);
        // ==== 변경: 상세 라우트 로깅 ====
        logMountedRoutes(fullPath, routePath, mod);
        return;
      }

      console.warn(`[route-loader] Skipped ${fullPath} (no router/basePath found)`);
    } catch (err) {
      console.error(`[route-loader] Error loading ${fullPath}:`, err.message);
    }
  });
}

// // 자동 로드 실행
// autoLoadRoutes(ROUTES_DIR);

// 실행
if (fs.existsSync(ROUTES_DIR)) {
  autoLoadRoutes(ROUTES_DIR);
} else {
  console.warn('[route-loader] routes directory not found:', ROUTES_DIR);
}
// ---------- 자동 라우트 로더 끝 ----------

// 루트 라우트가 필요하면 명시적으로 추가 (선택)
app.get('/', (req, res) => {
  // public/index.html 이 있으면 자동으로 serve 되지만, 명시적으로 보내려면:
  res.sendFile(path.join(__dirname, 'views', 'index.html'));
});

// catch 404 and forward to error handler
app.use(function(req, res, next) {
  next(createError(404));
});


// 이후 기존 라우트 등록 코드는 제거하거나 중복되지 않도록 정리
// 예: app.use('/', indexRouter);  // indexRouter가 별도라면 유지 가능


// router 단위로 post 제한  /////////////////////////////////////
// POST 전용 API 미들웨어 (app.js, 기본 미들웨어 등록 후 라우트 등록 이전에 추가)
app.use((req, res, next) => {
  // 프리플라이트는 허용
  if (req.method === 'OPTIONS') return next();

  // 예외 경로(항상 허용할 것들)
  const whitelist = [
    '/',                // 루트 페이지
    '/public',          // public
    '/public/*.*',          // public
    '/favicon.ico'
  ];

  // 정적 파일 경로 또는 확장자(정적 서빙) 예외
  const isStatic = req.path.startsWith('/public')
    || req.path.startsWith('/static')
    || /\.\w+$/.test(req.path); // .js .css .png 등

  if (whitelist.includes(req.path) || isStatic) return next();

  // API 판별: 경로 접두사 또는 JSON 관련 헤더가 있으면 API로 간주
  const isApiPath = req.path.startsWith('/api') || req.path.startsWith('/myapi') || req.path.match(/^\/v\d+\b/);
  const acceptsJson = (req.get('Accept') || '').includes('application/json');
  const isJsonContent = !!req.is('application/json');

  const isApiRequest = isApiPath || acceptsJson || isJsonContent;

  // API가 아니면 영향 없음
  if (!isApiRequest) return next();

  // API 요청이면 POST만 허용
  if (req.method !== 'POST') {
    res.set('Allow', 'POST, OPTIONS');
    return res.status(405).json({ error: 'Method Not Allowed. Use POST.' });
  }

  next();
});
// router 단위로 post 제한  /////////////////////////////////////


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
});

module.exports = app;
