/**
 * 自動フィールドマッピング・学習機能
 * 設定にないフィールドも自動的に検出・マッピングし、適切なデータを入力する
 */

const log = require('./log');
const { analyzePageFieldsSemantics, SEMANTIC_CATEGORIES } = require('./semantic-field-mapper');
const fs = require('fs');
const path = require('path');

/**
 * セマンティックカテゴリと設定データのマッピング
 */
const SEMANTIC_TO_CONFIG_MAPPING = {
  'COMPANY': 'company_name',
  'PERSON_NAME': 'contact_name', 
  'EMAIL': 'email',
  'PHONE': 'phone',
  'ADDRESS': 'prefecture',
  'INDUSTRY': 'industry',
  'BUDGET': 'budget',
  'TIMELINE': 'timeline',
  'MESSAGE': 'message',
  'PRIVACY_AGREEMENT': 'privacy_agreement',
  'NEWSLETTER': 'newsletter'
};

/**
 * 設定にないフィールドのデフォルトデータ
 */
const DEFAULT_FIELD_DATA = {
  // 会社情報
  'department': '営業部',
  'position': '部長',
  'employee_count': '11-50名',
  'established_year': '2020',
  'website': 'https://example.com',
  'business_description': 'IT関連サービスの提供',
  
  // 個人情報
  'first_name': '太郎',
  'last_name': '山田',
  'gender': '男性',
  'age': '35',
  'title': 'さん',
  
  // 連絡情報
  'fax': '03-1234-5679',
  'postal_code': '100-0001',
  'address1': '東京都千代田区千代田',
  'address2': '1-1-1',
  
  // サービス関連
  'service_type': 'コンサルティング',
  'project_type': '新規開発',
  'priority': '高',
  'urgency': '急ぎ',
  
  // その他
  'comments': '追加のご質問があればお気軽にお問い合わせください。',
  'referral_source': 'Webサイト',
  'how_did_you_hear': 'Google検索',
  'marketing_consent': true,
  'terms_accepted': true
};

/**
 * 学習結果を保存するファイルパス
 */
const LEARNING_DATA_PATH = path.join(__dirname, 'logs', 'field-mapping-learned.json');

/**
 * 学習データの読み込み
 */
function loadLearningData() {
  try {
    if (fs.existsSync(LEARNING_DATA_PATH)) {
      const data = fs.readFileSync(LEARNING_DATA_PATH, 'utf-8');
      return JSON.parse(data);
    }
  } catch (error) {
    log.warn(`Failed to load learning data: ${error.message}`);
  }
  return {
    fieldMappings: {},
    successfulMappings: {},
    failedMappings: {},
    lastUpdate: null
  };
}

/**
 * 学習データの保存
 */
function saveLearningData(data) {
  try {
    const dir = path.dirname(LEARNING_DATA_PATH);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    data.lastUpdate = new Date().toISOString();
    fs.writeFileSync(LEARNING_DATA_PATH, JSON.stringify(data, null, 2));
    log.info('Learning data saved successfully');
  } catch (error) {
    log.error(`Failed to save learning data: ${error.message}`);
  }
}

/**
 * セマンティックカテゴリから適切な値を生成
 */
function generateValueForCategory(category, fieldData, config) {
  const configData = config.formData || {};
  
  // 設定データから対応する値を取得
  const configKey = SEMANTIC_TO_CONFIG_MAPPING[category];
  if (configKey && configData[configKey]) {
    return configData[configKey];
  }
  
  // フィールドタイプに基づいてデフォルト値を設定
  if (fieldData.type === 'checkbox') {
    return category === 'PRIVACY_AGREEMENT' ? true : false;
  }
  
  if (fieldData.type === 'radio') {
    return category === 'INDUSTRY' ? 'IT・ソフトウェア' : null;
  }
  
  // カテゴリ別のデフォルト値
  switch (category) {
    case 'COMPANY':
      return configData.company_name || '株式会社サンプル';
    case 'PERSON_NAME':
      return configData.contact_name || '山田 太郎';
    case 'EMAIL':
      return configData.email || 'sample@example.com';
    case 'PHONE':
      return configData.phone || '03-1234-5678';
    case 'ADDRESS':
      return configData.prefecture || '東京都';
    case 'INDUSTRY':
      return configData.industry || 'IT・ソフトウェア';
    case 'BUDGET':
      return configData.budget || '100万円〜500万円';
    case 'TIMELINE':
      return configData.timeline || '3ヶ月以内';
    case 'MESSAGE':
      return configData.message || 'お問い合わせをさせていただきます。';
    default:
      return fieldData.name ? DEFAULT_FIELD_DATA[fieldData.name] || `Auto-filled: ${fieldData.name}` : 'Auto-filled';
  }
}

/**
 * ページから未設定フィールドを自動検出・マッピング
 */
