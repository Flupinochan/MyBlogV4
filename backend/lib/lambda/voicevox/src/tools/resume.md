# 職務経歴書

作成日: 2026年9月6日  
氏名: 川越 鉄郎

## 職務要約

フルスタックエンジニア・SREとして、AWSを中心としたクラウド基盤の設計・構築からアプリケーション開発・運用までを一貫して担当  
現職ではサーバーレス基盤のマルチアカウント化やLambdaの大規模移行、パフォーマンス改善を1人で主導  
前職ではAWS大規模マルチアカウント基盤 (500以上) の運用改善を担い、インフラ・アプリケーション双方に精通した課題解決を強みとする

---

## 職務経歴

### cars株式会社 (2025年10月〜現在)

事業内容: 車関連事業者向け集客・経営支援SaaS「cars MANAGER」の開発・運用  
従業員数: 166名  
雇用形態: 正社員

#### 集客・経営支援SaaS「cars MANAGER」の開発・運用

役割: フルスタックエンジニア  
チーム構成: 基本1名 (PRレビュー等のみ他メンバーと連携)

##### プロジェクト概要

車関連事業者向けの集客・経営支援SaaS「cars MANAGER」において、AWSマルチアカウント基盤の設計からバックエンド・フロントエンド開発、運用改善までをフルスタックで担当

##### 主な成果・実績

- ログ検索基盤が存在せず障害原因を特定できない状態から、CloudTrail・CloudFront・ALB等のログをS3+Glue+Athenaで検索可能な基盤をゼロから構築、CloudWatch InsightsによるLambdaやECSのログ調査手順書も整備
- 19個のLambdaのPythonランタイムアップグレード (3.11→3.13) をClaude Code Subagentの並列活用により実施、本来3人・半年相当の工数を1人・3週間に圧縮
- API Gateway/Lambdaのペイロードサイズ制限対策として、gzip圧縮とレスポンス最小化を実施しレスポンスサイズを最大95%削減
- Web Push通知のパフォーマンス改善によりサーバースペックを増強せずCPU使用率を95%から20%に削減
- モノリシックなfrontendのビルド時間をlint対象の絞り込みやesbuildへの移行等により20分から3分に短縮
- 顧客企業向けデータ連携の個別対応を自動化し、日次1時間かかっていた手動タグ付け作業を0秒に、1〜2週間要していた差分抽出作業を約10分に短縮
- EC2/ECS/AutoScaling/RDS等の夜間停止やログ保存期間の見直しによるコスト最適化で、年間約200万円を削減
- 外部通話SaaS「MiiTel」の要約・スマートレポート機能と連携し、Webhookで受信した要約結果をECSのbackend APIで処理してRDSに登録、内容からタスクやクレームに該当する項目を自動検知してタスク登録する機能を要件定義から1人で設計・実装、通話内容の対応忘れを防止する仕組みを実現

##### 技術的課題と解決策

課題1: AWSアカウントのQuota制約によるスケール限界  
AWSのQuota制約により1アカウントで500社を超える事業者の収容が困難という課題に対し、2つ目のAWSアカウントを新設しCognito認証時のJWTで企業ごとのアクセス先を振り分けるRouting用Lambdaの仕組みを設計・構築、アカウント間の接続にはIPアドレス管理が不要なVPC Latticeを採用することで解決。大手自動車メーカーとの提携を見据え、アカウント追加のみで無制限にスケール可能な基盤を確立 (現状約350社運用、1アカウントあたり500社規模まで収容可能)

課題2: 外部依存度が高くリスクのあるログライブラリ  
backend ECSで利用していたロガーライブラリがGitHub Star数1、最終更新10年前と信頼性が低いという課題に対し、内製化してリスクを排除。Lambda側はAWS Lambda Powertoolsへ移行し構造化ログ化、X-Rayトレースを追加してDBクエリ単位のパフォーマンス調査を可能にすることで解決

課題3: 送信処理における2重送信・2重課金  
エラーの握り潰しや不適切なチャネルフォールバック、DBの冪等性レコード欠如により2重送信・2重課金が発生するという課題に対し、送信内容から一意の冪等性IDを生成しDBで管理、手動リトライをSQSのvisibility timeoutによるリトライへ変更しスパイク対策も実施することで解決

課題4: ECSスケールイン時のエラー多発  
Graceful Shutdown未対応によりスケールイン時にエラーログが数百件規模で発生するという課題に対し、アプリの終了動作を修正、ALBのDeregistration timeoutとECSのstopTimeoutを適切な値に設定することでエラーを0件に削減し解決

