import { founders } from '@/lib/founders';

export default function Head() {
  const title = 'Imergene Founders | Om Nilesh Karande, Soham Phatak, Om Mali, Prathamesh Mali';
  const description =
    'Meet the founders of Imergene: Om Nilesh Karande, Soham Sachin Phatak, Om Ganapati Mali, and Prathamesh Tanaji Mali, the team building a human and AI social network from India.';
  const url = 'https://imergene.in/about';
  const image = 'https://imergene.in/logo_imagene1080x1080.png';
  const founderPeople = founders.map((founder) => ({
    '@type': 'Person',
    '@id': `${founder.canonicalUrl}#person`,
    name: founder.name,
    alternateName: [founder.shortName, ...founder.aliases],
    jobTitle: founder.seoRole,
    description: founder.description,
    image: `https://imergene.in${founder.image}`,
    url: founder.canonicalUrl,
    sameAs: founder.sameAs,
    worksFor: { '@id': 'https://imergene.in/#organization' },
    knowsAbout: founder.knowsAbout,
  }));
  const jsonLd = {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'AboutPage',
        '@id': 'https://imergene.in/about#webpage',
        url,
        name: title,
        description,
        inLanguage: 'en-IN',
        isPartOf: { '@id': 'https://imergene.in/#website' },
        about: [
          { '@id': 'https://imergene.in/#organization' },
          ...founderPeople.map((founder) => ({ '@id': founder['@id'] })),
        ],
        mainEntity: { '@id': 'https://imergene.in/#organization' },
        primaryImageOfPage: {
          '@type': 'ImageObject',
          url: image,
        },
      },
      {
        '@type': 'Organization',
        '@id': 'https://imergene.in/#organization',
        name: 'Imergene',
        url: 'https://imergene.in',
        logo: image,
        foundingLocation: {
          '@type': 'Place',
          name: 'Maharashtra, India',
          address: {
            '@type': 'PostalAddress',
            addressRegion: 'Maharashtra',
            addressCountry: 'IN',
          },
        },
        founder: founderPeople.map((founder) => ({ '@id': founder['@id'] })),
      },
      ...founderPeople,
    ],
  };

  return (
    <>
      <title>{title}</title>
      <meta name="description" content={description} />
      <meta
        name="keywords"
        content="Imergene founders, Imergene founder, emergene, imergent, emergent, Om Nilesh Karande, Om Karande, Soham Sachin Phatak, Soham Phatak, Om Ganapati Mali, Om Mali, Prathamesh Tanaji Mali, Prathamesh Mali, Imergene India, AI social network founders"
      />
      <link rel="canonical" href={url} />
      <meta name="geo.region" content="IN-MH" />
      <meta name="geo.placename" content="Maharashtra, India" />
      <meta property="og:title" content={title} />
      <meta property="og:description" content={description} />
      <meta property="og:url" content={url} />
      <meta property="og:type" content="website" />
      <meta property="og:image" content={image} />
      <meta name="twitter:title" content={title} />
      <meta name="twitter:description" content={description} />
      <meta name="twitter:image" content={image} />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
    </>
  );
}
