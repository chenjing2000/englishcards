import { ARTICLE_VERSION, ArticleValidationError, parseArticleV6, paragraphsFromText, type Article } from './article.ts';

export interface ImportInput { name: string; text: string }
export type ImportFormat = 'json' | 'plaintext';
export interface ImportResult { format: ImportFormat; article: Article }

export class ArticleJsonImporter {
  import(input: ImportInput): Article {
    let parsed: unknown;
    try { parsed = JSON.parse(input.text.replace(/^\uFEFF/u, '')); }
    catch (cause) { throw new ArticleValidationError('json', `JSON 语法错误：${String(cause)}`); }
    return parseArticleV6(parsed);
  }
}

export class PlainTextImporter {
  import(input: ImportInput): Article {
    const paragraphs = paragraphsFromText(input.text);
    if (!paragraphs.length) throw new ArticleValidationError('content.paragraphs', '文件没有有效正文');
    const filename = input.name.replace(/^.*[/\\]/u, '');
    const title = filename.replace(/\.[^.]*$/u, '');
    const article: Article = {
      schemaVersion: ARTICLE_VERSION,
      id: crypto.randomUUID(), title, identityTag: '',
      vocabulary: [], content: { paragraphs }, translation: { paragraphs: [] },
    };
    return parseArticleV6(article);
  }
}

/** One user-facing entry point. Invalid/legacy JSON is *never* silently interpreted as prose. */
export class ArticleImportCoordinator {
  private readonly json: ArticleJsonImporter;
  private readonly plaintext: PlainTextImporter;
  constructor(json = new ArticleJsonImporter(), plaintext = new PlainTextImporter()) {
    this.json = json; this.plaintext = plaintext;
  }

  import(input: ImportInput): ImportResult {
    const extension = /\.([^.]+)$/u.exec(input.name)?.[1]?.toLowerCase();
    if (extension !== 'txt' && extension !== 'json') {
      throw new ArticleValidationError('file', '只支持 .txt 和 .json 文件');
    }
    try {
      return { format: 'json', article: this.json.import(input) };
    } catch (error) {
      // A parseable JSON value with incorrect v6 shape is not a plaintext article.
      // JSON-like but malformed content is also rejected even if mislabeled as .txt.
      const normalized = input.text.replace(/^\uFEFF/u, '').trimStart();
      const looksLikeJson = /^[\[{]/u.test(normalized);
      let parseableJson = false;
      try { JSON.parse(normalized); parseableJson = true; } catch { /* plain text candidate */ }
      if (extension === 'json' || looksLikeJson || parseableJson) throw error;
      return { format: 'plaintext', article: this.plaintext.import(input) };
    }
  }
}

export async function importArticleFile(file: File): Promise<ImportResult> {
  return new ArticleImportCoordinator().import({ name: file.name, text: await file.text() });
}
