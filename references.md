参考にする github:

    1.	apify/crawlee  ￼

https://github.com/apify/crawlee 2. HasData/playwright-scraping ￼
https://github.com/HasData/playwright-scraping

了解。実際に各 GitHub リポジトリの中身を開いて、“お問い合わせフォーム自動化営業 SaaS”にどれだけ直結するかで採点・ランキングしました（評価軸：①SaaS 運用基盤(キュー/並列/再実行/ストレージ/プロキシ) ② 決定論的フォーム操作の実例 ③ 監視・証跡 ④ 拡張性・メンテ性 ⑤ ライセンス/勢い）。

ランキング & 点数（100 点満点） 1. apify/crawlee — 93 点（最優先の土台）

    •	強み：PlaywrightCrawler＋永続キュー、オートスケール、プロキシ回転/セッション管理など“量産運転”に必要な機能が標準装備。Apache-2.0。リリース更新も活発（2025-08-05 v3.14.1）。フォーム送信の公式サンプル（JS/Python）や、Playwrightテンプレまで揃う。 ￼  ￼ ￼ ￼
    •	使いどころ：送信ジョブの**並列・再実行・証跡保存（Dataset/KeyValueStore/ログ）**を最短で仕上げる“オーケストレータ”。

    2.	HasData/playwright-scraping — 86点（決定論的フォーム実装の見本）

    •	強み：Python/Nodeの両実装で構成が対になっており、interactions/fill_form.py 等で決定論的なフォーム入力がそのまま参考になる。デバッグは動画/トレースのサンプルも同梱。 ￼
    •	使いどころ：Crawlee上で動かす“ワーカーの中身（実入力ロジック）”の雛形に最適。

    3.	elastic/synthetics — 80点（監視・合否レポートの型）

    •	強み：Playwrightベースのシンセティック監視。npx @elastic/syntheticsで合否レポート/トレースを標準化できる。MIT。 ￼
    •	使いどころ：SaaS本体とは別に、配信監視・SLA可視化を作る時のリファレンス。

    4.	ovcharski/playwright-e2e — 79点（POM＋E2Eフローの実務的サンプル）

    •	強み：Page Object Model、認証再利用、GitHub Actions、登録→購入のマルチステップなどE2E作法がまとまっている。Apache-2.0。 ￼
    •	使いどころ：マルチステップ/セッション維持/CIの型を盗むのに良い。

    5.	NarendraCodeHub/QA-Practice-Playwright-Automation — 73点（軽量なPOMとフォーム群）

    •	強み：pages/ と tests/Forms/（Login/Register/Recover）でフォーム系POMが素直。MIT。 ￼
    •	使いどころ：最小構成のPOMを切り出す参考に。

    6.	Skyvern-AI/skyvern — 68点（未知サイト大量対応の発想）

    •	強み：LLM＋CVで“知らないUIでも動かす”思想。API駆動で同時多発実行の設計も参考。 ￼ ￼
    •	注意：営業SaaSで確実性最優先なら、まず決定論ロジックを主軸に。Skyvernは“適応の幅”を後付けで検討する位置付け。

⸻

結論（構成のおすすめ）
• 中核（オーケストレーション）：apify/crawlee
• PlaywrightCrawler ＋ PersistentQueue ＋ ProxyRotation で大量送信の土台を確立。フォーム送信は**フォーム例（JS/Python）**のパターンを取り込み。 ￼ ￼
• 実入力ロジック：HasData の fill_form.\*系を決定論的に移植（getByRole/getByLabel 優先、入力後の inputValue 検証、送信後はネットワーク＋ UI の二重確認）。 ￼
• 監視/証跡：elastic/synthetics で外形監視シナリオを用意（成功率/遅延を継続観測）。 ￼
• E2E 設計の型：ovcharski で POM/認証再利用/CI の構成を真似る。 ￼
• 将来の“未知サイト”ケア：Skyvern の API 駆動＋適応アプローチを補助レイヤとして検討。 ￼

必要なら、この並びで**スターター雛形（Crawlee ＋ Playwright ＋“送信完了の堅牢判定”＋トレース/ビデオ）**をそのまま貼るよ。
