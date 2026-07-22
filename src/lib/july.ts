/* ------------------------------------------------------------------ *
 *  MC Nexus — Complete July Content Plan
 *  Brand: The Main Character Method — public speaking, confidence,
 *  storytelling, stage presence, leadership & entrepreneurship.
 *  One reel every day + supporting content. Netherlands posting times.
 * ------------------------------------------------------------------ */
import type { Platform, ContentStatus, DayPlan, Review } from "./data";

const GR = {
  ink: "linear-gradient(135deg,#0f172a,#334155)",
  blue: "linear-gradient(135deg,#1e40af,#3b82f6)",
  sky: "linear-gradient(135deg,#0ea5e9,#38bdf8)",
  slate: "linear-gradient(135deg,#334155,#64748b)",
  teal: "linear-gradient(135deg,#0f766e,#14b8a6)",
  steel: "linear-gradient(135deg,#1e293b,#475569)",
  mist: "linear-gradient(135deg,#cbd5e1,#94a3b8)",
};

function caps(ig: string, li: string, tt: string, fb?: string, yt?: string): Record<Platform, string> {
  return { instagram: ig, facebook: fb ?? ig, linkedin: li, tiktok: tt, youtube: yt ?? ig };
}

/** Status by day-of-month relative to "today" = July 21. */
function statusFor(day: number): ContentStatus {
  if (day < 19) return "published";
  if (day < 21) return "published";
  if (day === 21) return "client_review";
  if (day === 22) return "scheduled";
  if (day === 23) return "approved";
  if (day === 24) return "client_review";
  if (day === 25) return "scheduled";
  if (day === 26) return "internal_review";
  if (day <= 28) return "draft";
  return "scheduled";
}

const d = (day: number) => `2026-07-${String(day).padStart(2, "0")}`;

const sampleReviews: Review[] = [
  { id: "jr1", author: "u_muz", at: "2026-07-21T09:10:00", status: "approved", comment: "Hook is razor-sharp. Sending to Onyema for sign-off." },
  { id: "jr2", author: "u_client", at: "2026-07-21T11:20:00", status: "comment", comment: "Love this — can we make the on-screen text a touch larger for mobile?" },
];

