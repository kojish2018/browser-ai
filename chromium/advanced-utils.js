const log = require('./log');
const {
  // findFieldBySemantic, // セマンティック解析無効化のためコメントアウト
  determineCheckboxRadioValue,
  // analyzePageFieldsSemantics, // セマンティック解析無効化のためコメントアウト
  // getSemanticCategory // セマンティック解析無効化のためコメントアウト
} = require('./semantic-field-mapper');
const {
  autoDetectAndMapFields,
  fillAutoMappedFields,
  getLearningStats
} = require('./auto-field-mapper');

/**
 * 高度なフォームフィールド検出・操作ユーティリティ
 * 様々なフォーム構造に柔軟に対応するマルチレイヤー戦略を実装
 */

/**
 * フィールド検出の戦略定義
 */
const DETECTION_STRATEGIES = {
  DIRECT_ATTRIBUTES: 'direct_attributes',
  STRUCTURAL_RELATION: 'structural_relation', 
  SEMANTIC_ANALYSIS: 'semantic_analysis',
  AI_INFERENCE: 'ai_inference'
};

/**
 * サポートするフィールドタイプ
 */
const FIELD_TYPES = {
  TEXT: ['input[type="text"]', 'input[type="email"]', 'input[type="tel"]', 'input[type="url"]', 'input[type="search"]', 'input:not([type])'],
  TEXTAREA: ['textarea'],
  SELECT: ['select'],
  CHECKBOX: ['input[type="checkbox"]'],
  RADIO: ['input[type="radio"]'],
  FILE: ['input[type="file"]'],
  PASSWORD: ['input[type="password"]'],
  NUMBER: ['input[type="number"]'],
  DATE: ['input[type="date"]', 'input[type="datetime-local"]', 'input[type="time"]']
};

/**
 * 指定された範囲のランダムな待機時間を生成する
 */
const humanLikeDelay = (min = 500, max = 1500) => {
  return new Promise(resolve => setTimeout(resolve, Math.random() * (max - min) + min));
};

/**
 * 人間のように1文字ずつタイピングする（全フィールドタイプ対応・セマンティック対応）
 */
async function humanLikeTyping(field, value, page, configKey = null, fieldData = null, fieldSettings = {}) {
  const tagName = await field.evaluate(el => el.tagName.toLowerCase());
  const inputType = await field.getAttribute('type') || 'text';

  if (tagName === 'select') {
    const fallbackOptions = fieldSettings.fallbackOptions || [];
    await selectOption(field, value, fallbackOptions);
  } else if (inputType === 'checkbox' || inputType === 'radio') {
    await handleCheckboxRadio(field, value, configKey, fieldData);
  } else if (inputType === 'file') {
    await handleFileUpload(field, value);
  } else {
    // テキスト系フィールドの通常処理
    await field.click({ delay: Math.random() * 200 + 50 });
    await field.clear();
    await page.keyboard.type(value, { delay: Math.random() * 150 + 50 });
  }
}

/**
 * select要素のオプション選択（fallbackOptions対応）
 */
async function selectOption(selectField, value, fallbackOptions = []) {
  const allValues = [value, ...fallbackOptions].filter(Boolean);
  
  for (const currentValue of allValues) {
    log.info(`[DEBUG] Trying to select option: ${currentValue}`);
    
    try {
      // 値で選択を試す
      log.info(`[DEBUG] Attempting selection by value: ${currentValue}`);
      await selectField.selectOption({ value: currentValue }, { timeout: 3000 });
      log.info(`Select option selected by value: ${currentValue}`);
      return true;
    } catch (e1) {
      log.info(`[DEBUG] Selection by value failed: ${e1.message}`);
      
      try {
        // ラベルで選択を試す
        log.info(`[DEBUG] Attempting selection by label: ${currentValue}`);
        await selectField.selectOption({ label: currentValue }, { timeout: 3000 });
        log.info(`Select option selected by label: ${currentValue}`);
        return true;
      } catch (e2) {
        log.info(`[DEBUG] Selection by label failed: ${e2.message}`);
        
        try {
          // 部分一致で選択を試す
          log.info(`[DEBUG] Starting partial match search for: ${currentValue}`);
          const startTime = Date.now();
          
          const options = await selectField.locator('option').all();
          const optionsLoadTime = Date.now();
          log.info(`[DEBUG] Loaded ${options.length} options in ${optionsLoadTime - startTime}ms`);
          
          for (let i = 0; i < options.length; i++) {
            const optionStartTime = Date.now();
            const text = await options[i].textContent();
            const textLoadTime = Date.now();
            
            if (text && text.toLowerCase().includes(currentValue.toLowerCase())) {
              log.info(`[DEBUG] Found matching option at index ${i}: ${text} (loaded text in ${textLoadTime - optionStartTime}ms)`);
              await options[i].click();
              log.info(`Select option selected by partial match: ${text} (searched: ${currentValue})`);
              return true;
            } else {
              log.info(`[DEBUG] Option ${i} "${text}" does not match "${currentValue}" (text loaded in ${textLoadTime - optionStartTime}ms)`);
            }
          }
          
          const totalTime = Date.now() - startTime;
          log.warn(`Select option not found for value: ${currentValue} (total search time: ${totalTime}ms)`);
        } catch (e3) {
          log.warn(`Failed to select option ${currentValue}: ${e3.message}`);
        }
      }
    }
  }
  
  log.error(`All select options failed. Tried values: ${allValues.join(', ')}`);
  return false;
}

