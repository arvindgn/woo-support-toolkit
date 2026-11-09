import { analyze } from './analyze.js';
export function practiceOrders() {
  return [{ status: 'on-hold', line_items: [{ product_id: 1, variation_id: 0 }] },
    { status: 'completed', date_paid_gmt: '2026-01-01T12:00:00', line_items: [{ product_id: 2, variation_id: 3 }] }];
}
export function practiceProducts() {
  return [{ id: 1, downloadable: true, downloads: [] }, { id: 2, downloadable: false }];
}
export function learningSession() {
  return {
    mode: 'guided_self_study',
    title: 'Evidence before action',
    steps: [
      { topic: 'Order and payment', explanation: 'Order status and paid-date evidence do not prove gateway settlement.', question: 'An on-hold order has no paid date. Can you conclude that the customer never paid?', answer: 'No. Review the payment and order workflow; absence of a date is not proof of nonpayment.' },
      { topic: 'Download configuration', explanation: 'A downloadable product with no listed files is a possible configuration issue, not a verified root cause.', question: 'Can a listed download file prove the customer can access it?', answer: 'No. Check the actual file, order-specific permissions, expiry and remaining downloads separately.' },
      { topic: 'Variation evidence', explanation: 'A variation can have different settings from its parent.', question: 'Can the parent product flag establish downloadability for a missing variation snapshot?', answer: 'No. Obtain the exact variation snapshot; the result remains unknown until then.' },
      { topic: 'Privacy and AI', explanation: 'Minimized reports may still reveal operational details. AI advice can be wrong and must not trigger automatic changes.', question: 'What should you review before sharing a report or following AI advice?', answer: 'Review sharing authorization and sensitive context, then verify suggestions independently. Never share raw customer exports, credentials or payment tokens.' }
    ],
    practice_report: analyze(practiceOrders(), practiceProducts()),
    completion: 'Read each question, pause to answer, then compare with its answer. No answers or progress are stored; this is not a chat, course certification or model training.'
  };
}
export function renderLearning(session) {
  return ['Guided learning session: ' + session.title, ...session.steps.flatMap((s, i) => [`${i + 1}. ${s.topic}`, s.explanation, 'Practice: ' + s.question, 'Answer: ' + s.answer]), session.completion].join('\n') + '\n';
}
