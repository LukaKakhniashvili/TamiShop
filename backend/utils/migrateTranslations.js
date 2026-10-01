/*
 * არსებული კონტენტის EN/RU თარგმანების შევსება (idempotent).
 *
 *   npm run migrate:translations              — შევსება (მხოლოდ ცარიელი ველები)
 *   npm run migrate:translations -- --dry-run — მხოლოდ შემოწმება და ანგარიში, ბაზაში ჩაწერის გარეშე
 *   npm run migrate:translations -- --force   — ლექსიკონის თარგმანებით გადაწერა (ადმინის ცვლილებებსაც)
 *
 * არქიტექტურა: საბაზისო ველები (name, description, specifications, options) ქართულია და არ იცვლება;
 * თარგმანები — translations.{en,ru} (იხ. utils/translations.js). სკრიპტი ცვლის მხოლოდ translations ველებს
 * ($set კონკრეტულ ბილიკებზე) — ID-ები, ფასები, მარაგი, ვარიანტები, SKU, სურათები და updatedAt უცვლელია.
 *
 * შეკვეთები: ისტორიულ snapshot-ს ემატება მხოლოდ სახელის/ოფციების თარგმანი და მხოლოდ მაშინ, როცა snapshot-ის
 * ქართული ტექსტი ემთხვევა პროდუქტის მიმდინარე ტექსტს (ფინანსური მონაცემები არ იცვლება).
 *
 * წყაროები: utils/contentTranslations/* (პროდუქტები, მახასიათებლების ლექსიკონი), utils/catalogData.js (კატეგორიები).
 */
require('dotenv').config();
const mongoose = require('mongoose');
const { TRANSLATION_LANGUAGES } = require('./translations');
const { translateKey, translateValue } = require('./contentTranslations/specs');
const { categories: catalogCategories } = require('./catalogData');

const PRODUCT_TEXTS = Object.assign(
  {},
  require('./contentTranslations/products-1').products,
  require('./contentTranslations/products-2').products,
  require('./contentTranslations/products-3').products
);
const CATEGORY_TEXTS = Object.fromEntries(catalogCategories.filter((c) => c.translations).map((c) => [c.slug, c.translations]));

const GEO = /[ა-ჿ]/;
const hasGeo = (s) => typeof s === 'string' && GEO.test(s);
const filled = (v) => (typeof v === 'string' ? v.trim() !== '' : Array.isArray(v) ? v.length > 0 : Boolean(v));

/** თარგმანის დაგეგმვა ერთი პროდუქტისთვის → { set: { path: value }, errors: [] } */
const planProduct = (p, { force }) => {
  const errors = [];
  const set = {};
  const texts = PRODUCT_TEXTS[p.slug] || {};

  for (const lng of TRANSLATION_LANGUAGES) {
    const cur = p.translations?.[lng] || {};
    const want = {};

    // სახელი: ქართული ტექსტით — თარგმანიდან; მხოლოდ ბრენდი/მოდელი — უცვლელი
    if (texts[lng]?.name) want.name = texts[lng].name;
    else if (hasGeo(p.name)) errors.push(`${p.slug}: name.${lng} missing`);
    else want.name = p.name;

    if (p.description) {
      if (texts[lng]?.description) want.description = texts[lng].description;
      else if (hasGeo(p.description)) errors.push(`${p.slug}: description.${lng} missing`);
    }

    // მახასიათებლები — ინდექსით (ქართული რიგით); გასაღები და მნიშვნელობა ლექსიკონიდან
    if (p.specifications?.length) {
      want.specifications = p.specifications.map((s) => {
        const key = translateKey(s.key, lng);
        const value = translateValue(s.value, lng);
        if (key === null) errors.push(`${p.slug}: spec key "${s.key}" (${lng})`);
        if (value === null) errors.push(`${p.slug}: spec value "${s.value}" (${lng})`);
        return { key: key || '', value: value ?? '' };
      });
    }

    for (const [field, value] of Object.entries(want)) {
      if (typeof value === 'string' && hasGeo(value)) errors.push(`${p.slug}: ${field}.${lng} still contains Georgian`);
      const misaligned = field === 'specifications' && (cur.specifications?.length || 0) !== value.length;
      if (force || !filled(cur[field]) || misaligned) {
        if (JSON.stringify(cur[field]) !== JSON.stringify(value)) set[`translations.${lng}.${field}`] = value;
      }
    }

    // ოფციები და მნიშვნელობები (მხოლოდ ქართულ ტექსტიანი; 128 GB და მსგ. — საერთო)
    (p.options || []).forEach((o, oi) => {
      if (hasGeo(o.name)) {
        const name = translateKey(o.name, lng);
        if (name === null) errors.push(`${p.slug}: option "${o.name}" (${lng})`);
        else if (force || !filled(o.translations?.[lng]?.name)) {
          if (o.translations?.[lng]?.name !== name) set[`options.${oi}.translations.${lng}.name`] = name;
        }
      }
      (o.values || []).forEach((v, vi) => {
        if (!hasGeo(v.label)) return;
        const label = translateValue(v.label, lng);
        if (label === null) errors.push(`${p.slug}: option value "${v.label}" (${lng})`);
        else if (force || !filled(v.translations?.[lng]?.label)) {
          if (v.translations?.[lng]?.label !== label) set[`options.${oi}.values.${vi}.translations.${lng}.label`] = label;
        }
      });
    });
  }
  return { set, errors };
};