/**
 * checkbox/radio要素の処理（セマンティック対応）
 */
async function handleCheckboxRadio(field, value, configKey, fieldData = null) {
  const isChecked = await field.isChecked();
  
  // セマンティック情報がある場合はそれを使用
  const shouldCheck = fieldData ? 
    determineCheckboxRadioValue(configKey, fieldData, value) :
    (value === true || value === 'true' || value === '1' || value === 'on');
  
  if (shouldCheck && !isChecked) {
    await field.click();
    log.info(`Checkbox/Radio checked (${configKey})`);
  } else if (!shouldCheck && isChecked) {
    await field.click();
    log.info(`Checkbox/Radio unchecked (${configKey})`);
  } else {
    log.info(`Checkbox/Radio already in correct state (${configKey}: ${shouldCheck})`);
  }
}

/**
 * file input要素の処理
 */
async function handleFileUpload(field, filePath) {
  try {
    await field.setInputFiles(filePath);
    log.info(`File uploaded: ${filePath}`);
  } catch (e) {
    log.error(`Failed to upload file: ${e.message}`);
  }
}

/**
 * お問い合わせページへのリンクを探して遷移する（改良版）
 */
async function findContactPage(page, config) {
  const keywords = config.contactPageKeywords || ['お問い合わせ', 'コンタクト', 'contact', 'inquiry', '問い合わせ'];
  
  for (const keyword of keywords) {
    // より柔軟なセレクタ戦略
    const selectors = [
      `//a[contains(translate(text(), 'ABCDEFGHIJKLMNOPQRSTUVWXYZ', 'abcdefghijklmnopqrstuvwxyz'), '${keyword.toLowerCase()}')]`,
      `//a[contains(translate(@title, 'ABCDEFGHIJKLMNOPQRSTUVWXYZ', 'abcdefghijklmnopqrstuvwxyz'), '${keyword.toLowerCase()}')]`,
      `//a[contains(translate(@href, 'ABCDEFGHIJKLMNOPQRSTUVWXYZ', 'abcdefghijklmnopqrstuvwxyz'), '${keyword.toLowerCase()}')]`,
      `//button[contains(translate(text(), 'ABCDEFGHIJKLMNOPQRSTUVWXYZ', 'abcdefghijklmnopqrstuvwxyz'), '${keyword.toLowerCase()}')]`
    ];

    for (const selector of selectors) {
      const link = page.locator(selector).first();
      try {
        await link.waitFor({ timeout: 2000 });
        if (await link.isVisible()) {
          const linkText = await link.textContent();
          log.info(`Contact page link found: ${linkText?.trim()}`);
          await humanLikeDelay();
          await link.click();
          await page.waitForLoadState('domcontentloaded');
          log.info(`Navigation completed: ${page.url()}`);
          return true;
        }
      } catch (error) {
        continue; // 次のセレクタを試す
      }
    }
  }
  
  log.warn('Contact page link not found');
  return false;
}

/**
 * 高度なフィールド検出システム（マルチレイヤー戦略）
 */
async function findFieldAdvanced(page, keywords, fieldNameForLog, config = {}, usedElements) {
  const strategies = config.detectionStrategies || [
    DETECTION_STRATEGIES.DIRECT_ATTRIBUTES,
    DETECTION_STRATEGIES.STRUCTURAL_RELATION,
    DETECTION_STRATEGIES.SEMANTIC_ANALYSIS
  ];

  for (const strategy of strategies) {
    let field = null;
    
    switch (strategy) {
      case DETECTION_STRATEGIES.DIRECT_ATTRIBUTES:
        field = await findFieldByDirectAttributes(page, keywords, usedElements);
        break;
      case DETECTION_STRATEGIES.STRUCTURAL_RELATION:
        field = await findFieldByStructuralRelation(page, keywords, usedElements);
        break;
      case DETECTION_STRATEGIES.SEMANTIC_ANALYSIS:
        field = await findFieldBySemanticAnalysis(page, keywords, fieldNameForLog);
        break;
      case DETECTION_STRATEGIES.AI_INFERENCE:
        field = await findFieldByAIInference(page, keywords);
        break;
    }

    if (field) {
      // Element Uniqueness Check: 使用済み要素でないことを確認
      if (usedElements) {
        try {
          const elementId = await field.evaluate(el => {
            const name = el.name || '';
            const id = el.id || '';
            const tagName = el.tagName || '';
            const className = el.className || '';
            return `${tagName}:${name}:${id}:${className}`.toLowerCase();
          });
          
          if (usedElements.has(elementId)) {
            log.info(`[UNIQUENESS] Skipping already used element: ${elementId} for field: ${fieldNameForLog}`);
            continue; // この要素は既に使用済みなので次の戦略へ
          }
        } catch (e) {
          log.warn(`Failed to check element uniqueness for ${fieldNameForLog}: ${e.message}`);
        }
      }
      
      log.info(`Field found using ${strategy} strategy: ${fieldNameForLog}`);
      return field;
    }
  }

  log.warn(`Field not found with any strategy: ${fieldNameForLog}`);
  return null;
}

