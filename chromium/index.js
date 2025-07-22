const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');
const log = require('./log');
const { humanLikeDelay, humanLikeTyping, findContactPage, fillContactForm, submitForm } = require('./utils');

// =============================================================================
// 設定ファイルの読み込み
// =============================================================================
let config;
try {
  const configPath = path.join(__dirname, 'config.json');
  const configFile = fs.readFileSync(configPath, 'utf-8');
  config = JSON.parse(configFile);
  log.info('設定ファイル config.json を読み込みました。');
  if (config.logFile) {
    log.setLogFilePath(path.join(__dirname, config.logFile));
  }
} catch (error) {
  log.fatal(`設定ファイル config.json の読み込みに失敗しました。処理を中断します。: ${error.message}`);
  process.exit(1);
}

// =============================================================================
// メイン処理
// =============================================================================
(async () => {
  const userAgent = config.userAgents[Math.floor(Math.random() * config.userAgents.length)];
  log.info(`使用するユーザーエージェント: ${userAgent}`);

  const browserOptions = {
    headless: false,
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-infobars',
      '--window-position=0,0',
      '--ignore-certifcate-errors',
      '--ignore-certifcate-errors-spki-list'
    ]
  };

  if (config.proxy && config.proxy.enabled && config.proxy.server) {
    browserOptions.proxy = {
      server: config.proxy.server,
      username: config.proxy.username,
      password: config.proxy.password
    };
    log.info(`プロキシを使用します: ${config.proxy.server}`);
  }

  let browser;
  try {
    browser = await chromium.launch(browserOptions);

    const context = await browser.newContext({
      userAgent: userAgent,
      javaScriptEnabled: true,
      viewport: { width: 1280, height: 800 },
      locale: 'ja-JP',
      timezoneId: 'Asia/Tokyo',
    });
    await context.addInitScript(() => {
      Object.defineProperty(navigator, 'webdriver', { get: () => undefined });
    });

    const page = await context.newPage();

    // ブラウザのコンソールログをターミナルに出力
    page.on('console', msg => {
      log.info(`[Browser Console] ${msg.type().toUpperCase()}: ${msg.text()}`);
    });

    // ネットワークリクエストの監視
    page.on('request', request => {
      // EmailJSへのリクエストを特に監視
      if (request.url().includes('api.emailjs.com')) {
        log.info(`[Network Request] EmailJS Request: ${request.method()} ${request.url()}`);
      }
    });

    page.on('requestfinished', request => {
      if (request.url().includes('api.emailjs.com')) {
        log.info(`[Network Request] EmailJS Finished: ${request.method()} ${request.url()} - ${request.response().status()}`);
      }
    });

    page.on('requestfailed', request => {
      if (request.url().includes('api.emailjs.com')) {
        log.error(`[Network Request] EmailJS Failed: ${request.method()} ${request.url()} - ${request.failure().errorText}`);
      }
    });

    // mailto: リンクのナビゲーションをブロック
    await page.route('**/mailto:*', route => {
      log.warn(`mailto: リンクへのナビゲーションをブロックしました: ${route.request().url()}`);
      route.abort();
    });

    const url = process.argv[2] || `file://${__dirname}/contact.html`;
    log.info(`ナビゲーション先のURL: ${url}`);

    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 60000 });
    await humanLikeDelay(1000, 2000);

    // URLが直接フォームページを指している場合は、お問い合わせページ探索をスキップ
    const isDirectFormPage = url.includes('contact-form-test.html'); // または他の識別子

    if (!url.startsWith('file://') && !isDirectFormPage) {
      const foundContactPage = await findContactPage(page, config);
      if (!foundContactPage) {
        log.error('お問い合わせページが見つからなかったため、処理を終了します。');
        return;
      }
      await humanLikeDelay(1000, 2000);
    } else if (isDirectFormPage) {
      log.info('直接フォームページへのURLが指定されたため、お問い合わせページ探索をスキップします。');
    }

    const filled = await fillContactForm(page, config);

    // reCAPTCHAのチェックボックスがあればクリック
    await humanLikeDelay(500, 1500);
    const recaptchaCheckbox = page.locator('iframe[title="reCAPTCHA"]').first().locator('#recaptcha-anchor');
    if (await recaptchaCheckbox.isVisible()) {
      log.info('reCAPTCHAチェックボックスを発見しました。クリックします。');
      await recaptchaCheckbox.click();
      await humanLikeDelay(2000, 4000); // reCAPTCHA処理のための待機
    }

    if (filled) {
      await submitForm(page, config);
      log.info('フォーム送信後、5秒待機します...');
      await page.waitForTimeout(5000);
      log.info(`処理が完了しました。最終的なURL: ${page.url()}`);
    } else {
      log.error('フォームに項目を一つも入力できませんでした。処理を中断します。');
    }

  } catch (error) {
    log.fatal(`予期せぬエラーが発生しました: ${error.message}`);
  } finally {
    // if (browser) {
    //   await browser.close();
    // }
  }
})();
