/**
 * セマンティック（意味的）フィールドマッピングシステム
 * フィールド名やラベルの意味を理解して、より柔軟にマッピングを行う
 */

const log = require('./log');

/**
 * フィールドタイプの意味的カテゴリ定義
 */
const SEMANTIC_CATEGORIES = {
  // 企業・組織情報
  COMPANY: {
    keywords: [
      // 日本語
      '会社', '企業', '法人', '団体', '組織', '事業者', 'corp', 'company', 'organization', 'corporate', 
      '株式会社', '合同会社', '有限会社', '社名', '商号', '会社名', '企業名', '法人名', '団体名',
      // 英語
      'corporation', 'business', 'firm', 'enterprise', 'inc', 'llc', 'ltd',
      // フィールド名パターン
      'corp_name', 'company_name', 'corporate_name', 'org_name', 'organization_name'
    ],
    patterns: [
      /company/i, /corp/i, /organization/i, /business/i, /firm/i, /enterprise/i,
      /会社/g, /企業/g, /法人/g, /団体/g, /組織/g
    ]
  },

  // 個人名情報
  PERSON_NAME: {
    keywords: [
      // 一般的な名前
      '名前', '氏名', 'name', 'fullname', 'full_name', '姓名', 
      // 担当者・代表者
      '担当者', '代表者', '責任者', '連絡担当者', 'contact_person', 'representative', 'person_in_charge',
      'rep_name', 'contact_name', 'representative_name', 'person_name', 'your_name',
      // 役職付き
      '代表取締役', '社長', '部長', '課長', '主任', 'ceo', 'manager', 'director',
      // フィールド名パターン
      'customer_name', 'client_name', 'user_name', 'applicant_name'
    ],
    patterns: [
      /name/i, /氏名/g, /名前/g, /担当/g, /代表/g, /責任/g,
      /representative/i, /contact.*person/i, /person.*name/i
    ]
  },

  // メールアドレス
  EMAIL: {
    keywords: [
      'email', 'mail', 'e-mail', 'メール', 'アドレス', 'メルアド', 'e_mail', 'email_address',
      'mail_address', 'contact_email', 'your_email', 'customer_email', 'client_email',
      'business_email', 'work_email', 'office_email'
    ],
    patterns: [
      /email/i, /mail/i, /メール/g, /アドレス/g, /@/
    ]
  },

  // 電話番号
  PHONE: {
    keywords: [
      '電話', '携帯', 'phone', 'tel', 'mobile', 'cell', '電話番号', '携帯番号', 'telephone',
      'phone_number', 'tel_number', 'mobile_number', 'cell_number', 'contact_phone',
      'business_phone', 'office_phone', 'work_phone', 'fax', 'ファックス'
    ],
    patterns: [
      /phone/i, /tel/i, /mobile/i, /cell/i, /電話/g, /携帯/g, /番号/g
    ]
  },

  // 住所・地域
  ADDRESS: {
    keywords: [
      '住所', '所在地', '地域', '都道府県', '県', '市', '区', '町', '村',
      'address', 'location', 'prefecture', 'region', 'area', 'state', 'city', 'district',
      'postal_code', '郵便番号', 'zip_code', 'zip', '〒'
    ],
    patterns: [
      /address/i, /location/i, /prefecture/i, /region/i, /住所/g, /所在/g, /地域/g, /都道府県/g
    ]
  },

  // 業界・業種
  INDUSTRY: {
    keywords: [
      '業界', '業種', '職種', '事業', 'industry', 'business_type', 'sector', 'field',
      'business_category', 'industry_type', 'work_field', 'profession', 'occupation'
    ],
    patterns: [
      /industry/i, /business.*type/i, /sector/i, /業界/g, /業種/g, /職種/g
    ]
  },

  // 予算
  BUDGET: {
    keywords: [
      '予算', '金額', '費用', '価格', 'budget', 'cost', 'price', 'amount', 'fee',
      'budget_range', 'cost_range', 'price_range', 'investment', '投資額'
    ],
    patterns: [
      /budget/i, /cost/i, /price/i, /amount/i, /予算/g, /金額/g, /費用/g, /円/g
    ]
  },

  // 時期・期間
  TIMELINE: {
    keywords: [
      '時期', '期間', '導入時期', 'timeline', 'schedule', 'period', 'duration', 'timeframe',
      'start_date', 'end_date', 'deadline', '開始時期', '完了時期', '納期'
    ],
    patterns: [
      /timeline/i, /schedule/i, /period/i, /time/i, /時期/g, /期間/g, /導入/g
    ]
  },

  // お問い合わせ内容
  MESSAGE: {
    keywords: [
      'メッセージ', 'お問い合わせ', '内容', '詳細', '要望', '相談',
      'message', 'inquiry', 'content', 'details', 'description', 'comment',
      'inquiry_details', 'message_content', 'consultation', 'request',
      '問い合わせ内容', 'お問合せ', 'ご相談', 'ご要望'
    ],
    patterns: [
      /message/i, /inquiry/i, /content/i, /details/i, /comment/i,
      /お問い?合わせ/g, /内容/g, /詳細/g, /相談/g, /要望/g
    ]
  },

  // 同意・プライバシー
  PRIVACY_AGREEMENT: {
    keywords: [
      '同意', '規約', 'プライバシー', '個人情報', 'privacy', 'agreement', 'consent', 'terms',
      'privacy_policy', 'privacy_agreement', 'terms_agreement', 'personal_info',
      '個人情報保護', 'プライバシーポリシー', '利用規約', '取扱方針'
    ],
    patterns: [
      /privacy/i, /agreement/i, /consent/i, /terms/i, /policy/i,
      /同意/g, /規約/g, /プライバシー/g, /個人情報/g
    ]
  },

  // メルマガ・ニュースレター
  NEWSLETTER: {
    keywords: [
      'メルマガ', 'ニュースレター', 'お知らせ', '情報配信', 'newsletter', 'mailing_list',
      'email_updates', 'notifications', 'updates', '配信希望', 'subscription'
    ],
    patterns: [
      /newsletter/i, /mailing/i, /updates/i, /notification/i,
      /メルマガ/g, /配信/g, /お知らせ/g, /情報/g
    ]
  }
};

