export interface RehearsalCuePoint {
  timeSec: number;
  timeFormatted: string;
  sectionTitle: string;
  characterFocus: string;
  actingTip: string;
  vocalTip: string;
}

export interface LesMisTrackItem {
  trackId: string;
  order: number;
  act: 'Act I' | 'Act II';
  title: string;
  subtitle: string;
  characters: string;
  durationSec: number;
  bpm: number;
  audioUrl: string;
  audioLabel: string;
  dramaticContext: string;
  librettoSubtext: string;
  vocalTips: string;
  actingTips: string;
  cueSummary: string;
  cues: RehearsalCuePoint[];
}

export const CAST_ROLES = [
  { role: 'Jean Valjean (尚萬強 - 24601)', section: 'Principal Cast' as const },
  { role: 'Javert (賈維警探)', section: 'Principal Cast' as const },
  { role: 'Fantine (芳婷)', section: 'Principal Cast' as const },
  { role: 'Cosette (珂賽特)', section: 'Principal Cast' as const },
  { role: 'Marius Pontmercy (馬呂斯)', section: 'Principal Cast' as const },
  { role: 'Éponine Thénardier (愛潘妮)', section: 'Principal Cast' as const },
  { role: 'Enjolras (安灼拉 - 革命學生領袖)', section: 'Principal Cast' as const },
  { role: 'M. & Mme. Thénardier (德納第夫婦)', section: 'Principal Cast' as const },
  { role: 'Bishop of Digne / Gavroche (主教／伽弗洛什)', section: 'Principal Cast' as const },
  { role: 'Ensemble Soprano / Alto (女高／女低合唱群)', section: 'Soprano / Alto' as const },
  { role: 'Ensemble Tenor / Bass (男高／男低合唱群)', section: 'Tenor / Bass' as const },
  { role: 'Director / Stage Manager (導演／總召／音樂指導)', section: 'Stage Direction' as const },
];