/**
 * 戦略1: 直接属性マッチング（改良版）
 */
async function findFieldByDirectAttributes(page, keywords, usedElements) {
  const allFieldTypes = Object.values(FIELD_TYPES).flat();
  
  for (const keyword of keywords) {
    // 正規表現対応
    const isRegex = keyword.startsWith('/') && keyword.endsWith('/');
    const searchTerm = isRegex ? keyword.slice(1, -1) : keyword;
    
    for (const fieldType of allFieldTypes) {
      const selectors = [
        `${fieldType}[name*="${searchTerm}" i]`,
        `${fieldType}[id*="${searchTerm}" i]`,
        `${fieldType}[placeholder*="${searchTerm}" i]`,
        `${fieldType}[class*="${searchTerm}" i]`,
        `${fieldType}[data-name*="${searchTerm}" i]`
      ];

      for (const selector of selectors) {
        try {
          const field = page.locator(selector).first();
          if (await field.count() > 0 && await field.isVisible()) {
            // デバッグ情報を追加
            const elementInfo = await field.evaluate(el => ({
              tagName: el.tagName,
              type: el.type || 'N/A',
              name: el.name || 'N/A',
              id: el.id || 'N/A',
              className: el.className || 'N/A',
              placeholder: el.placeholder || 'N/A'
            }));
            log.info(`[DEBUG] Field detected - Keyword: "${keyword}", Selector: ${selector}, Element: ${JSON.stringify(elementInfo)}`);
            return field;
          }
        } catch (e) {
          continue;
        }
      }
    }
  }
  return null;
}

/**
 * 戦略2: 構造的関連付け
 */
async function findFieldByStructuralRelation(page, keywords, usedElements) {
  const allFieldTypes = Object.values(FIELD_TYPES).flat();
  
  for (const keyword of keywords) {
    // ラベルからフィールドを探す
    const labelSelectors = [
      `//label[contains(translate(., 'ABCDEFGHIJKLMNOPQRSTUVWXYZ', 'abcdefghijklmnopqrstuvwxyz'), '${keyword.toLowerCase()}')]`,
      `//span[contains(translate(., 'ABCDEFGHIJKLMNOPQRSTUVWXYZ', 'abcdefghijklmnopqrstuvwxyz'), '${keyword.toLowerCase()}')]`,
      `//div[contains(translate(., 'ABCDEFGHIJKLMNOPQRSTUVWXYZ', 'abcdefghijklmnopqrstuvwxyz'), '${keyword.toLowerCase()}')]`
    ];

    for (const labelSelector of labelSelectors) {
      const labels = page.locator(labelSelector);
      const count = await labels.count();
      
      for (let i = 0; i < count; i++) {
        const label = labels.nth(i);
        
        // for属性による関連付け
        const forAttr = await label.getAttribute('for');
        if (forAttr) {
          for (const fieldType of allFieldTypes) {
            const field = page.locator(`${fieldType}#${forAttr}`);
            if (await field.count() > 0 && await field.isVisible()) {
              // デバッグ情報を追加
              const elementInfo = await field.evaluate(el => ({
                tagName: el.tagName,
                type: el.type || 'N/A',
                name: el.name || 'N/A',
                id: el.id || 'N/A',
                className: el.className || 'N/A',
                placeholder: el.placeholder || 'N/A'
              }));
              log.info(`[DEBUG] Structural field detected - Label keyword: "${keyword}", Label for: "${forAttr}", Element: ${JSON.stringify(elementInfo)}`);
              return field;
            }
          }
        }

        // 構造的関連付け（親子・兄弟関係）
        const parent = label.locator('xpath=..');
        for (const fieldType of allFieldTypes) {
          const siblingField = parent.locator(fieldType).first();
          if (await siblingField.count() > 0 && await siblingField.isVisible()) {
            // デバッグ情報を追加
            const elementInfo = await siblingField.evaluate(el => ({
              tagName: el.tagName,
              type: el.type || 'N/A',
              name: el.name || 'N/A',
              id: el.id || 'N/A',
              className: el.className || 'N/A',
              placeholder: el.placeholder || 'N/A'
            }));
            log.info(`[DEBUG] Sibling field detected - Label keyword: "${keyword}", Element: ${JSON.stringify(elementInfo)}`);
            return siblingField;
          }
        }
      }
    }
  }
  return null;
}

/**
 * 戦略3: セマンティック解析（意味的理解による検出）
 */
async function findFieldBySemanticAnalysis(page, keywords, fieldNameForLog) {
  try {
    // セマンティック解析を無効化（重複処理による上書き問題を回避）
    return null;
    
    // 無効化されたコード:
    // const field = await findFieldBySemantic(page, fieldNameForLog, keywords);
    // if (field) {
    //   log.info(`Semantic analysis found field for ${fieldNameForLog}`);
    //   return field;
    // }

    // フォールバック: より広範囲な周辺テキスト解析
    const contextualField = await findFieldByContextualAnalysis(page, keywords);
    if (contextualField) {
      log.info(`Contextual analysis found field for ${fieldNameForLog}`);
      return contextualField;
    }
    
    return null;
  } catch (error) {
    log.warn(`Semantic analysis error for ${fieldNameForLog}: ${error.message}`);
    return null;
  }
}

