export const LIMITS = Object.freeze({ bytes: 10 * 1024 * 1024, orders: 1000, products: 10000, items: 1000, totalItems: 10000 });
const statuses = new Set(['pending', 'processing', 'on-hold', 'completed', 'cancelled', 'refunded', 'failed', 'checkout-draft']);
const record = x => x !== null && typeof x === 'object' && !Array.isArray(x);
const id = x => Number.isSafeInteger(x) && x > 0;
const list = x => Array.isArray(x) ? x : record(x) ? [x] : null;
export class InputError extends Error {
  constructor(code) { super(code); this.code = code; }
}
export function parseExport(text) {
  if (Buffer.byteLength(text, 'utf8') > LIMITS.bytes) throw new InputError('INPUT_TOO_LARGE');
  try { return JSON.parse(text); } catch { throw new InputError('INVALID_JSON'); }
}
function validate(value, max, code) {
  const values = list(value);
  if (!values || values.length > max || values.some(x => !record(x))) throw new InputError(code);
  return values;
}
function dateEvidence(value) {
  if (typeof value !== 'string') return false;
  const match = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})(?:Z|([+-])(\d{2}):(\d{2}))?$/.exec(value);
  if (!match) return false;
  const [, y, m, d, h, min, sec, offset, oh, om] = match;
  const year = Number(y), month = Number(m), day = Number(d);
  const leap = year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
  const days = [31, leap ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
  return year >= 1 && month >= 1 && month <= 12 && day >= 1 && day <= days[month - 1]
    && Number(h) < 24 && Number(min) < 60 && Number(sec) < 60
    && (!offset || (Number(oh) <= 14 && Number(om) < 60 && (Number(oh) < 14 || Number(om) === 0)));
}
export function analyze(ordersInput, productsInput) {
  const orders = validate(ordersInput, LIMITS.orders, 'INVALID_ORDERS');
  const products = productsInput === undefined ? [] : validate(productsInput, LIMITS.products, 'INVALID_PRODUCTS');
  const catalog = new Map();
  for (const product of products) {
    if (!id(product.id) || catalog.has(product.id)) throw new InputError('INVALID_PRODUCT_IDS');
    catalog.set(product.id, product);
  }
  let totalItems = 0;
  const results = orders.map((order, orderIndex) => {
    // A line_items array distinguishes an order-shaped record from arbitrary JSON.
    if (!Array.isArray(order.line_items) || order.line_items.length > LIMITS.items || order.line_items.some(x => !record(x))) throw new InputError('INVALID_LINE_ITEMS');
    totalItems += order.line_items.length;
    if (totalItems > LIMITS.totalItems) throw new InputError('TOO_MANY_ITEMS');
    const status = statuses.has(order.status) ? order.status : 'unknown';
    const paidDate = dateEvidence(order.date_paid_gmt) || dateEvidence(order.date_paid);
    const findings = [];
    if (status === 'unknown') findings.push('ORDER_STATUS_UNKNOWN');
    if (['pending', 'on-hold', 'failed', 'checkout-draft'].includes(status)) findings.push('PAYMENT_OR_ORDER_REVIEW_NEEDED');
    if (['cancelled', 'refunded'].includes(status)) findings.push('ORDER_NOT_ACTIVE');
    if (['completed', 'processing'].includes(status) && !paidDate) findings.push('PAID_DATE_NOT_RECORDED');
    const items = order.line_items.map((item, itemIndex) => {
      // A variation may override the parent. Never infer variation settings from it.
      const productId = id(item.variation_id) ? item.variation_id : item.variation_id === 0 || item.variation_id === undefined ? item.product_id : undefined;
      const product = id(productId) ? catalog.get(productId) : undefined;
      const downloadable = product?.downloadable === true ? 'yes' : product?.downloadable === false ? 'no' : 'unknown';
      const itemFindings = [];
      let files = 'unknown';
      if (!product) itemFindings.push('PRODUCT_SNAPSHOT_MISSING');
      else if (downloadable === 'unknown') itemFindings.push('DOWNLOADABLE_FLAG_UNKNOWN');
      if (downloadable === 'yes') {
        files = Array.isArray(product.downloads) ? (product.downloads.length ? 'listed' : 'none_listed') : 'unknown';
        if (files === 'none_listed') itemFindings.push('NO_DOWNLOAD_FILES_LISTED');
        if (files === 'unknown') itemFindings.push('DOWNLOAD_FILES_UNKNOWN');
        itemFindings.push('VERIFY_DOWNLOAD_PERMISSIONS_AND_LIMITS');
      }
      return { item_index: itemIndex + 1, downloadable, download_files: files, findings: itemFindings };
    });
    return { order_index: orderIndex + 1, status, paid_date: paidDate ? 'recorded' : 'not_recorded', payment_verification: 'not_performed', download_permissions: 'not_checked', findings, items };
  });
  return { schema_version: 1, tool_version: '0.1.0', order_count: results.length, scope: 'offline_snapshot_only', orders: results };
}
export function renderText(report) {
  const lines = ['Woo Support Toolkit 0.1.0', 'Offline snapshot only. Payment and download permissions are not verified.', `Orders: ${report.order_count}`];
  for (const order of report.orders) {
    lines.push(`Order ${order.order_index}: ${order.status}; paid date ${order.paid_date}`);
    for (const finding of order.findings) lines.push(`  ${finding}`);
    for (const item of order.items) {
      lines.push(`  Item ${item.item_index}: downloadable ${item.downloadable}; files ${item.download_files}`);
      for (const finding of item.findings) lines.push(`    ${finding}`);
    }
  }
  return lines.join('\n') + '\n';
}
