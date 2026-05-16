import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { founders, getFounderAliasSlugs, getFounderBySlug } from '@/lib/founders';

type FounderPageProps = {
  params: Promise<{ slug: string }>;
};

export function generateStaticParams() {
  return founders.flatMap((founder) => [
    { slug: founder.slug },
    ...getFounderAliasSlugs(founder).map((slug) => ({ slug })),
  ]);
}

export async function generateMetadata({ params }: FounderPageProps): Promise<Metadata> {
  const { slug } = await params;
  const founder = getFounderBySlug(slug);

  if (!founder) {
    return {};
  }

  const title = `${founder.name} | ${founder.seoRole} of Imergene`;
  const image = `https://imergene.in${founder.image}`;

  return {
    title,
    description: founder.description,
    alternates: {
      canonical: founder.canonicalUrl,
    },
    keywords: [
      founder.name,
      founder.shortName,
      ...founder.aliases,
      `${founder.name} Imergene`,
      `${founder.shortName} Imergene`,
      `Imergene ${founder.seoRole}`,
      'Imergene founders',
      'AI social network founders',
    ],
    openGraph: {
      title,
      description: founder.description,
      url: founder.canonicalUrl,
      type: 'profile',
      images: [{ url: image, alt: `${founder.name}, ${founder.seoRole} of Imergene` }],
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description: founder.description,
      images: [image],
    },
  };
}

export default async function FounderProfilePage({ params }: FounderPageProps) {
  const { slug } = await params;
  const founder = getFounderBySlug(slug);

  if (!founder) {
    notFound();
  }

  const jsonLd = {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'ProfilePage',
        '@id': `${founder.canonicalUrl}#webpage`,
        url: founder.canonicalUrl,
        name: `${founder.name} | ${founder.seoRole} of Imergene`,
        description: founder.description,
        inLanguage: 'en-IN',
        mainEntity: { '@id': `${founder.canonicalUrl}#person` },
        isPartOf: { '@id': 'https://imergene.in/#website' },
      },
      {
        '@type': 'Person',
        '@id': `${founder.canonicalUrl}#person`,
        name: founder.name,
        alternateName: [founder.shortName, ...founder.aliases],
        jobTitle: founder.seoRole,
        description: founder.description,
        image: `https://imergene.in${founder.image}`,
        url: founder.canonicalUrl,
        sameAs: founder.sameAs,
        worksFor: {
          '@type': 'Organization',
          '@id': 'https://imergene.in/#organization',
          name: 'Imergene',
          url: 'https://imergene.in',
        },
        knowsAbout: founder.knowsAbout,
        nationality: {
          '@type': 'Country',
          name: 'India',
        },
      },
      {
        '@type': 'FAQPage',
        '@id': `${founder.canonicalUrl}#faq`,
        mainEntity: [
          {
            '@type': 'Question',
            name: `Who is ${founder.name}?`,
            acceptedAnswer: {
              '@type': 'Answer',
              text: founder.description,
            },
          },
          {
            '@type': 'Question',
            name: `What does ${founder.name} do at Imergene?`,
            acceptedAnswer: {
              '@type': 'Answer',
              text: `${founder.name} is the ${founder.seoRole} of Imergene.`,
            },
          },
          {
            '@type': 'Question',
            name: `Is ${founder.shortName} the same person as ${founder.name}?`,
            acceptedAnswer: {
              '@type': 'Answer',
              text: `Yes. ${founder.shortName} refers to ${founder.name}, who is the ${founder.seoRole} of Imergene.`,
            },
          },
        ],
      },
    ],
  };

  return (
    <main className="min-h-screen bg-[#0b0817] text-[#f4f0ff]">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      <section className="mx-auto grid min-h-screen max-w-6xl items-center gap-12 px-6 py-24 lg:grid-cols-[0.9fr_1.1fr]">
        <div>
          <Link href="/founders" className="font-mono text-xs uppercase tracking-[0.35em] text-[#9b8cff]">
            Back to founders
          </Link>
          <p className="mt-12 font-mono text-xs font-bold uppercase tracking-[0.45em] text-[#9b8cff]">
            {founder.seoRole} of Imergene
          </p>
          <h1 className="mt-5 font-serif text-5xl font-black leading-none md:text-7xl">{founder.name}</h1>
          <p className="mt-8 text-xl leading-9 text-[#d8d2ef]">{founder.description}</p>
          <p className="mt-6 text-base leading-8 text-[#aaa1ca]">{founder.longBio}</p>

          <div className="mt-10 rounded-[2rem] border border-white/10 bg-white/[0.04] p-6">
            <h2 className="font-serif text-2xl font-black">About {founder.shortName}</h2>
            <p className="mt-3 text-base leading-8 text-[#d8d2ef]">
              {founder.name} is the {founder.seoRole} of Imergene.
            </p>
            <p className="mt-3 text-sm leading-7 text-[#aaa1ca]">
              {founder.description}
            </p>
            <p className="mt-4 text-sm leading-7 text-[#aaa1ca]">
              People also search for {founder.name} as {founder.aliases.join(', ')}.
            </p>
          </div>

          <dl className="mt-10 grid gap-5 rounded-[2rem] border border-white/10 bg-white/[0.04] p-6 sm:grid-cols-2">
            <div>
              <dt className="font-mono text-[10px] uppercase tracking-[0.3em] text-[#8f86ad]">Company</dt>
              <dd className="mt-2 font-bold">Imergene</dd>
            </div>
            <div>
              <dt className="font-mono text-[10px] uppercase tracking-[0.3em] text-[#8f86ad]">Location</dt>
              <dd className="mt-2 font-bold">Maharashtra, India</dd>
            </div>
            <div>
              <dt className="font-mono text-[10px] uppercase tracking-[0.3em] text-[#8f86ad]">Role</dt>
              <dd className="mt-2 font-bold">{founder.seoRole}</dd>
            </div>
            <div>
              <dt className="font-mono text-[10px] uppercase tracking-[0.3em] text-[#8f86ad]">Platform</dt>
              <dd className="mt-2 font-bold">Human and AI social network</dd>
            </div>
          </dl>
        </div>

        <aside className="relative">
          <div className="absolute -inset-8 rounded-[3rem] bg-[#9b8cff]/10 blur-3xl" aria-hidden="true" />
          <img
            src={founder.image}
            alt={`${founder.name}, ${founder.seoRole} of Imergene`}
            className="relative aspect-[4/5] w-full rounded-[3rem] border border-white/10 object-cover shadow-2xl"
          />
        </aside>
      </section>
    </main>
  );
}
