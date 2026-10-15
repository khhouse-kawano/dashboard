# v2.2.173 おうちづくりフェスタ2026：一覧に「相談内容」の列を追加

## 依頼（ReadMeClaude.md）
- `FestaDashboard.tsx` の表で、⚠️ **ストラップの右隣に「相談内容」**の列を追加する。
- 次の値があれば、⚠️ 色を変えた**アイコン**で表示する（⚠️ 色は少し淡くする）。
  - `interview`: 住宅相談 ／ 資金・ローン相談 ／ 土地探し相談 ／ 不動産売却相談
  - `request`: 注文住宅を検討している ／ 建売住宅を検討している ／ 中古住宅を検討している
  - `area`: 文字列があれば

## 合意した表示（2026-10-08）
| 元 | 値 | 表示 | アイコン（FA 6.2） | 背景 / 文字 |
|---|---|---|---|---|
| interview | 住宅相談 | 住宅 | `fa-house` | `#e3eefc` / `#2b5a9e`（青） |
| interview | 資金・ローン相談 | 資金 | `fa-yen-sign` | `#fdf3d3` / `#8a6a0a`（黄） |
| interview | 土地探し相談 | 土地 | `fa-map-location-dot` | `#e1f4e6` / `#2f7a45`（緑） |
| interview | 不動産売却相談 | 売却 | `fa-handshake` | `#fce4ec` / `#a8385f`（ピンク） |
| request | 注文住宅を検討している | 注文 | `fa-pen-ruler` | `#ede7f8` / `#5e3f9c`（紫） |
| request | 建売住宅を検討している | 建売 | `fa-house-chimney` | `#dff4f7` / `#1d6f7d`（水色） |
| request | 中古住宅を検討している | 中古 | `fa-key` | `#fdebdc` / `#a35418`（橙） |
| area | 入力あり | その文字のまま | `fa-location-dot` | `#eceef1` / `#4a5361`（灰） |

- ⚠️ 上に無い値（キッチンカー・マルシェ など）は出さない。⚠️ 何も当てはまらなければ空欄。
- ⚠️ 並びは上の表の順で固定（⚠️ 入力の順に左右されない）。
- ⚠️ マウスを乗せると元の文言（title）。エリアは「建築予定地：〇〇」。

## 変更ファイル
| ディレクトリ | ファイル | 内容 |
|---|---|---|
| `frontend/src/components/header/` | **FestaDashboard.tsx** | ⚠️ 追加: 型 `ConsultChip`、定数 `CONSULT_INTERVIEW` / `CONSULT_REQUEST`、関数 **`consultOf`**、CSS `.fe_consult_cell` / `.fe_consult`、見出し・セル。`COLUMN_COUNT` 10→11、表の最小幅 2000→2200px |
| `frontend/src/utils/` | **version.ts** | `2.2.173` |
| `backend/scripts/sql/` | **2026-10-08_update_log_2.2.173.sql**（新規） | 更新履歴（⚠️ ローカル DB に投入済み no=269） |

⚠️ DB・② Express・① PHP の変更なし（⚠️ interview / request / area は既に取得している）。

## 追加したコード（FestaDashboard.tsx）

### 定数・関数（`STRAP_LABEL` の直後）
```tsx
/**
 * 相談内容（v2.2.173 追加）。⚠️ 相談内容（interview）・ご検討（request）・建築予定地（area）を
 * ⚠️ **淡い色のチップ＋アイコン**で出す。⚠️ 下に無い値（キッチンカー・マルシェなど）は出さない。
 *   ⚠️ 背景は淡く、⚠️ 文字とアイコンは同じ系統の濃い色（⚠️ 色が強いと見づらいため：指示書）。
 *   ⚠️ title に元の文言（⚠️ マウスを乗せると見える）。
 */
type ConsultChip = { label: string; title: string; icon: string; bg: string; fg: string };
const CONSULT_INTERVIEW: Record<string, Omit<ConsultChip, 'title'>> = {
    '住宅相談': { label: '住宅', icon: 'fa-house', bg: '#e3eefc', fg: '#2b5a9e' },
    '資金・ローン相談': { label: '資金', icon: 'fa-yen-sign', bg: '#fdf3d3', fg: '#8a6a0a' },
    '土地探し相談': { label: '土地', icon: 'fa-map-location-dot', bg: '#e1f4e6', fg: '#2f7a45' },
    '不動産売却相談': { label: '売却', icon: 'fa-handshake', bg: '#fce4ec', fg: '#a8385f' },
};
const CONSULT_REQUEST: Record<string, Omit<ConsultChip, 'title'>> = {
    '注文住宅を検討している': { label: '注文', icon: 'fa-pen-ruler', bg: '#ede7f8', fg: '#5e3f9c' },
    '建売住宅を検討している': { label: '建売', icon: 'fa-house-chimney', bg: '#dff4f7', fg: '#1d6f7d' },
    '中古住宅を検討している': { label: '中古', icon: 'fa-key', bg: '#fdebdc', fg: '#a35418' },
};
const consultOf = (item: FestaRow): ConsultChip[] => {
    // ⚠️ 並びは表の順（相談 → 検討 → エリア）で固定。⚠️ 入力の順に左右されない
    const interviews = splitValues(item.interview);
    const requests = splitValues(item.request);
    const chips: ConsultChip[] = [
        ...Object.entries(CONSULT_INTERVIEW).filter(([v]) => interviews.includes(v)).map(([v, c]) => ({ ...c, title: v })),
        ...Object.entries(CONSULT_REQUEST).filter(([v]) => requests.includes(v)).map(([v, c]) => ({ ...c, title: v })),
    ];
    const area = String(item.area ?? '').trim();
    if (area !== '') chips.push({ label: area, title: `建築予定地：${area}`, icon: 'fa-location-dot', bg: '#eceef1', fg: '#4a5361' });
    return chips;
};
```

### 列数
```tsx
/** 表の列数（同期〜担当営業の11列（⚠️ v2.2.173 で相談内容を追加） ＋ 営業入力 7ブランド×2） */
const COLUMN_COUNT = 11 + FESTA_BRANDS.length * FESTA_KINDS.length;
```

### CSS（`<style>` 内、`.fe_ticket` の前）
```css
.fe_consult_cell { white-space: normal; min-width: 200px; max-width: 240px; }
.fe_consult { display: inline-flex; align-items: center; gap: 3px; padding: 1px 7px; margin: 1px 3px 1px 0; border-radius: 999px; font-size: 11px; font-weight: 600; line-height: 1.5; white-space: nowrap; }
.fe_consult i { font-size: 10px; }
```

### 見出し（ストラップの次）
```tsx
<th rowSpan={3} style={{ ...thStyle, width: '220px' }}>相談内容</th>
```

### セル（ストラップのセルの次）
```tsx
<td className="fe_consult_cell">
    {consultOf(item).map(chip => (
        <span key={chip.title} className="fe_consult" style={{ backgroundColor: chip.bg, color: chip.fg }} title={chip.title}>
            <i className={`fa-solid ${chip.icon}`} aria-hidden="true"></i>{chip.label}
        </span>
    ))}
</td>
```

### その他
- `<Table ... style={{ minWidth: '2200px' }}>`（2000 → 2200）

## 確認
- `npm run build` 成功（型エラーなし）。
- ⚠️ ブラウザでの見た目は未確認。
