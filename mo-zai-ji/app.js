(() => {
  const $ = (sel) => document.querySelector(sel);

  /** 与真实日历对齐：1 格 = 1 个自然日（1440 分钟） */
  const GANTT_CAL_MINUTES_PER_DAY = 1440;
  const GANTT_SNAP_MINUTES = 30;
  const GANTT_MIN_SEGMENT_MINUTES = 15;
  const GANTT_DAY_WIDTH_PX = 56;
  const MS_PER_DAY = 86400000;
  const GANTT_ROW_H = 52;
  const GANTT_AXIS_H = 36;

  const pages = {
    lang: $("#pageLang"),
    welcome: $("#pageWelcome"),
    input: $("#pageInput"),
    questions: $("#pageQuestions"),
    result: $("#pageResult"),
    calendar: $("#pageCalendar"),
  };

  const state = {
    lang: "zh",
    anxieties: [], // { text }
    comfortCount: 0,
    collected: [], // { topic, changed: boolean, ...details }
    /** 甘特条：仅「可改变」拆解出的步骤；不在月历上排「接纳」项 */
    ganttSegments: [], // { id, title, durationMinutes, startMinute, rowIndex, completed, splitGroupId?, completedNote?, completedAt? }
    taskIdSeq: 1,
    calendarView: "week",
    /** 日视图：当天 0 点时间戳（本地） */
    calendarFocusDayMs: null,
    qIndex: 0,
    activePage: "lang",
    flowStep: "canChange",
  };

  let persistTimer = null;
  const STORAGE_KEY = "mzj-app-state-v1";

  let ganttDrag = null;
  let ganttRowDrag = null;
  let ganttSplitTargetId = null;
  let ganttAllocateGroupId = null;
  let celebrateSegId = null;

  const ENCOURAGE_ZH = [
    "你已经在前进了，很棒。",
    "慢慢来，你不需要一次完成一切。",
    "你正在认真面对生活。",
    "每一步都算数，哪怕很小。",
    "你已经比想象中更有力量。",
  ];
  const ENCOURAGE_EN = [
    "You are moving forward. That is wonderful.",
    "Take it slow. You do not need to finish everything at once.",
    "You are facing life with courage.",
    "Every small step counts.",
    "You are stronger than you think.",
  ];
  const ENCOURAGE_FR = [
    "Tu avances deja, c'est magnifique.",
    "Vas doucement, tu n'as pas besoin de tout finir d'un coup.",
    "Tu fais face a la vie avec courage.",
    "Chaque petit pas compte.",
    "Tu es plus fort(e) que tu ne le crois.",
  ];
  const ENCOURAGE = {
    zh: ENCOURAGE_ZH,
    "zh-tw": ENCOURAGE_ZH,
    ja: ENCOURAGE_EN,
    en: ENCOURAGE_EN,
    fr: ENCOURAGE_FR,
  };

  function phrasePackLang() {
    if (state.lang === "zh-tw") return "zh";
    if (state.lang === "ja") return "en";
    return state.lang;
  }

  function pickPhrase(bucket) {
    const pack = window.APP_PHRASES;
    if (!pack || !pack[bucket]) return "";
    const L = phrasePackLang();
    const arr = pack[bucket][L] || pack[bucket].zh;
    return arr[Math.floor(Math.random() * arr.length)] || "";
  }

  const I18N = {
    zh: {
      hLangTitle: "选择语言",
      pLangHint: "让我们用你喜欢的方式，慢下来一点点。",
      welcomeTitle: "莫着急",
      welcomeReadyBtn: "我准备好了",
      welcomeParas: [
        "欢迎来到「莫着急」。",
        "你现在的感受，是被允许的。",
        "不需要立刻变好，也不需要马上想通一切。",
        "我们可以一起，慢慢看清这些让你不安的事情。",
        "一件一件来。",
        "有些可以改变，有些需要放下。",
        "无论是哪一种，你都不用一个人面对。",
      ],
      btnReset: "重置",
      hInputTitle: "写下让你焦虑的事情",
      pInputHint: "你可以添加多条。我们会逐条温柔地处理。",
      btnAdd: "添加",
      btnToQuestions: "开始",
      btnBackToLang: "语言",
      hQuestionTitle: "逐条提问",
      qCanChangeTitle: "这件事你可以改变吗？",
      yes: "是",
      no: "否",
      btnBackToCanChange: "返回",
      btnSaveDetails: "保存并继续",
      btnContinueAfterNo: "继续",
      hResultTitle: "你的任务清单",
      pResultHint: "我们把“紧迫”的放前面，并在简单与困难之间交替提醒你。",
      btnToCalendar: "任务月历",
      hCalendarTitle: "任务甘特月历",
      pCalendarHint: "按你填写的时长智能排期；可拖动调整。多条任务可在同一时段并行（不同轨道）。",
      btnPrint: "导出PDF",
      btnBackToResult: "返回任务清单",
      encourageTitle: "温柔提醒",
      calendarMonth: "第 {n} 月",
      calendarDay: "第 {n} 天",
      calendarEmpty: "今日空白",
      editDayTitle: "编辑：第 {n} 天",
      save: "保存",
      moveToDay: "改到",
      completedProgress: "完成 {done} / {total}",
      statusTodo: "未完成",
      statusDone: "已完成",
      btnRestart: "再来一次",
      lblImportance: "重要性（1-5）",
      lblUrgency: "紧迫性（1-5）",
      lblStepsEditor: "具体步骤",
      hintStepsEditor: "为每一步写上名称，并在后面填写时间与困难程度（1-5）。",
      btnAddStep: "添加步骤",
      actionEncourageTitle: "行动鼓励",
      btnActionEncourageRefresh: "换一句",
      stepRowLabel: "步骤 {n}",
      stepNamePlaceholder: "步骤名称，例如：整理桌面",
      phTimeAmount: "时长",
      phDifficultySelect: "难度",
      removeStep: "删除",
      acceptSituationLabel: "我们需要接受的情况",
      benefitAllThingsGood: "凡事发生必有利于我。",
      errorNoTopic: "请先添加至少一条焦虑的事情。",
      errorInvalidNumber: "请确认：重要性、紧迫性在 1-5 之间；每一步的困难程度在 1-5 之间。",
      errorMissingTimePerStep: "请为每一步填写正整数时长，并选择单位。",
      errorNoSteps: "请至少添加一步，并填写步骤名称。",
      resultEmptyOnlyAccept: "暂无拆步任务；可打开「任务甘特月历」查看接纳说明与（若有）排期。",
      resultNoTasksYet: "目前没有需要生成任务的内容。",
      acceptRemembranceTitle: "我们选择接纳的事（不在排期里，但没有忘记）",
      acceptRemembranceLead:
        "以下事项不会进入下方甘特图，也不会写入导出的 PDF；它们留在这里，提醒你练习接纳，并相信：凡事发生必有利于我。",
      ganttHint:
        "排期从「明天」0 点起算。可切换按周 / 按月 / 按年查看。点「拆分」按粒度切段（虚线）；切段后点「分配时间」可按「几小时 / 每天（或每周、每月、每年）」自动铺到时间上，再拖动微调。",
      gantt_lane: "轨道 {n}",
      ganttSplit: "拆分",
      ganttAllocate: "分配时间",
      ganttEmpty:
        "暂无需要排期的步骤。若只有「接纳」类事项，它们只显示在上方说明区域，不会出现在排期图中。",
      calViewWeek: "按周",
      calViewMonth: "按月",
      calViewYear: "按年",
      splitModalTitle: "拆分为",
      splitModalHint: "按任务总时长，只显示可用的拆分粒度。",
      splitNoOptions: "这段任务不足一小时，无需再拆分。",
      splitByHour: "每小时",
      splitByDay: "每天",
      splitByWeek: "每周",
      splitByMonth: "每月",
      splitByYear: "每年",
      splitApply: "确定",
      splitCancel: "取消",
      allocateModalTitle: "分配时间",
      allocateModalHint: "填写每个周期内投入的时长，我们会按时间顺序把已拆分的段落排进日历。",
      allocateHourLabel: "小时",
      allocatePerDay: "每天",
      allocatePerWeek: "每周",
      allocatePerMonth: "每月",
      allocatePerYear: "每年",
      allocateApply: "应用",
      allocateCancel: "取消",
      yearViewBlurb:
        "你有一个以年为单位的计划，我们一起努力，一天一天脚踏实地，很快就到实现目标的那一天了！很开心与你一同启程。",
      weekLabelYM: "{y}年{m}月",
      comfortTitle: "安慰的话",
      footerText: "莫着急，凡事发生必有利于我。",
      inputPlaceholder: "比如：明天要迟到。",
      listEmpty: "还没有内容。你可以先写一条让你焦虑的事情。",
      formHint: "按 Enter 也可以添加。",
      topicPrefix: "这件事是：",
      detailsErrorPrefix: "还有一点小信息需要确认：",
      metaImportance: "重要性",
      metaUrgency: "紧迫性",
      metaTime: "每步时间",
      metaTimeNorm: "换算后",
      metaPlan: "建议时段",
      metaDifficulty: "困难度",
      metaSteps: "步骤数",
      simple: "简单",
      hard: "困难",
      unitMinute: "分钟",
      unitHour: "小时",
      unitWeek: "星期",
      unitMonth: "月",
      comfortExplain: "如果你觉得暂时无法改变，就先把自己照顾好。",
      btnBackPrev: "返回上一步修改",
      pdfPreviewTitle: "打印预览（A4 横向）",
      btnSaveLocalSheet: "存在本地",
      btnPrintFromPreview: "打印 / PDF",
      closePreview: "关闭",
      brandSub: "简中 · 繁中 · 日 · EN · FR",
      langLabelZh: "简体中文",
      langLabelZhtw: "繁體中文",
      langLabelJa: "日本語",
      langLabelEn: "English",
      langLabelFr: "Français",
      toastSavedLocal: "已保存到本机浏览器",
      calViewDay: "按日",
      calPinchHint: "双指捏合可缩放：放大看更小单位（年→月→周→日），缩小看更大范围。",
      celebrateTitle: "太棒了！",
      celebrateBody:
        "你已完成一项任务，真的太棒了！一定要奖励自己哦！在这里写下对下一步的自己说的话吧！",
      btnSaveForFutureSelf: "保存给未来的自己",
      btnCelebrateSkip: "不用，继续加油！",
      notesToSelfTitle: "写给自己的话",
      segmentNoteModalTitle: "给自己的留言",
      btnNoteReadOk: "好的",
      ganttRowDragLabel: "上下拖动调整所在行",
    },
    en: {
      hLangTitle: "Choose language",
      pLangHint: "Let’s slow down a little—gently, in your own way.",
      welcomeTitle: "No Worry",
      welcomeReadyBtn: "I’m ready",
      welcomeParas: [
        "Welcome to “No Worry.”",
        "Whatever you’re feeling right now is allowed.",
        "You don’t have to fix everything today.",
        "Let’s gently look at what’s on your mind, one thing at a time.",
        "Some things can be changed.",
        "Some things can be let go.",
        "Either way, you don’t have to go through it alone.",
      ],
      btnReset: "Reset",
      hInputTitle: "Write what makes you anxious",
      pInputHint: "Add as many as you want. We’ll go through them one by one.",
      btnAdd: "Add",
      btnToQuestions: "Start",
      btnBackToLang: "Language",
      hQuestionTitle: "One question per item",
      qCanChangeTitle: "Can you change this situation?",
      yes: "Yes",
      no: "No",
      btnBackToCanChange: "Back",
      btnSaveDetails: "Save & continue",
      btnContinueAfterNo: "Continue",
      hResultTitle: "Your task list",
      pResultHint: "Urgent items first, alternating simple and difficult tasks to keep you steady.",
      btnToCalendar: "Task Calendar",
      hCalendarTitle: "Task Gantt calendar",
      pCalendarHint: "Scheduled from your durations; drag to adjust. Several tasks can run in parallel on different rows.",
      btnPrint: "Export PDF",
      btnBackToResult: "Back to Task List",
      encourageTitle: "Gentle reminder",
      calendarMonth: "Month {n}",
      calendarDay: "Day {n}",
      calendarEmpty: "Free day",
      editDayTitle: "Edit: Day {n}",
      save: "Save",
      moveToDay: "Move to",
      completedProgress: "Completed {done} / {total}",
      statusTodo: "Todo",
      statusDone: "Done",
      btnRestart: "Try again",
      lblImportance: "Importance (1-5)",
      lblUrgency: "Urgency (1-5)",
      lblStepsEditor: "Concrete steps",
      hintStepsEditor: "Name each step, then add time and difficulty (1-5).",
      btnAddStep: "Add step",
      actionEncourageTitle: "Action boost",
      btnActionEncourageRefresh: "Another phrase",
      stepRowLabel: "Step {n}",
      stepNamePlaceholder: "Step name, e.g. tidy your desk",
      phTimeAmount: "Duration",
      phDifficultySelect: "Diff.",
      removeStep: "Remove",
      acceptSituationLabel: "What we need to accept",
      benefitAllThingsGood: "Everything that happens is ultimately for my good.",
      errorNoTopic: "Please add at least one anxiety item first.",
      errorInvalidNumber: "Check: importance and urgency are 1-5; each step difficulty is 1-5.",
      errorMissingTimePerStep: "Enter a positive integer duration for each step and pick a unit.",
      errorNoSteps: "Add at least one step with a name.",
      resultEmptyOnlyAccept: "No step tasks yet; open the Gantt calendar for acceptance notes and any schedule.",
      resultNoTasksYet: "Nothing to turn into tasks yet.",
      acceptRemembranceTitle: "What we’re accepting (not on the schedule—we haven’t forgotten)",
      acceptRemembranceLead:
        "These won’t appear in the Gantt chart or in the exported PDF. They stay here as a reminder to practice acceptance: things can work out for you.",
      ganttHint:
        "Planning starts tomorrow at midnight. Switch week / month / year. Use Split for chunk sizes (dashed); then Allocate time to spread chunks by hours per day/week/month/year, and drag to fine-tune.",
      gantt_lane: "Lane {n}",
      ganttSplit: "Split",
      ganttAllocate: "Allocate time",
      ganttEmpty:
        "Nothing to put on the timeline. Acceptance-only items appear in the section above and are not in the PDF.",
      calViewWeek: "Week",
      calViewMonth: "Month",
      calViewYear: "Year",
      splitModalTitle: "Split into",
      splitModalHint: "Only granularities that fit your total duration are shown.",
      splitNoOptions: "This block is one hour or less—no split needed.",
      splitByHour: "Every hour",
      splitByDay: "Every day",
      splitByWeek: "Every week",
      splitByMonth: "Every month",
      splitByYear: "Every year",
      splitApply: "OK",
      splitCancel: "Cancel",
      allocateModalTitle: "Allocate time",
      allocateModalHint: "How many hours each period? We’ll place the split chunks in order on the calendar.",
      allocateHourLabel: "hours",
      allocatePerDay: "per day",
      allocatePerWeek: "per week",
      allocatePerMonth: "per month",
      allocatePerYear: "per year",
      allocateApply: "Apply",
      allocateCancel: "Cancel",
      yearViewBlurb:
        "You’re planning in years—we’ll take it day by day together. You’re closer to your goal than you think, and I’m glad we’re starting this journey with you.",
      weekLabelYM: "{m}/{y}",
      comfortTitle: "A gentle note",
      footerText: "Take your time—everything that happens can work out for you.",
      inputPlaceholder: "e.g., I might be late tomorrow.",
      listEmpty: "Nothing here yet. Add one thing that feels anxious.",
      formHint: "Press Enter to add too.",
      topicPrefix: "This is the thing:",
      detailsErrorPrefix: "One small detail still needs checking:",
      metaImportance: "Importance",
      metaUrgency: "Urgency",
      metaTime: "Time per step",
      metaTimeNorm: "Normalized",
      metaPlan: "Suggested slot",
      metaDifficulty: "Difficulty",
      metaSteps: "Steps",
      simple: "Simple",
      hard: "Hard",
      unitMinute: "minute",
      unitHour: "hour",
      unitWeek: "week",
      unitMonth: "month",
      comfortExplain: "If you can’t change it right now, please care for yourself first.",
      btnBackPrev: "Back to edit previous step",
      pdfPreviewTitle: "Print preview (A4 landscape)",
      btnSaveLocalSheet: "Save locally",
      btnPrintFromPreview: "Print / PDF",
      closePreview: "Close",
      brandSub: "ZH · ZH-TW · JA · EN · FR",
      langLabelZh: "简体中文",
      langLabelZhtw: "繁體中文",
      langLabelJa: "日本語",
      langLabelEn: "English",
      langLabelFr: "Français",
      toastSavedLocal: "Saved in this browser",
      calViewDay: "Day",
      calPinchHint: "Pinch to zoom the calendar: zoom in for finer views (year → month → week → day), zoom out for the big picture.",
      celebrateTitle: "You did it!",
      celebrateBody:
        "You finished a task—that’s wonderful. Be sure to reward yourself! Write a few words here for the you who takes the next step.",
      btnSaveForFutureSelf: "Save for my future self",
      btnCelebrateSkip: "No thanks—keep going!",
      notesToSelfTitle: "Notes to my future self",
      segmentNoteModalTitle: "Your note",
      btnNoteReadOk: "OK",
      ganttRowDragLabel: "Drag vertically to change row",
    },
    fr: {
      hLangTitle: "Choisir la langue",
      pLangHint: "Ralentissons un peu. Doucement, à ta façon.",
      welcomeTitle: "T’inquiète pas",
      welcomeReadyBtn: "Je suis prêt(e)",
      welcomeParas: [
        "Bienvenue dans “T’inquiète pas”.",
        "Ce que tu ressens en ce moment est légitime.",
        "Tu n’as pas besoin de tout résoudre aujourd’hui.",
        "On peut regarder ensemble, doucement, ce qui te pèse, une chose à la fois.",
        "Certaines choses peuvent changer,",
        "d’autres peuvent être acceptées.",
        "Dans tous les cas, tu n’es pas seul(e).",
      ],
      btnReset: "Réinitialiser",
      hInputTitle: "Écris ce qui te rend anxieux",
      pInputHint: "Ajoute autant de choses que tu veux. On les traitera une par une.",
      btnAdd: "Ajouter",
      btnToQuestions: "Démarrer",
      btnBackToLang: "Langue",
      hQuestionTitle: "Une question par item",
      qCanChangeTitle: "Peux-tu changer cette situation ?",
      yes: "Oui",
      no: "Non",
      btnBackToCanChange: "Retour",
      btnSaveDetails: "Enregistrer & continuer",
      btnContinueAfterNo: "Continuer",
      hResultTitle: "Ta liste de tâches",
      pResultHint: "Les priorités d’abord, en alternant tâches simples et difficiles pour rester régulier.",
      btnToCalendar: "Calendrier des tâches",
      hCalendarTitle: "Calendrier Gantt des tâches",
      pCalendarHint: "Planifié selon tes durées ; glisse pour ajuster. Plusieurs tâches peuvent être parallèles sur des rangées différentes.",
      btnPrint: "Exporter PDF",
      btnBackToResult: "Retour à la liste",
      encourageTitle: "Rappel doux",
      calendarMonth: "Mois {n}",
      calendarDay: "Jour {n}",
      calendarEmpty: "Jour libre",
      editDayTitle: "Modifier: Jour {n}",
      save: "Enregistrer",
      moveToDay: "Déplacer vers",
      completedProgress: "Terminé {done} / {total}",
      statusTodo: "À faire",
      statusDone: "Fait",
      btnRestart: "Recommencer",
      lblImportance: "Importance (1-5)",
      lblUrgency: "Urgence (1-5)",
      lblStepsEditor: "Étapes concrètes",
      hintStepsEditor: "Nomme chaque étape, puis indique le temps et la difficulté (1-5).",
      btnAddStep: "Ajouter une étape",
      actionEncourageTitle: "Encouragement à l'action",
      btnActionEncourageRefresh: "Autre phrase",
      stepRowLabel: "Étape {n}",
      stepNamePlaceholder: "Nom de l'étape, ex. ranger le bureau",
      phTimeAmount: "Durée",
      phDifficultySelect: "Diff.",
      removeStep: "Retirer",
      acceptSituationLabel: "Ce que nous devons accepter",
      benefitAllThingsGood: "Tout ce qui arrive finit par m'être favorable.",
      errorNoTopic: "Ajoute d’abord au moins un sujet qui te rend anxieux.",
      errorInvalidNumber: "Vérifie : importance et urgence entre 1 et 5 ; difficulté de chaque étape entre 1 et 5.",
      errorMissingTimePerStep: "Entre une durée entière positive pour chaque étape et choisis une unité.",
      errorNoSteps: "Ajoute au moins une étape avec un nom.",
      resultEmptyOnlyAccept: "Pas encore d'étapes ; ouvre le calendrier Gantt pour l'acceptation et le planning.",
      resultNoTasksYet: "Rien à transformer en tâches pour le moment.",
      acceptRemembranceTitle: "Ce que nous acceptons (hors planning — on n’oublie pas)",
      acceptRemembranceLead:
        "Ces éléments n’apparaissent pas dans le diagramme de Gantt ni dans le PDF exporté ; ils restent ici pour l’acceptation : tout peut finir par m’être favorable.",
      ganttHint:
        "Le planning commence demain à minuit. Vues semaine / mois / année. « Diviser » par pas (pointillés) puis « Répartir » des heures par jour / semaine / mois / année, puis glisse pour ajuster.",
      gantt_lane: "Rangée {n}",
      ganttSplit: "Diviser",
      ganttAllocate: "Répartir le temps",
      ganttEmpty:
        "Rien à placer sur la frise. Les seuls sujets « à accepter » sont au-dessus et absents du PDF.",
      calViewWeek: "Semaine",
      calViewMonth: "Mois",
      calViewYear: "Année",
      splitModalTitle: "Découper en",
      splitModalHint: "Seules les échelles possibles pour cette durée sont proposées.",
      splitNoOptions: "Une heure ou moins : pas besoin de découper.",
      splitByHour: "Chaque heure",
      splitByDay: "Chaque jour",
      splitByWeek: "Chaque semaine",
      splitByMonth: "Chaque mois",
      splitByYear: "Chaque année",
      splitApply: "OK",
      splitCancel: "Annuler",
      allocateModalTitle: "Répartir le temps",
      allocateModalHint: "Combien d’heures par période ? On place les blocs découpés dans l’ordre sur le calendrier.",
      allocateHourLabel: "heures",
      allocatePerDay: "par jour",
      allocatePerWeek: "par semaine",
      allocatePerMonth: "par mois",
      allocatePerYear: "par an",
      allocateApply: "Appliquer",
      allocateCancel: "Annuler",
      yearViewBlurb:
        "Tu avances sur des années : on y va jour après jour, patiemment. Tu approches de ton objectif, et je suis content(e) de partir avec toi.",
      weekLabelYM: "{m}/{y}",
      comfortTitle: "Un mot doux",
      footerText: "Pas de précipitation : tout ce qui arrive peut finir par t’être favorable.",
      inputPlaceholder: "ex : Je risque d’être en retard demain.",
      listEmpty: "Rien pour le moment. Ajoute un sujet qui te stresse.",
      formHint: "Entrée pour ajouter aussi.",
      topicPrefix: "Ce qui te pèse :",
      detailsErrorPrefix: "Il manque une petite précision :",
      metaImportance: "Importance",
      metaUrgency: "Urgence",
      metaTime: "Temps par étape",
      metaTimeNorm: "Normalisé",
      metaPlan: "Créneau conseillé",
      metaDifficulty: "Difficulté",
      metaSteps: "Étapes",
      simple: "Facile",
      hard: "Difficile",
      unitMinute: "minute",
      unitHour: "heure",
      unitWeek: "semaine",
      unitMonth: "mois",
      comfortExplain: "Si tu ne peux pas changer ça maintenant, commence par te protéger un peu.",
      btnBackPrev: "Revenir à l’étape précédente",
      pdfPreviewTitle: "Aperçu d’impression (A4 paysage)",
      btnSaveLocalSheet: "Enregistrer en local",
      btnPrintFromPreview: "Imprimer / PDF",
      closePreview: "Fermer",
      brandSub: "ZH · ZH-TW · JA · EN · FR",
      langLabelZh: "简体中文",
      langLabelZhtw: "繁體中文",
      langLabelJa: "日本語",
      langLabelEn: "English",
      langLabelFr: "Français",
      toastSavedLocal: "Enregistré dans ce navigateur",
      calViewDay: "Jour",
      calPinchHint:
        "Pince pour zoomer : zoom avant pour plus de détail (année → mois → semaine → jour), zoom arrière pour voir plus large.",
      celebrateTitle: "Bravo !",
      celebrateBody:
        "Tu as terminé une tâche, c’est super. Offre-toi une petite récompense ! Écris ici un mot pour toi du prochain pas.",
      btnSaveForFutureSelf: "Enregistrer pour moi plus tard",
      btnCelebrateSkip: "Non merci, j’avance !",
      notesToSelfTitle: "Mots pour moi-même",
      segmentNoteModalTitle: "Ton message",
      btnNoteReadOk: "OK",
      ganttRowDragLabel: "Glisser pour changer de ligne",
    },
  };

  if (window.MZJ_I18N_ZHTW) {
    I18N["zh-tw"] = window.MZJ_I18N_ZHTW;
  }
  if (window.MZJ_I18N_JA) {
    I18N.ja = window.MZJ_I18N_JA;
  }

  function t(key) {
    const row = I18N[state.lang];
    const v = row && row[key];
    if (v != null && v !== "") return v;
    if (state.lang === "ja") {
      return I18N.en[key] ?? I18N.zh[key] ?? key;
    }
    if (state.lang === "zh-tw") {
      return I18N.zh[key] ?? I18N.en[key] ?? key;
    }
    return I18N.zh[key] ?? key;
  }

  function schedulePersist() {
    clearTimeout(persistTimer);
    persistTimer = setTimeout(() => {
      try {
        localStorage.setItem(
          STORAGE_KEY,
          JSON.stringify({
            lang: state.lang,
            anxieties: state.anxieties,
            collected: state.collected,
            comfortCount: state.comfortCount,
            ganttSegments: state.ganttSegments,
            taskIdSeq: state.taskIdSeq,
            calendarView: state.calendarView,
            qIndex: state.qIndex,
            activePage: state.activePage,
            flowStep: state.flowStep,
            calendarFocusDayMs: state.calendarFocusDayMs,
          }),
        );
      } catch (_) {
        /* ignore quota */
      }
    }, 400);
  }

  function flushPersist() {
    clearTimeout(persistTimer);
    persistTimer = null;
    try {
      localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({
          lang: state.lang,
          anxieties: state.anxieties,
          collected: state.collected,
          comfortCount: state.comfortCount,
          ganttSegments: state.ganttSegments,
          taskIdSeq: state.taskIdSeq,
          calendarView: state.calendarView,
          qIndex: state.qIndex,
          activePage: state.activePage,
          flowStep: state.flowStep,
          calendarFocusDayMs: state.calendarFocusDayMs,
        }),
      );
    } catch (_) {
      /* ignore */
    }
  }

  function loadPersisted() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return false;
      const data = JSON.parse(raw);
      if (!data || typeof data !== "object") return false;
      const pagesOk = ["lang", "welcome", "input", "questions", "result", "calendar"];
      state.lang = typeof data.lang === "string" && I18N[data.lang] ? data.lang : "zh";
      state.anxieties = Array.isArray(data.anxieties) ? data.anxieties : [];
      state.collected = Array.isArray(data.collected) ? data.collected : [];
      state.comfortCount = typeof data.comfortCount === "number" ? data.comfortCount : 0;
      state.ganttSegments = Array.isArray(data.ganttSegments) ? data.ganttSegments : [];
      state.taskIdSeq = typeof data.taskIdSeq === "number" && data.taskIdSeq > 0 ? data.taskIdSeq : 1;
      state.calendarView =
        data.calendarView === "month" ||
        data.calendarView === "year" ||
        data.calendarView === "day"
          ? data.calendarView
          : "week";
      state.qIndex =
        typeof data.qIndex === "number" && data.qIndex >= 0 ? data.qIndex : 0;
      if (state.anxieties.length > 0 && state.qIndex >= state.anxieties.length) {
        state.qIndex = Math.max(0, state.anxieties.length - 1);
      }
      state.flowStep =
        data.flowStep === "details" || data.flowStep === "comfort" ? data.flowStep : "canChange";
      state.calendarFocusDayMs =
        typeof data.calendarFocusDayMs === "number" && Number.isFinite(data.calendarFocusDayMs)
          ? data.calendarFocusDayMs
          : null;
      state.activePage = pagesOk.includes(data.activePage) ? data.activePage : "lang";
      if (state.activePage === "questions" && !state.anxieties.length) state.activePage = "input";
      if (state.activePage === "result" && !state.collected.length) state.activePage = "input";
      return true;
    } catch (_) {
      return false;
    }
  }

  function clearPersisted() {
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch (_) {
      /* ignore */
    }
  }

  function tf(key, vars) {
    let out = t(key);
    Object.entries(vars || {}).forEach(([k, v]) => {
      out = out.replace(new RegExp(`\\{${k}\\}`, "g"), String(v));
    });
    return out;
  }

  const MM_TO_PX = 96 / 25.4;

  function buildCalendarPrintInner() {
    const root = document.createElement("div");
    root.className = "print-cal-inner";

    const title = document.createElement("div");
    title.className = "print-cal-title";
    title.textContent = t("hCalendarTitle");
    root.appendChild(title);

    const enc = document.createElement("div");
    enc.className = "print-cal-encourage";
    const encEl = $("#encourageText");
    enc.innerHTML = `<div class="print-cal-enc-sub">${escapeHtml(t("encourageTitle"))}</div><div>${escapeHtml((encEl && encEl.textContent) || "")}</div>`;
    root.appendChild(enc);

    const acc = $("#acceptRemembrance");
    if (acc && !acc.hidden && (acc.textContent || "").trim()) {
      const c = acc.cloneNode(true);
      c.hidden = false;
      c.classList.remove("no-print");
      root.appendChild(c);
    }

    const host = $("#ganttHost");
    if (host && host.innerHTML) {
      const box = document.createElement("div");
      box.className = "print-gantt-wrap gantt-scroll";
      box.innerHTML = host.innerHTML;
      root.appendChild(box);
    }

    appendNotesToSelfForPrint(root);

    return root;
  }

  function runFireworks() {
    const ov = $("#fireworksOverlay");
    if (!ov) return;
    ov.setAttribute("aria-hidden", "false");
    ov.classList.add("is-on");
    ov.innerHTML = "";
    for (let i = 0; i < 42; i++) {
      const p = document.createElement("div");
      p.className = "firework-particle";
      p.style.left = `${6 + Math.random() * 88}%`;
      p.style.top = `${14 + Math.random() * 58}%`;
      p.style.animationDelay = `${Math.random() * 0.4}s`;
      p.style.setProperty("--fw-rot", `${Math.random() * 360}deg`);
      p.style.setProperty("--fw-dx", `${Math.random() * 200 - 100}px`);
      p.style.setProperty("--fw-dy", `${Math.random() * 200 - 100}px`);
      ov.appendChild(p);
    }
    window.setTimeout(() => {
      ov.classList.remove("is-on");
      ov.innerHTML = "";
      ov.setAttribute("aria-hidden", "true");
    }, 2200);
  }

  function openCompletionCelebration(segId) {
    celebrateSegId = segId;
    const modal = $("#completionCelebrateModal");
    const inp = $("#celebrateNoteInput");
    const saveB = $("#btnCelebrateSave");
    const title = $("#celebrateTitle");
    const body = $("#celebrateBody");
    const skipB = $("#btnCelebrateSkip");
    if (!modal || !inp || !saveB) return;
    if (title) title.textContent = t("celebrateTitle");
    if (body) body.textContent = t("celebrateBody");
    if (skipB) skipB.textContent = t("btnCelebrateSkip");
    saveB.textContent = t("btnSaveForFutureSelf");
    saveB.disabled = true;
    inp.value = "";
    modal.classList.remove("hidden");
    runFireworks();
    inp.focus();
  }

  function closeCompletionCelebration() {
    celebrateSegId = null;
    const modal = $("#completionCelebrateModal");
    if (modal) modal.classList.add("hidden");
    const inp = $("#celebrateNoteInput");
    if (inp instanceof HTMLTextAreaElement) inp.value = "";
  }

  function confirmCelebrateSave() {
    const id = celebrateSegId;
    if (id == null) return;
    const seg = state.ganttSegments.find((s) => s.id === id);
    const inp = $("#celebrateNoteInput");
    const text = inp instanceof HTMLTextAreaElement ? inp.value.trim() : "";
    if (!seg || !text) return;
    seg.completed = true;
    seg.completedNote = text;
    seg.completedAt = new Date().toISOString();
    closeCompletionCelebration();
    renderCalendarPage();
    schedulePersist();
  }

  function confirmCelebrateSkip() {
    const id = celebrateSegId;
    if (id == null) return;
    const seg = state.ganttSegments.find((s) => s.id === id);
    if (seg) {
      seg.completed = true;
      delete seg.completedNote;
      delete seg.completedAt;
    }
    closeCompletionCelebration();
    renderCalendarPage();
    schedulePersist();
  }

  function openSegmentNoteReadModal(seg) {
    const modal = $("#segmentNoteReadModal");
    const tEl = $("#segmentNoteReadTitle");
    const bEl = $("#segmentNoteReadBody");
    const dEl = $("#segmentNoteReadDate");
    if (!modal || !tEl || !bEl || !dEl) return;
    tEl.textContent = t("segmentNoteModalTitle");
    bEl.textContent = seg.completedNote || "";
    dEl.textContent = seg.completedAt ? formatSelfNoteDate(seg.completedAt) : "";
    modal.classList.remove("hidden");
  }

  function closeSegmentNoteReadModal() {
    const modal = $("#segmentNoteReadModal");
    if (modal) modal.classList.add("hidden");
  }

  function renderNotesToSelfSection() {
    const el = $("#notesToSelfSection");
    if (!el) return;
    const items = state.ganttSegments.filter(
      (s) => s.completed && s.completedNote && String(s.completedNote).trim(),
    );
    items.sort((a, b) => String(b.completedAt || "").localeCompare(String(a.completedAt || "")));
    if (!items.length) {
      el.hidden = true;
      el.innerHTML = "";
      return;
    }
    el.hidden = false;
    el.innerHTML = `
      <h3 class="notes-to-self__title">${escapeHtml(t("notesToSelfTitle"))}</h3>
      <div class="notes-to-self__list">
        ${items
          .map(
            (s) => `
          <div class="notes-to-self__item">
            <p class="notes-to-self__quote">${escapeHtml(String(s.completedNote))}</p>
            <p class="notes-to-self__date muted">${escapeHtml(formatSelfNoteDate(s.completedAt))}</p>
          </div>`,
          )
          .join("")}
      </div>`;
  }

  function appendNotesToSelfForPrint(root) {
    const items = state.ganttSegments.filter(
      (s) => s.completed && s.completedNote && String(s.completedNote).trim(),
    );
    items.sort((a, b) => String(b.completedAt || "").localeCompare(String(a.completedAt || "")));
    if (!items.length) return;
    const box = document.createElement("div");
    box.className = "print-notes-to-self";
    box.innerHTML = `<div class="print-cal-title" style="margin-top:14px">${escapeHtml(t("notesToSelfTitle"))}</div>
      ${items
        .map(
          (s) =>
            `<div class="print-notes-to-self__item"><p class="print-notes-to-self__quote">${escapeHtml(String(s.completedNote))}</p><p class="print-notes-to-self__date muted">${escapeHtml(formatSelfNoteDate(s.completedAt))}</p></div>`,
        )
        .join("")}`;
    root.appendChild(box);
  }

  function paginatePrintContent(innerRoot) {
    const pageW = 277 * MM_TO_PX;
    const pageH = 178 * MM_TO_PX;
    const measure = innerRoot.cloneNode(true);
    const holder = document.createElement("div");
    holder.style.cssText = `position:fixed;left:-14000px;top:0;width:${pageW}px;visibility:hidden;pointer-events:none;`;
    holder.appendChild(measure);
    document.body.appendChild(holder);
    const totalH = measure.scrollHeight;
    document.body.removeChild(holder);

    const n = Math.max(1, Math.ceil(totalH / pageH));
    const sheets = [];
    for (let i = 0; i < n; i++) {
      const sheet = document.createElement("div");
      sheet.className = "print-a4-sheet";
      const view = document.createElement("div");
      view.className = "print-a4-viewport";
      view.style.height = `${pageH}px`;
      view.style.overflow = "hidden";
      const shifted = document.createElement("div");
      shifted.style.marginTop = `${-i * pageH}px`;
      shifted.appendChild(innerRoot.cloneNode(true));
      view.appendChild(shifted);
      sheet.appendChild(view);
      sheets.push(sheet);
    }
    return sheets;
  }

  function fillPrintMountFromLiveCalendar() {
    ensureGanttData();
    renderCalendarPage();
    const inner = buildCalendarPrintInner();
    const sheets = paginatePrintContent(inner);
    const pm = $("#printMount");
    if (!pm) return;
    pm.innerHTML = "";
    sheets.forEach((s) => pm.appendChild(s));
  }

  function openPdfPreview() {
    fillPrintMountFromLiveCalendar();
    const pm = $("#printMount");
    const wrap = $("#pdfPreviewSheets");
    if (wrap && pm) {
      wrap.innerHTML = "";
      Array.from(pm.children).forEach((n) => wrap.appendChild(n.cloneNode(true)));
    }
    const modal = $("#pdfPreviewModal");
    if (modal) modal.classList.remove("hidden");
    updateUIStrings();
  }

  function closePdfPreview() {
    const modal = $("#pdfPreviewModal");
    if (modal) modal.classList.add("hidden");
  }

  function showPage(which) {
    Object.values(pages).forEach((p) => {
      p.classList.remove("active");
      const c = p.querySelector(".glass-card");
      if (c) c.classList.remove("card-enter");
    });
    const target = pages[which];
    target.classList.add("active");
    const card = target.querySelector(".glass-card");
    if (card) {
      void card.offsetWidth;
      card.classList.add("card-enter");
    }
    state.activePage = which;
    schedulePersist();
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function setLangAttributes() {
    const map = { zh: "zh-CN", "zh-tw": "zh-Hant", ja: "ja", en: "en", fr: "fr" };
    document.documentElement.lang = map[state.lang] || "en";
  }

  function updateUIStrings() {
    $("#btnReset").textContent = t("btnReset");
    $("#hLangTitle").textContent = t("hLangTitle");
    $("#pLangHint").textContent = t("pLangHint");

    $("#welcomeTitle").textContent = t("welcomeTitle");
    $("#btnWelcomeReady").textContent = t("welcomeReadyBtn");
    const welcomeParas = I18N[state.lang].welcomeParas || I18N.zh.welcomeParas;
    $("#welcomeBody").innerHTML = welcomeParas.map((p) => `<p>${escapeHtml(p)}</p>`).join("");

    $("#hInputTitle").textContent = t("hInputTitle");
    $("#pInputHint").textContent = t("pInputHint");
    $("#btnAdd").textContent = t("btnAdd");
    const inputFormHint = $("#inputFormHint");
    if (inputFormHint) inputFormHint.textContent = t("formHint");
    $("#btnToQuestions").textContent = t("btnToQuestions");
    $("#btnBackToLang").textContent = t("btnBackPrev");
    $("#hQuestionTitle").textContent = t("hQuestionTitle");
    $("#qCanChangeTitle").textContent = t("qCanChangeTitle");

    // Question choices
    const noBtn = $("#stepCanChange button[data-answer='no']");
    const yesBtn = $("#stepCanChange button[data-answer='yes']");
    noBtn.textContent = t("no");
    yesBtn.textContent = t("yes");

    $("#btnBackToCanChange").textContent = t("btnBackToCanChange");
    $("#btnSaveDetails").textContent = t("btnSaveDetails");
    $("#btnContinueAfterNo").textContent = t("btnContinueAfterNo");

    $("#hResultTitle").textContent = t("hResultTitle");
    $("#pResultHint").textContent = t("pResultHint");
    $("#btnToCalendar").textContent = t("btnToCalendar");
    $("#btnRestart").textContent = t("btnRestart");

    $("#hCalendarTitle").textContent = t("hCalendarTitle");
    $("#pCalendarHint").textContent = t("pCalendarHint");
    $("#btnPrint").textContent = t("btnPrint");
    $("#btnBackToResult").textContent = t("btnBackPrev");
    $("#encourageTitle").textContent = t("encourageTitle");
    $("#actionEncourageTitle").textContent = t("actionEncourageTitle");
    const btnEnc = $("#btnActionEncourageRefresh");
    if (btnEnc) btnEnc.textContent = t("btnActionEncourageRefresh");

    $("#comfortTitle").textContent = t("comfortTitle");
    $("#footerText").textContent = t("footerText");

    const bt = $("#brandTitle");
    if (bt) bt.textContent = t("welcomeTitle");
    const bs = $("#brandSub");
    if (bs) bs.textContent = t("brandSub");
    const lz = $("#langBtnZh");
    if (lz) lz.textContent = t("langLabelZh");
    const lzt = $("#langBtnZhtw");
    if (lzt) lzt.textContent = t("langLabelZhtw");
    const lj = $("#langBtnJa");
    if (lj) lj.textContent = t("langLabelJa");
    const le = $("#langBtnEn");
    if (le) le.textContent = t("langLabelEn");
    const lf = $("#langBtnFr");
    if (lf) lf.textContent = t("langLabelFr");

    const bw = $("#btnBackPrevWelcome");
    if (bw) bw.textContent = t("btnBackPrev");
    const bq = $("#btnBackPrevQuestions");
    if (bq) bq.textContent = t("btnBackPrev");
    const br = $("#btnBackPrevResult");
    if (br) br.textContent = t("btnBackPrev");
    const bc = $("#btnBackFromComfort");
    if (bc) bc.textContent = t("btnBackPrev");

    const pdfTitle = $("#pdfPreviewTitleEl");
    if (pdfTitle) pdfTitle.textContent = t("pdfPreviewTitle");
    const bsl = $("#btnSaveLocalSheet");
    if (bsl) bsl.textContent = t("btnSaveLocalSheet");
    const bpf = $("#btnPrintFromPreview");
    if (bpf) bpf.textContent = t("btnPrintFromPreview");
    const bcp = $("#btnClosePdfPreview");
    if (bcp) bcp.textContent = t("closePreview");
    $("#anxietyText").placeholder = t("inputPlaceholder");

    // Details form labels/placeholders
    const impLabel = document.querySelector("label[for='importance']");
    const urgLabel = document.querySelector("label[for='urgency']");
    if (impLabel) impLabel.textContent = t("lblImportance");
    if (urgLabel) urgLabel.textContent = t("lblUrgency");

    $("#lblStepsEditor").textContent = t("lblStepsEditor");
    $("#hintStepsEditor").textContent = t("hintStepsEditor");
    $("#btnAddStepRow").textContent = t("btnAddStep");

    refreshAllStepRowI18n();

    const impScale = document.querySelector(".scale-picker[data-field='importance']");
    const urgScale = document.querySelector(".scale-picker[data-field='urgency']");
    if (impScale) impScale.setAttribute("aria-label", t("lblImportance"));
    if (urgScale) urgScale.setAttribute("aria-label", t("lblUrgency"));

    // Update the "topic" sentence so it stays consistent across languages.
    $("#pWhatYouWrite").innerHTML = `${t("topicPrefix")} <span id="topicText" class="topic"></span>`;

    const gh = $("#ganttHint");
    if (gh) gh.textContent = t("ganttHint");
    const dbtn = $("#btnCalViewDay");
    if (dbtn) dbtn.textContent = t("calViewDay");
    const wk = $("#btnCalViewWeek");
    const mo = $("#btnCalViewMonth");
    const yr = $("#btnCalViewYear");
    if (wk) wk.textContent = t("calViewWeek");
    if (mo) mo.textContent = t("calViewMonth");
    if (yr) yr.textContent = t("calViewYear");
    const pinch = $("#calPinchHint");
    if (pinch) pinch.textContent = t("calPinchHint");
    const noteOk = $("#btnSegmentNoteOk");
    if (noteOk) noteOk.textContent = t("btnNoteReadOk");
    refreshAllocateModalI18n();
    if (pages.calendar.classList.contains("active")) renderCalendarPage();
  }

  function restoreUIFromState() {
    $("#anxietyText").value = "";
    $("#btnToQuestions").disabled = state.anxieties.length === 0;
    const ap = state.activePage;
    if (ap === "lang") {
      showPage("lang");
      return;
    }
    if (ap === "welcome") {
      showPage("welcome");
      return;
    }
    if (ap === "input") {
      showPage("input");
      return;
    }
    if (ap === "questions") {
      showPage("questions");
      setStep(state.flowStep);
      if (state.flowStep === "comfort") showComfortSentence();
      if (state.flowStep === "details") {
        clearDetailsForm();
        refreshActionEncourage();
      }
      renderQuestionState();
      return;
    }
    if (ap === "result") {
      renderResults();
      showPage("result");
      return;
    }
    if (ap === "calendar") {
      renderCalendarPage();
      showPage("calendar");
      return;
    }
    showPage("lang");
  }

  function init() {
    const had = loadPersisted();
    bindEvents();
    updateUIStrings();
    setLangAttributes();
    if (had) {
      restoreUIFromState();
    } else {
      showPage("lang");
    }
    renderAnxietyList();
    window.addEventListener("beforeunload", flushPersist);
    document.addEventListener("visibilitychange", () => {
      if (document.visibilityState === "hidden") flushPersist();
    });
  }

  function bindEvents() {
    // Language select
    document.querySelectorAll(".lang-btn").forEach((btn) => {
      btn.addEventListener("click", () => {
        state.lang = btn.dataset.lang || "zh";
        updateUIStrings();
        setLangAttributes();
        showPage("welcome");
      });
    });

    $("#btnWelcomeReady").addEventListener("click", () => {
      showPage("input");
      $("#anxietyText").focus();
    });

    $("#btnReset").addEventListener("click", () => {
      clearPersisted();
      state.lang = "zh";
      state.anxieties = [];
      state.collected = [];
      state.comfortCount = 0;
      state.ganttSegments = [];
      state.taskIdSeq = 1;
      state.calendarView = "week";
      state.calendarFocusDayMs = null;
      state.qIndex = 0;
      state.flowStep = "canChange";
      updateUIStrings();
      setLangAttributes();
      showPage("lang");
      $("#btnToQuestions").disabled = true;
      $("#anxietyText").value = "";
      renderAnxietyList();
    });

    $("#btnBackToLang").addEventListener("click", () => showPage("welcome"));

    const btnBackPrevWelcome = $("#btnBackPrevWelcome");
    if (btnBackPrevWelcome) {
      btnBackPrevWelcome.addEventListener("click", () => showPage("lang"));
    }
    const btnBackPrevQuestions = $("#btnBackPrevQuestions");
    if (btnBackPrevQuestions) {
      btnBackPrevQuestions.addEventListener("click", () => showPage("input"));
    }
    const btnBackPrevResult = $("#btnBackPrevResult");
    if (btnBackPrevResult) {
      btnBackPrevResult.addEventListener("click", () => showPage("input"));
    }
    const btnBackFromComfort = $("#btnBackFromComfort");
    if (btnBackFromComfort) {
      btnBackFromComfort.addEventListener("click", () => setStep("canChange"));
    }

    $("#formAddAnxiety").addEventListener("submit", (e) => {
      e.preventDefault();
      const input = $("#anxietyText");
      const text = (input.value || "").trim();
      if (!text) return;
      addAnxiety(text);
      input.value = "";
      input.focus();
    });

    $("#btnToQuestions").addEventListener("click", () => {
      if (!state.anxieties.length) return;
      setupQuestionFlow();
    });

    $("#btnContinueAfterNo").addEventListener("click", () => {
      // store "no" response and advance
      const comfort = $("#comfortText").textContent || "";
      state.collected.push({
        topic: state.anxieties[state.qIndex].text,
        changed: false,
        comfort,
      });
      state.qIndex += 1;
      goNextQuestion();
    });

    $("#btnBackToCanChange").addEventListener("click", () => {
      setStep("canChange");
    });

    $("#btnSaveDetails").addEventListener("click", () => {
      const details = readDetailsFromForm();
      const errEl = $("#detailsError");
      errEl.classList.add("hidden");
      errEl.textContent = "";

      if (!details) {
        errEl.textContent = t("detailsErrorPrefix") + " " + t("errorInvalidNumber");
        errEl.classList.remove("hidden");
        return;
      }
      if (details.missingTime) {
        errEl.textContent = t("detailsErrorPrefix") + " " + t("errorMissingTimePerStep");
        errEl.classList.remove("hidden");
        return;
      }
      if (details.noSteps) {
        errEl.textContent = t("detailsErrorPrefix") + " " + t("errorNoSteps");
        errEl.classList.remove("hidden");
        return;
      }

      state.collected.push({
        topic: state.anxieties[state.qIndex].text,
        changed: true,
        importance: details.importance,
        urgency: details.urgency,
        steps: details.steps,
      });

      state.qIndex += 1;
      goNextQuestion();
    });

    // Choices (yes/no)
    $("#stepCanChange").addEventListener("click", (e) => {
      const target = e.target;
      if (!target || !(target instanceof HTMLElement)) return;
      if (!target.classList.contains("choice")) return;

      const answer = target.dataset.answer;
      if (answer === "no") {
        showComfortSentence();
        setStep("comfort");
      } else if (answer === "yes") {
        setStep("details");
        refreshActionEncourage();
        clearDetailsForm();
      }
    });

    $("#btnRestart").addEventListener("click", () => {
      clearPersisted();
      state.lang = state.lang || "zh";
      state.anxieties = [];
      state.collected = [];
      state.comfortCount = 0;
      state.ganttSegments = [];
      state.taskIdSeq = 1;
      state.calendarFocusDayMs = null;
      state.qIndex = 0;
      state.flowStep = "canChange";
      showPage("input");
      $("#btnToQuestions").disabled = true;
      $("#anxietyText").value = "";
      setStep("canChange");
      renderAnxietyList();
    });

    $("#btnToCalendar").addEventListener("click", () => {
      ensureGanttData();
      renderCalendarPage();
      showPage("calendar");
    });

    $("#btnBackToResult").addEventListener("click", () => {
      showPage("result");
    });

    $("#btnPrint").addEventListener("click", () => {
      openPdfPreview();
    });

    document.querySelectorAll("[data-close-pdf]").forEach((el) => {
      el.addEventListener("click", () => closePdfPreview());
    });

    const btnSaveLocalSheet = $("#btnSaveLocalSheet");
    if (btnSaveLocalSheet) {
      btnSaveLocalSheet.addEventListener("click", () => {
        flushPersist();
        alert(t("toastSavedLocal"));
      });
    }
    const btnPrintFromPreview = $("#btnPrintFromPreview");
    if (btnPrintFromPreview) {
      btnPrintFromPreview.addEventListener("click", () => {
        fillPrintMountFromLiveCalendar();
        closePdfPreview();
        requestAnimationFrame(() => window.print());
      });
    }

    const ganttHost = $("#ganttHost");
    if (ganttHost) {
      ganttHost.addEventListener("click", (e) => {
        const target = e.target;
        if (!(target instanceof HTMLElement)) return;
        const dayCell = target.closest(".cal-day-cell");
        if (dayCell instanceof HTMLElement && dayCell.dataset.dayMs) {
          const ms = Number(dayCell.dataset.dayMs);
          if (Number.isFinite(ms)) {
            state.calendarFocusDayMs = alignLocalDayStartMs(ms);
            state.calendarView = "day";
            schedulePersist();
            renderCalendarPage();
          }
          return;
        }
        const splitBtn = target.closest(".gantt-bar__split");
        if (splitBtn) {
          e.preventDefault();
          e.stopPropagation();
          const bar = splitBtn.closest(".gantt-bar");
          const id = Number(bar?.getAttribute("data-segment-id"));
          if (Number.isFinite(id)) openSplitModal(id);
          return;
        }
        const allocBtn = target.closest(".gantt-bar__allocate");
        if (allocBtn) {
          e.preventDefault();
          e.stopPropagation();
          const bar = allocBtn.closest(".gantt-bar");
          const id = Number(bar?.getAttribute("data-segment-id"));
          const seg = state.ganttSegments.find((s) => s.id === id);
          if (seg && seg.splitGroupId != null) openAllocateModal(seg.splitGroupId);
          return;
        }
        if (target.closest(".gantt-bar__vdrag")) return;
        if (target.closest(".gantt-task-check")) return;
        const gBar = target.closest(".gantt-bar");
        if (gBar instanceof HTMLElement && gBar.dataset.hasNote === "1") {
          const id = Number(gBar.getAttribute("data-segment-id"));
          const seg = state.ganttSegments.find((s) => s.id === id);
          if (seg && seg.completedNote) openSegmentNoteReadModal(seg);
        }
      });

      ganttHost.addEventListener("change", (e) => {
        const ch = e.target;
        if (!(ch instanceof HTMLInputElement)) return;
        if (!ch.classList.contains("gantt-task-check")) return;
        const id = Number(ch.getAttribute("data-segment-id"));
        const seg = state.ganttSegments.find((s) => s.id === id);
        if (!seg) return;
        if (ch.checked) {
          ch.checked = false;
          openCompletionCelebration(id);
        } else {
          seg.completed = false;
          delete seg.completedNote;
          delete seg.completedAt;
          renderCalendarPage();
          schedulePersist();
        }
      });

      ganttHost.addEventListener("keydown", (e) => {
        if (e.key !== "Enter" && e.key !== " ") return;
        const t = e.target;
        if (!(t instanceof HTMLElement)) return;
        const dayCell = t.closest(".cal-day-cell");
        if (!dayCell || !dayCell.dataset.dayMs) return;
        e.preventDefault();
        const ms = Number(dayCell.dataset.dayMs);
        if (Number.isFinite(ms)) {
          state.calendarFocusDayMs = alignLocalDayStartMs(ms);
          state.calendarView = "day";
          schedulePersist();
          renderCalendarPage();
        }
      });

      ganttHost.addEventListener("pointerdown", onGanttPointerDown);
    }

    const splitModal = $("#ganttSplitModal");
    if (splitModal) {
      splitModal.addEventListener("click", (e) => {
        const tEl = e.target;
        if (!(tEl instanceof HTMLElement)) return;
        if (tEl.closest("[data-close-split]")) closeSplitModal();
        const pick = tEl.closest(".gantt-split-pick");
        if (pick instanceof HTMLElement && pick.dataset.splitUnit) {
          applySplitGranularity(pick.dataset.splitUnit);
        }
      });
    }
    const allocModal = $("#ganttAllocateModal");
    if (allocModal) {
      allocModal.addEventListener("click", (e) => {
        const tEl = e.target;
        if (!(tEl instanceof HTMLElement)) return;
        if (tEl.closest("[data-close-alloc]")) closeAllocateModal();
        if (tEl.id === "btnAllocApply") applyAllocation();
      });
    }
    document.querySelectorAll(".cal-view-tab").forEach((btn) => {
      btn.addEventListener("click", () => {
        if (!(btn instanceof HTMLElement)) return;
        const v = btn.dataset.calView;
        if (v === "week" || v === "month" || v === "year" || v === "day") {
          state.calendarView = v;
          schedulePersist();
          if (pages.calendar.classList.contains("active")) renderCalendarPage();
        }
      });
    });

    const ganttScroll = $("#ganttScroll");
    if (ganttScroll) {
      ganttScroll.addEventListener(
        "wheel",
        (e) => {
          if (!e.ctrlKey) return;
          e.preventDefault();
          const order = ["year", "month", "week", "day"];
          const i = order.indexOf(state.calendarView);
          if (i < 0) return;
          if (e.deltaY < 0) {
            if (i < order.length - 1) state.calendarView = order[i + 1];
          } else if (e.deltaY > 0) {
            if (i > 0) state.calendarView = order[i - 1];
          }
          schedulePersist();
          if (pages.calendar.classList.contains("active")) renderCalendarPage();
        },
        { passive: false },
      );
    }

    const celeInp = $("#celebrateNoteInput");
    const celeSave = $("#btnCelebrateSave");
    if (celeInp instanceof HTMLTextAreaElement && celeSave) {
      celeInp.addEventListener("input", () => {
        celeSave.disabled = celeInp.value.trim().length === 0;
      });
    }
    const btnCelebrateSave = $("#btnCelebrateSave");
    if (btnCelebrateSave) btnCelebrateSave.addEventListener("click", () => confirmCelebrateSave());
    const btnCelebrateSkip = $("#btnCelebrateSkip");
    if (btnCelebrateSkip) btnCelebrateSkip.addEventListener("click", () => confirmCelebrateSkip());

    const noteReadModal = $("#segmentNoteReadModal");
    if (noteReadModal) {
      noteReadModal.addEventListener("click", (e) => {
        const tEl = e.target;
        if (tEl instanceof HTMLElement && tEl.closest("[data-close-note-read]")) {
          closeSegmentNoteReadModal();
        }
      });
    }

    $("#btnAddStepRow").addEventListener("click", () => {
      addStepRow();
    });

    const btnEncRefresh = $("#btnActionEncourageRefresh");
    if (btnEncRefresh) {
      btnEncRefresh.addEventListener("click", () => {
        refreshActionEncourage();
      });
    }

    $("#stepsList").addEventListener("click", (e) => {
      const target = e.target;
      if (!(target instanceof HTMLElement)) return;
      const rm = target.closest(".step-remove");
      if (!rm) return;
      const list = $("#stepsList");
      if (list.children.length <= 1) return;
      const row = rm.closest(".step-row");
      if (row) row.remove();
      updateStepRowNumbers();
    });

    // Gradient 1-5 pickers for importance/urgency/difficulty
    document.querySelectorAll(".scale-picker .scale-option").forEach((btn) => {
      btn.addEventListener("click", () => {
        const picker = btn.closest(".scale-picker");
        if (!picker) return;
        const field = picker.getAttribute("data-field");
        const value = btn.getAttribute("data-value");
        if (!field || !value) return;
        setScaleValue(field, value);
      });
    });
  }

  function addAnxiety(text) {
    // Avoid duplicates by exact match
    const exists = state.anxieties.some((a) => a.text === text);
    if (exists) return;
    state.anxieties.push({ text });
    renderAnxietyList();
    $("#btnToQuestions").disabled = state.anxieties.length === 0;
    schedulePersist();
  }

  function removeAnxietyAt(index) {
    state.anxieties.splice(index, 1);
    // Clear flow if we're currently on questions
    if (pages.questions.classList.contains("active")) {
      state.qIndex = 0;
      state.collected = [];
      setStep("canChange");
      renderQuestionState();
    }
    renderAnxietyList();
    $("#btnToQuestions").disabled = state.anxieties.length === 0;
    schedulePersist();
  }

  function renderAnxietyList() {
    const list = $("#anxietyList");
    list.innerHTML = "";
    if (!state.anxieties.length) {
      const empty = document.createElement("div");
      empty.className = "item";
      empty.innerHTML = `<div class="item-text">
        <div class="item-title">${escapeHtml(t("listEmpty"))}</div>
      </div>`;
      list.appendChild(empty);
      return;
    }

    state.anxieties.forEach((a, idx) => {
      const row = document.createElement("div");
      row.className = "item";
      row.innerHTML = `<div class="item-text">
        <div class="item-title">${escapeHtml(a.text)}</div>
      </div>
      <button class="btn btn-ghost btn-small" type="button" aria-label="Remove item">×</button>`;
      row.querySelector("button").addEventListener("click", () => removeAnxietyAt(idx));
      list.appendChild(row);
    });
  }

  function setupQuestionFlow() {
    if (!state.anxieties.length) {
      alert(t("errorNoTopic"));
      return;
    }
    state.collected = [];
    state.qIndex = 0;
    clearDetailsForm();
    setStep("canChange");
    showPage("questions");
    renderQuestionState();
  }

  function setStep(step) {
    $("#stepCanChange").classList.toggle("hidden", step !== "canChange");
    $("#stepDetails").classList.toggle("hidden", step !== "details");
    $("#stepComfort").classList.toggle("hidden", step !== "comfort");
    $("#detailsError").classList.add("hidden");
    state.flowStep = step;
    schedulePersist();
  }

  function showComfortSentence() {
    const msg = pickPhrase("accept") || t("comfortExplain");
    $("#comfortText").textContent = msg;
    $("#comfortText").setAttribute("aria-live", "polite");
  }

  function refreshActionEncourage() {
    const el = $("#actionEncourageText");
    const prev = (el && el.textContent) || "";
    const pack = window.APP_PHRASES;
    const L = phrasePackLang();
    const arr = pack?.action?.[L] || pack?.action?.zh;
    let next = pickPhrase("action") || t("actionEncourageTitle");
    if (arr && arr.length > 1 && prev) {
      let guard = 0;
      while (guard++ < 12 && next === prev) next = pickPhrase("action") || t("actionEncourageTitle");
    }
    el.textContent = next;
    el.setAttribute("aria-live", "polite");
  }

  function renderQuestionState() {
    const total = state.anxieties.length || 1;
    const idx = state.qIndex + 1;
    $("#qIndexLabel").textContent = `${idx} / ${total}`;

    const pct = Math.max(0, Math.min(100, (idx / total) * 100));
    $("#qProgressFill").style.width = `${pct}%`;

    const topic = state.anxieties[state.qIndex]?.text || "";
    $("#topicText").textContent = topic;
  }

  function goNextQuestion() {
    if (state.qIndex >= state.anxieties.length) {
      mergeNewSegmentsFromCollected();
      renderResults();
      showPage("result");
      return;
    }
    clearDetailsForm();
    renderQuestionState();
    setStep("canChange");
  }

  function setScaleValue(field, value) {
    const hiddenInput = $(`#${field}`);
    if (!hiddenInput) return;
    hiddenInput.value = String(value);

    const picker = document.querySelector(`.scale-picker[data-field='${field}']`);
    if (!picker) return;
    picker.querySelectorAll(".scale-option").forEach((option) => {
      option.classList.toggle("active", option.getAttribute("data-value") === String(value));
    });
  }

  function fillUnitSelect(selectEl) {
    if (!selectEl) return;
    const prev = selectEl.value || "minute";
    const pairs = [
      ["minute", "unitMinute"],
      ["hour", "unitHour"],
      ["week", "unitWeek"],
      ["month", "unitMonth"],
    ];
    selectEl.innerHTML = "";
    pairs.forEach(([val, key]) => {
      const op = document.createElement("option");
      op.value = val;
      op.textContent = t(key);
      selectEl.appendChild(op);
    });
    selectEl.value = pairs.some(([v]) => v === prev) ? prev : "minute";
  }

  function refreshAllStepRowI18n() {
    document.querySelectorAll("#stepsList .step-unit").forEach((sel) => fillUnitSelect(sel));
    document.querySelectorAll("#stepsList .step-name").forEach((input) => {
      if (input instanceof HTMLInputElement) input.placeholder = t("stepNamePlaceholder");
    });
    document.querySelectorAll("#stepsList .step-amount").forEach((input) => {
      if (input instanceof HTMLInputElement) input.placeholder = t("phTimeAmount");
    });
    document.querySelectorAll("#stepsList .step-difficulty").forEach((sel) => {
      const first = sel.querySelector("option[value='']");
      if (first) first.textContent = t("phDifficultySelect");
    });
    document.querySelectorAll("#stepsList .step-remove").forEach((btn) => {
      if (btn instanceof HTMLButtonElement) btn.setAttribute("title", t("removeStep"));
    });
    updateStepRowNumbers();
  }

  function updateStepRowNumbers() {
    const rows = document.querySelectorAll("#stepsList .step-row");
    rows.forEach((row, idx) => {
      const lab = row.querySelector(".step-row-label");
      if (lab) lab.textContent = tf("stepRowLabel", { n: idx + 1 });
      const rm = row.querySelector(".step-remove");
      if (rm instanceof HTMLButtonElement) rm.disabled = rows.length <= 1;
    });
  }

  function addStepRow() {
    const wrap = $("#stepsList");
    const row = document.createElement("div");
    row.className = "step-row";
    row.innerHTML = `
      <div class="step-row-head">
        <span class="step-row-label"></span>
        <button type="button" class="btn btn-ghost btn-small step-remove">×</button>
      </div>
      <input type="text" class="input step-name" maxlength="120" />
      <div class="step-row-time-diff">
        <input type="number" class="input step-amount" min="1" step="1" />
        <select class="input step-unit time-unit-select"></select>
        <select class="input step-difficulty">
          <option value="">${escapeHtml(t("phDifficultySelect"))}</option>
          <option value="1">1</option>
          <option value="2">2</option>
          <option value="3">3</option>
          <option value="4">4</option>
          <option value="5">5</option>
        </select>
      </div>
    `;
    const u = row.querySelector(".step-unit");
    fillUnitSelect(u);
    const rm = row.querySelector(".step-remove");
    if (rm) rm.setAttribute("title", t("removeStep"));
    wrap.appendChild(row);
    const nameInput = row.querySelector(".step-name");
    const amtInput = row.querySelector(".step-amount");
    if (nameInput instanceof HTMLInputElement) nameInput.placeholder = t("stepNamePlaceholder");
    if (amtInput instanceof HTMLInputElement) amtInput.placeholder = t("phTimeAmount");
    updateStepRowNumbers();
  }

  function clearDetailsForm() {
    ["importance", "urgency"].forEach((field) => {
      const hiddenInput = $(`#${field}`);
      if (hiddenInput) hiddenInput.value = "";
      const picker = document.querySelector(`.scale-picker[data-field='${field}']`);
      if (picker) {
        picker.querySelectorAll(".scale-option").forEach((option) => option.classList.remove("active"));
      }
    });
    const list = $("#stepsList");
    list.innerHTML = "";
    addStepRow();
  }

  function readDetailsFromForm() {
    const importance = toInt($("#importance").value);
    const urgency = toInt($("#urgency").value);

    if (importance == null || urgency == null) return null;
    const validRange = (v) => v >= 1 && v <= 5;
    if (!validRange(importance) || !validRange(urgency)) return null;

    const unitToMinutes = {
      minute: 1,
      hour: 60,
      week: 7 * 24 * 60,
      month: 30 * 24 * 60,
    };

    const rows = document.querySelectorAll("#stepsList .step-row");
    if (!rows.length) return { noSteps: true };

    const steps = [];
    for (const row of rows) {
      const nameEl = row.querySelector(".step-name");
      const amtEl = row.querySelector(".step-amount");
      const unitEl = row.querySelector(".step-unit");
      const diffEl = row.querySelector(".step-difficulty");
      const name = nameEl instanceof HTMLInputElement ? nameEl.value.trim() : "";
      const timeAmount = toInt(amtEl instanceof HTMLInputElement ? amtEl.value : "");
      const timeUnit = unitEl instanceof HTMLSelectElement ? unitEl.value.trim() : "";
      const difficulty = toInt(diffEl instanceof HTMLSelectElement ? diffEl.value : "");

      if (!name) return null;
      const missingTime =
        timeAmount == null ||
        timeAmount < 1 ||
        !["minute", "hour", "week", "month"].includes(timeUnit);
      if (missingTime) return { missingTime: true };
      if (difficulty == null || !validRange(difficulty)) return null;

      steps.push({
        name,
        timeAmount,
        timeUnit,
        timePerStepMinutes: timeAmount * unitToMinutes[timeUnit],
        difficulty,
      });
    }

    if (!steps.length) return { noSteps: true };

    return {
      importance,
      urgency,
      steps,
    };
  }

  function toInt(v) {
    if (v === undefined || v === null) return null;
    const s = String(v).trim();
    if (!s) return null;
    const n = Number(s);
    if (!Number.isFinite(n)) return null;
    return Math.trunc(n);
  }

  function escapeHtml(str) {
    return String(str).replace(/[&<>"']/g, (m) => {
      const map = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;" };
      return map[m] || m;
    });
  }

  function formatDuration(minutes) {
    if (minutes < 60) {
      return state.lang === "zh"
        ? `${minutes} 分钟`
        : state.lang === "fr"
          ? `${minutes} min`
          : `${minutes} min`;
    }
    const hours = Math.floor(minutes / 60);
    const remainMin = minutes % 60;
    if (hours < 24 * 7) {
      if (remainMin === 0) {
        return state.lang === "zh"
          ? `${hours} 小时`
          : state.lang === "fr"
            ? `${hours} h`
            : `${hours} h`;
      }
      return state.lang === "zh"
        ? `${hours} 小时 ${remainMin} 分钟`
        : state.lang === "fr"
          ? `${hours} h ${remainMin} min`
          : `${hours} h ${remainMin} min`;
    }
    const days = Math.floor(minutes / (24 * 60));
    return state.lang === "zh"
      ? `${days} 天`
      : state.lang === "fr"
        ? `${days} jours`
        : `${days} days`;
  }

  function formatInputTime(amount, unit) {
    const map = {
      minute: t("unitMinute"),
      hour: t("unitHour"),
      week: t("unitWeek"),
      month: t("unitMonth"),
    };
    return `${amount} ${map[unit] || unit}`;
  }

  /** 清单与甘特中只展示步骤名 + 时长，不附带焦虑主题与困难度 */
  function formatResultStepTitle(step) {
    const timePart = formatInputTime(step.timeAmount, step.timeUnit);
    if (state.lang === "zh") return `${step.name}（${timePart}）`;
    if (state.lang === "fr") return `${step.name} — ${timePart}`;
    return `${step.name} — ${timePart}`;
  }

  function collectedHasOnlyAccept() {
    return (
      state.collected.length > 0 &&
      state.collected.every((c) => !c.changed)
    );
  }

  function renderResults() {
    const result = $("#resultTasks");
    result.innerHTML = "";

    const tasks = buildTasksFromCollected();
    if (!tasks.length) {
      const empty = document.createElement("div");
      empty.className = "task";
      const msg = collectedHasOnlyAccept()
        ? t("resultEmptyOnlyAccept")
        : t("resultNoTasksYet");
      empty.innerHTML = `<div class="task-title">${escapeHtml(msg)}</div>`;
      result.appendChild(empty);
      return;
    }

    const ordered = alternateSimpleHard(tasks);
    // Keep an editable calendar source once tasks are generated.
    state.lastOrderedTasks = ordered.map((task) => ({ ...task }));

    let elapsedMinutes = 0;
    ordered.forEach((task) => {
      const slotStart = elapsedMinutes;
      const slotEnd = elapsedMinutes + task.timePerStepMinutes;
      const card = document.createElement("div");
      card.className = "task";
      card.innerHTML = `
        <div class="task-title">${escapeHtml(task.title)}</div>
        <div class="task-meta">
          <span class="pill">${t("metaUrgency")}: ${task.urgency}/5</span>
          <span class="pill">${t("metaImportance")}: ${task.importance}/5</span>
          <span class="pill">${t("metaTimeNorm")}: ${escapeHtml(formatDuration(task.timePerStepMinutes))}</span>
          <span class="pill">${t("metaSteps")}: ${task.stepIndex}/${task.stepsCount}</span>
          <span class="pill">${t("metaPlan")}: ${escapeHtml(formatDuration(slotStart))} – ${escapeHtml(formatDuration(slotEnd))}</span>
        </div>
      `;
      result.appendChild(card);
      elapsedMinutes = slotEnd;
    });
  }

  function snapMinutes(m) {
    const s = GANTT_SNAP_MINUTES;
    return Math.max(0, Math.round(m / s) * s);
  }

  function intervalsOverlap(a, b) {
    const a0 = a.startMinute;
    const a1 = a0 + a.durationMinutes;
    const b0 = b.startMinute;
    const b1 = b0 + b.durationMinutes;
    return a0 < b1 && b0 < a1;
  }

  function resolveAllGanttOverlaps() {
    let guard = 0;
    while (guard++ < 120) {
      let bump = null;
      outer: for (const a of state.ganttSegments) {
        for (const b of state.ganttSegments) {
          if (a.id === b.id) continue;
          if (a.rowIndex !== b.rowIndex) continue;
          if (!intervalsOverlap(a, b)) continue;
          bump = a.startMinute >= b.startMinute ? a : b;
          break outer;
        }
      }
      if (!bump) break;
      bump.rowIndex = Math.max(0, ...state.ganttSegments.map((x) => x.rowIndex)) + 1;
    }
  }

  /** 多轨道并行：在最早可开始的轨道上排程；「不能改变」的条目不进入甘特 */
  function buildGanttFromCollected() {
    const tasks = [];
    for (const e of state.collected) {
      if (!e.changed || !e.steps || !e.steps.length) continue;
      const stepTasks = e.steps.map((s) => ({
        title: s.name,
        durationMinutes: s.timePerStepMinutes,
        urgency: e.urgency,
        importance: e.importance,
        difficulty: s.difficulty,
        isHard: s.difficulty >= 4,
      }));
      alternateSimpleHard(stepTasks).forEach((st) => tasks.push(st));
    }

    const nLanes = Math.min(12, Math.max(3, Math.ceil(tasks.length / 3) || 3));
    const laneEnds = Array.from({ length: nLanes }, () => 0);
    let rr = 0;
    const segments = [];

    for (const st of tasks) {
      const minS = Math.min(...laneEnds);
      const pool = laneEnds.map((end, i) => i).filter((i) => laneEnds[i] === minS);
      const bestI = pool[rr % pool.length];
      rr++;
      const start = laneEnds[bestI];
      const end = start + st.durationMinutes;
      laneEnds[bestI] = end;
      segments.push({
        id: state.taskIdSeq++,
        title: st.title,
        durationMinutes: st.durationMinutes,
        startMinute: start,
        rowIndex: bestI,
        completed: false,
      });
    }
    return segments;
  }

  function mergeNewSegmentsFromCollected() {
    const incoming = buildGanttFromCollected();
    if (!incoming.length) return;
    if (!state.ganttSegments.length) {
      state.ganttSegments = incoming;
      return;
    }
    const maxEnd = Math.max(
      ...state.ganttSegments.map((s) => s.startMinute + s.durationMinutes),
    );
    const baseRow = Math.max(...state.ganttSegments.map((s) => s.rowIndex)) + 1;
    incoming.forEach((s, i) => {
      s.startMinute += maxEnd;
      s.rowIndex = baseRow + i;
    });
    state.ganttSegments.push(...incoming);
    resolveAllGanttOverlaps();
  }

  function ensureGanttData() {
    if (!state.ganttSegments.length && buildTasksFromCollected().length) {
      state.ganttSegments = buildGanttFromCollected();
    }
  }

  function renderAcceptRemembrance() {
    const wrap = $("#acceptRemembrance");
    if (!wrap) return;
    const accepts = state.collected.filter((c) => !c.changed);
    if (!accepts.length) {
      wrap.hidden = true;
      wrap.innerHTML = "";
      return;
    }
    wrap.hidden = false;
    wrap.setAttribute("aria-label", t("acceptRemembranceTitle"));
    wrap.innerHTML = `
      <h3 class="accept-remembrance__title">${escapeHtml(t("acceptRemembranceTitle"))}</h3>
      <p class="accept-remembrance__lead">${escapeHtml(t("acceptRemembranceLead"))}</p>
      ${accepts
        .map(
          (a) => `
        <div class="accept-remembrance__item">
          <div class="accept-remembrance__topic">${escapeHtml(a.topic)}</div>
          ${
            a.comfort
              ? `<div class="accept-remembrance__comfort">${escapeHtml(a.comfort)}</div>`
              : ""
          }
          <div class="accept-remembrance__benefit">${escapeHtml(t("benefitAllThingsGood"))}</div>
        </div>`,
        )
        .join("")}`;
  }

  function getPlanAnchorMs() {
    const t = new Date();
    t.setDate(t.getDate() + 1);
    t.setHours(0, 0, 0, 0);
    return t.getTime();
  }

  function alignLocalDayStartMs(ms) {
    const d = new Date(ms);
    d.setHours(0, 0, 0, 0);
    return d.getTime();
  }

  function formatSelfNoteDate(iso) {
    if (!iso) return "";
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return String(iso);
    const loc =
      state.lang === "zh" || state.lang === "zh-tw"
        ? "zh-CN"
        : state.lang === "ja"
          ? "ja-JP"
          : state.lang === "fr"
            ? "fr-FR"
            : "en-US";
    try {
      return d.toLocaleDateString(loc, { year: "numeric", month: "long", day: "numeric" });
    } catch (_) {
      return d.toLocaleDateString();
    }
  }

  function segmentEndMin(s) {
    return s.startMinute + s.durationMinutes;
  }

  function segmentRangeMs(s) {
    const a = getPlanAnchorMs();
    return {
      start: a + s.startMinute * 60000,
      end: a + s.startMinute * 60000 + s.durationMinutes * 60000,
    };
  }

  function mondayOfWeekStartMs(d) {
    const x = new Date(d);
    x.setHours(0, 0, 0, 0);
    const day = (x.getDay() + 6) % 7;
    x.setDate(x.getDate() - day);
    return x.getTime();
  }

  function splitChunkMinutes(unit) {
    const DAY = GANTT_CAL_MINUTES_PER_DAY;
    switch (unit) {
      case "hour":
        return 60;
      case "day":
        return DAY;
      case "week":
        return 7 * DAY;
      case "month":
        return 30 * DAY;
      case "year":
        return 365 * DAY;
      default:
        return 60;
    }
  }

  function getSplitOptions(durMin) {
    if (durMin <= 60) return [];
    const DAY = GANTT_CAL_MINUTES_PER_DAY;
    const WEEK = 7 * DAY;
    const MONTH = 30 * DAY;
    const YEAR = 365 * DAY;
    const opts = [];
    if (durMin > 60) opts.push({ value: "hour", key: "splitByHour" });
    if (durMin > DAY) opts.push({ value: "day", key: "splitByDay" });
    if (durMin > WEEK) opts.push({ value: "week", key: "splitByWeek" });
    if (durMin > MONTH) opts.push({ value: "month", key: "splitByMonth" });
    if (durMin >= 2 * YEAR) opts.push({ value: "year", key: "splitByYear" });
    return opts;
  }

  function showDashRight(seg) {
    if (seg.splitGroupId == null) return false;
    const g = state.ganttSegments.filter((s) => s.splitGroupId === seg.splitGroupId);
    const last = g.reduce((a, b) => (segmentEndMin(a) >= segmentEndMin(b) ? a : b));
    return last.id !== seg.id;
  }

  function isFirstInSplitGroup(seg) {
    if (seg.splitGroupId == null) return false;
    const g = state.ganttSegments.filter((s) => s.splitGroupId === seg.splitGroupId);
    const first = g.reduce((a, b) =>
      a.startMinute < b.startMinute || (a.startMinute === b.startMinute && a.id < b.id) ? a : b,
    );
    return first.id === seg.id;
  }

  function openSplitModal(segId) {
    const seg = state.ganttSegments.find((s) => s.id === segId);
    if (!seg) return;
    const opts = getSplitOptions(seg.durationMinutes);
    ganttSplitTargetId = segId;
    const modal = $("#ganttSplitModal");
    const title = $("#ganttSplitTitle");
    const hint = $("#ganttSplitHint");
    const box = $("#ganttSplitOptions");
    if (!modal || !box || !title || !hint) return;
    title.textContent = t("splitModalTitle");
    hint.textContent = t("splitModalHint");
    if (!opts.length) {
      box.innerHTML = `<p class="muted">${escapeHtml(t("splitNoOptions"))}</p>`;
    } else {
      box.innerHTML = opts
        .map(
          (o) =>
            `<button type="button" class="btn btn-secondary gantt-split-pick" data-split-unit="${o.value}" style="margin:4px 8px 4px 0">${escapeHtml(t(o.key))}</button>`,
        )
        .join("");
    }
    modal.classList.remove("hidden");
  }

  function closeSplitModal() {
    ganttSplitTargetId = null;
    const modal = $("#ganttSplitModal");
    if (modal) modal.classList.add("hidden");
  }

  function applySplitGranularity(unit) {
    const id = ganttSplitTargetId;
    if (id == null) return;
    const idx = state.ganttSegments.findIndex((s) => s.id === id);
    if (idx < 0) return;
    const seg = state.ganttSegments[idx];
    const chunk = splitChunkMinutes(unit);
    const dur = seg.durationMinutes;
    const n = Math.ceil(dur / chunk);
    if (n <= 1) {
      closeSplitModal();
      return;
    }
    const groupId = state.taskIdSeq++;
    const rowIndex = seg.rowIndex;
    const title = seg.title;
    let t0 = seg.startMinute;
    let rem = dur;
    const newSegs = [];
    for (let i = 0; i < n; i++) {
      const d = Math.min(chunk, rem);
      newSegs.push({
        id: state.taskIdSeq++,
        title,
        durationMinutes: d,
        startMinute: t0,
        rowIndex,
        completed: false,
        splitGroupId: groupId,
      });
      t0 += d;
      rem -= d;
    }
    state.ganttSegments.splice(idx, 1, ...newSegs);
    closeSplitModal();
    resolveAllGanttOverlaps();
    renderCalendarPage();
    schedulePersist();
  }

  function refreshAllocateModalI18n() {
    const title = $("#ganttAllocateTitle");
    const hint = $("#ganttAllocateHint");
    const hw = $("#ganttAllocHourWord");
    const applyB = $("#btnAllocApply");
    const cancelB = $("#btnAllocCancel");
    const splitCancel = $("#btnSplitCancel");
    if (title) title.textContent = t("allocateModalTitle");
    if (hint) hint.textContent = t("allocateModalHint");
    if (hw) hw.textContent = t("allocateHourLabel");
    if (applyB) applyB.textContent = t("allocateApply");
    if (cancelB) cancelB.textContent = t("allocateCancel");
    if (splitCancel) splitCancel.textContent = t("splitCancel");
    const sel = $("#ganttAllocPer");
    if (sel instanceof HTMLSelectElement) {
      const prev = sel.value;
      const opts = [
        ["day", t("allocatePerDay")],
        ["week", t("allocatePerWeek")],
        ["month", t("allocatePerMonth")],
        ["year", t("allocatePerYear")],
      ];
      sel.innerHTML = opts
        .map(([val, lab]) => `<option value="${val}">${escapeHtml(lab)}</option>`)
        .join("");
      sel.value = opts.some(([v]) => v === prev) ? prev : "day";
    }
  }

  function openAllocateModal(groupId) {
    ganttAllocateGroupId = groupId;
    refreshAllocateModalI18n();
    const modal = $("#ganttAllocateModal");
    if (modal) modal.classList.remove("hidden");
  }

  function closeAllocateModal() {
    ganttAllocateGroupId = null;
    const m = $("#ganttAllocateModal");
    if (m) m.classList.add("hidden");
  }

  function advancePeriodMs(ms, per) {
    const x = new Date(ms);
    if (per === "day") x.setDate(x.getDate() + 1);
    else if (per === "week") x.setDate(x.getDate() + 7);
    else if (per === "month") x.setMonth(x.getMonth() + 1);
    else if (per === "year") x.setFullYear(x.getFullYear() + 1);
    return x.getTime();
  }

  function minutesFromAnchor(ms) {
    return Math.round((ms - getPlanAnchorMs()) / 60000);
  }

  function applyAllocation() {
    const gid = ganttAllocateGroupId;
    if (gid == null) return;
    const group = state.ganttSegments
      .filter((s) => s.splitGroupId === gid)
      .sort((a, b) => a.startMinute - b.startMinute);
    if (!group.length) {
      closeAllocateModal();
      return;
    }
    const amtEl = $("#ganttAllocAmount");
    const perEl = $("#ganttAllocPer");
    const hours = amtEl instanceof HTMLInputElement ? Number(amtEl.value) : 1;
    const per = perEl instanceof HTMLSelectElement ? perEl.value : "day";
    if (!Number.isFinite(hours) || hours <= 0) return;
    const workPerPeriodMin = Math.round(hours * 60);
    let totalWork = group.reduce((a, s) => a + s.durationMinutes, 0);
    let cursor = getPlanAnchorMs() + group[0].startMinute * 60000;
    const placements = [];
    while (totalWork > 0) {
      const use = Math.min(workPerPeriodMin, totalWork);
      placements.push({ startMs: cursor, dur: use });
      totalWork -= use;
      cursor = advancePeriodMs(cursor, per);
    }
    const firstTitle = group[0].title;
    const rowIndex = group[0].rowIndex;
    const idsToRemove = new Set(group.map((s) => s.id));
    state.ganttSegments = state.ganttSegments.filter((s) => !idsToRemove.has(s.id));
    const newGroup = state.taskIdSeq++;
    for (const p of placements) {
      state.ganttSegments.push({
        id: state.taskIdSeq++,
        title: firstTitle,
        durationMinutes: p.dur,
        startMinute: minutesFromAnchor(p.startMs),
        rowIndex,
        completed: false,
        splitGroupId: newGroup,
      });
    }
    closeAllocateModal();
    resolveAllGanttOverlaps();
    renderCalendarPage();
    schedulePersist();
  }

  function clearSegmentTransforms(segId) {
    document.querySelectorAll(`[data-segment-id="${segId}"]`).forEach((el) => {
      if (el instanceof HTMLElement) el.style.transform = "";
    });
  }

  function setSegmentTransforms(segId, dxPx) {
    document.querySelectorAll(`[data-segment-id="${segId}"]`).forEach((el) => {
      if (el instanceof HTMLElement) el.style.transform = `translateX(${dxPx}px)`;
    });
  }

  function barExtrasHtml(s) {
    const splitOpts = getSplitOptions(s.durationMinutes);
    const splitBtn =
      splitOpts.length > 0
        ? `<button type="button" class="gantt-bar__split">${escapeHtml(t("ganttSplit"))}</button>`
        : "";
    const allocBtn =
      s.splitGroupId != null && isFirstInSplitGroup(s)
        ? `<button type="button" class="gantt-bar__allocate btn btn-ghost btn-small">${escapeHtml(t("ganttAllocate"))}</button>`
        : "";
    const dash = showDashRight(s) ? " gantt-bar--dash-right" : "";
    return { splitBtn, allocBtn, dash };
  }

  function renderBarAt(s, leftPx, widthPx, topPx) {
    const { splitBtn, allocBtn, dash } = barExtrasHtml(s);
    const doneCls = s.completed ? " done" : "";
    const notedCls = s.completed && s.completedNote ? " gantt-bar--noted" : "";
    const hasNote = s.completedNote ? "1" : "";
    const vdragLab = escapeHtml(t("ganttRowDragLabel"));
    const w = Math.max(widthPx, 12);
    return `
        <div class="gantt-bar${doneCls}${notedCls}${dash}" data-segment-id="${s.id}" data-has-note="${hasNote}" style="position:absolute;left:${leftPx}px;width:${w}px;top:${topPx}px" role="group" aria-label="${escapeHtml(s.title)}">
          <div class="gantt-bar-resize gantt-bar-resize--l" aria-hidden="true"></div>
          <div class="gantt-bar__main">
            <button type="button" class="gantt-bar__vdrag" aria-label="${vdragLab}" title="${vdragLab}">⋮⋮</button>
            <input type="checkbox" class="task-check gantt-task-check" data-segment-id="${s.id}" ${s.completed ? "checked" : ""} aria-label="${escapeHtml(t("statusDone"))}" />
            <span class="gantt-bar__title">${escapeHtml(s.title)}</span>
            <span class="gantt-bar__dur">${escapeHtml(formatDuration(s.durationMinutes))}</span>
            ${splitBtn}${allocBtn}
          </div>
          <div class="gantt-bar-resize gantt-bar-resize--r" aria-hidden="true"></div>
        </div>`;
  }

  function dayOverlapFrag(s, dayStartMs, pxPerHour) {
    const dayEnd = dayStartMs + MS_PER_DAY;
    const { start: s0, end: s1 } = segmentRangeMs(s);
    const a = Math.max(s0, dayStartMs);
    const b = Math.min(s1, dayEnd);
    if (a >= b) return null;
    const leftPx = ((a - dayStartMs) / 3600000) * pxPerHour;
    const widthPx = ((b - a) / 3600000) * pxPerHour;
    return { leftPx, widthPx: Math.max(widthPx, 8) };
  }

  function renderCalendarDayView(host, segs) {
    const base =
      state.calendarFocusDayMs != null ? state.calendarFocusDayMs : getPlanAnchorMs();
    const dayMs = alignLocalDayStartMs(base);
    const pxPerHour = 52;
    const hours = 24;
    const dayW = hours * pxPerHour;
    const rowH = GANTT_ROW_H;
    const maxLane = Math.max(0, ...segs.map((s) => s.rowIndex));
    const laneH = maxLane + 1;
    host.dataset.pxPerDay = String(pxPerHour / 24);
    const dLabel = new Date(dayMs);
    const head =
      state.lang === "zh" || state.lang === "zh-tw"
        ? `${dLabel.getFullYear()}年${dLabel.getMonth() + 1}月${dLabel.getDate()}日`
        : dLabel.toLocaleDateString(undefined, {
            year: "numeric",
            month: "long",
            day: "numeric",
          });
    const hourCells = [];
    for (let h = 0; h < 24; h++) {
      hourCells.push(`<div class="cal-hour-cell"><span class="cal-hour-num">${h}</span></div>`);
    }
    const frags = [];
    for (const s of segs) {
      const o = dayOverlapFrag(s, dayMs, pxPerHour);
      if (!o) continue;
      const topPx = s.rowIndex * rowH + 6;
      frags.push(renderBarAt(s, o.leftPx, o.widthPx, topPx));
    }
    host.style.width = "100%";
    host.innerHTML = `
      <div class="cal-view cal-view--day">
        <div class="cal-day-block">
          <div class="cal-day-ym">${escapeHtml(head)}</div>
          <div class="cal-day-head">${hourCells.join("")}</div>
          <div class="cal-day-lane" style="position:relative;width:${dayW}px;min-height:${laneH * rowH}px" data-px-per-day="${pxPerHour / 24}">
            ${frags.join("")}
          </div>
        </div>
      </div>`;
  }

  function weekOverlapFrag(s, weekStartMs, pxPerDay) {
    const ws = weekStartMs;
    const we = weekStartMs + 7 * MS_PER_DAY;
    const { start: s0, end: s1 } = segmentRangeMs(s);
    const a = Math.max(s0, ws);
    const b = Math.min(s1, we);
    if (a >= b) return null;
    const widthPx = ((b - a) / MS_PER_DAY) * pxPerDay;
    const leftPx = ((a - ws) / MS_PER_DAY) * pxPerDay;
    return { leftPx, widthPx };
  }

  function renderCalendarWeekView(host, segs) {
    const anchorMs = getPlanAnchorMs();
    const maxEnd = Math.max(anchorMs, ...segs.map((s) => segmentRangeMs(s).end));
    let w0 = mondayOfWeekStartMs(anchorMs);
    const weeks = [];
    while (w0 <= maxEnd) {
      weeks.push(w0);
      w0 += 7 * MS_PER_DAY;
    }
    if (!weeks.length) weeks.push(mondayOfWeekStartMs(anchorMs));

    const maxLane = Math.max(0, ...segs.map((s) => s.rowIndex));
    const rowH = GANTT_ROW_H;
    const laneH = maxLane + 1;
    const cellW = GANTT_DAY_WIDTH_PX;
    host.dataset.pxPerDay = String(cellW);

    const parts = [];
    for (const wk of weeks) {
      const d0 = new Date(wk);
      const y = d0.getFullYear();
      const m = d0.getMonth() + 1;
      const ym =
        state.lang === "zh"
          ? `${y}年${m}月`
          : tf("weekLabelYM", { y, m });
      const dayCells = [];
      for (let i = 0; i < 7; i++) {
        const dd = new Date(wk + i * MS_PER_DAY);
        const dim = dd.getTime() < anchorMs ? " cal-day--before-plan" : "";
        dayCells.push(
          `<div class="cal-day-cell${dim}" data-day-ms="${dd.getTime()}" role="button" tabindex="0"><span class="cal-day-num">${dd.getDate()}</span></div>`,
        );
      }
      const frags = [];
      for (const s of segs) {
        const o = weekOverlapFrag(s, wk, cellW);
        if (!o || o.widthPx < 2) continue;
        const topPx = s.rowIndex * rowH + 6;
        frags.push(renderBarAt(s, o.leftPx, o.widthPx, topPx));
      }
      parts.push(`
        <div class="cal-week-block">
          <div class="cal-week-ym">${escapeHtml(ym)}</div>
          <div class="cal-week-head">${dayCells.join("")}</div>
          <div class="cal-week-lane" style="position:relative;width:${7 * cellW}px;min-height:${laneH * rowH}px" data-px-per-day="${cellW}">
            ${frags.join("")}
          </div>
        </div>`);
    }
    host.style.width = "100%";
    host.style.minHeight = "auto";
    host.style.setProperty("--day-w", `${cellW}px`);
    host.innerHTML = `<div class="cal-view cal-view--week">${parts.join("")}</div>`;
  }

  function monthOverlapFrag(s, monthStartMs, pxPerDay) {
    const startD = new Date(monthStartMs);
    const nextM = new Date(startD);
    nextM.setMonth(nextM.getMonth() + 1);
    const me = nextM.getTime();
    const { start: s0, end: s1 } = segmentRangeMs(s);
    const a = Math.max(s0, monthStartMs);
    const b = Math.min(s1, me);
    if (a >= b) return null;
    const dayMs = MS_PER_DAY;
    const leftPx = ((a - monthStartMs) / dayMs) * pxPerDay;
    const widthPx = ((b - a) / dayMs) * pxPerDay;
    return { leftPx, widthPx };
  }

  function renderCalendarMonthView(host, segs) {
    const anchorMs = getPlanAnchorMs();
    const maxEnd = Math.max(anchorMs, ...segs.map((s) => segmentRangeMs(s).end));
    let cur = new Date(anchorMs);
    cur.setDate(1);
    cur.setHours(0, 0, 0, 0);
    const blocks = [];
    const cellW = GANTT_DAY_WIDTH_PX;
    host.dataset.pxPerDay = String(cellW);
    const rowH = GANTT_ROW_H;
    const maxLane = Math.max(0, ...segs.map((s) => s.rowIndex));
    const laneH = maxLane + 1;

    while (cur.getTime() <= maxEnd) {
      const ms = cur.getTime();
      const next = new Date(cur);
      next.setMonth(next.getMonth() + 1);
      const daysInMonth = Math.round((next.getTime() - ms) / MS_PER_DAY);
      const yearLabel = String(cur.getFullYear());
      const frags = [];
      for (const s of segs) {
        const o = monthOverlapFrag(s, ms, cellW);
        if (!o || o.widthPx < 2) continue;
        const topPx = s.rowIndex * rowH + 6;
        frags.push(renderBarAt(s, o.leftPx, o.widthPx, topPx));
      }
      blocks.push(`
        <div class="cal-month-block">
          <div class="cal-month-year">${escapeHtml(yearLabel)}</div>
          <div class="cal-month-head muted" style="font-size:0.8rem;margin-bottom:6px">${cur.getMonth() + 1}</div>
          <div class="cal-month-lane" style="position:relative;width:${daysInMonth * cellW}px;min-height:${laneH * rowH}px" data-px-per-day="${cellW}">
            ${frags.join("")}
          </div>
        </div>`);
      cur = next;
    }
    host.style.width = "100%";
    host.innerHTML = `<div class="cal-view cal-view--month">${blocks.join("")}</div>`;
  }

  function yearOverlapFrag(s, yearStartMs) {
    const ys = yearStartMs;
    const ye = new Date(yearStartMs);
    ye.setFullYear(ye.getFullYear() + 1);
    const yeMs = ye.getTime();
    const { start: s0, end: s1 } = segmentRangeMs(s);
    const a = Math.max(s0, ys);
    const b = Math.min(s1, yeMs);
    if (a >= b) return null;
    const span = yeMs - ys;
    const leftFrac = (a - ys) / span;
    const widthFrac = (b - a) / span;
    return { leftFrac, widthFrac };
  }

  function renderCalendarYearView(host, segs) {
    const anchorMs = getPlanAnchorMs();
    const maxEnd = Math.max(anchorMs, ...segs.map((s) => segmentRangeMs(s).end));
    let y = new Date(anchorMs).getFullYear();
    const endY = new Date(maxEnd).getFullYear();
    const monthColW = 56;
    const rowW = 12 * monthColW;
    const rowH = GANTT_ROW_H;
    const maxLane = Math.max(0, ...segs.map((s) => s.rowIndex));
    const laneH = maxLane + 1;
    host.dataset.pxPerDay = String(monthColW / 30.4);
    const blurb = t("yearViewBlurb");
    const blocks = [];
    for (; y <= endY; y++) {
      const ys = new Date(y, 0, 1).getTime();
      const frags = [];
      for (const s of segs) {
        const o = yearOverlapFrag(s, ys);
        if (!o || o.widthFrac <= 0) continue;
        const leftPx = o.leftFrac * rowW;
        const widthPx = Math.max(o.widthFrac * rowW, 8);
        const topPx = s.rowIndex * rowH + 6;
        frags.push(renderBarAt(s, leftPx, widthPx, topPx));
      }
      blocks.push(`
        <div class="cal-year-block">
          <div class="cal-year-blurb">${escapeHtml(blurb)}</div>
          <div class="cal-year-lane" style="position:relative;width:${rowW}px;min-height:${laneH * rowH}px" data-px-per-day="${monthColW / 30.4}">
            ${frags.join("")}
          </div>
        </div>`);
    }
    host.style.width = "100%";
    host.innerHTML = `<div class="cal-view cal-view--year">${blocks.join("")}</div>`;
  }

  function onGanttRowMoveDoc() {
    /* reserved for future drag preview */
  }

  function onGanttRowUpDoc(e) {
    document.removeEventListener("pointermove", onGanttRowMoveDoc, true);
    document.removeEventListener("pointerup", onGanttRowUpDoc, true);
    document.removeEventListener("pointercancel", onGanttRowUpDoc, true);
    if (!ganttRowDrag) return;
    const { id, lane } = ganttRowDrag;
    ganttRowDrag = null;
    const seg = state.ganttSegments.find((s) => s.id === id);
    if (!seg || !(lane instanceof HTMLElement)) return;
    const rect = lane.getBoundingClientRect();
    const y = e.clientY - rect.top;
    const rowH = GANTT_ROW_H;
    const maxLane = Math.max(0, ...state.ganttSegments.map((s) => s.rowIndex));
    let newRow = Math.floor((y - 6) / rowH);
    if (!Number.isFinite(newRow)) newRow = seg.rowIndex;
    newRow = Math.max(0, Math.min(Math.max(maxLane + 8, 12), newRow));
    seg.rowIndex = newRow;
    resolveAllGanttOverlaps();
    renderCalendarPage();
    schedulePersist();
  }

  function onGanttPointerDown(e) {
    if (!(e.target instanceof HTMLElement)) return;
    const vh = e.target.closest(".gantt-bar__vdrag");
    if (vh) {
      const bar = vh.closest(".gantt-bar");
      const id = Number(bar?.getAttribute("data-segment-id"));
      const seg = state.ganttSegments.find((s) => s.id === id);
      if (!bar || !seg || !Number.isFinite(id)) return;
      const lane = bar.closest("[data-px-per-day]");
      if (!(lane instanceof HTMLElement)) return;
      ganttRowDrag = { id, lane };
      document.addEventListener("pointermove", onGanttRowMoveDoc, true);
      document.addEventListener("pointerup", onGanttRowUpDoc, true);
      document.addEventListener("pointercancel", onGanttRowUpDoc, true);
      e.preventDefault();
      e.stopPropagation();
      return;
    }
    if (e.target.closest(".gantt-task-check")) return;
    if (e.target.closest(".gantt-bar__split")) return;
    if (e.target.closest(".gantt-bar__allocate")) return;

    const bar = e.target.closest(".gantt-bar");
    if (!bar) return;
    const id = Number(bar.getAttribute("data-segment-id"));
    if (!Number.isFinite(id)) return;
    const seg = state.ganttSegments.find((s) => s.id === id);
    if (!seg) return;

    const lane = bar.closest("[data-px-per-day]");
    const pxPerDay = lane instanceof HTMLElement ? parseFloat(lane.dataset.pxPerDay || "56") : GANTT_DAY_WIDTH_PX;

    if (e.target.closest(".gantt-bar-resize--l")) {
      ganttDrag = {
        type: "resizeL",
        id,
        startX: e.clientX,
        origStart: seg.startMinute,
        origDur: seg.durationMinutes,
        pxPerDay,
        accDx: 0,
      };
    } else if (e.target.closest(".gantt-bar-resize--r")) {
      ganttDrag = {
        type: "resizeR",
        id,
        startX: e.clientX,
        origDur: seg.durationMinutes,
        pxPerDay,
        accDx: 0,
      };
    } else {
      ganttDrag = {
        type: "move",
        id,
        startX: e.clientX,
        origStart: seg.startMinute,
        pxPerDay,
        accDx: 0,
      };
    }

    document.addEventListener("pointermove", onGanttPointerMoveDoc, true);
    document.addEventListener("pointerup", onGanttPointerUpDoc, true);
    document.addEventListener("pointercancel", onGanttPointerUpDoc, true);
    e.preventDefault();
  }

  function onGanttPointerMoveDoc(e) {
    if (!ganttDrag) return;
    const seg = state.ganttSegments.find((s) => s.id === ganttDrag.id);
    if (!seg) return;
    const dx = e.clientX - ganttDrag.startX;
    ganttDrag.accDx = dx;
    const ppd = ganttDrag.pxPerDay || GANTT_DAY_WIDTH_PX;
    const dm = (dx / ppd) * GANTT_CAL_MINUTES_PER_DAY;

    if (ganttDrag.type === "move") {
      setSegmentTransforms(ganttDrag.id, dx);
    } else if (ganttDrag.type === "resizeR") {
      seg.durationMinutes = Math.max(
        GANTT_MIN_SEGMENT_MINUTES,
        snapMinutes(ganttDrag.origDur + dm),
      );
    } else if (ganttDrag.type === "resizeL") {
      const newStart = snapMinutes(ganttDrag.origStart + dm);
      const end = ganttDrag.origStart + ganttDrag.origDur;
      const newDur = end - newStart;
      if (newDur >= GANTT_MIN_SEGMENT_MINUTES && newStart >= 0) {
        seg.startMinute = newStart;
        seg.durationMinutes = newDur;
      }
    }
  }

  function onGanttPointerUpDoc() {
    document.removeEventListener("pointermove", onGanttPointerMoveDoc, true);
    document.removeEventListener("pointerup", onGanttPointerUpDoc, true);
    document.removeEventListener("pointercancel", onGanttPointerUpDoc, true);
    if (ganttDrag) {
      const seg = state.ganttSegments.find((s) => s.id === ganttDrag.id);
      if (seg && ganttDrag.type === "move") {
        const dx = ganttDrag.accDx || 0;
        const ppd = ganttDrag.pxPerDay || GANTT_DAY_WIDTH_PX;
        const dm = (dx / ppd) * GANTT_CAL_MINUTES_PER_DAY;
        seg.startMinute = snapMinutes(ganttDrag.origStart + dm);
      }
      clearSegmentTransforms(ganttDrag.id);
      resolveAllGanttOverlaps();
      renderCalendarPage();
      schedulePersist();
    }
    ganttDrag = null;
  }

  function renderCalendarPage() {
    renderAcceptRemembrance();

    const host = $("#ganttHost");
    if (!host) return;

    const segs = state.ganttSegments;
    const totalTasks = segs.length;
    const doneTasks = segs.filter((x) => x.completed).length;
    const pct = totalTasks ? Math.round((doneTasks / totalTasks) * 100) : 0;
    $("#calendarProgressText").textContent = tf("completedProgress", { done: doneTasks, total: totalTasks });
    $("#calendarProgressFill").style.width = `${pct}%`;

    const msgArr = ENCOURAGE[state.lang] || ENCOURAGE.zh;
    $("#encourageText").textContent = msgArr[Math.floor(Math.random() * msgArr.length)];

    document.querySelectorAll(".cal-view-tab").forEach((btn) => {
      if (!(btn instanceof HTMLElement)) return;
      const v = btn.dataset.calView;
      btn.classList.toggle("is-active", v === state.calendarView);
    });

    if (!totalTasks) {
      host.innerHTML = `<div class="gantt-empty">${escapeHtml(t("ganttEmpty"))}</div>`;
      return;
    }

    if (state.calendarView === "month") renderCalendarMonthView(host, segs);
    else if (state.calendarView === "year") renderCalendarYearView(host, segs);
    else if (state.calendarView === "day") renderCalendarDayView(host, segs);
    else renderCalendarWeekView(host, segs);
    renderNotesToSelfSection();
  }

  function buildTasksFromCollected() {
    const tasks = [];

    for (const entry of state.collected) {
      if (!entry.changed || !entry.steps || !entry.steps.length) continue;
      const { topic, importance, urgency, steps } = entry;
      const n = steps.length;

      steps.forEach((s, i) => {
        tasks.push({
          title: formatResultStepTitle(s),
          urgency,
          importance,
          stepsCount: n,
          stepIndex: i + 1,
          timePerStepMinutes: s.timePerStepMinutes,
          difficulty: s.difficulty,
          isHard: s.difficulty >= 4,
          topic,
          stepName: s.name,
        });
      });
    }

    tasks.sort((a, b) => (b.urgency - a.urgency) || (b.importance - a.importance));
    return tasks;
  }

  function alternateSimpleHard(sortedTasks) {
    // Split by category first, keep category internal order.
    const simple = [];
    const hard = [];
    for (const task of sortedTasks) {
      (task.isHard ? hard : simple).push(task);
    }
    if (!simple.length || !hard.length) return sortedTasks;

    // Decide who starts based on higher urgency of category heads.
    const startWithHard =
      (hard[0].urgency > simple[0].urgency) ||
      (hard[0].urgency === simple[0].urgency && hard[0].importance >= simple[0].importance);

    const out = [];
    let i = 0;
    let j = 0;
    let takeHard = startWithHard;
    while (i < simple.length || j < hard.length) {
      if (takeHard) {
        if (j < hard.length) out.push(hard[j++]);
        takeHard = false;
      } else {
        if (i < simple.length) out.push(simple[i++]);
        takeHard = true;
      }
      // If one side empties, continue the rest.
      if (i >= simple.length) {
        while (j < hard.length) out.push(hard[j++]);
        break;
      }
      if (j >= hard.length) {
        while (i < simple.length) out.push(simple[i++]);
        break;
      }
      // toggle each loop via takeHard
    }
    return out;
  }

  init();
})();

