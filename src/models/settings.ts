import { z } from 'zod';

const size = z.number().int().min(12).max(80);
const fields = z.object({
  titleSize: size.default(30), bodySize: size.default(34), mainIdeaSize: size.default(32), translationSize: size.default(32),
  headerSize: size.default(18), footerSize: size.default(17), wordSize: size.default(34), vocabularySize: size.default(26),
  phraseSize: size.default(34), expressionSize: size.default(30), headingSize: size.default(24),
  lineHeight: z.number().min(1.2).max(2.4).default(1.45), translationLineHeight: z.number().min(1.2).max(2.4).default(1.62),
  paragraphGap: z.number().min(0).max(100).default(18), marginX: z.number().min(24).max(200).default(54),
  marginTop: z.number().min(24).max(200).default(34), marginBottom: z.number().min(65).max(400).default(80),
  pageWidth: z.number().int().min(400).max(4000).default(1200), pageHeight: z.number().int().min(400).max(4000).default(1600),
}).strict();
export const settingsSchema = fields.superRefine((value, context) => {
  if (value.pageWidth - value.marginX * 2 < 200) context.addIssue({ code: 'custom', message: '页面宽度扣除左右边距后至少应保留 200px。', path: ['pageWidth'] });
  if (value.pageWidth - value.marginX * 2 < value.footerSize * 6 + 40) context.addIssue({ code: 'custom', message: '页面可用宽度不足以容纳当前页脚字号，请增大页宽或减小页脚字号、边距。', path: ['footerSize'] });
  const headerHeight = Math.max(42, value.headerSize * 1.4 + 16);
  const footerHeight = Math.max(65, 32 + value.footerSize * 1.4);
  if (value.marginBottom < footerHeight) context.addIssue({ code: 'custom', message: '底部预留不足以容纳当前页脚字号。', path: ['marginBottom'] });
  if (value.pageHeight - value.marginTop - headerHeight - value.marginBottom < 120) context.addIssue({ code: 'custom', message: '页面高度扣除页眉和底部预留后至少应保留 120px。', path: ['pageHeight'] });
});
export type Styles = z.infer<typeof settingsSchema>;
export const defaults = settingsSchema.parse({});
