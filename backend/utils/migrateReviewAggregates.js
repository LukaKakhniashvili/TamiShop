/**
 * ერთჯერადი მიგრაცია: Product.rating / reviewCount → მხოლოდ რეალური, გამოქვეყნებული შეფასებებიდან.
 * კატალოგის seed-ის სადემონსტრაციო მნიშვნელობები (მაგ. 4.8 / 342) ამით ნულდება (შეფასებების გარეშე → 0 / 0).
 * ასევე იშლება seed-ის მახასიათებელი „რეიტინგი: 4.8 / 5 (342 შეფასება)" (მხოლოდ ზუსტად ამ ფორმატის),
 * იმავე პოზიციის en/ru თარგმანებთან ერთად — რომ რეალურ რეიტინგს არ ეწინააღმდეგებოდეს.
 *
 *   npm run migrate:review-aggregates -- --dry-run        მხოლოდ ანგარიში, არაფერი იწერება
 *   npm run migrate:review-aggregates                     backup (backups/*.json) → ჩაწერა
 *   npm run migrate:review-aggregates -- --restore=FILE   backup-იდან დაბრუნება
 *
 * იცვლება მხოლოდ rating, reviewCount და ეს ერთი მახასიათებელი (სხვა ველები, updatedAt-ის ჩათვლით — არა).
 * იდემპოტენტურია: განმეორებით გაშვება ცვლილებას აღარ ქმნის.
 */
require('dotenv').config();
const fs = require('fs');
const path = require('path');
const mongoose = require('mongoose');

const BACKUP_DIR = path.join(__dirname, '..', 'backups');

/** რეალური სტატისტიკა ყველა პროდუქტისთვის (published შეფასებები) — იგივე წესი, რაც services/reviews.js-ში */
const realStats = async (db) => {
  const rows = await db
    .collection('reviews')
    .aggregate([{ $match: { status: 'published' } }, { $group: { _id: '$product', avg: { $avg: '$rating' }, count: { $sum: 1 } } }])
    .toArray();
  return new Map(rows.map((r) => [String(r._id), { rating: Math.round(r.avg * 10) / 10, reviewCount: r.count }]));
};

// seed-ის სადემონსტრაციო მახასიათებელი (utils/seedCatalog.js) — მხოლოდ ზუსტი ფორმატი; ადმინის ხელით დაწერილი რჩება
const DEMO_RATING_SPEC = { key: 'რეიტინგი', value: /^\d(\.\d)? \/ 5 \(\d+ შეფასება\)$/, en: 'Rating', ru: 'Рейтинг' };

/** seed-ის „რეიტინგი" მახასიათებლის პოზიციები; თარგმანი იმავე პოზიციაზე უნდა იყოს იგივე გასაღებით (ან არ იყოს) */
const demoSpecIndexes = (p) =>
  (p.specifications || [])
    .map((s, i) => (s.key === DEMO_RATING_SPEC.key && DEMO_RATING_SPEC.value.test(s.value || '') ? i : -1))
    .filter((i) => i >= 0)
    .filter((i) => ['en', 'ru'].every((l) => {
      const tr = p.translations?.[l]?.specifications?.[i];
      return !tr || tr.key === DEMO_RATING_SPEC[l];
    }));

const planReviewAggregates = async (db) => {
  const [products, stats] = await Promise.all([
    db.collection('products').find({}, { projection: { name: 1, rating: 1, reviewCount: 1, specifications: 1, translations: 1 } }).toArray(),
    realStats(db),
  ]);
  return products
    .map((p) => {
      const next = stats.get(String(p._id)) || { rating: 0, reviewCount: 0 };
      const sameRating = (p.rating ?? 0) === next.rating && (p.reviewCount ?? 0) === next.reviewCount;
      const drop = new Set(demoSpecIndexes(p));
      if (sameRating && !drop.size) return null;
      const change = { _id: p._id, name: p.name, before: { rating: p.rating, reviewCount: p.reviewCount }, after: sameRating ? null : next };
      if (drop.size) {
        const keep = (arr) => arr.filter((_, i) => !drop.has(i));
        change.specs = {
          before: p.specifications,
          after: keep(p.specifications),
          translations: Object.fromEntries(
            ['en', 'ru']
              .filter((l) => Array.isArray(p.translations?.[l]?.specifications))
              .map((l) => [l, { before: p.translations[l].specifications, after: keep(p.translations[l].specifications) }])
          ),
        };
      }
      return change;
    })
    .filter(Boolean);
};