async function autoDetectAndMapFields(page, config) {
  log.info('Starting automatic field detection and mapping...');
  
  const semanticFields = await analyzePageFieldsSemantics(page);
  const learningData = loadLearningData();
  const autoMappedFields = [];
  
  // 設定済みのフィールド名を収集
  const configuredFields = new Set();
  for (const fieldConfig of Object.values(config.fieldMappings || {})) {
    const keywords = Array.isArray(fieldConfig) ? fieldConfig : (fieldConfig.keywords || []);
    keywords.forEach(keyword => configuredFields.add(keyword.toLowerCase()));
  }
  
  // 未設定フィールドを検出
  for (const fieldData of semanticFields) {
    if (!fieldData.visible || fieldData.semanticScore < 10) continue;
    
    // 既に設定されているフィールドはスキップ
    const fieldIdentifiers = [
      fieldData.name,
      fieldData.id,
      fieldData.labelText
    ].filter(Boolean).map(s => s.toLowerCase());
    
    const isConfigured = fieldIdentifiers.some(id => 
      Array.from(configuredFields).some(configured => 
        configured.includes(id) || id.includes(configured)
      )
    );
    
    if (isConfigured) {
      continue;
    }
    
    // 学習データから既知のマッピングを確認
    const learnedMapping = learningData.fieldMappings[fieldData.name] || 
                          learningData.fieldMappings[fieldData.id];
    
    let mappedValue = null;
    let confidence = fieldData.semanticScore;
    
    if (learnedMapping && learnedMapping.successCount > learnedMapping.failureCount) {
      // 学習済みマッピングを使用
      mappedValue = learnedMapping.value;
      confidence += 20;
      log.info(`Using learned mapping for field ${fieldData.name}: ${mappedValue}`);
    } else {
      // セマンティック推論で値を生成
      mappedValue = generateValueForCategory(fieldData.semanticCategory, fieldData, config);
      log.info(`Generated semantic mapping for field ${fieldData.name} (${fieldData.semanticCategory}): ${mappedValue}`);
    }
    
    if (mappedValue !== null) {
      autoMappedFields.push({
        fieldData,
        value: mappedValue,
        confidence,
        method: learnedMapping ? 'learned' : 'semantic',
        category: fieldData.semanticCategory
      });
    }
  }
  
  log.info(`Auto-detected ${autoMappedFields.length} unmapped fields`);
  return autoMappedFields;
}

/**
 * 自動マッピング結果の学習・記録
 */
function learnFromMappingResult(fieldData, value, success) {
  const learningData = loadLearningData();
  const fieldKey = fieldData.name || fieldData.id;
  
  if (!fieldKey) return;
  
  if (!learningData.fieldMappings[fieldKey]) {
    learningData.fieldMappings[fieldKey] = {
      value,
      successCount: 0,
      failureCount: 0,
      semanticCategory: fieldData.semanticCategory,
      lastUsed: new Date().toISOString()
    };
  }
  
  const mapping = learningData.fieldMappings[fieldKey];
  if (success) {
    mapping.successCount++;
    learningData.successfulMappings[fieldKey] = {
      value,
      timestamp: new Date().toISOString(),
      semanticCategory: fieldData.semanticCategory
    };
  } else {
    mapping.failureCount++;
    learningData.failedMappings[fieldKey] = {
      value,
      timestamp: new Date().toISOString(),
      error: 'Field filling failed'
    };
  }
  
  mapping.lastUsed = new Date().toISOString();
  saveLearningData(learningData);
  
  log.info(`Learned from mapping result: ${fieldKey} = ${value} (${success ? 'SUCCESS' : 'FAILURE'})`);
}

/**
 * 自動フィールド入力の実行
 */
async function fillAutoMappedFields(page, autoMappedFields, humanLikeTyping, humanLikeScroll, humanLikeDelay) {
  let successCount = 0;
  
  log.info(`Attempting to fill ${autoMappedFields.length} auto-mapped fields`);
  
  for (const mapping of autoMappedFields) {
    const { fieldData, value, confidence, method, category } = mapping;
    
    try {
      // フィールド要素を取得
      const selector = fieldData.id ? `#${fieldData.id}` : 
                     fieldData.name ? `[name="${fieldData.name}"]` : 
                     `${fieldData.tagName}:nth-of-type(${fieldData.index + 1})`;
      
      const field = page.locator(selector).first();
      const isVisible = await field.isVisible().catch(() => false);
      
      if (!isVisible) {
        log.warn(`Auto-mapped field not visible: ${fieldData.name || fieldData.id}`);
        learnFromMappingResult(fieldData, value, false);
        continue;
      }
      
      // フィールド入力の実行
      await humanLikeScroll(field);
      await humanLikeDelay(300, 800);
      await humanLikeTyping(field, value, page, `auto_${category.toLowerCase()}`, fieldData);
      
      successCount++;
      learnFromMappingResult(fieldData, value, true);
      
      log.info(`Auto-filled field "${fieldData.name || fieldData.id}" with value "${value}" (${method}, confidence: ${confidence})`);
      
    } catch (error) {
      log.error(`Failed to auto-fill field ${fieldData.name || fieldData.id}: ${error.message}`);
      learnFromMappingResult(fieldData, value, false);
    }
  }
  
  log.info(`Auto-mapping completed. Successfully filled ${successCount}/${autoMappedFields.length} fields`);
  return successCount;
}

/**
 * 学習データの統計情報を取得
 */
function getLearningStats() {
  const data = loadLearningData();
  
  const totalMappings = Object.keys(data.fieldMappings).length;
  const successfulMappings = Object.values(data.fieldMappings).reduce((sum, mapping) => 
    sum + mapping.successCount, 0
  );
  const failedMappings = Object.values(data.fieldMappings).reduce((sum, mapping) => 
    sum + mapping.failureCount, 0
  );
  const successRate = totalMappings > 0 ? (successfulMappings / (successfulMappings + failedMappings) * 100).toFixed(1) : 0;
  
  return {
    totalMappings,
    successfulMappings,
    failedMappings,
    successRate: `${successRate}%`,
    lastUpdate: data.lastUpdate
  };
}

module.exports = {
  autoDetectAndMapFields,
  fillAutoMappedFields,
  learnFromMappingResult,
  loadLearningData,
  saveLearningData,
  getLearningStats,
  generateValueForCategory,
  SEMANTIC_TO_CONFIG_MAPPING,
  DEFAULT_FIELD_DATA
};