import DOMPurify from 'isomorphic-dompurify';

export function sanitizeHtml(html: string): string {
  return DOMPurify.sanitize(html);
}

export function sanitizeText(text: string): string {
  return text.replace(/[<>]/g, '');
}

export default { sanitizeHtml, sanitizeText };