import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const categories = [
  // India-specific Categories
  {
    name: 'Indian History',
    slug: 'indian-history',
    description: 'Trivia on Ancient, Medieval, and Modern Indian History, including the Indian Independence Movement.',
  },
  {
    name: 'Indian Geography',
    slug: 'indian-geography',
    description: "Questions about India's physical features, rivers, climate, states, union territories, and wildlife.",
  },
  {
    name: 'Indian Polity & Constitution',
    slug: 'indian-polity',
    description: 'Trivia on the Constitution of India, government structure, parliament, judiciary, and civic laws.',
  },
  {
    name: 'Indian Economy',
    slug: 'indian-economy',
    description: 'Questions regarding the Indian economic system, budget, agriculture, industries, and banking.',
  },
  {
    name: 'Indian Art & Culture',
    slug: 'indian-culture',
    description: 'Trivia covering Indian classical dances, music, folklore, major festivals, heritage sites, and architecture.',
  },
  {
    name: 'Indian Cinema',
    slug: 'indian-cinema',
    description: 'Questions about Indian cinema history, famous actors, directors, landmark movies, and regional film industries.',
  },
  {
    name: 'Indian Sports',
    slug: 'indian-sports',
    description: 'Trivia on sports in India, focusing on Cricket (IPL, ICC stats), Hockey, Kabaddi, and Olympic achievements.',
  },
  {
    name: 'Indian Current Affairs',
    slug: 'indian-current-affairs',
    description: 'Recent news, events, government schemes, awards, and developments in India.',
  },

  // International/Global Categories
  {
    name: 'World History',
    slug: 'world-history',
    description: 'Trivia on major global historical events, ancient civilizations, world wars, revolutions, and world leaders.',
  },
  {
    name: 'World Geography',
    slug: 'world-geography',
    description: 'Questions about continents, countries, capitals, oceans, major rivers, mountains, and global landmarks.',
  },
  {
    name: 'World Literature & Art',
    slug: 'world-literature',
    description: 'Trivia on classical and modern literature, poetry, famous authors, masterpieces of art, and movements.',
  },
  {
    name: 'Global Pop Culture & Entertainment',
    slug: 'global-pop-culture',
    description: 'Questions about Hollywood, global music, television series, gaming, internet culture, and celebrities.',
  },
  {
    name: 'Science & Technology',
    slug: 'science-tech',
    description: 'General science questions covering physics, chemistry, biology, medicine, space exploration, and computer science.',
  },
  {
    name: 'International Sports',
    slug: 'international-sports',
    description: 'Trivia on global sporting events like the Olympics, FIFA World Cup, Tennis Grand Slams, F1, and world-class athletes.',
  },
  {
    name: 'International Relations & Organizations',
    slug: 'international-relations',
    description: 'Questions on global geopolitics, international treaties, and alliances (UN, WHO, WTO, NATO, etc.).',
  },
  {
    name: 'Global Economy & Business',
    slug: 'global-economy',
    description: 'Trivia on global financial markets, multinational corporations, famous entrepreneurs, and economic concepts.',
  },

  // Software & Technology Categories
  {
    name: 'Computer Science & Algorithms',
    slug: 'algorithms-data-structures',
    description: 'Trivia on data structures, algorithms, computational complexity (Big O), and computer science fundamentals.',
  },
  {
    name: 'Programming Languages & Syntax',
    slug: 'programming-languages',
    description: 'Questions on the history, paradigms, syntax, and features of languages like JS/TS, Python, C++, Java, and Go.',
  },
  {
    name: 'Software Engineering & Architecture',
    slug: 'software-engineering',
    description: 'Trivia on software development methodologies (Agile, DevOps), design patterns, system design, testing, and architecture.',
  },
  {
    name: 'Web & Mobile Development',
    slug: 'web-mobile-development',
    description: 'Questions covering frontend/backend frameworks, APIs, databases, CSS/HTML, networking, and mobile OS (Android/iOS).',
  },
  {
    name: 'Cloud Computing & Infrastructure',
    slug: 'cloud-infrastructure',
    description: 'Trivia on cloud platforms (AWS, GCP, Azure), containers (Docker, Kubernetes), CI/CD, and server administration.',
  },
  {
    name: 'Databases & Systems',
    slug: 'databases-systems',
    description: 'Questions on relational vs. non-relational databases, SQL, caching, operating systems, and computer networking.',
  },
];

async function main() {
  console.log('🌱 Seeding categories...');

  for (const category of categories) {
    await prisma.category.upsert({
      where: { slug: category.slug },
      update: {
        name: category.name,
        description: category.description,
      },
      create: category,
    });
    console.log(`✅ Category upserted: ${category.name} (${category.slug})`);
  }

  console.log('✨ Categories seeding complete.');
}

main()
  .catch((e) => {
    console.error('❌ Categories seeding failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
