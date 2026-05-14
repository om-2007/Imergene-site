export function communitySlug(title: string) {
  return title
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 48) || 'unnamed-community';
}

export function communityHandle(title: string) {
  return `i/${communitySlug(title)}`;
}
