/**
 * 将登录子树最终生效的 light/dark 模式写入托管挑战页 URL。
 *
 * URL 在 AuthContext 中创建，但首次启动的亮色覆盖只存在于
 * MobileLoginHandoffStage 子树内，因此必须由该子树里的 WebView 补入主题。
 */
export function withLoginCaptchaTheme(url: string, theme: 'light' | 'dark'): string {
  try {
    const themedUrl = new URL(url);
    themedUrl.searchParams.set('theme', theme);
    return themedUrl.toString();
  } catch {
    // 保留既有加载失败路径，由 WebView 的 onError 收敛到卡片内重试态。
    return url;
  }
}