const planCategory = (c, { force }) => {
  const errors = [];
  const set = {};
  const texts = CATEGORY_TEXTS[c.slug];
  for (const lng of TRANSLATION_LANGUAGES) {
    const cur = c.translations?.[lng] || {};
    for (const field of ['name', 'description']) {
      if (!c[field]) continue;
      const value = texts?.[lng]?.[field] || (!hasGeo(c[field]) ? c[field] : null);
      if (!value) {
        errors.push(`category ${c.slug}: ${field}.${lng} missing`);
        continue;
      }
      if ((force || !filled(cur[field])) && cur[field] !== value) set[`translations.${lng}.${field}`] = value;
    }
  }
  return { set, errors };
};

/** შეკვეთის snapshot-ის თარგმანები — მხოლოდ თუ ქართული ტექსტი ემთხვევა მიმდინარე პროდუქტს */
const planOrder = (order, productsById) => {
  const set = {};
  (order.items || []).forEach((it, i) => {
    const p = productsById.get(String(it.product));
    if (!p) return;
    if (!it.translations && it.name === p.name) {
      const tr = {};
      for (const lng of TRANSLATION_LANGUAGES) {
        const name = p.translations?.[lng]?.name;
        if (name) tr[lng] = { name };
      }
      if (Object.keys(tr).length) set[`items.${i}.translations`] = tr;
    }
    (it.variant?.options || []).forEach((so, j) => {
      if (so.translations) return;
      const o = (p.options || []).find((x) => x.name === so.name);
      const v = o?.values.find((x) => x.label === so.value);
      if (!o || !v) return;
      const tr = {};
      for (const lng of TRANSLATION_LANGUAGES) {
        const name = o.translations?.[lng]?.name;
        const value = v.translations?.[lng]?.label;
        if (name || value) tr[lng] = { ...(name ? { name } : {}), ...(value ? { value } : {}) };
      }
      if (Object.keys(tr).length) set[`items.${i}.variant.options.${j}.translations`] = tr;
    });
  });
  return set;
};

/**
 * @returns {{ errors: string[], categories: number, products: number, orders: number }}
 */
const applyContentTranslations = async ({ dryRun = false, force = false, log = console.log } = {}) => {
  const db = mongoose.connection.db;
  const categories = await db.collection('categories').find({}).toArray();
  const products = await db.collection('products').find({}).toArray();

  const catPlans = categories.map((c) => ({ c, ...planCategory(c, { force }) }));
  const prodPlans = products.map((p) => ({ p, ...planProduct(p, { force }) }));
  const errors = [...catPlans, ...prodPlans].flatMap((x) => x.errors);
  if (errors.length) return { errors, categories: 0, products: 0, orders: 0 };

  const changedCats = catPlans.filter((x) => Object.keys(x.set).length);
  const changedProds = prodPlans.filter((x) => Object.keys(x.set).length);
  if (!dryRun) {
    for (const { c, set } of changedCats) await db.collection('categories').updateOne({ _id: c._id }, { $set: set });
    for (const { p, set } of changedProds) await db.collection('products').updateOne({ _id: p._id }, { $set: set });
  }

  // შეკვეთები — განახლებული პროდუქტების მიხედვით
  const freshProducts = dryRun ? products : await db.collection('products').find({}).toArray();
  const byId = new Map(freshProducts.map((p) => [String(p._id), p]));
  const orders = await db.collection('orders').find({}).toArray();
  let orderCount = 0;
  for (const o of orders) {
    const set = planOrder(o, byId);
    if (!Object.keys(set).length) continue;
    orderCount++;
    if (!dryRun) await db.collection('orders').updateOne({ _id: o._id }, { $set: set });
  }

  log(`  categories: ${changedCats.length}/${categories.length} updated`);
  log(`  products:   ${changedProds.length}/${products.length} updated`);
  log(`  orders:     ${orderCount}/${orders.length} snapshots enriched`);
  return { errors: [], categories: changedCats.length, products: changedProds.length, orders: orderCount };
};

module.exports = { applyContentTranslations, planProduct, planCategory };

if (require.main === module) {
  const connectDB = require('../config/db');
  const dryRun = process.argv.includes('--dry-run');
  const force = process.argv.includes('--force');
  (async () => {
    await connectDB();
    console.log(`Content translations${dryRun ? ' [DRY RUN]' : ''}${force ? ' [FORCE]' : ''}:`);
    const r = await applyContentTranslations({ dryRun, force });
    if (r.errors.length) {
      console.error(`Missing translations (${r.errors.length}) — nothing was written:\n  ` + r.errors.join('\n  '));
      process.exitCode = 1;
    }
    await mongoose.disconnect();
  })().catch(async (e) => {
    console.error(e);
    await mongoose.disconnect();
    process.exit(1);
  });
}