/**
 * コンテキスト解析による検出（フォールバック）
 */
async function findFieldByContextualAnalysis(page, keywords) {
  try {
    for (const keyword of keywords) {
      // より柔軟なテキスト近接検索
      const proximitySelectors = [
        // テキストを含む要素の次の input/textarea/select
        `//text()[contains(translate(., 'ABCDEFGHIJKLMNOPQRSTUVWXYZ', 'abcdefghijklmnopqrstuvwxyz'), '${keyword.toLowerCase()}')]/following::input[1]`,
        `//text()[contains(translate(., 'ABCDEFGHIJKLMNOPQRSTUVWXYZ', 'abcdefghijklmnopqrstuvwxyz'), '${keyword.toLowerCase()}')]/following::textarea[1]`,
        `//text()[contains(translate(., 'ABCDEFGHIJKLMNOPQRSTUVWXYZ', 'abcdefghijklmnopqrstuvwxyz'), '${keyword.toLowerCase()}')]/following::select[1]`,
        
        // 前の要素
        `//text()[contains(translate(., 'ABCDEFGHIJKLMNOPQRSTUVWXYZ', 'abcdefghijklmnopqrstuvwxyz'), '${keyword.toLowerCase()}')]/preceding::input[1]`,
        `//text()[contains(translate(., 'ABCDEFGHIJKLMNOPQRSTUVWXYZ', 'abcdefghijklmnopqrstuvwxyz'), '${keyword.toLowerCase()}')]/preceding::textarea[1]`,
        
        // 同じ親要素内
        `//*[contains(translate(text(), 'ABCDEFGHIJKLMNOPQRSTUVWXYZ', 'abcdefghijklmnopqrstuvwxyz'), '${keyword.toLowerCase()}')]//input`,
        `//*[contains(translate(text(), 'ABCDEFGHIJKLMNOPQRSTUVWXYZ', 'abcdefghijklmnopqrstuvwxyz'), '${keyword.toLowerCase()}')]//textarea`,
        `//*[contains(translate(text(), 'ABCDEFGHIJKLMNOPQRSTUVWXYZ', 'abcdefghijklmnopqrstuvwxyz'), '${keyword.toLowerCase()}')]//select`
      ];

      for (const selector of proximitySelectors) {
        try {
          const field = page.locator(selector).first();
          if (await field.count() > 0 && await field.isVisible()) {
            return field;
          }
        } catch (e) {
          continue;
        }
      }
    }
    return null;
  } catch (error) {
    return null;
  }
}

/**
 * 戦略4: AI推論ベース
 */
async function findFieldByAIInference(_page, _keywords) {
  // 機械学習モデルを使用した推論
  // この実装では簡略化（将来の拡張用）
  return null;
}

/**
 * 動的コンテンツ対応: 要素の出現を待機
 */
async function waitForDynamicContent(page, selector, timeout = 10000) {
  try {
    await page.waitForSelector(selector, { timeout, state: 'visible' });
    return true;
  } catch (e) {
    return false;
  }
}

/**
 * フォーム全体の構造解析
 */
async function analyzeFormStructure(page) {
  const formInfo = await page.evaluate(() => {
    const forms = Array.from(document.querySelectorAll('form'));
    return forms.map(form => {
      const fields = Array.from(form.querySelectorAll('input, textarea, select'));
      return {
        id: form.id,
        action: form.action,
        method: form.method,
        fieldCount: fields.length,
        fields: fields.map(field => ({
          tagName: field.tagName,
          type: field.type,
          name: field.name,
          id: field.id,
          placeholder: field.placeholder,
          required: field.required
        }))
      };
    });
  });
  
  log.info(`Found ${formInfo.length} forms with structure analysis`);
  return formInfo;
}

/**
 * フォームに自動入力する（改良版・多層フォールバック戦略対応）
 */
