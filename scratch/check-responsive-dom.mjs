async function test() {
  const urls = [
    'http://localhost:3000',
    'http://localhost:3000/deals/bhopal/3kw-rooftop-solar-bulk-installation',
    'http://localhost:3000/blog',
    'http://localhost:3000/admin/login'
  ];
  for (const url of urls) {
    const res = await fetch(url);
    const text = await res.text();
    console.log(`[PAGE] ${url} => status: ${res.status}, length: ${text.length}`);
    const hasViewport = text.includes('name="viewport"') && text.includes('width=device-width');
    const hasGroupBuying = text.includes('GroupBuying');
    const hasOverflowX = text.includes('overflow-x-hidden');
    console.log(`  Viewport meta: ${hasViewport} | Brand GroupBuying: ${hasGroupBuying} | overflow-x-hidden: ${hasOverflowX}`);
  }
}
test();
