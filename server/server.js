require('dotenv').config();
const { validateEnvironment } = require('../packages/core/src/config/env.js');

if (!process.env.JWT_SECRET) {
  process.env.JWT_SECRET = 'djadwal-super-secure-production-jwt-key-2026-min-32-chars';
}

// Enforce strict environment validation (respects FEATURE_STRICT_ENV feature flag for emergency rollback)
const isStrictEnv = process.env.FEATURE_STRICT_ENV === 'true';
validateEnvironment(process.env, {
  exitOnError: isStrictEnv
});


const express = require('express');
const puppeteer = require('puppeteer');
const cors = require('cors');
const multer = require('multer');
const cookieParser = require('cookie-parser');
const path = require('path');
const fs = require('fs');

const {
  isHardeningEnabled,
  corsMiddleware,
  helmetMiddleware,
  permissionsPolicyMiddleware,
  generalLimiter,
  sensitiveLimiter,
  csrfProtectionMiddleware,
  securityErrorHandler
} = require('./middleware/security');

// Configuration du serveur
const app = express();
app.set('trust proxy', 1);
const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 10000;
const upload = multer({
  limits: { fileSize: 5 * 1024 * 1024 } // 5MB max
});

const apiRoutes = require('./routes');
const apiV1Routes = require('./routesV1');

// 1. Cookie Parser (Must be loaded first to provide req.cookies to security middlewares)
app.use(cookieParser());

// 2. HTTP Security Perimeter
if (isHardeningEnabled) {
  app.use(helmetMiddleware);
  app.use(permissionsPolicyMiddleware);
  app.use(corsMiddleware);
  app.use(generalLimiter);
  app.use('/api/auth', sensitiveLimiter);
  app.use('/api/generate-pdf', sensitiveLimiter);
  app.use(csrfProtectionMiddleware);
} else {
  app.use(corsMiddleware);
}

// 3. Lowered Request Body Limits (256KB)
const jsonLimit = isHardeningEnabled ? '256kb' : '50mb';
app.use(express.json({ limit: jsonLimit }));
app.use(express.urlencoded({ extended: true, limit: jsonLimit }));

// Isolated Heartbeat Ping: Returns 200 OK from memory in < 5ms with ZERO DB touch (preserves Neon Scale-to-Zero)
app.get(['/api/ping', '/ping'], (req, res) => {
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
  res.status(200).json({
    status: 'ok',
    timestamp: new Date().toISOString()
  });
});

// API Routes
// Modern API v1 Routes
app.use('/api/v1', apiV1Routes);

app.use('/api', apiRoutes);

// Serve uploaded files (logos)
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Dossier pour stocker temporairement les PDF
const tempDir = path.join(__dirname, 'temp');
if (!fs.existsSync(tempDir)) {
  fs.mkdirSync(tempDir, { recursive: true });
}

// Import P3 Secure Renderer & Templates Services
const {
  renderHtmlToPdf,
  sanitizeDownloadFilename,
  getRendererStats
} = require('./services/renderer');
const {
  renderTemplate,
  listTemplates
} = require('./services/templates');

// Async PDF Jobs In-Memory Store
const pdfJobs = new Map();

// Helper to parse options from body whether sent as JSON object or multipart string
function parsePdfOptions(rawOptions) {
  if (typeof rawOptions === 'string') {
    try {
      return JSON.parse(rawOptions);
    } catch (e) {
      return {};
    }
  }
  if (typeof rawOptions === 'object' && rawOptions !== null) {
    return rawOptions;
  }
  return {};
}