const applyReviewAggregates = async ({ dryRun = false, log = console.log } = {}) => {
  const db = mongoose.connection.db;
  const changes = await planReviewAggregates(db);
  log(`  products to update: ${changes.length} (rating: ${changes.filter((c) => c.after).length}, demo „რეიტინგი" spec: ${changes.filter((c) => c.specs).length})`);
  changes.slice(0, 10).forEach((c) =>
    log(`    ${c.name}: ${c.after ? `${c.before.rating ?? '—'} (${c.before.reviewCount ?? '—'}) → ${c.after.rating} (${c.after.reviewCount})` : 'rating OK'}${c.specs ? ' + spec removed' : ''}`)
  );
  if (changes.length > 10) log(`    … +${changes.length - 10}`);
  if (dryRun || !changes.length) return { changes: changes.length, backup: null };

  fs.mkdirSync(BACKUP_DIR, { recursive: true });
  const backup = path.join(BACKUP_DIR, `review-aggregates-${new Date().toISOString().replace(/[:.]/g, '-')}.json`);
  fs.writeFileSync(
    backup,
    JSON.stringify(
      changes.map((c) => ({
        _id: String(c._id),
        ...c.before,
        ...(c.specs && {
          specifications: c.specs.before,
          translationSpecifications: Object.fromEntries(Object.entries(c.specs.translations).map(([l, v]) => [l, v.before])),
        }),
      })),
      null,
      2
    )
  );
  log(`  backup: ${backup}`);

  await db.collection('products').bulkWrite(
    changes.map((c) => {
      const set = { ...(c.after || {}) };
      // მახასიათებლები — მხოლოდ თუ შუალედში არავის შეუცვლია (filter: ძველი მნიშვნელობა)
      const filter = { _id: c._id };
      if (c.specs) {
        filter.specifications = c.specs.before;
        set.specifications = c.specs.after;
        Object.entries(c.specs.translations).forEach(([l, v]) => {
          set[`translations.${l}.specifications`] = v.after;
        });
      }
      return { updateOne: { filter, update: { $set: set } } };
    }),
    { ordered: false }
  );
  return { changes: changes.length, backup };
};

const restoreReviewAggregates = async (file, { log = console.log } = {}) => {
  const rows = JSON.parse(fs.readFileSync(file, 'utf8'));
  const ops = rows.map((r) => ({
    updateOne: {
      filter: { _id: new mongoose.Types.ObjectId(r._id) },
      update: {
        $set: {
          rating: r.rating ?? 0,
          reviewCount: r.reviewCount ?? 0,
          ...(r.specifications && { specifications: r.specifications }),
          ...Object.fromEntries(Object.entries(r.translationSpecifications || {}).map(([l, v]) => [`translations.${l}.specifications`, v])),
        },
      },
    },
  }));
  if (ops.length) await mongoose.connection.db.collection('products').bulkWrite(ops, { ordered: false });
  log(`  restored: ${ops.length}`);
  return ops.length;
};

module.exports = { planReviewAggregates, applyReviewAggregates, restoreReviewAggregates };

if (require.main === module) {
  const connectDB = require('../config/db');
  const dryRun = process.argv.includes('--dry-run');
  const restore = (process.argv.find((a) => a.startsWith('--restore=')) || '').slice('--restore='.length);
  (async () => {
    await connectDB();
    if (restore) {
      console.log(`Review aggregates — restore from ${restore}:`);
      await restoreReviewAggregates(restore);
    } else {
      console.log(`Review aggregates${dryRun ? ' [DRY RUN]' : ''}:`);
      await applyReviewAggregates({ dryRun });
    }
    await mongoose.disconnect();
  })().catch(async (e) => {
    console.error(e);
    await mongoose.disconnect();
    process.exit(1);
  });
}