async function fillContactFormAdvanced(page, config) {
  log.info('Advanced form filling started with multi-layer fallback strategy');
  let configFilledCount = 0;
  let autoFilledCount = 0;

  // フォーム構造を分析
  await analyzeFormStructure(page);

  // ページ全体のセマンティック解析を事前実行
  // 注意: 重複処理による上書き問題を回避するため、セマンティック解析を無効化
  // const semanticFields = await analyzePageFieldsSemantics(page);
  const semanticFields = [];

  // 動的コンテンツの待機
  if (config.waitForDynamicContent) {
    await humanLikeDelay(2000, 4000);
  }

  // 学習データの統計を表示
  const learningStats = getLearningStats();
  log.info(`Learning stats: ${learningStats.totalMappings} mappings, ${learningStats.successRate} success rate`);

  // ========================================
  // PHASE 1: 設定済みフィールドの処理
  // ========================================
  log.info('Phase 1: Processing configured fields...');
  
  // Element Uniqueness System: 使用済みHTML要素を追跡（2025年業界標準）
  const usedElements = new Set();

  // 必須フィールドを最優先で処理
  const fieldEntries = Object.entries(config.fieldMappings || {});
  const requiredFields = fieldEntries.filter(([, fieldConfig]) => {
    const settings = typeof fieldConfig === 'object' && !Array.isArray(fieldConfig) ? fieldConfig : {};
    return settings.required === true;
  });
  const optionalFields = fieldEntries.filter(([, fieldConfig]) => {
    const settings = typeof fieldConfig === 'object' && !Array.isArray(fieldConfig) ? fieldConfig : {};
    return settings.required !== true;
  });

  // 必須フィールド → オプションフィールドの順で処理
  for (const [key, fieldConfig] of [...requiredFields, ...optionalFields]) {
    const value = config.formData[key];
    if (value === undefined || value === null || value === '') {
      // boolean値やゼロは有効な値として処理
      if (value !== false && value !== 0) continue;
    }

    // 新しい設定形式に対応
    const keywords = Array.isArray(fieldConfig) ? fieldConfig : fieldConfig.keywords || fieldConfig;
    const fieldSettings = typeof fieldConfig === 'object' && !Array.isArray(fieldConfig) ? fieldConfig : {};

    // 多層フォールバック戦略でフィールドを検索（Element Uniqueness適用）
    const field = await findFieldWithFallback(page, keywords, key, fieldSettings, semanticFields, usedElements);
    
    if (field) {
      try {
        await humanLikeScroll(field);
        await humanLikeDelay(300, 800);
        
        // セマンティック情報を無効化（重複処理による上書き問題を回避）
        // const semanticFieldData = semanticFields.find(sf => {
        //   const semanticResult = getSemanticCategory(sf, sf.labelText, sf.name, sf.placeholder);
        //   return semanticResult.category !== 'UNKNOWN' && semanticResult.score > 10;
        // });
        
        // セマンティック情報なしで処理
        await humanLikeTyping(field, value, page, key, null, fieldSettings);
        
        log.info(`Field filled: "${key}" (value: ${typeof value === 'boolean' ? value : `"${value}"`})`);
        configFilledCount++;
        
        // Element Uniqueness: 使用済み要素として記録
        try {
          const elementId = await field.evaluate(el => {
            // ユニークな要素識別子を生成（name, id, xpath組み合わせ）
            const name = el.name || '';
            const id = el.id || '';
            const tagName = el.tagName || '';
            const className = el.className || '';
            return `${tagName}:${name}:${id}:${className}`.toLowerCase();
          });
          usedElements.add(elementId);
          log.info(`[UNIQUENESS] Element marked as used: ${elementId}`);
        } catch (e) {
          log.warn(`Failed to record element uniqueness for ${key}: ${e.message}`);
        }
        
      } catch (e) {
        log.error(`Failed to fill field "${key}": ${e.message}`);
        // エラー時でも続行するか設定で制御
        if (!config.errorHandling?.continueOnFieldError) {
          break;
        }
      }
    } else {
      log.warn(`Field not found with all strategies: "${key}"`);
      // 必須フィールドが見つからない場合の警告
      if (fieldSettings.required) {
        log.error(`Required field "${key}" not found - this may cause form submission to fail`);
      }
    }
  }

  // ========================================
  // PHASE 2: 自動検出フィールドの処理
  // ========================================
  if (config.autoFillUnknownFields !== false) {
    log.info('Phase 2: Processing auto-detected fields...');
    
    try {
      const autoMappedFields = await autoDetectAndMapFields(page, config);
      if (autoMappedFields.length > 0) {
        autoFilledCount = await fillAutoMappedFields(
          page, 
          autoMappedFields, 
          humanLikeTyping, 
          humanLikeScroll, 
          humanLikeDelay
        );
      } else {
        log.info('No unmapped fields detected for auto-filling');
      }
    } catch (error) {
      log.error(`Auto-field mapping failed: ${error.message}`);
    }
  }

  // ========================================
  // PHASE 3: 特別処理（プライバシー同意等）
  // ========================================
  log.info('Phase 3: Special field processing...');
  await ensurePrivacyAgreementChecked(page, config);
  await ensureRequiredFieldsProcessed(page, config);

  const totalConfigFields = Object.keys(config.fieldMappings || {}).length;
  const totalFilledCount = configFilledCount + autoFilledCount;

  log.info(`Form filling completed:`);
  log.info(`  - Configured fields: ${configFilledCount}/${totalConfigFields}`);
  log.info(`  - Auto-detected fields: ${autoFilledCount}`);
  log.info(`  - Total filled: ${totalFilledCount}`);

  return totalFilledCount > 0;
}

/**
 * 多層フォールバック戦略でフィールドを検索
 */