/**
 * フィールドの意味的カテゴリを判定する
 */
function getSemanticCategory(fieldElement, labelText, fieldName, placeholder) {
  const allText = [
    fieldName || '',
    labelText || '', 
    placeholder || '',
    fieldElement?.id || '',
    fieldElement?.className || ''
  ].join(' ').toLowerCase();

  const scores = {};
  
  for (const [category, config] of Object.entries(SEMANTIC_CATEGORIES)) {
    let score = 0;
    
    // キーワードマッチ
    for (const keyword of config.keywords) {
      if (allText.includes(keyword.toLowerCase())) {
        score += 10;
      }
    }
    
    // パターンマッチ
    for (const pattern of config.patterns) {
      if (pattern.test(allText)) {
        score += 15;
      }
    }
    
    // フィールドタイプによるボーナス
    if (fieldElement) {
      const tagName = fieldElement.tagName?.toLowerCase();
      const inputType = fieldElement.type?.toLowerCase();
      
      if (category === 'EMAIL' && inputType === 'email') score += 50;
      if (category === 'PHONE' && inputType === 'tel') score += 50;
      if (category === 'MESSAGE' && tagName === 'textarea') score += 30;
      if (category === 'PRIVACY_AGREEMENT' && inputType === 'checkbox') score += 20;
      if (category === 'NEWSLETTER' && inputType === 'checkbox') score += 20;
    }
    
    if (score > 0) {
      scores[category] = score;
    }
  }
  
  // 最高スコアのカテゴリを返す
  const bestCategory = Object.entries(scores).reduce((a, b) => scores[a[0]] > scores[b[0]] ? a : b, ['UNKNOWN', 0]);
  
  return {
    category: bestCategory[0],
    score: bestCategory[1],
    allScores: scores
  };
}

/**
 * 設定データの意図とフィールドの意味的マッチング
 */
function findSemanticFieldMapping(configKey, detectedFields) {
  const configCategoryMap = {
    'company_name': 'COMPANY',
    'contact_name': 'PERSON_NAME', 
    'email': 'EMAIL',
    'phone': 'PHONE',
    'prefecture': 'ADDRESS',
    'industry': 'INDUSTRY',
    'budget': 'BUDGET',
    'timeline': 'TIMELINE',
    'message': 'MESSAGE',
    'privacy_agreement': 'PRIVACY_AGREEMENT',
    'newsletter': 'NEWSLETTER'
  };
  
  const targetCategory = configCategoryMap[configKey];
  if (!targetCategory) return null;
  
  // 該当カテゴリのフィールドを探す
  const candidates = detectedFields
    .filter(field => field.semanticCategory === targetCategory)
    .sort((a, b) => b.semanticScore - a.semanticScore);
  
  return candidates.length > 0 ? candidates[0] : null;
}

