import { z } from 'zod';
import { defaults, settingsSchema, type Styles } from './settings';
export type Block = { id: string; text: string; kind: string; indent?: boolean; gap?: number; sentences?: { start: number; end: number; index: number }[]; runs?: { start: number; end: number; kind: string }[] };

// The reader accepts missing/invalid timing metadata: text remains authoritative.
// Preserve the supplied timing value unchanged for later media validation.
const sentenceSchema = z.object({ text: z.string().min(1), timed_units: z.unknown().optional() }).strict();
export const scriptSchema = z.object({ filetype: z.literal('script'), title: z.string(), paragraphs: z.array(z.array(sentenceSchema).min(1)).min(1) }).strict();
const wordSchema = z.object({
  word: z.string(), family: z.array(z.string()).optional(), phonetic_uk: z.string(), phonetic_us: z.string(),
  meanings: z.array(z.object({ pos: z.string(), meaning: z.string() }).strict()),
}).strict();
export const vocabularySchema = z.object({ filetype: z.literal('vocabulary'), words: z.array(wordSchema) }).strict();
export const translationSchema = z.object({ filetype: z.literal('translation'), text: z.string() }).strict();
export type Script = z.infer<typeof scriptSchema>;
export type Vocabulary = z.infer<typeof vocabularySchema>;
export type Translation = z.infer<typeof translationSchema>;
export type ReaderDocument = { script: Script; vocabulary?: Vocabulary; translation?: Translation; styles: Styles };
export const parseScript = (input: unknown): Script => scriptSchema.parse(input);
export const parseVocabulary = (input: unknown): Vocabulary => vocabularySchema.parse(input);
export const parseTranslation = (input: unknown): Translation => translationSchema.parse(input);
export const parseReaderDocument = (input: unknown): ReaderDocument => z.object({
  script: scriptSchema, vocabulary: vocabularySchema.optional(), translation: translationSchema.optional(), styles: settingsSchema.default(defaults),
}).strict().parse(input);

/** Native sentence boundaries stay attached to each logical paragraph across page fragments. */
export function readerBlocks(document: ReaderDocument): Block[] {
  const { script, vocabulary, translation, styles } = document;
  const blocks: Block[] = [];
  if (script.title) blocks.push({ id: 'title', text: script.title, kind: 'title', gap: 0 });
  script.paragraphs.forEach((paragraph, paragraphIndex) => {
    let text = '';
    const sentences: NonNullable<Block['sentences']> = [];
    paragraph.forEach((sentence, index) => {
      if (index) text += ' ';
      const start = text.length;
      text += sentence.text;
      sentences.push({ start, end: text.length, index });
    });
    blocks.push({ id: `script:${paragraphIndex}`, text, kind: 'article', indent: true, gap: styles.paragraphGap, sentences });
  });
  if (vocabulary?.words.length) {
    blocks.push({ id: 'vocab-heading', text: 'VOCABULARY', kind: 'vocab-heading', gap: 25 });
    vocabulary.words.forEach((word, index) => {
      let text = '';
      const runs: NonNullable<Block['runs']> = [];
      function append(value: string, kind: string, separator = ' ') {
        if (!value) return;
        if (text) text += separator;
        const start = text.length;
        text += value;
        runs.push({ start, end: text.length, kind });
      }
      append(word.word, 'word');
      append(word.phonetic_uk ? `UK ${word.phonetic_uk}` : '', 'ipa');
      append(word.phonetic_us ? `US ${word.phonetic_us}` : '', 'ipa');
      word.meanings.forEach(meaning => {
        append([meaning.pos, meaning.meaning].filter(Boolean).join(' '), 'vocab-meaning', '\n');
      });
      blocks.push({ id: `vocabulary:${index}`, text, kind: 'vocab', runs, gap: 15 });
    });
  }
  if (translation?.text) {
    blocks.push({ id: 'translation-heading', text: 'CHINESE TRANSLATION · 中文译文', kind: 'section-heading', gap: 25 });
    blocks.push({ id: 'translation', text: translation.text, kind: 'translation', indent: true, gap: styles.paragraphGap });
  }
  return blocks;
}