async function findFieldWithFallback(page, keywords, fieldKey, fieldSettings, semanticFields, usedElements) {
  // 戦略1: 通常の高度検索
  let field = await findFieldAdvanced(page, keywords, fieldKey, fieldSettings, usedElements);
  if (field) return field;

  // 戦略2: より寛容なキーワード検索
  if (fieldSettings.fallback) {
    for (const fallbackKeyword of fieldSettings.fallback) {
      field = await findFieldAdvanced(page, [fallbackKeyword], fieldKey, fieldSettings, usedElements);
      if (field) {
        log.info(`Field found using fallback keyword: ${fallbackKeyword}`);
        return field;
      }
    }
  }

  // 戦略3: 正規表現パターン検索
  if (fieldSettings.regex) {
    for (const pattern of fieldSettings.regex) {
      try {
        const regexPattern = pattern.startsWith('/') && pattern.endsWith('/') ? 
          new RegExp(pattern.slice(1, -1), 'i') : 
          new RegExp(pattern, 'i');

        const elements = await page.locator('input, textarea, select').all();
        for (const element of elements) {
          const name = await element.getAttribute('name') || '';
          const id = await element.getAttribute('id') || '';
          const placeholder = await element.getAttribute('placeholder') || '';
          
          if (regexPattern.test(name) || regexPattern.test(id) || regexPattern.test(placeholder)) {
            if (await element.isVisible()) {
              // Element Uniqueness Check: 使用済み要素でないことを確認
              if (usedElements) {
                try {
                  const elementId = await element.evaluate(el => {
                    const name = el.name || '';
                    const id = el.id || '';
                    const tagName = el.tagName || '';
                    const className = el.className || '';
                    return `${tagName}:${name}:${id}:${className}`.toLowerCase();
                  });
                  
                  if (usedElements.has(elementId)) {
                    log.info(`[UNIQUENESS] Skipping already used element: ${elementId} (regex pattern: ${pattern})`);
                    continue; // この要素は既に使用済みなので次の要素へ
                  }
                } catch (e) {
                  log.warn(`Failed to check element uniqueness for regex pattern ${pattern}: ${e.message}`);
                }
              }
              
              log.info(`Field found using regex pattern: ${pattern}`);
              return element;
            }
          }
        }
      } catch (e) {
        log.warn(`Regex pattern failed: ${pattern}`);
      }
    }
  }

  // 戦略4: セマンティック推論による類似フィールド検索
  const targetMapping = {
    'company_name': 'COMPANY',
    'contact_name': 'PERSON_NAME',
    'email': 'EMAIL',
    'phone': 'PHONE',
    'message': 'MESSAGE',
    'prefecture': 'ADDRESS',
    'industry': 'INDUSTRY',
    'budget': 'BUDGET',
    'timeline': 'TIMELINE',
    'privacy_agreement': 'PRIVACY_AGREEMENT',
    'newsletter': 'NEWSLETTER'
  };

  // セマンティック推論を無効化（重複処理による上書き問題を回避）
  // const targetCategory = targetMapping[fieldKey];
  // if (targetCategory) {
  //   const semanticMatches = semanticFields
  //     .filter(sf => sf.semanticCategory === targetCategory && sf.visible && sf.semanticScore > 10)
  //     .sort((a, b) => b.semanticScore - a.semanticScore);

  //   if (semanticMatches.length > 0) {
  //     const match = semanticMatches[0];
  //     const selector = match.id ? `#${match.id}` : 
  //                    match.name ? `[name="${match.name}"]` : 
  //                    `${match.tagName}:nth-of-type(${match.index + 1})`;
      
  //     field = page.locator(selector).first();
  //     if (await field.isVisible().catch(() => false)) {
  //       log.info(`Field found using semantic inference: ${match.name || match.id} (${targetCategory})`);
  //       return field;
  //     }
  //   }
  // }

  // 戦略5: ブルートフォース近似検索
  const searchTerms = [fieldKey, ...keywords].filter(Boolean);
  for (const term of searchTerms) {
    try {
      const fuzzySelector = `//*[contains(translate(text(), 'ABCDEFGHIJKLMNOPQRSTUVWXYZ', 'abcdefghijklmnopqrstuvwxyz'), '${term.toLowerCase().substring(0, 5)}')]/following-sibling::*[self::input or self::textarea or self::select][1]`;
      field = page.locator(fuzzySelector).first();
      if (await field.count() > 0 && await field.isVisible()) {
        log.info(`Field found using fuzzy search: ${term}`);
        return field;
      }
    } catch (e) {
      continue;
    }
  }

  return null;
}

/**
 * 必須フィールドの処理を確実に行う
 */
async function ensureRequiredFieldsProcessed(page, config) {
  try {
    log.info('Ensuring all required fields are processed...');
    
    const requiredSelectors = [
      'input[required]',
      'textarea[required]',
      'select[required]'
    ];

    for (const selector of requiredSelectors) {
      const requiredFields = await page.locator(selector).all();
      
      for (const field of requiredFields) {
        const isEmpty = await field.evaluate(el => {
          const value = el.value || '';
          // 既に意味のある値が入力されている場合はスキップ
          return value.trim() === '' || value === '必須項目';
        });

        if (isEmpty && await field.isVisible()) {
          const fieldName = await field.getAttribute('name') || 
                           await field.getAttribute('id') || 
                           'unknown';
          
          log.warn(`Required field "${fieldName}" is empty, attempting to fill...`);
          
          try {
            await humanLikeScroll(field);
            await humanLikeDelay(200, 500);
            await field.fill('必須項目');
            log.info(`Filled empty required field: ${fieldName}`);
          } catch (e) {
            log.error(`Failed to fill required field ${fieldName}: ${e.message}`);
          }
        }
      }
    }
  } catch (error) {
    log.warn(`Required field processing failed: ${error.message}`);
  }
}

