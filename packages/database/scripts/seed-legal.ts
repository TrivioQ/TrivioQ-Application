import { PrismaClient } from '@prisma/client';
import * as fs from 'fs';
import * as path from 'path';

const prisma = new PrismaClient();

const DOCS_DIR = path.resolve(__dirname, '../../../docs/legal');

const documents = [
  {
    slug: 'terms',
    title: 'Terms of Service',
    file: 'terms.md',
    version: '1.0',
  },
  {
    slug: 'privacy',
    title: 'Privacy Policy',
    file: 'privacy.md',
    version: '1.0',
  },
];

async function main() {
  for (const doc of documents) {
    const filePath = path.join(DOCS_DIR, doc.file);
    const content = fs.readFileSync(filePath, 'utf-8');

    await prisma.legalDocument.upsert({
      where: { slug: doc.slug },
      update: { title: doc.title, content, version: doc.version },
      create: { slug: doc.slug, title: doc.title, content, version: doc.version },
    });

    console.log(`✓ Upserted ${doc.slug}`);
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
