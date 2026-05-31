# 職務経歴書

## 基本情報

**氏名**: 川越 鉄郎  
**更新日**: 2025年9月4日

## 職務要約

### 現在の主要な役割： フロントエンドエンジニア・AWSエンジニア

- **フロントエンドエンジニア**

  - ユーザ数最大5万人のファイル検疫アプリケーションの開発
  - Java (Spring Boot + Thymeleaf) によるWebアプリケーション
  - C# (WPF) によるWindowsデスクトップアプリケーション

- **AWSエンジニア・SRE・FinOps**

  - 月間70万ドル、500以上のAWSマルチアカウント基盤の運用・改善
  - AWS CDK・CodePipeline等のIaC・CI/CDによるシステム自動化、トイルの削減
  - Python Pandasによるコスト分析で自チーム400万円のコスト削減を達成
  - オンプレミス環境からのクラウドシフト、クラウドハブ・ControlTower構築

- **インフラエンジニア**
  - サーバ30台、VDI端末200台の公共・文教オンプレミス環境の構築・運用
  - VMware ESXi、VCSA、Horizonによる仮想基盤・VDI環境の構築
  - Linux (DNS、DHCP、Postfix、Radius等)、Windows Server ADサーバの運用

**技術的な強み：** インフラからアプリケーションまで、フルスタックでの課題解決が可能

---

## 職務経歴

### 株式会社テクノプロ (2025年1月〜現在)

**事業内容**: 機械、電気、電子、組込制御、情報システム等の技術サービス  
**従業員数**: 23,844名

---

### ファイル検疫アプリケーションの開発

**役割**: フロントエンドエンジニア  
**チーム構成**: 2名 (バックエンドエンジニア1名、自分1名)

#### プロジェクト概要

USB等の外部記憶媒体にあるファイルを安全に社内ネットワークに取り込むための検疫システム  
ユーザー数最大5万人を想定したエンタープライズ向けアプリケーション

#### 主な成果・実績

- 既存システムの完全リファクタリング: 動作しない状態から運用可能なレベルに改善
- UI/UXの大幅改善: レスポンシブ対応不可からマルチデバイス対応に
- 開発効率化: Playwright導入によりリグレッションテストを自動化
- 技術的負債解消: 1ファイル2000行のCSSファイルを整理し、保守性を向上

#### 技術的課題と解決策

#### 課題1: UI品質問題

- 2000行超のCSS、固定幅設計、レスポンシブ未対応
  - 解決: FlexboxとGrid Layoutによる再設計、CSS変数による共通化

#### 課題2: 開発環境制約

- インターネット接続不可、外部ライブラリ使用不可
  - 解決: バニラJavaScriptでのCSR実装、JSDocによる補完活用

#### 課題3: レガシー技術スタック

- Ajax/jQuery、CommonJS環境
  - 解決: Fetch API移行、ES Modulesへの変換で依存関係の可視化

#### 技術的工夫

- 負荷テストの対策としてService Workerによるキャッシュ戦略を導入
- Dependency InjectionでAPI呼び出しをMock化し開発効率向上
- GitLabでのイシューベース開発

#### 使用技術

| 分野 | 技術 |
|------|------|
| Web | Java (Spring Boot + Thymeleaf)、JavaScript |
| Windowsデスクトップ | C# (WPF) |
| テスト | Playwright |
| ツール | Eclipse、Visual Studio、Visual Studio Code、Mattermost |

---

### 株式会社パーソルクロステクノロジー (2022年11月〜2024年12月)

**事業内容**: テクノロジーソリューション事業  
**従業員数**: 9,706名

---

### AWSマルチアカウント基盤の運用・改善

**役割**: SRE・FinOpsエンジニア  
**チーム構成**: 12名

#### プロジェクト概要

月間70万ドル規模、500以上のAWSマルチアカウントを管理するクラウド基盤の運用・改善  
グループ会社のクラウドシフト推進とコスト最適化を担当

#### 主な成果・実績

- 自チーム管理アカウントで400万円のコスト削減を達成（-40%削減）
- AWSサンドボックス環境を1人で設計から運用まで構築、利用者数70名超
- オンプレミス環境からクラウドへの移行基盤としてクラウドハブを構築
- Landing ZoneからControl Towerへの基盤移行プロジェクトを完遂
- Pythonによる定期コストレポート配信でグループ全体のコスト意識改革を実現

#### 技術的課題と解決策

#### 課題1: セキュアかつ予算を超えない検証環境の提供

- グループ会社社員がAWSサービス検証を安全に行える環境が未整備
  - 解決:
    - ECS nukeとLambdaによる自動リソース削除システム構築
    - Permissions Boundaryによる権限制御
    - Budgetsによる予算設定

#### 課題2: オンプレミス・クラウド間接続基盤

- グループ会社のクラウドシフトに伴うクラウド間の接続基盤が必要
  - 解決: FIC-Router、Direct Connect、Transit Gatewayによるネットワーク基盤を設計・構築

#### 課題3: コスト管理の仕組み化

- クラウドシフトが完了したにもかかわらず、コストが右肩上がり
  - 解決:
    - Python (Pandas) による分析レポート自動生成
    - コスト削減に関する社内ナレッジの作成

#### 課題4: 基盤の技術的負債