/**
 * プライバシー同意チェックボックスの強制処理
 */
async function ensurePrivacyAgreementChecked(page, config) {
  try {
    log.info('Ensuring privacy agreement checkbox is checked...');
    
    // よくあるプライバシー同意のパターンを網羅的に検索
    const privacySelectors = [
      'input[type="checkbox"][required]',
      'input[type="checkbox"][name*="privacy" i]',
      'input[type="checkbox"][name*="agreement" i]',
      'input[type="checkbox"][name*="consent" i]',
      'input[type="checkbox"][id*="privacy" i]',
      'input[type="checkbox"][id*="agreement" i]',
      'input[type="checkbox"][id*="consent" i]',
      '//label[contains(translate(text(), "ABCDEFGHIJKLMNOPQRSTUVWXYZ", "abcdefghijklmnopqrstuvwxyz"), "同意")]//input[@type="checkbox"]',
      '//label[contains(translate(text(), "ABCDEFGHIJKLMNOPQRSTUVWXYZ", "abcdefghijklmnopqrstuvwxyz"), "個人情報")]//input[@type="checkbox"]',
      '//label[contains(translate(text(), "ABCDEFGHIJKLMNOPQRSTUVWXYZ", "abcdefghijklmnopqrstuvwxyz"), "プライバシー")]//input[@type="checkbox"]'
    ];

    for (const selector of privacySelectors) {
      try {
        const checkbox = page.locator(selector).first();
        if (await checkbox.count() > 0 && await checkbox.isVisible()) {
          const isChecked = await checkbox.isChecked();
          if (!isChecked) {
            await checkbox.click();
            log.info('Privacy agreement checkbox checked automatically');
            break;
          } else {
            log.info('Privacy agreement checkbox already checked');
            break;
          }
        }
      } catch (e) {
        continue;
      }
    }
  } catch (error) {
    log.warn(`Privacy agreement check failed: ${error.message}`);
  }
}

/**
 * 人間のようにスムーズに要素までスクロールする
 */
async function humanLikeScroll(locator) {
  await locator.evaluate(element => {
    element.scrollIntoView({ behavior: 'smooth', block: 'center', inline: 'center' });
  });
  await locator.page().waitForTimeout(1000);
}

/**
 * 送信ボタンをクリックする（改良版）
 */
async function submitFormAdvanced(page, config) {
  log.info('Looking for submit button...');
  
  // 2025年ベストプラクティス: フォーム準備確認
  try {
    await page.waitForSelector('form', { timeout: 5000 });
  } catch (e) {
    log.warn('No form element detected, proceeding with button search');
  }
  
  let submitButton = null;

  // 設定からsubmitKeywordsを正しく読み取り（オブジェクト配列対応）
  const submitKeywords = config.submitKeywords || [
    { text: "送信", priority: 1, selectors: ["button", "input[type=submit]", "a"] },
    { text: "申し込む", priority: 1, selectors: ["button", "a"] }
  ];
  
  // 優先度順でソート（2025年ベストプラクティス）
  submitKeywords.sort((a, b) => (a.priority || 999) - (b.priority || 999));
  
  for (const kwConfig of submitKeywords) {
    const kw = kwConfig.text || kwConfig;
    log.info(`Searching for submit button with keyword: "${kw}"`);
    
    // 2025年ベストプラクティス: getByRole()を最優先使用 + 部分一致検索
    const strategies = [
      () => page.getByRole('button', { name: kw }).first(),
      () => page.getByRole('link', { name: kw }).first(), 
      () => page.locator(`input[type="submit"][value*="${kw}" i]:visible`).first(),
      () => page.locator(`button:has-text("${kw}"):visible`).first(),
      () => page.locator(`a:has-text("${kw}"):visible`).first(),
      () => page.locator(`*[onclick*="${kw}" i]:visible`).first()
    ];

    for (const strategy of strategies) {
      try {
        const button = strategy();
        if (await button.isVisible({ timeout: 1000 })) {
          submitButton = button;
          log.info(`Submit button found: "${kw}" (2025 best practices)`);
          break;
        }
      } catch (e) {
        continue;
      }
    }
    if (submitButton) break;
  }

  if (submitButton) {
    try {
      await submitButton.waitFor({ state: 'visible', timeout: 5000 });
      log.info('Clicking submit button');
      await humanLikeDelay();
      await submitButton.click();
      
      // マルチステップフォームの処理
      return await handleMultiStepFormSubmission(page, config);
    } catch (error) {
      log.warn(`Submit button click failed: ${error.message}`);
      return false;
    }
  } else {
    log.warn('No submit button found matching configured keywords');
    return false;
  }
}

/**
 * マルチステップフォーム送信の処理
 */
