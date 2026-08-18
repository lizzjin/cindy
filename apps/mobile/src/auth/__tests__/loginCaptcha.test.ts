import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

import { parseCaptchaWebViewMessage } from '@/auth/loginCaptchaMessage';

/**
 * 登录人机验证(captcha)移动端测试:
 *  - parseCaptchaWebViewMessage 纯函数(WebView postMessage 回传契约);
 *  - AuthContext 发码前置闸接线(静态源码断言——AuthContext.tsx 整模块依赖
 *    expo/RN 运行时,node vitest 不宜加载,与 loginScenarioHarness 同款模式)。
 */

describe('parseCaptchaWebViewMessage(挑战页 postMessage 回传契约)', () => {
  it('解析 ok/err,拒绝越界与非本契约消息', () => {
    expect(
      parseCaptchaWebViewMessage(
        JSON.stringify({ type: 'cindy-captcha', ok: true, token: 'tok-1' }),
      ),
    ).toEqual({ ok: true, token: 'tok-1' });
    expect(
      parseCaptchaWebViewMessage(
        JSON.stringify({ type: 'cindy-captcha', ok: false, code: 'expired' }),
      ),
    ).toEqual({ ok: false, code: 'expired' });
    // 越界 token(>2048)/ 空 token 拒
    expect(
      parseCaptchaWebViewMessage(
        JSON.stringify({ type: 'cindy-captcha', ok: true, token: 'a'.repeat(2049) }),
      ),
    ).toBeNull();
    expect(
      parseCaptchaWebViewMessage(JSON.stringify({ type: 'cindy-captcha', ok: true, token: '' })),
    ).toBeNull();
    // 非本契约 type / 非 JSON / 缺 ok
    expect(
      parseCaptchaWebViewMessage(JSON.stringify({ type: 'other', ok: true, token: 't' })),
    ).toBeNull();
    expect(parseCaptchaWebViewMessage('not-json')).toBeNull();
    expect(parseCaptchaWebViewMessage(JSON.stringify({ type: 'cindy-captcha' }))).toBeNull();
    // 失败缺 code → 收敛 unknown
    expect(
      parseCaptchaWebViewMessage(JSON.stringify({ type: 'cindy-captcha', ok: false })),
    ).toEqual({ ok: false, code: 'unknown' });
  });
});

describe('AuthContext captcha 闸接线(静态源码断言)', () => {
  const authContextSource = readFileSync(
    resolve(process.cwd(), 'src/auth/AuthContext.tsx'),
    'utf8',
  );
  const loginSource = readFileSync(resolve(process.cwd(), 'app/(auth)/login.tsx'), 'utf8');

  it('discover 的 sole email_code 自动串发路径先过 ensureEmailCaptchaGate', () => {
    const soleBranch = authContextSource.slice(
      authContextSource.indexOf("sole?.type === 'email_code'"),
      authContextSource.indexOf("updateLoginState(\n                reduceAuthFlow(currentState, {\n                  type: 'code-requested'"),
    );
    expect(soleBranch).toContain('ensureEmailCaptchaGate()');
    expect(soleBranch).toContain('requestEmailCodeWithCaptchaFallback');
  });

  it('request-code 分支的 email 路径先过闸,取消不派发', () => {
    const branch = authContextSource.slice(
      authContextSource.indexOf("if (action.type === 'request-code')"),
      authContextSource.indexOf("if (action.type === 'verify-code')"),
    );
    expect(branch).toContain('ensureEmailCaptchaGate()');
    expect(branch).toContain('if (!gate.proceed) return false;');
    expect(branch).toContain('requestEmailCodeWithCaptchaFallback');
  });

  it('挑战页地址由构建区域 authApiBaseUrl + 共享路径常量拼出', () => {
    expect(authContextSource).toContain('CAPTCHA_CHALLENGE_PAGE_PATH');
    expect(authContextSource).toContain(
      "getMobileEndpointForRealm(BUILD_AUTH_REGION, 'authApiBaseUrl')",
    );
  });

  it('login.tsx 渲染 captcha WebView 模态并接回 resolveCaptchaChallenge', () => {
    expect(loginSource).toContain('auth.captchaChallenge');
    expect(loginSource).toContain('LoginCaptchaWebView');
    expect(loginSource).toContain('auth.resolveCaptchaChallenge');
  });
});
