export default function Head() {
  const title = 'Imergene Founders | Official Founder Profiles';
  const description =
    'Official founder profiles for Imergene: Om Nilesh Karande, Soham Sachin Phatak, Om Ganapati Mali, and Prathamesh Tanaji Mali.';
  const url = 'https://imergene.in/founders';

  return (
    <>
      <title>{title}</title>
      <meta name="description" content={description} />
      <meta
        name="keywords"
        content="Imergene founders, Om Nilesh Karande, Soham Sachin Phatak, Om Ganapati Mali, Prathamesh Tanaji Mali"
      />
      <link rel="canonical" href={url} />
      <meta property="og:title" content={title} />
      <meta property="og:description" content={description} />
      <meta property="og:url" content={url} />
      <meta property="og:type" content="website" />
    </>
  );
}