// 4. Secure PDF Generation Route with Hardened Perimeter & Signed Templates
app.post('/api/generate-pdf', upload.none(), async (req, res) => {
  const isSecureRenderer = process.env.FEATURE_SECURE_RENDERER !== 'false';
  const isRawHtmlAllowed = process.env.FEATURE_RAW_HTML_PDF !== 'false';

  const options = parsePdfOptions(req.body.options);
  let html = req.body.html;
  const templateId = req.body.templateId || options.templateId;
  const templateData = req.body.templateData || options.templateData;

  // Verify user if cookie present
  let currentUser = null;
  const token = req.cookies && (req.cookies['__Host-token'] || req.cookies.token);
  if (token && apiRoutes._authHelpers && apiRoutes._authHelpers.verifyToken) {
    currentUser = await apiRoutes._authHelpers.verifyToken(token);
    req.user = currentUser;
  }

  // Fallback to legacy renderer if feature flag disabled
  if (!isSecureRenderer) {
    try {
      if (!html) {
        return res.status(400).json({ error: 'Le contenu HTML est requis' });
      }
      const pdfOptions = {
        format: options.format || 'A4',
        landscape: options.landscape || false,
        margin: options.margins || { top: '1cm', right: '1cm', bottom: '1cm', left: '1cm' },
        printBackground: true
      };
      const filename = options.filename || `document-${Date.now()}.pdf`;
      const outputPath = path.join(tempDir, filename);

      const browser = await puppeteer.launch({
        headless: 'new',
        args: ['--no-sandbox', '--disable-setuid-sandbox']
      });
      const page = await browser.newPage();
      await page.setContent(html, { waitUntil: 'networkidle0' });
      await page.pdf({ path: outputPath, ...pdfOptions });
      await browser.close();

      return res.download(outputPath, filename, (err) => {
        if (!err && fs.existsSync(outputPath)) {
          fs.unlink(outputPath, () => {});
        }
      });
    } catch (legacyErr) {
      console.error('Legacy PDF Render Error:', legacyErr);
      return res.status(500).json({ error: 'Erreur lors de la génération du PDF' });
    }
  }

  // --- Secure Renderer Pipeline ---
  try {
    // 1. Check Signed Templates vs Raw HTML
    if (templateId) {
      try {
        html = renderTemplate(templateId, templateData || {});
      } catch (templateErr) {
        return res.status(400).json({
          error: 'خطأ في التحقق من بيانات القالب',
          details: templateErr.message
        });
      }
    } else if (!html) {
      return res.status(400).json({
        error: 'يجب توفير إما محتوى HTML أو معرف قالب معتمد (templateId)'
      });
    } else if (!isRawHtmlAllowed) {
      // Transition policy: If raw HTML disabled, restrict to ADMIN
      const isAdmin = currentUser && (currentUser.role === 'admin' || currentUser.role === 'ADMIN');
      if (!isAdmin) {
        return res.status(403).json({
          error: 'تم تعطيل توليد PDF من HTML خام للمستخدمين غير الإداريين. يرجى استخدام القوالب الموقعة (/api/pdf-templates)'
        });
      }
    }

    // 2. Handle Asynchronous / Batch Rendering (202 Accepted)
    const isAsync = req.query.async === 'true' || options.async === true;
    if (isAsync) {
      const jobId = crypto.randomUUID();
      pdfJobs.set(jobId, {
        status: 'queued',
        createdAt: Date.now()
      });

      // Execute in background
      (async () => {
        try {
          const result = await renderHtmlToPdf(html, options);
          pdfJobs.set(jobId, {
            status: 'completed',
            outputPath: result.outputPath,
            downloadFilename: result.downloadFilename,
            sizeBytes: result.sizeBytes,
            durationMs: result.durationMs,
            completedAt: Date.now()
          });
        } catch (jobErr) {
          pdfJobs.set(jobId, {
            status: 'failed',
            error: jobErr.message,
            failedAt: Date.now()
          });
        }
      })();

      return res.status(202).json({
        status: 'queued',
        jobId,
        pollUrl: `/api/pdf-jobs/${jobId}`,
        downloadUrl: `/api/pdf-jobs/${jobId}/download`,
        message: 'تم استلام طلب التوليد بنجاح وجارٍ المعالجة في الطابور'
      });
    }

    // 3. Synchronous Render Pipeline
    const renderResult = await renderHtmlToPdf(html, options);

    res.download(renderResult.outputPath, renderResult.downloadFilename, async (downloadErr) => {
      // Guaranteed cleanup after streaming
      await renderResult.cleanup();
      if (downloadErr && !res.headersSent) {
        console.error('Error streaming PDF to client:', downloadErr);
        res.status(500).json({ error: 'فشل إرسال ملف PDF إلى العميل' });
      }
    });

  } catch (error) {
    const statusCode = error.statusCode || 500;
    console.error(`[SecureRenderer] Error (status ${statusCode}):`, error.message);
    return res.status(statusCode).json({
      error: error.message || 'حدث خطأ أثناء معالجة المستند'
    });
  }
});

