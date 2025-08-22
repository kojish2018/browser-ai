const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');
const log = require('./log');
const {
  humanLikeDelay,
  findContactPage,
  fillContactFormAdvanced,
  submitFormAdvanced,
  isContactFormPageAdvanced,
  analyzeFormStructure,
  waitForDynamicContent
} = require('./advanced-utils');

// =============================================================================
// 設定ファイルの読み込み
// =============================================================================
let config;
try {
  const configPath = path.join(__dirname, 'advanced-config.json');
  const configFile = fs.readFileSync(configPath, 'utf-8');
  config = JSON.parse(configFile);
  log.info('高度な設定ファイル advanced-config.json を読み込みました。');
  if (config.logFile) {
    log.setLogFilePath(path.join(__dirname, config.logFile));
  }
} catch (error) {
  log.fatal(`設定ファイル advanced-config.json の読み込みに失敗しました。処理を中断します。: ${error.message}`);
  process.exit(1);
}

// =============================================================================
// 高度な処理のメイン関数
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
      '--ignore-certifcate-errors-spki-list',
      '--disable-web-security',
      '--disable-features=VizDisplayCompositor'
    ]
  };

  // プロキシ設定
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

    // WebDriver検出回避
    await context.addInitScript(() => {
      Object.defineProperty(navigator, 'webdriver', { get: () => undefined });
      Object.defineProperty(navigator, 'plugins', { get: () => [1, 2, 3, 4, 5] });
      Object.defineProperty(navigator, 'languages', { get: () => ['ja-JP', 'ja'] });
    });

    const page = await context.newPage();

    // 高度なエラーハンドリング
    page.on('console', msg => {
      const type = msg.type();
      if (type === 'error') {
        log.error(`[Browser Console Error] ${msg.text()}`);
      } else {
        log.info(`[Browser Console ${type.toUpperCase()}] ${msg.text()}`);
      }
    });

    page.on('pageerror', error => {
      log.error(`[Page Error] ${error.message}`);
    });

    // mailto: リンクのナビゲーションをブロック
    await page.route('**/mailto:*', route => {
      log.warn(`mailto: リンクへのナビゲーションをブロックしました: ${route.request().url()}`);
      route.abort();
    });

    // ネットワークリクエストの詳細監視
    page.on('request', request => {
      const url = request.url();
      if (url.includes('api.emailjs.com') || url.includes('form') || url.includes('submit')) {
        log.info(`[Network Request] ${request.method()} ${url}`);
      }
    });

    page.on('response', response => {
      const url = response.url();
      if (url.includes('api.emailjs.com') || url.includes('form') || url.includes('submit')) {
        log.info(`[Network Response] ${response.status()} ${url}`);
      }
    });

    page.on('requestfailed', request => {
      log.error(`[Network Failed] ${request.method()} ${request.url()} - ${request.failure().errorText}`);
    });

    // URL設定 - 複数対応
    let targetUrls = [];
    
    if (process.argv[2]) {
      // コマンドライン引数でURL指定
      if (process.argv[2] === 'all') {
        // 'all' 指定で全フォームを処理
        targetUrls = [
          `file://${__dirname}/test-forms/complex-form.html`,
          `file://${__dirname}/test-forms/multi-step-form.html`,
          `file://${__dirname}/test-forms/dynamic-form.html`,
          `file://${__dirname}/test-forms/label-association-form.html`
        ];
      } else {
        // 単一URL指定
        targetUrls = [process.argv[2]];
      }
    } else {
      // デフォルト：設定ファイルから読み込み
      targetUrls = config.targetUrls || [`file://${__dirname}/contact.html`];
    }
    
    log.info(`処理対象URL数: ${targetUrls.length}`);

    // 複数URL処理
    for (let i = 0; i < targetUrls.length; i++) {
      const url = targetUrls[i];
      log.info(`[${i + 1}/${targetUrls.length}] 処理開始: ${url}`);

      // ページ読み込み
      await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 60000 });
    
    // 動的コンテンツの待機
    if (config.detectionSettings.waitForDynamicContent) {
      log.info('動的コンテンツの読み込みを待機中...');
      await humanLikeDelay(config.detectionSettings.retryDelay || 2000, 4000);
      
      // ローディングインジケーターの消失を待つ
      for (const indicator of config.customSelectors.loadingIndicators || []) {
        try {
          await page.waitForSelector(indicator, { state: 'hidden', timeout: 5000 });
          log.info(`ローディングインジケーター "${indicator}" の消失を確認`);
        } catch (e) {
          // ローディングインジケーターがない場合は続行
        }
      }
    }

    await humanLikeDelay(1000, 2000);

    // フォーム構造の分析
    if (config.formAnalysis.enabled) {
      log.info('フォーム構造を分析中...');
      await analyzeFormStructure(page);
    }

    // 現在のページにフォームが存在しない場合のみリンクを探す
    if (!url.startsWith('file://') && !(await isContactFormPageAdvanced(page, config))) {
      log.info('現在のページにフォームが見つからないため、お問い合わせページへのリンクを探します。');
      const foundContactPage = await findContactPage(page, config);
      
      if (!foundContactPage) {
        log.error('お問い合わせページが見つからなかったため、処理を終了します。');
        return;
      }
      
      // ページ遷移後の動的コンテンツ待機
      if (config.detectionSettings.waitForDynamicContent) {
        await humanLikeDelay(config.detectionSettings.retryDelay || 2000, 4000);
      }
      
      // 再度フォーム構造分析
      if (config.formAnalysis.enabled) {
        log.info('遷移後のフォーム構造を再分析中...');
        await analyzeFormStructure(page);
      }
      
    } else {
      log.info('現在のページにフォームが見つかったため、リンク検索をスキップします。');
    }

    // 高度なフォーム入力処理
    log.info('高度なフォーム入力処理を開始します...');
    const filled = await fillContactFormAdvanced(page, config);

    // reCAPTCHAの処理
    await humanLikeDelay(500, 1500);
    
    for (const captchaSelector of config.customSelectors.reCaptcha || []) {
      try {
        const captchaElement = page.locator(captchaSelector).first();
        if (await captchaElement.isVisible()) {
          log.info(`reCAPTCHA要素を発見しました: ${captchaSelector}`);
          
          if (captchaSelector.includes('iframe')) {
            const frame = page.frameLocator(captchaSelector);
            const checkbox = frame.locator('#recaptcha-anchor, .recaptcha-checkbox');
            if (await checkbox.isVisible()) {
              await checkbox.click();
              log.info('reCAPTCHAチェックボックスをクリックしました');
              await humanLikeDelay(2000, 4000);
            }
          } else {
            await captchaElement.click();
            log.info('reCAPTCHA要素をクリックしました');
            await humanLikeDelay(2000, 4000);
          }
          break;
        }
      } catch (e) {
        log.warn(`reCAPTCHA処理でエラー: ${e.message}`);
      }
    }

    // フォーム送信処理
    if (filled) {
      try {
        // 送信前の待機
        if (config.behaviorSettings.beforeSubmitDelay) {
          log.info(`送信前に ${config.behaviorSettings.beforeSubmitDelay}ms 待機します...`);
          await page.waitForTimeout(config.behaviorSettings.beforeSubmitDelay);
        }

        const submitted = await submitFormAdvanced(page, config);
        
        if (submitted) {
          log.info('フォーム送信後、5秒待機します...');
          await page.waitForTimeout(5000);
          
          // 送信結果の確認
          const finalUrl = page.url();
          log.info(`処理が完了しました。最終的なURL: ${finalUrl}`);
          
          // 成功メッセージの確認
          const successSelectors = [
            'text=送信完了', 'text=ありがとうございます', 'text=受付けました',
            'text=Thank you', 'text=Success', '.success', '.complete'
          ];
          
          for (const selector of successSelectors) {
            try {
              const element = page.locator(selector).first();
              if (await element.isVisible()) {
                const text = await element.textContent();
                log.info(`成功メッセージを確認: ${text?.trim()}`);
                break;
              }
            } catch (e) {
              // メッセージが見つからない場合は続行
            }
          }
          
        } else {
          log.error('フォーム送信に失敗しました');
          
          if (config.errorHandling.screenshotOnError) {
            const screenshotPath = path.join(__dirname, 'logs', 'submit_failure.png');
            await page.screenshot({ path: screenshotPath });
            log.error(`失敗時のスクリーンショットを保存しました: ${screenshotPath}`);
          }
        }

      } catch (e) {
        log.error(`送信処理でエラーが発生しました: ${e.message}`);
        
        if (config.errorHandling.screenshotOnError) {
          const screenshotPath = path.join(__dirname, 'logs', 'submit_error.png');
          await page.screenshot({ path: screenshotPath });
          log.error(`エラー時のスクリーンショットを保存しました: ${screenshotPath}`);
        }
      }
      
    } else {
      log.error('フォームに項目を一つも入力できませんでした。処理を中断します。');
      
      if (config.errorHandling.screenshotOnError) {
        const screenshotPath = path.join(__dirname, 'logs', 'form_fill_failure.png');
        await page.screenshot({ path: screenshotPath });
        log.error(`フォーム入力失敗時のスクリーンショットを保存しました: ${screenshotPath}`);
      }
    }

      // 次のURLがある場合は待機時間を追加
      if (i < targetUrls.length - 1) {
        log.info('次のフォーム処理まで待機中...');
        await humanLikeDelay(3000, 5000);
      }
      
      log.info(`[${i + 1}/${targetUrls.length}] 処理完了: ${url}`);
    }

    log.info(`全 ${targetUrls.length} フォームの処理が完了しました`);

  } catch (error) {
    log.fatal(`予期せぬエラーが発生しました: ${error.message}`);
    log.fatal(`スタックトレース: ${error.stack}`);
    
    if (config.errorHandling.screenshotOnError) {
      try {
        const screenshotPath = path.join(__dirname, 'logs', 'fatal_error.png');
        await page.screenshot({ path: screenshotPath });
        log.error(`致命的エラー時のスクリーンショットを保存しました: ${screenshotPath}`);
      } catch (screenshotError) {
        log.error(`スクリーンショット保存に失敗: ${screenshotError.message}`);
      }
    }
    
  } finally {
    // ブラウザを閉じる（開発時はコメントアウト可能）
    // if (browser) {
    //   await browser.close();
    //   log.info('ブラウザを閉じました');
    // }
  }
})();