##### 技術的工夫

- RPAツール (PowerAutomate) を画像認識ベースの不安定なフローからwindow UI操作・キー操作ベースに刷新、顧客からの問い合わせを週1〜2件から月1件程度に削減、実行時間を最大30分から5分程度に短縮
- Claude Codeの活用によりcommit/PRルール等のskillを共通化・配布、散在していた運用手順書をmarkdown化し検索可能な形に整備
- 踏み台兼ツールサーバをAL2023へ移行、EIP切替方式によりダウンタイムをほぼ0に抑制
- backendのエラーレスポンス有無に応じた表示ルールを整備し、英語のエラーやスタックトレースが画面に表示される問題を解消
- frontendはJest、backendはpytestとtestcontainersでテスト環境を整備、GitHub Actionsでlint・test・buildを構築、devcontainersでIntel/Apple Silicon間の開発環境差分も吸収

##### 使用技術

| 分野               | 技術                                                        |
| ------------------ | ----------------------------------------------------------- |
| フロントエンド     | Vue.js、JavaScript、TypeScript                              |
| バックエンド       | Python (FastAPI、bottle)、Go (Gin)                          |
| コンピューティング | Lambda、ECS、EC2、AutoScaling                               |
| API                | API Gateway                                                 |
| データベース       | RDS (Aurora)、DynamoDB、OpenSearch                          |
| ネットワーク・配信 | ALB、CloudFront、VPC Lattice                                |
| ストレージ         | S3                                                          |
| メッセージング     | SQS                                                         |
| 認証               | Cognito                                                     |
| IaC                | CDK、Terraform、SAM                                         |
| ログ・監視         | CloudTrail、CloudWatch (Logs/Insights)、X-Ray、Glue、Athena |
| テスト             | pytest、testcontainers、Jest                                |
| CI/CD              | GitHub Actions、CodePipeline、CodeBuild、devcontainers      |
| 自動化・その他     | PowerAutomate、Claude Code                                  |

---

### 株式会社テクノプロ (2025年1月〜2025年9月)

事業内容: 機械、電気、電子、組込制御、情報システム等の技術サービス  
従業員数: 23,844名  
雇用形態: 正社員

#### ファイル検疫アプリケーションの開発

役割: フロントエンドエンジニア  
チーム構成: 2名 (バックエンドエンジニア1名、自分1名)

##### プロジェクト概要

USB等の外部記憶媒体にあるファイルを安全に社内ネットワークに取り込むための検疫システム  
ユーザー数最大5万人を想定したエンタープライズ向けアプリケーション

##### 主な成果・実績

- 既存システムの完全リファクタリングを担当し、動作しない状態から運用可能なレベルまで改善
- FlexboxとGrid Layoutによる再設計で、レスポンシブ対応不可だったUIをマルチデバイス対応に改善
- Playwright導入によりリグレッションテストを自動化し、開発効率化を実現
- 1ファイル2000行のCSSファイルを整理し、保守性を向上

##### 技術的課題と解決策

課題1: UI品質問題  
2000行超のCSS、固定幅設計でレスポンシブ未対応だった状態に対し、FlexboxとGrid Layoutによる再設計、CSS変数による共通化で解決

課題2: 開発環境制約  
インターネット接続不可、外部ライブラリ使用不可という制約に対し、バニラJavaScriptでのCSR実装とJSDocによる補完活用で解決

課題3: レガシー技術スタック  
Ajax/jQuery、CommonJS環境という技術的負債に対し、Fetch API移行とES Modulesへの変換で依存関係を可視化し解決

##### 技術的工夫

- 負荷テストの対策としてService Workerによるキャッシュ戦略を導入
- Dependency InjectionでAPI呼び出しをMock化し開発効率を向上
- GitLabでのイシューベース開発を実施

##### 使用技術

| 分野                | 技術                                                   |
| ------------------- | ------------------------------------------------------ |
| Web                 | Java (Spring Boot + Thymeleaf)、JavaScript             |
| Windowsデスクトップ | C# (WPF)                                               |
| テスト              | Playwright                                             |
| ツール              | Eclipse、Visual Studio、Visual Studio Code、Mattermost |

---

### 株式会社パーソルクロステクノロジー (2022年11月〜2024年12月)

事業内容: テクノロジーソリューション事業  
従業員数: 9,706名  
雇用形態: 正社員

#### AWSマルチアカウント基盤の運用・改善

役割: SRE・FinOpsエンジニア  
チーム構成: 12名

##### プロジェクト概要