/**
 * ページ内の全フィールドを意味的に解析
 */
async function analyzePageFieldsSemantics(page) {
  const fieldsData = await page.evaluate(() => {
    const fields = [];
    const allInputs = document.querySelectorAll('input, textarea, select');
    
    allInputs.forEach((element, index) => {
      // ラベル文字列の取得
      let labelText = '';
      
      // 1. for属性でのラベル
      if (element.id) {
        const label = document.querySelector(`label[for="${element.id}"]`);
        if (label) labelText = label.textContent.trim();
      }
      
      // 2. 親要素のラベル
      if (!labelText) {
        const parentLabel = element.closest('label');
        if (parentLabel) {
          labelText = parentLabel.textContent.replace(element.value || '', '').trim();
        }
      }
      
      // 3. 近接するテキスト（前の要素、親の子要素等）
      if (!labelText) {
        const parent = element.parentElement;
        if (parent) {
          const textNodes = [];
          // 親要素内のテキストを収集
          const walker = document.createTreeWalker(
            parent,
            NodeFilter.SHOW_TEXT,
            null,
            false
          );
          
          let node;
          while (node = walker.nextNode()) {
            const text = node.textContent.trim();
            if (text && !text.match(/^\s*$/)) {
              textNodes.push(text);
            }
          }
          labelText = textNodes.join(' ').substring(0, 100);
        }
      }
      
      fields.push({
        index,
        tagName: element.tagName.toLowerCase(),
        type: element.type || '',
        name: element.name || '',
        id: element.id || '',
        className: element.className || '',
        placeholder: element.placeholder || '',
        labelText: labelText,
        required: element.required || false,
        visible: element.offsetWidth > 0 && element.offsetHeight > 0
      });
    });
    
    return fields;
  });
  
  // 意味的カテゴリを判定
  const analyzedFields = fieldsData.map(field => {
    const semanticResult = getSemanticCategory(field, field.labelText, field.name, field.placeholder);
    return {
      ...field,
      semanticCategory: semanticResult.category,
      semanticScore: semanticResult.score,
      allSemanticScores: semanticResult.allScores
    };
  });
  
  log.info(`Semantic field analysis completed. Found ${analyzedFields.length} fields:`);
  analyzedFields.forEach(field => {
    if (field.semanticScore > 0) {
      log.info(`  - ${field.name || field.id || 'unnamed'}: ${field.semanticCategory} (score: ${field.semanticScore})`);
    }
  });
  
  return analyzedFields;
}

/**
 * 意味的フィールド検出のメイン関数
 */
async function findFieldBySemantic(page, configKey, keywords) {
  try {
    // ページの全フィールドを意味的に解析
    const analyzedFields = await analyzePageFieldsSemantics(page);
    
    // 設定キーに対応する意味的マッピング
    const bestMatch = findSemanticFieldMapping(configKey, analyzedFields);
    
    if (bestMatch && bestMatch.visible) {
      // フィールド要素を取得
      const selector = bestMatch.id ? `#${bestMatch.id}` : 
                     bestMatch.name ? `[name="${bestMatch.name}"]` : 
                     `${bestMatch.tagName}:nth-of-type(${bestMatch.index + 1})`;
      
      const field = page.locator(selector).first();
      const isVisible = await field.isVisible().catch(() => false);
      
      if (isVisible) {
        log.info(`Semantic match found for ${configKey}: ${bestMatch.name || bestMatch.id} (${bestMatch.semanticCategory}, score: ${bestMatch.semanticScore})`);
        return field;
      }
    }
    
    return null;
  } catch (error) {
    log.warn(`Semantic field detection error for ${configKey}: ${error.message}`);
    return null;
  }
}

/**
 * チェックボックス・ラジオボタンの値設定ロジック
 */
function determineCheckboxRadioValue(configKey, fieldData, configValue) {
  // プライバシー同意は常にtrue
  if (fieldData.semanticCategory === 'PRIVACY_AGREEMENT') {
    return true;
  }
  
  // ニュースレターは設定値に従う
  if (fieldData.semanticCategory === 'NEWSLETTER') {
    return configValue === true || configValue === 'true' || configValue === '1';
  }
  
  // その他は設定値に従う
  return configValue === true || configValue === 'true' || configValue === '1' || configValue === 'on';
}

module.exports = {
  getSemanticCategory,
  findSemanticFieldMapping,
  analyzePageFieldsSemantics,
  findFieldBySemantic,
  determineCheckboxRadioValue,
  SEMANTIC_CATEGORIES
};