export const julyPlans: DayPlan[] = [
  {
    date: d(1), goal: "Kick off the month with a bold confidence statement", purpose: "Increase saves & profile visits",
    primaryPlatform: "instagram", time: "18:00", status: statusFor(1),
    reel: {
      topic: "The 3-second rule that makes any room listen",
      hook: "Stop starting your talks with 'Hi everyone, thanks for having me.'",
      script: "Open on a stage silhouette. VO: 'The first 3 seconds decide if they lean in or check their phone.' Show 3 openers on screen — a question, a bold claim, a 2-second pause. End on the speaker owning the silence.",
      bRoll: ["Slow push-in on empty stage", "Audience POV leaning forward", "Close-up on confident eye contact"],
      closingCta: "Save this before your next talk.",
      thumbnailConcept: "Speaker mid-gesture, bold text: 'FIRST 3 SECONDS'",
      editorNotes: "Punchy cuts on each opener. Subtle whoosh on the pause beat. Captions burned in, high contrast.",
    },
    captions: caps(
      "Your first 3 seconds on stage matter more than your last 30 minutes. Here's how to open so the whole room leans in 👇 Save this for your next talk.",
      "Most speakers waste their most valuable moment: the opening. In coaching, I teach three openers that earn attention in under 3 seconds — a sharp question, a bold claim, or a deliberate pause. Which one fits your next keynote?",
      "POV: you stop saying 'thanks for having me' and the room actually goes quiet 🤫 3-second rule, tap to steal it."
    ),
    captionNl: "Je eerste 3 seconden op het podium tellen zwaarder dan je laatste 30 minuten. Zo open je zodat de hele zaal naar voren leunt 👇 Bewaar dit voor je volgende talk.",
    hashtags: ["#publicspeaking", "#maincharactermethod", "#confidence", "#speakerlife", "#stagepresence"],
    cta: "Save this before your next talk",
    storyIdeas: ["Poll: 'Do you plan your first line?'", "Behind-the-scenes of filming the reel", "Swipe-up to the workshop waitlist"],
    gradient: GR.ink, emoji: "🎤", reviews: [],
  },
  {
    date: d(2), goal: "Teach storytelling structure", purpose: "Increase shares & authority",
    primaryPlatform: "tiktok", time: "19:00", status: statusFor(2),
    reel: {
      topic: "The story structure every founder should steal",
      hook: "Your pitch is boring because it has no villain.",
      script: "Whiteboard-style. VO walks through: Status quo → the villain (the problem) → the turning point → the new world. Overlay a real founder example. End: 'Facts tell. Stories sell.'",
      bRoll: ["Hand sketching arc on glass", "Founder speaking to small room", "Audience nodding"],
      closingCta: "Follow for storytelling that converts.",
      thumbnailConcept: "Story arc drawn on glass, text: 'EVERY PITCH NEEDS A VILLAIN'",
      editorNotes: "Kinetic text synced to each story beat. Keep under 35s.",
    },
    captions: caps(
      "Facts tell. Stories sell. The 4-part structure behind every pitch people actually remember 👇 Save + send to a founder who needs it.",
      "Data doesn't move people — story does. The narrative arc I teach founders: status quo → villain → turning point → new world. Put your product as the guide, not the hero. Your customer is the hero.",
      "your pitch is boring because it has no villain 😅 fix it in 30 seconds ⬇️"
    ),
    captionNl: "Feiten vertellen. Verhalen verkopen. De 4-delige structuur achter elke pitch die mensen écht onthouden 👇 Bewaar + stuur naar een ondernemer die dit nodig heeft.",
    hashtags: ["#storytelling", "#founders", "#pitchdeck", "#maincharactermethod", "#publicspeaking"],
    cta: "Save + share with a founder",
    storyIdeas: ["Ask: 'What's your villain?'", "Duet a founder's pitch", "Mini case study screenshot"],
    gradient: GR.blue, emoji: "📖",
    post: { type: "carousel", topic: "The 4-part story arc, broken down", imageConcept: "Minimal white slides, one beat per slide, thin blue arc connecting them", photographyDirection: "No photos — clean editorial graphics, generous whitespace", graphicText: "STATUS QUO · VILLAIN · TURNING POINT · NEW WORLD", designerNotes: "Slide 1 hook must be readable at thumbnail size. 5 slides.", slides: 5 },
    reviews: [],
  },
  {
    date: d(3), goal: "Show stage presence tactics", purpose: "Increase engagement & DMs",
    primaryPlatform: "instagram", time: "18:30", status: statusFor(3),
    reel: {
      topic: "Where to put your hands when you speak",
      hook: "If you don't know what to do with your hands, do this.",
      script: "Quick demo of 3 grounded gestures vs 3 nervous habits. Split-screen good vs awkward. End on 'Gesture in the box: shoulders to hips, elbow off the ribs.'",
      bRoll: ["Hands demonstrating the 'box'", "Nervous fidgeting b-roll", "Full-body confident stance"],
      closingCta: "DM me 'HANDS' for the full guide.",
      thumbnailConcept: "Speaker with defined gesture box overlay",
      editorNotes: "Split screen, freeze-frame on each gesture. Add subtle grid overlay for 'the box'.",
    },
    captions: caps(
      "Nervous hands ruin confident messages. The 'gesture box' fixes it in one talk 🙌 Which habit are you guilty of? 1, 2, or 3?",
      "Body language leaks what your words hide. I coach leaders to gesture inside 'the box' — shoulders to hips — to read as grounded and certain. Small change, huge shift in executive presence.",
      "what to do with your hands when you speak 🙌 nobody teaches this"
    ),
    captionNl: "Zenuwachtige handen verpesten een zelfverzekerde boodschap. De 'gebarenbox' lost het op in één talk 🙌 Welke gewoonte herken je? 1, 2 of 3?",
    hashtags: ["#stagepresence", "#bodylanguage", "#confidence", "#speakingtips", "#maincharactermethod"],
    cta: "DM 'HANDS' for the guide",
    storyIdeas: ["Green-screen react to bad hand habits", "Poll: nervous habit #1?", "Quick tip carousel teaser"],
    gradient: GR.slate, emoji: "🙌", reviews: [],
  },
  {
    date: d(4), goal: "Leadership voice", purpose: "Build authority",
    primaryPlatform: "youtube", time: "16:00", status: statusFor(4),
    reel: {
      topic: "How leaders silence a noisy room without raising their voice",
      hook: "Great leaders get quiet — not loud.",
      script: "Contrast a manager shouting vs a leader lowering voice + slowing down. Show the room settle. End: 'Authority is pace, not volume.'",
      bRoll: ["Boardroom wide shot", "Slow zoom on calm speaker", "Team settling / nodding"],
      closingCta: "Subscribe for leadership communication.",
      thumbnailConcept: "Calm leader, bold text: 'GET QUIET, NOT LOUD'",
      editorNotes: "Audio ducking to emphasise the pause. Cinematic grade.",
    },
    captions: caps(
      "The most powerful thing you can do in a heated room? Lower your voice and slow down. Authority is pace, not volume.",
      "Volume signals panic. Pace signals control. When the room gets loud, the leader gets slow and quiet — and everyone leans in to listen. This is executive presence in one move.",
      "leaders get quiet, not loud 🤫 try it in your next meeting"
    ),
    captionNl: "Het krachtigste wat je in een verhitte ruimte kunt doen? Zachter praten en vertragen. Autoriteit zit in tempo, niet in volume.",
    hashtags: ["#leadership", "#executivepresence", "#communication", "#maincharactermethod"],
    cta: "Subscribe for more",
    storyIdeas: ["Clip: the 'pause' moment", "Ask: loud boss or calm boss?", "Leadership quote card"],
    gradient: GR.steel, emoji: "🎯", reviews: [],
  },
  {
    date: d(5), goal: "Entrepreneurship / positioning", purpose: "Drive website traffic",
    primaryPlatform: "linkedin", time: "08:30", status: statusFor(5),
    reel: {
      topic: "Why nobody remembers your elevator pitch",
      hook: "‘I help businesses grow’ is why they forget you.",
      script: "Cut vague pitches vs specific ones. Formula on screen: 'I help [who] go from [pain] to [win] without [objection].' End with a crisp example.",
      bRoll: ["Networking event b-roll", "Business card close-up", "Confident intro handshake"],
      closingCta: "Full positioning guide on the site.",
      thumbnailConcept: "Two business cards: vague vs specific",
      editorNotes: "On-screen fill-in-the-blank animation for the formula.",
    },
    captions: caps(
      "‘I help businesses grow’ = instantly forgettable. Steal this pitch formula so people remember you in one sentence 👇",
      "If your intro could belong to a thousand people, it belongs to no one. The positioning line I give every founder: 'I help [who] go from [pain] to [win] without [objection].' Specific beats impressive. What's yours?",
      "your elevator pitch is mid, here's the fix 🛗"
    ),
    captionNl: "‘Ik help bedrijven groeien’ = meteen vergeten. Pak deze pitch-formule zodat mensen je onthouden in één zin 👇",
    hashtags: ["#positioning", "#entrepreneurship", "#personalbranding", "#maincharactermethod"],
    cta: "Read the full guide (link in bio)",
    storyIdeas: ["Rewrite a follower's pitch", "Before/after pitch card", "Link sticker to positioning guide"],
    gradient: GR.blue, emoji: "🛗", reviews: [],
  },
  {
    date: d(6), goal: "Behind the scenes", purpose: "Build connection / profile visits",
    primaryPlatform: "instagram", time: "12:30", status: statusFor(6),
    reel: {
      topic: "A Sunday reset before a big speaking week",
      hook: "The unglamorous prep behind a 'natural' speaker.",
      script: "Montage: rehearsing to an empty room, editing slides, voice warm-ups, coffee. VO on the myth of 'naturals'. End: 'Confidence is rehearsed.'",
      bRoll: ["Empty room rehearsal", "Slide edits on laptop", "Vocal warm-up mirror"],
      closingCta: "Follow the journey.",
      thumbnailConcept: "Candid rehearsal shot, warm tone",
      editorNotes: "Lo-fi, authentic vibe. Handheld feel. Soft trending audio.",
    },
    captions: caps(
      "The 'natural' speaker you admire? They rehearsed to an empty room first. Confidence is built, not born. My Sunday reset before a big week ☕️",
      "People assume presence is a personality trait. It's a practice. Here's the unglamorous prep — empty-room reps, slide edits, vocal warm-ups — behind what looks effortless on stage.",
      "romanticise the boring prep 🎬☕️ confidence is rehearsed"
    ),
    captionNl: "Die 'natuurlijke' spreker die je bewondert? Die oefende eerst in een lege zaal. Zelfvertrouwen bouw je op. Mijn zondagse reset ☕️",
    hashtags: ["#behindthescenes", "#speakerlife", "#sundayreset", "#maincharactermethod"],
    cta: "Follow the journey",
    storyIdeas: ["Time-lapse slide edits", "Vocal warm-up clip", "This week's speaking schedule"],
    gradient: GR.mist, emoji: "☕️", reviews: [],
  },
  {
    date: d(7), goal: "Educational — nerves", purpose: "Increase saves",
    primaryPlatform: "tiktok", time: "19:30", status: statusFor(7),
    reel: {
      topic: "Turn stage fear into stage fuel in 60 seconds",
      hook: "Your body can't tell fear from excitement. Use that.",
      script: "Explain the reframe: same racing heart, different label. Box-breathing demo (4-4-4-4). End: 'Say 'I'm excited' out loud before you walk on.'",
      bRoll: ["Backstage pacing", "Breathing demo close-up", "Walking onto stage"],
      closingCta: "Save for your next talk.",
      thumbnailConcept: "Backstage curtain, text: 'FEAR → FUEL'",
      editorNotes: "Sync breathing animation to a calm beat. Keep tight.",
    },
    captions: caps(
      "Your racing heart isn't fear — it's fuel with the wrong label. The reframe (+ a 60-second breath) I use before every stage 👇 Save it.",
      "Anxiety and excitement are physiologically identical — same heartbeat, different story. Teach your brain the better story: say 'I'm excited' out loud before you speak. Small reframe, real edge.",
      "fear and excitement feel the same 🤯 relabel it and walk on"
    ),
    captionNl: "Je bonzende hart is geen angst — het is brandstof met het verkeerde label. De reframe (+ ademhaling van 60 sec) die ik voor elk podium gebruik 👇 Bewaren.",
    hashtags: ["#stagefright", "#confidence", "#mindset", "#publicspeaking", "#maincharactermethod"],
    cta: "Save for your next talk",
    storyIdeas: ["Guided breath sticker", "Poll: do you get nervous?", "Testimonial screenshot"],
    gradient: GR.teal, emoji: "🔥", reviews: [],
  },
  {
    date: d(8), goal: "Client testimonial", purpose: "Build trust / DMs",
    primaryPlatform: "instagram", time: "18:00", status: statusFor(8),
    reel: {
      topic: "From dreading the mic to keynoting a 500-person room",
      hook: "6 weeks ago she couldn't finish a toast.",
      script: "Client's before/after in her words. Clip of her keynote. VO stats: engagement up, promotion landed. End on her smile.",
      bRoll: ["Client keynote clip", "Audience applause", "Coaching session snippet"],
      closingCta: "DM 'STAGE' to start your story.",
      thumbnailConcept: "Client mid-keynote, text: '6 WEEKS'",
      editorNotes: "Emotional build. Let her voice carry it. Minimal text.",
    },
    captions: caps(
      "6 weeks ago she couldn't finish a wedding toast. Last week she keynoted to 500 people. This is what the work looks like 🤍 DM 'STAGE' to start yours.",
      "Real transformation from a Main Character Method client: from avoiding the mic to delivering a keynote that landed her a promotion. Presence isn't a gift — it's a skill you can be coached into.",
      "she went from dreading toasts to keynoting 500 people 🤍 6 weeks"
    ),
    captionNl: "6 weken geleden kon ze geen bruiloftstoast afmaken. Vorige week gaf ze een keynote voor 500 mensen. Zo ziet het werk eruit 🤍 DM 'STAGE' om te beginnen.",
    hashtags: ["#testimonial", "#transformation", "#publicspeaking", "#maincharactermethod"],
    cta: "DM 'STAGE' to start",
    storyIdeas: ["Full testimonial clip", "Before/after quote card", "Booking link sticker"],
    gradient: GR.blue, emoji: "🏆", reviews: [],
  },
  {
    date: d(9), goal: "Promotional — workshop", purpose: "Promote workshop / traffic",
    primaryPlatform: "instagram", time: "18:30", status: statusFor(9),
    reel: {
      topic: "Doors open: the Main Character Speaking Workshop",
      hook: "If you'd panic being handed a mic right now — this is for you.",
      script: "Fast montage of workshop energy, breakthroughs, applause. VO on what they'll leave with. End with date + 'limited seats'.",
      bRoll: ["Workshop room energy", "Participant breakthrough", "Applause / high-fives"],
      closingCta: "Link in bio — limited seats.",
      thumbnailConcept: "Workshop room, bold: 'SEATS OPEN'",
      editorNotes: "High energy, quick cuts, on-beat. End card with date + CTA.",
    },
    captions: caps(
      "Doors are OPEN 🚪 The Main Character Speaking Workshop — walk in nervous, walk out magnetic. Limited seats. Link in bio.",
      "Registration is open for the next Main Character Speaking Workshop. One intensive day on openings, storytelling, presence and Q&A under pressure. Ideal for founders and leaders who present often. Limited seats — details in comments.",
      "walk in nervous, walk out magnetic 🎤 workshop seats are OPEN"
    ),
    captionNl: "De deuren zijn OPEN 🚪 De Main Character Speaking Workshop — kom binnen nerveus, loop naar buiten magnetisch. Beperkte plekken. Link in bio.",
    hashtags: ["#workshop", "#publicspeaking", "#maincharactermethod", "#speakertraining"],
    cta: "Book your seat (link in bio)",
    storyIdeas: ["Countdown sticker", "Past workshop clips", "Q&A: what's included?"],
    gradient: GR.sky, emoji: "🚪",
    post: { type: "image", topic: "Workshop announcement", imageConcept: "Clean poster: date, city, 'Limited Seats', workshop title", photographyDirection: "Studio portrait of coach, confident, neutral backdrop", graphicText: "MAIN CHARACTER SPEAKING WORKSHOP · LIMITED SEATS", designerNotes: "Keep it editorial, lots of whitespace, one accent colour." },
    reviews: [],
  },
  {
    date: d(10), goal: "Educational — voice", purpose: "Increase saves & shares",
    primaryPlatform: "tiktok", time: "19:00", status: statusFor(10),
    reel: {
      topic: "The vocal trick that makes you sound certain",
      hook: "End your sentences DOWN, not up.",
      script: "Demo upspeak vs downspeak on the same line. Explain how downspeak signals conviction. End: 'Statements, not questions.'",
      bRoll: ["Waveform overlay", "Speaker at podium", "Close-up mouth/mic"],
      closingCta: "Save + practice today.",
      thumbnailConcept: "Waveform with arrow pointing down",
      editorNotes: "Show pitch arrows on screen for up vs down. Fast, clear.",
    },
    captions: caps(
      "You sound unsure because your sentences go UP at the end. Land them DOWN and you sound certain. Try it out loud right now 👇",
      "Upspeak turns statements into questions and quietly erodes authority. Coaching cue: let your pitch fall at the end of key sentences. Conviction is audible — and trainable.",
      "stop ending sentences like a question 📉 sound certain instantly"
    ),
    captionNl: "Je klinkt onzeker omdat je zinnen omhoog eindigen. Laat ze DALEN en je klinkt overtuigd. Probeer het nu hardop 👇",
    hashtags: ["#vocaltips", "#confidence", "#communication", "#maincharactermethod"],
    cta: "Save + practice today",
    storyIdeas: ["Voice memo challenge", "Up vs down poll", "Duet prompt"],
    gradient: GR.slate, emoji: "🎙️", reviews: [],
  },
  {
    date: d(11), goal: "Storytelling — vulnerability", purpose: "Comments & connection",
    primaryPlatform: "instagram", time: "18:00", status: statusFor(11),
    reel: {
      topic: "The talk I almost walked out of",
      hook: "I froze on stage in front of 200 people.",
      script: "Personal story: blanking, the 3-second recovery, what it taught. End with the lesson: 'The audience is rooting for you.'",
      bRoll: ["Dim stage recreation", "Deep breath close-up", "Warm audience"],
      closingCta: "Comment a time you froze — let's normalise it.",
      thumbnailConcept: "Coach on stage, honest expression",
      editorNotes: "Let the story breathe. Minimal cuts, real emotion.",
    },
    captions: caps(
      "I once blanked on stage in front of 200 people. What I did in the next 3 seconds changed how I coach forever. The audience is rooting for you 🤍 Ever frozen up? Tell me below.",
      "Vulnerability builds trust faster than polish. Here's the time I froze in front of 200 people — and the recovery I now teach every client. Presence isn't the absence of nerves; it's what you do with them.",
      "i froze on stage in front of 200 people 😳 here's what saved me"
    ),
    captionNl: "Ik ging ooit compleet op zwart op het podium voor 200 mensen. Wat ik in de 3 seconden daarna deed, veranderde alles. Het publiek gunt je succes 🤍 Ooit dichtgeklapt? Vertel het hieronder.",
    hashtags: ["#storytelling", "#vulnerability", "#publicspeaking", "#maincharactermethod"],
    cta: "Comment your moment",
    storyIdeas: ["Q&A box: your stage fails", "Repost audience replies", "Lesson quote card"],
    gradient: GR.ink, emoji: "💬", reviews: [],
  },
  {
    date: d(12), goal: "Leadership — meetings", purpose: "Authority & saves",
    primaryPlatform: "linkedin", time: "08:30", status: statusFor(12),
    reel: {
      topic: "How to speak up in a meeting full of louder people",
      hook: "You don't need to be loud. You need to be first with the frame.",
      script: "3 tactics: name the tension, ask the sharp question, summarise & redirect. Quick examples. End: 'Presence beats volume.'",
      bRoll: ["Meeting room b-roll", "Confident interjection", "Colleagues turning to listen"],
      closingCta: "Save for your next meeting.",
      thumbnailConcept: "One calm person in a busy meeting",
      editorNotes: "Clean text callouts per tactic. Corporate but warm.",
    },
    captions: caps(
      "Being talked over isn't about volume — it's about framing. 3 ways to own the room without fighting for airtime 👇 Save for Monday.",
      "Quieter professionals get overlooked not for lack of ideas, but for lack of framing. Three moves that work: name the tension, ask the sharpest question, then summarise and redirect. Influence is a skill, not a decibel level.",
      "how to speak up when everyone's louder than you 🗣️ 3 moves"
    ),
    captionNl: "Overstemd worden gaat niet over volume — het gaat over kaderen. 3 manieren om de ruimte te pakken zonder te vechten om spreektijd 👇 Bewaar voor maandag.",
    hashtags: ["#leadership", "#meetings", "#communication", "#maincharactermethod"],
    cta: "Save for your next meeting",
    storyIdeas: ["Poll: talked over often?", "Tactic carousel teaser", "Ask for their meeting struggle"],
    gradient: GR.steel, emoji: "🧠", reviews: [],
  },
  {
    date: d(13), goal: "Community / UGC prompt", purpose: "Engagement & DMs",
    primaryPlatform: "instagram", time: "12:30", status: statusFor(13),
    reel: {
      topic: "Rate your opening line (I'll reply to the best)",
      hook: "Drop your talk's first line. I'll make it stronger.",
      script: "Invite followers to comment their opener. Show 2 quick rewrites on screen. End: 'Comment yours — I'm replying all day.'",
      bRoll: ["Coach reading phone", "Typing replies", "Thumbs up to camera"],
      closingCta: "Comment your opener now.",
      thumbnailConcept: "Text: 'RATE MY OPENING LINE'",
      editorNotes: "Interactive, casual. Two on-screen rewrite examples.",
    },
    captions: caps(
      "Drop the first line of your next talk in the comments 👇 I'm rewriting the best ones all day. Weak openers welcome — that's the point.",
      "Community challenge: share the opening line of a talk or pitch you're working on. I'll reply with a sharper version for as many as I can today. Great openings are engineered, not improvised.",
      "comment your opening line, i'll fix it 🔧 replying all day"
    ),
    captionNl: "Zet de eerste zin van je volgende talk in de comments 👇 Ik herschrijf de beste de hele dag. Zwakke openers welkom — dat is juist het punt.",
    hashtags: ["#community", "#publicspeaking", "#engagement", "#maincharactermethod"],
    cta: "Comment your opener",
    storyIdeas: ["Repost rewrites", "Best-opener shoutout", "DM sticker for private feedback"],
    gradient: GR.blue, emoji: "💬", reviews: [],
  },
  {
    date: d(14), goal: "Educational — slides", purpose: "Saves & website traffic",
    primaryPlatform: "youtube", time: "16:00", status: statusFor(14),
    reel: {
      topic: "Your slides are competing with you. Fix them.",
      hook: "If they're reading your slide, they're not listening to you.",
      script: "Before/after: text-heavy vs one idea per slide. Rule of 'six words'. End: 'Slides support you — they don't replace you.'",
      bRoll: ["Busy slide vs clean slide", "Presenter beside screen", "Audience focused on speaker"],
      closingCta: "Free slide checklist on the site.",
      thumbnailConcept: "Split slide: cluttered vs clean",
      editorNotes: "Strong before/after reveal. Snappy.",
    },
    captions: caps(
      "If your audience is reading your slide, they've stopped listening to you. One idea per slide. Six words max. Your slides support you — they don't replace you 👇",
      "The most common presentation mistake I see with executives: slides that compete with the speaker. Strip to one idea per slide, six words maximum, and let your voice carry the detail. You are the presentation.",
      "your slides are stealing your audience 😭 one idea per slide"
    ),
    captionNl: "Als je publiek je slide leest, luistert het niet meer naar jou. Eén idee per slide. Max zes woorden. Je slides ondersteunen je — ze vervangen je niet 👇",
    hashtags: ["#presentations", "#slides", "#publicspeaking", "#maincharactermethod"],
    cta: "Get the free checklist",
    storyIdeas: ["Roast a bad slide", "Six-word challenge", "Link to checklist"],
    gradient: GR.slate, emoji: "📊", reviews: [],
  },
  {
    date: d(15), goal: "Mid-month momentum / mindset", purpose: "Saves & shares",
    primaryPlatform: "tiktok", time: "19:30", status: statusFor(15),
    reel: {
      topic: "The main character mindset shift",
      hook: "Stop waiting to feel ready. Ready is a decision.",
      script: "Punchy VO on identity: you don't find confidence, you decide to act as the person who has it. Rapid empowering cuts. End on brand line.",
      bRoll: ["Walking confidently through city", "Stepping on stage", "Direct-to-camera stare"],
      closingCta: "Share with someone who's waiting to feel ready.",
      thumbnailConcept: "Bold text: 'READY IS A DECISION'",
      editorNotes: "Cinematic, motivational, on-beat. Brand end card.",
    },
    captions: caps(
      "You won't feel ready. You'll decide to be. The main character doesn't wait for permission — she moves and confidence catches up 🤍 Share this with someone who needs it.",
      "Confidence is not a prerequisite for action — it's the result of it. The identity shift I coach: stop auditing whether you feel ready and start behaving as the person you're becoming. Momentum builds belief.",
      "ready is a decision, not a feeling 🤍 send this to someone"
    ),
    captionNl: "Je zult je niet klaar voelen. Je besluit het te zijn. De main character wacht niet op toestemming — ze beweegt en het zelfvertrouwen volgt 🤍 Deel dit met iemand die het nodig heeft.",
    hashtags: ["#mindset", "#confidence", "#maincharacter", "#maincharactermethod"],
    cta: "Share this",
    storyIdeas: ["Text-to-speech mantra", "Poll: waiting to feel ready?", "Save reminder"],
    gradient: GR.ink, emoji: "✨", reviews: [],
  },
  {
    date: d(16), goal: "Educational — Q&A", purpose: "Saves & authority",
    primaryPlatform: "instagram", time: "18:00", status: statusFor(16),
    reel: {
      topic: "How to answer a question you don't know the answer to",
      hook: "Never say 'that's a great question' again.",
      script: "3-step: acknowledge → bridge to what you do know → offer to follow up. Live example under pressure. End: 'Composure is the answer.'",
      bRoll: ["Q&A mic in audience", "Speaker thinking calmly", "Nod and smile"],
      closingCta: "Save for your next Q&A.",
      thumbnailConcept: "Mic pointed at calm speaker",
      editorNotes: "Show the 3 steps as clean lower-thirds.",
    },
    captions: caps(
      "The scariest part of any talk? The Q&A. Here's how to handle a question you can't answer — without losing the room 👇 Save it.",
      "You will get asked something you don't know. Composure, not omniscience, is what the room remembers. Acknowledge, bridge to what you do know, and offer to follow up. Authority is how you handle uncertainty.",
      "how to answer a question you don't know 😳 stay composed"
    ),
    captionNl: "Het engste deel van elke talk? De Q&A. Zo ga je om met een vraag die je niet kunt beantwoorden — zonder de zaal te verliezen 👇 Bewaren.",
    hashtags: ["#qanda", "#publicspeaking", "#confidence", "#maincharactermethod"],
    cta: "Save for your next Q&A",
    storyIdeas: ["Ask: worst Q&A moment?", "3-step carousel", "Live practice clip"],
    gradient: GR.teal, emoji: "🎯", reviews: [],
  },
  {
    date: d(17), goal: "Entrepreneurship — sales", purpose: "DMs & traffic",
    primaryPlatform: "linkedin", time: "08:30", status: statusFor(17),
    reel: {
      topic: "Sell without sounding salesy: talk like a guide",
      hook: "People don't buy the best product. They buy the clearest story.",
      script: "Reframe sales as guiding. Show 'hero/guide' language swap. End: 'Make them the hero. Be the guide.'",
      bRoll: ["Founder pitching calmly", "Client nodding", "Handshake close"],
      closingCta: "Free pitch guide on the site.",
      thumbnailConcept: "Text: 'BE THE GUIDE, NOT THE HERO'",
      editorNotes: "Clean word-swap animation. Professional tone.",
    },
    captions: caps(
      "People don't buy the best product — they buy the clearest story. Sell like a guide, not a hero, and watch the pressure disappear 👇",
      "The best salespeople sound like coaches, not closers. Position your customer as the hero and yourself as the guide with the plan. Clarity converts more than charisma. Free pitch guide in the comments.",
      "stop selling, start guiding 🧭 people buy the clearest story"
    ),
    captionNl: "Mensen kopen niet het beste product — ze kopen het duidelijkste verhaal. Verkoop als een gids, niet als een held, en de druk verdwijnt 👇",
    hashtags: ["#sales", "#entrepreneurship", "#storytelling", "#maincharactermethod"],
    cta: "Get the free pitch guide",
    storyIdeas: ["Hero/guide swap examples", "Poll: hate selling?", "Link to guide"],
    gradient: GR.blue, emoji: "🧭", reviews: [],
  },
  {
    date: d(18), goal: "Behind the scenes — team", purpose: "Connection & profile visits",
    primaryPlatform: "instagram", time: "12:30", status: statusFor(18),
    reel: {
      topic: "A day filming content for the method",
      hook: "What a content day actually looks like.",
      script: "Fun, fast BTS montage: setups, retakes, bloopers, team laughs. VO on consistency. End: 'Show up before you feel ready.'",
      bRoll: ["Camera setup", "Blooper takes", "Team laughing"],
      closingCta: "Follow for more behind the scenes.",
      thumbnailConcept: "Candid on-set moment",
      editorNotes: "Playful, trending audio, quick cuts, include one blooper.",
    },
    captions: caps(
      "One reel a day looks effortless from the outside. Here's the retakes, bloopers and team chaos that make it happen 🎬 Consistency > perfection.",
      "Behind every 'effortless' content presence is a system and a team. A quick look at a filming day for the Main Character Method — and why showing up beats waiting to feel ready.",
      "what a content day really looks like 🎬 (bloopers included)"
    ),
    captionNl: "Eén reel per dag lijkt moeiteloos van buiten. Hier de retakes, bloopers en team-chaos die het mogelijk maken 🎬 Consistentie > perfectie.",
    hashtags: ["#behindthescenes", "#contentcreation", "#maincharactermethod"],
    cta: "Follow for more BTS",
    storyIdeas: ["Boomerang on set", "Team intro", "Poll: BTS more often?"],
    gradient: GR.mist, emoji: "🎬", reviews: [],
  },
  {
    date: d(19), goal: "Educational — eye contact", purpose: "Saves",
    primaryPlatform: "tiktok", time: "19:00", status: statusFor(19),
    reel: {
      topic: "The eye-contact rule that beats scanning the room",
      hook: "Stop scanning the room. Do this instead.",
      script: "Explain 'one thought, one person': hold eye contact for a complete sentence, then move. Demo. End: 'Connection, not radar.'",
      bRoll: ["Speaker making eye contact", "Audience members individually", "Slow pan of room"],
      closingCta: "Save + try it this week.",
      thumbnailConcept: "Speaker locking eyes with one person",
      editorNotes: "Show the 'one sentence per person' timing on screen.",
    },
    captions: caps(
      "Scanning the room makes you look nervous. Instead: one complete thought, one person, then move. It reads as calm and connected 👇 Save it.",
      "Darting eye contact signals anxiety; deliberate eye contact signals presence. The rule I teach: hold one person for a full sentence, then move to the next. You're building connection, not running radar.",
      "stop scanning the room 👀 one thought, one person"
    ),
    captionNl: "De zaal afspeuren laat je nerveus overkomen. In plaats daarvan: één complete gedachte, één persoon, dan verder. Het oogt kalm en verbonden 👇 Bewaren.",
    hashtags: ["#eyecontact", "#stagepresence", "#publicspeaking", "#maincharactermethod"],
    cta: "Save + try it",
    storyIdeas: ["Demo clip", "Poll: eye contact scary?", "Tip series teaser"],
    gradient: GR.slate, emoji: "👀", reviews: [],
  },
  {
    date: d(20), goal: "Weekly recap / value round-up", purpose: "Saves & follows",
    primaryPlatform: "instagram", time: "18:00", status: statusFor(20),
    reel: {
      topic: "5 speaking tips from this week in 40 seconds",
      hook: "Every speaking tip from this week, no fluff.",
      script: "Rapid-fire recap of the week's 5 tips with on-screen text. End: 'Follow so you never miss the daily drop.'",
      bRoll: ["Quick clips from the week", "Text stack build", "Coach to camera"],
      closingCta: "Follow for a daily tip.",
      thumbnailConcept: "Numbered list 1–5 on clean bg",
      editorNotes: "Fast, satisfying stack animation of all 5 tips.",
    },
    captions: caps(
      "Missed a day? Here's every speaking tip from this week in 40 seconds ⏱️ Save the whole set and follow for a new one daily.",
      "This week's Main Character Method round-up: openings, gestures, vocal tone, eye contact and Q&A composure — condensed into 40 seconds. Save it as a pre-talk checklist.",
      "every speaking tip this week in 40 seconds ⏱️ save the set"
    ),
    captionNl: "Een dag gemist? Hier elke spreektip van deze week in 40 seconden ⏱️ Bewaar de hele set en volg voor elke dag een nieuwe.",
    hashtags: ["#speakingtips", "#recap", "#publicspeaking", "#maincharactermethod"],
    cta: "Follow for daily tips",
    storyIdeas: ["Poll: fav tip?", "Save reminder", "Tease next week"],
    gradient: GR.blue, emoji: "🗂️", reviews: [],
  },
  {
    date: d(21), goal: "Flagship educational reel", purpose: "Saves, shares & authority",
    primaryPlatform: "instagram", time: "18:00", status: statusFor(21),
    reel: {
      topic: "The 3-part framework to never run out of things to say",
      hook: "You don't go blank because you're nervous. You go blank because you have no structure.",
      script: "Teach 'PPF': Point → Proof → Picture. Same idea told with and without it. End: 'Structure kills the blank.'",
      bRoll: ["Whiteboard PPF", "Speaker flowing confidently", "Audience engaged"],
      closingCta: "Save this — it'll save your next talk.",
      thumbnailConcept: "Bold: 'NEVER GO BLANK' with PPF tags",
      editorNotes: "Clear 3-step build. This is the hero reel of the week — extra polish.",
    },
    captions: caps(
      "Going blank isn't a nerves problem — it's a structure problem. The 3-part framework (Point · Proof · Picture) so you always know what comes next 👇 Save it. It'll save your next talk.",
      "The reason smart people freeze mid-talk isn't anxiety — it's the absence of a structure to fall back on. Point, Proof, Picture: make a claim, back it with evidence, paint it with a concrete example. Structure is what confidence stands on.",
      "you don't go blank from nerves, you go blank from no structure 🧠 PPF"
    ),
    captionNl: "Dichtklappen is geen zenuwenprobleem — het is een structuurprobleem. Het 3-delige raamwerk (Point · Proof · Picture) zodat je altijd weet wat er komt 👇 Bewaren. Het redt je volgende talk.",
    hashtags: ["#publicspeaking", "#framework", "#confidence", "#maincharactermethod", "#storytelling"],
    cta: "Save this framework",
    storyIdeas: ["PPF carousel teaser", "Poll: ever gone blank?", "Ask for a topic to demo PPF"],
    gradient: GR.ink, emoji: "🧠",
    post: { type: "carousel", topic: "Point · Proof · Picture, with examples", imageConcept: "3 clean slides, one framework step each, thin blue accents", photographyDirection: "Editorial graphics only, generous whitespace", graphicText: "POINT → PROOF → PICTURE", designerNotes: "Slide 1 must hook at thumbnail size. Consistent grid.", slides: 4 },
    reviews: sampleReviews,
  },
  {
    date: d(22), goal: "Leadership — feedback", purpose: "Authority & saves",
    primaryPlatform: "linkedin", time: "08:30", status: statusFor(22),
    reel: {
      topic: "Give hard feedback people actually thank you for",
      hook: "Feedback fails when it's about the person, not the play.",
      script: "SBI model: Situation → Behaviour → Impact. Bad vs good example. End: 'Critique the play, protect the person.'",
      bRoll: ["1:1 conversation b-roll", "Manager listening", "Team high-five"],
      closingCta: "Save for your next 1:1.",
      thumbnailConcept: "Two speech bubbles: harsh vs helpful",
      editorNotes: "Clean SBI callouts. Warm, professional grade.",
    },
    captions: caps(
      "Hard feedback lands when it's about the behaviour, not the person. The 3-part script (Situation · Behaviour · Impact) that keeps trust intact 👇 Save for your next 1:1.",
      "Feedback fails when it becomes character judgment. Use Situation–Behaviour–Impact to keep it specific and kind: describe the moment, the behaviour, and its effect. Critique the play, protect the person.",
      "how to give hard feedback people thank you for 🤝 SBI"
    ),
    captionNl: "Harde feedback landt als het over gedrag gaat, niet over de persoon. Het 3-delige script (Situatie · Gedrag · Impact) dat vertrouwen intact houdt 👇 Bewaar voor je volgende 1-op-1.",
    hashtags: ["#leadership", "#feedback", "#management", "#maincharactermethod"],
    cta: "Save for your next 1:1",
    storyIdeas: ["Poll: dread giving feedback?", "SBI carousel", "Ask for a scenario"],
    gradient: GR.steel, emoji: "🤝", reviews: [],
  },
  {
    date: d(23), goal: "Storytelling — signature story", purpose: "Shares & authority",
    primaryPlatform: "youtube", time: "16:00", status: statusFor(23),
    reel: {
      topic: "Every leader needs one signature story. Here's how to build it.",
      hook: "If you had 60 seconds to be unforgettable, what's your story?",
      script: "Explain the signature story: a real moment + a universal lesson. Template on screen. End: 'One story, told well, beats ten facts.'",
      bRoll: ["Coach telling a story", "Audience captivated", "Fireside tone lighting"],
      closingCta: "Full workshop covers this — link below.",
      thumbnailConcept: "Coach mid-story, warm light, text: 'SIGNATURE STORY'",
      editorNotes: "Cinematic, warm. Let the storytelling shine.",
    },
    captions: caps(
      "Every memorable leader has one signature story. A real moment + a universal lesson = unforgettable. Here's the template to build yours 👇",
      "Facts inform; stories are remembered and repeated. Build one signature story — a specific personal moment that carries a universal lesson — and you'll have an asset you use in keynotes, interviews and pitches for years.",
      "every leader needs ONE signature story 🔥 here's the template"
    ),
    captionNl: "Elke onvergetelijke leider heeft één signature story. Een echt moment + een universele les = onvergetelijk. Hier het sjabloon om die van jou te bouwen 👇",
    hashtags: ["#storytelling", "#leadership", "#keynote", "#maincharactermethod"],
    cta: "Learn it in the workshop",
    storyIdeas: ["Ask: what's your moment?", "Story template carousel", "Clip of a signature story"],
    gradient: GR.ink, emoji: "🔥", reviews: [{ id: "jr3", author: "u_muz", at: "2026-07-22T10:00:00", status: "approved", comment: "Beautiful. Approved for scheduling." }],
  },
  {
    date: d(24), goal: "Confidence — imposter syndrome", purpose: "Saves & DMs",
    primaryPlatform: "instagram", time: "18:00", status: statusFor(24),
    reel: {
      topic: "Imposter syndrome before you speak? Read this.",
      hook: "The room doesn't need you to be the expert. It needs you to be useful.",
      script: "Reframe: you don't need to know everything, just one step more than the audience on this topic. End: 'Be useful, not perfect.'",
      bRoll: ["Speaker backstage doubt", "Reassuring nod", "Confident walk-on"],
      closingCta: "DM 'READY' if you needed this today.",
      thumbnailConcept: "Text: 'YOU'RE MORE READY THAN YOU THINK'",
      editorNotes: "Gentle, reassuring tone. Soft audio.",
    },
    captions: caps(
      "Imposter syndrome before a talk? You don't have to be THE expert — just one step ahead of the room, and generous with what you know. Be useful, not perfect 🤍 DM 'READY' if you needed this.",
      "Imposter syndrome assumes the audience needs perfection. They don't — they need someone one step ahead who's willing to share. Shift the goal from 'prove I'm smart' to 'be genuinely useful' and the pressure drops.",
      "imposter syndrome before speaking? 🤍 be useful, not perfect"
    ),
    captionNl: "Imposter syndrome voor een talk? Je hoeft niet DÉ expert te zijn — gewoon één stap voor op de zaal, en gul met wat je weet. Wees nuttig, niet perfect 🤍 DM 'READY' als je dit nodig had.",
    hashtags: ["#impostersyndrome", "#confidence", "#mindset", "#maincharactermethod"],
    cta: "DM 'READY'",
    storyIdeas: ["Q&A: imposter moments", "Reassurance quote card", "Booking link"],
    gradient: GR.teal, emoji: "🤍", reviews: [],
  },
  {
    date: d(25), goal: "Educational — pacing & pauses", purpose: "Saves & shares",
    primaryPlatform: "tiktok", time: "19:00", status: statusFor(25),
    reel: {
      topic: "The pause is the most underused power move in speaking",
      hook: "Silence feels like 3 hours to you and 2 seconds to them.",
      script: "Demo a line with no pause vs with a deliberate pause. Explain how pauses signal control + let ideas land. End: 'Say less. Pause more.'",
      bRoll: ["Speaker holding a pause", "Audience anticipation", "Clock/again subtle"],
      closingCta: "Save + try one real pause tomorrow.",
      thumbnailConcept: "Big text: 'THE POWER OF THE PAUSE'",
      editorNotes: "Use actual silence in the edit to demonstrate. Bold.",
    },
    captions: caps(
      "The pause feels like forever to you — and like confidence to them. Say less, pause more, and let your best lines land 👇 Save it.",
      "Nervous speakers rush; commanding speakers pause. Silence signals control and gives your key ideas room to land. The pause that feels like an eternity to you reads as poise to your audience. Practice one deliberate pause tomorrow.",
      "the pause is a power move 🤫 silence feels longer to you than them"
    ),
    captionNl: "De pauze voelt eindeloos voor jou — en als zelfvertrouwen voor hen. Zeg minder, pauzeer meer, en laat je beste zinnen landen 👇 Bewaren.",
    hashtags: ["#pausepower", "#publicspeaking", "#confidence", "#maincharactermethod"],
    cta: "Save + try one pause",
    storyIdeas: ["Silent pause demo", "Poll: scared of silence?", "Tip series"],
    gradient: GR.slate, emoji: "🤫", reviews: [],
  },
  {
    date: d(26), goal: "Promotional — workshop reminder", purpose: "Promote workshop / traffic",
    primaryPlatform: "instagram", time: "18:30", status: statusFor(26),
    reel: {
      topic: "Last seats: Main Character Speaking Workshop",
      hook: "This is your sign to stop avoiding the mic.",
      script: "Urgency montage: past breakthroughs, testimonials, room energy. VO on last seats + what changes after one day. End card with CTA.",
      bRoll: ["Workshop highlights", "Testimonial faces", "Seats filling graphic"],
      closingCta: "Last seats — link in bio.",
      thumbnailConcept: "Text: 'LAST SEATS' over workshop room",
      editorNotes: "Urgent but classy. Clear end card with date + CTA.",
    },
    captions: caps(
      "This is your sign 🎤 Final seats for the Main Character Speaking Workshop. One day to go from avoiding the mic to owning the room. Link in bio before it's full.",
      "Final call: a handful of seats remain for the next Main Character Speaking Workshop. One focused day on presence, structure and delivery for leaders who present often. Details in the comments.",
      "last seats for the workshop 🎤 this is your sign"
    ),
    captionNl: "Dit is je teken 🎤 Laatste plekken voor de Main Character Speaking Workshop. Eén dag om van de mic vermijden naar de zaal pakken te gaan. Link in bio voordat het vol is.",
    hashtags: ["#workshop", "#lastcall", "#publicspeaking", "#maincharactermethod"],
    cta: "Grab the last seats",
    storyIdeas: ["Countdown sticker", "Seats-left graphic", "Testimonial repost"],
    gradient: GR.sky, emoji: "🎟️", reviews: [],
  },
  {
    date: d(27), goal: "Community — myth busting", purpose: "Comments & saves",
    primaryPlatform: "instagram", time: "12:30", status: statusFor(27),
    reel: {
      topic: "3 public speaking 'rules' you should ignore",
      hook: "‘Picture the audience naked’ is terrible advice.",
      script: "Bust 3 myths (imagine them naked, never use notes, memorise word-for-word). Give the better version of each. End: 'Do this instead.'",
      bRoll: ["Playful myth graphics", "Coach shaking head", "Thumbs up alternative"],
      closingCta: "Comment the worst advice you've heard.",
      thumbnailConcept: "Red X over 3 'rules'",
      editorNotes: "Fun, opinionated. On-screen myth vs truth.",
    },
    captions: caps(
      "‘Imagine them naked.’ ‘Never use notes.’ ‘Memorise every word.’ All terrible. Here's what to do instead 👇 What's the worst speaking advice you've been given?",
      "Three pieces of public-speaking advice that need to retire — and what actually works instead. Notes are fine (structure them). Don't memorise word-for-word (memorise the map). And please, don't imagine anyone naked.",
      "public speaking 'rules' that are actually terrible 🚫 do this instead"
    ),
    captionNl: "‘Stel je ze naakt voor.’ ‘Gebruik nooit notities.’ ‘Leer alles woord voor woord.’ Allemaal slecht. Dit doe je in plaats daarvan 👇 Wat is het slechtste spreekadvies dat jij kreeg?",
    hashtags: ["#mythbusting", "#publicspeaking", "#speakingtips", "#maincharactermethod"],
    cta: "Comment the worst advice",
    storyIdeas: ["Poll each myth true/false", "Repost funny replies", "Myth carousel"],
    gradient: GR.blue, emoji: "🚫", reviews: [],
  },
  {
    date: d(28), goal: "Mindset — visibility", purpose: "Shares & profile visits",
    primaryPlatform: "tiktok", time: "19:30", status: statusFor(28),
    reel: {
      topic: "Being seen is a skill, not a personality type",
      hook: "You're not 'too shy to be visible'. You're just untrained.",
      script: "Reframe visibility as trainable. Small reps: speak first in one meeting, post one opinion, record one reel. End: 'Visibility is built in reps.'",
      bRoll: ["Person stepping into light", "Posting on phone", "Speaking up in group"],
      closingCta: "Share with someone hiding their brilliance.",
      thumbnailConcept: "Silhouette stepping into a spotlight",
      editorNotes: "Empowering, cinematic. Brand end card.",
    },
    captions: caps(
      "You're not 'too shy' to be visible — you're just untrained. Visibility is a muscle: speak first once, post one opinion, record one reel. Reps build presence 🤍 Share with someone hiding their brilliance.",
      "Visibility isn't a personality trait reserved for extroverts — it's a trainable skill. Start with small reps: contribute first in one meeting this week, publish one genuine opinion, record one video. Presence compounds.",
      "you're not too shy, you're untrained 🤍 visibility is reps"
    ),
    captionNl: "Je bent niet 'te verlegen' om zichtbaar te zijn — je bent gewoon ongetraind. Zichtbaarheid is een spier: spreek één keer als eerste, post één mening, neem één reel op. Reps bouwen presence 🤍 Deel met iemand die z'n talent verstopt.",
    hashtags: ["#visibility", "#confidence", "#mindset", "#maincharactermethod"],
    cta: "Share this",
    storyIdeas: ["Challenge: speak first this week", "Poll: hide your brilliance?", "Mantra card"],
    gradient: GR.ink, emoji: "🔦", reviews: [],
  },
  {
    date: d(29), goal: "Educational — first 30 seconds", purpose: "Saves",
    primaryPlatform: "instagram", time: "18:00", status: statusFor(29),
    reel: {
      topic: "Script your first 30 seconds. Improvise the rest.",
      hook: "Never wing your opening. Ever.",
      script: "Why the first 30s should be word-perfect while the body stays flexible. Show a scripted open flowing into natural delivery. End: 'Script the launch, fly the rest.'",
      bRoll: ["Note card with opener", "Confident walk-on", "Natural mid-talk gesture"],
      closingCta: "Save before your next talk.",
      thumbnailConcept: "Stopwatch at 0:30, text: 'SCRIPT THE OPEN'",
      editorNotes: "Clear contrast: scripted open → free body. Snappy.",
    },
    captions: caps(
      "Wing the body if you must — but never wing the opening. Script your first 30 seconds word-for-word so nerves can't touch your launch 👇 Save it.",
      "Improvisation is fine once you're airborne — but takeoff is where talks crash. Script the first 30 seconds word-for-word; it's the moment nerves peak and first impressions lock in. Script the launch, fly the rest.",
      "script your first 30 seconds, wing the rest ⏱️ never wing the open"
    ),
    captionNl: "Improviseer desnoods de kern — maar nooit de opening. Schrijf je eerste 30 seconden woord voor woord uit zodat zenuwen je start niet raken 👇 Bewaren.",
    hashtags: ["#publicspeaking", "#openingline", "#confidence", "#maincharactermethod"],
    cta: "Save before your next talk",
    storyIdeas: ["Show a real note card", "Poll: script or wing it?", "Opener challenge"],
    gradient: GR.slate, emoji: "⏱️", reviews: [],
  },
  {
    date: d(30), goal: "Testimonial — leader", purpose: "Trust & DMs",
    primaryPlatform: "linkedin", time: "08:30", status: statusFor(30),
    reel: {
      topic: "A CEO who finally sounds like a leader on stage",
      hook: "He had the title. He didn't have the presence.",
      script: "Client story: technically brilliant CEO, flat delivery → commanding town-hall presence. Clip + result. End with the shift.",
      bRoll: ["CEO town hall clip", "Team engaged", "Coaching session"],
      closingCta: "DM 'PRESENCE' to work together.",
      thumbnailConcept: "CEO mid-townhall, text: 'TITLE ≠ PRESENCE'",
      editorNotes: "Professional, credible. Let the result speak.",
    },
    captions: caps(
      "He had the title but not the presence. After the work, his town halls went from ignored to standing-room. Title gets you the stage — presence earns the room 🤍 DM 'PRESENCE'.",
      "A leadership communication case study: a brilliant CEO whose delivery undercut his authority. We rebuilt his openings, pacing and story — and his all-hands went from tuned-out to standing-room. Title grants the stage; presence earns the room.",
      "he had the title, not the presence 🤍 here's the shift"
    ),
    captionNl: "Hij had de titel maar niet de presence. Na het werk gingen z'n town halls van genegeerd naar uitverkocht. Een titel geeft je het podium — presence verdient de zaal 🤍 DM 'PRESENCE'.",
    hashtags: ["#testimonial", "#leadership", "#executivepresence", "#maincharactermethod"],
    cta: "DM 'PRESENCE'",
    storyIdeas: ["Client clip", "Result quote card", "Booking link"],
    gradient: GR.steel, emoji: "🏅", reviews: [],
  },
  {
    date: d(31), goal: "Month close — motivation + tease August", purpose: "Follows & shares",
    primaryPlatform: "instagram", time: "18:00", status: statusFor(31),
    reel: {
      topic: "One month of showing up — your turn in August",
      hook: "31 days. 31 reels. Zero of them felt 'ready'.",
      script: "Recap montage of the month's best moments. VO: none felt ready, all shipped. Invite viewers to start their own visibility challenge in August. End: 'Your stage is waiting.'",
      bRoll: ["Best clips of July", "Coach to camera", "Sunset city walk"],
      closingCta: "Follow — August goes deeper. Your turn.",
      thumbnailConcept: "‘31 DAYS’ over a montage grid",
      editorNotes: "Celebratory recap. Strong music build. Tease August theme.",
    },
    captions: caps(
      "31 days. 31 reels. Not one of them felt 'ready' — we shipped anyway. That's the whole method 🤍 August goes deeper. Your stage is waiting. Follow so you don't miss it.",
      "A month of daily reps on presence, structure and story — proof that consistency beats readiness every time. Thank you for watching, saving and sharing. August we go deeper into leadership communication. Your stage is waiting.",
      "31 days, 31 reels, none felt ready 🤍 your turn in august"
    ),
    captionNl: "31 dagen. 31 reels. Niet één voelde 'klaar' — we postten toch. Dat is de hele methode 🤍 Augustus gaat dieper. Jouw podium wacht. Volg zodat je niks mist.",
    hashtags: ["#maincharactermethod", "#consistency", "#publicspeaking", "#confidence"],
    cta: "Follow for August",
    storyIdeas: ["Month recap poll", "Best-of highlights", "August teaser"],
    gradient: GR.blue, emoji: "🎉", reviews: [],
  },
];
