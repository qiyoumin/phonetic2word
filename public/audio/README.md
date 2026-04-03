# 音频素材记录

本目录保存应用内音素试听所用的 MP3 文件。

单文件级别的来源、授权和处理方式以 `sources.json` 为准；本文档补充记录当前根目录音频的实际文件参数、逐条来源和特殊说明，方便后续试听、替换或回退。

## 记录口径

- “来源”指上游素材来源页与授权信息
- “当前文件”指根目录 `public/audio/<PHONEME>.mp3` 的实际文件状态，参数来自 2026-04-03 的 `ffprobe`
- 时长统一保留到毫秒后三位
- `B` 与 `DH` 当前不是精确音位样本，而是近似替代

## 当前来源分组

### 1. ipachart / Wikimedia Commons

适用音素：

- `AA AE AH AO EH ER IH IY UH UW`

处理方式：

- 原始素材来自 ipachart 引用的 Wikimedia Commons 发音样本
- 授权为 `CC BY-SA 3.0`
- 当前根目录文件仅做 `44.1 kHz` 单声道 MP3 转码：`Converted from original OGG to mono MP3 (ffmpeg -b:a 128k)`

### 2. Freesound “English Phonemes” pack

适用音素：

- `AW AY B CH D DH EY F G HH JH K L M N NG OW OY P R S SH T TH V W Y Z ZH`

处理方式：

- 说话人为 `margo_heston`
- 授权为 `CC BY-NC 4.0`
- 当前根目录中的辅音文件由本地 `12249__margo_heston__english-phonemes/*.wav` 重新导出为立体声 MP3
- 双元音根目录文件保留的是历史 mono 导出版本
- 导出命令保持轻处理：`ffmpeg -ac 2 -ar 44100 -c:a libmp3lame -q:a 2`
- 当前版本不做裁剪、归一化或额外降噪

## 逐条清单

### 1. Wikimedia / ipachart 单元音

共同情况：

- 说话人记录为 `Wikimedia Commons contributor`
- 授权为 `CC BY-SA 3.0`
- 当前文件均为 `44.1 kHz`、单声道、`128 kb/s`

| 音素 | 上游文件 | 当前文件 | 说明 |
| --- | --- | --- | --- |
| `AA` | `Open_back_unrounded_vowel.ogg` | `44.1 kHz / mono / 0.587s` | 直接从 OGG 转为 MP3 |
| `AE` | `Near-open_front_unrounded_vowel.ogg` | `44.1 kHz / mono / 0.592s` | 直接从 OGG 转为 MP3 |
| `AH` | `Open-mid_back_unrounded_vowel.ogg` | `44.1 kHz / mono / 0.534s` | 直接从 OGG 转为 MP3 |
| `AO` | `Open-mid_back_rounded_vowel.ogg` | `44.1 kHz / mono / 0.580s` | 直接从 OGG 转为 MP3 |
| `EH` | `Open-mid_front_unrounded_vowel.ogg` | `44.1 kHz / mono / 0.656s` | 直接从 OGG 转为 MP3 |
| `ER` | `Open-mid_central_unrounded_vowel.ogg` | `44.1 kHz / mono / 0.569s` | 直接从 OGG 转为 MP3 |
| `IH` | `Near-close_near-front_unrounded_vowel.ogg` | `44.1 kHz / mono / 0.572s` | 直接从 OGG 转为 MP3 |
| `IY` | `Close_front_unrounded_vowel.ogg` | `44.1 kHz / mono / 0.602s` | 直接从 OGG 转为 MP3 |
| `UH` | `Near-close_near-back_rounded_vowel.ogg` | `44.1 kHz / mono / 0.607s` | 直接从 OGG 转为 MP3 |
| `UW` | `Close_back_rounded_vowel.ogg` | `44.1 kHz / mono / 0.670s` | 直接从 OGG 转为 MP3 |

### 2. Freesound 双元音

共同情况：

