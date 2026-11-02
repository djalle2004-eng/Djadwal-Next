const { executeQuery } = require('../../database.js');
const authService = require('../../services/auth.js');
const auditService = require('../../services/audit.js');

function setAuthCookies(res, { accessToken, rawRefreshToken }) {
  const isProduction = process.env.NODE_ENV === 'production';
  const accessCookieName = isProduction ? '__Host-token' : 'token';
  const refreshCookieName = isProduction ? '__Host-refresh-token' : 'refreshToken';

  res.cookie(accessCookieName, accessToken, {
    httpOnly: true,
    secure: isProduction,
    sameSite: 'lax',
    path: '/',
    maxAge: 15 * 60 * 1000
  });

  if (isProduction && process.env.LEGACY_COOKIE_FALLBACK !== 'false') {
    res.cookie('token', accessToken, {
      httpOnly: true,
      secure: true,
      sameSite: 'lax',
      path: '/',
      maxAge: 15 * 60 * 1000
    });
  }

  if (rawRefreshToken) {
    res.cookie(refreshCookieName, rawRefreshToken, {
      httpOnly: true,
      secure: isProduction,
      sameSite: 'strict',
      path: '/',
      maxAge: 30 * 24 * 60 * 60 * 1000
    });
  }
}

function clearAuthCookies(res) {
  res.clearCookie('token', { path: '/' });
  res.clearCookie('__Host-token', { path: '/' });
  res.clearCookie('refreshToken', { path: '/' });
  res.clearCookie('__Host-refresh-token', { path: '/' });
}

async function handleSignin(req, res) {
  try {
    const loginId = req.body.email || req.body.username;
    const password = req.body.password;
    const mfaCode = req.body.mfaCode || req.body.code;

    if (!loginId || !password) {
      return res.status(400).json({ error: 'البريد الإلكتروني / اسم المستخدم وكلمة المرور مطلوبان' });
    }

    const ip = req.ip || req.headers['x-forwarded-for'] || req.socket?.remoteAddress || '';
    const lockoutKey = `${ip}:${loginId.toLowerCase()}`;

    const lockout = authService.checkBruteForceLockout(lockoutKey);
    if (lockout.isLocked) {
      return res.status(429).json({
        error: 'ACCOUNT_LOCKED_TEMPORARILY',
        message: `تم قفل محاولات تسجيل الدخول مؤقتًا بسبب تكرار المحاولات الخاطئة. يرجى المحاولة بعد ${lockout.remainingSeconds} ثانية.`,
        retryAfter: lockout.remainingSeconds
      });
    }

    const users = await executeQuery(
      'SELECT * FROM users WHERE LOWER(email) = LOWER(?) OR LOWER(username) = LOWER(?)',
      [loginId, loginId]
    );
    const user = users[0];

    const verification = await authService.verifyPassword(user ? user.password_hash : null, password);

    if (!user || !verification.isValid) {
      authService.recordFailedAttempt(lockoutKey);
      await authService.logAuthEvent(user ? user.id : null, 'LOGIN_FAILED', ip, req.headers['user-agent']);
      return res.status(401).json({ error: 'بيانات الدخول غير صحيحة' });
    }

    authService.clearFailedAttempts(lockoutKey);

    if (!user.is_active) {
      return res.status(403).json({ error: 'Account is disabled' });
    }

    if (verification.needsUpgrade) {
      await authService.upgradePasswordHashIfNeeded(user.id, password, true);
    }

    const mfaActive = await authService.isMfaEnabled(user.id);
    if (mfaActive) {
      if (!mfaCode) {
        return res.status(200).json({
          mfaRequired: true,
          userId: user.id,
          message: 'يرجى إدخال رمز التحقق الثنائي (TOTP) أو كود الاسترجاع'
        });
      }

      const mfaVerify = await authService.verifyMfaChallenge(user.id, mfaCode);
      if (!mfaVerify.verified) {
        return res.status(401).json({ error: mfaVerify.error || 'رمز التحقق الثنائي غير صحيح' });
      }
    }

    const session = await authService.createSession({
      userId: user.id,
      email: user.email,
      role: user.role,
      userAgent: req.headers['user-agent'] || '',
      ip
    });

    setAuthCookies(res, {
      accessToken: session.accessToken,
      rawRefreshToken: session.rawRefreshToken
    });

    const safeUser = {
      id: user.id,
      username: user.username || (user.email ? user.email.split('@')[0] : ''),
      email: user.email || '',
      role: user.role,
      full_name: user.full_name || user.username || '',
      professor_id: user.professor_id || null,
      is_active: Boolean(user.is_active),
      created_at: user.created_at || new Date().toISOString()
    };

    res.json({
      ...safeUser,
      user: safeUser,
      sessionId: session.sessionId,
      token: session.accessToken
    });
  } catch (error) {
    console.error('Signin error:', error);
    res.status(500).json({ error: error.message });
  }
}

