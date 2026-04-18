export interface SeedQuestion {
  question: string
  options: string[]
  multiSelect: boolean
}

export const SEED_QUESTIONS: SeedQuestion[] = [
  {
    question: 'What genres do you reach for when you want to relax?',
    options: ['Comedy & lighthearted', 'Drama & emotional', 'Sci-fi & fantasy', 'Thriller & suspense'],
    multiSelect: true,
  },
  {
    question: 'Do you prefer movies or TV shows?',
    options: ['Movies - prefer completing a story in one sitting', 'TV shows - love ongoing narratives', 'No preference', 'Depends on my mood'],
    multiSelect: false,
  },
  {
    question: 'How do you feel about foreign films and shows with subtitles?',
    options: ['Love them, bring the subtitles on', 'Prefer dubbed versions', 'Depends on the quality of the story', 'Rarely watch them'],
    multiSelect: false,
  },
  {
    question: 'What kind of pacing do you prefer?',
    options: ['Fast-paced action and excitement', 'Slow-burn with deep character development', 'Mixed, depends on the story', 'Fast at start then slower'],
    multiSelect: false,
  },
  {
    question: 'How much time are you willing to invest in a show before deciding to drop it?',
    options: ['One episode - hook me immediately', '2-3 episodes', 'First season', 'Depends on the premise and cast'],
    multiSelect: true,
  },
]
