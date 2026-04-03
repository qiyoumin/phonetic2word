# 音标找词 phonetic2word

通过音标反向查找英语单词的 Web 应用。选择 IPA / KK / 韦氏音标符号组合发音序列，系统基于 CMU Pronouncing Dictionary 本地索引查找匹配单词，并通过 Free Dictionary API 获取详细释义。

> 在线体验：`https://qiyoumin.github.io/phonetic2word/`

## 功能特性

- **三套音标体系**：IPA 国际音标、KK 音标、韦氏音标，自动记忆上次选择
- **交互式音标组合**：按语音学分组的音标选择器（单元音/双元音、爆破音/摩擦音/塞擦音/鼻音/近音），点击组合音标序列（最多 20 个符号）
- **精确匹配查词**：基于 CMU Dict 本地索引的 ARPAbet 音标精确匹配
- **模糊匹配建议**：基于加权编辑距离的语音学模糊匹配，高亮标注差异位置
- **单词详情**：拼写、音标、词性、英文释义、例句、发音播放，支持返回结果列表
- **查询历史**：本地保存最近 100 条查询记录，支持一键回填，可滚动浏览和调节高度
- **离线缓存**：IndexedDB 持久化索引分片，首次加载后无需网络即可搜索
- **响应式布局**：适配移动端、平板、桌面端三种屏幕尺寸

## 技术栈

| 类别 | 技术 |
|------|------|
| 框架 | React 18 + TypeScript (strict) |
| 构建 | Vite 6 |
| 样式 | CSS Modules (camelCaseOnly) |
| 状态管理 | React Context + useReducer |
| 搜索引擎 | Web Worker + CMU Dict 索引分片 |
| 词典 API | [Free Dictionary API](https://dictionaryapi.dev/) |
| 本地缓存 | IndexedDB（索引分片/详情）+ localStorage（历史记录/偏好）|
| 测试 | Vitest + fast-check（属性测试）+ Testing Library |

## 快速开始

```bash
# 安装依赖
npm install

# 启动开发服务器
npm run dev

# 运行测试
npm test

# 生产构建
npm run build
```

开发服务器启动后访问 `http://localhost:5173`。

## 使用方法

1. 页面顶部选择音标体系（IPA / KK / 韦氏）
2. 在音标选择器中点击音标符号，组合你想查找的发音序列
3. 点击「🔍 查找」按钮
4. 查看匹配结果列表，点击单词查看详情
5. 详情页点击「← 返回结果列表」可回到搜索结果
6. 如果没有精确匹配，系统会自动展示模糊匹配建议
7. 右侧历史记录面板可回顾之前的查询，点击可一键回填

## 项目结构

```
src/
├── components/        # React UI 组件（含 co-located CSS Modules）
├── data/              # 音标符号数据（IPA / KK / Webster JSON）
├── services/          # 业务逻辑（搜索、缓存、历史、音标映射）
├── state/             # AppContext + Reducer 状态管理
├── types/             # TypeScript 类型定义
├── workers/           # Web Worker（搜索引擎、编辑距离算法）
└── test/              # 测试配置
public/
└── index-shards/      # CMU Dict 索引分片（38 个 JSON 文件）
scripts/
└── build-index.js     # 索引构建脚本
```

## 测试

```bash
# 运行全部测试
npm test

# 监听模式
npm run test:watch
```

项目包含单元测试（`*.test.ts`）和属性测试（`*.property.test.ts`，使用 fast-check 每个属性 100 次迭代）。

## 部署

项目已配置 GitHub Actions 自动部署到 GitHub Pages：

1. 在 GitHub 仓库 Settings → Pages → Source 选择 "GitHub Actions"
2. 推送到 `main` 分支即自动构建部署

### 重建索引数据

如需更新 CMU Pronouncing Dictionary 索引：

```bash
node scripts/build-index.js
```

## 浏览器兼容性

Chrome 90+ / Firefox 88+ / Safari 14+ / Edge 90+

## 致谢与数据来源

- [CMU Pronouncing Dictionary](http://www.speech.cs.cmu.edu/cgi-bin/cmudict) — 卡内基梅隆大学英语发音词典，提供单词到 ARPAbet 音标的映射。通过 [cmu-pronouncing-dictionary](https://github.com/words/cmu-pronouncing-dictionary) 使用，数据采用 BSD 许可证。
- [Free Dictionary API](https://dictionaryapi.dev/) — 开源英语词典 API，提供释义、例句和发音音频。数据源自 [Wiktionary](https://en.wiktionary.org/)，采用 [CC BY-SA 3.0](https://creativecommons.org/licenses/by-sa/3.0/) 许可证。
- [ipachart.com / Wikimedia Commons phonetic samples](https://ipachart.com/) — 单元音 `AA AE AH AO EH ER IH IY UH UW` 直接使用 ipachart 提供的 OGG（原始文件托管于 Wikimedia Commons，许可证为 [CC BY-SA 3.0](https://creativecommons.org/licenses/by-sa/3.0/)）。仅做 `44.1 kHz` 单声道 MP3 转码，未额外处理。
- [Freesound “English Phonemes” pack](https://freesound.org/packs/12249/) — 所有双元音与当前全部辅音试听资源都统一使用 margo_heston 的原始录音链路（[CC BY-NC 4.0](https://creativecommons.org/licenses/by-nc/4.0/)），当前根目录文件只做 MP3 转码（`libmp3lame q=2`）未再剪辑或归一化；其中 `B` 暂以 `pp.wav` 近似替代，`DH` 暂以 `th.wav` 近似替代。该资源仅适用于非商业场景，若要商用需另寻素材或取得授权，详见 `public/audio/sources.json` 与 `public/audio/README.md`。

## License

[MIT](./LICENSE)