月間70万ドル規模、500以上のAWSマルチアカウントを管理するクラウド基盤の運用・改善  
グループ会社のクラウドシフト推進とコスト最適化を担当

##### 主な成果・実績

- 自チーム管理アカウントで月400万円のコスト削減を達成 (-40%)
- AWSサンドボックス環境を1人で設計から運用まで構築し、利用者数70名超まで拡大
- オンプレミス環境からクラウドへの移行基盤としてクラウドハブを構築
- Landing ZoneからControl Towerへの基盤移行プロジェクトを完遂
- Pythonによる定期コストレポート配信で、グループ全体のコスト意識改革を実現

##### 技術的課題と解決策

課題1: セキュアかつ予算を超えない検証環境の提供  
グループ会社社員がAWSサービスを安全に検証できる環境が未整備だった状態に対し、ECS nukeとLambdaによる自動リソース削除システム構築、Permissions Boundaryによる権限制御、Budgetsによる予算設定で解決

課題2: オンプレミス・クラウド間接続基盤  
グループ会社のクラウドシフトに伴うクラウド間接続基盤が必要だったため、FIC-Router、Direct Connect、Transit Gatewayによるネットワーク基盤を設計・構築

課題3: コスト管理の仕組み化  
クラウドシフト完了後もコストが右肩上がりだった状態に対し、Python (Pandas) による分析レポートの自動生成とコスト削減に関する社内ナレッジの整備で解決

課題4: 基盤の技術的負債  
Landing Zoneのサービス終了に伴う基盤刷新が必要だったため、Control Towerを用いた新基盤への移行、CloudFormation StackSetによる統制環境の再構築を実施

##### 技術的工夫

- コード管理をファイルサーバからCodeCommit、CodePipelineへ移行し、バージョン管理と自動デプロイを実現
- AWS Bedrockで英語のアラート通知を生成AIで翻訳・要約し、運用負荷を削減
- Glueテーブル・パーティション設定により、500アカウントのログ分析を効率化

##### 使用技術

| 分野               | 技術                                                       |
| ------------------ | ---------------------------------------------------------- |
| ガバナンス         | Control Tower、Organizations、SCP、ServiceCatalog、RAM     |
| IaC・CI/CD         | CDK (TypeScript)、CloudFormation、CodePipeline             |
| 自動化             | Boto3 (Python)、StepFunctions、SystemsManager、EventBridge |
| ネットワーク       | Direct Connect、Transit Gateway、Route53、NetworkManager   |
| コンピューティング | ECS、Lambda、EC2ImageBuilder                               |
| コスト分析         | Budgets、ComputeOptimizer、TrustedAdvisor、CostExplorer    |
| ログ分析           | Glue、Athena、X-Ray                                        |
| アラート           | CloudWatch、Health、GuardDuty、Config                      |
| テスト             | Moto                                                       |
| ツール             | Jira、Visual Studio Code、draw.io                          |

##### 組織貢献

- Terraform・Gitの使用方法を指導
- AWSに関する社内ナレッジを作成
- 中途者向け採用資料を作成

---

### 株式会社アヴァンティ (2021年10月〜2022年9月)

事業内容: 公共機関および教育機関向けITインフラの設計・構築  
従業員数: 10名  
雇用形態: 正社員

#### 水道料金システム更改

役割: インフラエンジニア  
チーム構成: 3名  
期間: 2022年4月〜2022年9月

##### プロジェクト概要

水道料金システムの更改に伴う、新環境のインフラ・ミドルウェアの設計・構築

##### 主な成果・実績

- 物理サーバ・仮想サーバ・ストレージのバックアップ/リストア基盤を設計し、ArcserveUDP・ArcserveBackupとバッチファイルによりバックアップを自動化
- 社内に導入実績のなかったストレージのレプリケーション機能 (REC) について、マニュアルを綿密に調査した上で導入し、全作業を完遂

##### 使用技術

| 分野         | 技術                                                                  |
| ------------ | --------------------------------------------------------------------- |
| 仮想化       | ESXi 7.0.2、VCSA 7.0.2                                                |
| OS           | Windows Server 2019、RHEL 8、CentOS 7                                 |
| バックアップ | ArcserveBackup 18、ArcserveUDP 8.1、Systemwalker Operation Manager 16 |
| ストレージ   | ETERNUS AF650 S3                                                      |
| セキュリティ | Symantec Endpoint Protection Manager 14                               |

---

#### 警備会社VDI更改

役割: インフラエンジニア  
チーム構成: 5名  
期間: 2021年11月〜2022年3月

##### プロジェクト概要

警備会社向けVDI環境のHorizonバージョンアップ、および仮想マシン移行作業

