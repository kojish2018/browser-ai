# 高度なフォーム自動化システム

このシステムは、いかなるフォームでも柔軟に対応できるよう設計された、次世代のWebフォーム自動入力・送信ツールです。

## 🚀 新機能・改善点

### 📊 マルチレイヤー検出戦略
- **レベル1**: 直接属性マッチング（name, id, placeholder等）
- **レベル2**: 構造的関連付け（label-field関係、親子・兄弟要素）
- **レベル3**: セマンティック解析（周辺テキスト、コンテキスト）
- **レベル4**: AI推論ベース（将来拡張予定）

### 🎯 全フィールドタイプ対応
- `input` (全type: text, email, tel, password, number, date等)
- `textarea`
- `select` (値・ラベル・部分一致での選択)
- `checkbox` / `radio`
- `file` (ファイルアップロード)

### ⚡ 動的コンテンツ対応
- JavaScript生成要素の自動検出・待機
- MutationObserver活用
- ローディングインジケーター対応
- SPA (Single Page Application) 対応

### 🔧 高度な設定システム
- 正規表現パターンサポート
- 優先度ベースの戦略選択
- カスタムセレクタ定義
- エラーハンドリング設定

## 📁 ファイル構成

```
chromium/
├── advanced-index.js          # 新しいメインファイル
├── advanced-utils.js          # 高度なユーティリティ関数
├── advanced-config.json       # 拡張設定ファイル
├── test-runner.js            # テスト実行スクリプト
├── test-forms/               # テストフォーム集
│   ├── complex-form.html     # 複雑なフォーム
│   ├── dynamic-form.html     # 動的生成フォーム
│   └── label-association-form.html # ラベル関連付けテスト
├── logs/                     # ログ・結果ファイル
└── ADVANCED-README.md        # このファイル
```

## 🏃‍♂️ 使用方法

### 基本実行
```bash
# 高度版を使用
node advanced-index.js [URL]

# 例: 特定サイトをテスト
node advanced-index.js https://example.com/contact
```

### テスト実行
```bash
# 全テストフォームを実行
node test-runner.js

# 特定のテストのみ実行
node test-runner.js single complex-form

# 利用可能なテスト一覧
node test-runner.js list
```

## ⚙️ 設定ファイル (advanced-config.json)

### フィールドマッピングの新形式
```json
{
  "fieldMappings": {
    "company_name": {
      "keywords": ["company", "会社名", "企業名"],
      "detectionStrategies": ["direct_attributes", "structural_relation"],
      "priority": 1,
      "regex": ["/company.*name/i"],
      "required": true
    }
  }
}
```

### 検出戦略設定
```json
{
  "detectionSettings": {
    "defaultStrategies": ["direct_attributes", "structural_relation"],
    "maxRetries": 3,
    "waitForDynamicContent": true,
    "dynamicContentTimeout": 10000
  }
}
```

### エラーハンドリング
```json
{
  "errorHandling": {
    "maxRetries": 3,
    "screenshotOnError": true,
    "continueOnFieldError": true,
    "skipOptionalFields": true
  }
}
```

## 🧪 テストケース

### 1. 複雑なフォーム (complex-form.html)
- 複数セクション構造
- select要素（都道府県、業界等）
- radio/checkboxグループ
- 必須/任意フィールドの混在

### 2. 動的フォーム (dynamic-form.html)
- JavaScript による動的生成
- ステップ形式のウィザード
- ローディング画面
- 遅延コンテンツ読み込み

### 3. ラベル関連付けフォーム (label-association-form.html)
- 標準的なlabel for属性
- ラベル内包型（label内にinput）
- 近接要素での関連付け
- フローティングラベル
- Grid/Flexレイアウト

## 📊 テスト結果の確認

テスト実行後、以下で結果を確認できます：

- `logs/test-results.log` - 詳細ログ
- `logs/test-results.json` - JSON形式の結果データ
- `logs/test-*.png` - 各テストのスクリーンショット

## 🔍 トラブルシューティング

### フィールドが検出されない場合

1. **キーワード追加**: `advanced-config.json`でキーワードを追加
```json
{
  "company_name": {
    "keywords": ["company", "会社", "企業", "法人", "corp"]
  }
}
```

2. **検出戦略変更**: より多くの戦略を有効化
```json
{
  "detectionStrategies": [
    "direct_attributes", 
    "structural_relation", 
    "semantic_analysis"
  ]
}
```

3. **カスタムセレクタ**: 特定サイト用の専用セレクタ
```json
{
  "customSelectors": {
    "company_field": ["#company-name", ".company-input"]
  }
}
```

### 動的コンテンツで問題が発生する場合

```json
{
  "detectionSettings": {
    "waitForDynamicContent": true,
    "dynamicContentTimeout": 15000,
    "maxRetries": 5
  }
}
```

## 🚦 成功指標

- **フォーム検出率**: 95%以上
- **フィールド入力成功率**: 90%以上
- **送信成功率**: 85%以上

## 🔮 将来の拡張予定

1. **AI/ML統合**: フィールドの意味的理解
2. **CAPTCHA自動解決**: より高度な認証突破
3. **多言語対応**: グローバルサイト対応
4. **成功率学習**: 過去の成功パターンから学習
5. **GUI管理画面**: 設定・監視用のWebUI

## 🤝 従来版との比較

| 機能 | 従来版 | 高度版 |
|------|--------|--------|
| フィールド検出 | 基本的なキーワードマッチ | マルチレイヤー戦略 |
| サポートタイプ | input, textarea | 全フィールドタイプ |
| 動的対応 | 未対応 | 完全対応 |
| 設定柔軟性 | 固定キーワード | 正規表現・優先度 |
| エラー処理 | 基本的 | 高度な回復機能 |
| テスト機能 | なし | 包括的テストスイート |

## 📝 使用例

### 一般的な企業サイト
```bash
node advanced-index.js https://company.example.com/contact
```

### ECサイトのお問い合わせ
```bash
node advanced-index.js https://shop.example.com/inquiry
```

### 複雑なBtoBサービス
```bash
node advanced-index.js https://service.example.com/consultation
```

---

**注意**: このツールは合法的な用途でのみ使用し、利用規約・プライバシーポリシーに従って使用してください。