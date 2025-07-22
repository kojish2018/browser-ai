const log = require('./log');

/**
 * 指定された範囲のランダムな待機時間を生成する
 * @param {number} min - 最小待機時間 (ミリ秒)
 * @param {number} max - 最大待機時間 (ミリ秒)
 */
const humanLikeDelay = (min = 500, max = 1500) => {
  return new Promise(resolve => setTimeout(resolve, Math.random() * (max - min) + min));
};

/**
 * 人間のように1文字ずつタイピングする
 * @param {import('playwright').Locator} field
 * @param {string} value
 * @param {import('playwright').Page} page - pageオブジェクトも渡す
 */
async function humanLikeTyping(field, value, page) {
  await field.click({ delay: Math.random() * 200 + 50 }); // クリックにも少し遅延
  await page.keyboard.type(value, { delay: Math.random() * 150 + 50 }); // 50msから200msのランダムな遅延
}

/**
 * お問い合わせページへのリンクを探して遷移する
 * @param {import('playwright').Page} page
 * @param {object} config
 */
async function findContactPage(page, config) {
  const keywords = ['お問い合わせ', 'コンタクト', 'contact'];
  const linkSelectors = keywords.map(k => `//a[contains(translate(text(), 'ABCDEFGHIJKLMNOPQRSTUVWXYZ', 'abcdefghijklmnopqrstuvwxyz'), '${k.toLowerCase()}')]`);
  const link = await page.locator(linkSelectors.join(' | ')).first();

  try {
    await link.waitFor({ timeout: 5000 });
    const linkText = await link.textContent();
    log.info(`お問い合わせページへのリンクを発見: ${linkText.trim()}`);
    await humanLikeDelay();
    await link.click();
    await page.waitForLoadState('domcontentloaded');
    log.info(`ページ遷移完了: ${page.url()}`);
    return true;
  } catch (error) {
    log.warn('お問い合わせページへのリンクが見つかりませんでした。');
    return false;
  }
}

/**
 * キーワードを元にフォームの入力欄（input/textarea）を特定する
 * @param {import('playwright').Page} page
 * @param {string[]} keywords
 * @param {string} fieldNameForLog
 */
async function findField(page, keywords, fieldNameForLog) {
  for (const keyword of keywords) {
    const directSelector = [
      `input[name*="${keyword}" i]`, `input[id*="${keyword}" i]`, `input[placeholder*="${keyword}" i]`,
      `textarea[name*="${keyword}" i]`, `textarea[id*="${keyword}" i]`, `textarea[placeholder*="${keyword}" i]`
    ].join(', ');

    const directField = page.locator(directSelector).first();
    if (await directField.count() > 0 && await directField.isVisible()) {
      return directField;
    }

    const labelSelector = `//label[contains(translate(., 'ABCDEFGHIJKLMNOPQRSTUVWXYZ', 'abcdefghijklmnopqrstuvwxyz'), '${keyword.toLowerCase()}')]`;
    const labels = page.locator(labelSelector);
    const count = await labels.count();
    if (count > 0) {
      for (let i = 0; i < count; i++) {
        const label = labels.nth(i);
        const forAttr = await label.getAttribute('for');
        if (forAttr) {
          const fieldById = page.locator(`input#${forAttr}, textarea#${forAttr}`);
          if (await fieldById.count() > 0 && await fieldById.isVisible()) {
            return fieldById;
          }
        }
      }
    }
  }
  return null;
}

/**
 * フォームに自動入力する
 * @param {import('playwright').Page} page
 * @param {object} config
 */
async function fillContactForm(page, config) {
  log.info('フォームの自動入力を開始します。');
  let filledCount = 0;

  for (const [key, keywords] of Object.entries(config.fieldMappings)) {
    const value = config.formData[key];
    if (!value) continue;

    const field = await findField(page, keywords, key);
    if (field) {
      try {
        await humanLikeDelay(300, 800);
        await humanLikeTyping(field, value, page);
        log.info(`  "${key}" 項目に入力しました。`);
        filledCount++;
      } catch (e) {
        log.error(`  "${key}" 項目の入力に失敗しました。: ${e.message}`);
      }
    } else {
      log.warn(`  "${key}" の入力欄が見つかりませんでした。`);
    }
  }
  return filledCount > 0;
}

/**
 * 送信ボタンをクリックする
 * @param {import('playwright').Page} page
 * @param {object} config
 */
async function submitForm(page, config) {
  log.info('送信ボタンを探しています...');
  const selectors = config.submitKeywords.map(kw => [
    `button:has-text("${kw}")`, `input[type="submit"][value*="${kw}" i]`,
    `button[title*="${kw}" i]`, `a:has-text("${kw}")`
  ].join(', '));

  const submitButton = page.locator(selectors.join(', ')).first();

  try {
    await submitButton.waitFor({ state: 'visible', timeout: 5000 });
    log.info('送信ボタンをクリックします。');
    await humanLikeDelay();

    // フォームのデフォルト送信イベントをキャンセルするJavaScriptを注入
    await page.evaluate(() => {
      document.querySelectorAll('form').forEach(form => {
        form.addEventListener('submit', (e) => {
          e.preventDefault();
          e.stopPropagation();
        }, { capture: true });
      });
    });

    await submitButton.click();
    return true;
  } catch (error) {
    log.warn('送信ボタンが見つかりませんでした。');
    return false;
  }
}

module.exports = {
  humanLikeDelay,
  humanLikeTyping,
  findContactPage,
  findField,
  fillContactForm,
  submitForm
};