export const INITIAL_LES_MIS_TRACKS: LesMisTrackItem[] = [
  {
    trackId: 'track_01',
    order: 1,
    act: 'Act I',
    title: '01. Prologue: Look Down / Work Song (序幕：低頭看／苦役犯之歌)',
    subtitle: '1815 土倫港苦役監獄 · 沉重進行曲 (76 BPM)',
    characters: 'Jean Valjean · Javert · Convict Ensemble',
    durationSec: 185,
    bpm: 76,
    audioUrl: '',
    audioLabel: '尚未掛載外部音檔（使用內建 76 BPM 排練節拍導引）',
    dramaticContext:
      '1815 年法國土倫監獄。苦役犯在烈日與鐵鍊下划槳勞作，每一下重拍都象徵司法制度的冷酷輾壓。尚萬強（囚號 24601）服刑 19 年後獲得黃色假釋證，與代表絕對律法秩序的賈維展開全劇第一場正面對峙。',
    librettoSubtext:
      '「Look down, look down, don’t look ’em in the eye」不只是獄卒的命令，更是社會剝奪受刑人尊嚴的隱喻；當尚萬強唱出「My name is Jean Valjean」時，賈維立刻以「And I’m Javert! Do not forget my name... 24601」壓制，展現「姓名（人性）」與「編號（制度）」的核心對立。',
    vocalTips:
      '合唱團男聲部起音必須整齊劃一、咬字短促有力（"Look down!" 子音 d 與 n 需果斷）；胸腔共鳴為主，切忌圓滑美聲唱法。尚萬強與賈維對唱時注意音色對比：賈維要求挺拔剛硬、拍點精準如鐘錶；尚萬強則帶有壓抑後的粗礪感。',
    actingTips:
      '苦役犯全體重心壓低、膝蓋微彎，每逢第 1、3 拍同步做拉槳或砸石動作，視線嚴格朝向地板。賈維站立於舞台高台或中央偏右，背脊筆直、雙手背在身後，眼神俯視全場；尚萬強接過黃色通行證時動作遲疑卻充滿憤懣。',
    cueSummary: '00:00 銅管重音與鐵鍊拍點 · 00:48 尚萬強出列領取假釋證 · 01:32 賈維警告 24601 對峙段落',
    cues: [
      {
        timeSec: 0,
        timeFormatted: '00:00',
        sectionTitle: '苦役犯鐵鍊齊唱 (Look Down)',
        characterFocus: 'Convict Ensemble',
        actingTip: '全體低頭成兩排斜線隊形，隨重拍同步踏步拉槳，不可抬頭看觀眾。',
        vocalTip: '低音厚實、節奏切分果斷，重音落在每小節第一拍。',
      },
      {
        timeSec: 52,
        timeFormatted: '00:52',
        sectionTitle: '編號 24601 出列與賈維宣讀假釋',
        characterFocus: 'Javert · Jean Valjean',
        actingTip: '賈維持黃色通行證冷酷審視；尚萬強緩步踏出隊伍，肩膀緊繃。',
        vocalTip: '宣敘調（Recitative）語氣要像法庭宣判，字字清晰、不拖拍。',
      },
      {
        timeSec: 118,
        timeFormatted: '01:58',
        sectionTitle: '姓名與囚號的正面交鋒',
        characterFocus: 'Jean Valjean · Javert',
        actingTip: '尚萬強首次抬頭直視賈維雙眼，拿過黃色通行證後轉身面向前舞台。',
        vocalTip: '「My name is Jean Valjean」中音區需飽滿支撐，尾音穩定不飄。',
      },
    ],
  },
  {
    trackId: 'track_02',
    order: 2,
    act: 'Act I',
    title: '02. Valjean’s Soliloquy — What Have I Done? (尚萬強獨白：我做了什麼？)',
    subtitle: '迪涅主教邸深夜 · 戲劇性自由速度轉激昂 (88 BPM)',
    characters: 'Jean Valjean · Bishop of Digne',
    durationSec: 210,
    bpm: 88,
    audioUrl: '',
    audioLabel: '尚未掛載外部音檔（使用內建 88 BPM 排練節拍導引）',
    dramaticContext:
      '尚萬強出獄後遭社會唾棄，唯獨迪涅主教收留他。深夜尚萬強偷走銀器被捕，主教卻當眾贈予他一對銀燭台並稱「我已用這銀器向天主買下你的靈魂」。這首獨白是尚萬強從仇恨世人的囚徒蛻變為救贖者的靈魂轉折點。',
    librettoSubtext:
      '前半段充滿自我防衛與憤怒（「One word from him and I’d be back beneath the lash」）；後半段在體悟無條件的寬恕後，舊我的價值觀徹底崩塌，最終撕碎黃色假釋證，宣告「Jean Valjean is nothing now, another story must begin!」。',
    vocalTips:
      '前半段以半說半唱（Sprechstimme）與緊繃氣息表現內心混亂；進入大調聖詠旋律時，喉頭放鬆、打開頭腔與咽腔共鳴，最後高音長音（"Another story must begin!"）需提前深吸氣支撐橫膈膜。',
    actingTips:
      '舞台僅留單一聚光燈。尚萬強雙手握著銀燭台在舞台中央來回踱步，眼神游移；唱至撕毀黃色假釋證時，跪地後猛然起身將碎紙拋向空中，定格於仰望光束的姿態。',
    cueSummary: '00:00 主教贈予銀燭台 · 00:45 尚萬強內心掙扎獨白 · 02:25 撕毀黃色通行證高潮高音',
    cues: [
      {
        timeSec: 0,
        timeFormatted: '00:00',
        sectionTitle: '主教的寬恕與銀燭台交接',
        characterFocus: 'Bishop of Digne · Jean Valjean',
        actingTip: '主教雙手將燭台放在尚萬強手中，語氣慈悲而堅定；尚萬強震驚後退半步。',
        vocalTip: '主教聲線溫暖柔和，與後面尚萬強的激動形成強烈反差。',
      },
      {
        timeSec: 55,
        timeFormatted: '00:55',
        sectionTitle: '內心風暴：為何他讓我自由？',
        characterFocus: 'Jean Valjean',
        actingTip: '放下燭台，雙手抱頭，身體在暗影與光區邊緣掙扎移動。',
        vocalTip: '注意漸強（Crescendo）層次，不要一開始就把音量推到極限。',
      },
      {
        timeSec: 150,
        timeFormatted: '02:30',
        sectionTitle: '撕毀假釋證：重生高音',
        characterFocus: 'Jean Valjean',
        actingTip: '拿出口袋中的黃色通行證撕成兩半並高舉雙手，迎接舞台頂光。',
        vocalTip: '結尾高音需保持高位置共鳴，母音打開避免喉嚨擠卡。',
      },
    ],
  },
  {
    trackId: 'track_03',
    order: 3,
    act: 'Act I',
    title: '03. At the End of the Day (日復一日／工廠群像)',
    subtitle: '1823 蒙特伊工廠 · 急促切分節奏 (124 BPM)',
    characters: 'Factory Workers · Foreman · Fantine · Jean Valjean',
    durationSec: 235,
    bpm: 124,
    audioUrl: '',
    audioLabel: '尚未掛載外部音檔（使用內建 124 BPM 排練節拍導引）',
    dramaticContext:
      '八年後，化名馬德蘭先生的尚萬強成為市長與工廠主。底層女工在通貨膨脹與工頭壓榨下喘不過氣，芳婷因為私生女珂賽特的信件曝光，遭到女工排擠與工頭惡意解僱，被推向悲劇深淵。',
    librettoSubtext:
      '反覆出現的「At the end of the day you’re another day older」呈現工業時代底層勞工無止境的貧窮循環；女工們將自身的痛苦轉嫁到芳婷身上，展現人性在生存壓力下的冷漠與殘酷。',
    vocalTips:
      '124 BPM 的快速八分音符咬字極具挑戰！合唱團必須練習「輕重音分明、子音彈跳」，切勿拖泥帶水導致節奏落後伴奏。男女分部交錯對唱時，務必盯緊指揮手勢。',
    actingTips:
      '工廠女工動作需機械化且快速（整理布料、傳遞貨物）；當搶奪芳婷信件時，群眾迅速由散點聚攏成包圍圈，將芳婷孤立在舞台正中央。',
    cueSummary: '00:00 貧民與女工急促合唱 · 01:15 女工搶信衝突爆發 · 02:40 工頭將芳婷趕出工廠',
    cues: [
      {
        timeSec: 0,
        timeFormatted: '00:00',
        sectionTitle: '蒙特伊街頭與工廠開工',
        characterFocus: 'Ensemble',
        actingTip: '分三層走位穿梭舞台，步伐急促，眼神疲憊。',
        vocalTip: '短促有力的切分音，字頭咬清楚，音量控制在 mf 到 f 之間。',
      },
      {
        timeSec: 85,
        timeFormatted: '01:25',
        sectionTitle: '搶奪信件與工廠扭打',
        characterFocus: 'Fantine · Factory Women',
        actingTip: '芳婷拼命護住信紙，周圍女工形成壓迫感強烈的半圓包圍。',
        vocalTip: '芳婷的高音呼救需穿透群眾合唱，帶著真實的驚恐感。',
      },
      {
        timeSec: 165,
        timeFormatted: '02:45',
        sectionTitle: '市長離去與工頭解僱芳婷',
        characterFocus: 'Foreman · Fantine',
        actingTip: '市長轉身離場後，工頭立刻變臉將芳婷推倒在地，全體女工冷眼旁觀。',
        vocalTip: '結尾全體齊唱收束要俐落，留給下一首獨唱安靜的轉換空間。',
      },
    ],
  },
  {
    trackId: 'track_04',
    order: 4,
    act: 'Act I',
    title: '04. I Dreamed a Dream (我曾有夢 — 芳婷獨唱)',
    subtitle: '蒙特伊暗巷 · 哀婉敘事慢板 (68 BPM)',
    characters: 'Fantine',
    durationSec: 245,
    bpm: 68,
    audioUrl: '',
    audioLabel: '尚未掛載外部音檔（使用內建 68 BPM 排練節拍導引）',
    dramaticContext:
      '被工廠解僱、身無分文的芳婷獨自坐在暗巷中，回想年輕時與初戀情人美好的夏日誓言，對比今日走投無路的殘酷現實，唱出全劇最催淚的女性悲歌。',
    librettoSubtext:
      '從最初回憶青春的甜美憧憬（「When hope was high and life worth living」），轉折至遭拋棄的心碎（「He slept a summer by my side... And when the autumn wind blew chilly, he went away」），最後控訴現實如何殺死夢想（「Now life has killed the dream I dreamed」）。',
    vocalTips:
      '第一段主歌使用溫柔氣聲與輕混聲（Mix Voice），像是在對自己輕聲訴說；進入 "But the tigers come at night" 時轉為厚實的真聲胸腔支撐，表現恐懼與悲憤；最後結尾句 "killed the dream I dreamed" 漸弱收回，情緒比炫技更重要。',
    actingTips:
      '起初跪坐或微縮於舞台左前側暖冷交界光區，雙手環抱披肩；唱至回憶段落時眼神望向遠方微笑，唱至 "tigers come at night" 時眼神驟然驚恐，最後無力垂首。',
    cueSummary: '00:00 宣敘調前奏獨白 · 00:42 第一段溫柔追憶 · 01:45 暗夜猛虎轉折高潮 · 03:15 絕望收尾',
    cues: [
      {
        timeSec: 0,
        timeFormatted: '00:00',
        sectionTitle: '絕望前奏與孤獨起唱',
        characterFocus: 'Fantine',
        actingTip: '獨自坐在地面，緩緩抬起頭，眼神空洞而脆弱。',
        vocalTip: '弱起拍吸氣要安靜無聲，音準穩定在輕柔的中低音區。',
      },
      {
        timeSec: 105,
        timeFormatted: '01:45',
        sectionTitle: 'But the tigers come at night 情緒爆發',
        characterFocus: 'Fantine',
        actingTip: '由坐姿站起，向前邁出一步，雙手緊抓胸口衣襟。',
        vocalTip: '音量由 mp 推升至 ff，注意高音換聲區不要破音或過度喊叫。',
      },
      {
        timeSec: 195,
        timeFormatted: '03:15',
        sectionTitle: 'Now life has killed the dream I dreamed',
        characterFocus: 'Fantine',
        actingTip: '情緒耗盡，眼角含淚，視線緩緩落下。',
        vocalTip: '最後長音保持氣息平穩支撐，尾音自然消散在空氣中。',
      },
    ],
  },
  {
    trackId: 'track_05',
    order: 5,
    act: 'Act I',
    title: '05. Who Am I? / The Trial (我是誰？／法庭審判)',
    subtitle: '阿拉斯法院 · 莊嚴激昂 (78 BPM)',
    characters: 'Jean Valjean · Javert',
    durationSec: 175,
    bpm: 78,
    audioUrl: '',
    audioLabel: '尚未掛載外部音檔（使用內建 78 BPM 排練節拍導引）',
    dramaticContext:
      '警方抓到一名長相酷似尚萬強的無辜老漢準備定罪。身為市長的尚萬強陷入天人交戰：若保持沉默即可永遠安全並照顧全鎮百姓；若出面自首則將重返苦役監獄。最終他選擇步入法庭揭開衣領露出囚號「24601」。',
    librettoSubtext:
      '「If I speak, I am condemned. If I stay silent, I am damned!」點出法律定罪與良心譴責的抉擇；結尾高音「Who am I? 24601!」象徵他不再逃避過去，以真實靈魂面對上帝與世人。',
    vocalTips:
      '全曲橫跨極大音域，特別是結尾著名的假聲／頭聲高音「2-4-6-0-1!」。練習時務必先穩定中音區的分解和弦音階，高音「24601」採用高位置混聲（Mixed / Head Voice），保持軟顎抬高與下巴放鬆。',
    actingTips:
      '舞台後方或兩側可安排靜止的法庭陪審團剪影；尚萬強在舞台前區獨白，唱至「My soul belongs to God, I know I made that bargain long ago」時堅定走向法庭中央，扯開襯衫露出胸前烙印。',
    cueSummary: '00:00 道德兩難獨白 · 01:05 良心決斷爬音階 · 02:15 揭露身分 24601 高音定格',
    cues: [
      {
        timeSec: 0,
        timeFormatted: '00:00',
        sectionTitle: '沉默或自首的良心審問',
        characterFocus: 'Jean Valjean',
        actingTip: '身體微側，在兩個光區之間猶豫徘徊。',
        vocalTip: '三連音伴奏上方的人聲線條要流暢連貫（Legato）。',
      },
      {
        timeSec: 125,
        timeFormatted: '02:05',
        sectionTitle: '法庭揭露身分：Who am I? 24601!',
        characterFocus: 'Jean Valjean · Javert',
        actingTip: '邁步站上法庭中央高台，扯開外衣直視賈維，全場瞬間靜止。',
        vocalTip: '結尾高音前預留充足換氣口，以頭腔共鳴穩定拉長。',
      },
    ],
  },
  {
    trackId: 'track_06',
    order: 6,
    act: 'Act I',
    title: '06. Fantine’s Death — Come to Me (芳婷之死／託孤)',
    subtitle: '醫院病榻 · 溫柔搖籃曲轉莊嚴誓言 (64 BPM)',
    characters: 'Fantine · Jean Valjean',
    durationSec: 205,
    bpm: 64,
    audioUrl: '',
    audioLabel: '尚未掛載外部音檔（使用內建 64 BPM 排練節拍導引）',
    dramaticContext:
      '垂死的芳婷在病榻上產生幻覺，以為女兒珂賽特就在身邊。尚萬強趕到病床前，為自己的疏忽深深懺悔，並向芳婷立下重誓，必將珂賽特視如己出撫養長大。',
    librettoSubtext:
      '芳婷在幻覺中唱著溫柔的搖籃曲，與尚萬強沉痛的懺悔形成交織的二重唱（Counterpoint Duet），體現母愛超越死亡與尚萬強救贖使命的延續。',
    vocalTips:
      '雙人重唱時注意音量平衡：芳婷聲線虛弱空靈（多用氣聲與頭聲），尚萬強則須以溫暖克制的中低音包覆，不可蓋過芳婷的旋律線。',
    actingTips:
      '芳婷半躺於病床，視線望向空中彷彿摸著小珂賽特的臉龐；尚萬強單膝跪在床邊握住芳婷的手，在芳婷斷氣後輕輕為她闔上雙眼。',
    cueSummary: '00:00 芳婷病榻幻覺獨唱 · 01:10 尚萬強趕到床前承諾 · 02:35 雙人交織重唱與安息',
    cues: [
      {
        timeSec: 0,
        timeFormatted: '00:00',
        sectionTitle: 'Cosette, it’s turned so cold',
        characterFocus: 'Fantine',
        actingTip: '向空中伸出手，露出溫柔卻虛弱的微笑。',
        vocalTip: '音色清亮柔和，氣息連綿不斷。',
      },
      {
        timeSec: 130,
        timeFormatted: '02:10',
        sectionTitle: '託孤誓言二重唱',
        characterFocus: 'Jean Valjean · Fantine',
        actingTip: '尚萬強緊握芳婷雙手，芳婷在聽見承諾後安心嚥氣。',
        vocalTip: '兩人拍點與收尾呼吸必須完全同步。',
      },
    ],
  },
  {
    trackId: 'track_07',
    order: 7,
    act: 'Act I',
    title: '07. The Confrontation (醫院對決 — 尚萬強與賈維二重唱)',
    subtitle: '醫院病房 · 激烈戲劇衝突 (116 BPM)',
    characters: 'Javert · Jean Valjean',
    durationSec: 155,
    bpm: 116,
    audioUrl: '',
    audioLabel: '尚未掛載外部音檔（使用內建 116 BPM 排練節拍導引）',
    dramaticContext:
      '芳婷剛嚥氣，賈維便率警衝入病房逮捕尚萬強。尚萬強請求寬限三天去接回孤女珂賽特，賈維斷然拒絕，兩人在病床旁展開激烈的雙聲部對位與肢體搏鬥。',
    librettoSubtext:
      '全劇最著名的雙男聲對位（Contrapuntal Duet）：賈維唱著「Men like you can never change」，尚萬強同時唱著「Before you say another word, Javert... I have a duty that must be done」，將「冷酷律法」與「慈悲良知」的衝突推至頂點。',
    vocalTips:
      '兩條旋律線在後半段完全重疊！兩位演員必須先各自把自己的拍點與音準練到100%肌肉記憶，排練時不可被對方的旋律帶偏；咬字需極具穿透力。',
    actingTips:
      '注意舞台武打安全走位：賈維拔出警棍步步進逼，尚萬強奪下木椅格擋後將賈維壓制並掙脫逃離，動作需配合音樂重拍定點。',
    cueSummary: '00:00 賈維闖入逮捕 · 00:50 雙聲部同步對位高潮 · 02:05 肢體衝突與尚萬強突圍',
    cues: [
      {
        timeSec: 0,
        timeFormatted: '00:00',
        sectionTitle: 'Valjean, at last, we see each other plain',
        characterFocus: 'Javert · Jean Valjean',
        actingTip: '賈維拔出佩刀／警棍擋在門口，尚萬強緩緩從病床邊站起。',
        vocalTip: '起音果斷，重音強調每個句首。',
      },
      {
        timeSec: 55,
        timeFormatted: '00:55',
        sectionTitle: '雙聲部對位交鋒 (Counterpoint)',
        characterFocus: 'Jean Valjean · Javert',
        actingTip: '兩人繞著舞台中心呈圓弧對峙移動，眼神死死鎖定對方。',
        vocalTip: '嚴格守住各自節奏，切勿搶拍。',
      },
    ],
  },
  {
    trackId: 'track_08',
    order: 8,
    act: 'Act I',
    title: '08. Castle on a Cloud (雲端城堡 — 小珂賽特獨唱)',
    subtitle: '蒙費梅伊酒館外 · 純真三拍子 (92 BPM)',
    characters: 'Young Cosette · Mme. Thénardier',
    durationSec: 135,
    bpm: 92,
    audioUrl: '',
    audioLabel: '尚未掛載外部音檔（使用內建 92 BPM 排練節拍導引）',
    dramaticContext:
      '在德納第夫婦的黑心酒館裡，年幼的珂賽特被當作童工虐待。她一邊掃地一邊幻想著雲端上有一座沒有責罵、有人疼愛的城堡，隨後被德納第夫人粗暴喝斥去黑暗森林提水。',
    librettoSubtext:
      '純潔無瑕的童聲旋律與隨後德納第夫人刺耳粗俗的叫罵形成強烈戲劇反差，為下一首酒館群戲鋪墊。',
    vocalTips:
      '小珂賽特使用清純直音（Straight Tone，少顫音），音色乾淨透明；德納第夫人則採用誇張的鼻音與戲劇性格嗓音（Character Voice）。',
    actingTips:
      '小珂賽特拿著比自己還高的掃帚在舞台一角掃地，抱著破舊洋娃娃；德納第夫人出場時動作粗魯誇張，一把搶走洋娃娃並丟出水桶。',
    cueSummary: '00:00 小珂賽特掃地獨唱 · 01:20 德納第夫人闖入喝斥提水',
    cues: [
      {
        timeSec: 0,
        timeFormatted: '00:00',
        sectionTitle: 'There is a castle on a cloud',
        characterFocus: 'Young Cosette',
        actingTip: '放下掃帚抱著娃娃輕輕搖晃，眼神純真。',
        vocalTip: '三拍子圓舞曲律動輕盈，音準保持清亮。',
      },
      {
        timeSec: 82,
        timeFormatted: '01:22',
        sectionTitle: '德納第夫人打斷幻想',
        characterFocus: 'Mme. Thénardier · Young Cosette',
        actingTip: '德納第夫人叉腰大步走入，將水桶塞進珂賽特懷裡推向台側。',
        vocalTip: '語氣尖銳潑辣，節奏轉為急促。',
      },
    ],
  },
  {
    trackId: 'track_09',
    order: 9,
    act: 'Act I',
    title: '09. Master of the House (酒館老闆之歌 — 德納第夫婦與酒客)',
    subtitle: '蒙費梅伊酒館 · 黑色幽默滑稽圓舞曲 (108 BPM)',
    characters: 'Thénardier · Mme. Thénardier · Inn Patrons Ensemble',
    durationSec: 285,
    bpm: 108,
    audioUrl: '',
    audioLabel: '尚未掛載外部音檔（使用內建 108 BPM 排練節拍導引）',
    dramaticContext:
      '全劇最熱鬧的黑色喜劇段落！德納第老闆一面裝出殷勤好客的模樣，一面在酒裡摻水、用馬肉混充香腸、順手牽羊扒竊酒客財物；德納第夫人則在旁冷嘲熱諷揭穿丈夫的真面目。',
    librettoSubtext:
      '在悲劇主線中提供關鍵的喜劇調劑（Comic Relief），同時深刻諷刺投機主義者如何在亂世中靠欺詐小聰明生存。',
    vocalTips:
      '節奏感與戲劇表情大於美聲！德納第的唱腔需油腔滑調、富於變化（忽而假裝紳士、忽而猥瑣低語）；合唱團在副歌「Master of the house, doling out the charm」需唱出微醺搖擺的酒館氣氛。',
    actingTips:
      '設計豐富的舞台小動作（Stage Business）：偷手錶、往酒壺倒髒水、跟酒客乾杯；全體酒客舉杯搖晃的時機必須整齊，場面熱鬧但動線不能遮擋主唱。',
    cueSummary: '00:00 德納第滑稽開場 · 01:10 全體酒客舉杯副歌 · 02:30 德納第夫人毒舌吐槽段落',
    cues: [
      {
        timeSec: 0,
        timeFormatted: '00:00',
        sectionTitle: 'Welcome, Monsieur, sit yourself down',
        characterFocus: 'Thénardier · Ensemble',
        actingTip: '德納第穿梭在酒桌間鞠躬哈腰，趁酒客不注意偷走錢袋。',
        vocalTip: '咬字靈活誇張，重拍帶有一點滑稽的拖音。',
      },
      {
        timeSec: 75,
        timeFormatted: '01:15',
        sectionTitle: '酒館大合唱：Master of the House',
        characterFocus: 'Ensemble · Thénardier',
        actingTip: '全體酒客起立或踏桌舉杯，隨拍子左右搖擺。',
        vocalTip: '合唱飽滿洪亮，營造酒館喧鬧感。',
      },
      {
        timeSec: 160,
        timeFormatted: '02:40',
        sectionTitle: '德納第夫人獨白揭底',
        characterFocus: 'Mme. Thénardier',
        actingTip: '把德納第推開，走到台前對觀眾翻白眼吐槽，引發全場笑聲。',
        vocalTip: '胸腔大音量放開唱，戲劇張力十足。',
      },
    ],
  },
  {
    trackId: 'track_10',
    order: 10,
    act: 'Act I',
    title: '10. Stars (繁星 — 賈維獨唱)',
    subtitle: '巴黎夜空橋畔 · 莊嚴崇高慢板 (72 BPM)',
    characters: 'Javert',
    durationSec: 190,
    bpm: 72,
    audioUrl: '',
    audioLabel: '尚未掛載外部音檔（使用內建 72 BPM 排練節拍導引）',
    dramaticContext:
      '1832 年巴黎夜空下，升任巴黎警督的賈維站在橋頭仰望漫天星辰。對他而言，繁星象徵上帝與宇宙不變的秩序，而任何違法越界者（如逃犯尚萬強）都如同墜落的撒旦，必須被繩之以法。',
    librettoSubtext:
      '這首歌讓賈維不再只是扁平的反派，而是展現他近乎宗教狂熱的道德秩序觀——也正因這份絕對僵化的信念，埋下他第二幕無法承受尚萬強善舉而崩潰的伏筆。',
    vocalTips:
      '經典男中音（Baritone）代表曲。氣息要深沉寬廣，每個樂句保持莊嚴的連音（Legato），切忌急躁；結尾長音「This I swear by the stars!」需展現威嚴厚實的胸頭混聲共鳴。',
    actingTips:
      '走位極簡！賈維全程站立於舞台中央高處或橋欄旁，雙手扶欄或持警帽置於胸前，僅透過抬頭仰望星空與握拳立誓的手勢傳達內心堅定。',
    cueSummary: '00:00 夜空橋頭靜立起唱 · 01:15 秩序與星辰高潮樂段 · 02:35 星空下莊嚴立誓收尾',
    cues: [
      {
        timeSec: 0,
        timeFormatted: '00:00',
        sectionTitle: 'There, out in the darkness',
        characterFocus: 'Javert',
        actingTip: '背光站立於高台，凝視遠方黑暗中的巴黎街區。',
        vocalTip: '中低音區穩定沉著，字音清晰深邃。',
      },
      {
        timeSec: 140,
        timeFormatted: '02:20',
        sectionTitle: 'This I swear by the stars!',
        characterFocus: 'Javert',
        actingTip: '緩緩舉起右手向夜空立誓，燈光聚焦於臉部輪廓。',
        vocalTip: '結尾高音飽滿且穩定維持四拍以上。',
      },
    ],
  },
  {
    trackId: 'track_11',
    order: 11,
    act: 'Act I',
    title: '11. Do You Hear the People Sing? (你可聽見人民在歌唱？)',
    subtitle: 'ABC 咖啡館與巴黎街頭 · 革命進行曲 (104 BPM)',
    characters: 'Enjolras · Marius · Students · Paris Citizens Ensemble',
    durationSec: 145,
    bpm: 104,
    audioUrl: '',
    audioLabel: '尚未掛載外部音檔（使用內建 104 BPM 排練節拍導引）',
    dramaticContext:
      '拉馬克將軍逝世前夕，學生領袖安灼拉在街頭振臂高呼，號召巴黎青年與百姓挺身反抗暴政，點燃起義火種。',
    librettoSubtext:
      '由安灼拉單人號召開始，逐步加入學生代表，最終匯聚成全體市民的震撼大合唱，象徵革命信念從星火燎原為不可阻擋的浪潮。',
    vocalTips:
      '注意「漸層式音量堆疊」：第一遍由安灼拉獨唱（mf，堅定號召），第二遍男聲學生加入（f，附點節奏鮮明），最後全體四部大合唱（ff，輝煌寬廣）。附點八分音符配十六分音符的節奏型必須精準有彈性。',
    actingTips:
      '安灼拉站上木桌或高箱揮動紅旗；群眾從舞台四面八方分批湧入，眼神堅定望向遠方地平線，最後一拍全體振臂高舉定格。',
    cueSummary: '00:00 安灼拉獨唱號召 · 00:45 學生群加入進軍 · 01:30 全體揮旗大合唱高潮',
    cues: [
      {
        timeSec: 0,
        timeFormatted: '00:00',
        sectionTitle: '安灼拉起義號召',
        characterFocus: 'Enjolras',
        actingTip: '站上咖啡館桌椅，眼神掃視全場學生，手勢充滿號召力。',
        vocalTip: '男高音嘹亮挺拔，附點節奏清晰。',
      },
      {
        timeSec: 85,
        timeFormatted: '01:25',
        sectionTitle: '全體市民齊唱與揮旗推進',
        characterFocus: 'Full Cast Ensemble',
        actingTip: '全體演員由後舞台向前舞台同步推進兩步，紅旗於中央揮舞。',
        vocalTip: '四部和聲飽滿，高音部切忌尖叫，以集體共鳴創造震撼音牆。',
      },
    ],
  },
  {
    trackId: 'track_12',
    order: 12,
    act: 'Act I',
    title: '12. One Day More (只待明日 — 第一幕終曲八重唱與大合唱)',
    subtitle: '巴黎前夜 · 史詩交響進行曲 (96 BPM)',
    characters: 'Valjean · Marius · Cosette · Éponine · Enjolras · Javert · Thénardiers · Ensemble',
    durationSec: 225,
    bpm: 96,
    audioUrl: '',
    audioLabel: '尚未掛載外部音檔（使用內建 96 BPM 排練節拍導引）',
    dramaticContext:
      '第一幕壓軸終曲！起義前夕的最後一夜，所有主要角色的命運在此交會：尚萬強準備帶珂賽特逃往英國、馬呂斯與珂賽特被迫分離、愛潘妮暗自心碎、安灼拉號召學生築起街壘、賈維決心潛伏平亂、德納第夫婦則伺機發國難財。',
    librettoSubtext:
      '音樂劇史上最經典的多重對位大合唱（Polyphonic Ensemble Finale）：六條截然不同的個人動機旋律在同一和聲框架下交織並行，展現同一場歷史風暴中每個人截然不同的渴望與抉擇。',
    vocalTips:
      '各主唱聲部必須嚴格按照自己的節奏型演唱（尚萬強是寬廣長音、馬呂斯與珂賽特是抒情對唱、愛潘妮是高音悲鳴、安灼拉與賈維是進行曲節拍、德納第是切分滑稽調）。建議先使用本平台的「A-B 段落循環」分組對練，再合全體大合唱。',
    actingTips:
      '採用經典「三角形楔形陣列（V-Formation）」：尚萬強居中領頭，馬呂斯與珂賽特分立左右前側，愛潘妮位於斜後方暗角，安灼拉與學生於後方高台揮旗，全體隨音樂一步步邁向台前燈光。',
    cueSummary: '00:00 尚萬強獨唱起頭 · 00:45 戀人與愛潘妮三重唱 · 01:30 賈維與德納第加入 · 02:30 全員三角形推進終曲',
    cues: [
      {
        timeSec: 0,
        timeFormatted: '00:00',
        sectionTitle: 'One day more... another day, another destiny',
        characterFocus: 'Jean Valjean',
        actingTip: '尚萬強獨自站在前舞台中央，神情凝重。',
        vocalTip: '沉穩內斂的起音，為全曲奠定速度基準。',
      },
      {
        timeSec: 50,
        timeFormatted: '00:50',
        sectionTitle: '馬呂斯、珂賽特與愛潘妮交錯重唱',
        characterFocus: 'Marius · Cosette · Éponine',
        actingTip: '馬呂斯與珂賽特隔空伸手相望，愛潘妮站在陰影處獨自凝視馬呂斯。',
        vocalTip: '愛潘妮的「One day more」高音切入需精準果斷。',
      },
      {
        timeSec: 155,
        timeFormatted: '02:35',
        sectionTitle: '全體 V 字隊形大合唱與幕落定格',
        characterFocus: 'Full Cast',
        actingTip: '全體組成 V 字隊形緩步向前推進，最後一聲鼓響同時定格。',
        vocalTip: '全劇組最大音量與最寬廣和聲，結尾長音整齊收拍。',
      },
    ],
  },
  {
    trackId: 'track_13',
    order: 13,
    act: 'Act II',
    title: '13. On My Own (孤身一人 — 愛潘妮獨唱)',
    subtitle: '巴黎深夜雨巷 · 淒美抒情行板 (74 BPM)',
    characters: 'Éponine',
    durationSec: 230,
    bpm: 74,
    audioUrl: '',
    audioLabel: '尚未掛載外部音檔（使用內建 74 BPM 排練節拍導引）',
    dramaticContext:
      '第二幕開場後，替馬呂斯傳遞情書給珂賽特的愛潘妮，獨自走在深夜冰冷的巴黎雨街上。她在幻想中與馬呂斯相擁漫步，卻又一次次清醒面對「他從未愛過我」的苦澀真相。',
    librettoSubtext:
      '前半段在幻想與現實間切換（「In the rain the pavement shines like silver... I pretend he’s beside me」）；高潮段喊出「I love him! But only on my own」，道盡單戀者的倔強、卑微與深情。',
    vocalTips:
      '流行音樂劇混聲唱法（Contemporary Musical Theatre Belting）的代表作。開頭敘事段保持自然口語感；轉調後的「I love him, I love him」需使用紮實的前置混聲（Forward Mix Belt），最後一句「all alone... on my own」回歸輕柔心碎的弱音。',
    actingTips:
      '身穿寬大舊外套，雙手插口袋在冷色街燈下漫步；幻想馬呂斯在身旁時伸手挽住空氣、臉上泛起羞澀笑容，隨即發現身旁空無一人而自嘲苦笑。',
    cueSummary: '00:00 深夜街頭獨白 · 01:05 幻想與他漫步雨中 · 02:15 轉調高潮 I love him · 03:20 孤獨收尾',
    cues: [
      {
        timeSec: 0,
        timeFormatted: '00:00',
        sectionTitle: 'And now I’m all alone again',
        characterFocus: 'Éponine',
        actingTip: '坐在街角路燈下，抱膝緩緩起身。',
        vocalTip: '自然語氣起唱，像在跟夜空自言自語。',
      },
      {
        timeSec: 135,
        timeFormatted: '02:15',
        sectionTitle: '轉調高潮：I love him, but every day I’m learning',
        characterFocus: 'Éponine',
        actingTip: '走向前舞台中心，張開雙臂迎向冷風，情緒全面釋放。',
        vocalTip: '高音 Belt 保持鼻咽腔共鳴支撐，避免喉部緊縮。',
      },
    ],
  },
  {
    trackId: 'track_14',
    order: 14,
    act: 'Act II',
    title: '14. Building the Barricade / Red and Black (築起街壘／紅與黑)',
    subtitle: '聖德尼街街壘 · 戰鬥進行曲 (112 BPM)',
    characters: 'Enjolras · Marius · Gavroche · Students Ensemble',
    durationSec: 195,
    bpm: 112,
    audioUrl: '',
    audioLabel: '尚未掛載外部音檔（使用內建 112 BPM 排練節拍導引）',
    dramaticContext:
      '學生與市民搬運桌椅、木桶與石塊築起街壘防線。安灼拉指揮防禦部署，小男孩伽弗洛什機智揭穿潛伏的密探賈維，全體青年誓言堅守街壘。',
    librettoSubtext:
      '展現青春熱血與革命理想主義，但也暗藏力量懸殊的悲劇預兆。',
    vocalTips:
      '合唱節奏強勁有力，注意換氣口統一；伽弗洛什的段落需活潑清脆、咬字機靈。',
    actingTips:
      '搬運街壘道具時必須按照排定動線與節拍定位，確保安全且視覺層次分明（高處持槍警戒、低處堆疊沙包）。',
    cueSummary: '00:00 搬運道具築起街壘 · 01:10 伽弗洛什揭穿賈維 · 02:20 街壘防線就緒合唱',
    cues: [
      {
        timeSec: 0,
        timeFormatted: '00:00',
        sectionTitle: 'Here upon these stones we will build our barricade',
        characterFocus: 'Enjolras · Students',
        actingTip: '分組搬運木箱與桌椅至舞台中央拼接成街壘。',
        vocalTip: '邊動邊唱時保持核心穩定，避免氣息急促喘氣。',
      },
      {
        timeSec: 110,
        timeFormatted: '01:50',
        sectionTitle: '街壘集結宣誓',
        characterFocus: 'Students Ensemble',
        actingTip: '全體學生登上街壘高低錯落站立，舉槍面向觀眾。',
        vocalTip: '男聲部共鳴集中，營造青年軍氣勢。',
      },
    ],
  },
  {
    trackId: 'track_15',
    order: 15,
    act: 'Act II',
    title: '15. A Little Fall of Rain (一點落雨 — 愛潘妮之死)',
    subtitle: '街壘戰壕 · 溫柔悲傷慢板 (66 BPM)',
    characters: 'Éponine · Marius',
    durationSec: 190,
    bpm: 66,
    audioUrl: '',
    audioLabel: '尚未掛載外部音檔（使用內建 66 BPM 排練節拍導引）',
    dramaticContext:
      '愛潘妮為了替馬呂斯傳信並重返街壘，在翻越街壘時中彈受致命傷。她倒在馬呂斯懷裡，微笑著說雨水洗去傷痛、只要有他抱著便不再害怕，最終在愛人懷中安詳離世。',
    librettoSubtext:
      '「A little fall of rain can hardly hurt me now」以最輕描淡寫的溫柔詞句掩飾致命傷痛，是全劇最令人鼻酸的離別二重唱。',
    vocalTips:
      '愛潘妮需唱出氣息漸漸微弱但內心滿足的甜美音色；馬呂斯則是壓抑哭腔的溫柔陪伴，切忌音量過大蓋過愛潘妮。',
    actingTips:
      '馬呂斯半跪扶住愛潘妮上身，直到愛潘妮拉開外套露出胸口血跡時才驚覺她中彈；愛潘妮手指輕觸馬呂斯臉頰後手部自然滑落。',
    cueSummary: '00:00 愛潘妮翻越街壘負傷 · 01:05 雙人溫柔對唱 · 02:35 愛潘妮離世與馬呂斯悲慟',
    cues: [
      {
        timeSec: 0,
        timeFormatted: '00:00',
        sectionTitle: 'Don’t you fret, M’sieur Marius',
        characterFocus: 'Éponine · Marius',
        actingTip: '愛潘妮強忍劇痛靠在馬呂斯懷中，露出微笑。',
        vocalTip: '輕聲頭腔共鳴，句尾帶著微微嘆息感。',
      },
      {
        timeSec: 145,
        timeFormatted: '02:25',
        sectionTitle: 'And rain will make the flowers grow',
        characterFocus: 'Éponine · Marius',
        actingTip: '愛潘妮唱完前半句後斷氣，馬呂斯哽咽接唱完最後半句「grow」。',
        vocalTip: '兩人的接唱必須無縫銜接，情感真摯克制。',
      },
    ],
  },
  {
    trackId: 'track_16',
    order: 16,
    act: 'Act II',
    title: '16. Bring Him Home (帶他回家 — 尚萬強祈禱獨唱)',
    subtitle: '街壘深夜 · 聖潔寧靜慢板 (60 BPM)',
    characters: 'Jean Valjean',
    durationSec: 215,
    bpm: 60,
    audioUrl: '',
    audioLabel: '尚未掛載外部音檔（使用內建 60 BPM 排練節拍導引）',
    dramaticContext:
      '決戰前夜，街壘上的青年們沉沉睡去。尚萬強看著熟睡的馬呂斯，向天主獻上最虔誠的祈禱：祈求上帝帶走年邁的自己，讓這群年輕的生命平安返家。',
    librettoSubtext:
      '全劇音樂與心靈的最高昇華。尚萬強不僅放下了對馬呂斯奪走女兒的嫉妒，更將父愛擴及整個世代的青年，完成徹底的聖潔化。',
    vocalTips:
      '男高音試金石！開頭第一個音「God on high」即需以極度柔和純淨的假聲／頭聲（Falsetto / Voix Mixte）浮現，全程要求極致的氣息控制（Messa di voce 漸強漸弱），猶如夜間祈禱般純淨無瑕。',
    actingTips:
      '周圍學生靜止熟睡於街壘各處；尚萬強跪立於馬呂斯身旁，雙手合十或輕撫熟睡青年的肩頭，眼神仰望上方微弱的聖潔白光。',
    cueSummary: '00:00 God on high 頭聲起音 · 01:20 He’s like the son I might have known · 02:55 祈禱高音綿延收尾',
    cues: [
      {
        timeSec: 0,
        timeFormatted: '00:00',
        sectionTitle: 'God on high, hear my prayer',
        characterFocus: 'Jean Valjean',
        actingTip: '在熟睡的學生之間緩步跪下，雙手微抬仰望天際。',
        vocalTip: '起音極輕柔（pp），使用純淨頭聲共鳴，不可有氣音雜質。',
      },
      {
        timeSec: 165,
        timeFormatted: '02:45',
        sectionTitle: 'Bring him peace, bring him joy... bring him home',
        characterFocus: 'Jean Valjean',
        actingTip: '全身靜止如雕像，僅靠聲音傳遞無私大愛。',
        vocalTip: '最後長音綿延不斷，音量漸弱如燭光緩緩熄滅。',
      },
    ],
  },
  {
    trackId: 'track_17',
    order: 17,
    act: 'Act II',
    title: '17. Empty Chairs at Empty Tables (空桌與空椅 — 馬呂斯獨唱)',
    subtitle: 'ABC 咖啡館舊址 · 悲愴慢板 (66 BPM)',
    characters: 'Marius · Ghosts of Students Ensemble',
    durationSec: 185,
    bpm: 66,
    audioUrl: '',
    audioLabel: '尚未掛載外部音檔（使用內建 66 BPM 排練節拍導引）',
    dramaticContext:
      '街壘起義失敗，除被尚萬強從下水道救出的馬呂斯外，安灼拉與所有學生全數犧牲。傷癒後的馬呂斯重返昔日聚會的咖啡館，面對空蕩蕩的桌椅，承受倖存者的椎心內疚與思念。',
    librettoSubtext:
      '「Oh my friends, my friends, don’t ask me what your sacrifice was for」道出劫後餘生者的孤獨與對摯友無盡的追思。',
    vocalTips:
      '前兩段以極度克制、略帶沙啞的輕聲吟唱；唱至「Oh my friends, my friends forgive me」時推上悲憤高音，隨即在最後一句收回至哽咽獨白。',
    actingTips:
      '舞台擺放數張空椅與燭火；馬呂斯手扶空椅緩步走過，後舞台暗區可浮現昔日同窗手持蠟燭的靜默幻影，在歌曲結束時同步吹熄蠟燭。',
    cueSummary: '00:00 咖啡館空椅追思 · 01:15 昔日同窗幻影浮現 · 02:10 Oh my friends 情緒潰堤高音',
    cues: [
      {
        timeSec: 0,
        timeFormatted: '00:00',
        sectionTitle: 'There’s a grief that can’t be spoken',
        characterFocus: 'Marius',
        actingTip: '手撫摸空蕩的木椅椅背，步伐沉重緩慢。',
        vocalTip: '木吉他／豎琴伴奏下保持溫暖而哀傷的中低音。',
      },
      {
        timeSec: 120,
        timeFormatted: '02:00',
        sectionTitle: 'Oh my friends, my friends, don’t ask me',
        characterFocus: 'Marius · Student Ghosts',
        actingTip: '後方學生幻影緩緩浮現，馬呂斯跪倒在空桌前。',
        vocalTip: '高音飽滿且帶強烈哭訴張力，隨即漸弱收束。',
      },
    ],
  },
  {
    trackId: 'track_18',
    order: 18,
    act: 'Act II',
    title: '18. Finale — Epilogue / Do You Hear the People Sing? (終幕：愛即上帝／人民之歌再現)',
    subtitle: '修道院至永恆光界 · 莊嚴聖詠轉史詩大合唱 (92 BPM)',
    characters: 'Jean Valjean · Fantine · Éponine · Cosette · Marius · Full Cast Ensemble',
    durationSec: 270,
    bpm: 92,
    audioUrl: '',
    audioLabel: '尚未掛載外部音檔（使用內建 92 BPM 排練節拍導引）',
    dramaticContext:
      '年邁的尚萬強在修道院迎接趕來探望的珂賽特與馬呂斯，交出寫滿生平自白的信件後，在芳婷與愛潘妮靈魂的引領下安詳辭世；隨後全劇所有逝去與存活的角色共同匯聚於舞台，唱響終極大合唱。',
    librettoSubtext:
      '核心名言「To love another person is to see the face of God（去愛一個人，即是看見上帝的容顏）」總結全劇救贖主題；緊接著全體合唱《人民之歌》再現，將個人救贖與人類追求自由光明的永恆信念合而為一。',
    vocalTips:
      '前半段尚萬強、芳婷、愛潘妮的三重唱需如天籟般純淨溫暖；當進入「Do You Hear the People Sing?」最終再現時，全體演員四部和聲全開，速度莊嚴穩健，最後一個和弦維持飽滿共鳴直到大幕落下。',
    actingTips:
      '尚萬強由座椅起身，脫下年邁外袍走向後方光束中的芳婷與愛潘妮；全體演員從舞台兩側緩步走出並排於台前，手牽手或高舉雙手迎向觀眾席，完成全劇謝幕前最震撼的定格。',
    cueSummary: '00:00 尚萬強臨終告白與託付 · 01:25 芳婷與愛潘妮靈魂迎接 · 02:35 全劇組終極大合唱謝幕',
    cues: [
      {
        timeSec: 0,
        timeFormatted: '00:00',
        sectionTitle: 'Alone I wait in the shadows',
        characterFocus: 'Jean Valjean · Fantine',
        actingTip: '尚萬強靜坐於修道院椅上，芳婷身著白衣從後方光區緩步走近。',
        vocalTip: '聲線平靜慈祥，充滿釋懷感。',
      },
      {
        timeSec: 95,
        timeFormatted: '01:35',
        sectionTitle: 'To love another person is to see the face of God',
        characterFocus: 'Jean Valjean · Fantine · Éponine',
        actingTip: '三人面向彼此伸手相握，珂賽特與馬呂斯在床前拭淚。',
        vocalTip: '三部和聲極度柔和諧和，音準純淨。',
      },
      {
        timeSec: 160,
        timeFormatted: '02:40',
        sectionTitle: '終幕全體大合唱：Do You Hear the People Sing? (Reprise)',
        characterFocus: 'Full Cast Ensemble',
        actingTip: '全體演員邁步走向舞台最前緣，仰望觀眾席高唱至最後一拍定格。',
        vocalTip: '全團最高能量釋放，咬字宏亮、和聲輝煌。',
      },
    ],
  },
];
