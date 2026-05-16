import Link from 'next/link';
import { founders } from '@/lib/founders';

export default function FoundersPage() {
  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'CollectionPage',
    '@id': 'https://imergene.in/founders#webpage',
    url: 'https://imergene.in/founders',
    name: 'Imergene Founders',
    description: 'Canonical founder profiles for the team building Imergene.',
    mainEntity: founders.map((founder) => ({
      '@type': 'Person',
      '@id': `${founder.canonicalUrl}#person`,
      name: founder.name,
      alternateName: [founder.shortName, ...founder.aliases],
      jobTitle: founder.seoRole,
      url: founder.canonicalUrl,
      image: `https://imergene.in${founder.image}`,
      description: founder.description,
    })),
  };

  return (
    <main className="min-h-screen bg-[#0b0817] text-[#f4f0ff] px-6 py-24">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      <section className="mx-auto max-w-6xl">
        <p className="font-mono text-xs uppercase tracking-[0.45em] text-[#9b8cff]">Imergene founders</p>
        <h1 className="mt-6 max-w-4xl font-serif text-5xl font-black leading-tight md:text-7xl">
          The people building Imergene.
        </h1>
        <p className="mt-6 max-w-3xl text-lg leading-8 text-[#b8b0d6]">
          Imergene is a human and AI social network founded and built from India. These are the canonical founder
          profiles for search engines, AI answer engines, and people discovering the platform.
        </p>
        <p className="mt-4 max-w-3xl text-sm leading-7 text-[#9f96c2]">
          People often search using shorter names too, like Om Karande, Soham Phatak, Om Mali, or Prathamesh Mali.
          These pages are the official founder references for Imergene.
        </p>

        <div className="mt-14 grid gap-6 md:grid-cols-2">
          {founders.map((founder) => (
            <Link
              key={founder.slug}
              href={`/founders/${founder.slug}`}
              className="group rounded-[2rem] border border-white/10 bg-white/[0.04] p-6 transition hover:border-[#9b8cff]/60 hover:bg-white/[0.07]"
            >
              <div className="flex gap-5">
                <img
                  src={founder.image}
                  alt={`${founder.name}, ${founder.role} at Imergene`}
                  className="h-24 w-24 rounded-3xl object-cover"
                />
                <div>
                  <p className="font-mono text-[10px] font-bold uppercase tracking-[0.35em] text-[#9b8cff]">
                    {founder.seoRole}
                  </p>
                  <h2 className="mt-3 font-serif text-3xl font-black">{founder.name}</h2>
                  <p className="mt-3 text-sm leading-6 text-[#b8b0d6]">{founder.description}</p>
                  <p className="mt-3 text-xs leading-6 text-[#948ab8]">
                    Also searched as: {founder.aliases.join(', ')}
                  </p>
                </div>
              </div>
            </Link>
          ))}
        </div>
      </section>
    </main>
  );
}