async function handleSignout(req, res) {
  try {
    const rawRefreshToken = req.cookies['__Host-refresh-token'] || req.cookies.refreshToken;
    if (rawRefreshToken) {
      const tokenHash = authService.hashTokenSha256(rawRefreshToken);
      await executeQuery('UPDATE sessions SET revoked_at = CURRENT_TIMESTAMP WHERE token_hash = ?', [tokenHash]);
    }

    if (req.user && req.user.sessionId) {
      await authService.revokeSession(req.user.sessionId, req.user.userId || req.user.id);
    }

    clearAuthCookies(res);
    res.json({ success: true, message: 'تم تسجيل الخروج بنجاح' });
  } catch (e) {
    clearAuthCookies(res);
    res.json({ success: true });
  }
}

async function handleRefresh(req, res) {
  try {
    const rawRefreshToken = req.cookies['__Host-refresh-token'] || req.cookies.refreshToken || req.body.refreshToken;
    const result = await authService.rotateRefreshToken(rawRefreshToken, {
      userAgent: req.headers['user-agent'] || '',
      ip: req.ip || ''
    });

    if (result.error) {
      clearAuthCookies(res);
      return res.status(result.status || 401).json({
        error: result.error,
        message: result.message || 'فشل تجديد الجلسة'
      });
    }

    setAuthCookies(res, {
      accessToken: result.accessToken,
      rawRefreshToken: result.rawRefreshToken
    });

    res.json({
      success: true,
      user: result.user,
      sessionId: result.sessionId,
      token: result.accessToken
    });
  } catch (error) {
    console.error('Refresh token error:', error);
    clearAuthCookies(res);
    res.status(500).json({ error: error.message });
  }
}

async function handleGetSessions(req, res) {
  try {
    const userId = req.user.userId || req.user.id;
    const sessions = await authService.getUserSessions(userId, req.user.sessionId);
    res.json({ sessions });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
}

async function handleRevokeSession(req, res) {
  try {
    const userId = req.user.userId || req.user.id;
    const { id } = req.params;
    await authService.revokeSession(id, userId);
    res.json({ success: true, revokedSessionId: id });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
}

async function handleForgotPassword(req, res) {
  try {
    const { email } = req.body;
    const result = await authService.requestPasswordRecovery(email, {
      ip: req.ip || '',
      ua: req.headers['user-agent'] || ''
    });

    if (result && result.internalToken && process.env.EMAIL_USER) {
      const resetLink = `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:5173'}/takleef/reset-password?token=${result.internalToken}`;
      try {
        const emailService = require('../../emailService.js');
        emailService.sendEmail(
          email,
          'استعادة كلمة المرور - منصة التكليف',
          `<p>لاستعادة كلمة المرور، يرجى النقر على الرابط التالي (صالح لمدة 15 دقيقة فقط):</p><a href="${resetLink}">${resetLink}</a>`
        ).catch(err => console.error('Error sending reset email:', err.message));
      } catch (_) {}
    }

    res.json({
      success: true,
      message: 'إذا كان البريد الإلكتروني مسجلاً، فستصلك تعليمات استعادة كلمة المرور.'
    });
  } catch (error) {
    console.error('Forgot password error:', error);
    res.json({
      success: true,
      message: 'إذا كان البريد الإلكتروني مسجلاً، فستصلك تعليمات استعادة كلمة المرور.'
    });
  }
}

async function handleResetPassword(req, res) {
  try {
    const { token, newPassword } = req.body;
    const result = await authService.completePasswordReset(token, newPassword);
    if (!result.success) {
      return res.status(400).json({ error: result.error });
    }
    res.json({ success: true, message: 'تم تحديث كلمة المرور بنجاح' });
  } catch (error) {
    console.error('Reset password error:', error);
    res.status(500).json({ error: error.message });
  }
}

async function handleSignup(req, res) {
  try {
    const isOpenSignup = process.env.FEATURE_OPEN_SIGNUP === 'true';
    if (!isOpenSignup) {
      return res.status(403).json({
        error: 'INVITATION_ONLY',
        message: 'التسجيل المباشر معطّل. التسجيل متاح حصراً عبر دعوات رسمية من الإدارة.'
      });
    }
    res.status(403).json({ error: 'INVITATION_ONLY', message: 'التسجيل المباشر معطّل حاليًا.' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
}

async function handleCreateInvitation(req, res) {
  try {
    const currentUserRole = String(req.user?.role || '').toLowerCase();
    if (currentUserRole !== 'admin') {
      return res.status(403).json({ error: 'إنشاء الدعوات مقصور على مسؤولي النظام فقط' });
    }
    const { email, role = 'PROFESSOR' } = req.body;
    const invitation = await authService.createInvitation({
      email,
      role,
      invitedBy: req.user?.id || req.user?.userId
    });
    res.status(201).json(invitation);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
}

module.exports = {
  setAuthCookies,
  clearAuthCookies,
  handleSignin,
  handleSignout,
  handleRefresh,
  handleGetSessions,
  handleRevokeSession,
  handleForgotPassword,
  handleResetPassword,
  handleSignup,
  handleCreateInvitation
};

