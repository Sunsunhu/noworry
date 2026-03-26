/**
 * 100 条「可改变 → 行动鼓励」与 100 条「不可改变 → 接纳安慰」× 中文 / English / Français
 * 通过 20 条主干 × 5 条收尾组合生成，保证句式多样、尽量不重复。
 */
(function () {
  const actZhHead = [
    "计划已经是行动的第一步",
    "你愿意写下来，就已经很了不起",
    "直面它的你，比想象中更勇敢",
    "一旦开始，就一往直前吧",
    "把大目标拆小，世界会温柔很多",
    "行动不需要完美，只需要真实",
    "今天的一小步，是明天的底气",
    "焦虑在拖延里变大，在行动里变小",
    "你已经具备开始的能力",
    "先动起来，再慢慢调整方向",
    "完成比完美更重要",
    "给自己一个可开始的版本就好",
    "你不是一个人在扛，我们一起往前",
    "把「想」换成「做」的第一分钟",
    "勇气不是不害怕，而是带着害怕也往前走",
    "你值得为自己认真一次",
    "把今天当作练习场，而不是考场",
    "开始的那一下，最难也最珍贵",
    "你已经比昨天更靠近答案",
    "温柔地对待自己，也坚定地推自己一把",
  ];
  const actZhTail = [
    "今天先做最小的一步就够了。",
    "哪怕只推进五分钟，也算数。",
    "写下来、发出去、点开第一步，都很好。",
    "不需要一次做完，只要今天有进展。",
    "动了，就比停在原地更接近你想要的样子。",
  ];

  const accZhHead = [
    "有些部分暂时改变不了，就先轻轻放下",
    "接纳不是认输，是给自己腾出空间",
    "把力气留给能滋养你的事",
    "无法控制的事，不必用全部心神去扛",
    "让心慢慢回到当下这一刻",
    "你已经很努力了，可以对自己软一点",
    "放下不等于放弃，是换一种温柔的方式活着",
    "把担心先放在一旁，先照顾好呼吸",
    "不确定也没关系，你仍然可以安稳地过今天",
    "有些事情需要时间，而你同样需要休息",
    "你不需要为无法控制的事苛责自己",
    "先给自己一个不被评判的角落",
    "允许自己慢一点、轻一点",
    "把「必须立刻解决」换成「我可以慢慢来」",
    "此刻的你，值得被温柔接住",
    "不必强撑坚强，柔软也是一种力量",
    "让焦虑靠边站一会儿，你依然完整",
    "你已经承受了很多，这本身就很不容易",
    "把关注放回身体，你会慢慢稳下来",
    "不能改变的事，也可以被温柔地陪伴",
  ];
  const accZhTail = [
    "先照顾好自己，其余的可以等等。",
    "这一刻，你只需对自己诚实。",
    "把温柔留给自己，是一种清醒的选择。",
    "你不需要立刻想通一切。",
    "允许暂停，也是一种前进。",
  ];

  function combine100(head, tail) {
    const out = [];
    for (let i = 0; i < 100; i++) {
      out.push(head[i % head.length] + "——" + tail[Math.floor(i / head.length) % tail.length]);
    }
    return out;
  }

  const actEnHead = [
    "A plan is already the first step of action",
    "Writing it down means you are facing it",
    "Choosing to look at it takes courage",
    "Once you start, keep going gently",
    "Small steps make the path kinder",
    "Action does not need to be perfect",
    "One tiny move today builds tomorrow",
    "Worry grows in delay and shrinks in motion",
    "You already have what it takes to begin",
    "Start now, adjust as you go",
    "Done beats perfect",
    "Give yourself a version you can start with",
    "You are not alone in moving forward",
    "Turn the first thought into the first minute",
    "Courage is moving even when afraid",
    "You deserve to try for yourself",
    "Treat today as practice, not a test",
    "The hardest part is often the start",
    "You are closer than yesterday",
    "Be gentle with yourself, and steady too",
  ];
  const actEnTail = [
    "One small step is enough for today.",
    "Even five minutes of progress counts.",
    "Open the first door. That is enough.",
    "You do not have to finish everything at once.",
    "Motion brings you closer to what you want.",
  ];

  const accEnHead = [
    "Some things cannot be changed right now—set them down gently",
    "Acceptance is not defeat; it makes room to breathe",
    "Save your energy for what can nourish you",
    "You do not have to carry all of the uncontrollable",
    "Let your mind return to this moment",
    "You have tried hard; you can soften toward yourself",
    "Letting go is not giving up; it is choosing peace",
    "Set worry aside for a while and care for your breath",
    "Not knowing everything is still okay",
    "Some things need time—and so do you",
    "You do not have to blame yourself for what you cannot control",
    "Give yourself a corner without judgment",
    "It is okay to go slower and lighter",
    "Replace must-fix-now with I can take my time",
    "You deserve to be held kindly, right now",
    "You do not have to be strong every second",
    "Let anxiety step aside; you are still whole",
    "You have carried a lot; that matters",
    "Bring attention back to your body; you will steady",
    "What cannot be changed can still be met with tenderness",
  ];
  const accEnTail = [
    "Care for yourself first; the rest can wait.",
    "You only need honesty with yourself in this moment.",
    "Kindness toward yourself is a wise choice.",
    "You do not have to figure it all out today.",
    "A pause can be a form of progress too.",
  ];

  const actFrHead = [
    "Un plan est deja le premier pas vers l'action",
    "Ecrire, c'est deja affronter la chose",
    "Regarder en face demande du courage",
    "Une fois lance(e), continue doucement",
    "Les petits pas rendent le chemin plus doux",
    "L'action n'a pas besoin d'etre parfaite",
    "Un tout petit geste aujourd'hui construit demain",
    "L'inquietude grossit quand on differe et fond quand on bouge",
    "Tu as deja ce qu'il faut pour commencer",
    "Commence maintenant, ajuste en chemin",
    "Fini vaut mieux que parfait",
    "Donne-toi une version que tu peux demarrer",
    "Tu n'es pas seul(e) pour avancer",
    "Transforme la premiere pensee en premiere minute",
    "Le courage, c'est avancer meme avec la peur",
    "Tu merites d'essayer pour toi",
    "Traite aujourd'hui comme un entrainement, pas un examen",
    "Le plus dur est souvent le debut",
    "Tu es plus pres qu'hier",
    "Sois doux avec toi, et constant aussi",
  ];
  const actFrTail = [
    "Un petit pas suffit pour aujourd'hui.",
    "Meme cinq minutes comptent.",
    "Ouvre la premiere porte, c'est deja bien.",
    "Tu n'as pas besoin de tout finir d'un coup.",
    "Bouger te rapproche de ce que tu veux.",
  ];

  const accFrHead = [
    "Certaines choses ne changent pas tout de suite—pose-les doucement",
    "Accepter n'est pas echouer; ca fait de la place",
    "Garde ton energie pour ce qui te nourrit",
    "Tu n'as pas a porter tout l'incontrolable",
    "Laisse ton esprit revenir a l'instant",
    "Tu as deja beaucoup essaye; tu peux t'adoucir",
    "Lacher prise n'est pas abandonner; c'est choisir la paix",
    "Mets l'inquietude de cote un instant et soigne ta respiration",
    "Ne pas tout savoir, c'est encore ok",
    "Certaines choses demandent du temps—comme toi",
    "Tu n'as pas a te blamer pour l'incontrolable",
    "Offre-toi un coin sans jugement",
    "Tu peux aller plus lentement, plus leger",
    "Remplace il faut regler tout de suite par je peux prendre mon temps",
    "Tu merites qu'on te prenne avec tendresse, maintenant",
    "Tu n'as pas besoin d'etre fort(e) a chaque seconde",
    "Laisse l'anxiete sur le cote; tu restes entier/entiere",
    "Tu portes beaucoup; ca compte",
    "Reviens au corps; tu vas te stabiliser",
    "L'inchangeable peut encore etre accueilli avec douceur",
  ];
  const accFrTail = [
    "Commence par te soigner; le reste peut attendre.",
    "Dans cet instant, sois honnete avec toi seulement.",
    "La gentillesse envers toi est un choix lucide.",
    "Tu n'as pas besoin de tout comprendre aujourd'hui.",
    "Une pause peut aussi etre un progres.",
  ];

  const actZh = combine100(actZhHead, actZhTail);
  const actEn = combine100(actEnHead, actEnTail);
  const actFr = combine100(actFrHead, actFrTail);
  const accZh = combine100(accZhHead, accZhTail);
  const accEn = combine100(accEnHead, accEnTail);
  const accFr = combine100(accFrHead, accFrTail);

  window.APP_PHRASES = {
    action: {
      zh: actZh,
      "zh-tw": actZh,
      ja: actEn,
      en: actEn,
      fr: actFr,
    },
    accept: {
      zh: accZh,
      "zh-tw": accZh,
      ja: accEn,
      en: accEn,
      fr: accFr,
    },
  };
})();
