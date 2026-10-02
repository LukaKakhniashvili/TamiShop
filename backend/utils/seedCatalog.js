// გამოყენება: npm run seed:catalog            — კატალოგის დამატება/განახლება
//             npm run seed:catalog -- --dry-run — მხოლოდ შემოწმება, ბაზაში ჩაწერის გარეშე
//
// seed.js-ისგან განსხვავებით ეს სკრიპტი არაფერს შლის: კატეგორიები და პროდუქტები
// ემატება ან ახლდება slug-ის მიხედვით, ამიტომ მისი ხელახლა გაშვება უსაფრთხოა.
require('dotenv').config();
const mongoose = require('mongoose');
const connectDB = require('../config/db');
const Category = require('../models/Category');
const Product = require('../models/Product');
const { categories, products, placeholderUpgrades } = require('./catalogData');
const { applyContentTranslations } = require('./migrateTranslations');

const DRY_RUN = process.argv.includes('--dry-run');

const escapeHtml = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

// Product სქემაში არ არის ცალკე ველები ბრენდის, SKU-ს, ქვეკატეგორიის, ვარიანტების,
// მარაგისა და ტეგებისთვის, ამიტომ ისინი ინახება specifications-სა და description-ში.
// რეიტინგი (catalogData-ს rating) არ იწერება: Product.rating / reviewCount მხოლოდ რეალური შეფასებებიდან ითვლება.
const buildProduct = (p, categoryId) => {
  const specifications = [
    ['ბრენდი', p.brand],
    ['ქვეკატეგორია', p.subcategory],
    ...p.specs,
    ...(p.variants || []),
    ['არტიკული (SKU)', p.sku],
    ['მარაგი', p.stock > 0 ? `${p.stock} ცალი` : 'ამოწურულია'],
  ].map(([key, value]) => ({ key, value: String(value) }));

  const description = [
    `<p><strong>${escapeHtml(p.short)}</strong></p>`,
    `<p>${escapeHtml(p.details)}</p>`,
    `<ul>${p.features.map((f) => `<li>${escapeHtml(f)}</li>`).join('')}</ul>`,
    `<p><small>ტეგები: ${p.tags.map(escapeHtml).join(', ')}</small></p>`,
  ].join('');

  return {
    name: p.name,
    description,
    price: p.price,
    oldPrice: p.oldPrice ?? null,
    onSale: Boolean(p.oldPrice),
    specifications,
    image: p.images[0],
    images: p.images,
    category: categoryId,
    inStock: p.stock > 0,
    isActive: true,
    rating: 0,
    reviewCount: 0,
  };
};

const validate = () => {
  const errors = [];
  const catSlugs = new Set(categories.map((c) => c.slug));
  const all = [...products, ...placeholderUpgrades];
  const seen = { slug: new Set(), sku: new Set() };

  for (const p of all) {
    const label = p.slug || p.match;
    if (!catSlugs.has(p.category)) errors.push(`${label}: უცნობი კატეგორია "${p.category}"`);
    if (!p.images?.length) errors.push(`${label}: სურათები არ არის`);
    if (p.oldPrice && p.oldPrice <= p.price) errors.push(`${label}: ძველი ფასი უნდა აღემატებოდეს მიმდინარეს`);
    for (const key of ['slug', 'sku']) {
      if (!p[key]) continue;
      if (seen[key].has(p[key])) errors.push(`${label}: დუბლირებული ${key} "${p[key]}"`);
      seen[key].add(p[key]);
    }
  }
  return errors;
};

const checkImages = async () => {
  const urls = [...new Set([...products, ...placeholderUpgrades].flatMap((p) => p.images))];
  const failed = [];
  // მცირე ჯგუფებად, რომ CDN არ გადაიტვირთოს
  for (let i = 0; i < urls.length; i += 10) {
    const batch = urls.slice(i, i + 10);
    const results = await Promise.all(
      batch.map((url) =>
        fetch(url, { method: 'HEAD' })
          .then((r) => (r.ok ? null : `${r.status} ${url}`))
          .catch((e) => `${e.message} ${url}`)
      )
    );
    failed.push(...results.filter(Boolean));
  }
  return { total: urls.length, failed };
};