- 说话人为 `margo_heston`
- 来源包为 [Freesound “English Phonemes” pack](https://freesound.org/packs/12249/)
- 授权为 `CC BY-NC 4.0`
- 当前根目录保留的是历史导出版本，所以参数并不完全统一

| 音素 | 来源页 | 当前文件 | 说明 |
| --- | --- | --- | --- |
| `AW` | `193308` / `ow` | `24 kHz / mono / 0.469s` | 历史导出文件，未裁剪/归一化 |
| `AY` | `193269` / `aye` | `44.1 kHz / mono / 0.882s` | 历史导出文件，未裁剪/归一化 |
| `EY` | `193262` / `ay` | `44.1 kHz / mono / 0.717s` | 历史导出文件，未裁剪/归一化 |
| `OW` | `193285` / `oh` | `44.1 kHz / mono / 0.584s` | 历史导出文件，未裁剪/归一化 |
| `OY` | `193313` / `oy` | `24 kHz / mono / 0.507s` | 历史导出文件，未裁剪/归一化 |

### 3. Freesound 辅音精确映射

共同情况：

- 说话人为 `margo_heston`
- 授权为 `CC BY-NC 4.0`
- 当前根目录文件由本地 `12249__margo_heston__english-phonemes/*.wav` 重新导出
- 当前这批辅音基本都是 `44.1 kHz`、双声道、约 `136-152 kb/s`

| 音素 | 本地 WAV | 来源页 | 当前文件 | 说明 |
| --- | --- | --- | --- | --- |
| `CH` | `193305__margo_heston__ch.wav` | `193305` | `44.1 kHz / stereo / 1.579s` | 精确对应 |
| `D` | `193268__margo_heston__d.wav` | `193268` | `44.1 kHz / stereo / 1.625s` | 精确对应 |
| `F` | `193270__margo_heston__ff.wav` | `193270` | `44.1 kHz / stereo / 1.649s` | 精确对应 |
| `G` | `193279__margo_heston__g.wav` | `193279` | `44.1 kHz / stereo / 1.904s` | 精确对应 |
| `HH` | `193278__margo_heston__hh.wav` | `193278` | `44.1 kHz / stereo / 1.556s` | 精确对应 |
| `JH` | `193276__margo_heston__jj.wav` | `193276` | `44.1 kHz / stereo / 1.509s` | 精确对应 |
| `K` | `193283__margo_heston__k.wav` | `193283` | `44.1 kHz / stereo / 1.416s` | 精确对应 |
| `L` | `193282__margo_heston__ll.wav` | `193282` | `44.1 kHz / stereo / 1.811s` | 精确对应 |
| `M` | `193281__margo_heston__mm.wav` | `193281` | `44.1 kHz / stereo / 1.741s` | 精确对应 |
| `N` | `193280__margo_heston__nn.wav` | `193280` | `44.1 kHz / stereo / 1.927s` | 精确对应 |
| `NG` | `193310__margo_heston__nng.wav` | `193310` | `44.1 kHz / stereo / 1.695s` | 精确对应 |
| `P` | `193284__margo_heston__pp.wav` | `193284` | `44.1 kHz / stereo / 1.649s` | 精确对应 |
| `R` | `193275__margo_heston__rr.wav` | `193275` | `44.1 kHz / stereo / 1.416s` | 精确对应 |
| `S` | `193272__margo_heston__ss.wav` | `193272` | `44.1 kHz / stereo / 1.440s` | 精确对应 |
| `SH` | `193312__margo_heston__shh.wav` | `193312` | `44.1 kHz / stereo / 1.997s` | 精确对应 |
| `T` | `193273__margo_heston__tt.wav` | `193273` | `44.1 kHz / stereo / 1.207s` | 精确对应 |
| `TH` | `193320__margo_heston__th.wav` | `193320` | `44.1 kHz / stereo / 1.416s` | 精确对应 |
| `V` | `193322__margo_heston__vvv.wav` | `193322` | `44.1 kHz / stereo / 1.416s` | 精确对应 |
| `W` | `193326__margo_heston__wuh.wav` | `193326` | `44.1 kHz / stereo / 1.416s` | 精确对应 |
| `Y` | `193324__margo_heston__yyuh.wav` | `193324` | `44.1 kHz / stereo / 1.649s` | 精确对应 |
| `Z` | `193321__margo_heston__zzz.wav` | `193321` | `44.1 kHz / stereo / 1.602s` | 精确对应 |
| `ZH` | `193325__margo_heston__zh.wav` | `193325` | `44.1 kHz / stereo / 1.509s` | 精确对应 |

### 4. Freesound 辅音近似替代

| 音素 | 实际采用资源 | 来源页 | 当前文件 | 说明 |
| --- | --- | --- | --- | --- |
| `B` | `193284__margo_heston__pp.wav` | `193284` | `44.1 kHz / stereo / 1.649s` | 用 `/p/` 近似代替 `/b/` |
| `DH` | `193320__margo_heston__th.wav` | `193320` | `44.1 kHz / stereo / 1.416s` | 用 `/θ/` 近似代替 `/ð/` |

## 近似替代

`12249__margo_heston__english-phonemes` 没有 `B` 和 `DH` 的独立文件，因此当前根目录先采用最接近的近似资源：

- `B -> 193284__margo_heston__pp.wav`
- `DH -> 193320__margo_heston__th.wav`

这两项的目的，是先让全部辅音都落在同一说话人与同一录音链路里；它们不是严格的一一音位对应，后续如果拿到更合适素材，可以再单独替换。

## 历史说明

- 2026-04-03 做过一轮批量裁剪与规整试验，但试听反馈认为主观听感不理想，因此当前根目录音频保留未裁剪版本
- 同日又将全部辅音统一回 `12249` 套件，以减少来源混杂
- 同日重新核对过根目录文件参数，发现双元音保留的是历史 mono 导出版本，而新导出的辅音基本为 stereo
- 浏览器可能缓存旧的 `/audio/*.mp3`，试听前建议硬刷新或重新打开页面

## 维护建议

- 新增或替换音频时，先更新 `sources.json`
- 当前仓库不保留单一“官方音频重建脚本”；如需重建，请以 `sources.json` 和本文件为准，逐项核对来源与输出参数
- 若替代关系变化，也同步更新本文档中的“近似替代”
- 若重新做裁剪、归一化或转单声道，记得把处理命令补回 `sources.json`