async function handleMultiStepFormSubmission(page, config) {
  try {
    // ページ遷移を待つ
    await humanLikeDelay(2000, 3000);
    
    // 確認画面の検出
    const confirmationIndicators = [
      'h1:has-text("確認")', 'h1:has-text("内容確認")', 'h1:has-text("入力内容の確認")',
      '.confirmation-page', '.confirm-page', '#step2-page:not(.hidden)',
      '*:has-text("以下の内容でお問い合わせを送信")', '*:has-text("確認画面")'
    ];
    
    let isConfirmationPage = false;
    for (const selector of confirmationIndicators) {
      try {
        const element = page.locator(selector).first();
        if (await element.isVisible({ timeout: 1000 })) {
          log.info(`確認画面を検出: ${selector}`);
          isConfirmationPage = true;
          break;
        }
      } catch (e) {
        continue;
      }
    }
    
    if (isConfirmationPage) {
      log.info('確認画面が検出されました。最終送信ボタンを探しています...');
      
      // 最終送信ボタンの検出
      const finalSubmitKeywords = ["送信する", "送信", "確定", "Submit", "Send", "Complete"];
      let finalSubmitButton = null;
      
      for (const kw of finalSubmitKeywords) {
        const strategies = [
          () => page.locator(`#submitBtn`).first(),
          () => page.locator(`button:has-text("${kw}")`).first(),
          () => page.locator(`input[type="submit"][value*="${kw}" i]`).first(),
          () => page.getByRole('button', { name: kw }).first(),
          () => page.locator(`*[onclick*="${kw}" i]`).first()
        ];
        
        for (const strategy of strategies) {
          try {
            const button = strategy();
            if (await button.isVisible({ timeout: 1000 })) {
              finalSubmitButton = button;
              log.info(`最終送信ボタンを発見: "${kw}"`);
              break;
            }
          } catch (e) {
            continue;
          }
        }
        if (finalSubmitButton) break;
      }
      
      if (finalSubmitButton) {
        await humanLikeDelay(1000, 2000);
        await finalSubmitButton.click();
        log.info('最終送信ボタンをクリックしました');
        
        // 感謝ページへの遷移を待つ
        await humanLikeDelay(2000, 3000);
        
        // 感謝ページの検出
        const thanksIndicators = [
          'h1:has-text("送信完了")', 'h1:has-text("完了")', 'h1:has-text("ありがとう")',
          '.thanks-page', '.complete-page', '#step3-page:not(.hidden)',
          '*:has-text("お問い合わせありがとう")', '*:has-text("送信が完了")',
          '*:has-text("✓")', '.thanks-icon'
        ];
        
        for (const selector of thanksIndicators) {
          try {
            const element = page.locator(selector).first();
            if (await element.isVisible({ timeout: 2000 })) {
              log.info(`感謝ページを検出: ${selector}`);
              log.info('マルチステップフォーム送信が完了しました');
              return true;
            }
          } catch (e) {
            continue;
          }
        }
        
        log.warn('感謝ページが検出されませんでしたが、送信は完了した可能性があります');
        return true;
      } else {
        log.warn('確認画面で最終送信ボタンが見つかりませんでした');
        return false;
      }
    } else {
      // 通常のフォーム送信（確認画面なし）の場合
      log.info('通常のフォーム送信（確認画面なし）として処理');
      
      // 感謝ページまたは送信完了の確認
      await humanLikeDelay(1000, 2000);
      
      const successIndicators = [
        'h1:has-text("送信完了")', 'h1:has-text("完了")', 'h1:has-text("ありがとう")',
        '*:has-text("送信しました")', '*:has-text("受け付けました")',
        '*:has-text("Thank you")', '*:has-text("Success")'
      ];
      
      for (const selector of successIndicators) {
        try {
          const element = page.locator(selector).first();
          if (await element.isVisible({ timeout: 2000 })) {
            log.info(`送信完了を確認: ${selector}`);
            return true;
          }
        } catch (e) {
          continue;
        }
      }
      
      log.info('送信完了ページは検出されませんでしたが、送信処理は実行されました');
      return true;
    }
  } catch (error) {
    log.error(`マルチステップフォーム処理エラー: ${error.message}`);
    return false;
  }
}

/**
 * 現在のページに主要なフォーム項目が存在するかどうかで、フォームページかどうかを判定する（改良版）
 */
async function isContactFormPageAdvanced(page, config) {
  log.info('Analyzing if current page is a form page...');
  
  const requiredFields = config.requiredFields || ['contact_name', 'email'];
  let foundCount = 0;

  for (const fieldKey of requiredFields) {
    const fieldConfig = config.fieldMappings[fieldKey];
    if (!fieldConfig) continue;

    const keywords = Array.isArray(fieldConfig) ? fieldConfig : fieldConfig.keywords || fieldConfig;
    const field = await findFieldAdvanced(page, keywords, fieldKey);
    if (field) {
      foundCount++;
    }
  }

  const isFormPage = foundCount >= Math.ceil(requiredFields.length * 0.6); // 60%以上見つかればフォームページと判定
  log.info(`Form page detection: ${foundCount}/${requiredFields.length} required fields found. Result: ${isFormPage}`);
  
  return isFormPage;
}

module.exports = {
  humanLikeDelay,
  humanLikeTyping,
  humanLikeScroll,
  findContactPage,
  findFieldAdvanced,
  fillContactFormAdvanced,
  submitFormAdvanced,
  isContactFormPageAdvanced,
  analyzeFormStructure,
  waitForDynamicContent,
  DETECTION_STRATEGIES,
  FIELD_TYPES
};