const upsertCategories = async () => {
  const map = {};
  for (const [order, c] of categories.entries()) {
    // ვეძებთ slug-ით ან სახელით, რომ არსებული კატეგორია არ დუბლირდეს (სახელი უნიკალურია)
    let doc = await Category.findOne({ $or: [{ slug: c.slug }, { name: c.name }] });
    if (doc) {
      doc.order = order;
      if (!doc.description) doc.description = c.description;
      // თარგმანები ემატება მხოლოდ თუ ჯერ არ არის (ადმინის მიერ შეყვანილი არ იცვლება)
      if (!doc.translations && c.translations) doc.translations = c.translations;
      if (!DRY_RUN) await doc.save();
      console.log(`  ↻ ${c.name} (არსებული)`);
    } else {
      doc = DRY_RUN ? { _id: new mongoose.Types.ObjectId() } : await Category.create({ ...c, order });
      console.log(`  + ${c.name}`);
    }
    map[c.slug] = doc._id;
  }
  return map;
};

const run = async () => {
  const errors = validate();
  if (errors.length) {
    console.error('მონაცემებში შეცდომებია:\n' + errors.map((e) => '  - ' + e).join('\n'));
    process.exit(1);
  }

  console.log('სურათების შემოწმება...');
  const { total, failed } = await checkImages();
  if (failed.length) {
    console.error(`${failed.length}/${total} სურათი მიუწვდომელია:\n` + failed.map((f) => '  - ' + f).join('\n'));
    process.exit(1);
  }
  console.log(`  ✓ ${total} სურათი ხელმისაწვდომია`);

  await connectDB();
  if (DRY_RUN) console.log('\n[DRY RUN] ბაზაში არაფერი ჩაიწერება\n');

  console.log('კატეგორიები:');
  const categoryIds = await upsertCategories();

  console.log('პროდუქტები:');
  let created = 0;
  let updated = 0;
  for (const p of products) {
    const exists = await Product.exists({ slug: p.slug });
    if (!DRY_RUN) {
      await Product.findOneAndUpdate(
        { slug: p.slug },
        { $set: buildProduct(p, categoryIds[p.category]), $setOnInsert: { slug: p.slug } },
        { upsert: true, runValidators: true }
      );
    }
    exists ? updated++ : created++;
  }
  console.log(`  + ${created} ახალი, ↻ ${updated} განახლებული`);

  console.log('placeholder პროდუქტების განახლება:');
  for (const p of placeholderUpgrades) {
    // ძველი (placeholder) ან უკვე განახლებული სახელით — რომ ხელახალმა გაშვებამაც განაახლოს
    const doc = await Product.findOne({ name: { $in: [p.match, p.name] } });
    if (!doc) {
      console.log(`  – "${p.match}" ვერ მოიძებნა, გამოტოვებულია`);
      continue;
    }
    if (!DRY_RUN) {
      // slug და _id უცვლელია, რომ არსებული ბმულები და შეკვეთები არ დაზიანდეს
      await Product.updateOne({ _id: doc._id }, { $set: buildProduct(p, categoryIds[p.category]) }, { runValidators: true });
    }
    console.log(`  ↻ ${p.match} → ${p.name}`);
  }

  console.log('თარგმანები (EN/RU):');
  const tr = await applyContentTranslations({ dryRun: DRY_RUN, log: (m) => console.log(m) });
  if (tr.errors.length) console.warn(`  ! ${tr.errors.length} თარგმანი აკლია — იხ. npm run migrate:translations -- --dry-run`);

  const [catCount, prodCount] = await Promise.all([Category.countDocuments(), Product.countDocuments()]);
  console.log(`\nმზადაა. ბაზაში ახლა არის ${catCount} კატეგორია და ${prodCount} პროდუქტი.`);
  await mongoose.connection.close();
  process.exit(0);
};

// მხოლოდ პირდაპირ გაშვებისას (node utils/...) — require()-ით ჩატვირთვა ბაზას არ ეხება
if (require.main === module) {
  run().catch(async (err) => {
    console.error(err);
    await mongoose.connection.close().catch(() => {});
    process.exit(1);
  });
}