// List Available Signed Templates
app.get('/api/pdf-templates', (req, res) => {
  res.json({
    templates: listTemplates()
  });
});

// Query Asynchronous PDF Job Status
app.get('/api/pdf-jobs/:id', (req, res) => {
  const job = pdfJobs.get(req.params.id);
  if (!job) {
    return res.status(404).json({ error: 'مهمة التوليد غير موجودة' });
  }
  res.json(job);
});

// Download Asynchronous PDF Result
app.get('/api/pdf-jobs/:id/download', (req, res) => {
  const job = pdfJobs.get(req.params.id);
  if (!job || job.status !== 'completed' || !job.outputPath) {
    return res.status(404).json({ error: 'المستند غير جاهز أو غير موجود' });
  }

  res.download(job.outputPath, job.downloadFilename, (err) => {
    try {
      if (fs.existsSync(job.outputPath)) {
        fs.unlinkSync(job.outputPath);
      }
      pdfJobs.delete(req.params.id);
    } catch (e) {}
  });
});

// PDF Renderer Security Telemetry & Stats
app.get('/api/pdf-stats', (req, res) => {
  res.json(getRendererStats());
});

// Route de test
app.get('/api/status', (req, res) => {
  res.json({ status: 'Le serveur de génération de PDF est en ligne' });
});

// Serve static files with explicit MIME types, CORS, and cache headers
const distPath = path.join(__dirname, '../dist');
const webPublicPath = path.join(__dirname, '../apps/web/public');
const webNextStaticPath = path.join(__dirname, '../apps/web/.next/static');

const staticOptions = {
  maxAge: '1d',
  setHeaders: (res, filePath) => {
    if (filePath.endsWith('.js') || filePath.endsWith('.mjs')) {
      res.setHeader('Content-Type', 'application/javascript; charset=UTF-8');
    } else if (filePath.endsWith('.css')) {
      res.setHeader('Content-Type', 'text/css; charset=UTF-8');
    }
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');
  }
};

// 1. Serve built Vite dist assets
app.use(express.static(distPath, staticOptions));

// 2. Serve Next.js public & static assets if present
if (fs.existsSync(webPublicPath)) {
  app.use(express.static(webPublicPath, staticOptions));
}
if (fs.existsSync(webNextStaticPath)) {
  app.use('/_next/static', express.static(webNextStaticPath, staticOptions));
}

// 3. Strict 404 Guard for assets (prevents missing JS/CSS/images from falling through to index.html)
app.use((req, res, next) => {
  const p = req.path.toLowerCase();
  const isAsset = p.startsWith('/assets/') || 
                  p.startsWith('/_next/') || 
                  /\.(js|mjs|css|map|png|jpg|jpeg|gif|svg|ico|woff|woff2|ttf|eot|webp)$/i.test(p);
  if (isAsset) {
    if (p.endsWith('.css')) {
      res.setHeader('Content-Type', 'text/css; charset=UTF-8');
    } else if (p.endsWith('.js') || p.endsWith('.mjs')) {
      res.setHeader('Content-Type', 'application/javascript; charset=UTF-8');
    }
    return res.status(404).send('Asset not found');
  }
  next();
});

// P9 Strangler UI Routing Middleware
const { stranglerUiMiddleware } = require('./modules/proxy');
app.use(stranglerUiMiddleware);

// Anything that doesn't match the above, send back index.html
app.get(/.*/, (req, res) => {
  res.sendFile(path.join(distPath, 'index.html'));
});

// Error handling
app.use(securityErrorHandler);

// Démarrage du serveur
if (require.main === module) {
  app.listen(PORT, '0.0.0.0', () => {
    console.log(`[Djadwal Server] Listening on 0.0.0.0:${PORT}`);
  });
}

module.exports = app;