##### 主な成果・実績

- ESXi・VCSAの構築からHorizon 8環境構築までを担当し、社内初となるHorizon 8環境の構築を成功させた
- 個人検証環境で事前にシミュレーションを実施した上で本番環境の構築をスムーズに完了させ、汎用操作手順書も合わせて整備

##### 使用技術

| 分野         | 技術                              |
| ------------ | --------------------------------- |
| 仮想化       | ESXi 7.0.2、VCSA 7.0.2、Horizon 8 |
| OS           | Windows Server 2019               |
| データベース | MS SQL Server 2019                |

---

#### 警備会社Web分離

役割: インフラエンジニア  
チーム構成: 5名  
期間: 2021年10月〜2021年12月

##### プロジェクト概要

セキュリティ対策としてのWeb分離実施に伴う、ESXi・仮想マシン環境の設計・構築

##### 主な成果・実績

- 社内で実績が少ないiSCSIストレージの導入にあたり、個人検証環境で事前検証を実施した上で本番環境へ成功裏に導入
- Ubuntu OS搭載の仮想マシンを8台新規作成し、社内初のUbuntu環境を確立、会社の技術範囲拡大に貢献

##### 使用技術

| 分野   | 技術                              |
| ------ | --------------------------------- |
| 仮想化 | ESXi 7.0.2                        |
| OS     | Windows Server 2019、Ubuntu 18.04 |

---

### 株式会社テイクス (2020年3月〜2021年9月)

事業内容: インフラ構築・運用保守  
従業員数: 852名  
雇用形態: 正社員

#### 大学システムの運用・保守

役割: インフラエンジニア  
チーム構成: 2名

##### プロジェクト概要

大学に常駐し、お客様に代わってサーバ・ネットワーク・ミドルウェア全般の運用・保守を担当  
Linuxサーバのパッチ適用、ネットワーク機器設定、ユーザ管理まで、インフラ全域を2名体制でカバー

##### 主な成果・実績

- Ansibleを活用し、複数サーバへの管理者ユーザ一括作成スクリプトを開発、手動作業を削減
- GeoLite2データベースを導入し、VPN不正アクセス発生時に発信元国を特定できる仕組みを実装、セキュリティを強化
- コロナ禍において、無線LANコントローラ (Aruba) のVLAN設計変更と学内ネットワーク再構成を短期間で実施し、大学のリモート授業環境整備を支援

##### 使用技術

| 分野         | 技術                                                          |
| ------------ | ------------------------------------------------------------- |
| OS           | Windows Server 2012〜2019、RHEL 6〜8                          |
| 仮想化       | ESXi 6.5〜7、VCSA 6.5〜7                                      |
| ネットワーク | Cisco ASA 5516-X、Palo Alto PA3020、Aruba 7205、SonicWall 6.5 |
| ミドルウェア | BIND、ISC DHCP、Postfix、Dovecot、FreeRADIUS、MySQL           |
| 自動化       | Ansible                                                       |

---

### 神奈川県IT人材確保・スキルアップ支援事業 (2019年10月〜2020年2月)

職業訓練校にてWebアプリケーション開発 (Java、HTML5、PostgreSQL) を学習  
会議室予約システムの開発を通じて、要件定義から実装までの一連の開発プロセス、SQLインジェクション対策等のセキュリティ意識を習得

---

## スキルレベル

### 言語

| 技術                     | 経験年数     |
| ------------------------ | ------------ |
| Python                   | 2022年〜現在 |
| TypeScript               | 2022年〜現在 |
| Go                       | 2025年〜現在 |
| Java                     | 2025年       |
| C#                       | 2025年       |
| ShellScript / PowerShell | 2020年〜現在 |

### フレームワーク・ライブラリ

| 技術                    | 経験年数     |
| ----------------------- | ------------ |
| Vue                     | 2025年〜現在 |
| FastAPI / bottle        | 2025年〜現在 |
| Gin                     | 2025年〜現在 |
| Spring Boot + Thymeleaf | 2025年       |
| WPF                     | 2025年       |

### データベース

| 技術                 | 経験年数       |
| -------------------- | -------------- |
| OpenSearch           | 2025年〜現在   |
| DynamoDB             | 2025年〜現在   |
| MySQL (RDS / Aurora) | 2022年〜現在   |
| Oracle Database      | 2025年         |
| MS SQL Server        | 2020年〜2022年 |

### クラウド・インフラ

