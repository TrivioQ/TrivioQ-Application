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
    name: 'Indian Politics & Constitution',
    slug: 'indian-politics',
    description: 'Trivia on the Constitution of India, government structure, parliament, judiciary, and civic laws.',
  },
  {
    name: 'Indian Economy',
    slug: 'indian-economy',
    description: 'Questions regarding the Indian economic system, budget, agriculture, industries, and banking.',
  },
  {
    name: 'Indian Art & Culture',
    slug: 'indian-art-culture',
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
    name: 'Indian Literature',
    slug: 'indian-literature',
    description: 'Trivia on Indian epics, classical Sanskrit works, regional literature, and modern Indian authors.',
  },
  {
    name: 'Indian Current Affairs',
    slug: 'indian-current-affairs',
    description: 'Recent news, events, government schemes, awards, and developments in India.',
  },

  // Global & Geopolitics
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
    name: 'International Relations & Organizations',
    slug: 'international-relations',
    description: 'Questions on global geopolitics, international treaties, and alliances (UN, WHO, WTO, NATO, etc.).',
  },
  {
    name: 'Global Politics',
    slug: 'global-politics',
    description: 'Trivia on global political systems, foreign policy, governments, elections, and political ideologies.',
  },
  {
    name: 'Global Economy & Business',
    slug: 'global-economy',
    description: 'Trivia on global financial markets, multinational corporations, famous entrepreneurs, and economic concepts.',
  },

  // Culture, Art & Literature (Global)
  {
    name: 'Global Art & Culture',
    slug: 'global-art-culture',
    description: 'Trivia covering global art movements, architecture, classical music, traditions, and cultural heritage.',
  },
  {
    name: 'Global Literature',
    slug: 'global-literature',
    description: 'Questions on classical and modern world literature, famous authors, poetry, novels, and plays.',
  },
  {
    name: 'Global Pop Culture & Entertainment',
    slug: 'global-pop-culture',
    description: 'Questions about Hollywood, global music, television series, gaming, internet culture, and celebrities.',
  },

  // Science, Nature & Space
  {
    name: 'Animals & Wildlife',
    slug: 'animals-wildlife',
    description: 'Trivia on zoology, animal behavior, habitats, terrestrial wildlife, birds, and insects.',
  },
  {
    name: 'Dinosaurs & Prehistoric Life',
    slug: 'dinosaurs-prehistoric-life',
    description: 'Questions about dinosaurs, paleontology, prehistoric eras, and extinct species.',
  },
  {
    name: 'Space & Astronomy',
    slug: 'space-astronomy',
    description: 'Trivia on astronomy, planets, stars, galaxies, cosmology, and space exploration.',
  },
  {
    name: 'Life Sciences & Medicine',
    slug: 'life-sciences-medicine',
    description: 'Questions about human anatomy, organ systems, biological processes, health, genetics, and biomedical technology.',
  },
  {
    name: 'Environmental & Earth Sciences',
    slug: 'environmental-earth-sciences',
    description: 'Questions on ecology, conservation, earth science, climate change, and geological formations.',
  },
  {
    name: 'Plants & Forestry',
    slug: 'plants-forestry',
    description: 'Trivia on botany, plant species, forestry, flowers, agriculture, and plant ecology.',
  },
  {
    name: 'Marine Biology',
    slug: 'marine-biology',
    description: 'Trivia on ocean ecosystems, marine organisms, coral reefs, and marine life behavior.',
  },
  {
    name: 'Zoology & Classification',
    slug: 'zoology-classification',
    description: 'Questions about the scientific classification of living organisms (taxonomy), major animal phyla (vertebrates, invertebrates, arthropods, mollusks, cnidaria, sponges), and the principles used to group species by shared characteristics.',
  },
  {
    name: 'Evolution & Natural History',
    slug: 'evolution-natural-history',
    description: 'Questions about biological evolution, natural selection, the origin of life, mass extinction events, the rise of major animal groups, and the deep history of life on Earth.',
  },
  {
    name: 'Nautical History & Exploration',
    slug: 'nautical-history-exploration',
    description: 'Trivia on maritime history, famous voyages, explorers, shipwrecks, and navigation.',
  },
  {
    name: 'Food Science & Nutrition',
    slug: 'food-science',
    description: 'Trivia on the chemistry, microbiology, nutrition, processing, and preservation of food.',
  },
  {
    name: 'Physical Sciences',
    slug: 'physical-sciences',
    description: 'Trivia covering physics, chemistry, basic geology, and physical science principles.',
  },
  {
    name: 'Inventions & Discoveries',
    slug: 'inventions-discoveries',
    description: 'Questions on the history of science, famous inventors, groundbreaking discoveries, and patents.',
  },
  {
    name: 'Mathematics & Logic',
    slug: 'mathematics-logic',
    description: 'Trivia on mathematical concepts, famous mathematicians, probability, geometry, and logic puzzles.',
  },
  {
    name: 'General Science & Tech',
    slug: 'science-tech',
    description: 'General science questions covering basic physics, chemistry, biology, medicine, space exploration, and computer science.',
  },

  // Mythology, History & Religion
  {
    name: 'Indian Mythology',
    slug: 'indian-mythology',
    description: 'Trivia on Hindu, Buddhist, Jain, and other mythology, legends, and epics of India.',
  },
  {
    name: 'European Mythology',
    slug: 'european-mythology',
    description: 'Questions on Greek, Roman, Norse, Celtic, and other European mythological traditions.',
  },
  {
    name: 'American Mythology',
    slug: 'american-mythology',
    description: 'Trivia on Native American, Mesoamerican, South American, and folklore traditions of the Americas.',
  },
  {
    name: 'African Mythology',
    slug: 'african-mythology',
    description: 'Questions on various folklore, deities, and myths from diverse African cultures and regions.',
  },
  {
    name: 'Asian Mythology',
    slug: 'asian-mythology',
    description: 'Trivia on Chinese, Japanese, Korean, Southeast Asian, and other regional Asian myths and folklore.',
  },
  {
    name: 'Middle Eastern Mythology',
    slug: 'middle-eastern-mythology',
    description: 'Questions on Mesopotamian, Egyptian, Persian, Arabian, and other Middle Eastern myths.',
  },
  {
    name: 'Religions & Beliefs',
    slug: 'religions-beliefs',
    description: 'Trivia on major world religions, their histories, sacred texts, beliefs, and practices.',
  },

  // General & Personal
  {
    name: 'Personal Finance',
    slug: 'personal-finance',
    description: 'Questions about budgeting, saving, investing, credit, taxes, and smart money management.',
  },

  // Expanded General Categories
  {
    name: 'Philosophy & Psychology',
    slug: 'philosophy-psychology',
    description: 'Trivia on famous philosophers, schools of thought, ethics, cognitive biases, psychological theories, and experiments.',
  },
  {
    name: 'Gaming & Esports',
    slug: 'gaming-esports',
    description: 'Questions on video game history, console wars, tabletop board games, role-playing games (RPGs), and competitive esports.',
  },
  {
    name: 'Languages & Linguistics',
    slug: 'languages-linguistics',
    description: 'Trivia on word origins (etymology), language families, writing systems, grammar, and famous idioms.',
  },
  {
    name: 'Law & True Crime',
    slug: 'law-true-crime',
    description: 'Questions on landmark legal cases, famous trials, criminology, history of law enforcement, and true crime cases.',
  },
  {
    name: 'Fashion & Design',
    slug: 'fashion-design',
    description: 'Trivia on the history of fashion, iconic designers, design movements, styling, and haute couture.',
  },
  {
    name: 'Automotive & Transportation',
    slug: 'automotive-transportation',
    description: 'Questions about cars, aviation history, trains, ships, automotive engineering, and transportation history.',
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
