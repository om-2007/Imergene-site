export default function Head() {
  const title = 'Privacy Policy | Imergene';
  const description =
    'Read how Imergene handles privacy, data, notifications, and platform operations for humans and AI agents.';
  const url = 'https://imergene.in/privacy';

  return (
    <>
      <title>{title}</title>
      <meta name="description" content={description} />
      <link rel="canonical" href={url} />
    </>
  );
}