| 技術                                             | 経験年数       |
| ------------------------------------------------ | -------------- |
| AWS (Lambda、API Gateway、RDS、S3、SQS等)        | 2022年〜現在   |
| コンテナ (ECS、Docker)                           | 2022年〜現在   |
| IaC (CDK、Terraform、SAM、CloudFormation)        | 2022年〜現在   |
| Linux (RHEL、CentOS、Ubuntu、Amazon Linux)       | 2020年〜現在   |
| VMware (ESXi、VCSA、Horizon)                     | 2020年〜2022年 |
| Windows Server / AD                              | 2020年〜2022年 |
| ネットワーク機器 (Cisco ASA、Palo Alto、Aruba等) | 2020年〜2022年 |

### CI・CD

| 技術                                  | 経験年数       |
| ------------------------------------- | -------------- |
| GitHub Actions                        | 2025年〜現在   |
| CodePipeline / CodeBuild / CodeCommit | 2022年〜現在   |
| CloudFormation StackSet               | 2022年〜2024年 |

### テスト

| 技術           | 経験年数     |
| -------------- | ------------ |
| pytest         | 2025年〜現在 |
| Jest           | 2025年〜現在 |
| testcontainers | 2025年〜現在 |
| Playwright     | 2025年〜現在 |
| Moto           | 2022年〜現在 |

### ツール

| 技術                                         | 経験年数       |
| -------------------------------------------- | -------------- |
| Claude Code                                  | 2026年〜現在   |
| Herdr                                        | 2026年〜現在   |
| MySQL Workbench / TablePlus                  | 2025年〜現在   |
| Git / GitHub / GitLab                        | 2020年〜現在   |
| Visual Studio Code / Eclipse / Visual Studio | 2020年〜現在   |
| devcontainers                                | 2025年〜現在   |
| Backlog                                      | 2025年〜現在   |
| PowerAutomate                                | 2025年〜現在   |
| draw.io                                      | 2022年〜現在   |
| Jira                                         | 2022年〜2024年 |
| Ansible                                      | 2020年〜2022年 |

---

## 最終学歴

2015年4月 東京都立小金井北高等学校 入学  
2018年3月 東京都立小金井北高等学校 卒業

---

## 保有資格

| 取得年月   | 資格名                                                                  |
| ---------- | ----------------------------------------------------------------------- |
| 2019年7月  | 情報処理技能検定試験 表計算1級                                          |
| 2019年10月 | 文書デザイン検定試験 2級                                                |
| 2020年4月  | LPIC-1 (101、102)                                                       |
| 2020年9月  | LPIC-2 (201、202)                                                       |
| 2020年12月 | LPIC-3 (300 Enterprise Professional Mixed Environment)                  |
| 2021年5月  | CCNA (Cisco Certified Network Associate)                                |
| 2021年6月  | Oracle Certified Java Programmer, Bronze SE                             |
| 2021年9月  | AWS Certified Cloud Practitioner                                        |
| 2021年11月 | 秘書技能検定試験 3級                                                    |
| 2021年11月 | ビジネス文書技能検定試験 3級                                            |
| 2022年2月  | LPIC-3 (304 Enterprise Professional Virtualization & High Availability) |
| 2022年5月  | Python 3 エンジニア認定基礎試験                                         |
| 2022年11月 | OSS-DB Silver (PostgreSQL)                                              |
| 2023年6月  | AWS Certified Solutions Architect - Associate                           |
| 2025年1月  | Neo4j Certified Professional                                            |
| 2025年4月  | Oracle Certified Java Programmer, Silver SE 17 - JPN                    |
| 2025年7月  | AWS Certified Solutions Architect - Professional                        |
| 2026年8月  | CKA (Certified Kubernetes Administrator)                                |

---

## 自己PR

新しい技術を検証で終わらせず、実務の制約に合う形に落とし込んで成果に変えることを得意としている

現職では、Claude Codeのサブエージェントを並列実行する仕組みを自ら設計し、19個のLambdaのランタイム移行を3人・半年想定から1人・3週間に短縮した  
あわせてcommitやPRのルールをskillとして共通化・配布し、チーム全体の開発フローに定着させている  
AWSマルチアカウント化においても、IPアドレス管理が不要なVPC Latticeを選定し、アカウント追加のみでスケールできる基盤を確立した

信頼性の面でも、ログ検索基盤が存在せず障害原因を特定できない状態からS3とAthenaによる調査基盤を構築し、Graceful Shutdown未対応で数百件発生していたECSのエラーを0件に削減している

技術の新しさではなく現場の課題に合うかで選定できる点を強みとし、貴社の開発生産性とサービスの信頼性の向上に貢献したい

---

## ポートフォリオ

https://metalmental.net/