- Landing Zone のサービス終了に伴う基盤刷新が必要
  - 解決:
    - Control Towerを用いた新基盤への移行
    - CloudFormation StackSetによる統制環境再構築

#### 技術的工夫

- コード管理をファイルサーバからCodeCommit、CodePipelineへ移行し、バージョン管理と自動デプロイを実現
- AWS Bedrockで英語のアラート通知を生成AIで翻訳・要約し、運用負荷を削減
- Glueテーブル・パーティション設定により、500アカウントのログ分析を効率化

#### 使用技術

| 分野 | 技術 |
|------|------|
| ガバナンス | ControlTower、Organizations、SCP、ServiceCatalog、RAM |
| IaC・CI/CD | CDK (TypeScript)、CloudFormation、CodePipeline |
| 自動化 | Boto3 (Python)、StepFunctions、SystemsManager、EventBridge |
| ネットワーク | DirectConnect、TransitGateway、Route53、NetworkManager |
| コンピューティング | ECS、Lambda、EC2ImageBuilder |
| コスト分析 | Budgets、ComputeOptimizer、TrustedAdvisor、CostExplorer |
| ログ分析 | Glue、Athena、X-Ray |
| アラート | CloudWatch、Health、GuardDuty、Config |
| テスト | Moto |
| ツール | Jira、VSCode、draw.io |

#### 組織貢献

- Terraform・Gitの使用方法を指導
- AWSに関する社内ナレッジの作成
- 中途者向け採用資料を作成

---

### 株式会社アヴァンティ (2021年10月〜2022年9月)

**事業内容**: 公共機関および教育機関向けITインフラの設計・構築  
**従業員数**: 10名

---

### 株式会社テイクス (2020年3月〜2021年9月)

**事業内容**: インフラ構築・運用保守  
**従業員数**: 852名

---

### オンプレミス環境の設計・構築・運用

**役割**: インフラエンジニア  
**チーム構成**: 2～5名

#### プロジェクト概要

公共・文教機関向けのオンプレミス基盤において、仮想化環境・VDI・ネットワーク・サーバの設計、構築、運用を担当  
30台規模のサーバと200台のVDI端末を管理する大規模システムの構築・運用を経験

#### 主な成果・実績

- VMware Horizon 8による社内初のVDI環境構築を成功
- コロナ禍における迅速なリモート授業環境整備で大学のオンライン教育を支援
- iSCSIストレージ・Ubuntu環境導入で会社の技術範囲を拡大

#### 技術的課題と解決策

#### 課題1: 新技術導入における知見不足

- Horizon8、iSCSIストレージなど社内で実績のない技術導入が必要
  - 解決: 個人検証環境での事前シミュレーション実施、マニュアル精査により本番環境への導入を成功

#### 課題2: コロナ禍対応の緊急性

- リモート授業環境を短期間で整備する必要
  - 解決: 無線LANコントローラ (Aruba) VLAN設計変更、ネットワーク再構成によりオンライン教育基盤を迅速構築

#### 技術的工夫

- Ansible、ShellScriptを使用しサーバ設定を自動化
- オンプレミスのリソースが限られる中、自PC上のVirtualBox、VMware Workstationで検証

#### 使用技術

| 分野 | 技術 |
|------|------|
| 仮想化 | VMWare ESXi、VCSA、Horizon |
| OS | WindowsServer、RHEL、CentOS、Ubuntu |
| ミドルウェア | BIND、ISC DHCP、Postfix、FreeRADIUS、Samba |
| 自動化 | Ansible、ShellScript、PowerShell |
| その他 | Arcserve、Systemwalker、ETERNUS |

---

## ポートフォリオ

- [ポートフォリオサイト](https://www.metalmental.net/)
  - React + AWS CDKによるサーバレス構成、Service Workerでオフライン対応
- [Androidアプリ](https://flupinochan.github.io/popcal-document/)
  - Flutter製の順番管理アプリ
- [VSCode拡張機能](https://marketplace.visualstudio.com/items?itemName=metalmental.review-on-save)
  - ファイル保存時にコードレビューするツール
- [Chrome拡張機能](https://chromewebstore.google.com/detail/selectiontranslator/ckgmmdgflpnffbnkfoamlgfhmafidfmg?authuser=0&hl=ja)
  - 翻訳作業の効率化を目的としたワンクリック翻訳ツール
- [Windowsアプリ](https://www.microsoft.com/store/apps/9NW60Q3D6FMH)
  - C# WPF製の画像一括編集ツール
- [Zennブログ](https://zenn.dev/metalmental)
- [GitHub](https://github.com/Flupinochan/)

### 資格

[Credly](https://www.credly.com/users/tetsuro-kawagoe/badges#credly)

- 情報処理技能検定試験 表計算1級
- 文書デザイン検定試験 2級
- 秘書技能検定試験 3級
- ビジネス文書技能検定試験 3級
- LPIC-3 (300 Enterprise Professional Mixed Environment)
- LPIC-3 (304 Enterprise Professional Virtualization & High Availability)
- CCNA (Cisco Certified Network Associate)
- AWS SAP (AWS Certified Solutions Architect - Professional)
- Python3 エンジニア認定基礎試験
- Java Silver (Oracle Certified Java Programmer, Silver SE 17)
- OSS-DB Silver (PostgreSQL)
- Neo4j Certified Professional
