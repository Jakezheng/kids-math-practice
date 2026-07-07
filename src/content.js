export const MODULE_ORDER = [
  "phonics",
  "sightWords",
  "reading",
  "writing",
  "math",
];

export const DEFAULT_PARENT_SETTINGS = {
  dailyTaskCount: 5,
  difficultyPreference: "normal",
  password: "2468",
  moduleToggles: {
    phonics: true,
    sightWords: true,
    reading: true,
    writing: true,
    math: true,
  },
};

export const DEFAULT_CHILDREN = [
  {
    id: "kid-k",
    name: "K",
    grade: "Kindergarten",
    targetDifficulty: "easier",
    enabledModules: [...MODULE_ORDER],
  },
  {
    id: "kid-g1",
    name: "Grade 1",
    grade: "Grade 1",
    targetDifficulty: "normal",
    enabledModules: [...MODULE_ORDER],
  },
];

const phonicsBank = {
  "kid-k": [
    {
      format: "drag-match",
      title: "Letter Sounds",
      prompt: "Drag each beginning letter to the matching word.",
      draggables: ["b", "m", "s"],
      dropzones: [
        { id: "ball", label: "ball", answer: "b" },
        { id: "moon", label: "moon", answer: "m" },
        { id: "sun", label: "sun", answer: "s" },
      ],
      difficulty: "easier",
      weaknessTags: ["letter sounds"],
    },
    {
      format: "multiple-choice",
      title: "Short Vowels",
      prompt: "Which word has the short a sound?",
      options: ["cat", "bike", "cube"],
      answer: "cat",
      difficulty: "normal",
      weaknessTags: ["short vowels"],
    },
  ],
  "kid-g1": [
    {
      format: "multiple-choice",
      title: "CVC Blend",
      prompt: "Which word matches /m-a-p/?",
      options: ["map", "mop", "man"],
      answer: "map",
      difficulty: "normal",
      weaknessTags: ["cvc blending"],
    },
    {
      format: "multiple-choice",
      title: "Digraphs",
      prompt: "Choose the word that starts with sh.",
      options: ["shop", "chip", "thin"],
      answer: "shop",
      difficulty: "challenge",
      weaknessTags: ["digraphs"],
    },
  ],
};

const sightWordsBank = {
  "kid-k": [
    {
      format: "multiple-choice",
      title: "Sight Word Match",
      prompt: "Tap the word: said",
      options: ["said", "play", "come"],
      answer: "said",
      difficulty: "easier",
      weaknessTags: ["sight words"],
    },
    {
      format: "multiple-choice",
      title: "Sight Word Match",
      prompt: "Tap the word: little",
      options: ["little", "yellow", "jump"],
      answer: "little",
      difficulty: "normal",
      weaknessTags: ["sight words"],
    },
  ],
  "kid-g1": [
    {
      format: "multiple-choice",
      title: "Sight Word Match",
      prompt: "Tap the word: because",
      options: ["before", "because", "between"],
      answer: "because",
      difficulty: "normal",
      weaknessTags: ["sight words"],
    },
    {
      format: "multiple-choice",
      title: "Fill the Blank",
      prompt: "I will ___ my book back tomorrow.",
      options: ["bring", "brung", "brings"],
      answer: "bring",
      difficulty: "challenge",
      weaknessTags: ["sight words"],
    },
  ],
};

const readingBank = {
  "kid-k": [
    {
      format: "recording",
      title: "Read Aloud",
      prompt: "Read this sentence out loud: Sam can hop.",
      targetText: "Sam can hop.",
      difficulty: "easier",
      weaknessTags: ["reading fluency"],
    },
    {
      format: "recording",
      title: "Read Aloud",
      prompt: "Read this sentence out loud: The red bug is big.",
      targetText: "The red bug is big.",
      difficulty: "normal",
      weaknessTags: ["reading fluency"],
    },
  ],
  "kid-g1": [
    {
      format: "recording",
      title: "Read Aloud",
      prompt: "Read this sentence out loud: The small fish swam past the rock.",
      targetText: "The small fish swam past the rock.",
      difficulty: "normal",
      weaknessTags: ["reading fluency"],
    },
    {
      format: "recording",
      title: "Read Aloud",
      prompt: "Read this sentence out loud: I packed my lunch before the bus arrived.",
      targetText: "I packed my lunch before the bus arrived.",
      difficulty: "challenge",
      weaknessTags: ["reading fluency"],
    },
  ],
};

const writingBank = {
  "kid-k": [
    {
      format: "offline-complete",
      title: "Copywork",
      prompt: "Copy on paper: I can jump.",
      targetText: "I can jump.",
      difficulty: "easier",
      weaknessTags: ["copywork"],
    },
    {
      format: "offline-complete",
      title: "Upper and Lowercase",
      prompt: "Write these pairs on paper: Aa Bb Cc",
      targetText: "Aa Bb Cc",
      difficulty: "normal",
      weaknessTags: ["handwriting"],
    },
  ],
  "kid-g1": [
    {
      format: "offline-complete",
      title: "Copywork",
      prompt: "Copy on paper: The frog sat on the flat rock.",
      targetText: "The frog sat on the flat rock.",
      difficulty: "normal",
      weaknessTags: ["copywork"],
    },
    {
      format: "offline-complete",
      title: "Sentence Pattern",
      prompt: "Write on paper: I can see the ___ in the yard.",
      targetText: "I can see the ___ in the yard.",
      difficulty: "challenge",
      weaknessTags: ["sentence building"],
    },
  ],
};

const mathBank = {
  "kid-k": [
    {
      format: "multiple-choice",
      title: "Number Sense",
      prompt: "Which number is bigger?",
      options: ["6", "4"],
      answer: "6",
      difficulty: "easier",
      weaknessTags: ["number sense"],
    },
    {
      format: "multiple-choice",
      title: "Shapes",
      prompt: "Which shape has 3 sides?",
      options: ["triangle", "square", "circle"],
      answer: "triangle",
      difficulty: "normal",
      weaknessTags: ["shapes"],
    },
  ],
  "kid-g1": [
    {
      format: "multiple-choice",
      title: "Number Bonds",
      prompt: "What makes 10 with 4?",
      options: ["5", "6", "7"],
      answer: "6",
      difficulty: "normal",
      weaknessTags: ["number bonds"],
    },
    {
      format: "multiple-choice",
      title: "Add and Compare",
      prompt: "Which is greater: 7 + 2 or 6 + 1?",
      options: ["7 + 2", "6 + 1"],
      answer: "7 + 2",
      difficulty: "challenge",
      weaknessTags: ["comparison"],
    },
  ],
};

export const MODULE_BANKS = {
  phonics: phonicsBank,
  sightWords: sightWordsBank,
  reading: readingBank,
  writing: writingBank,
  math: mathBank,
};
