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
        await humanLikeScroll(field); // ★人間らしいスクロールを追加
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
  let submitButton = null;

  for (const kw of config.submitKeywords) {
    // getByRole is the recommended way for buttons and links, and it performs a substring match by default.
    const button = page.getByRole('button', { name: kw }).first();
    if (await button.isVisible()) {
      submitButton = button;
      log.info(`ボタン「${kw}」を検出しました。`);
      break;
    }
    const link = page.getByRole('link', { name: kw }).first();
    if (await link.isVisible()) {
      submitButton = link;
      log.info(`リンク「${kw}」を検出しました。`);
      break;
    }
    // Fallback for input[type=submit]
    const input = page.locator(`input[type="submit"][value*="${kw}" i]`).first();
    if (await input.isVisible()) {
      submitButton = input;
      log.info(`input[type=submit]「${kw}」を検出しました。`);
      break;
    }
  }

  if (submitButton) {
    try {
      await submitButton.waitFor({ state: 'visible', timeout: 5000 });
      log.info('送信ボタンをクリックします。');
      await humanLikeDelay();
      await submitButton.click();
      return true;
    } catch (error) {
      log.warn(`送信ボタンのクリックに失敗しました: ${error.message}`);
      return false;
    }
  } else {
    log.warn('設定されたキーワードに一致する送信ボタンが見つかりませんでした。');
    return false;
  }
}

/**
 * 人間のようにスムーズに要素までスクロールする
 * @param {import('playwright').Locator} locator
 */
async function humanLikeScroll(locator) {
  await locator.evaluate(element => {
    element.scrollIntoView({ behavior: 'smooth', block: 'center', inline: 'center' });
  });
  // スクロールアニメーションのための待機
  await locator.page().waitForTimeout(1000); // 1秒待機。必要に応じて調整。
}

/**
 * 現在のページに主要なフォーム項目が存在するかどうかで、フォームページかどうかを判定する
 * @param {import('playwright').Page} page
 * @param {object} config
 */
async function isContactFormPage(page, config) {
  log.info('現在のページがフォームページか判定します...');
  const nameKeywords = config.fieldMappings.contact_name || [];
  const emailKeywords = config.fieldMappings.email || [];

  const nameField = await findField(page, nameKeywords, 'contact_name');
  const emailField = await findField(page, emailKeywords, 'email');

  if (nameField && emailField) {
    log.info('主要なフォーム項目（氏名、メール）が見つかりました。フォームページと判定します。');
    return true;
  } else {
    log.warn('主要なフォーム項目が見つかりません。フォームページではないと判定します。');
    return false;
  }
}

module.exports = {
  humanLikeDelay,
  humanLikeTyping,
  findContactPage,
  findField,
  fillContactForm,
  submitForm,
  isContactFormPage,
  humanLikeScroll
};
